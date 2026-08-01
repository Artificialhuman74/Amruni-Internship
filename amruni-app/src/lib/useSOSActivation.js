import { useRef } from 'react';
import { useApp } from '../context/AppContext';
import { mapsLink, smsBod, waLink, fireSmsBurst, watchLocation } from './sos';
import { conditionLabel } from '../data/conditions';
import { lifeContext } from './lifeContext';
import { saveAlert } from './sosService';
import { warn } from './haptics';
import { useToast } from '../components/Toast';

export function useSOSActivation() {
  const { state, dispatch } = useApp();
  const stopWatch = useRef(null);
  const toast = useToast();

  /**
   * `test` sends the same message, marked plainly as a drill, and never opens a
   * session or calls the backend alert path. An emergency button nobody has
   * ever pressed is a button nobody trusts — and the first press should not be
   * during the emergency.
   */
  async function activateSOS({ test = false } = {}) {
    const userName = state.user.name || "Someone";
    const contacts = state.sos.contacts || [];
    // What a responder asks for first. Already on her chart; it just wasn't
    // being carried.
    const ctx = lifeContext(state);
    const medical = {
      pregnancy: ctx.isPregnant
        ? { weeks: ctx.weeks, trimester: ctx.trimester }
        : ctx.postpartumLikely ? { recentlyPregnant: true } : null,
      bloodGroup: state.health?.bloodGroup ?? null,
      allergies: state.health?.allergies ?? [],
      conditions: state.health?.conditions ?? [],
    };

    if (!test) {
      // 1. Dispatch activate IMMEDIATELY so the UI reflects the SOS state
      const startedAt = new Date().toISOString();
      dispatch({ type: 'SOS_ACTIVATE', payload: { startedAt, coords: null } });

      // 2. Haptic
      warn();

      // 3. Auto-cancel after 30 minutes
      setTimeout(() => cancelSOS(), 30 * 60 * 1000);
    }

    // Helper to run the rest of the flow with or without coords
    const proceedWithCoords = async (coords) => {
      if (coords && !test) {
        dispatch({ type: 'SOS_UPDATE_COORDS', payload: coords });
        // Start live watch
        stopWatch.current = watchLocation(
          newCoords => dispatch({ type: 'SOS_UPDATE_COORDS', payload: newCoords }),
          err => console.warn('GPS watch error:', err)
        );
      }

      const link = coords ? mapsLink(coords) : 'Location unavailable (No GPS signal)';

      // Fire SMS burst (deep links) - note: might be blocked by mobile popup blockers if not triggered by direct click
      try {
        fireSmsBurst(contacts, smsBod(userName, link, medical, { test }));
        setTimeout(() => window.open(waLink(userName, link, medical, { test }), '_blank'), 600);
      } catch (e) {
        console.warn('Fallback deep-links blocked by browser:', e);
      }

      // A drill stops here: the deep links have already shown her contacts the
      // message. Nothing calls the emergency backend and nothing is recorded as
      // a real alert.
      if (test) {
        toast('Test alert sent. Ask your contacts if it arrived.', { icon: 'check' });
        return;
      }

      // Backend Twilio call
      try {
        await fetch('/api/sos/alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contacts,
            userName,
            // Labels, not ids — the SMS backend has no condition catalogue and
            // would otherwise text a stranger the word "hypothyroid" as "hypothyroid".
            medical: { ...medical, conditions: medical.conditions.map(conditionLabel) },
            lat: coords ? coords.lat : null,
            lng: coords ? coords.lng : null,
          }),
        });
      } catch (e) {
        console.error("Twilio fetch failed", e);
      }

      // Persist alert
      try {
        await saveAlert({
          message: `SOS triggered by ${userName}. Location: ${link}`,
          sentTo: contacts.map(c => c.phone),
        });
      } catch (e) {
        console.error("Save alert failed", e);
      }
    };

    // Try to get location, but don't block the SOS sequence on it.
    //
    // Outside a secure context the browser disables geolocation outright, so
    // an alert sent from a LAN dev address carries no coordinates. That is the
    // single most important thing in this message, so it is named rather than
    // reported as a generic GPS failure.
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      toast('No location: this address is not secure (https). Sending the alert without it.', { icon: 'warning' });
      proceedWithCoords(null);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => proceedWithCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          toast('Could not get precise location (GPS blocked). Sending SOS anyway.', { icon: 'warning' });
          proceedWithCoords(null);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      toast('Geolocation not supported by browser. Sending SOS without GPS.', { icon: 'warning' });
      proceedWithCoords(null);
    }
  }

  function cancelSOS() {
    if (stopWatch.current) { stopWatch.current(); stopWatch.current = null; }
    dispatch({ type: 'SOS_CANCEL' });
    toast('SOS cancelled', { icon: 'check' });
  }

  return { activateSOS, cancelSOS };
}
