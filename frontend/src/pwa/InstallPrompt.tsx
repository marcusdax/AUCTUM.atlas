import React, { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Download, Smartphone, X } from 'lucide-react';

/** localStorage key remembering that the user dismissed the install card. */
export const INSTALL_DISMISSED_KEY = 'roofpro.install.dismissed';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-background focus-visible:ring-primary';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
}

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** True when the user previously dismissed the install card. */
export function isInstallDismissed(): boolean {
  const storage = safeLocalStorage();
  if (!storage) return false;
  try {
    return storage.getItem(INSTALL_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Persist the dismissal so the card does not nag on future visits. */
export function dismissInstallPrompt(): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(INSTALL_DISMISSED_KEY, 'true');
  } catch {
    // Storage can be full or blocked (private mode) — dismissing is still local-only.
  }
}

/** Allow the install card to appear again (e.g. "Show install prompt" in Settings). */
export function resetInstallPrompt(): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(INSTALL_DISMISSED_KEY);
  } catch {
    // Non-fatal.
  }
}

/** True when the app is already running as an installed/standalone window. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const mediaQuery = window.matchMedia?.('(display-mode: standalone)');
    if (mediaQuery?.matches) return true;
  } catch {
    // matchMedia can be unavailable in older browsers/tests.
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export interface InstallPromptProps {
  /** Additional classes for the positioned wrapper. */
  className?: string;
  /** Delay before showing the card after `beforeinstallprompt` (default 1500ms). */
  showDelayMs?: number;
}

/**
 * Dismissible "install RoofPro" card.
 *
 * Listens for Chromium's `beforeinstallprompt`, defers it and lets the user install from
 * an in-app button. Hidden when the app is already installed, when the browser never
 * fires the event (iOS Safari/desktop Firefox), or when the user dismissed it.
 *
 * Self-contained: mount once, ideally next to the app shell in `Layout`.
 */
export const InstallPrompt: React.FC<InstallPromptProps> = ({ className, showDelayMs = 1500 }) => {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay() || isInstallDismissed()) return;
    if (typeof window === 'undefined') return;

    let timeoutId: number | undefined;

    const handleBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      // Stop the browser's own mini-infobar so we can show our own, dismissible card.
      installEvent.preventDefault?.();
      deferredPrompt.current = installEvent;
      timeoutId = window.setTimeout(() => setVisible(true), Math.max(0, showDelayMs));
    };

    const handleInstalled = () => {
      deferredPrompt.current = null;
      setVisible(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [showDelayMs]);

  const handleDismiss = useCallback(() => {
    dismissInstallPrompt();
    setVisible(false);
    deferredPrompt.current = null;
  }, []);

  const handleInstall = useCallback(async () => {
    const installEvent = deferredPrompt.current;
    if (!installEvent) return;

    setIsInstalling(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome !== 'accepted') dismissInstallPrompt();
    } catch {
      // The prompt can only be used once; hide the card and move on.
    } finally {
      setIsInstalling(false);
      setVisible(false);
      deferredPrompt.current = null;
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="roofpro-install-title"
      aria-describedby="roofpro-install-desc"
      className={clsx(
        'fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-xl border border-border',
        'bg-[hsl(var(--background-elevated))] p-4 shadow-2xl shadow-black/40',
        'pb-[calc(1rem+env(safe-area-inset-bottom))]',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"
          aria-hidden="true"
        >
          <Smartphone size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <h2 id="roofpro-install-title" className="text-sm font-semibold text-text-primary">
            Install RoofPro CRM
          </h2>
          <p id="roofpro-install-desc" className="mt-1 text-sm text-text-secondary">
            Add RoofPro to your home screen for faster access and offline-ready field work.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className={clsx(
            'shrink-0 rounded-lg p-2 text-text-tertiary hover:bg-[hsl(var(--background-accent))]',
            'hover:text-text-primary',
            focusRing
          )}
          aria-label="Dismiss install prompt"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleDismiss}
          className={clsx(
            'inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-text-secondary',
            'hover:bg-[hsl(var(--background-accent))] hover:text-text-primary',
            focusRing
          )}
        >
          Not now
        </button>
        <button
          type="button"
          onClick={handleInstall}
          disabled={isInstalling}
          aria-busy={isInstalling || undefined}
          className={clsx(
            'inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 text-sm',
            'font-semibold text-white shadow-md transition-colors hover:bg-primary-hover',
            'disabled:cursor-not-allowed disabled:opacity-60',
            focusRing
          )}
        >
          <Download size={16} aria-hidden="true" />
          {isInstalling ? 'Installing…' : 'Install'}
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
