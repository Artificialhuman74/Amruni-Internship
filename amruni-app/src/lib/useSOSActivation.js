import { useRef } from 'react';
import { useApp } from '../context/AppContext';
import { mapsLink, smsBod, waLink, fireSmsBurst, watchLocation } from './sos';
import { saveAlert } from './sosService';
import { warn } from './haptics';
import { useToast } from '../components/Toast';

export function useSOSActivation() {
  const { state, dispatch } = useApp();
  const stopWatch = useRef(null);
  const toast = useToast();

  async function activateSOS() {
    const userName = state.user.name || "Someone";
    const contacts = state.sos.contacts || [];

    // 1. Dispatch activate IMMEDIATELY so the UI reflects the SOS state
    const startedAt = new Date().toISOString();
    dispatch({ type: 'SOS_ACTIVATE', payload: { startedAt, coords: null } });

    // 2. Haptic
    warn();

    // 3. Auto-cancel after 30 minutes
    setTimeout(() => cancelSOS(), 30 * 60 * 1000);

    // Helper to run the rest of the flow with or without coords
    const proceedWithCoords = async (coords) => {
      if (coords) {
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
        fireSmsBurst(contacts, smsBod(userName, link));
        setTimeout(() => window.open(waLink(userName, link), '_blank'), 600);
      } catch (e) {
        console.warn('Fallback deep-links blocked by browser:', e);
      }

      // Backend Twilio call
      try {
        await fetch('/api/sos/alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contacts, 
            userName, 
            lat: coords ? coords.lat : null, 
            lng: coords ? coords.lng : null 
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
        }, state.auth.phone);
      } catch (e) {
        console.error("Save alert failed", e);
      }
    };

    // Try to get location, but don't block the SOS sequence on it
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => proceedWithCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => {
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
