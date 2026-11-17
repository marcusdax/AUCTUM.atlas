/**
 * Shared presentational primitives for the AI Storm Intelligence panels.
 * All colours come from design tokens (no raw hex), every state has text +
 * iconography so colour is never the only signal.
 */
import React from 'react';
import clsx from 'clsx';
import { AlertTriangle, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { Badge, type BadgeVariant } from '../ui/Card';
import Button from '../ui/Button';
import type { AISource } from '../../types/ai';
import { aiSourceLabel, riskBand, type RiskTone } from './aiUtils';

// ─────────────────────────── Tone maps (design tokens) ───────────────────────────

export const TONE_BADGE: Record<RiskTone, BadgeVariant> = {
  extreme: 'extreme',
  severe: 'severe',
  moderate: 'moderate',
  minor: 'minor',
  none: 'default',
};

/** Inline SVG stroke value — CSS variables work inside inline style, not attributes. */
export const TONE_STROKE: Record<RiskTone, string> = {
  extreme: 'hsl(var(--severity-extreme))',
  severe: 'hsl(var(--severity-severe))',
  moderate: 'hsl(var(--severity-moderate))',
  minor: 'hsl(var(--severity-minor))',
  none: 'hsl(var(--text-tertiary))',
};

export const TONE_BAR: Record<RiskTone, string> = {
  extreme: 'bg-severity-extreme',
  severe: 'bg-severity-severe',
  moderate: 'bg-severity-moderate',
  minor: 'bg-severity-minor',
  none: 'bg-text-tertiary',
};

// ─────────────────────────── Source badge ───────────────────────────

export interface SourceBadgeProps {
  source?: AISource | string;
  model?: string | null;
  fallback?: boolean;
  className?: string;
}

/** `AI · <model>` when a provider answered, `Offline engine` when the heuristic did. */
export const SourceBadge: React.FC<SourceBadgeProps> = ({ source, model, fallback, className }) => {
  const offline = fallback || source === 'heuristic' || !source;
  return (
    <Badge variant={offline ? 'warning' : 'success'} size="sm" className={className}>
      <span className="inline-flex items-center gap-1">
        {offline ? <WifiOff size={12} aria-hidden="true" /> : <ShieldCheck size={12} aria-hidden="true" />}
        {aiSourceLabel(source, model, fallback)}
      </span>
    </Badge>
  );
};

// ─────────────────────────── Risk gauge ───────────────────────────

export interface RiskGaugeProps {
  score: number;
  label?: string;
  caption?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Circular risk gauge. The score is always rendered as a number AND a text
 * label (e.g. "78 / 100 — Severe risk") so it is readable without colour.
 */
export const RiskGauge: React.FC<RiskGaugeProps> = ({
  score,
  label,
  caption,
  size = 'md',
  className,
}) => {
  const band = riskBand(score);
  const displayLabel = label ?? band.label;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dash = (band.score / 100) * circumference;
  const dimension = size === 'sm' ? 'h-20 w-20' : 'h-28 w-28';

  return (
    <div className={clsx('flex flex-col items-center gap-1', className)}>
      <div
        className={clsx('relative', dimension)}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={band.score}
        aria-label={`Storm risk ${band.score} out of 100 — ${displayLabel}`}
      >
        <svg viewBox="0 0 96 96" className={clsx('h-full w-full -rotate-90')} aria-hidden="true">
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            strokeWidth="8"
            style={{ stroke: 'hsl(var(--border))' }}
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ stroke: TONE_STROKE[band.tone] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={clsx(
              'font-bold leading-none text-text-primary',
              size === 'sm' ? 'text-xl' : 'text-3xl'
            )}
          >
            {band.score}
          </span>
          <span className="text-[0.625rem] font-medium uppercase tracking-wide text-text-tertiary">
            / 100
          </span>
        </div>
      </div>
      <p className="text-center text-xs font-semibold text-text-secondary">
        {displayLabel}
        {caption ? ` · ${caption}` : ''}
      </p>
    </div>
  );
};

// ─────────────────────────── Loading skeletons ───────────────────────────

export const SkeletonBlock: React.FC<{ className?: string }> = ({ className }) => (
  <div className={clsx('animate-pulse rounded-lg bg-[hsl(var(--background-accent))]', className)} />
);

export interface SkeletonLinesProps {
  rows?: number;
  label?: string;
  className?: string;
}

export const SkeletonLines: React.FC<SkeletonLinesProps> = ({
  rows = 3,
  label = 'Loading AI insight…',
  className,
}) => (
  <div className={clsx('space-y-2', className)} role="status" aria-busy="true" aria-label={label}>
    <span className="sr-only">{label}</span>
    {Array.from({ length: rows }).map((_, index) => (
      <SkeletonBlock
        key={index}
        className={clsx('h-4', index === rows - 1 ? 'w-2/3' : 'w-full')}
      />
    ))}
  </div>
);

// ─────────────────────────── Error / offline states ───────────────────────────

export interface PanelErrorProps {
  message: string;
  offline?: boolean;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}

/** Inline error with retry — used by every AI panel so failures never crash a page. */
export const PanelError: React.FC<PanelErrorProps> = ({
  message,
  offline,
  onRetry,
  isRetrying,
  className,
}) => (
  <div
    role="alert"
    className={clsx(
      'rounded-lg border border-border bg-[hsl(var(--background-accent))]/60 p-3 text-sm text-text-secondary',
      className
    )}
  >
    <div className="flex items-start gap-2">
      {offline ? (
        <WifiOff size={16} className="mt-0.5 shrink-0 text-amber" aria-hidden="true" />
      ) : (
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red" aria-hidden="true" />
      )}
      <div className="flex-1">
        <p className="font-medium text-text-primary">{offline ? 'AI offline' : 'Could not load AI insight'}</p>
        <p className="mt-1 text-xs text-text-tertiary">{message}</p>
        {onRetry && (
          <Button
            variant="secondary"
            size="sm"
            className="mt-3 min-h-11"
            leftIcon={<RefreshCw size={14} />}
            onClick={onRetry}
            isLoading={isRetrying}
            aria-label="Retry AI request"
          >
            Retry
          </Button>
        )}
      </div>
    </div>
  </div>
);

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** Neutral, informative empty state (never a blank or crashing panel). */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className,
}) => (
  <div
    className={clsx(
      'flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-center',
      className
    )}
  >
    {icon && (
      <span className="text-text-tertiary" aria-hidden="true">
        {icon}
      </span>
    )}
    <p className="text-sm font-medium text-text-primary">{title}</p>
    <p className="max-w-prose text-xs text-text-tertiary">{description}</p>
    {action}
  </div>
);
