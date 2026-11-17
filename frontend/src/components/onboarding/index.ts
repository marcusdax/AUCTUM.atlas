export { OnboardingTour, startOnboarding } from './OnboardingTour';
export type { OnboardingTourProps } from './OnboardingTour';

export {
  useOnboarding,
  getOnboardingSteps,
  getOnboardingStepCount,
  getOnboardingRoleGroup,
  getOnboardingGroupLabel,
  normalizeRole,
  shouldAutoStartOnboarding,
  hasCompletedOnboarding,
  readOnboardingProgress,
  markOnboardingCompleted,
  resetOnboardingProgress,
  ONBOARDING_STORAGE_KEY,
  ONBOARDING_VERSION,
  ONBOARDING_START_EVENT,
  ONBOARDING_STEP_COUNT,
} from './useOnboarding';
export type {
  OnboardingStep,
  OnboardingProgress,
  OnboardingRoleGroup,
  OnboardingIconName,
  UseOnboardingOptions,
  UseOnboardingResult,
  CloseOnboardingOptions,
} from './useOnboarding';
