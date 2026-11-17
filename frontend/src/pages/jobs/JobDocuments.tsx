import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Badge } from '../../components/ui/Card';
import { Document } from '../../types';
import {
  ArrowLeft,
  Upload,
  Download,
  FileText,
  Trash2,
  Clock,
} from 'lucide-react';

const JobDocuments: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const [uploading, setUploading] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['job-documents', jobId],
    queryFn: () => api.get(`/documents/jobs/${jobId}`).then((res) => res.data),
    enabled: Boolean(jobId),
  });

  const documents: Document[] = data?.documents || data?.data || [];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !jobId) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('document', file);
    formData.append('jobId', jobId);

    try {
      await api.post('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      refetch();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await api.delete(`/documents/${docId}`);
      refetch();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p>Loading documents…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/jobs/${jobId}`)}>
          <ArrowLeft size={16} />
          Back to Job
        </Button>
        <h1 className="text-3xl font-bold text-text-primary">Job Documents</h1>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <p className="text-text-tertiary">
          {documents.length} document{documents.length !== 1 ? 's' : ''} for this job
        </p>
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
          <Button leftIcon={<Upload size={16} />} isLoading={uploading}>
            Upload Document
          </Button>
        </label>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12 text-text-tertiary">
          <FileText size={48} className="mx-auto mb-3 opacity-30" />
          <p>No documents yet. Upload a file to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <Card key={doc.id} variant="bordered" className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">{doc.name}</p>
                    <div className="flex items-center gap-2 text-xs text-text-tertiary">
                      <Badge variant="info" size="sm">{doc.fileType}</Badge>
                      {doc.size && <span>{(doc.size / 1024).toFixed(1)} KB</span>}
                      <span>
                        <Clock size={12} className="inline mr-1" />
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-1">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg p-2 text-text-tertiary hover:bg-[hsl(var(--background-accent))]"
                    title="Download"
                  >
                    <Download size={16} />
                  </a>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="rounded-lg p-2 text-text-tertiary hover:bg-red/10 hover:text-red"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobDocuments;
