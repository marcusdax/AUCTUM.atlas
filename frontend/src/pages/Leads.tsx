import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import Button from '../components/ui/Button';
import { Badge, StatusDot } from '../components/ui/Card';
import { useAuthStore } from '../stores/authStore';
import { Lead, User } from '../types';
import { format } from 'date-fns';
import clsx from 'clsx';
import {
  Plus,
  GripVertical,
  Phone,
  Mail,
  MapPin,
  Wind,
  Edit,
  X,
  Loader2,
  Calendar,
  Clock,
  AlertCircle,
  Users,
  Search,
  BarChart3,
  Briefcase,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import toast from 'react-hot-toast';

type LeadStatus = NonNullable<Lead['status']>;
type LeadSource = NonNullable<Lead['source']>;
type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'extreme'
  | 'severe'
  | 'moderate'
  | 'minor';

interface LeadsResponse {
  data: Lead[];
  count: number;
}

const LEAD_STATUSES: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'INSPECTION_SCHEDULED',
  'ESTIMATE_SENT',
  'WON',
  'LOST',
];

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  INSPECTION_SCHEDULED: 'Inspection Scheduled',
  ESTIMATE_SENT: 'Estimate Sent',
  WON: 'Won',
  LOST: 'Lost',
};

const STATUS_COLUMN_BG: Record<LeadStatus, string> = {
  NEW: 'bg-background-accent/40',
  CONTACTED: 'bg-primary/15',
  INSPECTION_SCHEDULED: 'bg-purple/15',
  ESTIMATE_SENT: 'bg-amber/15',
  WON: 'bg-emerald/15',
  LOST: 'bg-red/15',
};

const STATUS_HEADER_BORDER: Record<LeadStatus, string> = {
  NEW: 'border-t-text-tertiary',
  CONTACTED: 'border-t-primary',
  INSPECTION_SCHEDULED: 'border-t-purple',
  ESTIMATE_SENT: 'border-t-amber',
  WON: 'border-t-emerald',
  LOST: 'border-t-red',
};

const SOURCE_LABELS: Record<LeadSource, string> = {
  WEBSITE: 'Website',
  PHONE: 'Phone',
  REFERRAL: 'Referral',
  STORM_EVENT: 'Storm Event',
  MANUAL: 'Manual',
  IMPORT: 'Import',
  MARKETING_QR: 'Marketing QR',
};

const SOURCE_VARIANTS: Record<LeadSource, BadgeVariant> = {
  WEBSITE: 'default',
  PHONE: 'default',
  REFERRAL: 'success',
  STORM_EVENT: 'info',
  MANUAL: 'default',
  IMPORT: 'default',
  MARKETING_QR: 'success',
};

const stormScoreVariant = (score?: number): BadgeVariant => {
  if (score === undefined) return 'default';
  if (score >= 80) return 'extreme';
  if (score >= 60) return 'severe';
  if (score >= 40) return 'moderate';
  if (score >= 20) return 'minor';
  return 'default';
};

const stormSeverityLabel = (score?: number): string => {
  if (score === undefined) return 'No score';
  if (score >= 80) return 'Extreme';
  if (score >= 60) return 'Severe';
  if (score >= 40) return 'Moderate';
  if (score >= 20) return 'Minor';
  return 'Low';
};

const formatDate = (dateString?: string) => {
  if (!dateString) return '—';
  try {
    return format(new Date(dateString), 'PPp');
  } catch {
    return dateString;
  }
};

const UserAvatar: React.FC<{ user: User; size?: 'sm' | 'md' | 'lg' }> = ({ user, size = 'md' }) => {
  const sizeClasses = { sm: 'h-7 w-7', md: 'h-8 w-8', lg: 'h-10 w-10' };
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={initials}
        className={clsx(sizeClasses[size], 'rounded-full object-cover ring-2 ring-[hsl(var(--background-elevated))]')}
      />
    );
  }
  return (
    <div
      className={clsx(
        sizeClasses[size],
        'flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white'
      )}
      title={`${user.firstName} ${user.lastName}`}
    >
      {initials}
    </div>
  );
};

const SourceBadge: React.FC<{ source?: LeadSource }> = ({ source }) => {
  const value = source ?? 'MANUAL';
  const variant = SOURCE_VARIANTS[value];
  return <Badge variant={variant} size="sm">{SOURCE_LABELS[value]}</Badge>;
};

const StormScoreBadge: React.FC<{ score?: number }> = ({ score }) => {
  const variant = stormScoreVariant(score);
  return (
    <Badge variant={variant} size="sm" className="gap-1">
      <Wind size={12} />
      {score !== undefined ? `${score}` : '—'}
    </Badge>
  );
};

interface LeadCardProps {
  lead: Lead;
  onClick: (lead: Lead) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, lead: Lead) => void;
}

const LeadCard: React.FC<LeadCardProps> = ({ lead, onClick, onDragStart }) => {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onClick={() => onClick(lead)}
      className="group cursor-grab rounded-xl border border-border bg-[hsl(var(--background-card))] p-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <StatusDot status={lead.status} size="sm" />
            <h3 className="truncate text-sm font-semibold text-text-primary">
              {lead.firstName} {lead.lastName}
            </h3>
            <GripVertical
              size={14}
              className="ml-auto cursor-grab text-text-tertiary opacity-0 group-hover:opacity-60"
              aria-hidden="true"
            />
          </div>

          <div className="mt-2 space-y-1 text-sm text-text-secondary">
            {lead.phone && (
              <div className="flex items-center gap-2 truncate">
                <Phone size={14} className="flex-shrink-0" />
                <span>{lead.phone}</span>
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-2 truncate">
                <Mail size={14} className="flex-shrink-0" />
                <span>{lead.email}</span>
              </div>
            )}
            <div className="flex items-start gap-2">
              <MapPin size={14} className="mt-0.5 flex-shrink-0" />
              <span className="block break-words">{lead.propertyAddress}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SourceBadge source={lead.source} />
        <StormScoreBadge score={lead.score} />
        {lead.assignedTo && <UserAvatar user={lead.assignedTo} size="sm" />}
        <div className="ml-auto" />
      </div>

      {lead.stormEvent && (
        <div className="mt-2 text-xs text-text-tertiary">
          <Wind size={12} className="mr-1 inline" />
          <span>Storm: {lead.stormEvent.name}</span>
          <Badge variant={stormScoreVariant(lead.score)} size="sm" className="ml-2">
            {stormSeverityLabel(lead.score)}
          </Badge>
        </div>
      )}
    </div>
  );
};

interface KanbanColumnProps {
  status: LeadStatus;
  leads: Lead[];
  dragOver: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, lead: Lead) => void;
  onClickCard: (lead: Lead) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  leads,
  dragOver,
  onDragOver,
  onDrop,
  onDragStart,
  onClickCard,
}) => {
  return (
    <div
      data-column={status}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={clsx(
        'flex flex-col gap-3 rounded-xl border-2 border-dashed border-border bg-[hsl(var(--background-card))] p-3 min-w-72',
        STATUS_COLUMN_BG[status],
        dragOver && 'border-primary/60 ring-2 ring-primary/20'
      )}
    >
      <div className={clsx('flex items-center justify-between border-b border-border pb-2', STATUS_HEADER_BORDER[status])}>
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
          <span className="text-sm font-semibold text-text-primary">{STATUS_LABELS[status]}</span>
        </div>
        <Badge variant="default" size="sm">
          {leads.length}
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto">
        {leads.length === 0 ? (
          <div className="flex min-h-[60px] flex-col items-center justify-center gap-1.5 text-center">
            <AlertCircle size={16} className="text-text-tertiary opacity-50" />
            <span className="text-xs text-text-tertiary">Drop leads here</span>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onClick={onClickCard} onDragStart={onDragStart} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface LeadFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Lead | null;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  isSubmitting: boolean;
}

const LeadForm: React.FC<LeadFormProps> = ({ open, onOpenChange, initialData, onSubmit, isSubmitting }) => {
  const { user: currentUser } = useAuthStore();
  const isEdit = Boolean(initialData?.id);

  const [form, setForm] = useState<Partial<Lead>>({});

  useEffect(() => {
    if (!open) return;
    setForm({
      firstName: initialData?.firstName ?? '',
      lastName: initialData?.lastName ?? '',
      email: initialData?.email ?? '',
      phone: initialData?.phone ?? '',
      propertyAddress: initialData?.propertyAddress ?? '',
      source: initialData?.source ?? 'WEBSITE',
      notes: initialData?.notes ?? '',
      assignedToUserId: initialData?.assignedToUserId,
    });
  }, [open, initialData, currentUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAssignToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setForm((prev) => ({
      ...prev,
      assignedToUserId: checked && currentUser ? currentUser.id : undefined,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName?.trim() || !form.lastName?.trim() || !form.propertyAddress?.trim()) {
      toast.error('Please fill in name and property address');
      return;
    }
    if (!form.source) {
      toast.error('Please select a lead source');
      return;
    }

    const payload: Record<string, unknown> = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email?.trim() ? form.email.trim() : undefined,
      phone: form.phone?.trim() ? form.phone.trim() : undefined,
      propertyAddress: form.propertyAddress.trim(),
      source: form.source,
      notes: form.notes?.trim() ? form.notes.trim() : undefined,
      assignedToUserId: form.assignedToUserId,
    };

    await onSubmit(payload);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-[hsl(var(--background-card))] p-6 shadow-xl"
        >
          <Dialog.Title className="text-xl font-semibold text-text-primary">
            {isEdit ? 'Edit Lead' : 'New Lead'}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-text-secondary">
            {isEdit ? 'Update lead details.' : 'Add a new lead to your pipeline.'}
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    First Name *
                  </label>
                  <input
                    name="firstName"
                    value={form.firstName ?? ''}
                    onChange={handleChange}
                    required
                    className="input mt-1"
                    placeholder="Jane"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    Last Name *
                  </label>
                  <input
                    name="lastName"
                    value={form.lastName ?? ''}
                    onChange={handleChange}
                    required
                    className="input mt-1"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Property Address *
                </label>
                <input
                  name="propertyAddress"
                  value={form.propertyAddress ?? ''}
                  onChange={handleChange}
                  required
                  className="input mt-1"
                  placeholder="123 Main St, City, State"
                />
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email ?? ''}
                  onChange={handleChange}
                  className="input mt-1"
                  placeholder="jane@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone ?? ''}
                  onChange={handleChange}
                  className="input mt-1"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Source
                </label>
                <select
                  name="source"
                  value={form.source ?? 'WEBSITE'}
                  onChange={handleChange}
                  className="input mt-1"
                >
                  <option value="WEBSITE">Website</option>
                  <option value="PHONE">Phone</option>
                  <option value="REFERRAL">Referral</option>
                  <option value="STORM_EVENT">Storm Event</option>
                  <option value="MANUAL">Manual</option>
                  <option value="IMPORT">Import</option>
                  <option value="MARKETING_QR">Marketing QR</option>
                </select>
              </div>

              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  id="assign-to-me"
                  type="checkbox"
                  checked={Boolean(form.assignedToUserId && currentUser?.id === form.assignedToUserId)}
                  onChange={handleAssignToggle}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="assign-to-me" className="text-sm text-text-secondary">
                  Assign to me
                </label>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={form.notes ?? ''}
                  onChange={handleChange}
                  rows={3}
                  className="input mt-1"
                  placeholder="Additional context..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <Button variant="ghost" size="md" type="button" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="primary" size="md" type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                {isEdit ? 'Save Changes' : 'Create Lead'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

interface LeadDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onUpdate: (data: Partial<Lead>) => void;
  onEdit: () => void;
}

const LeadDetail: React.FC<LeadDetailProps> = ({ open, onOpenChange, lead, onUpdate, onEdit }) => {
  const [notesDraft, setNotesDraft] = useState(lead.notes ?? '');

  useEffect(() => {
    setNotesDraft(lead.notes ?? '');
  }, [lead.notes]);

  const handleNotesBlur = () => {
    const trimmed = notesDraft.trim();
    if (trimmed !== (lead.notes ?? '')) {
      onUpdate({ notes: trimmed });
    }
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate({ status: e.target.value as LeadStatus });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content
          className="fixed right-0 top-0 flex h-screen w-full max-w-2xl flex-col gap-6 overflow-y-auto border-l border-border bg-[hsl(var(--background-card))] p-6 shadow-xl"
        >
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-2xl font-bold text-text-primary">
                {lead.firstName} {lead.lastName}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-text-secondary">
                {formatDate(lead.createdAt)} • Updated {formatDate(lead.updatedAt)}
              </Dialog.Description>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" icon={<Edit size={16} />} onClick={onEdit} />
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm" icon={<X size={16} />} aria-label="Close" />
              </Dialog.Close>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  <Phone size={14} /> Contact
                </label>
                <div className="mt-2 space-y-1.5 text-sm">
                  {lead.phone && (
                    <div className="flex items-center gap-2 text-text-primary">{lead.phone}</div>
                  )}
                  {lead.email && (
                    <div className="flex items-center gap-2 break-all text-text-primary">{lead.email}</div>
                  )}
                  {!lead.phone && !lead.email && <span className="text-text-tertiary">No contact info</span>}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  <MapPin size={14} /> Property Address
                </label>
                <p className="mt-2 text-sm text-text-primary">{lead.propertyAddress}</p>
                {lead.propertyLatLng && (
                  <p className="mt-1 text-xs text-text-tertiary">
                    {lead.propertyLatLng.lat.toFixed(4)}, {lead.propertyLatLng.lng.toFixed(4)}
                  </p>
                )}
              </div>

              <div>
                <span className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Lead Source
                </span>
                <div className="mt-2">
                  <SourceBadge source={lead.source} />
                </div>
              </div>

              {lead.stormEvent && (
                <div>
                  <span className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    Storm Event
                  </span>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={stormScoreVariant(lead.score)} size="sm">
                      <Wind size={12} /> {lead.stormEvent.name}
                    </Badge>
                    <span className="text-xs text-text-tertiary">{stormSeverityLabel(lead.score)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <span className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Status
                </span>
                <select
                  value={lead.status}
                  onChange={handleStatusChange}
                  className="input mt-2"
                >
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Assigned To
                </span>
                <div className="mt-2">
                  {lead.assignedTo ? (
                    <div className="flex items-center gap-2">
                      <UserAvatar user={lead.assignedTo} />
                      <span className="text-sm text-text-primary">
                        {lead.assignedTo.firstName} {lead.assignedTo.lastName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-text-tertiary">Unassigned</span>
                  )}
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Storm Score
                </span>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StormScoreBadge score={lead.score} />
                  <Link
                    to={`/storm-tracking?leadId=${lead.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-[hsl(var(--background-elevated))] px-2 py-1 text-xs font-medium text-text-primary hover:bg-[hsl(var(--background-accent))]"
                  >
                    <Wind size={12} aria-hidden="true" />
                    Inspect on Storm Map
                  </Link>
                  <Link
                    to="/field"
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-[hsl(var(--background-elevated))] px-2 py-1 text-xs font-medium text-text-primary hover:bg-[hsl(var(--background-accent))]"
                  >
                    <Briefcase size={12} aria-hidden="true" />
                    Field Hub
                  </Link>
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Notes
                </span>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  onBlur={handleNotesBlur}
                  rows={4}
                  className="input mt-2"
                  placeholder="Lead notes..."
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4 text-xs text-text-tertiary">
            <div className="flex items-center gap-2">
              <Calendar size={12} />
              <span>Created {formatDate(lead.createdAt)}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Clock size={12} />
              <span>Updated {formatDate(lead.updatedAt)}</span>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const Leads: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') ?? '';
  const urlSource = searchParams.get('source') ?? '';
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [sourceFilter, setSourceFilter] = useState<string>(urlSource);

  useEffect(() => {
    setSearchInput(urlSearch);
    setSourceFilter(urlSource);
  }, [urlSearch, urlSource]);

  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);

  const {
    data: leadsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<LeadsResponse>({
    queryKey: ['leads'],
    queryFn: () => api.get('/leads').then((res) => res.data as LeadsResponse),
    placeholderData: { data: [], count: 0 },
  });

  const allLeads = leadsData?.data ?? [];
  const leads = allLeads.filter((l) => {
    if (sourceFilter && l.source !== sourceFilter) return false;
    if (!searchInput.trim()) return true;
    const q = searchInput.trim().toLowerCase();
    return (
      `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
      l.propertyAddress.toLowerCase().includes(q) ||
      (l.notes ?? '').toLowerCase().includes(q) ||
      (l.stormEvent?.name ?? '').toLowerCase().includes(q)
    );
  });

  const updateLead = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Lead> }) =>
      api.patch(`/leads/${id}`, data).then((res) => res.data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const previous = queryClient.getQueryData<LeadsResponse>(['leads']);
      const previousSelected = selectedLead;
      queryClient.setQueryData<LeadsResponse>(['leads'], (old) => {
        if (!old) return { data: [], count: 0 };
        return {
          ...old,
          data: old.data.map((l) => (l.id === id ? { ...l, ...data } : l)),
        };
      });
      setSelectedLead((prev) =>
        prev && prev.id === id ? { ...prev, ...data } : prev
      );
      return { previous, previousSelected };
    },
    onError: (err: unknown, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData<LeadsResponse>(['leads'], context.previous);
      }
      if (context?.previousSelected) {
        setSelectedLead(context.previousSelected);
      }
      toast.error('Could not update lead');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const createLead = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/leads', payload).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: () => {
      toast.error('Could not create lead');
    },
  });

  const moveLead = useCallback(
    (id: string, status: LeadStatus) => {
      updateLead.mutate({ id, data: { status } });
    },
    [updateLead]
  );

  const handleDetailUpdate = (data: Partial<Lead>) => {
    if (!selectedLead) return;
    updateLead.mutate({ id: selectedLead.id, data });
  };

  const openNewLead = () => {
    setEditingLead(null);
    setFormOpen(true);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, lead: Lead) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ id: lead.id, fromStatus: lead.status })
    );
    e.dataTransfer.setData('text/plain', lead.id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleColumnDrop = (e: React.DragEvent<HTMLDivElement>, newStatus: LeadStatus) => {
    e.preventDefault();
    const payload = e.dataTransfer.getData('application/json');
    let dragged: { id: string; fromStatus: LeadStatus } | null = null;
    try {
      dragged = payload ? JSON.parse(payload) : null;
    } catch {
      dragged = null;
    }
    const leadId = dragged?.id ?? e.dataTransfer.getData('text/plain');
    if (dragged?.fromStatus && dragged.fromStatus !== newStatus) {
      moveLead(leadId, newStatus);
    }
    setDragOverColumn(null);
  };

  const handleOpenDetail = (lead: Lead) => {
    setSelectedLead(lead);
    setDetailOpen(true);
  };

  const handleEditFromDetail = () => {
    if (!selectedLead) return;
    setEditingLead(selectedLead);
    setDetailOpen(false);
    setFormOpen(true);
  };

  const handleFormSubmit = async (values: Record<string, unknown>) => {
    try {
      if (editingLead?.id) {
        await updateLead.mutateAsync({ id: editingLead.id, data: values });
        toast.success('Lead updated successfully');
      } else {
        await createLead.mutateAsync(values);
        toast.success('Lead created successfully');
      }
      setFormOpen(false);
    } catch {
      // error already surfaced via mutation onError toast
    }
  };

  const isSubmitting = createLead.isPending || updateLead.isPending;

  const leadsByColumn = (status: LeadStatus) => leads.filter((l) => l.status === status);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-text-secondary">
            Manage roofing leads converted from storm maps, inspections, and referrals.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/storm-tracking"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-xs font-medium text-text-primary hover:bg-[hsl(var(--background-accent))]"
          >
            <Wind size={14} aria-hidden="true" />
            Map &rarr; Leads Demo
          </Link>
          <Link
            to="/field"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-xs font-medium text-text-primary hover:bg-[hsl(var(--background-accent))]"
          >
            <Briefcase size={14} aria-hidden="true" />
            Field Hub
          </Link>
          <Link
            to="/reports?tab=pipeline"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-xs font-medium text-text-primary hover:bg-[hsl(var(--background-accent))]"
          >
            <BarChart3 size={14} aria-hidden="true" />
            Pipeline Report
          </Link>
          <Button variant="primary" icon={<Plus size={18} />} onClick={openNewLead}>
            New Lead
          </Button>
        </div>
      </div>

      {/* Filter & storm origin bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-3">
        <div className="relative flex-1 min-w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" aria-hidden="true" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => {
              const val = e.target.value;
              setSearchInput(val);
              const next = new URLSearchParams(searchParams);
              if (val) next.set('search', val);
              else next.delete('search');
              setSearchParams(next, { replace: true });
            }}
            placeholder="Filter leads by homeowner, street address, or storm event…"
            className="input pl-9 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const nextSource = sourceFilter === 'STORM_EVENT' ? '' : 'STORM_EVENT';
            setSourceFilter(nextSource);
            const next = new URLSearchParams(searchParams);
            if (nextSource) next.set('source', nextSource);
            else next.delete('source');
            setSearchParams(next, { replace: true });
          }}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            sourceFilter === 'STORM_EVENT'
              ? 'border-primary bg-primary text-[hsl(var(--primary-foreground))]'
              : 'border-border bg-[hsl(var(--background-card))] text-text-primary hover:bg-[hsl(var(--background-accent))]'
          }`}
        >
          <Wind size={13} aria-hidden="true" />
          Storm-Converted Only
        </button>
        {(searchInput || sourceFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearchInput('');
              setSourceFilter('');
              setSearchParams({}, { replace: true });
            }}
            className="text-xs text-text-secondary underline hover:text-text-primary"
          >
            Clear ({leads.length}/{allLeads.length})
          </button>
        )}
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-[hsl(var(--background-card))] p-8 text-center">
          <AlertCircle size={32} className="text-red" />
          <p className="text-text-secondary">
            Could not load leads. {(error as Error)?.message}
          </p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-3 py-12 text-text-secondary">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading leads…</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-4 pb-2">
            {LEAD_STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                leads={leadsByColumn(status)}
                dragOver={dragOverColumn === status}
                onDragOver={(e) => {
                  handleDragOver(e);
                  setDragOverColumn(status);
                }}
                onDrop={(e) => handleColumnDrop(e, status)}
                onDragStart={handleDragStart}
                onClickCard={handleOpenDetail}
              />
            ))}
          </div>
        </div>
      )}

      {leads.length === 0 && !isLoading && !isError && (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <Users size={40} className="text-text-tertiary opacity-40" />
          <p className="text-text-tertiary">No leads in your pipeline yet.</p>
          <Button variant="primary" icon={<Plus size={16} />} onClick={openNewLead}>
            Create your first lead
          </Button>
        </div>
      )}

      {selectedLead && (
        <LeadDetail
          open={detailOpen}
          onOpenChange={setDetailOpen}
          lead={selectedLead}
          onUpdate={handleDetailUpdate}
          onEdit={handleEditFromDetail}
        />
      )}

      <LeadForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={editingLead}
        onSubmit={handleFormSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default Leads;
