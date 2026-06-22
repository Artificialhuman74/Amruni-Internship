// Subtle haptic feedback for meaningful confirmations.
// Treated as a sensory effect: suppressed when the user prefers reduced motion,
// and silently a no-op on devices without a vibration motor (most desktops).
function reducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

export function haptic(pattern = 12) {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  if (reducedMotion()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* vibration not permitted — ignore */
  }
}

// Named intents so call sites read as feedback, not magic numbers.
export const tap = () => haptic(10);
export const confirm = () => haptic([14, 40, 22]); // a soft two-beat "done"
export const warn = () => haptic([0, 30, 60, 30]); // emergency acknowledge
