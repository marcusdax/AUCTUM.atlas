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
 * ORBITAL INTELLIGENCE Metric Component
 * 
 * Displays a key metric with title, value, optional trend arrow, 
 * state indicator, and hint. Supports LIVE→SYNCING→STALE→DEGRADED→OFFLINE state machine.
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
  // State-to-color mapping per ORBITAL INTELLIGENCE visual identity
  // Using CSS variables defined in styles/index.css
  const stateDotColor: Record<string, string> = {
    LIVE: 'hsl(var(--state-live))',       // Cyan hsl(217 91% 53%)
    SYNCING: 'hsl(var(--state-syncing))', // Amber hsl(210 23% 60%)
    STALE: 'hsl(var(--state-stale))',     // Tertiary hsl(210 15% 40%)
    DEGRADED: 'hsl(var(--state-degraded))', // Orange-red hsl(25 80% 55%)
    OFFLINE: 'hsl(var(--state-offline))',  // Disabled hsl(210 11% 29%)
  };

  const trendDirectionColor: Record<'up' | 'down' | 'flat', string> = {
    up: 'hsl(var(--emerald))',
    down: 'hsl(var(--red))',
    flat: 'hsl(var(--text-tertiary))',
  };

  const trendIcon = trend?.direction === 'up' ? (
    <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
  ) : trend?.direction === 'down' ? (
    <TrendingDown className="h-4 w-4 shrink-0" aria-hidden="true" />
  ) : null;

  return (
    <div
      className={clsx(
        'rounded-xl bg-[hsl(var(--background-card))] border border-border transition-shadow hover:shadow-md p-5',
        pulse && 'animate-pulse-soft',
        interactive && 'cursor-pointer hover:bg-[hsl(var(--background-accent))]',
        className
      )}
      onClick={interactive && onClick ? (e: React.MouseEvent<HTMLDivElement>) => onClick(e) : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `${title}: ${typeof value === 'string' ? value : String(value)}` : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={clsx('flex-shrink-0', colorClass)}>
                {icon}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-text-secondary">{title}</p>
              <p className="mt-1 text-2xl font-bold text-text-primary tabular-nums">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {/* State indicator dot */}
          <span
            className={clsx(
              'h-3 w-3 rounded-full flex-shrink-0',
              stateDotColor[state] || stateDotColor.LIVE
            )}
            aria-hidden="true"
            title={state}
            role="img"
            aria-label={`State: ${state}`}
          />
          
          {trend && (
            <div className="flex items-center gap-1.5 text-xs">
              {trendIcon && (
                <span
                  className={clsx('flex shrink-0', trendDirectionColor[trend.direction as 'up' | 'down' | 'flat'])}
                >
                  {trendIcon}
                </span>
              )}
              <span className={clsx('font-medium', trendDirectionColor[trend.direction as 'up' | 'down' | 'flat'])}>
                {trend.change > 0 ? `+${trend.change}` : trend.change}
              </span>
              <span className="text-text-tertiary">({trend.percent}%)</span>
            </div>
          )}

          {hint && (
            <p className="text-xs text-text-tertiary text-right">{hint}</p>
          )}
        </div>
      </div>
    </div>
  );
};

Metric.displayName = 'Metric';
export { Metric };