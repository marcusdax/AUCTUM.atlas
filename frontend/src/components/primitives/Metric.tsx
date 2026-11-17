import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import clsx from 'clsx';

export interface MetricProps {
  /** Metric title (e.g. "Active Jobs", "Qualified Leads") */
  title: string;
  /** Metric value (number or formatted string) */
  value: string | number;
  /** Optional trend arrow data */
  trend?: {
    direction: 'up' | 'down' | 'flat';
    change: number;
    percent: number;
  };
  /** Optional hint text (e.g. "active severe alerts") */
  hint?: string;
  /** Pulse animation for LIVE state indicator */
  pulse?: boolean;
  /** State indicator LIVE/SYNCING/STALE/DEGRADED/OFFLINE */
  state?: 'LIVE' | 'SYNCING' | 'STALE' | 'DEGRADED' | 'OFFLINE';
  /** Show as interactive (clickable) */
  interactive?: boolean;
  /** On click handler (only when interactive) */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Additional CSS classes */
  className?: string;
  /** Optional icon rendered in the header area */
  icon?: React.ReactNode;
  /** Optional icon background/value color class */
  colorClass?: string;
}

/**
 * AUCTUM metric tile — archival editorial layout:
 * mono eyebrow title, Fraunces figure, hairline-separated hint, seal-state dot.
 * The hint lives under the figure (not in the trailing column) so long labels
 * can never collide with the title on narrow grids.
 */
const Metric: React.FC<MetricProps> = ({
  title,
  value,
  trend,
  hint,
  pulse,
  state = 'LIVE',
  interactive = false,
  onClick,
  className,
  icon,
  colorClass,
}) => {
  const stateDotColor: Record<string, string> = {
    LIVE: 'hsl(var(--state-live))',
    SYNCING: 'hsl(var(--state-syncing))',
    STALE: 'hsl(var(--state-stale))',
    DEGRADED: 'hsl(var(--state-degraded))',
    OFFLINE: 'hsl(var(--state-offline))',
  };

  const trendDirectionColor: Record<'up' | 'down' | 'flat', string> = {
    up: 'hsl(var(--emerald))',
    down: 'hsl(var(--red))',
    flat: 'hsl(var(--text-tertiary))',
  };

  const trendIcon =
    trend?.direction === 'up' ? (
      <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    ) : trend?.direction === 'down' ? (
      <TrendingDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    ) : null;

  return (
    <div
      className={clsx(
        'rounded-xl border border-border bg-[hsl(var(--background-card))] p-4 transition-colors hover:bg-[hsl(var(--background-accent))]',
        pulse && 'animate-pulse-soft',
        interactive && 'cursor-pointer',
        className
      )}
      onClick={
        interactive && onClick
          ? (e: React.MouseEvent<HTMLDivElement>) => onClick(e)
          : undefined
      }
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={
        interactive
          ? `${title}: ${typeof value === 'string' ? value : String(value)}`
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {icon && <span className={clsx('shrink-0', colorClass)}>{icon}</span>}
            <p className="truncate font-mono text-[0.5625rem] font-medium uppercase tracking-[0.16em] text-text-tertiary">
              {title}
            </p>
          </div>
          <p className="mt-2 font-display text-[1.9rem] font-medium leading-none text-text-primary tabular-nums">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {hint && (
            <p className="mt-2 border-t border-[hsl(var(--border))] pt-2 text-[0.6875rem] leading-snug text-text-secondary">
              {hint}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: stateDotColor[state] || stateDotColor.LIVE }}
            aria-hidden="true"
            title={state}
            role="img"
            aria-label={`State: ${state}`}
          />
          {trend && (
            <div className="flex items-center gap-1 text-[0.625rem] font-medium">
              {trendIcon && (
                <span
                  className="flex shrink-0"
                  style={{ color: trendDirectionColor[trend.direction] }}
                >
                  {trendIcon}
                </span>
              )}
              <span style={{ color: trendDirectionColor[trend.direction] }}>
                {trend.change > 0 ? `+${trend.change}` : trend.change}
              </span>
              <span className="text-text-tertiary">({trend.percent}%)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

Metric.displayName = 'Metric';
export { Metric };
