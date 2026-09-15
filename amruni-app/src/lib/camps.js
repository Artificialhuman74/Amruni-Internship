/** Shared display helpers for health camps (admin and patient). */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

/** "20 Sep" · "20–22 Sep" · "30 Sep – 2 Oct" */
export function campDates(camp) {
  const a = parts(camp.startsOn);
  const b = parts(camp.endsOn || camp.startsOn);
  if (camp.startsOn === (camp.endsOn || camp.startsOn)) return `${a.d} ${MONTHS[a.m - 1]}`;
  if (a.m === b.m && a.y === b.y) return `${a.d}–${b.d} ${MONTHS[a.m - 1]}`;
  return `${a.d} ${MONTHS[a.m - 1]} – ${b.d} ${MONTHS[b.m - 1]}`;
}

export function to12h(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function campTimes(camp) {
  if (!camp.startTime) return '';
  return camp.endTime ? `${to12h(camp.startTime)} – ${to12h(camp.endTime)}` : `From ${to12h(camp.startTime)}`;
}

export const STATUS_LABEL = {
  ongoing: 'Happening now',
  upcoming: 'Coming up',
  held: 'Recently held',
  cancelled: 'Cancelled',
};

/** Days until the camp starts, counted in local calendar days. */
export function daysUntil(camp) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(`${camp.startsOn}T00:00`);
  return Math.round((start - today) / 86400000);
}

export function whenLabel(camp) {
  if (camp.status === 'ongoing') return 'Happening now';
  if (camp.status === 'held') return 'Recently held';
  const n = daysUntil(camp);
  if (n <= 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  return `In ${n} days`;
}

export function mapsLink(camp) {
  const q = [camp.venue, camp.address, camp.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
