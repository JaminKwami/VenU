/* Shared presentation helpers for the Blueprint screens. */

const GRADIENTS = [
  'linear-gradient(150deg,#2D4EAA,#1C3A7A)',
  'linear-gradient(150deg,#1C4A38,#2A6B52)',
  'linear-gradient(150deg,#5C3A1A,#8B5C2A)',
  'linear-gradient(150deg,#2D4EAA,#1C4A38)',
  'linear-gradient(150deg,#3D2A6B,#2D4EAA)',
  'linear-gradient(150deg,#6B3A1A,#C8460A)',
  'linear-gradient(150deg,#1C4A38,#3D6B40)',
  'linear-gradient(150deg,#4A3820,#7A6040)',
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
