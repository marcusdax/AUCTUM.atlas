import React from 'react';
import { AlertTriangle, Shield, Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import clsx from 'clsx';

export interface RiskBreakdownItem {
  name: string;
  score: number;
  status: 'critical' | 'high' | 'medium' | 'low';
}

export interface RiskScoreProps {
  /** Risk score value (0-100) */
  value: number;
  /** Label for the risk metric */
  label: string;
  /** Optional trend data */
  trend?: {
    direction: 'up' | 'down' | 'flat';
    change: number;
  };
  /** Optional breakdown of risk factors */
  breakdown?: RiskBreakdownItem[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * ORBITAL INTELLIGENCE Risk Score Component
 * 
 * Colored risk indicator with gradient bar showing risk level:
 * - 0-25: Minimal (emerald)
 * - 26-50: Moderate (amber)  
 * - 51-75: Severe (orange)
 * - 76-100: Critical (red)
 * Hover tooltip shows breakdown of risk factors.
 */
const RiskScore: React.FC<RiskScoreProps> = ({
  value,
  label,
  trend,
  breakdown,
  className,
}) => {
  // Clamp value to 0-100
  const clampedValue = Math.max(0, Math.min(100, Math.round(value)));

  // Determine risk level and color
  const getRiskLevel = (val: number): { 
    label: string; 
    color: string; 
    bgColor: string;
    icon: React.ReactNode;
    gradient: string;
  } => {
    if (val >= 76) {
      return {
        label: 'Critical',
        color: 'hsl(var(--red))',
        bgColor: 'hsl(var(--red))',
        icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
        gradient: 'linear-gradient(90deg, hsl(var(--red)) 0%, hsl(0 90% 65%) 100%)',
      };
    }
    if (val >= 51) {
      return {
        label: 'Severe',
        color: 'hsl(var(--orange))',
        bgColor: 'hsl(var(--orange))',
        icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
        gradient: 'linear-gradient(90deg, hsl(var(--orange)) 0%, hsl(25 95% 60%) 100%)',
      };
    }
    if (val >= 26) {
      return {
        label: 'Moderate',
        color: 'hsl(var(--amber))',
        bgColor: 'hsl(var(--amber))',
        icon: <Info className="h-4 w-4" aria-hidden="true" />,
        gradient: 'linear-gradient(90deg, hsl(var(--amber)) 0%, hsl(38 92% 60%) 100%)',
      };
    }
    return {
      label: 'Minimal',
      color: 'hsl(var(--emerald))',
      bgColor: 'hsl(var(--emerald))',
      icon: <Shield className="h-4 w-4" aria-hidden="true" />,
      gradient: 'linear-gradient(90deg, hsl(var(--emerald)) 0%, hsl(150 60% 60%) 100%)',
    };
  };

  const { label: riskLabel, color, bgColor, icon, gradient } = getRiskLevel(clampedValue);

  const trendIcon = trend?.direction === 'up' ? (
    <TrendingUp className="h-3 w-3 text-[hsl(var(--red))]" aria-hidden="true" />
  ) : trend?.direction === 'down' ? (
    <TrendingDown className="h-3 w-3 text-[hsl(var(--emerald))]" aria-hidden="true" />
  ) : (
    <Minus className="h-3 w-3 text-[hsl(var(--text-tertiary))]" aria-hidden="true" />
  );

  // Show tooltip on hover if breakdown exists
  const [showTooltip, setShowTooltip] = React.useState(false);

  return (
    <div
      className={clsx('relative inline-flex flex-col gap-2', className)}
      onMouseEnter={() => breakdown && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Main risk score display */}
      <div className="flex items-center gap-3">
        {/* Gradient risk bar */}
        <div className="relative flex-1 min-w-[120px] max-w-[200px]" role="progressbar" aria-valuenow={clampedValue} aria-valuemin={0} aria-valuemax={100} aria-label={`${label}: ${clampedValue}%, ${riskLabel}`}>
          <div 
            className="h-3 rounded-full overflow-hidden bg-[hsl(var(--border))]"
            style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ 
                width: `${clampedValue}%`,
                background: gradient,
                boxShadow: `0 0 8px ${color}`,
              }}
            />
          </div>
          
          {/* Value indicator on bar */}
          <div
            className="absolute top-1/2 -translate-y-1/2 text-[10px] font-bold text-white drop-shadow-sm pointer-events-none"
            style={{ 
              left: `calc(${clampedValue}% + 4px)`,
              transform: 'translate(-50%, -50%)',
            }}
            aria-hidden="true"
          >
            {clampedValue}%
          </div>
        </div>

        {/* Score and label */}
        <div className="flex flex-col items-end min-w-[80px]">
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-bold text-text-primary tabular-nums">{clampedValue}</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: color }}>
              {riskLabel}
            </span>
          </div>
          <p className="text-xs text-text-tertiary text-right">{label}</p>
        </div>

        {/* Trend indicator */}
        {trend && (
          <div className="flex items-center gap-1 text-xs">
            {trendIcon}
            <span className={clsx('font-medium', trend?.direction === 'up' && 'text-[hsl(var(--red))]', trend?.direction === 'down' && 'text-[hsl(var(--emerald))]')}>
              {trend.change > 0 ? `+${trend.change}` : trend.change}
            </span>
          </div>
        )}
      </div>

      {/* Tooltip with breakdown */}
      {breakdown && breakdown.length > 0 && showTooltip && (
        <div
          className="absolute top-full left-0 mt-2 z-50 w-64 rounded-lg border border-border bg-[hsl(var(--background-card))] shadow-xl p-3 animate-fadeIn"
          role="tooltip"
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-text-primary">Risk Breakdown</h4>
            <span className="text-xs text-text-tertiary">{breakdown.length} factors</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {breakdown.map((item, index) => (
              <div key={index} className="flex items-center justify-between gap-2 p-2 rounded bg-[hsl(var(--background-elevated))]">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span 
                    className={clsx(
                      'h-2 w-2 rounded-full flex-shrink-0',
                      item.status === 'critical' && 'bg-[hsl(var(--red))]',
                      item.status === 'high' && 'bg-[hsl(var(--orange))]',
                      item.status === 'medium' && 'bg-[hsl(var(--amber))]',
                      item.status === 'low' && 'bg-[hsl(var(--emerald))]'
                    )}
                  />
                  <span className="text-xs font-medium text-text-primary truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold tabular-nums text-text-primary">{item.score}</span>
                  <span className={clsx(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded',
                    item.status === 'critical' && 'bg-[hsl(var(--red))]/10 text-[hsl(var(--red))]',
                    item.status === 'high' && 'bg-[hsl(var(--orange))]/10 text-[hsl(var(--orange))]',
                    item.status === 'medium' && 'bg-[hsl(var(--amber))]/10 text-[hsl(var(--amber))]',
                    item.status === 'low' && 'bg-[hsl(var(--emerald))]/10 text-[hsl(var(--emerald))]'
                  )}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

RiskScore.displayName = 'RiskScore';
export { RiskScore };