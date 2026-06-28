import { useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/Toast';
import { warn } from './haptics';

// ── Link builders ─────────────────────────────────────────────

/** Google Maps link for given coordinates */
export function mapsLink({ lat, lng }) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

/** SMS message body */
export function smsBod(userName, link) {
  return `URGENT: ${userName || 'Someone'} needs help. Live location: ${link}. Please call or reach them immediately.`;
}

/** WhatsApp deep link with pre-composed message */
export function waLink(userName, link) {
  const msg = smsBod(userName, link);
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

// ── SMS burst ─────────────────────────────────────────────────

/** Open sms: URIs for each emergency contact */
export function fireSmsBurst(contacts, body) {
  contacts.forEach(({ phone }) => {
    const a = document.createElement('a');
    a.href = `sms:${phone}?body=${encodeURIComponent(body)}`;
    a.click();
  });
}

// ── Geolocation ───────────────────────────────────────────────

/** Start watching position and return a cleanup fn */
export function watchLocation(onUpdate, onError) {
  if (!navigator.geolocation) {
    onError('Geolocation not supported');
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    (err) => onError(err.message),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

// ── Hook ──────────────────────────────────────────────────────

/**
 * Returns { activateSOS, cancelSOS }.
 *
 * activateSOS():
 *   1. Get current position → dispatch SOS_ACTIVATE
 *   2. Start watchLocation → dispatch SOS_UPDATE_COORDS on each update
 *   3. Fire SMS burst to all emergency contacts
 *   4. Open WhatsApp deep link in new tab
 *   5. Haptic warn() pattern
 *
 * cancelSOS():
 *   1. Stop location watch
 *   2. Dispatch SOS_CANCEL
 *   3. Toast confirmation
 */
export function useSOSActivation() {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const watchCleanup = useRef(null);

  const activateSOS = useCallback(() => {
    const contacts = state.sos?.contacts ?? [];
    const userName = state.user?.name ?? '';

    // Get initial position, then activate
    if (!navigator.geolocation) {
      toast('Geolocation is not supported by your browser', { icon: '⚠️' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };

        // Dispatch activation
        dispatch({ type: 'SOS_ACTIVATE', payload: { startedAt: Date.now(), coords } });

        // Start watching for updates
        watchCleanup.current = watchLocation(
          (newCoords) => dispatch({ type: 'SOS_UPDATE_COORDS', payload: newCoords }),
          () => { /* silently ignore watch errors after activation */ },
        );

        // Build message with current coords
        const link = mapsLink(coords);
        const body = smsBod(userName, link);

        // Fire SMS burst
        if (contacts.length > 0) {
          fireSmsBurst(contacts, body);
        }

        // Open WhatsApp
        window.open(waLink(userName, link), '_blank');

        // Haptic feedback
        warn();
      },
      (err) => {
        // Fallback: activate without coords
        dispatch({ type: 'SOS_ACTIVATE', payload: { startedAt: Date.now(), coords: null } });
        toast('Location unavailable — alerts sent without coordinates', { icon: '⚠️' });

        // Still fire SMS/WA without location
        const body = smsBod(userName, 'Location unavailable');
        if (contacts.length > 0) {
          fireSmsBurst(contacts, body);
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(body)}`, '_blank');
        warn();
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [state.sos?.contacts, state.user?.name, dispatch, toast]);

  const cancelSOS = useCallback(() => {
    if (watchCleanup.current) {
      watchCleanup.current();
      watchCleanup.current = null;
    }
    dispatch({ type: 'SOS_CANCEL' });
    toast('SOS cancelled', { icon: '✓' });
  }, [dispatch, toast]);

  return { activateSOS, cancelSOS };
}
