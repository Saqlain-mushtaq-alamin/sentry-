import { useEffect } from 'react';

/**
 * Temporarily hides the native Electron WebContentsView when React modals,
 * popups, or dropdowns are open, ensuring they are never obscured or cut in half.
 */
export function useHideNativeView(open: boolean): void {
  useEffect(() => {
    if (open) {
      window.sentry?.view?.setHidden?.(true);
      return () => {
        window.sentry?.view?.setHidden?.(false);
      };
    }
  }, [open]);
}
