/* Shared presentation helpers for the Blueprint screens. */

const GRADIENTS = [
  'linear-gradient(135deg,#2a4ddb,#6b3df0)',
  'linear-gradient(135deg,#ff5a36,#d2861a)',
  'linear-gradient(135deg,#1f6c52,#2a4ddb)',
  'linear-gradient(135deg,#1f6c52,#7ec98f)',
  'linear-gradient(135deg,#6b3df0,#2a4ddb)',
  'linear-gradient(135deg,#d2861a,#ff5a36)',
  'linear-gradient(135deg,#2a4ddb,#1f6c52)',
  'linear-gradient(135deg,#6b3df0,#ff5a36)',
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
  PENDING: ['badge-pending', 'Pending'],
  APPROVED: ['badge-approved', 'Approved'],
  REJECTED: ['badge-rejected', 'Declined'],
  CANCELLED: ['badge-cancelled', 'Cancelled'],
};
