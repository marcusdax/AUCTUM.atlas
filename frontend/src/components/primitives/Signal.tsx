import React from 'react';
import { Activity, Wifi, Database, Cpu, AlertTriangle, Circle } from 'lucide-react';
import clsx from 'clsx';

export interface SignalProps {
  /** Signal label (e.g., "Live Data", "AI Processing") */
  label: string;
  /** Signal status (e.g., "ONLINE", "PROCESSING") */
  status: 'ONLINE' | 'OFFLINE' | 'PROCESSING' | 'WARNING' | 'UNKNOWN' | 'SYNCING';
  /** Optional description text */
  description?: string;
  /** Signal color variant */
  color?: 'cyan' | 'violet' | 'magenta' | 'amber' | 'emerald' | 'teal';
  /** Pulse animation for active states */
  pulse?: boolean;
  /** Signal strength indicator (1-5 bars) */
  strength?: 1 | 2 | 3 | 4 | 5;
  /** Signal type for accessibility and icon */
  type?: 'data' | 'ai' | 'system' | 'network';
  /** Additional CSS classes */
  className?: string;
}

/**
 * ORBITAL INTELLIGENCE Signal Component
 * 
 * HUD-inspired status indicators showing real-time data stream state.
 * Cyan/ice-blue for active, violet for secondary, magenta for AI emphasis,
 * pulse animation for LIVE state, grayed out for OFFLINE.
 */
const Signal: React.FC<SignalProps> = ({
  label,
  status,
  description,
  color = 'cyan',
  pulse = false,
  strength = 1,
  type = 'data',
  className,
}) => {
  const statusColors: Record<string, string> = {
    ONLINE: 'hsl(var(--state-live))',       // Cyan
    OFFLINE: 'hsl(var(--state-offline))',   // Disabled
    PROCESSING: 'hsl(var(--state-syncing))', // Amber
    WARNING: 'hsl(var(--state-degraded))',   // Orange-red
    UNKNOWN: 'hsl(var(--state-stale))',      // Tertiary
    SYNCING: 'hsl(var(--state-syncing))',    // Amber for SYNCING
  };

  const colorMap: Record<string, string> = {
    cyan: 'hsl(var(--primary))',
    violet: 'hsl(var(--intelligence-violet))',
    magenta: 'hsl(var(--intelligence-magenta))',
    amber: 'hsl(var(--amber))',
    emerald: 'hsl(var(--emerald))',
    teal: 'hsl(var(--teal))',
  };

  const iconMap: Record<string, React.ReactNode> = {
    data: <Database className="h-4 w-4" aria-hidden="true" />,
    ai: <Activity className="h-4 w-4" aria-hidden="true" />,
    system: <Cpu className="h-4 w-4" aria-hidden="true" />,
    network: <Wifi className="h-4 w-4" aria-hidden="true" />,
  };

  const dotColor = statusColors[status] || colorMap[color] || 'hsl(var(--text-primary))';
  const isOffline = status === 'OFFLINE';

  const renderStrengthBars = () => {
    const heights = [30, 50, 70, 85, 100];
    return (
      <div className="flex items-end gap-1 h-5" aria-hidden="true" role="img" aria-label={`Signal strength: ${strength} of 5`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={clsx(
              'w-1.5 bg-current rounded-t-sm transition-all duration-300',
              i < strength 
                ? (isOffline ? 'opacity-40' : 'opacity-100') 
                : 'opacity-20'
            )}
            style={{ height: `${heights[i]}%` }}
          />
        ))}
      </div>
    );
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'ONLINE': return 'LIVE';
      case 'OFFLINE': return 'OFFLINE';
      case 'PROCESSING': return 'SYNCING';
      case 'WARNING': return 'WARN';
      case 'UNKNOWN': return 'UNKNOWN';
      default: return status;
    }
  };

  const getTypeText = (type: string): string => {
    switch (type) {
      case 'data': return 'Data stream';
      case 'ai': return 'AI processing';
      case 'system': return 'System status';
      case 'network': return 'Network status';
      default: return 'Signal';
    }
  };

  const IconComponent = iconMap[type] || iconMap.data;

  return (
    <div
      className={clsx(
        'flex items-center justify-between p-4 rounded-lg border border-border',
        'bg-[hsl(var(--background-elevated))] transition-colors duration-200',
        'hover:bg-[hsl(var(--background-accent))] hover:border-primary',
        pulse && 'animate-pulse-soft',
        className
      )}
      title={`${label} • ${getStatusText(status)}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Type icon */}
        <div 
          className={clsx('flex-shrink-0', isOffline ? 'opacity-40' : '')}
          style={{ color: dotColor }}
        >
          {IconComponent}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary truncate">{label}</p>
          {description && <p className="text-xs text-text-secondary truncate">{description}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3 ml-4 flex-shrink-0">
        {renderStrengthBars()}
        <span 
          className={clsx(
            'text-xs font-medium tabular-nums whitespace-nowrap px-2 py-0.5 rounded',
            {
              'bg-[hsl(var(--emerald))]/10 text-[hsl(var(--emerald))]': status === 'ONLINE',
              'bg-[hsl(var(--text-disabled))]/10 text-[hsl(var(--text-disabled))]': status === 'OFFLINE',
              'bg-[hsl(var(--amber))]/10 text-[hsl(var(--amber))]': status === 'PROCESSING' || status === 'SYNCING',
              'bg-[hsl(var(--red))]/10 text-[hsl(var(--red))]': status === 'WARNING',
              'bg-[hsl(var(--text-tertiary))]/10 text-[hsl(var(--text-tertiary))]': status === 'UNKNOWN',
            }
          )}
          aria-label={`Status: ${getStatusText(status)}`}
        >
          {getStatusText(status)}
        </span>
      </div>

      <span className="sr-only">
        {getTypeText(type)} status: {getStatusText(status)}
      </span>
    </div>
  );
};

Signal.displayName = 'Signal';
export { Signal };