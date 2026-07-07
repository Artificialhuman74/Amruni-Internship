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
    // 1. Get initial position
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const userName = state.user.name;
      const contacts = state.sos.contacts;

      // 2. Dispatch activate
      dispatch({ type: 'SOS_ACTIVATE', payload: { startedAt: new Date().toISOString(), coords } });

      // 3. Haptic
      warn();

      // 4. Start live watch — update coords every position change
      stopWatch.current = watchLocation(
        newCoords => dispatch({ type: 'SOS_UPDATE_COORDS', payload: newCoords }),
        err => console.warn('GPS watch error:', err)
      );

      // 5. Fire SMS burst (deep links)
      const link = mapsLink(coords);
      fireSmsBurst(contacts, smsBod(userName, link));

      // 6. WhatsApp alert (open in new tab, small delay to not block SMS)
      setTimeout(() => window.open(waLink(userName, link), '_blank'), 600);

      // 7. Backend Twilio call (if server.js is running)
      try {
        await fetch('/api/sos/alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts, userName, lat: coords.lat, lng: coords.lng }),
        });
      } catch {
        // Non-fatal: deep links already fired
      }

      // 8. Persist alert to Firestore
      try {
        await saveAlert({
          message: \`SOS triggered by \${userName}. Location: \${link}\`,
          sentTo: contacts.map(c => c.phone),
        }, state.auth.phone);
      } catch {
        // Non-fatal
      }

      // 9. Auto-cancel after 30 minutes
      setTimeout(() => cancelSOS(), 30 * 60 * 1000);
    },
    () => {
      toast('Could not get your location. Please enable GPS.', { icon: '⚠️' });
    },
    { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function cancelSOS() {
    if (stopWatch.current) { stopWatch.current(); stopWatch.current = null; }
    dispatch({ type: 'SOS_CANCEL' });
    toast('SOS cancelled', { icon: '✓' });
  }

  return { activateSOS, cancelSOS };
}
