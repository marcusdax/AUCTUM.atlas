/**
 * RoofPro CRM — service worker registration.
 *
 * The service worker (`/sw.js`) is hand-written and lives in `public/`, so it ships as-is.
 * It must only be registered for production builds: during `vite dev` a stale worker would
 * serve cached responses and mask HMR updates. In development we therefore unregister any
 * worker left behind by a previous production/preview build instead.
 *
 * Everything is defensive: unsupported browsers, blocked registrations and private-mode
 * failures must never throw into the app.
 */

export const SW_URL = '/sw.js';

/** Fired on `window` when a newer service worker has taken control of the page. */
export const SW_UPDATE_EVENT = 'roofpro:sw-updated';
/** Fired on `window` the first time a service worker finishes installing. */
export const SW_READY_EVENT = 'roofpro:sw-ready';

export interface RegisterServiceWorkerOptions {
  /** Override the worker URL (defaults to `/sw.js`). */
  url?: string;
  /** Worker scope (defaults to `/`). */
  scope?: string;
  /** Called when a new worker version takes control. */
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  /** Called the first time the app becomes controlled by a worker. */
  onReady?: (registration: ServiceWorkerRegistration) => void;
}

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly, like most production PWAs

function isServiceWorkerSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator
  );
}

function dispatchWindowEvent(name: string, detail?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {
    // CustomEvent may be unavailable in exotic environments — never break the app.
  }
}

async function unregisterStaleWorkers(): Promise<void> {
  if (!isServiceWorkerSupported()) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) => {
          const workerUrl =
            registration.active?.scriptURL ??
            registration.waiting?.scriptURL ??
            registration.installing?.scriptURL;
          return Boolean(workerUrl && workerUrl.includes(SW_URL));
        })
        .map((registration) => registration.unregister())
    );
  } catch {
    // Dev-only cleanup, best effort.
  }
}

/**
 * Register the RoofPro service worker. No-op outside production builds, in unsupported
 * browsers, or when the document is not available (SSR/tests).
 */
export function registerServiceWorker(options: RegisterServiceWorkerOptions = {}): void {
  const isProductionBuild = Boolean(import.meta.env && import.meta.env.PROD);

  if (!isProductionBuild) {
    // Clean up a worker that may have been registered by `vite preview` / a prod build
    // on this origin, so development always serves fresh (uncached) code.
    void unregisterStaleWorkers();
    return;
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!isServiceWorkerSupported()) return;

  const workerUrl = options.url ?? SW_URL;
  const scope = options.scope ?? '/';

  const register = () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let registrationRef: ServiceWorkerRegistration | null = null;
    let notifiedUpdate = false;
    let notifiedReady = false;

    const notifyReady = (registration: ServiceWorkerRegistration) => {
      if (notifiedReady || hadController) return;
      notifiedReady = true;
      dispatchWindowEvent(SW_READY_EVENT);
      options.onReady?.(registration);
    };

    const notifyUpdate = (registration: ServiceWorkerRegistration) => {
      if (notifiedUpdate || !hadController) return;
      notifiedUpdate = true;
      dispatchWindowEvent(SW_UPDATE_EVENT);
      options.onUpdate?.(registration);
    };

    try {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (registrationRef && hadController) notifyUpdate(registrationRef);
      });
    } catch {
      // Older implementations may not support addEventListener on the container.
    }

    navigator.serviceWorker
      .register(workerUrl, { scope, updateViaCache: 'none' })
      .then((registration) => {
        registrationRef = registration;

        const watchWorker = (worker: ServiceWorker | null) => {
          if (!worker) return;
          const handleState = () => {
            if (worker.state !== 'installed') return;
            if (hadController) notifyUpdate(registration);
            else notifyReady(registration);
          };
          worker.addEventListener('statechange', handleState);
          handleState();
        };

        watchWorker(registration.installing);
        registration.addEventListener('updatefound', () => watchWorker(registration.installing));

        // A worker can already be waiting if it finished installing between page loads.
        if (registration.waiting && navigator.serviceWorker.controller) {
          try {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          } catch {
            // Non-fatal: the worker will activate on the next navigation.
          }
        }

        const checkForUpdate = () => {
          registration.update().catch(() => {
            // Offline or throttled: try again on the next interval/visibility change.
          });
        };

        const intervalId = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
        // Keep the interval from keeping a test runner alive.
        (intervalId as unknown as { unref?: () => void }).unref?.();

        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate();
        });
      })
      .catch((error: unknown) => {
        // Registration failures (insecure origin, disabled storage, unsupported browser)
        // must never break the app; the CRM keeps working online.
        console.warn('[pwa] Service worker registration failed:', error);
      });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}

/** Unregister every RoofPro worker for this origin (used by tests and troubleshooting). */
export async function unregisterServiceWorker(): Promise<void> {
  await unregisterStaleWorkers();
}
