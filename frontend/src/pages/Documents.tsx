/**
 * RoofPro CRM — Document Management
 *
 * Gallery view of a company's documents (contracts, permits, invoices,
 * photos, estimate PDFs). Supports type + text filtering, drag-and-drop
 * upload, inline image preview with a photo-annotation overlay, PDF embed
 * preview, and secure download.
 *
 * API contract (backend/src/routes/documents.routes.ts):
 *   GET    /documents?type=&search=&page=&limit=   -> { data, count, page, limit, hasMore }
 *   POST   /documents/upload                      -> { data[], count, message }  (multipart)
 *   DELETE /documents/:id                         -> { success, id, message }
 *   GET    /documents/:id/download                -> file stream
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UploadCloud,
  Search,
  FileText,
  FileImage,
  File,
  Download,
  Trash2,
  X,
  Eye,
  Pen,
  Loader2,
  User,
  Clock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import * as Dialog from '@radix-ui/react-dialog';
import { api, resolveFileUrl } from '../services/api';
import { Document, User as UserType } from '../types';
import Button from '../components/ui/Button';
import { Badge } from '../components/ui/Card';
import { toast } from 'react-hot-toast';

type FileType = 'CONTRACT' | 'PERMIT' | 'INVOICE' | 'PHOTO' | 'ESTIMATE_PDF' | 'OTHER';
type FilterType = FileType | 'ALL';
type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'extreme' | 'moderate' | 'minor';

interface Annotation {
  id: string;
  x: number; // coordinates in natural image space
  y: number;
  label: string;
  color: string;
}

const FILTER_OPTIONS: Array<{ value: FilterType; label: string; icon: React.ElementType }> = [
  { value: 'ALL', label: 'All Documents', icon: FileText },
  { value: 'CONTRACT', label: 'Contracts', icon: FileText },
  { value: 'PERMIT', label: 'Permits', icon: FileText },
  { value: 'INVOICE', label: 'Invoices', icon: FileText },
  { value: 'PHOTO', label: 'Photos', icon: FileImage },
  { value: 'ESTIMATE_PDF', label: 'Estimates', icon: FileText },
  { value: 'OTHER', label: 'Other', icon: File },
];

const UPLOAD_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'AUTO', label: 'Auto-detect' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'PERMIT', label: 'Permit' },
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'PHOTO', label: 'Photo' },
  { value: 'ESTIMATE_PDF', label: 'Estimate PDF' },
  { value: 'OTHER', label: 'Other' },
];

const FILE_TYPE_META: Record<FileType, { label: string; badge: BadgeVariant; color: string }> = {
  CONTRACT: { label: 'Contract', badge: 'info', color: '#3b82f6' },
  PERMIT: { label: 'Permit', badge: 'warning', color: '#f59e0b' },
  INVOICE: { label: 'Invoice', badge: 'success', color: '#10b981' },
  PHOTO: { label: 'Photo', badge: 'default', color: '#8b5cf6' },
  ESTIMATE_PDF: { label: 'Estimate PDF', badge: 'extreme', color: '#ef4444' },
  OTHER: { label: 'Other', badge: 'default', color: '#94a3b8' },
};

const ANNOTATION_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

// ─── Helpers ───────────────────────────────────────────────────────────────

const fileExt = (name: string): string => name.split('.').pop()?.toLowerCase() ?? '';

const isImageName = (name: string): boolean => IMAGE_EXTS.includes(fileExt(name));

const isImageDoc = (doc: Document): boolean =>
  doc.fileType === 'PHOTO' || isImageName(doc.name) || isImageName(doc.fileUrl);

const isPdfDoc = (doc: Document): boolean =>
  doc.fileType === 'ESTIMATE_PDF' || fileExt(doc.name) === 'pdf' || fileExt(doc.fileUrl) === 'pdf';

const formatBytes = (bytes?: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(i < 2 ? 0 : 2))} ${sizes[i]}`;
};

const uploadedByName = (doc: Document): string => {
  const u: UserType | undefined = doc.uploadedBy;
  if (!u) return 'Unknown';
  const full = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  return full || u.email || 'Unknown';
};

// ─── Photo annotation overlay (canvas) ─────────────────────────────────────

const ImageAnnotator: React.FC<{ imageUrl: string; documentId: string }> = ({
  imageUrl,
  documentId,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [scale, setScale] = useState(1); // display pixels per natural pixel
  const [annotating, setAnnotating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const storageKey = `roofpro:annotations:${documentId}`;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.naturalWidth) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = img.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = rect.width / img.naturalWidth;
    annotations.forEach((a) => {
      const r = selectedId === a.id ? 12 : 8;
      ctx.beginPath();
      ctx.arc(a.x * s, a.y * s, r, 0, Math.PI * 2);
      ctx.fillStyle = a.color;
      ctx.globalAlpha = selectedId === a.id ? 1 : 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [annotations, selectedId]);

  const onImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    setScale(img.naturalWidth ? img.clientWidth / img.naturalWidth : 1);
  };

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    if (!annotating) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedId) {
        const next = annotations.filter((a) => a.id !== selectedId);
        setAnnotations(next);
        localStorage.setItem(storageKey, JSON.stringify(next));
        setSelectedId(null);
      }
    };
    window.addEventListener('keyup', onKey);
    return () => window.removeEventListener('keyup', onKey);
  }, [annotating, selectedId, annotations, storageKey]);

  const persist = (next: Annotation[]) => {
    setAnnotations(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const displayPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !img.naturalWidth || !canvas || !scale) return null;
    const crect = canvas.getBoundingClientRect();
    const ox = e.clientX - crect.left;
    const oy = e.clientY - crect.top;
    return { displayX: ox, displayY: oy, natural: { x: ox / scale, y: oy / scale } };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = displayPos(e);
    if (!pos) return;
    const threshold = 16;
    const hit = annotations.find(
      (a) => Math.hypot(a.x * scale - pos.displayX, a.y * scale - pos.displayY) < threshold
    );
    if (hit) {
      setSelectedId(hit.id);
      dragIdRef.current = hit.id;
    } else {
      const color = ANNOTATION_COLORS[annotations.length % ANNOTATION_COLORS.length];
      const next = [
        ...annotations,
        {
          id: crypto.randomUUID(),
          x: pos.natural.x,
          y: pos.natural.y,
          label: `Note ${annotations.length + 1}`,
          color,
        },
      ];
      persist(next);
      setSelectedId(next[next.length - 1].id);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragIdRef.current) return;
    const pos = displayPos(e);
    if (!pos) return;
    const next = annotations.map((a) =>
      a.id === dragIdRef.current ? { ...a, x: pos.natural.x, y: pos.natural.y } : a
    );
    setAnnotations(next);
  };

  const endDrag = () => {
    if (dragIdRef.current) {
      persist(annotations);
      dragIdRef.current = null;
    }
  };

  const clearAll = () => {
    persist([]);
    setSelectedId(null);
  };

  return (
    <div className="relative inline-block">
      <img
        ref={imgRef}
        crossOrigin="anonymous"
        src={imageUrl}
        alt="Document preview"
        onLoad={onImgLoad}
        className="max-w-full max-h-[70vh] rounded-lg object-contain"
        style={{ display: 'block' }}
        draggable={false}
      />
      {annotating && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
        />
      )}
      <div className="mt-3 flex items-center gap-2">
        {annotating ? (
          <Button size="sm" variant="outline" onClick={() => setAnnotating(false)}>
            Exit Annotation
          </Button>
        ) : (
          <Button size="sm" variant="outline" leftIcon={<Pen size={14} />} onClick={() => setAnnotating(true)}>
            Annotate
          </Button>
        )}
        {annotating && (
          <>
            <Button size="sm" variant="outline" onClick={clearAll} disabled={!annotations.length}>
              Clear All
            </Button>
            <span className="text-xs text-text-tertiary">
              {annotations.length} marker{annotations.length === 1 ? '' : 's'} · click to add,
              drag to move, Delete to remove selected
            </span>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Upload (drag + drop) modal ────────────────────────────────────────────

interface UploadPayload {
  files: File[];
  fileType: string;
  jobId: string;
}

const UploadModal: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (payload: UploadPayload) => void;
  uploading: boolean;
  progress: number;
}> = ({ open, onOpenChange, onUpload, uploading, progress }) => {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [selectedType, setSelectedType] = useState('AUTO');
  const [jobId, setJobId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filesFromEvent = (items: FileList | null): File[] =>
    items ? Array.from(items).filter((f) => f instanceof File) : [];

  const collectFiles = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    collectFiles(filesFromEvent(e.dataTransfer.files));
  };

  const onBrowse = () => fileInputRef.current?.click();

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleUpload = () => {
    if (!files.length || uploading) return;
    onUpload({ files, fileType: selectedType, jobId });
  };

  const reset = () => {
    setFiles([]);
    setSelectedType('AUTO');
    setJobId('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <Dialog.Trigger asChild>
        <Button leftIcon={<UploadCloud size={18} />}>Upload Document</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 w-full max-w-xl -translate-x-1/2 -translate-y-1/2
                     rounded-xl border border-border bg-[hsl(var(--background-card))] p-6 shadow-xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Dialog.Title className="text-lg font-semibold">Upload Documents</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-text-secondary">
            Drag files onto the drop zone or browse. Choose an optional type.
          </Dialog.Description>

          <div
            className={`mt-4 rounded-lg border-2 border-dashed p-6 text-center transition-colors
              ${
                dragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-border-hover'
              }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              className="hidden"
              onChange={(e) => collectFiles(filesFromEvent(e.target.files))}
            />
            <UploadCloud className="mx-auto h-10 w-10 text-text-tertiary" />
            <p className="mt-2 text-sm text-text-secondary">
              Drag & drop files here, or{' '}
              <span className="cursor-pointer underline text-primary" onClick={onBrowse}>
                browse
              </span>
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              Images, PDFs, Word & Excel documents (up to 50 MB each)
            </p>
          </div>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                >
                  {isImageName(f.name) ? (
                    <img
                      src={URL.createObjectURL(f)}
                      alt={f.name}
                      className="h-8 w-8 rounded object-cover"
                      onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                    />
                  ) : (
                    <File className="h-5 w-5 text-text-tertiary" />
                  )}
                  <div className="flex-1 truncate text-sm text-text-primary">
                    {f.name} — {formatBytes(f.size)}
                  </div>
                  <button
                    className="rounded p-1 text-text-tertiary hover:bg-background-accent hover:text-text-primary"
                    onClick={() => removeFile(i)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary">Document type</label>
              <select
                className="mt-1 w-full rounded-lg border border-border bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                disabled={uploading}
              >
                {UPLOAD_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary">Job ID (optional)</label>
              <input
                className="mt-1 w-full rounded-lg border border-border bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none"
                placeholder="e.g. Job-123"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                disabled={uploading}
              />
            </div>
          </div>

          {uploading && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">Uploading…</span>
                <span className="text-text-primary">{Math.round(progress)}%</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-[hsl(var(--background-accent))]">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              leftIcon={uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud size={16} />}
              onClick={handleUpload}
              disabled={!files.length || uploading}
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

// ─── Document card ─────────────────────────────────────────────────────────

const DocumentCard: React.FC<{
  doc: Document;
  onSelect: () => void;
  onDownload: () => void;
  onDelete: () => void;
}> = ({ doc, onSelect, onDownload, onDelete }) => {
  const meta = FILE_TYPE_META[doc.fileType as FileType] ?? FILE_TYPE_META.OTHER;

  return (
    <div
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl
                 bg-[hsl(var(--background-card))] border border-border shadow-sm
                 transition-transform hover:translate-y-[-2px] hover:shadow-md"
      onClick={onSelect}
    >
      <div className="aspect-video w-full overflow-hidden bg-[hsl(var(--background-accent))]">
        {isImageDoc(doc) ? (
          <img
            src={resolveFileUrl(doc.fileUrl)}
            alt={doc.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <FileText className="h-10 w-10 text-text-tertiary" />
          </div>
        )}
      </div>
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-medium text-text-primary" title={doc.name}>
            {doc.name}
          </h3>
          <Badge variant={meta.badge} size="sm">
            {meta.label}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-text-tertiary">{formatBytes(doc.size)}</p>
        <div className="mt-2 flex flex-col gap-0.5 text-xs text-text-tertiary">
          <span className="flex items-center gap-1">
            <User size={12} /> {uploadedByName(doc)}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} /> {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
          </span>
        </div>
      </div>

      <div
        className="absolute bottom-4 right-4 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          size="sm"
          variant="ghost"
          icon={<Eye size={16} />}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          title="Preview"
        />
        <Button
          size="sm"
          variant="ghost"
          icon={<Download size={16} />}
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          title="Download"
        />
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 size={16} />}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete"
        />
      </div>
    </div>
  );
};

// ─── Preview modal ─────────────────────────────────────────────────────────

const PreviewModal: React.FC<{
  doc: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (doc: Document) => void;
}> = ({ doc, open, onOpenChange, onDeleted }) => {
  if (!doc) return null;
  const meta = FILE_TYPE_META[doc.fileType as FileType] ?? FILE_TYPE_META.OTHER;
  const previewUrl = resolveFileUrl(doc.fileUrl);
  const isImage = isImageDoc(doc);

  const download = async () => {
    try {
      const res = await api.get(`/documents/${doc.id}/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data as BlobPart]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download file');
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 mx-4 w-full max-w-4xl -translate-x-1/2 -translate-y-1/2
                     max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-[hsl(var(--background-card))] p-6 shadow-xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Dialog.Title className="flex items-center gap-2 text-lg font-semibold">
            {doc.name}
            <Badge variant={meta.badge}>{meta.label}</Badge>
          </Dialog.Title>
          <Dialog.Description className="text-sm text-text-secondary">
            {formatBytes(doc.size)} · uploaded {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
          </Dialog.Description>

          <div className="mt-4 flex justify-center">
            {isImage ? (
              <ImageAnnotator imageUrl={previewUrl} documentId={doc.id} />
            ) : isPdfDoc(doc) ? (
              <embed
                src={previewUrl}
                type="application/pdf"
                className="h-[70vh] w-full rounded-lg border border-border"
              />
            ) : (
              <div className="flex h-64 w-full flex-col items-center justify-center rounded-lg border border-border bg-[hsl(var(--background-accent))]">
                <FileText className="h-16 w-16 text-text-tertiary" />
                <p className="mt-2 text-sm text-text-tertiary">{doc.name}</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button variant="outline" size="sm" leftIcon={<Download size={16} />} onClick={download}>
              Download
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 size={16} />}
              onClick={async () => {
                try {
                  await api.delete(`/documents/${doc.id}`);
                  toast.success('Document deleted');
                  onDeleted(doc);
                  onOpenChange(false);
                } catch {
                  toast.error('Could not delete document');
                }
              }}
            >
              Delete
            </Button>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                Close
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

// ─── Main page ─────────────────────────────────────────────────────────────

const Documents: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeType, setActiveType] = useState<FilterType>('ALL');
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['documents', activeType, search],
    queryFn: () =>
      api
        .get('/documents', {
          params: {
            type: activeType !== 'ALL' ? activeType : undefined,
            search: search || undefined,
          },
        })
        .then((res) => res.data),
    placeholderData: { data: [], count: 0 },
  });

  const documents: Document[] = data?.data ?? [];
  const totalCount = data?.count ?? 0;

  const uploadMutation = useMutation({
    mutationFn: ({
      formData,
      onProgress,
    }: {
      formData: FormData;
      onProgress: (pct: number) => void;
    }) =>
      api
        .post('/documents/upload', formData, {
          onUploadProgress: (e) => {
            const pct = e.total ? (e.loaded * 100) / e.total : 0;
            onProgress(pct);
          },
        })
        .then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Documents uploaded');
      setUploadOpen(false);
      setProgress(0);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Upload failed');
      setProgress(0);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document deleted');
    },
    onError: () => toast.error('Could not delete document'),
  });

  const startUpload = async (payload: UploadPayload) => {
    setProgress(0);
    const form = new FormData();
    payload.files.forEach((f) => form.append('files', f));
    if (payload.fileType !== 'AUTO') form.append('fileType', payload.fileType);
    const trimmed = payload.jobId.trim();
    if (trimmed) form.append('jobId', trimmed);
    uploadMutation.mutate({ formData: form, onProgress: setProgress });
  };

  const downloadDocument = async (doc: Document) => {
    try {
      const res = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
      const blob = new Blob([res.data as BlobPart]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download file');
    }
  };

  const handleDelete = (doc: Document) => {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;
    deleteMutation.mutate(doc.id);
  };

  const handleDeletedFromPreview = (doc: Document) => {
    setSelectedDoc(null);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Documents</h1>
          <p className="text-text-secondary">
            Contracts, permits, invoices, and photos for your roofing jobs.
          </p>
        </div>

        <UploadModal
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onUpload={startUpload}
          uploading={uploadMutation.isPending}
          progress={progress}
        />
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {FILTER_OPTIONS.map((f) => {
            const Icon = f.icon;
            const active = activeType === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setActiveType(f.value)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium
                  ${
                    active
                      ? 'bg-primary text-white'
                      : 'bg-[hsl(var(--background-accent))] text-text-secondary hover:bg-border'
                  }
                  transition-colors`}
              >
                <Icon size={14} />
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input
            className="w-full rounded-lg border border-border bg-[hsl(var(--background))] pl-10 pr-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-tertiary hover:text-text-primary"
              onClick={() => setSearch('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Gallery */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-video animate-pulse rounded-xl bg-[hsl(var(--background-accent))]"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-border bg-[hsl(var(--background-accent))] p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red" />
          <p className="mt-2 text-sm text-text-secondary">Could not load documents.</p>
          <Button size="sm" variant="outline" leftIcon={<RefreshCw size={14} />} onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-lg border border-border bg-[hsl(var(--background-card))] py-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-text-tertiary" />
          <h3 className="mt-3 text-lg font-medium">No documents found</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {search || activeType !== 'ALL'
              ? 'Try adjusting your filters.'
              : 'Get started by uploading your first document.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onSelect={() => setSelectedDoc(doc)}
              onDownload={() => downloadDocument(doc)}
              onDelete={() => handleDelete(doc)}
            />
          ))}
        </div>
      )}

      <PreviewModal
        doc={selectedDoc}
        open={!!selectedDoc}
        onOpenChange={(open) => !open && setSelectedDoc(null)}
        onDeleted={handleDeletedFromPreview}
      />
    </div>
  );
};

export default Documents;
