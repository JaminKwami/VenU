/* Shared presentation helpers for the Blueprint screens. */

/* Monochrome charcoal→ash gradients — varied tones, all within palette. */
const GRADIENTS = [
  'linear-gradient(150deg,#27272a,#0f0f10)',
  'linear-gradient(150deg,#3f3f46,#1c1c1e)',
  'linear-gradient(150deg,#52525b,#27272a)',
  'linear-gradient(150deg,#334155,#0f172a)',
  'linear-gradient(150deg,#44403c,#1c1917)',
  'linear-gradient(150deg,#1c1c1e,#3f3f46)',
  'linear-gradient(150deg,#475569,#1e293b)',
  'linear-gradient(150deg,#57534e,#292524)',
];

export function venueGradient(id) {
  return GRADIENTS[(Number(id) || 0) % GRADIENTS.length];
}

export const VENUE_TYPES = [
  'Lecture hall', 'Studio', 'Lab', 'Seminar room', 'Outdoor', 'Music', 'Sports',
];

export function hm(t) {
  return (t || '').slice(0, 5);
}

export function dateChip(iso) {
  const d = new Date(iso + 'T00:00:00');
  return {
    d: d.getDate(),
    m: d.toLocaleString('en', { month: 'short' }),
  };
}

export function prettyDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function relTime(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dys = Math.floor(h / 24);
  if (dys === 1) return 'Yesterday';
  return `${dys} days ago`;
}

export function hoursBetween(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
}

export const STATUS_BADGE = {
  PENDING:   ['badge-pending',   'Waiting for approval'],
  APPROVED:  ['badge-approved',  'Confirmed'],
  REJECTED:  ['badge-rejected',  'Declined'],
  CANCELLED: ['badge-cancelled', 'Cancelled'],
};
