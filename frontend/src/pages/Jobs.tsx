import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import Button from '../components/ui/Button';
import Card, { Badge, StatusDot } from '../components/ui/Card';
import { useSocket } from '../components/providers/SocketProvider';
import { Job, JobAssignee } from '../types';
import {
  Plus,
  Search,
  Clock,
  User,
  X,
  Briefcase,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

interface JobsApiResponse {
  data: Job[];
  count: number;
  message?: string;
}

type StatusBadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'extreme'
  | 'severe'
  | 'moderate'
  | 'minor';

// Ordered list of job phases — drives the phase progression bar.
const PHASES: Array<{ value: Job['phase']; label: string; description: string }> = [
  { value: 'INSPECTION', label: 'Inspection', description: 'Site survey and assessment' },
  { value: 'ESTIMATE', label: 'Estimate', description: 'Costing and proposal' },
  { value: 'PRODUCTION', label: 'Production', description: 'Roof replacement' },
  { value: 'INVOICING', label: 'Invoicing', description: 'Billing and payment' },
  { value: 'COMPLETED', label: 'Completed', description: 'Project wrap-up' },
];

const STATUS_CONFIG: Record<Job['status'], { label: string; variant: StatusBadgeVariant }> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
  ON_HOLD: { label: 'On Hold', variant: 'warning' },
};

const phaseIndex = (phase: Job['phase']): number => PHASES.findIndex((p) => p.value === phase);

const phaseProgress = (phase: Job['phase']): number => {
  const idx = phaseIndex(phase);
  if (idx === -1) return 0;
  return (idx / (PHASES.length - 1)) * 100;
};

const getProfitMargin = (job: Job): number | null => {
  if (job.budget && job.budget > 0) {
    const profit = job.grossProfit ?? (job.budget - (job.actualCost ?? 0));
    return (profit / job.budget) * 100;
  }
  return null;
};

const getUserInitials = (user: { firstName?: string; lastName?: string }): string => {
  return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?';
};

const formatLastUpdated = (dateStr: string): string => {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return '—';
  }
};

const marginColor = (margin: number | null): string => {
  if (margin === null) return 'text-text-tertiary';
  if (margin >= 20) return 'text-emerald';
  if (margin >= 0) return 'text-amber';
  return 'text-red';
};

const JobCard: React.FC<{ job: Job; onClick: () => void }> = ({ job, onClick }) => {
  const currentIdx = phaseIndex(job.phase);
  const progress = phaseProgress(job.phase);
  const profitMargin = getProfitMargin(job);
  const statusCfg = STATUS_CONFIG[job.status];
  const assignees = job.assignedUsers ?? [];

  return (
    <Card
      variant="interactive"
      onClick={onClick}
      className="group cursor-pointer transition-transform duration-150 hover:scale-[1.02]"
    >
      <div className="space-y-4">
        {/* Header: job name + status badge */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-text-primary group-hover:text-primary">
              {job.name}
            </h3>
            <p className="text-sm text-text-secondary">{job.propertyAddress}</p>
          </div>
          <Badge variant={statusCfg.variant}>
            <StatusDot status={job.status} size="sm" />
            {statusCfg.label}
          </Badge>
        </div>

        {/* Phase badge + progress bar */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <Badge variant="info" size="sm">
              {PHASES[currentIdx]?.label ?? job.phase.replace('_', ' ')}
            </Badge>
            <span className="text-xs text-text-tertiary">
              {currentIdx + 1} of {PHASES.length}
            </span>
          </div>

          <div className="relative h-2 w-full rounded-full bg-[hsl(var(--background-accent))]">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
            {PHASES.map((phase, idx) => (
              <div
                key={phase.value}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: `${(idx / (PHASES.length - 1)) * 100}%` }}
              >
                <span
                  className={clsx(
                    'h-2 w-2 rounded-full ring-2 ring-[hsl(var(--background-card))',
                    idx <= currentIdx ? 'bg-primary' : 'bg-text-tertiary'
                  )}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-between px-1 text-xs text-text-tertiary">
            {PHASES.map((phase, idx) => (
              <span
                key={phase.value}
                className={clsx(
                  'text-center',
                  idx <= currentIdx ? 'font-medium text-primary' : ''
                )}
              >
                {phase.label}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom row: assigned users, profit margin, last updated */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex -space-x-2 items-center">
            {assignees.slice(0, 4).map((assignee: JobAssignee) => (
              <div
                key={assignee.id}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--background-accent))] text-xs font-medium text-text-primary ring-2 ring-[hsl(var(--background-card))]"
                title={assignee.user ? `${assignee.user.firstName} ${assignee.user.lastName}` : 'Assigned user'}
              >
                {assignee.user ? getUserInitials(assignee.user) : <User size={14} />}
              </div>
            ))}
            {assignees.length > 4 && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--background-accent))] text-xs text-text-secondary ring-2 ring-[hsl(var(--background-card))]">
                +{assignees.length - 4}
              </div>
            )}
            {!assignees.length && (
              <span className="text-xs text-text-tertiary">No one assigned</span>
            )}
          </div>

          <div className="flex items-center gap-5 text-right">
            <div>
              <p className="text-xs text-text-tertiary">Margin</p>
              <p className={clsx('text-sm font-semibold', marginColor(profitMargin))}>
                {profitMargin !== null ? `${profitMargin.toFixed(1)}%` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary">Updated</p>
              <p className="flex items-center justify-end gap-1 text-sm text-text-secondary">
                <Clock size={12} />
                {formatLastUpdated(job.updatedAt)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

const Jobs: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const socket = useSocket();

  const [search, setSearch] = useState(searchParams.get('q') || '');
  useEffect(() => {
    const q = searchParams.get('q');
    if (q != null) setSearch(q);
  }, [searchParams]);
  const [statusFilter, setStatusFilter] = useState<Job['status'] | 'ALL'>('ALL');
  const [phaseFilter, setPhaseFilter] = useState<Job['phase'] | 'ALL'>('ALL');

  const {
    data: jobsData,
    isLoading,
    error,
  } = useQuery<JobsApiResponse>({
    queryKey: ['jobs'],
    queryFn: () => api.get('/jobs').then((res) => res.data),
    placeholderData: { data: [], count: 0 },
  });

  const jobs = jobsData?.data ?? [];

  // Real-time job updates via Socket.IO — refetch the list on any change.
  useEffect(() => {
    if (!socket) return;

    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    };

    socket.on('job:update', handler);
    socket.on('job:create', handler);
    socket.on('job:delete', handler);

    return () => {
      socket.off('job:update', handler);
      socket.off('job:create', handler);
      socket.off('job:delete', handler);
    };
  }, [socket, queryClient]);

  const filteredJobs = useMemo(() => {
    const searchLower = search.toLowerCase();
    return jobs.filter((job) => {
      const matchesSearch =
        job.name.toLowerCase().includes(searchLower) ||
        job.propertyAddress.toLowerCase().includes(searchLower);
      const matchesStatus = statusFilter === 'ALL' || job.status === statusFilter;
      const matchesPhase = phaseFilter === 'ALL' || job.phase === phaseFilter;
      return matchesSearch && matchesStatus && matchesPhase;
    });
  }, [jobs, search, statusFilter, phaseFilter]);

  const activeFiltersCount = [
    statusFilter !== 'ALL',
    phaseFilter !== 'ALL',
    search !== '',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setPhaseFilter('ALL');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Jobs</h1>
          <p className="text-text-secondary">
            Track all your roofing jobs from inspection to completion.
          </p>
        </div>
        <Button leftIcon={<Plus size={18} />} onClick={() => navigate('/jobs/new')}>
          New Job
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            size={18}
          />
          <input
            type="search"
            placeholder="Search by job name or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-[hsl(var(--background))] pl-10 pr-4 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Job['status'] | 'ALL')}
            className="rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([value, config]) => (
              <option key={value} value={value}>
                {config.label}
              </option>
            ))}
          </select>

          <select
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value as Job['phase'] | 'ALL')}
            className="rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Phases</option>
            {PHASES.map((phase) => (
              <option key={phase.value} value={phase.value}>
                {phase.label}
              </option>
            ))}
          </select>

          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="rounded-lg p-2 text-text-tertiary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary"
              aria-label="Clear filters"
              title="Clear filters"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Results summary */}
      <div className="flex items-center justify-between text-sm text-text-secondary">
        <span>
          {filteredJobs.length} of {jobs.length} jobs
        </span>
        {activeFiltersCount > 0 && (
          <Badge variant="info" size="sm">
            {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} active
          </Badge>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <div className="animate-pulse space-y-4">
                <div className="h-5 w-3/4 rounded bg-[hsl(var(--background-accent))]"></div>
                <div className="h-4 w-1/2 rounded bg-[hsl(var(--background-accent))]"></div>
                <div className="h-2 w-full rounded bg-[hsl(var(--background-accent))]"></div>
                <div className="flex justify-between">
                  <div className="h-4 w-1/4 rounded bg-[hsl(var(--background-accent))]"></div>
                  <div className="h-4 w-1/4 rounded bg-[hsl(var(--background-accent))]"></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="border-red">
          <div className="py-8 text-center text-red">
            <p>Failed to load jobs. Please try again.</p>
          </div>
        </Card>
      ) : filteredJobs.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-text-tertiary">
            <Briefcase size={48} className="mx-auto mb-4 opacity-50" />
            <p>No jobs match your current filters.</p>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="mt-2 text-sm text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredJobs.map((job) => (
            <JobCard key={job.id} job={job} onClick={() => navigate(`/jobs/${job.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Jobs;
