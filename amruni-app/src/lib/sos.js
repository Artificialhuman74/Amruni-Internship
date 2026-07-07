export function mapsLink({ lat, lng }) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

export function smsBod(userName, link) {
  return `🚨 URGENT: ${userName || 'Someone you know'} has sent an SOS alert.\nLive location: ${link}\nPlease respond immediately.`;
}

export function waLink(userName, link) {
  return `https://wa.me/?text=${encodeURIComponent(smsBod(userName, link))}`;
}

// Deep-link SMS to each contact (browser-only fallback, no backend)
export function fireSmsBurst(contacts, body) {
  contacts.forEach(({ phone }) => {
    const a = document.createElement('a');
    a.href = `sms:${phone}?body=${encodeURIComponent(body)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
}

// Start GPS watch, return cleanup fn
export function watchLocation(onUpdate, onError) {
  if (!navigator.geolocation) { onError('Geolocation not supported'); return () => {}; }
  const id = navigator.geolocation.watchPosition(
    pos => onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    err => onError(err.message),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
  );
  return () => navigator.geolocation.clearWatch(id);
}
