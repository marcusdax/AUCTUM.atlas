import React from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, Circle, CircleOff } from 'lucide-react';
import clsx from 'clsx';

export interface StatusProps {
  /** Status value */
  status: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'online' | 'offline' | 'processing' | 'degraded';
  /** Optional text label */
  label?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show as dot only (no label) */
  dotOnly?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Custom status color override */
  color?: string;
}

/**
 * ORBITAL INTELLIGENCE Status Component
 * 
 * Status indicator with colored dot and optional text label.
 * Variants:
 * - success: Emerald green (operational, healthy)
 * - warning: Amber (attention needed)
 * - danger: Red (critical, error)
 * - info: Cyan/blue (informational)
 * - default: Tertiary gray (neutral)
 * - online: Cyan (live/active)
 * - offline: Disabled gray (inactive)
 * - processing: Amber (syncing/working)
 * - degraded: Orange (degraded performance)
 */
const Status: React.FC<StatusProps> = ({
  status,
  label,
  size = 'md',
  dotOnly = false,
  className,
  color,
}) => {
  const statusConfig: Record<string, { 
    dotColor: string; 
    bgColor: string; 
    textColor: string;
    icon: React.ReactNode;
    label: string;
  }> = {
    success: {
      dotColor: 'hsl(var(--emerald))',
      bgColor: 'hsl(var(--emerald))',
      textColor: 'hsl(var(--emerald))',
      icon: <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />,
      label: 'Operational',
    },
    warning: {
      dotColor: 'hsl(var(--amber))',
      bgColor: 'hsl(var(--amber))',
      textColor: 'hsl(var(--amber))',
      icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
      label: 'Warning',
    },
    danger: {
      dotColor: 'hsl(var(--red))',
      bgColor: 'hsl(var(--red))',
      textColor: 'hsl(var(--red))',
      icon: <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />,
      label: 'Critical',
    },
    info: {
      dotColor: 'hsl(var(--primary))',
      bgColor: 'hsl(var(--primary))',
      textColor: 'hsl(var(--primary))',
      icon: <Info className="h-3.5 w-3.5" aria-hidden="true" />,
      label: 'Info',
    },
    default: {
      dotColor: 'hsl(var(--text-tertiary))',
      bgColor: 'hsl(var(--text-tertiary))',
      textColor: 'hsl(var(--text-tertiary))',
      icon: <Circle className="h-3.5 w-3.5" aria-hidden="true" />,
      label: 'Unknown',
    },
    online: {
      dotColor: 'hsl(var(--state-live))',
      bgColor: 'hsl(var(--state-live))',
      textColor: 'hsl(var(--state-live))',
      icon: <Circle className="h-3.5 w-3.5" aria-hidden="true" />,
      label: 'Online',
    },
    offline: {
      dotColor: 'hsl(var(--state-offline))',
      bgColor: 'hsl(var(--state-offline))',
      textColor: 'hsl(var(--text-disabled))',
      icon: <CircleOff className="h-3.5 w-3.5" aria-hidden="true" />,
      label: 'Offline',
    },
    processing: {
      dotColor: 'hsl(var(--state-syncing))',
      bgColor: 'hsl(var(--state-syncing))',
      textColor: 'hsl(var(--state-syncing))',
      icon: <Circle className="h-3.5 w-3.5 animate-pulse-soft" aria-hidden="true" />,
      label: 'Processing',
    },
    degraded: {
      dotColor: 'hsl(var(--state-degraded))',
      bgColor: 'hsl(var(--state-degraded))',
      textColor: 'hsl(var(--state-degraded))',
      icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
      label: 'Degraded',
    },
  };

  const config = statusConfig[status] || statusConfig.default;
  const dotColor = color || config.dotColor;
  const textColor = color || config.textColor;

  const sizeClasses = {
    sm: { dot: 'h-1.5 w-1.5', icon: 'h-3 w-3', text: 'text-xs', gap: 'gap-1.5' },
    md: { dot: 'h-2.5 w-2.5', icon: 'h-4 w-4', text: 'text-sm', gap: 'gap-2' },
    lg: { dot: 'h-3 w-3', icon: 'h-5 w-5', text: 'text-base', gap: 'gap-2.5' },
  };

  const sizes = sizeClasses[size];

  if (dotOnly) {
    return (
      <span
        className={clsx(
          'inline-flex items-center',
          className
        )}
        role="status"
        aria-label={label || config.label}
      >
        <span
          className={clsx(
            'rounded-full flex-shrink-0',
            sizes.dot,
            color ? `bg-[${color}]` : `bg-[${dotColor}]`
          )}
          aria-hidden="true"
        />
        <span className="sr-only">{label || config.label}</span>
      </span>
    );
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center',
        sizes.gap,
        className
      )}
      role="status"
      aria-label={label || config.label}
    >
      <span
        className={clsx(
          'rounded-full flex-shrink-0 relative',
          sizes.dot,
          `bg-[${dotColor}]`
        )}
        aria-hidden="true"
      >
        {status === 'processing' && (
          <span className="absolute inset-0 rounded-full bg-current opacity-75 animate-ping" aria-hidden="true" />
        )}
      </span>
      {label && (
        <span className={clsx('font-medium', sizes.text, `text-[${textColor}]`)}>
          {label}
        </span>
      )}
    </span>
  );
};

/**
 * StatusDot - standalone dot component for inline use
 */
export interface StatusDotProps {
  /** Status value */
  status: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'online' | 'offline' | 'processing' | 'degraded';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Pulse animation */
  pulse?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Custom color override */
  color?: string;
}

const StatusDot: React.FC<StatusDotProps> = ({
  status,
  size = 'md',
  pulse = false,
  className,
  color,
}) => {
  const statusColors: Record<string, string> = {
    success: 'hsl(var(--emerald))',
    warning: 'hsl(var(--amber))',
    danger: 'hsl(var(--red))',
    info: 'hsl(var(--primary))',
    default: 'hsl(var(--text-tertiary))',
    online: 'hsl(var(--state-live))',
    offline: 'hsl(var(--state-offline))',
    processing: 'hsl(var(--state-syncing))',
    degraded: 'hsl(var(--state-degraded))',
  };

  const dotColor = color || statusColors[status] || statusColors.default;

  const sizeClasses = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  };

  return (
    <span
      className={clsx(
        'inline-block rounded-full flex-shrink-0',
        sizeClasses[size],
        `bg-[${dotColor}]`,
        pulse && 'animate-pulse-soft',
        className
      )}
      role="presentation"
      aria-hidden="true"
    />
  );
};

Status.displayName = 'Status';
StatusDot.displayName = 'StatusDot';
export type { Status as StatusType };
export { Status, StatusDot };