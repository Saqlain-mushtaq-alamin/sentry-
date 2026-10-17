import { useEffect, useSyncExternalStore } from 'react';

let holders = 0;
let frame: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useFrozenFrame(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => frame,
  );
}

export function useHideNativeView(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    holders++;
    if (holders === 1) {
      Promise.resolve(window.sentry?.view?.setHidden?.(true)).then((f) => {
        if (holders > 0) {
          frame = typeof f === 'string' ? f : null;
          emit();
        }
      });
    }
    return () => {
      holders--;
      if (holders === 0) {
        window.sentry?.view?.setHidden?.(false);
        frame = null;
        emit();
      }
    };
  }, [open]);
}
