import React, { useState, useCallback, useRef } from 'react';
import { Card } from '../ui';
import {
  Upload,
  Image,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import clsx from 'clsx';
import { api, resolveFileUrl } from '../../services/api';

export interface DetectedComponent {
  id: string;
  name: string;
  confidence: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  severity?: 'extreme' | 'severe' | 'moderate' | 'minor';
  maskUrl?: string;
}

export interface PropertyImageUploadProps {
  onUploadSuccess?: (components: DetectedComponent[], imageUrl: string) => void;
  onProcessingError?: (error: string) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
  propertyId?: string;
  jobId?: string;
}

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  result?: {
    components: DetectedComponent[];
    imageUrl: string;
  };
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSeverityColor(severity?: string): string {
  const colors: Record<string, string> = {
    extreme: 'border-[hsl(var(--severity-extreme))] bg-[hsl(var(--severity-extreme))]/10',
    severe: 'border-[hsl(var(--severity-severe))] bg-[hsl(var(--severity-severe))]/10',
    moderate: 'border-[hsl(var(--severity-moderate))] bg-[hsl(var(--severity-moderate))]/10',
    minor: 'border-[hsl(var(--severity-minor))] bg-[hsl(var(--severity-minor))]/10',
  };
  return colors[severity || ''] || 'border-[hsl(var(--border))]';
}

function getSeverityTextColor(severity?: string): string {
  const colors: Record<string, string> = {
    extreme: 'text-[hsl(var(--severity-extreme))]',
    severe: 'text-[hsl(var(--severity-severe))]',
    moderate: 'text-[hsl(var(--severity-moderate))]',
    minor: 'text-[hsl(var(--severity-minor))]',
  };
  return colors[severity || ''] || 'text-text-tertiary';
}

function FilePreview({ file, onRemove, onView }: { file: UploadedFile; onRemove: () => void; onView: () => void }) {
  const { preview, status, progress, error, file: fileObj, result } = file;

  const statusIcons = {
    pending: <Upload className="w-5 h-5 text-text-tertiary" />,
    uploading: <Loader2 className="w-5 h-5 text-primary animate-spin" />,
    processing: <Loader2 className="w-5 h-5 text-[hsl(var(--intelligence-violet))] animate-spin" />,
    completed: <CheckCircle className="w-5 h-5 text-[hsl(var(--emerald))]" />,
    error: <AlertCircle className="w-5 h-5 text-[hsl(var(--red))]" />,
  };

  const statusLabels = {
    pending: 'Waiting',
    uploading: 'Uploading',
    processing: 'AI Processing',
    completed: 'Completed',
    error: 'Error',
  };

  return (
    <div
      className={clsx(
        'relative group aspect-square rounded-lg overflow-hidden border-2 transition-all',
        getSeverityColor(result?.components[0]?.severity)
      )}
    >
      <img src={preview} alt={fileObj.name} className="w-full h-full object-cover" />

      {/* Status Overlay */}
      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex flex-col items-center gap-2 text-white p-4">
          {statusIcons[status]}
          <span className="text-xs font-medium">{statusLabels[status]}</span>
          {(status === 'uploading' || status === 'processing') && (
            <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {error && <p className="text-xs text-red-300 text-center max-w-[120px]">{error}</p>}
        </div>
      </div>

      {/* Action Buttons on Hover */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onView}
          className="p-1.5 bg-[hsl(var(--background-card))]/90 backdrop-blur rounded-full text-text-primary hover:text-primary transition-colors"
          title="View details"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={onRemove}
          className="p-1.5 bg-[hsl(var(--background-card))]/90 backdrop-blur rounded-full text-text-tertiary hover:text-red-400 transition-colors"
          title="Remove"
          disabled={status === 'uploading' || status === 'processing'}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar at Bottom */}
      {(status === 'uploading' || status === 'processing') && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Completed Badge */}
      {status === 'completed' && (
        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-[hsl(var(--emerald))]/90 backdrop-blur px-2 py-1 rounded-full">
          <CheckCircle className="w-3 h-3 text-white" />
          <span className="text-xs font-medium text-white">Analyzed</span>
        </div>
      )}
    </div>
  );
}

function DetectionResults({ components, imageUrl }: { components: DetectedComponent[]; imageUrl: string }) {
  if (!components.length) {
    return (
      <div className="text-center py-8 text-text-tertiary">
        <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No components detected in this image</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        <Image className="w-4 h-4 text-[hsl(var(--intelligence-cyan))]" />
        Detected Components ({components.length})
      </h4>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {components.map((comp, idx) => (
          <div
            key={comp.id || idx}
            className={clsx(
              'p-3 rounded-lg border transition-colors',
              getSeverityColor(comp.severity)
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-text-primary capitalize truncate">
                {comp.name.replace(/-/g, ' ')}
              </span>
              <span className={clsx('text-xs font-mono font-bold', getSeverityTextColor(comp.severity))}>
                {comp.confidence}%
              </span>
            </div>
            <div className="h-1.5 bg-[hsl(var(--border))] rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-1000 ease-out"
                style={{ width: `${comp.confidence}%` }}
              />
            </div>
            {comp.severity && (
              <span
                className={clsx(
                  'inline-block mt-1.5 px-2 py-0.5 text-xs font-medium rounded-full',
                  getSeverityColor(comp.severity)
                )}
              >
                {comp.severity.toUpperCase()}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export const PropertyImageUpload: React.FC<PropertyImageUploadProps> = ({
  onUploadSuccess,
  onProcessingError,
  maxFiles = 5,
  acceptedTypes = ACCEPTED_TYPES,
  propertyId,
  jobId,
}) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showResults, setShowResults] = useState<UploadedFile | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `File type ${file.type} not supported. Use JPG, PNG, or WebP.`;
    }
    if (file.size > 10 * 1024 * 1024) {
      return 'File size exceeds 10MB limit.';
    }
    return null;
  }, [acceptedTypes]);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const validFiles = fileArray.filter((file) => {
        const error = validateFile(file);
        if (error) {
          onProcessingError?.(error);
          return false;
        }
        return true;
      });

      if (files.length + validFiles.length > maxFiles) {
        onProcessingError?.(`Maximum ${maxFiles} files allowed.`);
        return;
      }

      const uploadFiles: UploadedFile[] = validFiles.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        preview: URL.createObjectURL(file),
        status: 'pending',
        progress: 0,
      }));

      setFiles((prev) => [...prev, ...uploadFiles]);

      // Auto-upload
      uploadFiles.forEach((uf) => uploadFile(uf.id));
    },
    [files.length, maxFiles, validateFile, onProcessingError]
  );

  const uploadFile = useCallback(
    async (fileId: string) => {
      const fileIndex = files.findIndex((f) => f.id === fileId);
      if (fileIndex === -1) return;

      const file = files[fileIndex];
      if (file.status !== 'pending') return;

      setFiles((prev) => {
        const next = [...prev];
        next[fileIndex] = { ...next[fileIndex], status: 'uploading', progress: 0 };
        return next;
      });

      // Simulate upload progress
        let progressInterval: ReturnType<typeof setInterval> | null = null;

        try {
          const formData = new FormData();
          formData.append('image', file.file);
          if (propertyId) formData.append('propertyId', propertyId);
          if (jobId) formData.append('jobId', jobId);

          progressInterval = setInterval(() => {
            setFiles((prev) => {
              const next = [...prev];
              const idx = next.findIndex((f) => f.id === fileId);
              if (idx !== -1 && next[idx].progress < 90) {
                next[idx] = { ...next[idx], progress: next[idx].progress + 10 };
              }
              return next;
            });
          }, 100);

          const response = await api.post('/ai/segment', formData, {
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                setFiles((prev) => {
                  const next = [...prev];
                  const idx = next.findIndex((f) => f.id === fileId);
                  if (idx !== -1) {
                    next[idx] = { ...next[idx], progress: Math.min(percent, 95) };
                  }
                  return next;
                });
              }
            },
          });

          if (progressInterval) clearInterval(progressInterval);

        setFiles((prev) => {
          const next = [...prev];
          const idx = next.findIndex((f) => f.id === fileId);
          if (idx !== -1) {
            next[idx] = {
              ...next[idx],
              status: 'processing',
              progress: 100,
            };
          }
          return next;
        });

        // Process AI results
        const { components, imageUrl } = response.data;

        setFiles((prev) => {
          const next = [...prev];
          const idx = next.findIndex((f) => f.id === fileId);
          if (idx !== -1) {
            next[idx] = {
              ...next[idx],
              status: 'completed',
              progress: 100,
              result: { components, imageUrl: resolveFileUrl(imageUrl) },
            };
          }
          return next;
        });

        onUploadSuccess?.(components, resolveFileUrl(imageUrl));
      } catch (error: unknown) {
        if (progressInterval) clearInterval(progressInterval);
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';

        setFiles((prev) => {
          const next = [...prev];
          const idx = next.findIndex((f) => f.id === fileId);
          if (idx !== -1) {
            next[idx] = { ...next[idx], status: 'error', error: errorMessage, progress: 0 };
          }
          return next;
        });

        onProcessingError?.(errorMessage);
      }
    },
    [files, propertyId, jobId, onUploadSuccess, onProcessingError]
  );

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === fileId);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== fileId);
    });
  }, []);

  const retryFile = useCallback((fileId: string) => {
    uploadFile(fileId);
  }, [uploadFile]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
        e.target.value = '';
      }
    },
    [addFiles]
  );

  const handleViewResults = useCallback((file: UploadedFile) => {
    if (file.result) {
      setShowResults(file);
    }
  }, []);

  const completedFiles = files.filter((f) => f.status === 'completed');

  return (
    <Card variant="bordered" title="Property Image Upload" subtitle="Drag & drop or click to upload property photos for AI analysis">
      {/* Drop Zone */}
      <div
        className={clsx(
          'relative border-2 border-dashed rounded-xl p-8 text-center transition-all',
          'cursor-pointer',
          isDragActive
            ? 'border-primary bg-[hsl(var(--primary))]/5'
            : 'border-[hsl(var(--border))] hover:border-primary/50'
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          multiple
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Upload property images"
        />

        <div className="relative z-10">
          <div className={clsx('mx-auto mb-4 transition-colors', isDragActive ? 'text-primary' : 'text-text-tertiary')}>
            <Upload className="w-12 h-12" />
          </div>
          <p className="text-text-primary mb-1">Drop images here or click to browse</p>
          <p className="text-sm text-text-tertiary">
            JPG, PNG, WebP up to 10MB each • Max {maxFiles} files
          </p>
        </div>
      </div>

      {/* Upload Queue */}
      {files.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-text-primary">
              Upload Queue ({files.length})
            </h4>
            {files.some((f) => f.status === 'error') && (
              <button
                onClick={() => files.filter((f) => f.status === 'error').forEach((f) => retryFile(f.id))}
                className="btn btn-ghost btn-sm flex items-center gap-1"
              >
                <RotateCcw className="w-4 h-4" />
                Retry Failed
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {files.map((file) => (
              <FilePreview
                key={file.id}
                file={file}
                onRemove={() => removeFile(file.id)}
                onView={() => handleViewResults(file)}
              />
            ))}
          </div>

          {/* Summary */}
          {completedFiles.length > 0 && (
            <div className="p-4 bg-[hsl(var(--background-elevated))] rounded-lg border border-[hsl(var(--border))]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-[hsl(var(--emerald))]" />
                  <span className="text-sm font-medium text-text-primary">
                    {completedFiles.length} image(s) analyzed successfully
                  </span>
                </div>
                <button
                  onClick={() => setShowResults(completedFiles[completedFiles.length - 1])}
                  className="btn btn-primary btn-sm"
                >
                  View Latest Results
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Modal */}
      {showResults && showResults.result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fadeIn">
          <div className="bg-[hsl(var(--background-card))] border border-[hsl(var(--border))] rounded-xl max-w-3xl w-full max-h-[80vh] overflow-hidden animate-slideUp">
            <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
              <h3 className="text-lg font-semibold text-text-primary">AI Detection Results</h3>
              <button
                onClick={() => setShowResults(null)}
                className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <DetectionResults
                components={showResults.result.components}
                imageUrl={showResults.result.imageUrl}
              />
            </div>
            <div className="p-4 border-t border-[hsl(var(--border))] flex justify-end gap-2">
              <button
                onClick={() => setShowResults(null)}
                className="btn btn-secondary btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default PropertyImageUpload;