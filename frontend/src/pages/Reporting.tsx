import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import Card, { Badge, StatusDot } from '../components/ui/Card';
import Button from '../components/ui/Button';
import {
  Calendar,
  ChevronDown,
  DollarSign,
  FileDown,
  TrendingUp,
  Users,
  Clock,
  CheckCircle,
  Package,
  PieChart,
  Briefcase,
} from 'lucide-react';
import {
  subDays,
  startOfYear,
  format,
  parse,
} from 'date-fns';
import clsx from 'clsx';
import {
  PipelineReport,
  ProfitabilityReport,
  ProductionEfficiencyReport,
  LeadStatus,
  JobProfitabilityItem,
} from '../types';

// ─── Constants ──────────────────────────────────────────────

const LEAD_STATUSES: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'NEW', label: 'New', color: 'bg-text-tertiary' },
  { value: 'CONTACTED', label: 'Contacted', color: 'bg-primary' },
  { value: 'INSPECTION_SCHEDULED', label: 'Inspection Scheduled', color: 'bg-purple' },
  { value: 'ESTIMATE_SENT', label: 'Estimate Sent', color: 'bg-amber' },
  { value: 'WON', label: 'Won', color: 'bg-emerald' },
  { value: 'LOST', label: 'Lost', color: 'bg-red' },
];

const DATE_PRESETS = [
  { key: '30d', label: 'Last 30 Days', days: 30 },
  { key: '90d', label: 'Last 90 Days', days: 90 },
  { key: 'ytd', label: 'Year to Date', days: 0 },
  { key: 'custom', label: 'Custom Range', days: 0 },
] as const;

type DatePreset = (typeof DATE_PRESETS)[number]['key'];

interface DateRangeValue {
  preset: DatePreset;
  startDate: Date;
  endDate: Date;
}

const defaultDateRange = (): DateRangeValue => {
  const end = new Date();
  return { preset: '90d', startDate: subDays(end, 90), endDate: end };
};

// ─── Formatting helpers ─────────────────────────────────────

const currency = (value: number | null | undefined) =>
  `$${((value ?? 0) / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 })}K`;

const currencyFull = (value: number | null | undefined) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const percent = (value: number | null | undefined) => `${(value ?? 0).toFixed(1)}%`;

const marginColor = (margin: number) => {
  if (margin >= 20) return 'text-emerald';
  if (margin >= 0) return 'text-amber';
  return 'text-red';
};

// ─── Chart components ───────────────────────────────────────

interface BarChartProps {
  data: Array<{ label: string; value: number; color: string }>;
  unit?: string;
  maxValue?: number;
  showValues?: boolean;
}

const BarChart: React.FC<BarChartProps> = ({
  data,
  unit = '',
  showValues = true,
}) => {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const maxDisplay = maxValue * 1.1;
  // Percentage heights inside a flex column collapse, so compute pixel heights.
  const BAR_AREA_PX = 168;

  return (
    <div className="w-full">
      <div className="flex items-end justify-between gap-2 border-l border-[hsl(var(--border))] pb-2 pl-3">
        {data.map((bar) => {
          const heightPx =
            bar.value > 0
              ? Math.max(6, Math.round((bar.value / maxDisplay) * BAR_AREA_PX))
              : 2;
          return (
            <div
              key={bar.label}
              className="flex flex-1 flex-col items-center justify-end gap-1.5"
              style={{ height: `${BAR_AREA_PX + 28}px` }}
            >
              {showValues && bar.value > 0 && (
                <span className="font-mono text-[0.625rem] font-medium text-text-tertiary">
                  {bar.value}
                </span>
              )}
              <div
                className={`w-full min-w-[40px] rounded-t-sm transition-all duration-300 ${bar.color}`}
                style={{ height: `${heightPx}px` }}
                title={`${bar.label}: ${bar.value}${unit}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between border-t border-[hsl(var(--border))] px-1 pt-2">
        {data.map((bar) => (
          <span
            key={bar.label}
            className="min-w-[40px] text-center font-mono text-[0.5625rem] uppercase tracking-[0.06em] text-text-tertiary"
          >
            {bar.label}
          </span>
        ))}
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string | number;
  iconBg?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subValue, iconBg = 'bg-primary/10' }) => (
  <Card className="text-center">
    <div className="flex flex-col items-center gap-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg} text-primary`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-text-primary">{value}</p>
        <p className="text-sm text-text-secondary">{label}</p>
        {subValue && <p className="text-xs text-text-tertiary">{subValue}</p>}
      </div>
    </div>
  </Card>
);

// ─── Date Range Picker ─────────────────────────────────────

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);

  const applyRange = (preset: DatePreset, start?: Date, end?: Date) => {
    const endDate = end ?? new Date();
    let startDate: Date;
    if (start) {
      startDate = start;
    } else if (preset === '30d') {
      startDate = subDays(endDate, 30);
    } else if (preset === '90d') {
      startDate = subDays(endDate, 90);
    } else if (preset === 'ytd') {
      startDate = startOfYear(endDate);
    } else {
      startDate = subDays(endDate, 90);
    }
    onChange({ preset, startDate, endDate });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2 text-sm text-text-primary hover:bg-[hsl(var(--background-accent))]"
      >
        <Calendar size={16} />
        <span>
          {format(value.startDate, 'MMM d')} — {format(value.endDate, 'MMM d, yyyy')}
        </span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full left-0 z-20 mt-2 w-64 rounded-xl border border-border bg-[hsl(var(--background-card))] p-3 shadow-lg">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
              Date Presets
            </p>
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyRange(preset.key)}
                className={clsx(
                  'block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  value.preset === preset.key
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-secondary hover:bg-[hsl(var(--background-accent))] hover:text-text-primary',
                )}
              >
                {preset.label}
              </button>
            ))}

            {value.preset === 'custom' && (
              <>
                <div className="my-3 border-t border-border" />
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-text-tertiary">Start Date</label>
                    <input
                      type="date"
                      value={format(value.startDate, 'yyyy-MM-dd')}
                      onChange={(e) => {
                        const start = parse(e.target.value, 'yyyy-MM-dd', new Date());
                        applyRange('custom', start, value.endDate);
                      }}
                      className="mt-1 w-full rounded-lg border border-border bg-[hsl(var(--background))] px-2 py-1.5 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-tertiary">End Date</label>
                    <input
                      type="date"
                      value={format(value.endDate, 'yyyy-MM-dd')}
                      onChange={(e) => {
                        const end = parse(e.target.value, 'yyyy-MM-dd', new Date());
                        applyRange('custom', value.startDate, end);
                      }}
                      className="mt-1 w-full rounded-lg border border-border bg-[hsl(var(--background))] px-2 py-1.5 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Tab: Sales Pipeline ────────────────────────────────────

interface SalesPipelineProps {
  data: PipelineReport | undefined;
  isLoading: boolean;
  error: unknown;
}

const SalesPipeline: React.FC<SalesPipelineProps> = ({ data, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <div className="animate-pulse space-y-3">
              <div className="h-10 w-10 rounded-lg bg-[hsl(var(--background-accent))] mx-auto" />
              <div className="h-6 w-16 rounded bg-[hsl(var(--background-accent))] mx-auto" />
              <div className="h-4 w-12 rounded bg-[hsl(var(--background-accent))] mx-auto" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red">
        <div className="py-8 text-center text-red">
          <p>Failed to load pipeline data. Please try again.</p>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const barData = LEAD_STATUSES.map((s) => ({
    label: s.label,
    value: data.leadsByStatus[s.value] ?? 0,
    color: s.color + ' hover:brightness-110',
  }));

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          icon={<Users size={20} />}
          label="Total Leads"
          value={data.totalLeads}
        />
        <StatCard
          icon={<CheckCircle size={20} />}
          label="Conversion Rate"
          value={percent(data.conversionRate)}
          subValue={`${data.won} won / ${data.won + data.lost} decided`}
        />
        <StatCard
          icon={<DollarSign size={20} />}
          label="Total Deal Value"
          value={currencyFull(data.totalDealValue)}
          subValue={`${data.approvedEstimateCount} approved estimates`}
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Active Leads"
          value={data.totalLeads - data.won - data.lost}
          subValue="In pipeline (not lost/won)"
        />
      </div>

      {/* Bar chart */}
      <Card title="Leads by Status" subtitle="Distribution across the sales pipeline">
        <BarChart data={barData} unit="" />
      </Card>

      {/* Status breakdown table */}
      <Card title="Pipeline Breakdown">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Status
                </th>
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Count
                </th>
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  % of Total
                </th>
              </tr>
            </thead>
            <tbody>
              {LEAD_STATUSES.map((s) => {
                const count = data.leadsByStatus[s.value] ?? 0;
                const pct = data.totalLeads > 0 ? (count / data.totalLeads) * 100 : 0;
                return (
                  <tr key={s.value} className="border-b border-border/50">
                    <td className="px-4 py-2">
                      <Badge variant={s.value === 'WON' ? 'success' : s.value === 'LOST' ? 'danger' : 'default'}>
                        <StatusDot status={s.value} size="sm" />
                        {s.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-text-primary">{count}</td>
                    <td className="px-4 py-2 text-text-secondary">{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// ─── Tab: Job Profitability ─────────────────────────────────

interface JobProfitabilityProps {
  data: ProfitabilityReport | undefined;
  isLoading: boolean;
  error: unknown;
}

const JobProfitability: React.FC<JobProfitabilityProps> = ({ data, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-48 rounded bg-[hsl(var(--background-accent))]"></div>
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded bg-[hsl(var(--background-accent))]"></div>
              ))}
            </div>
            <div className="h-64 rounded bg-[hsl(var(--background-accent))]"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red">
        <div className="py-8 text-center text-red">
          <p>Failed to load profitability data. Please try again.</p>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          icon={<DollarSign size={20} />}
          label="Total Budget"
          value={currencyFull(data.summary.totalBudget)}
        />
        <StatCard
          icon={<Package size={20} />}
          label="Total Cost"
          value={currencyFull(data.summary.totalCost)}
        />
        <StatCard
          icon={<PieChart size={20} />}
          label="Total Revenue"
          value={currencyFull(data.summary.totalRevenue)}
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Overall Margin"
          value={percent(data.summary.totalMargin)}
          subValue={`${data.summary.totalJobs} jobs`}
        />
      </div>

      {/* Jobs table */}
      <Card title="Job Profitability" subtitle="Budget, cost, revenue, and margin by job">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Job
                </th>
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Lead
                </th>
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Status
                </th>
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Phase
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Budget
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Cost
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Revenue
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Margin
                </th>
              </tr>
            </thead>
            <tbody>
              {data.jobs.map((job: JobProfitabilityItem) => (
                <tr key={job.id} className="border-b border-border/50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-text-primary">{job.name}</div>
                  </td>
                  <td className="px-4 py-2 text-text-secondary">{job.leadName}</td>
                  <td className="px-4 py-2">
                    <Badge variant="default" size="sm">
                      <StatusDot status={job.status} size="sm" />
                      {job.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-text-secondary">{job.phase.replace('_', ' ')}</td>
                  <td className="px-4 py-2 text-right text-text-primary">{currencyFull(job.budget)}</td>
                  <td className="px-4 py-2 text-right text-text-secondary">{currencyFull(job.cost)}</td>
                  <td className="px-4 py-2 text-right text-text-primary">{currencyFull(job.revenue)}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={clsx('font-medium', marginColor(job.margin))}>
                      {percent(job.margin)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// ─── Tab: Production Efficiency ─────────────────────────────

interface ProductionEfficiencyProps {
  data: ProductionEfficiencyReport | undefined;
  isLoading: boolean;
  error: unknown;
}

const ProductionEfficiency: React.FC<ProductionEfficiencyProps> = ({ data, isLoading, error }) => {
  const PHASE_COLORS: Record<string, string> = {
    INSPECTION: 'bg-primary',
    ESTIMATE: 'bg-purple',
    PRODUCTION: 'bg-primary',
    INVOICING: 'bg-amber',
    COMPLETED: 'bg-emerald',
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 rounded bg-[hsl(var(--background-accent))]"></div>
              ))}
            </div>
            <div className="h-48 rounded bg-[hsl(var(--background-accent))]"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red">
        <div className="py-8 text-center text-red">
          <p>Failed to load production data. Please try again.</p>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const phaseBarData = Object.entries(data.phaseDistribution).map(([phase, count]) => ({
    label: phase.replace('_', ' '),
    value: count,
    color: PHASE_COLORS[phase] ?? 'bg-text-tertiary',
  }));

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          icon={<CheckCircle size={20} />}
          label="Completed Jobs"
          value={data.completedJobsCount}
        />
        <StatCard
          icon={<Briefcase size={20} />}
          label="Total Jobs"
          value={data.totalJobs}
        />
        <StatCard
          icon={<Clock size={20} />}
          label="Avg Cycle Time"
          value={`${data.avgCycleTimeDays} days`}
        />
        <StatCard
          icon={<Users size={20} />}
          label="Active Crew"
          value={data.crewProductivity.length}
        />
      </div>

      {/* Phase distribution chart */}
      <Card title="Jobs by Phase" subtitle="Current distribution across the job lifecycle">
        <BarChart data={phaseBarData} unit=" jobs" />
      </Card>

      {/* Phase timing + crew productivity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Avg Time per Phase" subtitle="Scheduled hours by phase (from calendar events)">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    Phase
                  </th>
                  <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    Avg Hours
                  </th>
                  <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    Events
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.avgTimePerPhase.map((p) => (
                  <tr key={p.phase} className="border-b border-border/50">
                    <td className="px-4 py-2 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-text-primary">{p.phase.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-2 text-text-secondary">{p.avgHours > 0 ? p.avgHours : '—'}</td>
                    <td className="px-4 py-2 text-text-secondary">{p.scheduledEvents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Crew Productivity" subtitle="Jobs assigned per crew member">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    Crew Member
                  </th>
                  <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    Role
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    Jobs
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.crewProductivity.map((crew) => (
                  <tr key={crew.id} className="border-b border-border/50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--background-accent))] text-xs font-medium text-text-primary">
                          {crew.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()}
                        </div>
                        <span className="text-text-primary">{crew.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-text-secondary">{crew.role.replace('_', ' ')}</td>
                    <td className="px-4 py-2 text-right">
                      <Badge variant="info" size="sm">
                        {crew.jobsAssigned}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {data.crewProductivity.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-text-tertiary">
                      No crew assignments in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

// ─── Main Reporting Page ────────────────────────────────────

type ReportTab = 'pipeline' | 'profitability' | 'production-efficiency';

const Reporting: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('pipeline');
  const [dateRange, setDateRange] = useState<DateRangeValue>(defaultDateRange());

  const params = {
    startDate: dateRange.startDate.toISOString(),
    endDate: dateRange.endDate.toISOString(),
  };

  const {
    data: pipelineData,
    isLoading: pipelineLoading,
    error: pipelineError,
  } = useQuery<PipelineReport>({
    queryKey: ['reports-pipeline', params],
    queryFn: () => api.get('/reports/pipeline', { params }).then((res) => res.data),
    enabled: activeTab === 'pipeline',
    staleTime: 60_000,
  });

  const {
    data: profitabilityData,
    isLoading: profitabilityLoading,
    error: profitabilityError,
  } = useQuery<ProfitabilityReport>({
    queryKey: ['reports-profitability', params],
    queryFn: () => api.get('/reports/profitability', { params }).then((res) => res.data),
    enabled: activeTab === 'profitability',
    staleTime: 60_000,
  });

  const {
    data: productionData,
    isLoading: productionLoading,
    error: productionError,
  } = useQuery<ProductionEfficiencyReport>({
    queryKey: ['reports-production', params],
    queryFn: () =>
      api.get('/reports/production-efficiency', { params }).then((res) => res.data),
    enabled: activeTab === 'production-efficiency',
    staleTime: 60_000,
  });

  // ─── Export handlers ────────────────────────────────────

  const handleExport = async (format: 'csv' | 'pdf') => {
    const reportMap: Record<ReportTab, string> = {
      pipeline: 'pipeline',
      profitability: 'profitability',
      'production-efficiency': 'production-efficiency',
    };

    const res = await api.get('/reports/export', {
      params: {
        report: reportMap[activeTab],
        format,
        startDate: params.startDate,
        endDate: params.endDate,
      },
      responseType: 'blob',
    });

    const blob = new Blob([res.data], {
      type: format === 'pdf' ? 'application/pdf' : 'text/csv',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roofpro-report-${reportMap[activeTab]}.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const tabConfig = [
    { value: 'pipeline', label: 'Sales Pipeline' },
    { value: 'profitability', label: 'Job Profitability' },
    { value: 'production-efficiency', label: 'Production Efficiency' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reporting</h1>
          <p className="text-text-secondary">
            Sales pipeline, job profitability, and production efficiency dashboards.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<FileDown size={16} />}
            onClick={() => handleExport('csv')}
          >
            Export CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<FileDown size={16} />}
            onClick={() => handleExport('pdf')}
          >
            Export PDF
          </Button>
        </div>
      </div>

      {/* Date range + tabs */}
      <div className="flex items-center justify-between gap-4">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <div className="flex items-center gap-1 rounded-lg bg-[hsl(var(--background-elevated))] p-1 border border-border">
          {tabConfig.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={clsx(
                'rounded-lg px-4 py-2 text-sm font-medium transition-all',
                activeTab === tab.value
                  ? 'bg-primary text-white shadow-md'
                  : 'text-text-secondary hover:text-text-primary hover:bg-[hsl(var(--background-accent))]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'pipeline' && (
          <SalesPipeline
            data={pipelineData}
            isLoading={pipelineLoading}
            error={pipelineError}
          />
        )}
        {activeTab === 'profitability' && (
          <JobProfitability
            data={profitabilityData}
            isLoading={profitabilityLoading}
            error={profitabilityError}
          />
        )}
        {activeTab === 'production-efficiency' && (
          <ProductionEfficiency
            data={productionData}
            isLoading={productionLoading}
            error={productionError}
          />
        )}
      </div>
    </div>
  );
};

export default Reporting;
