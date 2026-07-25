import { useState } from 'react';
import { useApp } from '../context/AppContext';

/**
 * Guards the moment a user flips community anonymity OFF (about to post as
 * themselves instead of their anon handle) — the one moment someone could
 * accidentally de-anonymize themselves in a thread where they'd been posting
 * anonymously. Shows a warning sheet exactly twice, ever, per account
 * (settings.identityWarningSeen, synced like every other setting).
 *
 * Dev mode shows it every time, uncapped, for QA convenience — this override
 * must be reverted before production (see PRODUCTION_CHECKLIST.md).
 */
export function useIdentityWarning() {
  const { state, dispatch } = useApp();
  const [pending, setPending] = useState(null); // () => void, run once confirmed

  const seen = state.settings.identityWarningSeen || 0;
  const cap = import.meta.env.DEV ? Infinity : 2;

  function guardToggleOff(proceed) {
    if (seen < cap) {
      setPending(() => proceed);
    } else {
      proceed();
    }
  }

  function confirm() {
    dispatch({ type: 'SET_SETTINGS', payload: { identityWarningSeen: seen + 1 } });
    pending?.();
    setPending(null);
  }

  function cancel() {
    setPending(null);
  }

  return { open: !!pending, guardToggleOff, confirm, cancel };
}
