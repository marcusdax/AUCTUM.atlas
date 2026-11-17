import { useEffect, useState } from 'react';

/**
 * RoofPro CRM — online/offline status.
 *
 * A tiny, dependency-free hook around `navigator.onLine` + the `online` / `offline`
 * window events. Safe in tests/SSR: always defaults to "online" so we never flash an
 * offline banner for an environment that has no navigator.
 */
export function getOnlineStatus(): boolean {
  if (typeof navigator === 'undefined') return true;
  if (typeof navigator.onLine !== 'boolean') return true;
  return navigator.onLine;
}

/** Subscribe to connection status changes. Returns `true` while the browser is online. */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(getOnlineStatus);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Re-sync once mounted: the page may have gone offline before React hydrated.
    setIsOnline(getOnlineStatus());

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export default useOnlineStatus;
