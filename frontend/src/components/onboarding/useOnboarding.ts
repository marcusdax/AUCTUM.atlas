/**
 * RoofPro CRM — onboarding tour logic.
 *
 * Pure, framework-light helpers (role → 5-step tour, localStorage progress) plus a small
 * `useOnboarding` hook that the tour component drives. Keeping this logic separate from
 * the dialog UI makes it straightforward to unit test with Vitest.
 *
 * Storage contract: `localStorage['roofpro.onboarding.v1']` holds JSON
 * `{ version: 1, completed: true, role, roleGroup, completedAt }`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

export const ONBOARDING_STORAGE_KEY = 'roofpro.onboarding.v1';
export const ONBOARDING_VERSION = 1;
/** Window event emitted by `startOnboarding()` to (re)open the tour. */
export const ONBOARDING_START_EVENT = 'roofpro:onboarding-start';
/** Every role tours exactly five steps. */
export const ONBOARDING_STEP_COUNT = 5;

export type OnboardingRoleGroup = 'owner' | 'sales' | 'field';

export type OnboardingIconName =
  | 'dashboard'
  | 'leads'
  | 'lead'
  | 'calendar'
  | 'estimate'
  | 'reports'
  | 'storm'
  | 'jobs'
  | 'documents';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  /** Sidebar route this step points at. */
  route: string;
  /** Human-readable path hint, e.g. "Leads → New lead". */
  routeLabel: string;
  icon: OnboardingIconName;
  /** Optional coaching tip shown under the description. */
  tip?: string;
}

export interface OnboardingProgress {
  version: number;
  completed: boolean;
  role?: string;
  roleGroup?: OnboardingRoleGroup;
  completedAt?: string;
}

const OWNER_STEPS: OnboardingStep[] = [
  {
    id: 'dashboard',
    title: 'Your operations dashboard',
    description:
      'Start every morning here: pipeline value, crew schedule, weather alerts and storm activity in one view.',
    route: '/dashboard',
    routeLabel: 'Dashboard',
    icon: 'dashboard',
    tip: 'The dashboard refreshes automatically every minute.',
  },
  {
    id: 'pipeline',
    title: 'Work the pipeline',
    description:
      'Leads move from New → Contacted → Inspection → Estimate. Open a lead to log calls, notes and next steps.',
    route: '/leads',
    routeLabel: 'Leads',
    icon: 'leads',
  },
  {
    id: 'calendar',
    title: 'Keep the calendar full',
    description:
      'Book inspections, crew time and follow-ups in one calendar so nobody double-books a roof.',
    route: '/calendar',
    routeLabel: 'Calendar',
    icon: 'calendar',
  },
  {
    id: 'reports',
    title: 'Measure what matters',
    description:
      'Close rate, revenue per job and crew productivity live in Reports — no spreadsheet exports required.',
    route: '/reports',
    routeLabel: 'Reports',
    icon: 'reports',
  },
  {
    id: 'storm-brief',
    title: 'Lead with Storm Intelligence',
    description:
      'After a storm, open Storm Intelligence for the AI brief: affected leads, damage types and the areas to canvass first.',
    route: '/storm-tracking',
    routeLabel: 'Storm Tracking',
    icon: 'storm',
    tip: 'The brief works even when the AI provider is offline — it falls back to the local engine.',
  },
];

const SALES_STEPS: OnboardingStep[] = [
  {
    id: 'dashboard',
    title: 'Start with your day',
    description:
      'Your dashboard shows new leads, upcoming inspections and today’s follow-ups the moment you sign in.',
    route: '/dashboard',
    routeLabel: 'Dashboard',
    icon: 'dashboard',
  },
  {
    id: 'add-lead',
    title: 'Add a lead',
    description:
      'Capture a name, address and phone number in under a minute. RoofPro scores the property against recent storms.',
    route: '/leads/new',
    routeLabel: 'Leads → New lead',
    icon: 'lead',
    tip: 'Adding a street address unlocks storm impact scoring and map pins.',
  },
  {
    id: 'schedule-inspection',
    title: 'Schedule the inspection',
    description:
      'Pick a slot straight from the lead — the inspection appears on your calendar and the homeowner gets a reminder.',
    route: '/calendar',
    routeLabel: 'Calendar',
    icon: 'calendar',
  },
  {
    id: 'create-estimate',
    title: 'Create and send an estimate',
    description:
      'Build line-item estimates with photos, then email a branded PDF from the job in a couple of clicks.',
    route: '/estimates',
    routeLabel: 'Estimates',
    icon: 'estimate',
  },
  {
    id: 'follow-up',
    title: 'Follow up in the pipeline',
    description:
      'Tag leads, set the next action and use the storm hit list to prioritise the homeowners most likely to say yes.',
    route: '/leads',
    routeLabel: 'Leads',
    icon: 'leads',
  },
];

const FIELD_STEPS: OnboardingStep[] = [
  {
    id: 'dashboard',
    title: 'Your field dashboard',
    description:
      'See today’s jobs, weather alerts and storm activity before you leave the shop.',
    route: '/dashboard',
    routeLabel: 'Dashboard',
    icon: 'dashboard',
  },
  {
    id: 'jobs',
    title: 'Open today’s job',
    description:
      'Every job has scope, measurements, photos, documents and the full crew feed so nothing gets lost on the roof.',
    route: '/jobs',
    routeLabel: 'Jobs',
    icon: 'jobs',
  },
  {
    id: 'calendar',
    title: 'Check your schedule',
    description:
      'Your inspections and production days are on the calendar — pull it up on your phone from the truck.',
    route: '/calendar',
    routeLabel: 'Calendar',
    icon: 'calendar',
  },
  {
    id: 'storm-hit-list',
    title: 'Use the storm hit list',
    description:
      'Storm Intelligence shows which properties near you were hit and which leads are hottest right now.',
    route: '/storm-tracking',
    routeLabel: 'Storm Tracking',
    icon: 'storm',
  },
  {
    id: 'documents',
    title: 'Capture photos and documents',
    description:
      'Upload job photos, signed contracts and inspection reports from the field so the office always has the latest.',
    route: '/documents',
    routeLabel: 'Documents',
    icon: 'documents',
  },
];

const STEPS_BY_GROUP: Record<OnboardingRoleGroup, OnboardingStep[]> = {
  owner: OWNER_STEPS,
  sales: SALES_STEPS,
  field: FIELD_STEPS,
};

const ROLE_GROUP_MAP: Record<string, OnboardingRoleGroup> = {
  OWNER: 'owner',
  MANAGER: 'owner',
  OFFICE_ADMIN: 'owner',
  SALES_REP: 'sales',
  FIELD_CREW: 'field',
  PROJECT_MANAGER: 'field',
};

export function normalizeRole(role?: string | null): string {
  return (role ?? '').trim().toUpperCase();
}

/** Map a RoofPro role (OWNER, SALES_REP, FIELD_CREW, …) onto a tour group. */
export function getOnboardingRoleGroup(role?: string | null): OnboardingRoleGroup {
  return ROLE_GROUP_MAP[normalizeRole(role)] ?? 'owner';
}

/** The exact five steps for a role. Unknown/missing roles get the owner/admin tour. */
export function getOnboardingSteps(role?: string | null): OnboardingStep[] {
  return STEPS_BY_GROUP[getOnboardingRoleGroup(role)];
}

export function getOnboardingStepCount(role?: string | null): number {
  return getOnboardingSteps(role).length;
}

export function getOnboardingGroupLabel(roleOrGroup?: string | null): string {
  const group = ROLE_GROUP_MAP[normalizeRole(roleOrGroup)] ?? (roleOrGroup as OnboardingRoleGroup | null) ?? 'owner';
  switch (group) {
    case 'sales':
      return 'Sales tour';
    case 'field':
      return 'Field crew tour';
    default:
      return 'Owner / admin tour';
  }
}

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Read persisted onboarding progress, or null when the user has never seen the tour. */
export function readOnboardingProgress(): OnboardingProgress | null {
  const storage = safeLocalStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return null;

    // Tolerate the simplest possible legacy value: "true".
    if (raw === 'true') return { version: ONBOARDING_VERSION, completed: true };

    const parsed = JSON.parse(raw) as Partial<OnboardingProgress> | null;
    if (!parsed || typeof parsed !== 'object') return null;

    const completed = parsed.completed === true;
    const roleGroup = parsed.roleGroup;

    return {
      version: typeof parsed.version === 'number' ? parsed.version : ONBOARDING_VERSION,
      completed,
      role: typeof parsed.role === 'string' ? parsed.role : undefined,
      roleGroup:
        roleGroup === 'owner' || roleGroup === 'sales' || roleGroup === 'field' ? roleGroup : undefined,
      completedAt: typeof parsed.completedAt === 'string' ? parsed.completedAt : undefined,
    };
  } catch {
    return null;
  }
}

/** True once the user finished or dismissed the tour ("Don't show again"). */
export function hasCompletedOnboarding(): boolean {
  return readOnboardingProgress()?.completed === true;
}

/** Persist that the user does not want to see the tour again. */
export function markOnboardingCompleted(role?: string | null): void {
  const storage = safeLocalStorage();
  if (!storage) return;

  const progress: OnboardingProgress = {
    version: ONBOARDING_VERSION,
    completed: true,
    role: normalizeRole(role) || undefined,
    roleGroup: getOnboardingRoleGroup(role),
    completedAt: new Date().toISOString(),
  };

  try {
    storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be blocked (private mode) or full; the tour just appears again later.
  }
}

/** Clear progress so the tour auto-starts again (used by tests / "replay" flows). */
export function resetOnboardingProgress(): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {
    // Non-fatal.
  }
}

/**
 * First-login detection: only authenticated users who never completed/dismissed the tour
 * are auto-started.
 */
export function shouldAutoStartOnboarding(user?: { role?: string | null } | null): boolean {
  if (!user) return false;
  return !hasCompletedOnboarding();
}

/**
 * Re-open the tour from anywhere (e.g. Settings › "Replay onboarding"). The mounted
 * `OnboardingTour` listens for the window event and resets to step 1.
 */
export function startOnboarding(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(ONBOARDING_START_EVENT));
  } catch {
    // CustomEvent unavailable — nothing we can do, but never throw.
  }
}

export interface UseOnboardingOptions {
  /** Role used to pick the five steps (from `authStore.user.role`). */
  role?: string | null;
  /** Set false while the user is still loading / unauthenticated. */
  enabled?: boolean;
  /** Auto-open on first login when no progress is stored (default true). */
  autoStart?: boolean;
  /** Delay before the first-login tour opens (default 700ms). */
  autoStartDelayMs?: number;
}

export interface CloseOnboardingOptions {
  /** Persist "Don't show again" (default true). */
  remember?: boolean;
}

export interface UseOnboardingResult {
  isOpen: boolean;
  steps: OnboardingStep[];
  step: OnboardingStep | null;
  stepIndex: number;
  stepCount: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  roleGroup: OnboardingRoleGroup;
  groupLabel: string;
  progressLabel: string;
  start: () => void;
  next: () => void;
  back: () => void;
  goTo: (index: number) => void;
  skip: (options?: CloseOnboardingOptions) => void;
  finish: (options?: CloseOnboardingOptions) => void;
  close: (options?: CloseOnboardingOptions) => void;
}

export function useOnboarding(options: UseOnboardingOptions = {}): UseOnboardingResult {
  const { role, enabled = true, autoStart = true, autoStartDelayMs = 700 } = options;

  const steps = useMemo(() => getOnboardingSteps(role), [role]);
  const roleGroup = useMemo(() => getOnboardingRoleGroup(role), [role]);
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // First-login detection: open once per mount when nothing has been persisted.
  useEffect(() => {
    if (!enabled || !autoStart) return;
    if (hasCompletedOnboarding()) return;
    if (typeof window === 'undefined') return;

    const timeout = window.setTimeout(() => {
      setStepIndex(0);
      setIsOpen(true);
    }, Math.max(0, autoStartDelayMs));

    return () => window.clearTimeout(timeout);
  }, [enabled, autoStart, autoStartDelayMs]);

  // Manual replay from anywhere in the app.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStart = () => {
      setStepIndex(0);
      setIsOpen(true);
    };
    window.addEventListener(ONBOARDING_START_EVENT, handleStart);
    return () => window.removeEventListener(ONBOARDING_START_EVENT, handleStart);
  }, []);

  const start = useCallback(() => {
    setStepIndex(0);
    setIsOpen(true);
  }, []);

  const close = useCallback(
    (closeOptions: CloseOnboardingOptions = {}) => {
      if (closeOptions.remember !== false) markOnboardingCompleted(role);
      setIsOpen(false);
      setStepIndex(0);
    },
    [role]
  );

  const next = useCallback(() => {
    setStepIndex((current) => Math.min(current + 1, Math.max(0, steps.length - 1)));
  }, [steps.length]);

  const back = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1));
  }, []);

  const goTo = useCallback(
    (index: number) => {
      setStepIndex(Math.min(Math.max(0, Math.trunc(index)), Math.max(0, steps.length - 1)));
    },
    [steps.length]
  );

  const skip = useCallback(
    (closeOptions?: CloseOnboardingOptions) => close(closeOptions),
    [close]
  );
  const finish = useCallback(
    (closeOptions?: CloseOnboardingOptions) => close(closeOptions),
    [close]
  );

  return {
    isOpen,
    steps,
    step: steps[stepIndex] ?? null,
    stepIndex,
    stepCount: steps.length,
    isFirstStep: stepIndex === 0,
    isLastStep: stepIndex >= steps.length - 1,
    roleGroup,
    groupLabel: getOnboardingGroupLabel(role),
    progressLabel: `Step ${Math.min(stepIndex + 1, steps.length)} of ${steps.length}`,
    start,
    next,
    back,
    goTo,
    skip,
    finish,
    close,
  };
}

export default useOnboarding;
