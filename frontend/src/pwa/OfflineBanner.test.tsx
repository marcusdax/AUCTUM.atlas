import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineBanner } from './OfflineBanner';

function setNavigatorOnline(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

beforeEach(() => {
  setNavigatorOnline(false);
});

afterEach(() => {
  setNavigatorOnline(true);
});

describe('OfflineBanner', () => {
  it('shows the offline message and a retry action while disconnected', () => {
    render(<OfflineBanner />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Offline — showing cached data');
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls a custom retry handler when retry is clicked', () => {
    const onRetry = vi.fn();
    render(<OfflineBanner onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('accepts a custom message', () => {
    render(<OfflineBanner message="No connection — cached jobs only" />);
    expect(screen.getByRole('status')).toHaveTextContent('No connection — cached jobs only');
  });

  it('renders nothing while online', () => {
    setNavigatorOnline(true);
    const { container } = render(<OfflineBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
