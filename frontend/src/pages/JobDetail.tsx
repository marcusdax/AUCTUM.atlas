/**
 * RoofPro CRM — Job Detail
 *
 * Tabbed view of a single job:
 *  - Overview: job info, phase progression, profit metrics
 *  - Estimates: estimate list with status badges
 *  - Calendar: job-specific calendar events
 *  - Documents: job documents with preview
 *  - Job Feed: real-time embedded feed (Socket.IO)
 *
 * Data: GET /api/v1/jobs/:id (job + estimates), PATCH /jobs/:id (phase),
 *       GET /api/v1/documents/jobs/:jobId, GET /api/v1/calendar (filtered),
 *       GET /api/v1/feed/:jobId/posts + socket `feed.new_post`.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { format, formatDistanceToNow, subMonths, addMonths, formatISO } from 'date-fns';
import { toast } from 'react-hot-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@radix-ui/react-tabs';
import {
  Briefcase,
  Calendar as CalendarIcon,
  Clock,
  DollarSign,
  FileText,
  MapPin,
  Package,
  Receipt,
  Check,
  ExternalLink,
  Edit3,
  FileImage,
  Users as UsersIcon,
  User as UserIcon,
} from 'lucide-react';
import { api } from '../services/api';
import { Job, Estimate, CalendarEvent, Document as DocumentType, FeedPost } from '../types';
import Button from '../components/ui/Button';
import Card, { Badge, BadgeVariant, StatusDot } from '../components/ui/Card';
import JobFeed from '../components/JobFeed';

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface JobDetailProps {
  jobId?: string;
}

interface PhaseOption {
  key: NonNullable<Job['phase']>;
  label: string;
  icon: React.ReactNode;
}

const PHASES: PhaseOption[] = [
  { key: 'INSPECTION', label: 'Inspection', icon: <FileText size={16} /> },
  { key: 'ESTIMATE', label: 'Estimate', icon: <DollarSign size={16} /> },
  { key: 'PRODUCTION', label: 'Production', icon: <Package size={16} /> },
  { key: 'INVOICING', label: 'Invoicing', icon: <Receipt size={16} /> },
  { key: 'COMPLETED', label: 'Completed', icon: <Check size={16} /> },
];

const ESTIMATE_STATUS_VARIANT: Record<NonNullable<Estimate['status']>, BadgeVariant> = {
  DRAFT: 'default',
  SENT: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const CALENDAR_TYPE_VARIANT: Record<string, BadgeVariant> = {
  INSPECTION: 'info',
  PRODUCTION: 'warning',
  ESTIMATE: 'default',
  MEETING: 'success',
  OTHER: 'default',
};

function phaseLabel(phase: Job['phase']): string {
  const found = PHASES.find((p) => p.key === phase);
  return found ? found.label : phase ?? '—';
}

function formatCurrency(value?: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function fileUrl(url: string): string {
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

function documentIcon(fileType: DocumentType['fileType']) {
  switch (fileType) {
    case 'PHOTO':
      return <FileImage size={20} className="text-primary" />;
    case 'CONTRACT':
      return <FileText size={20} className="text-amber" />;
    case 'PERMIT':
      return <FileText size={20} className="text-blue" />;
    case 'INVOICE':
      return <Receipt size={20} className="text-emerald" />;
    case 'ESTIMATE_PDF':
      return <FileText size={20} className="text-purple" />;
    default:
      return <FileText size={20} className="text-text-tertiary" />;
  }
}

const JobHeader: React.FC<{ job: Job }> = ({ job }) => (
  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="flex-1">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Briefcase size={24} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{job.name}</h1>
          <p className="text-sm text-text-secondary">{job.propertyAddress}</p>
        </div>
      </div>
      {job.description && (
        <p className="mt-3 text-sm text-text-secondary">{job.description}</p>
      )}
    </div>
    <div className="flex items-center gap-2">
      <Badge
        variant={job.status === 'ACTIVE' ? 'success' : job.status === 'ON_HOLD' ? 'warning' : 'default'}
        size="md"
      >
        <StatusDot status={job.status} />
        {job.status.replace('_', ' ')}
      </Badge>
      <Button variant="outline" size="sm" icon={<Edit3 size={14} />}>
        Edit Job
      </Button>
    </div>
  </div>
);

const PhaseProgression: React.FC<{
  job: Job;
  onPhase: (phase: NonNullable<Job['phase']>) => void;
  isPending: boolean;
}> = ({ job, onPhase, isPending }) => {
  const currentOrder = PHASES.findIndex((p) => p.key === job.phase);

  return (
    <Card className="mb-6" title="Phase Progression" subtitle="Advance this job through the pipeline">
      <div className="flex items-center justify-between">
        {PHASES.map((phase, idx) => {
          const isCurrent = idx === currentOrder;
          const isPast = idx < currentOrder;
          const isFuture = idx > currentOrder;
          const dotStatus = isCurrent
            ? 'SENT'
            : isPast
            ? 'COMPLETED'
            : 'DRAFT';
          const disabled = isCurrent || isPending;

          return (
            <React.Fragment key={phase.key}>
              <button
                type="button"
                onClick={() => onPhase(phase.key)}
                disabled={disabled}
                title={
                  isCurrent
                    ? `Current phase: ${phase.label}`
                    : isPast
                    ? `Move back to ${phase.label}`
                    : `Advance to ${phase.label}`
                }
                className={
                  `flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs font-medium transition-all` +
                  ` focus:outline-none focus:ring-1 focus:ring-primary` +
                  (isCurrent
                    ? ' cursor-default text-primary'
                    : isPast
                    ? ' text-emerald hover:bg-emerald/10'
                    : ' text-text-tertiary hover:text-text-primary hover:bg-[hsl(var(--background-accent))]') +
                  (disabled ? ' opacity-50 cursor-not-allowed' : '')
                }
              >
                <span
                  className={
                    'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all' +
                    (isCurrent
                      ? 'border-primary bg-primary text-white'
                      : isPast
                      ? 'border-emerald bg-emerald/10 text-emerald'
                      : 'border-border bg-[hsl(var(--background-elevated))] text-text-tertiary')
                  }
                >
                  <StatusDot status={dotStatus} size="sm" />
                </span>
                <span className="flex items-center gap-1">
                  {phase.icon}
                  {phase.label}
                </span>
              </button>
              {idx < PHASES.length - 1 && (
                <div
                  className={
                    'h-0.5 w-6 self-center' +
                    (PHASES.findIndex((p) => p.key === job.phase) > idx
                      ? ' bg-emerald'
                      : ' bg-border')
                  }
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </Card>
  );
};

const ProfitMetrics: React.FC<{ job: Job }> = ({ job }) => {
  const grossProfit = job.grossProfit ?? 0;
  const budget = job.budget ?? 0;
  const estimatedCost = job.estimatedCost ?? 0;
  const actualCost = job.actualCost ?? 0;
  const margin = budget > 0 ? (grossProfit / budget) * 100 : 0;
  const marginColor =
    margin >= 25 ? 'text-emerald' : margin >= 0 ? 'text-amber' : 'text-red';

  const metrics = [
    { label: 'Gross Profit', value: formatCurrency(grossProfit), icon: <DollarSign size={16} /> },
    { label: 'Budget', value: formatCurrency(budget), icon: <Package size={16} /> },
    { label: 'Estimated Cost', value: formatCurrency(estimatedCost), icon: <Receipt size={16} /> },
    { label: 'Actual Cost', value: formatCurrency(actualCost), icon: <FileText size={16} /> },
  ];

  return (
    <Card title="Profit Metrics" className="mb-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col items-center gap-1 rounded-lg bg-[hsl(var(--background-elevated))]/50 p-3">
            <div className="mb-1 text-primary">{m.icon}</div>
            <div className="text-center">
              <p className="text-xs text-text-tertiary">{m.label}</p>
              <p className="text-lg font-semibold text-text-primary">{m.value}</p>
            </div>
          </div>
        ))}
        <div className="rounded-lg bg-[hsl(var(--background-elevated))]/50 p-3">
          <div className="mb-1 text-primary">
            <DollarSign size={16} />
          </div>
          <p className="text-xs text-text-tertiary">Margin</p>
          <p className={`text-lg font-semibold ${marginColor}`}>
            {budget > 0 ? `${margin.toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>
    </Card>
  );
};

const JobMeta: React.FC<{ job: Job }> = ({ job }) => (
  <Card title="Job Details" className="mb-6">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex items-start gap-2">
        <MapPin size={16} className="mt-0.5 text-text-tertiary" />
        <div>
          <p className="text-xs text-text-tertiary">Property Address</p>
          <p className="text-sm text-text-primary">{job.propertyAddress}</p>
        </div>
      </div>
      {(job.startDate || job.endDate) && (
        <div className="flex items-start gap-2">
          <Clock size={16} className="mt-0.5 text-text-tertiary" />
          <div>
            <p className="text-xs text-text-tertiary">Schedule</p>
            <p className="text-sm text-text-primary">
              {job.startDate && `Start: ${format(new Date(job.startDate), 'PP')}`}
              {job.endDate && ` · End: ${format(new Date(job.endDate), 'PP')}`}
            </p>
          </div>
        </div>
      )}
      {job.lead && (
        <div className="flex items-start gap-2">
          <UsersIcon size={16} className="mt-0.5 text-text-tertiary" />
          <div>
            <p className="text-xs text-text-tertiary">Lead</p>
            <p className="text-sm text-text-primary">
              {job.lead.firstName} {job.lead.lastName}
            </p>
            {job.lead.propertyAddress && (
              <p className="text-xs text-text-tertiary">{job.lead.propertyAddress}</p>
            )}
          </div>
        </div>
      )}
      {job.createdBy && (
        <div className="flex items-start gap-2">
          <UserIcon size={16} className="mt-0.5 text-text-tertiary" />
          <div>
            <p className="text-xs text-text-tertiary">Created By</p>
            <p className="text-sm text-text-primary">
              {job.createdBy.firstName} {job.createdBy.lastName}
            </p>
            <p className="text-xs text-text-tertiary">{job.createdBy.email}</p>
          </div>
        </div>
      )}
      <div className="flex items-start gap-2">
        <Clock size={16} className="mt-0.5 text-text-tertiary" />
        <div>
          <p className="text-xs text-text-tertiary">Created</p>
          <p className="text-sm text-text-primary">
            {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  </Card>
);

const EstimatesTab: React.FC<{ estimates?: Estimate[] }> = ({ estimates }) => {
  if (!estimates || estimates.length === 0) {
    return (
      <div className="py-8 text-center text-text-tertiary">
        <FileText size={32} className="mx-auto mb-2 opacity-30" />
        <p>No estimates have been created for this job yet.</p>
        <Button variant="primary" className="mt-3" icon={<FileText size={14} />}>
          Create Estimate
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {estimates.map((estimate) => (
        <Card
          key={estimate.id}
          title={estimate.name}
          subtitle={`Created ${format(new Date(estimate.createdAt), 'PP')}`}
          className="flex items-center justify-between"
        >
          <div className="grid grid-cols-2 gap-4 py-2 md:grid-cols-4">
            <div>
              <p className="text-xs text-text-tertiary">Total Price</p>
              <p className="font-semibold text-text-primary">{formatCurrency(estimate.totalPrice)}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary">Total Cost</p>
              <p className="font-semibold text-text-primary">{formatCurrency(estimate.totalCost)}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary">Items</p>
              <p className="font-semibold text-text-primary">{estimate.items?.length ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary">Status</p>
              <Badge variant={ESTIMATE_STATUS_VARIANT[estimate.status]} size="sm">
                <StatusDot status={estimate.status} size="sm" />
                {estimate.status}
              </Badge>
            </div>
          </div>
          {estimate.pdfUrl && (
            <a
              href={fileUrl(estimate.pdfUrl)}
              target="_blank"
              rel="noreferrer"
              className="ml-4 text-primary hover:underline"
              title="View estimate PDF"
            >
              <ExternalLink size={16} />
            </a>
          )}
        </Card>
      ))}
    </div>
  );
};

const CalendarTab: React.FC<{ jobId: string; events?: CalendarEvent[]; isLoading: boolean }> = ({
  jobId,
  events,
  isLoading,
}) => {
  const jobEvents = (events ?? []).filter((e) => e.jobId === jobId);

  if (isLoading) {
    return (
      <div className="py-8 text-center text-text-tertiary">
        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (jobEvents.length === 0) {
    return (
      <div className="py-8 text-center text-text-tertiary">
        <CalendarIcon size={32} className="mx-auto mb-2 opacity-30" />
        <p>No calendar events are scheduled for this job.</p>
        <Button variant="primary" className="mt-3" size="sm">
          Schedule Event
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobEvents.map((event) => (
        <div key={event.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
            <CalendarIcon size={14} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="font-medium text-text-primary">{event.title}</p>
              <Badge variant={CALENDAR_TYPE_VARIANT[event.eventType] ?? 'default'} size="sm">
                {event.eventType}
              </Badge>
            </div>
            <p className="text-sm text-text-secondary">
              {format(new Date(event.startTime), 'PPp')} — {format(new Date(event.endTime), 'p')}
            </p>
            {event.location && (
              <p className="flex items-center gap-1 text-sm text-text-tertiary">
                <MapPin size={12} /> {event.location}
              </p>
            )}
            {event.assignees && event.assignees.length > 0 && (
              <div className="mt-1 flex -space-x-1.5">
                {event.assignees.map((a) => (
                  <img
                    key={a.id}
                    src={a.user?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(`${a.user?.firstName ?? ''} ${a.user?.lastName ?? ''}`.trim())}&background=64748b&color=fff`}
                    alt={a.user?.firstName || 'assignee'}
                    className="h-6 w-6 rounded-full border-2 border-[hsl(var(--background))]"
                    title={a.user ? `${a.user.firstName} ${a.user.lastName}` : ''}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const DocumentsTab: React.FC<{ documents?: DocumentType[]; isLoading: boolean }> = ({
  documents,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="py-8 text-center text-text-tertiary">
        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="py-8 text-center text-text-tertiary">
        <FileImage size={32} className="mx-auto mb-2 opacity-30" />
        <p>No documents have been added to this job yet.</p>
      </div>
    );
  }

  const isImageDoc = (doc: DocumentType): boolean => {
    if (doc.fileType === 'PHOTO') return true;
    const ext = doc.fileUrl.substring(doc.fileUrl.lastIndexOf('.')).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {documents.map((doc) => {
        const img = isImageDoc(doc);
        return (
          <Card key={doc.id} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {img ? (
                <img
                  src={fileUrl(doc.fileUrl)}
                  alt={doc.name}
                  className="h-12 w-12 rounded object-cover"
                />
              ) : (
                documentIcon(doc.fileType)
              )}
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-text-primary truncate" title={doc.name}>
                  {doc.name}
                </p>
                <p className="text-xs text-text-tertiary">{doc.fileType}</p>
              </div>
              <Badge variant="default" size="sm">
                {doc.size ? `${(doc.size / 1024).toFixed(0)} KB` : ''}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <a
                href={fileUrl(doc.fileUrl)}
                target="_blank"
                rel="noreferrer"
                download={doc.name}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                title={img ? 'Preview image' : 'Download document'}
              >
                <ExternalLink size={12} />
                {img ? 'Preview' : 'Download'}
              </a>
              {doc.uploadedBy && (
                <span className="text-xs text-text-tertiary">
                  by {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}
                </span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

const JobDetail: React.FC<JobDetailProps> = ({ jobId: propJobId }) => {
  const params = useParams<{ id: string }>();
  const jobId = propJobId ?? params.id;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  const {
    data: job,
    isLoading,
    isError,
    error,
  } = useQuery<Job>({
    queryKey: ['job', jobId],
    queryFn: () => api.get(`/jobs/${jobId}`).then((res) => res.data.job as Job),
    enabled: !!jobId,
    staleTime: 60_000,
  });

  // Documents (job-scoped)
  const { data: documents, isLoading: docsLoading } = useQuery<DocumentType[]>({
    queryKey: ['job-documents', jobId],
    queryFn: () =>
      api.get(`/documents/jobs/${jobId}`).then((res) => res.data.data as DocumentType[]),
    enabled: !!jobId,
    staleTime: 60_000,
  });

  // Calendar — fetch a bounded window of company events, then filter to this job
  const now = new Date();
  const calStart = formatISO(subMonths(now, 18));
  const calEnd = formatISO(addMonths(now, 18));
  const { data: allEvents, isLoading: calLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['job-calendar', jobId],
    queryFn: () =>
      api
        .get(`/calendar?start=${encodeURIComponent(calStart)}&end=${encodeURIComponent(calEnd)}`)
        .then((res) => res.data.data as CalendarEvent[]),
    enabled: activeTab === 'calendar' && !!jobId,
    staleTime: 60_000,
  });

  const phaseMutation = useMutation({
    mutationFn: ({ phase }: { phase: NonNullable<Job['phase']> }) =>
      api.patch(`/jobs/${jobId}`, { phase }).then((res) => res.data.job as Job),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      toast.success('Phase updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to update phase');
    },
  });

  const handlePhase = (phase: NonNullable<Job['phase']>) => {
    phaseMutation.mutate({ phase });
  };

  if (!jobId) {
    return <div className="p-6 text-text-tertiary">No job selected.</div>;
  }

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-text-secondary">Loading job…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 text-center text-red">
        <p className="mb-2">Failed to load job.</p>
        <p className="text-sm text-text-tertiary">
          {(error as Error)?.message || 'Unknown error'}
        </p>
      </div>
    );
  }

  const safeJob = job as Job;

  return (
    <>
      <JobHeader job={safeJob} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 overflow-x-auto rounded-lg bg-[hsl(var(--background-card))] p-1">
          <TabsTrigger
            value="overview"
            className={tabTriggerClass('Overview', activeTab === 'overview')}
          >
            <Briefcase size={16} />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="estimates"
            className={tabTriggerClass('Estimates', activeTab === 'estimates')}
          >
            <FileText size={16} />
            Estimates
          </TabsTrigger>
          <TabsTrigger
            value="calendar"
            className={tabTriggerClass('Calendar', activeTab === 'calendar')}
          >
            <CalendarIcon size={16} />
            Calendar
          </TabsTrigger>
          <TabsTrigger
            value="documents"
            className={tabTriggerClass('Documents', activeTab === 'documents')}
          >
            <FileImage size={16} />
            Documents
          </TabsTrigger>
          <TabsTrigger
            value="feed"
            className={tabTriggerClass('Job Feed', activeTab === 'feed')}
          >
            <UsersIcon size={16} />
            Job Feed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-0">
          <PhaseProgression
            job={safeJob}
            onPhase={handlePhase}
            isPending={phaseMutation.isPending}
          />
          <ProfitMetrics job={safeJob} />
          <JobMeta job={safeJob} />
        </TabsContent>

        <TabsContent value="estimates" className="mt-0">
          <Card title="Estimates" subtitle="Cost vs. price for this job">
            <EstimatesTab estimates={safeJob.estimates} />
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-0">
          <Card title="Calendar Events" subtitle="Scheduled inspections, production, and meetings">
            <CalendarTab jobId={safeJob.id} events={allEvents} isLoading={calLoading} />
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-0">
          <Card title="Documents" subtitle="Contracts, permits, invoices, and photos">
            <DocumentsTab documents={documents} isLoading={docsLoading} />
          </Card>
        </TabsContent>

        <TabsContent value="feed" className="mt-0">
          <JobFeed jobId={safeJob.id} />
        </TabsContent>
      </Tabs>
    </>
  );
};

function tabTriggerClass(label: string, active: boolean): string {
  const base =
    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all';
  return (
    base +
    (active
      ? ' bg-primary text-white shadow-md'
      : ' text-text-secondary hover:bg-[hsl(var(--background-elevated))] hover:text-text-primary')
  );
}

export default JobDetail;
