import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { OnboardingTour } from './OnboardingTour';
import { ONBOARDING_STORAGE_KEY, startOnboarding } from './useOnboarding';

beforeEach(() => {
  window.localStorage.clear();
});

describe('OnboardingTour', () => {
  it('opens through startOnboarding() as an accessible modal dialog', async () => {
    render(<OnboardingTour role="SALES_REP" autoStart={false} />);

    act(() => {
      startOnboarding();
    });

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    // Sales tour starts on the dashboard then moves to "Add a lead".
    expect(await screen.findByText('Start with your day')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => expect(screen.getByText('Add a lead')).toBeInTheDocument());
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
    expect(screen.getByText('Leads → New lead')).toBeInTheDocument();
  });

  it('walks sales-specific steps and persists "Don’t show again" on finish', async () => {
    render(<OnboardingTour role="SALES_REP" autoStart={false} />);

    act(() => {
      startOnboarding();
    });
    await screen.findByRole('dialog');

    for (let index = 0; index < 4; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    }

    expect(await screen.findByRole('button', { name: /finish/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /finish/i }));

    await waitFor(() => {
      const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw as string);
      expect(parsed.completed).toBe(true);
      expect(parsed.role).toBe('SALES_REP');
    });
  });

  it('shows the owner/admin storm brief step and allows skip', async () => {
    render(<OnboardingTour role="OWNER" autoStart={false} />);

    act(() => {
      startOnboarding();
    });
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: /go to step 5/i }));

    expect(await screen.findByText('Lead with Storm Intelligence')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /skip tour/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeTruthy();
  });

  it('closes on Escape and remembers the dismissal', async () => {
    render(<OnboardingTour role="FIELD_CREW" autoStart={false} />);

    act(() => {
      startOnboarding();
    });
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeTruthy();
  });
});
