import React, { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useOnlineStatus } from './useOnlineStatus';

export interface OfflineBannerProps {
  /** Additional classes for the positioned wrapper. */
  className?: string;
  /** Override the offline message. */
  message?: string;
  /** Custom retry implementation; defaults to reloading the page. */
  onRetry?: () => void;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-background focus-visible:ring-primary';

const RECONNECTED_VISIBLE_MS = 4000;

/**
 * Non-blocking connectivity banner. Renders nothing while online (after a short
 * "back online" confirmation), and a single-line retry banner while offline.
 *
 * Self-contained: mount once, ideally next to the app shell in `Layout`.
 */
export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  className,
  message = 'Offline — showing cached data',
  onRetry,
}) => {
  const isOnline = useOnlineStatus();
  const wasOffline = useRef(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      setShowReconnected(false);
      return;
    }

    if (!wasOffline.current) return;
    wasOffline.current = false;
    setShowReconnected(true);
    const timeout = window.setTimeout(() => setShowReconnected(false), RECONNECTED_VISIBLE_MS);
    return () => window.clearTimeout(timeout);
  }, [isOnline]);

  const handleRetry = useCallback(() => {
    if (onRetry) {
      onRetry();
      return;
    }
    if (typeof window !== 'undefined') window.location.reload();
  }, [onRetry]);

  if (isOnline && !showReconnected) return null;

  const reconnected = isOnline;

  return (
    <div
      className={clsx(
        'pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4',
        'pb-[env(safe-area-inset-bottom)]',
        className
      )}
    >
      <div
        role="status"
        aria-live="polite"
        className={clsx(
          'pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border px-4 py-3 shadow-xl',
          reconnected
            ? 'border-emerald/40 bg-[hsl(var(--background-elevated))]'
            : 'border-amber/40 bg-[hsl(var(--background-elevated))]'
        )}
      >
        {reconnected ? (
          <Wifi size={18} aria-hidden="true" className="shrink-0 text-emerald" />
        ) : (
          <WifiOff size={18} aria-hidden="true" className="shrink-0 text-amber" />
        )}

        <p className="min-w-0 flex-1 text-sm font-medium text-text-primary">
          {reconnected ? 'Back online — refreshing data' : message}
        </p>

        {!reconnected && (
          <button
            type="button"
            onClick={handleRetry}
            className={clsx(
              'inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2',
              'text-sm font-medium text-text-primary transition-colors',
              'hover:bg-[hsl(var(--background-accent))]',
              focusRing
            )}
          >
            <RefreshCw size={15} aria-hidden="true" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

export default OfflineBanner;
