import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { usePageTitle } from '../hooks/usePageTitle';

const STATUS_MAP = {
  PENDING:   'badge-pending',
  APPROVED:  'badge-approved',
  REJECTED:  'badge-rejected',
  CANCELLED: 'badge-cancelled',
};

const ACCENT_MAP = {
  total:    '#1f5c47',
  pending:  '#8a5a14',
  approved: '#1f6b40',
  rejected: '#9c2b21',
};

function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_MAP[status] ?? ''}`}>{status}</span>;
}

function SkeletonRow({ cols }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}><div className="skeleton" style={{ height: 14, borderRadius: 6, width: i === 0 ? '80%' : '60%' }} /></td>
      ))}
    </tr>
  );
}

export default function DashboardPage() {
  usePageTitle('Dashboard');
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'STAFF';
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/bookings/').then(r => setBookings(r.data)).finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().split('T')[0];

  function canCancel(b) {
    const isOwner = b.user.id === user?.id || b.user.email === user?.email;
    return (
      (b.status === 'PENDING' || b.status === 'APPROVED') &&
      b.date >= today &&
      (isOwner || user?.role === 'ADMIN')
    );
  }

  async function handleCancel(b) {
    if (!window.confirm(`Cancel your booking for ${b.venue.name} on ${b.date}?`)) return;
    setCancelling(b.id);
    setError('');
    try {
      const res = await api.patch(`/bookings/${b.id}/cancel/`);
      setBookings(prev => prev.map(x => x.id === b.id ? { ...x, status: res.data.status } : x));
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not cancel the booking.');
    } finally {
      setCancelling(null);
    }
  }

  const stats = [
    { key: 'total',    label: 'Total',    value: bookings.length },
    { key: 'pending',  label: 'Pending',  value: bookings.filter(b => b.status === 'PENDING').length  },
    { key: 'approved', label: 'Approved', value: bookings.filter(b => b.status === 'APPROVED').length },
    { key: 'rejected', label: 'Rejected', value: bookings.filter(b => b.status === 'REJECTED').length },
  ];

  return (
    <div className="page-content fade-up">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>{isAdmin ? 'All booking requests across the system' : 'Your booking history'}</p>
        </div>
        <a href="/book" className="btn btn-primary">+ New Booking</a>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.85rem', marginBottom: '2rem' }}>
        {stats.map((s, i) => (
          <div key={s.key} className={`stat-card fade-up stagger-${i + 1}`}>
            <div className="stat-card__value">{loading ? '—' : s.value}</div>
            <div className="stat-card__label">{s.label}</div>
            <div className="stat-card__accent" style={{ background: ACCENT_MAP[s.key] }} />
          </div>
        ))}
      </div>

      {error && <p className="error-msg" style={{ marginBottom: '1rem' }}>{error}</p>}

      {/* Table */}
      <div className="table-wrap fade-up stagger-5">
        <table>
          <thead>
            <tr>
              {isAdmin && <th>User</th>}
              <th>Venue</th>
              <th>Date</th>
              <th>Time</th>
              <th>Purpose</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={isAdmin ? 7 : 6} />)
              : bookings.length === 0
                ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6}>
                      <div className="empty">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span>No bookings yet.</span>
                      </div>
                    </td>
                  </tr>
                )
                : bookings.map(b => (
                  <tr key={b.id}>
                    {isAdmin && (
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span className="avatar" style={{ width: 28, height: 28, fontSize: '0.65rem' }}>
                            {(b.user.full_name || b.user.email).split(/[\s@]/)[0][0].toUpperCase()}
                          </span>
                          <div>
                            <div style={{ fontWeight: 550, lineHeight: 1.2 }}>{b.user.full_name || b.user.email.split('@')[0]}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>{b.user.email}</div>
                          </div>
                        </div>
                      </td>
                    )}
                    <td style={{ fontWeight: 550 }}>{b.venue.name}</td>
                    <td style={{ color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{b.date}</td>
                    <td style={{ color: 'var(--ink-2)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {b.start_time.slice(0,5)} – {b.end_time.slice(0,5)}
                    </td>
                    <td style={{ color: 'var(--ink-2)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.purpose || <span style={{ color: 'var(--ink-3)' }}>—</span>}
                    </td>
                    <td>
                      <StatusBadge status={b.status} />
                      {b.status === 'REJECTED' && b.rejection_reason && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--ink-3)', marginTop: 4, maxWidth: 180 }}>
                          {b.rejection_reason}
                        </div>
                      )}
                    </td>
                    <td>
                      {canCancel(b) && (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
                          disabled={cancelling === b.id}
                          onClick={() => handleCancel(b)}
                        >
                          {cancelling === b.id ? '…' : 'Cancel'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
