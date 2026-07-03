import { useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/Toast';
import { warn } from './haptics';

const API_BASE = 'http://localhost:8000/api/v1/sos';

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
  const sessionIdRef = useRef(null);

  const activateSOS = useCallback(() => {
    const contacts = [...(state.sos?.contacts ?? [])];
    if (!contacts.some(c => c.phone === '112')) {
      contacts.push({ id: '112', name: 'Emergency Services', phone: '112' });
    }
    const userName = state.user?.name ?? '';

    if (!navigator.geolocation) {
      toast('Geolocation is not supported by your browser', { icon: '⚠️' });
      return;
    }

    const triggerFallback = (body, link) => {
      if (contacts.length > 0) {
        fireSmsBurst(contacts, body);
      }
      window.open(link ? waLink(userName, link) : `https://wa.me/?text=${encodeURIComponent(body)}`, '_blank');
    };

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const link = mapsLink(coords);
        const body = smsBod(userName, link);

        try {
          // Try backend first
          const res = await fetch(`${API_BASE}/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userName, contacts, location: coords })
          });
          if (!res.ok) throw new Error('Backend failed');
          const data = await res.json();
          sessionIdRef.current = data.sessionId;
          
          dispatch({ type: 'SOS_ACTIVATE', payload: { startedAt: Date.now(), coords, sessionId: data.sessionId } });
        } catch (err) {
          console.error("SOS API failed, using fallback:", err);
          dispatch({ type: 'SOS_ACTIVATE', payload: { startedAt: Date.now(), coords } });
          triggerFallback(body, link);
        }

        watchCleanup.current = watchLocation(
          (newCoords) => {
            dispatch({ type: 'SOS_UPDATE_COORDS', payload: newCoords });
            if (sessionIdRef.current) {
              fetch(`${API_BASE}/location`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: sessionIdRef.current, location: newCoords })
              }).catch(e => console.error("Location sync failed:", e));
            }
          },
          () => {}
        );
        warn();
      },
      async (err) => {
        const body = smsBod(userName, 'Location unavailable');
        try {
          const res = await fetch(`${API_BASE}/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userName, contacts, location: null })
          });
          if (!res.ok) throw new Error('Backend failed');
          const data = await res.json();
          sessionIdRef.current = data.sessionId;
          
          dispatch({ type: 'SOS_ACTIVATE', payload: { startedAt: Date.now(), coords: null, sessionId: data.sessionId } });
        } catch (backendErr) {
          console.error("SOS API failed, using fallback:", backendErr);
          dispatch({ type: 'SOS_ACTIVATE', payload: { startedAt: Date.now(), coords: null } });
          triggerFallback(body, null);
        }
        toast('Location unavailable — alerts sent without coordinates', { icon: '⚠️' });
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
    if (sessionIdRef.current) {
      fetch(`${API_BASE}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: sessionIdRef.current, 
          userName: state.user?.name ?? '', 
          contacts: state.sos?.contacts ?? [] 
        })
      }).catch(e => console.error("Failed to sync cancellation:", e));
      sessionIdRef.current = null;
    }
    dispatch({ type: 'SOS_CANCEL' });
    toast('SOS cancelled', { icon: '✓' });
  }, [dispatch, toast, state.user?.name, state.sos?.contacts]);

  return { activateSOS, cancelSOS };
}
