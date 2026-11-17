import React from 'react';
import { Shield, AlertCircle, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

export interface AIConfidenceProps {
  /** Confidence value (0-100) */
  value: number;
  /** Label for the confidence metric */
  label: string;
  /** Optional last updated timestamp */
  lastUpdated?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

/**
 * ORBITAL INTELLIGENCE AI Confidence Component
 * 
 * Ring progress bar showing AI model confidence with color-coded thresholds:
 * - Green (>=75): High confidence
 * - Yellow (50-74): Medium confidence  
 * - Red (<50): Low confidence
 * Animates ring fill on mount.
 */
const AIConfidence: React.FC<AIConfidenceProps> = ({
  value,
  label,
  lastUpdated,
  size = 'md',
  className,
}) => {
  // Clamp value to 0-100
  const clampedValue = Math.max(0, Math.min(100, Math.round(value)));
  
  // Determine color based on confidence level
  const getColor = (val: number): { ring: string; bg: string; icon: React.ReactNode; label: string } => {
    if (val >= 75) {
      return {
        ring: 'hsl(var(--emerald))',
        bg: 'hsl(var(--emerald))',
        icon: <CheckCircle className="h-4 w-4 text-[hsl(var(--emerald))]" aria-hidden="true" />,
        label: 'High Confidence',
      };
    }
    if (val >= 50) {
      return {
        ring: 'hsl(var(--amber))',
        bg: 'hsl(var(--amber))',
        icon: <AlertCircle className="h-4 w-4 text-[hsl(var(--amber))]" aria-hidden="true" />,
        label: 'Medium Confidence',
      };
    }
    return {
      ring: 'hsl(var(--red))',
      bg: 'hsl(var(--red))',
      icon: <AlertCircle className="h-4 w-4 text-[hsl(var(--red))]" aria-hidden="true" />,
      label: 'Low Confidence',
    };
  };

  const { ring, bg, icon, label: confidenceLabel } = getColor(clampedValue);

  const sizeConfig = {
    sm: { ringSize: 48, strokeWidth: 4, fontSize: 'text-xl', iconSize: 'h-3 w-3', padding: 'p-2' },
    md: { ringSize: 64, strokeWidth: 5, fontSize: 'text-2xl', iconSize: 'h-4 w-4', padding: 'p-3' },
    lg: { ringSize: 88, strokeWidth: 6, fontSize: 'text-3xl', iconSize: 'h-6 w-6', padding: 'p-4' },
  };

  const config = sizeConfig[size];

  // Calculate stroke dasharray for the ring
  const radius = (config.ringSize - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedValue / 100) * circumference;

  return (
    <div
      className={clsx(
        'inline-flex flex-col items-center gap-2',
        className
      )}
    >
      {/* Ring progress with tooltip */}
      <div className="relative" role="img" aria-label={`${label}: ${clampedValue}% confidence, ${confidenceLabel}`}>
        <svg
          width={config.ringSize}
          height={config.ringSize}
          className="transform -rotate-90"
          style={{ animation: 'fadeIn 0.3s ease-out' }}
        >
          {/* Background track */}
          <circle
            cx={config.ringSize / 2}
            cy={config.ringSize / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={config.strokeWidth}
            className="transition-opacity duration-300"
          />
          {/* Progress ring with animation */}
          <circle
            cx={config.ringSize / 2}
            cy={config.ringSize / 2}
            r={radius}
            fill="none"
            stroke={ring}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
            style={{
              strokeDashoffset: offset,
            }}
          />
        </svg>
        
        {/* Center content */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ pointerEvents: 'none' }}
        >
          <div className="flex flex-col items-center">
            <span className={clsx(config.fontSize, 'font-bold text-text-primary tabular-nums')}>
              {clampedValue}%
            </span>
            <span className="text-xs text-text-tertiary mt-0.5">{label}</span>
          </div>
        </div>

        {/* Confidence indicator icon */}
        <div
          className={clsx(
            'absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2 border-[hsl(var(--background-card))]',
            size === 'sm' && 'h-6 w-6',
            size === 'md' && 'h-8 w-8',
            size === 'lg' && 'h-10 w-10'
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>

      {/* Confidence label */}
      <div className="text-center">
        <p className="text-xs font-medium text-text-secondary">{confidenceLabel}</p>
        {lastUpdated && (
          <p className="text-[10px] text-text-tertiary mt-0.5">Updated {lastUpdated}</p>
        )}
      </div>
    </div>
  );
};

AIConfidence.displayName = 'AIConfidence';
export { AIConfidence };