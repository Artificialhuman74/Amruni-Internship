import { useEffect } from 'react';

/**
 * Marks the document while a full-screen surface is up, so anything floating
 * over the app — the SOS orb, a FAB — can step aside instead of covering the
 * control that surface is asking her to press. Also locks the page behind it.
 *
 * Counted rather than boolean: a sheet opened from inside another sheet must
 * not clear the flag when only the inner one closes.
 */

let depth = 0;
let restoreOverflow = '';

export function useBodyOverlay(active) {
  useEffect(() => {
    if (!active) return undefined;
    if (depth === 0) {
      restoreOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.dataset.overlay = 'true';
    }
    depth += 1;
    return () => {
      depth -= 1;
      if (depth === 0) {
        document.body.style.overflow = restoreOverflow;
        delete document.body.dataset.overlay;
      }
    };
  }, [active]);
}
