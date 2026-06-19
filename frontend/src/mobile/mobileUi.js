/* Mobile-specific presentation helpers. */

/* Short status labels matching the mobile design (Confirmed / Waiting / …). */
export const M_STATUS = {
  APPROVED:  ['badge-approved',  'Confirmed'],
  PENDING:   ['badge-pending',   'Waiting'],
  REJECTED:  ['badge-rejected',  'Declined'],
  CANCELLED: ['badge-cancelled', 'Cancelled'],
};

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function firstNameOf(user) {
  return (user?.full_name || user?.email || '').split(/[\s@]/)[0] || 'there';
}

export function initials(name) {
  return (name || '?').split(/[\s@.]/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');
}

/* Seven day cards for the home week strip. */
export function weekDays(bookedSet = new Set()) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      label: labels[i],
      n: d.getDate(),
      iso,
      today: d.toDateString() === now.toDateString(),
      booked: bookedSet.has(iso),
    };
  });
}
