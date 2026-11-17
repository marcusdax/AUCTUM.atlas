import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOnlineStatus, useOnlineStatus } from './useOnlineStatus';

function setNavigatorOnline(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

beforeEach(() => {
  setNavigatorOnline(true);
});

afterEach(() => {
  setNavigatorOnline(true);
});

describe('getOnlineStatus', () => {
  it('reflects navigator.onLine', () => {
    setNavigatorOnline(false);
    expect(getOnlineStatus()).toBe(false);

    setNavigatorOnline(true);
    expect(getOnlineStatus()).toBe(true);
  });
});

describe('useOnlineStatus', () => {
  it('defaults to online', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it('flips to offline on the window offline event and back on online', () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);

    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });

  it('removes its listeners when unmounted', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useOnlineStatus());

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    removeSpy.mockRestore();
  });
});
