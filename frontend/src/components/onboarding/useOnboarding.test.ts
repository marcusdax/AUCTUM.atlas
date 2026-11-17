import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ONBOARDING_START_EVENT,
  ONBOARDING_STORAGE_KEY,
  ONBOARDING_VERSION,
  getOnboardingGroupLabel,
  getOnboardingRoleGroup,
  getOnboardingStepCount,
  getOnboardingSteps,
  hasCompletedOnboarding,
  markOnboardingCompleted,
  readOnboardingProgress,
  resetOnboardingProgress,
  shouldAutoStartOnboarding,
  startOnboarding,
} from './useOnboarding';

const ALL_ROLES = [
  'OWNER',
  'MANAGER',
  'OFFICE_ADMIN',
  'SALES_REP',
  'PROJECT_MANAGER',
  'FIELD_CREW',
];

beforeEach(() => {
  window.localStorage.clear();
});

describe('getOnboardingSteps', () => {
  it('returns exactly five steps for every role (tour is contractually 5 steps)', () => {
    for (const role of ALL_ROLES) {
      expect(getOnboardingSteps(role)).toHaveLength(5);
      expect(getOnboardingStepCount(role)).toBe(5);
    }
  });

  it('gives owners/admins the dashboard → pipeline → calendar → reports → AI storm brief tour', () => {
    const steps = getOnboardingSteps('OWNER');
    expect(steps.map((step) => step.id)).toEqual([
      'dashboard',
      'pipeline',
      'calendar',
      'reports',
      'storm-brief',
    ]);
    expect(steps[0].route).toBe('/dashboard');
    expect(steps[4].route).toBe('/storm-tracking');
    expect(getOnboardingSteps('MANAGER').map((step) => step.id)).toEqual(
      steps.map((step) => step.id)
    );
  });

  it('gives sales reps add lead → schedule inspection → create estimate steps', () => {
    const steps = getOnboardingSteps('SALES_REP');
    expect(steps.map((step) => step.id)).toEqual([
      'dashboard',
      'add-lead',
      'schedule-inspection',
      'create-estimate',
      'follow-up',
    ]);
    expect(steps.map((step) => step.route)).toContain('/leads/new');
    expect(steps.map((step) => step.route)).toContain('/calendar');
    expect(steps.map((step) => step.route)).toContain('/estimates');
  });

  it('normalizes role casing and defaults unknown/missing roles to the owner tour', () => {
    expect(getOnboardingRoleGroup('sales_rep')).toBe('sales');
    expect(getOnboardingSteps('sales_rep').map((step) => step.id)).toEqual(
      getOnboardingSteps('SALES_REP').map((step) => step.id)
    );
    expect(getOnboardingRoleGroup(undefined)).toBe('owner');
    expect(getOnboardingRoleGroup(null)).toBe('owner');
    expect(getOnboardingRoleGroup('UNKNOWN_ROLE')).toBe('owner');
    expect(getOnboardingSteps(null)[0].id).toBe('dashboard');
  });

  it('maps field roles to the field tour', () => {
    expect(getOnboardingRoleGroup('FIELD_CREW')).toBe('field');
    expect(getOnboardingRoleGroup('PROJECT_MANAGER')).toBe('field');
    expect(getOnboardingSteps('FIELD_CREW').map((step) => step.id)).toEqual([
      'dashboard',
      'jobs',
      'calendar',
      'storm-hit-list',
      'documents',
    ]);
  });

  it('exposes unique, complete, routable step content', () => {
    for (const role of ALL_ROLES) {
      const steps = getOnboardingSteps(role);
      expect(new Set(steps.map((step) => step.id)).size).toBe(steps.length);
      for (const step of steps) {
        expect(step.title.trim().length).toBeGreaterThan(0);
        expect(step.description.trim().length).toBeGreaterThan(0);
        expect(step.routeLabel.trim().length).toBeGreaterThan(0);
        expect(step.route.startsWith('/')).toBe(true);
      }
    }
  });

  it('labels each tour group', () => {
    expect(getOnboardingGroupLabel('OWNER')).toBe('Owner / admin tour');
    expect(getOnboardingGroupLabel('SALES_REP')).toBe('Sales tour');
    expect(getOnboardingGroupLabel('FIELD_CREW')).toBe('Field crew tour');
    expect(getOnboardingGroupLabel(null)).toBe('Owner / admin tour');
  });
});

describe('onboarding persistence', () => {
  it('starts incomplete for a brand-new user and auto-starts once authenticated', () => {
    expect(readOnboardingProgress()).toBeNull();
    expect(hasCompletedOnboarding()).toBe(false);
    expect(shouldAutoStartOnboarding({ role: 'SALES_REP' })).toBe(true);
  });

  it('persists completion under roofpro.onboarding.v1 with role metadata', () => {
    markOnboardingCompleted('SALES_REP');

    expect(hasCompletedOnboarding()).toBe(true);
    expect(shouldAutoStartOnboarding({ role: 'SALES_REP' })).toBe(false);

    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw as string);
    expect(parsed.version).toBe(ONBOARDING_VERSION);
    expect(parsed.completed).toBe(true);
    expect(parsed.role).toBe('SALES_REP');
    expect(parsed.roleGroup).toBe('sales');
    expect(typeof parsed.completedAt).toBe('string');
    expect(Number.isNaN(Date.parse(parsed.completedAt))).toBe(false);
  });

  it('never auto-starts without an authenticated user', () => {
    expect(shouldAutoStartOnboarding(null)).toBe(false);
    expect(shouldAutoStartOnboarding(undefined)).toBe(false);
  });

  it('resetOnboardingProgress makes the tour auto-start again (replay)', () => {
    markOnboardingCompleted('OWNER');
    expect(hasCompletedOnboarding()).toBe(true);

    resetOnboardingProgress();
    expect(hasCompletedOnboarding()).toBe(false);
    expect(shouldAutoStartOnboarding({ role: 'OWNER' })).toBe(true);
  });

  it('tolerates legacy "true" values and malformed storage', () => {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    expect(hasCompletedOnboarding()).toBe(true);

    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '{not-json');
    expect(hasCompletedOnboarding()).toBe(false);
    expect(readOnboardingProgress()).toBeNull();

    window.localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({ version: 1, completed: false })
    );
    expect(hasCompletedOnboarding()).toBe(false);
  });
});

describe('startOnboarding', () => {
  it('dispatches a window replay event the mounted tour listens for', () => {
    const listener = vi.fn();
    window.addEventListener(ONBOARDING_START_EVENT, listener);

    startOnboarding();

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(ONBOARDING_START_EVENT, listener);
  });

  it('does not throw when there are no listeners', () => {
    expect(() => startOnboarding()).not.toThrow();
  });
});
