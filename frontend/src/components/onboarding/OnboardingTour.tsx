/**
 * RoofPro CRM — guided onboarding tour.
 *
 * An accessible 5-step coach-mark dialog (Radix Dialog primitives provide the focus trap,
 * Escape-to-close and focus restoration). Steps are role-specific and tracked in
 * `localStorage['roofpro.onboarding.v1']`.
 *
 * Mount once in the app shell (Layout). Replay from anywhere:
 *   import { startOnboarding } from '@/components/onboarding/OnboardingTour';
 *   startOnboarding();
 */
import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Briefcase,
  Calculator,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Radar,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from '../ui';
import { startOnboarding, useOnboarding } from './useOnboarding';
import type { OnboardingIconName } from './useOnboarding';

export { startOnboarding };

const STEP_ICONS: Record<OnboardingIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  leads: Users,
  lead: UserPlus,
  calendar: CalendarDays,
  estimate: Calculator,
  reports: BarChart3,
  storm: Radar,
  jobs: Briefcase,
  documents: FileText,
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-background focus-visible:ring-primary';

export interface OnboardingTourProps {
  /** Override the role (defaults to the authenticated user's role). */
  role?: string | null;
  /** Set false to keep the tour closed (e.g. before auth finishes loading). */
  enabled?: boolean;
  /** Auto-open on first login when no progress is stored. Default true. */
  autoStart?: boolean;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  role,
  enabled,
  autoStart = true,
}) => {
  const user = useAuthStore((state) => state.user);
  const activeRole = role ?? user?.role ?? null;

  const {
    isOpen,
    steps,
    step,
    stepIndex,
    isFirstStep,
    isLastStep,
    groupLabel,
    progressLabel,
    back,
    next,
    goTo,
    close,
    finish,
    skip,
  } = useOnboarding({
    role: activeRole,
    enabled: enabled ?? Boolean(user),
    autoStart,
  });

  // "Don't show again" defaults to checked; reset whenever the tour re-opens.
  const [remember, setRemember] = useState(true);
  useEffect(() => {
    if (isOpen) setRemember(true);
  }, [isOpen]);

  const handleOpenChange = (open: boolean) => {
    if (!open) close({ remember });
  };

  if (!step) return null;

  const StepIcon = STEP_ICONS[step.icon] ?? LayoutDashboard;

  return (
    <Modal open={isOpen} onOpenChange={handleOpenChange}>
      <ModalContent size="lg" className="max-w-xl" aria-modal="true">
        <ModalHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              <Sparkles size={12} aria-hidden="true" />
              {groupLabel}
            </span>
            <span className="rounded-full bg-[hsl(var(--background-accent))] px-2.5 py-1 text-xs font-medium text-text-secondary">
              {progressLabel}
            </span>
          </div>
          <ModalTitle id="onboarding-title" className="flex items-center gap-2">
            <StepIcon size={20} className="shrink-0 text-primary" aria-hidden="true" />
            {step.title}
          </ModalTitle>
          <ModalDescription id="onboarding-description">{step.description}</ModalDescription>
        </ModalHeader>

        <div className="px-6 py-4">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-[hsl(var(--background-elevated))] px-3 py-2.5">
            <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
              Where to find it
            </span>
            <span className="text-sm font-semibold text-text-primary">{step.routeLabel}</span>
          </div>

          {step.tip && (
            <p className="mt-3 text-sm text-text-tertiary">
              <span className="font-semibold text-text-secondary">Tip: </span>
              {step.tip}
            </p>
          )}

          {/* Step dots: keyboard reachable, current step announced via aria-current. */}
          <div className="mt-5 flex items-center justify-center gap-2" aria-label="Tour progress">
            <div className="flex items-center gap-2" role="group" aria-label="Tour steps">
              {steps.map((tourStep, index) => {
                const isCurrent = index === stepIndex;
                const isDone = index < stepIndex;
                return (
                  <button
                    key={tourStep.id}
                    type="button"
                    onClick={() => goTo(index)}
                    aria-label={`Go to step ${index + 1}: ${tourStep.title}`}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={clsx(
                      'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                      isCurrent
                        ? 'border-primary bg-primary text-white'
                        : isDone
                          ? 'border-primary/40 bg-primary/15 text-primary'
                          : 'border-border bg-transparent text-text-tertiary hover:border-border-hover',
                      focusRing
                    )}
                  >
                    {isDone ? <Check size={13} aria-hidden="true" /> : index + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <input
              id="onboarding-remember"
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className={clsx(
                'h-4 w-4 rounded border-border bg-[hsl(var(--background))] text-primary',
                focusRing
              )}
            />
            <label htmlFor="onboarding-remember" className="text-sm text-text-secondary">
              Don&apos;t show again
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={() => skip({ remember })}
            className={clsx(
              'inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-text-tertiary',
              'hover:bg-[hsl(var(--background-accent))] hover:text-text-primary',
              focusRing
            )}
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={back}
              disabled={isFirstStep}
              className={clsx(
                'inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-border px-4 text-sm',
                'font-medium text-text-primary transition-colors hover:bg-[hsl(var(--background-accent))]',
                'disabled:cursor-not-allowed disabled:opacity-50',
                focusRing
              )}
            >
              <ChevronLeft size={16} aria-hidden="true" />
              Back
            </button>

            <button
              type="button"
              onClick={() => (isLastStep ? finish({ remember }) : next())}
              className={clsx(
                'inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-primary px-4 text-sm font-semibold',
                'text-white shadow-md transition-colors hover:bg-primary-hover',
                focusRing
              )}
            >
              {isLastStep ? 'Finish' : 'Next'}
              {isLastStep ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <ChevronRight size={16} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
};

export default OnboardingTour;
