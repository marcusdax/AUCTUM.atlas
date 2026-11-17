import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerServiceWorker, unregisterServiceWorker, SW_URL } from './registerSW';

function stubServiceWorker(container: Record<string, unknown> | undefined): void {
  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: container,
  });
}

afterEach(() => {
  // `delete` restores jsdom's default (no serviceWorker on navigator).
  delete (window.navigator as { serviceWorker?: unknown }).serviceWorker;
});

describe('registerServiceWorker', () => {
  it('never registers the worker outside a production build (dev/test)', async () => {
    const register = vi.fn();
    const unregister = vi.fn().mockResolvedValue(true);
    stubServiceWorker({
      getRegistrations: vi.fn().mockResolvedValue([
        { active: { scriptURL: `${window.location.origin}${SW_URL}` }, unregister },
      ]),
      register,
    });

    expect(import.meta.env.PROD).toBe(false);

    registerServiceWorker();

    // Dev cleanup is fire-and-forget; wait until it has run.
    await vi.waitFor(() => expect(unregister).toHaveBeenCalled());

    expect(register).not.toHaveBeenCalled();
  });

  it('does not throw when service workers are unsupported', () => {
    stubServiceWorker(undefined);
    expect(() => registerServiceWorker()).not.toThrow();
  });
});

describe('unregisterServiceWorker', () => {
  it('unregisters only RoofPro workers', async () => {
    const unregisterRoofPro = vi.fn().mockResolvedValue(true);
    const unregisterOther = vi.fn().mockResolvedValue(true);

    stubServiceWorker({
      getRegistrations: vi.fn().mockResolvedValue([
        {
          active: { scriptURL: `${window.location.origin}${SW_URL}` },
          unregister: unregisterRoofPro,
        },
        {
          active: { scriptURL: `${window.location.origin}/other-sw.js` },
          unregister: unregisterOther,
        },
      ]),
    });

    await unregisterServiceWorker();

    expect(unregisterRoofPro).toHaveBeenCalledTimes(1);
    expect(unregisterOther).not.toHaveBeenCalled();
  });

  it('is a no-op when the browser has no service worker support', async () => {
    stubServiceWorker(undefined);
    await expect(unregisterServiceWorker()).resolves.toBeUndefined();
  });
});
