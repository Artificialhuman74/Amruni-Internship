import { conditionLabel } from '../data/conditions';

export function mapsLink({ lat, lng }) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

/**
 * The alert her contacts receive.
 *
 * It used to carry her name and a map pin and nothing else. The things a
 * paramedic or an emergency room asks for first — blood group, allergies,
 * existing conditions — were already sitting in her chart and were being left
 * behind. They travel now, because the person reading this message may be the
 * one who has to answer those questions on her behalf.
 *
 * Ordered by what matters in the first ten seconds: who, where, then what a
 * responder needs before treating her. Kept terse so it survives as a single
 * SMS on a poor network.
 */
export function smsBod(userName, link, medical = {}, { test = false } = {}) {
  const who = userName || 'Someone you know';
  const lines = test
    ? ['TEST — this is not an emergency.', `${who} is checking that her SOS alert reaches you.`]
    : [`URGENT: ${who} has sent an SOS alert.`];

  lines.push(`Location: ${link}`);
  lines.push(...medicalSummary(medical));
  lines.push(test ? 'No action needed.' : 'Please respond immediately.');
  return lines.join('\n');
}

/**
 * The clinical lines. Returns nothing at all when there's nothing true to say.
 *
 * Pregnancy leads, above blood group, because it changes the answer to almost
 * everything that follows it — which hospital she should be taken to, which
 * drugs are safe to give her, and how urgently a bleed or a fall needs to be
 * treated. It was the one fact the app already knew and the message left
 * behind, which made it the most expensive omission in the whole alert.
 */
export function medicalSummary({ pregnancy = null, bloodGroup, allergies = [], conditions = [] } = {}) {
  const out = [];
  if (pregnancy?.weeks != null) {
    out.push(`PREGNANT — ${pregnancy.weeks} weeks (trimester ${pregnancy.trimester})`);
  } else if (pregnancy?.recentlyPregnant) {
    out.push('RECENTLY PREGNANT — due date has passed');
  }
  if (bloodGroup) out.push(`Blood group: ${bloodGroup}`);
  if (allergies.length) out.push(`Allergies: ${allergies.join(', ')}`);
  if (conditions.length) {
    // Structured ids become their readable labels; a doctor's free text passes
    // through as written. Capped so the message stays sendable as one SMS.
    const named = conditions.slice(0, 4).map(conditionLabel);
    const more = conditions.length - named.length;
    out.push(`Conditions: ${named.join(', ')}${more > 0 ? ` +${more} more` : ''}`);
  }
  return out;
}

export function waLink(userName, link, medical, opts) {
  return `https://wa.me/?text=${encodeURIComponent(smsBod(userName, link, medical, opts))}`;
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
