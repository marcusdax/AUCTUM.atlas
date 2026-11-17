import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Lead } from '../../types';
import { UserPlus, Save, ArrowLeft, MapPin } from 'lucide-react';

const LeadForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditMode = Boolean(id);

  const [formData, setFormData] = useState<Partial<Lead>>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    propertyAddress: '',
    source: 'WEBSITE',
    status: 'NEW',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch existing lead if in edit mode
  const { data: existingLead, isLoading: isLoadingLead } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.get(`/leads/${id}`).then((res) => res.data),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (existingLead?.lead) {
      const lead = existingLead.lead;
      setFormData({
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        propertyAddress: lead.propertyAddress,
        source: lead.source,
        status: lead.status,
        notes: lead.notes,
      });
    }
  }, [existingLead]);

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post('/leads', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      navigate('/leads');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => api.patch(`/leads/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      navigate('/leads');
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

  if (isLoadingLead) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p>Loading lead…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/leads')}>
          <ArrowLeft size={16} />
          Back to Leads
        </Button>
        <h1 className="text-3xl font-bold text-text-primary">
          {isEditMode ? 'Edit Lead' : 'New Lead'}
        </h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-text-secondary mb-1">
                First Name
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                value={formData.firstName || ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="John"
                required
              />
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-text-secondary mb-1">
                Last Name
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={formData.lastName || ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Doe"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email || ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-text-secondary mb-1">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone || ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="(555) 123-4567"
              />
            </div>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="source" className="block text-sm font-medium text-text-secondary mb-1">
                Lead Source
              </label>
              <select
                id="source"
                name="source"
                value={formData.source || 'WEBSITE'}
                onChange={handleChange}
                className="w-full rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="WEBSITE">Website</option>
                <option value="PHONE">Phone</option>
                <option value="REFERRAL">Referral</option>
                <option value="STORM_EVENT">Storm Event</option>
                <option value="MANUAL">Manual</option>
                <option value="IMPORT">Import</option>
              </select>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-text-secondary mb-1">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status || 'NEW'}
                onChange={handleChange}
                className="w-full rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="NEW">New</option>
                <option value="CONTACTED">Contacted</option>
                <option value="INSPECTION_SCHEDULED">Inspection Scheduled</option>
                <option value="ESTIMATE_SENT">Estimate Sent</option>
                <option value="WON">Won</option>
                <option value="LOST">Lost</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-text-secondary mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes || ''}
              onChange={handleChange}
              rows={4}
              className="w-full rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Add any notes about this lead…"
            />
          </div>
        </form>
      </Card>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={() => navigate('/leads')}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} isLoading={isSubmitting} leftIcon={<Save size={16} />}>
          {isEditMode ? 'Update Lead' : 'Create Lead'}
        </Button>
      </div>
    </div>
  );
};

export default LeadForm;
