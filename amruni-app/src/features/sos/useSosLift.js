import { useEffect } from 'react';

/**
 * Screens with a fixed bottom CTA call this to lift the floating SOS button
 * clear of that bar while they're mounted, so the two never overlap. Resets on
 * unmount. `px` is the height to clear (the CTA bar's footprint).
 */
export function useSosLift(px = 84) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--sos-lift', `${px}px`);
    return () => root.style.removeProperty('--sos-lift');
  }, [px]);
}
