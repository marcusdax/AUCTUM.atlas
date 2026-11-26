/**
 * Small presentational states shared by the QC + Passport panels.
 * Kept local to the passport feature so the panels stay self-contained; all
 * colours come from the AUCTUM design tokens (parchment / ink / oxblood).
 */
import React from 'react';
import clsx from 'clsx';
import { AlertTriangle, Info, RefreshCw, ShieldCheck } from 'lucide-react';
import Button from '../ui/Button';

// ─────────────────────────── Loading ───────────────────────────

export const SkeletonLines: React.FC<{ rows?: number; label?: string; className?: string }> = ({
  rows = 3,
  label = 'Loading…',
  className,
}) => (
  <div className={clsx('space-y-2', className)} role="status" aria-busy="true" aria-label={label}>
    <span className="visually-hidden">{label}</span>
    {Array.from({ length: rows }).map((_, index) => (
      <div
        key={index}
        className={clsx(
          'h-4 animate-pulse bg-[hsl(var(--background-accent))]',
          index === rows - 1 ? 'w-2/3' : 'w-full'
        )}
      />
    ))}
  </div>
);

// ─────────────────────────── Error / notices ───────────────────────────

export interface PassportErrorProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}

/** Retryable inline error — never a blank panel. */
export const PassportError: React.FC<PassportErrorProps> = ({
  title = 'Could not load this section',
  message,
  onRetry,
  isRetrying,
  className,
}) => (
  <div
    role="alert"
    className={clsx(
      'border-l-2 border-[hsl(var(--red))] bg-[hsl(var(--red))]/10 px-4 py-3',
      className
    )}
  >
    <div className="flex items-start gap-2">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <p className="mt-1 text-sm text-text-secondary">{message}</p>
        {onRetry && (
          <Button
            variant="secondary"
            size="md"
            className="mt-3 min-h-11"
            leftIcon={<RefreshCw size={14} />}
            onClick={onRetry}
            isLoading={isRetrying}
            aria-label="Retry loading this section"
          >
            Retry
          </Button>
        )}
      </div>
    </div>
  </div>
);

export interface PassportNoticeProps {
  title: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'info' | 'warning';
  className?: string;
}

/** Non-fatal informational state (e.g. backend route returns 501). */
export const PassportNotice: React.FC<PassportNoticeProps> = ({
  title,
  children,
  icon,
  action,
  tone = 'info',
  className,
}) => (
  <div
    role="status"
    className={clsx(
      'border px-4 py-3',
      tone === 'warning'
        ? 'border-[hsl(var(--amber))]/40 bg-[hsl(var(--amber))]/10'
        : 'border-border bg-[hsl(var(--background-elevated))]',
      className
    )}
  >
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {icon ?? (
          <Info
            size={16}
            className={tone === 'warning' ? 'text-amber' : 'text-text-tertiary'}
          />
        )}
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        {children && <div className="mt-1 text-sm text-text-secondary">{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  </div>
);

// ─────────────────────────── Empty ───────────────────────────

export interface PassportEmptyProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const PassportEmpty: React.FC<PassportEmptyProps> = ({
  title,
  description,
  icon,
  action,
  className,
}) => (
  <div
    className={clsx(
      'flex flex-col items-center gap-2 border border-dashed border-border px-4 py-8 text-center',
      className
    )}
  >
    <span className="text-text-tertiary" aria-hidden="true">
      {icon ?? <ShieldCheck size={26} />}
    </span>
    <p className="text-sm font-semibold text-text-primary">{title}</p>
    <p className="max-w-prose text-sm text-text-secondary">{description}</p>
    {action}
  </div>
);
