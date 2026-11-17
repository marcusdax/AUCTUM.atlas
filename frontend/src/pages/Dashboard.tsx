import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  addDays,
  format,
  formatDistanceToNow,
  formatISO,
  isToday,
  isTomorrow,
  parseISO,
} from 'date-fns';
import clsx from 'clsx';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarDays,
  Calculator,
  Clock,
  FileText,
  Eye,
  Map,
  MapPin,
  Plus,
  Radar,
  TrendingDown,
  TrendingUp,
  Users,
  Video,
} from 'lucide-react';
import { api, resolveFileUrl } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import Card, { Badge, StatusDot } from '../components/ui/Card';
import Button from '../components/ui/Button';
import {
  Job,
  Lead,
  Estimate,
  CalendarEvent,
  FeedPost,
  FeedAttachment,
  User,
  WeatherAlert,
  StormEvent,
} from '../types';
import DashboardCommandCenter from '../components/intelligence/DashboardCommandCenter';

interface ListResponse<T> {
  data: T[];
  count?: number;
  hasMore?: boolean;
  message?: string;
}

interface FeedResponse {
  posts: FeedPost[];
  count: number;
  hasMore?: boolean;
}

interface WeatherAlertsResponse {
  alerts: WeatherAlert[];
  total: number;
  title?: string;
  updated?: string;
  note?: string;
}

interface CalendarResponse {
  data: CalendarEvent[];
  count?: number;
  message?: string;
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

const SEVERITY_RANK: Record<string, number> = {
  Extreme: 3,
  Severe: 2,
  Moderate: 1,
  Minor: 0,
  Unknown: 0,
};

const SEVERE_SEVERITIES = new Set(['severe', 'extreme']);

const severityBadgeVariant = (severity: string): BadgeVariant => {
  const s = severity.toLowerCase();
  if (s === 'extreme') return 'extreme';
  if (s === 'severe') return 'severe';
  if (s === 'moderate') return 'moderate';
  if (s === 'minor') return 'minor';
  return 'default';
};

const isSevere = (severity: string): boolean => SEVERE_SEVERITIES.has(severity.toLowerCase());

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  try {
    const d = parseISO(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const timeAgo = (value?: string | null): string => {
  const d = parseDate(value);
  if (!d) return 'recently';
  try {
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return 'recently';
  }
};

const formatDateTime = (value?: string | null): string => {
  const d = parseDate(value);
  return d ? format(d, 'MMM d, h:mm a') : '—';
};

const formatTime = (value?: string | null): string => {
  const d = parseDate(value);
  return d ? format(d, 'h:mm a') : '—';
};

const formatDateLabel = (value?: string | null): string => {
  const d = parseDate(value);
  if (!d) return '—';
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'MMM d');
};

const truncate = (text: string, max: number): string =>
  text.length > max ? text.slice(0, max) + '…' : text;

const formatBytes = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
};

const initials = (u?: { firstName?: string; lastName?: string; email?: string } | null): string => {
  const f = u?.firstName?.[0] ?? '';
  const l = u?.lastName?.[0] ?? '';
  const init = (f + l).toUpperCase();
  return init || (u?.email?.[0] ?? '?').toUpperCase() || '?';
};

// Deterministic color hue from a stable seed (email/id). Keeps avatars visually distinct.
const HUE_PALETTE = [217, 340, 150, 25, 30, 260, 330, 195, 45, 170];
const hueForSeed = (seed?: string): number => {
  if (!seed) return 217;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return HUE_PALETTE[h % HUE_PALETTE.length];
};

// ─── Trend computation (last 24h vs prior 24h, derived from createdAt in each list) ───

interface Trend {
  direction: 'up' | 'down' | 'flat';
  change: number;
  percent: number;
  recent: number;
  prior: number;
}

const computeTrend = (
  items: ReadonlyArray<{ createdAt?: string | null }>,
  now: Date = new Date()
): Trend => {
  const oneDay = 24 * 60 * 60 * 1000;
  const recentStart = new Date(now.getTime() - oneDay);
  const priorStart = new Date(now.getTime() - 2 * oneDay);
  let recent = 0;
  let prior = 0;
  for (const item of items) {
    const d = parseDate(item.createdAt);
    if (!d) continue;
    if (d >= recentStart) recent++;
    else if (d >= priorStart) prior++;
  }
  const change = recent - prior;
  const base = prior || recent || 1;
  const percent = Math.round((Math.abs(change) / base) * 100);
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  return { direction, change, percent, recent, prior };
};

// ─── Severity gradients for weather alerts ───

interface SeverityStyle {
  bg: string;
  border: string;
  icon: string;
}

const severityStyle = (severity: string): SeverityStyle => {
  const s = severity.toLowerCase();
  switch (s) {
    case 'extreme':
      return {
        bg: 'bg-gradient-to-r from-red/25 via-red/5 to-transparent',
        border: 'border-l-2 border-red/40',
        icon: 'text-red',
      };
    case 'severe':
      return {
        bg: 'bg-gradient-to-r from-orange/25 via-orange/5 to-transparent',
        border: 'border-l-2 border-orange/40',
        icon: 'text-orange',
      };
    case 'moderate':
      return {
        bg: 'bg-gradient-to-r from-amber/25 via-amber/5 to-transparent',
        border: 'border-l-2 border-amber/40',
        icon: 'text-amber',
      };
    case 'minor':
      return {
        bg: 'bg-gradient-to-r from-primary/25 via-primary/5 to-transparent',
        border: 'border-l-2 border-primary/40',
        icon: 'text-primary',
      };
    default:
      return {
        bg: 'bg-gradient-to-r from-text-tertiary/12 via-text-tertiary/5 to-transparent',
        border: 'border-l-2 border-border',
        icon: 'text-text-tertiary',
      };
  }
};

// ─── Time-based color coding for schedule events ───

type EventTone = 'today' | 'soon' | 'later' | 'past';

interface TimeCode {
  label: string;
  color: string;
  tone: EventTone;
}

const timeCode = (startTime?: string | null, now: Date = new Date()): TimeCode => {
  const d = parseDate(startTime);
  if (!d) return { label: '—', color: 'text-text-tertiary', tone: 'past' };
  const diffMs = d.getTime() - now.getTime();
  if (diffMs < 0) {
    return { label: format(d, 'MMM d, h:mm a'), color: 'text-text-tertiary', tone: 'past' };
  }
  if (isToday(d)) {
    return { label: `Today at ${format(d, 'h:mm a')}`, color: 'text-emerald', tone: 'today' };
  }
  if (isTomorrow(d)) {
    return { label: `Tomorrow at ${format(d, 'h:mm a')}`, color: 'text-primary', tone: 'soon' };
  }
  if (diffMs <= 1000 * 60 * 60 * 24 * 7) {
    return { label: `This ${format(d, 'EEEE')} at ${format(d, 'h:mm a')}`, color: 'text-text-secondary', tone: 'soon' };
  }
  return { label: format(d, 'MMM d, h:mm a'), color: 'text-text-tertiary', tone: 'later' };
};

// ─── Presentational primitives ──────────────────────────────────────────────

interface AvatarProps {
  user?: User | null;
  size?: 'xs' | 'sm' | 'md';
  label?: string;
}

const Avatar: React.FC<AvatarProps> = ({ user, size = 'md', label }) => {
  const sizeClasses = {
    xs: 'h-7 w-7 text-xs',
    sm: 'h-9 w-9 text-xs',
    md: 'h-10 w-10 text-sm',
  };
  const seed = user?.email ?? user?.id ?? label;
  const hue = hueForSeed(seed);
  const init = initials(user);

  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={label ?? `${user.firstName} ${user.lastName}`}
        className={clsx(sizeClasses[size], 'rounded-full object-cover ring-2 ring-[hsl(var(--background-elevated))]')}
      />
    );
  }

  return (
    <div
      className={clsx(sizeClasses[size], 'flex items-center justify-center rounded-full font-bold text-white')}
      style={{ backgroundColor: `hsl(${hue}, 70%, 55%)` }}
      aria-label={label}
      title={label}
    >
      {init}
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
  trend?: Trend;
  hint?: string;
  pulse?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, colorClass, trend, hint, pulse }) => (
  <Card className="transition-shadow hover:shadow-md">
    <div className="flex items-start justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-secondary">{title}</p>
        <p className="mt-1 text-3xl font-bold text-text-primary">{value}</p>
        {trend ? (
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            {trend.direction === 'flat' ? (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-tertiary" />
            ) : trend.direction === 'up' ? (
              <TrendingUp size={13} className="shrink-0 text-emerald" />
            ) : (
              <TrendingDown size={13} className="shrink-0 text-red" />
            )}
            <span
              className={clsx('font-medium', {
                'text-emerald': trend.direction === 'up',
                'text-red': trend.direction === 'down',
                'text-text-tertiary': trend.direction === 'flat',
              })}
            >
              {trend.change > 0 ? `+${trend.change}` : trend.change}
            </span>
            <span className="text-text-tertiary">({trend.percent}%) vs last 24h</span>
          </div>
        ) : hint ? (
          <p className="mt-0.5 text-xs text-text-tertiary">{hint}</p>
        ) : null}
      </div>
      <div
        className={clsx(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
          colorClass,
          pulse && 'animate-pulse'
        )}
        aria-hidden="true"
      >
        {icon}
      </div>
    </div>
  </Card>
);

// Quick-action bar: primary shortcuts above the data grid.
const QUICK_ACTIONS: Array<{
  label: string;
  icon: React.ReactNode;
  path: string;
}> = [
  { label: 'New Lead', icon: <Plus size={18} />, path: '/leads/new' },
  { label: 'New Job', icon: <Briefcase size={18} />, path: '/jobs/new' },
  { label: 'New Estimate', icon: <Calculator size={18} />, path: '/estimates' },
  { label: 'Calendar', icon: <CalendarDays size={18} />, path: '/calendar' },
  { label: 'Storm Tracking', icon: <Map size={18} />, path: '/storm-tracking' },
];

const QuickActionBar: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="mb-6">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
        Quick Actions
      </p>
      <div className="flex items-center gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {QUICK_ACTIONS.map((action) => (
          <Button
            key={action.path}
            variant={action.label === 'New Lead' ? 'primary' : 'secondary'}
            size="md"
            leftIcon={action.icon}
            onClick={() => navigate(action.path)}
            className="shrink-0"
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

// ─── Quick Start: large-touch-target entry points for starters/small teams ──

const QUICK_START_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-background focus-visible:ring-primary';

interface QuickStartAction {
  label: string;
  description: string;
  icon: React.ReactNode;
  path: string;
}

const QUICK_START_ACTIONS: QuickStartAction[] = [
  {
    label: 'Add lead',
    description: 'Capture a new opportunity',
    icon: <Plus size={22} />,
    path: '/leads/new',
  },
  {
    label: 'Schedule inspection',
    description: 'Book a site visit',
    icon: <CalendarDays size={22} />,
    path: '/calendar',
  },
  {
    label: 'Create estimate',
    description: 'Send a branded quote',
    icon: <Calculator size={22} />,
    path: '/estimates',
  },
];

const QuickStart: React.FC<{ firstName?: string }> = ({ firstName }) => {
  const navigate = useNavigate();

  return (
    <section aria-labelledby="quick-start-heading" className="mb-6">
      <div className="mb-3">
        <h2 id="quick-start-heading" className="font-display text-[1.35rem] font-medium text-text-primary">
          Quick Start
        </h2>
        <p className="text-sm text-text-tertiary">
          {firstName ? `Welcome back, ${firstName}. ` : 'Welcome back. '}
          Get today moving in one tap.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_START_ACTIONS.map((action) => (
          <button
            key={action.path}
            type="button"
            onClick={() => navigate(action.path)}
            className={clsx(
              'flex min-h-[76px] items-center gap-3 rounded-xl border border-border bg-[hsl(var(--background-card))] p-4 text-left',
              'transition-colors hover:border-primary hover:bg-[hsl(var(--background-accent))]',
              QUICK_START_FOCUS
            )}
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--background-accent))] text-[hsl(var(--text-primary))]"
              aria-hidden="true"
            >
              {action.icon}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-text-primary">{action.label}</span>
              <span className="block text-xs text-text-tertiary">{action.description}</span>
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => navigate('/storm-tracking')}
          className={clsx(
            'flex min-h-[76px] items-center gap-3 rounded-xl border border-[hsl(var(--border-hover))] bg-[hsl(var(--background-elevated))] p-4 text-left',
            'transition-colors hover:border-primary hover:bg-primary/10',
            QUICK_START_FOCUS
          )}
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--background-accent))] text-[hsl(var(--text-primary))]"
            aria-hidden="true"
          >
            <Radar size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-text-primary">Open Storm Intelligence</span>
            <span className="block text-xs text-text-tertiary">See which homes were just hit</span>
          </span>
          <ArrowRight size={16} className="shrink-0 text-primary" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
};

// ─── Upcoming schedule: time-based color coding + quick-action buttons ─────

const eventStatusVariant = (type?: string): BadgeVariant => {
  switch (type) {
    case 'INSPECTION':
      return 'info';
    case 'PRODUCTION':
      return 'success';
    case 'ESTIMATE':
      return 'warning';
    case 'MEETING':
      return 'default';
    default:
      return 'default';
  }
};

const UpcomingSchedule: React.FC<{ events: CalendarEvent[]; error?: boolean }> = ({
  events,
  error,
}) => {
  const navigate = useNavigate();
  if (error) {
    return (
      <p className="py-4 text-center text-sm text-text-tertiary">
        Schedule could not be loaded.
      </p>
    );
  }
  if (events.length === 0) {
    return (
      <div className="py-8 text-center text-text-tertiary">
        <CalendarDays size={32} className="mx-auto mb-2 opacity-40" />
        <p>No upcoming appointments.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {events.map((event) => {
        const tc = timeCode(event.startTime);
        return (
          <li key={event.id} className="flex items-start gap-3 py-3 first:pt-0">
            <StatusDot status={event.eventType} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium text-text-primary">{event.title}</p>
                  <time dateTime={event.startTime} className={clsx('text-xs font-medium', tc.color)}>
                    {tc.label}
                  </time>
                </div>
                <Badge variant={eventStatusVariant(event.eventType)} size="sm">
                  {event.eventType}
                </Badge>
              </div>
              {event.location && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-text-tertiary">
                  <MapPin size={12} />
                  <span>{event.location}</span>
                </div>
              )}
              {event.description && (
                <p className="mt-1 text-sm text-text-secondary">
                  {truncate(event.description, 140)}
                </p>
              )}
            </div>
            {event.jobId && (
              <button
                type="button"
                onClick={() => navigate(`/jobs/${event.jobId}`)}
                className="shrink-0 rounded-lg p-1 text-text-tertiary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary"
                aria-label="View job"
                title="View job"
              >
                <Eye size={14} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
};

// ─── Weather alerts with severity-based gradients ───────────────────────────

const WeatherAlerts: React.FC<{ alerts: WeatherAlert[]; error?: boolean; isFetching?: boolean; updated?: string }> = ({
  alerts,
  error,
  isFetching,
  updated,
}) => {
  if (error) {
    return (
      <p className="py-4 text-center text-sm text-text-tertiary">
        Weather data is temporarily unavailable. We'll keep trying.
      </p>
    );
  }
  if (alerts.length === 0) {
    return (
      <div className="py-8 text-center text-text-tertiary">
        <AlertTriangle size={32} className="mx-auto mb-2 opacity-40" />
        <p>No severe weather alerts at the moment.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {alerts.map((alert) => {
        const sev = severityStyle(alert.severity);
        return (
          <li key={alert.id} className={`flex items-start gap-3 py-3 first:pt-0 ${sev.bg} ${sev.border}`}>
            <Badge variant={severityBadgeVariant(alert.severity)} size="sm" className="shrink-0">
              {alert.severity}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-text-primary">
                {alert.type || alert.headline || 'Weather Alert'}
              </p>
              {alert.area && <p className={`text-sm ${sev.icon}`}>{alert.area}</p>}
              {alert.headline &&
                alert.headline !== alert.type &&
                alert.headline !== alert.description && (
                  <p className="mt-1 text-sm text-text-tertiary">
                    {truncate(alert.headline, 160)}
                  </p>
                )}
              <div className="mt-1 flex items-center gap-1 text-xs text-text-tertiary">
                <Clock size={12} />
                <span>Expires {timeAgo(alert.expires)}</span>
              </div>
            </div>
            <AlertTriangle size={16} className={clsx('shrink-0', sev.icon, 'opacity-60')} aria-hidden="true" />
          </li>
        );
      })}
    </ul>
  );
};

// ─── Activity feed: improved avatars + attachment previews ──────────────────

const attachmentIcon = (fileType?: FeedAttachment['fileType']) => {
  switch (fileType) {
    case 'IMAGE':
      return <Activity size={16} />;
    case 'VIDEO':
      return <Video size={16} />;
    default:
      return <FileText size={16} />;
  }
};

const AttachmentPreview: React.FC<{ attachment: FeedAttachment }> = ({ attachment }) => {
  const url = resolveFileUrl(attachment.fileUrl);
  const isImage = attachment.fileType === 'IMAGE';
  const [imgError, setImgError] = React.useState(false);
  const fallback = attachmentIcon(attachment.fileType);

  if (isImage && !imgError) {
    return (
      <div className="relative inline-flex items-center gap-1.5 rounded-md border border-border bg-[hsl(var(--background-elevated))] pl-1 pr-2 text-xs text-text-tertiary">
        <img
          src={url}
          alt={attachment.fileName}
          className="h-8 w-8 rounded object-cover"
          onError={() => setImgError(true)}
        />
        <span className="max-w-[120px] truncate">{truncate(attachment.fileName, 16)}</span>
        <span className="text-text-disabled">· {formatBytes(attachment.size)}</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-[hsl(var(--background-elevated))] px-2 py-1 text-xs text-text-tertiary">
      {fallback}
      <span className="max-w-[120px] truncate">{truncate(attachment.fileName, 16)}</span>
      <span className="text-text-disabled">· {formatBytes(attachment.size)}</span>
    </div>
  );
};

const ActivityFeed: React.FC<{ posts: FeedPost[]; error?: boolean }> = ({ posts, error }) => {
  if (error) {
    return (
      <p className="py-4 text-center text-sm text-text-tertiary">
        Recent activity is temporarily unavailable.
      </p>
    );
  }
  if (posts.length === 0) {
    return (
      <div className="py-8 text-center text-text-tertiary">
        <Users size={32} className="mx-auto mb-2 opacity-40" />
        <p>No recent activity yet. Start by adding a lead or job.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {posts.map((post) => (
        <li key={post.id} className="flex items-start gap-3 py-3 first:pt-0">
          {post.isSystem ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--background-accent))] text-text-secondary">
              <Activity size={16} />
            </div>
          ) : (
            <Avatar user={post.user} size="sm" label={`${post.user?.firstName ?? ''} ${post.user?.lastName ?? ''}`} />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-medium text-text-primary">
                {post.user
                  ? `${post.user.firstName} ${post.user.lastName}`
                  : post.isSystem
                    ? 'AUCTUM'
                    : 'Team member'}
              </span>
              <span className="text-xs text-text-tertiary">· {timeAgo(post.createdAt)}</span>
            </div>
            {post.content && (
              <p className="mt-1 text-sm text-text-secondary break-words">
                {truncate(post.content, 200)}
              </p>
            )}
            {post.attachments && post.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {post.attachments.slice(0, 3).map((att) => (
                  <AttachmentPreview key={att.id} attachment={att} />
                ))}
                {post.attachments.length > 3 && (
                  <span className="text-xs text-text-tertiary">+{post.attachments.length - 3} more</span>
                )}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};

// ─── Dashboard ──────────────────────────────────────────────────────────────

const WEEK_END_ISO = formatISO(addDays(new Date(), 7));

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // ── Data fetching (react-query with refresh intervals) ───────────
  // Stats cards refresh on a 60s cadence; weather alerts every 2 min;
  // recent activity every 30s; calendar every 60s.
  const jobsQuery = useQuery({
    queryKey: ['dashboard', 'jobs'],
    queryFn: () => api.get('/jobs').then((res) => res.data as ListResponse<Job>),
    placeholderData: { data: [], count: 0 },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  const leadsQuery = useQuery({
    queryKey: ['dashboard', 'leads'],
    queryFn: () => api.get('/leads').then((res) => res.data as ListResponse<Lead>),
    placeholderData: { data: [], count: 0 },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  const estimatesQuery = useQuery({
    queryKey: ['dashboard', 'estimates'],
    queryFn: () => api.get('/estimates').then((res) => res.data as ListResponse<Estimate>),
    placeholderData: { data: [], count: 0 },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  const alertsQuery = useQuery({
    queryKey: ['dashboard', 'weather-alerts'],
    queryFn: () =>
      api.get('/weather/alerts?limit=50').then((res) => res.data as WeatherAlertsResponse),
    placeholderData: { alerts: [], total: 0 },
    staleTime: 30_000,
    refetchInterval: 120_000,
    retry: 1,
  });

  const stormEventsQuery = useQuery({
    queryKey: ['dashboard', 'storm-events'],
    queryFn: () =>
      api.get('/storms/events').then(
        (res) =>
          ({
            data: (res.data.events ?? []) as StormEvent[],
            count: (res.data.count ?? 0) as number,
          }) as ListResponse<StormEvent>
      ),
    placeholderData: { data: [], count: 0 },
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });

  const feedQuery = useQuery({
    queryKey: ['dashboard', 'feed-recent'],
    queryFn: () => api.get('/feed?limit=10').then((res) => res.data as FeedResponse),
    placeholderData: { posts: [], count: 0 },
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: 1,
  });

  const calendarQuery = useQuery({
    queryKey: ['dashboard', 'calendar-upcoming'],
    queryFn: () =>
      api
        .get(`/calendar?end=${encodeURIComponent(WEEK_END_ISO)}`)
        .then((res) => res.data as CalendarResponse),
    placeholderData: { data: [] },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  // ── Derived stats ────────────────────────────────────────────────
  const jobs = jobsQuery.data?.data ?? [];
  const leads = leadsQuery.data?.data ?? [];
  const estimates = estimatesQuery.data?.data ?? [];
  const stormEvents = stormEventsQuery.data?.data ?? [];
  const weatherAlerts = alertsQuery.data?.alerts ?? [];

  // Quick Start only renders once the dashboard queries have data. (Queries use
  // placeholder data, so this is effectively "not during the initial suspense paint".)
  const dashboardDataReady = Boolean(jobsQuery.data && leadsQuery.data && estimatesQuery.data);

  return (
    <div>
      {dashboardDataReady && <QuickStart firstName={user?.firstName} />}
      <DashboardCommandCenter
        jobs={jobs}
        leads={leads}
        stormEvents={stormEvents}
        weatherAlerts={weatherAlerts}
      />
    </div>
  );
};

export default Dashboard;





