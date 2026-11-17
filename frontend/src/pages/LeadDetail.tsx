import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import * as Dialog from '@radix-ui/react-dialog';
import { api } from '../services/api';
import { Lead, WeatherAlert } from '../types';
import Card, { Badge, StatusDot } from '../components/ui/Card';
import Button from '../components/ui/Button';
import {
  User as UserIcon,
  MapPin,
  Phone,
  Mail,
  Calendar as CalendarIcon,
  Cloud,
  UserCheck,
  Briefcase,
  Clock,
  ExternalLink,
  Edit,
  Plus,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

interface LeadDetailProps {
  leadId: string;
}

interface StormImpactScore {
  score: number;
  severity: string;
  alerts: WeatherAlert[];
  timestamp: string;
}

interface TimelineEvent {
  id: string;
  icon: React.ReactNode;
  title: string;
  description?: string;
  timestamp: string;
}

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

const SOURCE_LABELS: Record<NonNullable<Lead['source']>, string> = {
  WEBSITE: 'Website',
  PHONE: 'Phone',
  REFERRAL: 'Referral',
  STORM_EVENT: 'Storm Event',
  MANUAL: 'Manual',
  IMPORT: 'Import',
};

const STATUS_LABELS: Record<NonNullable<Lead['status']>, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  INSPECTION_SCHEDULED: 'Inspection Scheduled',
  ESTIMATE_SENT: 'Estimate Sent',
  WON: 'Won',
  LOST: 'Lost',
};

const STATUS_VARIANT: Record<NonNullable<Lead['status']>, BadgeVariant> = {
  NEW: 'info',
  CONTACTED: 'info',
  INSPECTION_SCHEDULED: 'warning',
  ESTIMATE_SENT: 'warning',
  WON: 'success',
  LOST: 'danger',
};

const SEVERITY_VARIANT: Record<string, BadgeVariant> = {
  Extreme: 'extreme',
  Severe: 'severe',
  Moderate: 'moderate',
  Minor: 'minor',
  None: 'default',
  Unknown: 'default',
};

const SEVERITY_BAR: Record<string, string> = {
  Extreme: 'bg-severity-extreme',
  Severe: 'bg-severity-severe',
  Moderate: 'bg-severity-moderate',
  Minor: 'bg-severity-minor',
  None: 'bg-text-tertiary',
  Unknown: 'bg-text-tertiary',
};

const formatDate = (dateString?: string) => {
  if (!dateString) return '—';
  try {
    return format(new Date(dateString), 'PPp');
  } catch {
    return dateString;
  }
};

const scoreToColor = (score: number): string => {
  if (score >= 80) return 'bg-emerald';
  if (score >= 60) return 'bg-amber';
  if (score >= 30) return 'bg-orange';
  return 'bg-primary';
};

const DetailRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value?: React.ReactNode;
}> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-lg bg-[hsl(var(--background-accent))] text-text-tertiary">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className="text-sm text-text-primary">{value ?? '—'}</p>
    </div>
  </div>
);

const LeadDetail: React.FC<LeadDetailProps> = ({ leadId }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [convertOpen, setConvertOpen] = useState(false);
  const [jobName, setJobName] = useState('');
  const [nameError, setNameError] = useState(false);

  const {
    data: lead,
    isLoading,
    isError,
    refetch,
  } = useQuery<Lead>({
    queryKey: ['lead', leadId],
    queryFn: () => api.get(`/leads/${leadId}`).then((res) => res.data),
    enabled: !!leadId,
  });

  const { data: impactScore, isLoading: impactLoading } = useQuery<StormImpactScore>({
    queryKey: ['impact-score', lead?.propertyLatLng?.lat, lead?.propertyLatLng?.lng],
    queryFn: () => {
      const ll = lead!.propertyLatLng!;
      return api
        .get(`/weather/impact-score?lat=${ll.lat}&lon=${ll.lng}`)
        .then((res) => res.data);
    },
    enabled: !!lead?.propertyLatLng,
    staleTime: 60_000,
  });

  const { mutate: convertToJob, isPending: isConverting } = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post('/jobs', payload).then((res) => res.data),
    onSuccess: (created) => {
      toast.success('Lead converted to job successfully');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setConvertOpen(false);
      navigate(`/jobs/${created.id}`);
    },
    onError: () => {
      toast.error('Failed to convert lead to job');
    },
  });

  const handleEdit = () => navigate(`/leads/${leadId}/edit`);

  const handleOpenConvert = () => {
    setJobName(lead ? `${lead.firstName} ${lead.lastName}` : '');
    setNameError(false);
    setConvertOpen(true);
  };

  const handleConvert = () => {
    if (!lead) return;
    if (!jobName.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    convertToJob({
      name: jobName,
      description: `Converted from lead: ${lead.firstName} ${lead.lastName}. Original source: ${SOURCE_LABELS[lead.source] || lead.source}.`,
      leadId: lead.id,
      propertyAddress: lead.propertyAddress,
      propertyLatLng: lead.propertyLatLng,
      status: 'ACTIVE',
      phase: 'INSPECTION',
    });
  };

  const mapLink = lead?.propertyLatLng
    ? `https://www.google.com/maps?q=${lead.propertyLatLng.lat},${lead.propertyLatLng.lng}`
    : null;

  // Build a timeline of activity derived from the lead record state.
  const buildTimeline = (lead: Lead): TimelineEvent[] => {
    const events: TimelineEvent[] = [
      {
        id: 'created',
        icon: <UserIcon size={16} />,
        title: 'Lead created',
        description: `Source: ${SOURCE_LABELS[lead.source] || lead.source}`,
        timestamp: lead.createdAt,
      },
    ];

    if (lead.assignedTo) {
      events.push({
        id: 'assigned',
        icon: <UserCheck size={16} />,
        title: 'Lead assigned',
        description: `Assigned to ${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`,
        timestamp: lead.updatedAt,
      });
    }

    if (lead.stormEvent) {
      events.push({
        id: 'storm',
        icon: <Cloud size={16} />,
        title: 'Storm event linked',
        description: `${lead.stormEvent.name} (${lead.stormEvent.eventType})`,
        timestamp: lead.createdAt,
      });
    }

    if (lead.updatedAt && new Date(lead.updatedAt).getTime() > new Date(lead.createdAt).getTime()) {
      events.push({
        id: 'updated',
        icon: <Clock size={16} />,
        title: 'Lead updated',
        timestamp: lead.updatedAt,
      });
    }

    if (lead.job) {
      events.push({
        id: 'converted',
        icon: <Briefcase size={16} />,
        title: 'Converted to job',
        description: `Job "${lead.job.name}" created`,
        timestamp: lead.updatedAt,
      });
    }

    return events.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  };

  /* ---------- Loading / Error states ---------- */
  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-3 text-text-secondary">
          <RefreshCw size={20} className="animate-spin" />
          <span>Loading lead…</span>
        </div>
      </div>
    );
  }

  if (isError || !lead) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-text-secondary">
        <AlertTriangle size={28} className="text-red" />
        <p>Unable to load this lead. Please try again.</p>
        <Button variant="outline" leftIcon={<RefreshCw />} onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const timeline = buildTimeline(lead);
  const impact = impactScore;
  const leadScore = lead.score ?? 0;
  const impactSeverity = impact?.severity ?? 'None';

  return (
    <div>
      {/* ---- Header ---- */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white font-bold text-2xl">
            {lead.firstName?.[0]}
            {lead.lastName?.[0]}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-text-primary">
              {lead.firstName} {lead.lastName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusDot status={lead.status} />
              <Badge variant={STATUS_VARIANT[lead.status]}>{STATUS_LABELS[lead.status]}</Badge>
              <Badge variant="info">{SOURCE_LABELS[lead.source] || lead.source}</Badge>
              {lead.score !== undefined && (
                <Badge variant="default" className="gap-1">
                  <span className="text-xs">Lead Score</span> {lead.score}/100
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            leftIcon={<Edit size={16} />}
            onClick={handleEdit}
          >
            Edit
          </Button>
          <Button
            variant="primary"
            leftIcon={<Plus size={16} />}
            onClick={handleOpenConvert}
          >
            Convert to Job
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ===== Left column ===== */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <Card title="Contact Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailRow
                icon={<Mail size={14} />}
                label="Email"
                value={
                  lead.email ? (
                    <a
                      href={`mailto:${lead.email}`}
                      className="text-text-primary hover:text-primary"
                    >
                      {lead.email}
                    </a>
                  ) : undefined
                }
              />
              <DetailRow
                icon={<Phone size={14} />}
                label="Phone"
                value={
                  lead.phone ? (
                    <a
                      href={`tel:${lead.phone}`}
                      className="text-text-primary hover:text-primary"
                    >
                      {lead.phone}
                    </a>
                  ) : undefined
                }
              />
            </div>
          </Card>

          {/* Property Details */}
          <Card title="Property Details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailRow
                icon={<MapPin size={14} />}
                label="Property Address"
                value={
                  mapLink ? (
                    <a
                      href={mapLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-text-primary hover:text-primary"
                    >
                      {lead.propertyAddress}
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    lead.propertyAddress
                  )
                }
              />
              <DetailRow
                icon={<CalendarIcon size={14} />}
                label="Coordinates"
                value={
                  lead.propertyLatLng ? (
                    <span className="font-mono text-sm text-text-primary">
                      {lead.propertyLatLng.lat.toFixed(5)}, {lead.propertyLatLng.lng.toFixed(5)}
                    </span>
                  ) : undefined
                }
              />
            </div>
          </Card>

          {/* Lead Information */}
          <Card title="Lead Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailRow
                icon={<Cloud size={14} />}
                label="Source"
                value={SOURCE_LABELS[lead.source] || lead.source}
              />
              <DetailRow
                icon={<Briefcase size={14} />}
                label="Status"
                value={
                  <span className="flex items-center gap-2">
                    <StatusDot status={lead.status} />
                    {STATUS_LABELS[lead.status]}
                  </span>
                }
              />
              <DetailRow
                icon={<UserCheck size={14} />}
                label="Assigned To"
                value={
                  lead.assignedTo ? (
                    <span className="flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white">
                        {lead.assignedTo.firstName?.[0]}
                        {lead.assignedTo.lastName?.[0]}
                      </span>
                      {lead.assignedTo.firstName} {lead.assignedTo.lastName}
                    </span>
                  ) : undefined
                }
              />
              <DetailRow
                icon={<Cloud size={14} />}
                label="Storm Event"
                value={lead.stormEvent ? lead.stormEvent.name : undefined}
              />
              <DetailRow
                icon={<CalendarIcon size={14} />}
                label="Created"
                value={formatDate(lead.createdAt)}
              />
              <DetailRow
                icon={<Clock size={14} />}
                label="Last Updated"
                value={formatDate(lead.updatedAt)}
              />
            </div>
          </Card>

          {/* Notes */}
          <Card title="Notes" subtitle={lead.notes ? undefined : 'No notes recorded'}>
            <div className="prose prose-invert max-w-none">
              {lead.notes ? (
                <p className="whitespace-pre-wrap text-sm text-text-primary">{lead.notes}</p>
              ) : (
                <p className="text-sm text-text-tertiary">
                  No notes have been added for this lead yet.
                </p>
              )}
            </div>
          </Card>

          {/* Activity Timeline */}
          <Card title="Activity Timeline" subtitle="Recent lead activity">
            <ul className="relative ml-2 border-l border-border">
              {timeline.map((event, idx) => (
                <li key={event.id} className="mb-4 ml-4 pb-2 last:mb-0 last:pb-0">
                  <div className="absolute -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white">
                    {event.icon}
                  </div>
                  <p className="text-sm font-medium text-text-primary">{event.title}</p>
                  {event.description && (
                    <p className="text-sm text-text-secondary">{event.description}</p>
                  )}
                  <p className="text-xs text-text-tertiary">{formatDate(event.timestamp)}</p>
                  {idx < timeline.length - 1 && (
                    <div className="mt-3 border-l border-border" />
                  )}
                </li>
              ))}
            </ul>
            {timeline.length === 0 && (
              <p className="text-sm text-text-tertiary">No activity recorded yet.</p>
            )}
          </Card>
        </div>

        {/* ===== Right column ===== */}
        <div className="space-y-6">
          {/* Storm Impact Score */}
          {lead.propertyLatLng && (
            <Card
              title="Storm Impact Score"
              subtitle={impact ? `Storm Severity: ${impactSeverity}` : 'Checking storm conditions…'}
            >
              {impactLoading ? (
                <div className="flex items-center justify-center py-6 text-text-secondary">
                  <RefreshCw size={18} className="animate-spin" />
                </div>
              ) : impact ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-3xl font-bold text-text-primary">
                        {impact.score}/100
                      </span>
                      <Badge variant={SEVERITY_VARIANT[impactSeverity] ?? 'default'}>
                        {impactSeverity}
                      </Badge>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[hsl(var(--background-accent))]">
                      <div
                        className={`h-full rounded-full transition-all ${SEVERITY_BAR[impactSeverity] ?? 'bg-text-tertiary'}`}
                        style={{ width: `${Math.max(impact.score, 5)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                    <AlertTriangle size={14} />
                    <span>
                      {impact.alerts?.length
                        ? `${impact.alerts.length} active ${impact.alerts.length === 1 ? 'alert' : 'alerts'} for this property`
                        : 'No active weather alerts for this property'}
                    </span>
                  </div>

                  {impact.alerts && impact.alerts.length > 0 && (
                    <div className="space-y-2 pt-2">
                      {impact.alerts.slice(0, 5).map((alert) => (
                        <div
                          key={alert.id}
                          className="rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-text-primary">
                              {alert.headline || alert.type}
                            </p>
                            <Badge
                              variant={
                                SEVERITY_VARIANT[alert.severity] ?? 'default'
                              }
                              size="sm"
                            >
                              {alert.severity}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-text-tertiary">
                            {alert.area} • {formatDate(alert.effective)} – {formatDate(alert.expires)}
                          </p>
                          {alert.instruction && (
                            <p className="mt-1 text-xs text-text-secondary">
                              {alert.instruction}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-text-tertiary">No storm impact data available.</p>
              )}
            </Card>
          )}

          {/* Lead Score */}
          <Card title="Lead Score">
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-bold text-text-primary">{leadScore}/100</span>
                <Badge
                  variant={leadScore >= 70 ? 'extreme' : leadScore >= 40 ? 'moderate' : 'minor'}
                >
                  {leadScore >= 70 ? 'Hot' : leadScore >= 40 ? 'Warm' : 'Cool'}
                </Badge>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[hsl(var(--background-accent))]">
                <div
                  className={`h-full rounded-full transition-all ${scoreToColor(leadScore)}`}
                  style={{ width: `${Math.max(leadScore, 5)}%` }}
                />
              </div>
              <p className="text-xs text-text-tertiary">
                Higher scores indicate stronger qualification priority.
              </p>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card title="Quick Actions">
            <div className="flex flex-col gap-2">
              <Button variant="secondary" size="sm" leftIcon={<Edit size={14} />} onClick={handleEdit}>
                Edit Lead
              </Button>
              {mapLink && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<ExternalLink size={14} />}
                  onClick={() => window.open(mapLink, '_blank', 'noreferrer')}
                >
                  View on Map
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ===== Convert to Job Dialog ===== */}
      <Dialog.Root open={convertOpen} onOpenChange={setConvertOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60" />
          <Dialog.Content className="fixed top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[hsl(var(--background-card))] p-6 shadow-xl focus:outline-none">
            <Dialog.Title className="text-lg font-semibold text-text-primary">
              Convert Lead to Job
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-text-secondary">
              Create a new job from this lead. The lead will remain linked to the new job.
            </Dialog.Description>

            <div className="mt-4">
              <label
                htmlFor="job-name"
                className="block text-sm font-medium text-text-primary"
              >
                Job Name
              </label>
              <input
                id="job-name"
                type="text"
                className={`mt-1 w-full rounded-lg border bg-[hsl(var(--background))] px-3 py-2 text-sm text-text-primary placeholder-[hsl(var(--text-tertiary))] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${nameError ? 'border-red' : 'border-border'}`}
                value={jobName}
                onChange={(e) => {
                  setJobName(e.target.value);
                  if (nameError) setNameError(false);
                }}
                placeholder="Enter a job name"
              />
              {nameError && (
                <p className="mt-1 text-xs text-red">A job name is required.</p>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-border bg-[hsl(var(--background-elevated))] p-3">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 text-text-tertiary" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-text-tertiary">
                    Property Address
                  </p>
                  <p className="text-sm text-text-primary">{lead.propertyAddress}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setConvertOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isConverting}
                leftIcon={<Plus size={14} />}
                onClick={handleConvert}
              >
                Create Job
              </Button>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="absolute top-3 right-3 rounded-lg p-1 text-text-tertiary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary"
                aria-label="Close"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 15 15"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3 3l9 9M12 3 3 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};

export default LeadDetail;
