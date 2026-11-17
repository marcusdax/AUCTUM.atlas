import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Job } from '../../types';
import { Save, ArrowLeft, MapPin, Calendar } from 'lucide-react';

const JobForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditMode = Boolean(id);

  const [formData, setFormData] = useState<Partial<Job>>({
    name: '',
    description: '',
    status: 'ACTIVE',
    phase: 'INSPECTION',
    propertyAddress: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch existing job if in edit mode
  const { data: existingJob, isLoading: isLoadingJob } = useQuery({
    queryKey: ['job', id],
    queryFn: () => api.get(`/jobs/${id}`).then((res) => res.data),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (existingJob?.job) {
      const job = existingJob.job;
      setFormData({
        name: job.name,
        description: job.description,
        status: job.status,
        phase: job.phase,
        propertyAddress: job.propertyAddress,
      });
    }
  }, [existingJob]);

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post('/jobs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      navigate('/jobs');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => api.patch(`/jobs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', id] });
      navigate('/jobs');
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isEditMode) {
        await updateMutation.mutateAsync(formData);
      } else {
        await createMutation.mutateAsync(formData);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingJob) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p>Loading job…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/jobs')}>
          <ArrowLeft size={16} />
          Back to Jobs
        </Button>
        <h1 className="text-3xl font-bold text-text-primary">
          {isEditMode ? 'Edit Job' : 'New Job'}
        </h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-1">
              Job Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name || ''}
              onChange={handleChange}
              className="w-full rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Smith Residence Roof Replacement"
              required
            />
          </div>

          <div>
            <label htmlFor="propertyAddress" className="block text-sm font-medium text-text-secondary mb-1">
              Property Address
            </label>
            <div className="relative">
              <input
                id="propertyAddress"
                name="propertyAddress"
                type="text"
                value={formData.propertyAddress || ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 pl-10 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="123 Main St, City, State 12345"
                required
              />
              <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-text-secondary mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description || ''}
              onChange={handleChange}
              rows={4}
              className="w-full rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Describe the scope of work…"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-text-secondary mb-1">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status || 'ACTIVE'}
                onChange={handleChange}
                className="w-full rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div>
              <label htmlFor="phase" className="block text-sm font-medium text-text-secondary mb-1">
                Phase
              </label>
              <select
                id="phase"
                name="phase"
                value={formData.phase || 'INSPECTION'}
                onChange={handleChange}
                className="w-full rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="INSPECTION">Inspection</option>
                <option value="ESTIMATE">Estimate</option>
                <option value="PRODUCTION">Production</option>
                <option value="INVOICING">Invoicing</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-text-secondary mb-1">
                Start Date
              </label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                value={formData.startDate?.slice(0, 10) || ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-text-secondary mb-1">
                End Date
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                value={formData.endDate?.slice(0, 10) || ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </form>
      </Card>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={() => navigate('/jobs')}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} isLoading={isSubmitting} leftIcon={<Save size={16} />}>
          {isEditMode ? 'Update Job' : 'Create Job'}
        </Button>
      </div>
    </div>
  );
};

export default JobForm;
