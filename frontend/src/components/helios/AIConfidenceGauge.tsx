import React, { useEffect, useRef } from 'react';
import clsx from 'clsx';

export interface AIConfidenceGaugeProps {
  value: number;
  label?: string;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  animate?: boolean;
  className?: string;
}

function getConfidenceColor(value: number): string {
  if (value >= 75) return 'hsl(var(--emerald))';
  if (value >= 50) return 'hsl(var(--amber))';
  return 'hsl(var(--red))';
}

function getConfidenceColorClass(value: number): string {
  if (value >= 75) return 'text-[hsl(var(--emerald))]';
  if (value >= 50) return 'text-[hsl(var(--amber))]';
  return 'text-[hsl(var(--red))]';
}

function getTrackColor(): string {
  return 'hsl(var(--border))';
}

export const AIConfidenceGauge: React.FC<AIConfidenceGaugeProps> = ({
  value: rawValue,
  label = 'CONFIDENCE',
  size = 120,
  strokeWidth = 8,
  showLabel = true,
  animate = true,
  className = '',
}) => {
  const svgRef = useRef<SVGCircleElement>(null);
  const [displayValue, setDisplayValue] = React.useState(0);
  const [hasAnimated, setHasAnimated] = React.useState(false);

  const clampedValue = Math.max(0, Math.min(100, rawValue));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedValue / 100) * circumference;
  const color = getConfidenceColor(clampedValue);
  const colorClass = getConfidenceColorClass(clampedValue);

  // Animate on mount
  useEffect(() => {
    if (animate && !hasAnimated) {
      const duration = 1200;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.round(clampedValue * easedProgress));

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setDisplayValue(clampedValue);
          setHasAnimated(true);
        }
      };

      requestAnimationFrame(animate);
    } else if (!animate) {
      setDisplayValue(clampedValue);
      setHasAnimated(true);
    }
  }, [animate, clampedValue, hasAnimated]);

  // Re-animate when value changes significantly
  useEffect(() => {
    if (hasAnimated && animate) {
      setHasAnimated(false);
    }
  }, [clampedValue, animate, hasAnimated]);

  return (
    <div className={clsx('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={getTrackColor()}
            strokeWidth={strokeWidth}
            className="transition-colors duration-300"
          />

          {/* Progress Ring */}
          <circle
            ref={svgRef}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={animate ? circumference - (displayValue / 100) * circumference : offset}
            className={clsx(
              'transition-all duration-1000 ease-out',
              animate ? 'filter drop-shadow(0 0 8px currentColor)' : ''
            )}
            style={{
              filter: animate ? `drop-shadow(0 0 ${size * 0.06}px ${color})` : 'none',
            }}
          />

          {/* Center Percentage */}
          {showLabel && (
            <text
              x={size / 2}
              y={size / 2 + size * 0.08}
              textAnchor="middle"
              dominantBaseline="middle"
              className={clsx(
                'font-mono font-bold transition-all duration-500',
                colorClass,
                `text-[${size * 0.22}px]`
              )}
            >
              {displayValue}%
            </text>
          )}
        </svg>

        {/* Animated Pulse Ring for High Confidence */}
        {animate && clampedValue >= 75 && hasAnimated && (
          <svg width={size + 16} height={size + 16} className="absolute -top-2 -left-2 pointer-events-none">
            <defs>
              <style>{`
                @keyframes pulse-ring {
                  0% {
                    stroke-dashoffset: 0;
                    opacity: 0.5;
                    transform: scale(1);
                  }
                  100% {
                    stroke-dashoffset: -20;
                    opacity: 0;
                    transform: scale(1.15);
                  }
                }
                .pulse-ring-animation {
                  animation: pulse-ring 2s ease-out infinite;
                }
              `}</style>
            </defs>
            <circle
              cx={(size + 16) / 2}
              cy={(size + 16) / 2}
              r={radius + 4}
              fill="none"
              stroke={color}
              strokeWidth={1}
              strokeDasharray="8 12"
              className="pulse-ring-animation opacity-50"
            />
          </svg>
        )}
      </div>

      {label && showLabel && (
        <div className="mt-3 text-center">
          <p className={clsx('text-xs font-semibold uppercase tracking-wider', colorClass)}>
            {label}
          </p>
        </div>
      )}

      {/* Confidence Level Indicator */}
      <div className="mt-2 flex items-center gap-1.5">
        <span
          className={clsx(
            'h-1.5 w-1.5 rounded-full',
            clampedValue >= 75 ? 'bg-[hsl(var(--emerald))]' : '',
            clampedValue >= 50 && clampedValue < 75 ? 'bg-[hsl(var(--amber))]' : '',
            clampedValue < 50 ? 'bg-[hsl(var(--red))]' : ''
          )}
        />
        <span
          className={clsx(
            'text-xs font-medium',
            clampedValue >= 75 ? 'text-[hsl(var(--emerald))]' : '',
            clampedValue >= 50 && clampedValue < 75 ? 'text-[hsl(var(--amber))]' : '',
            clampedValue < 50 ? 'text-[hsl(var(--red))]' : ''
          )}
        >
          {clampedValue >= 75 ? 'High' : clampedValue >= 50 ? 'Medium' : 'Low'}
        </span>
      </div>
    </div>
  );
};

export default AIConfidenceGauge;