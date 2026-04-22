import { useEffect, useState } from 'react';
import api from '../api/axios';

const STATUS_MAP = { PENDING: 'badge-pending', APPROVED: 'badge-approved', REJECTED: 'badge-rejected' };

function RequestCard({ b, onApprove, onReject, acting }) {
  return (
    <div className="card fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span className="avatar" style={{ width: 32, height: 32, fontSize: '0.7rem', flexShrink: 0 }}>
            {(b.user.full_name || b.user.email)[0].toUpperCase()}
          </span>
          <div>
            <div style={{ fontWeight: 600, lineHeight: 1.2 }}>{b.user.full_name || b.user.email.split('@')[0]}</div>
            <div style={{ fontSize: '0.73rem', color: 'var(--ink-3)' }}>{b.user.email}</div>
          </div>
        </div>
        <span className={`badge ${STATUS_MAP[b.status]}`}>{b.status}</span>
      </div>

      {/* Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 0.75rem', fontSize: '0.82rem', color: 'var(--ink-2)' }}>
        <div><span style={{ color: 'var(--ink-3)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 2 }}>Venue</span>
          <strong style={{ color: 'var(--ink)' }}>{b.venue.name}</strong></div>
        <div><span style={{ color: 'var(--ink-3)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 2 }}>Date</span>{b.date}</div>
        <div><span style={{ color: 'var(--ink-3)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 2 }}>Time</span>{b.start_time.slice(0,5)} â€“ {b.end_time.slice(0,5)}</div>
        {b.purpose && <div><span style={{ color: 'var(--ink-3)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 2 }}>Purpose</span>{b.purpose}</div>}
      </div>

      {/* Actions */}
      {b.status === 'PENDING' && (
        <div style={{ display: 'flex', gap: '0.55rem', marginTop: '0.25rem' }}>
          <button
            className="btn btn-success"
            disabled={acting === b.id}
            onClick={() => onApprove(b.id)}
            style={{ flex: 1 }}
          >
            {acting === b.id ? 'â€¦' : 'âœ“ Approve'}
          </button>
          <button
            className="btn btn-danger"
            disabled={acting === b.id}
            onClick={() => onReject(b.id)}
            style={{ flex: 1 }}
          >
            {acting === b.id ? 'â€¦' : 'âœ• Reject'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ApprovalsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [filter, setFilter] = useState('PENDING');

  useEffect(() => {
    api.get('/bookings/').then(r => setBookings(r.data)).finally(() => setLoading(false));
  }, []);

  async function handleAction(id, status) {
    setActing(id);
    try {
      const res = await api.patch(`/bookings/${id}/`, { status });
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: res.data.status } : b));
    } finally {
      setActing(null);
    }
  }

  const filters = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];
  const visible = filter === 'ALL' ? bookings : bookings.filter(b => b.status === filter);

  return (
    <div className="page-content fade-up">
      <div className="page-header">
        <div>
          <h1>Approvals</h1>
          <p>Review and action booking requests</p>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '0.3rem 0.85rem',
                borderRadius: 99,
                border: '1.5px solid',
                borderColor: filter === f ? 'var(--ink)' : 'var(--border)',
                background: filter === f ? 'var(--ink)' : 'transparent',
                color: filter === f ? '#fff' : 'var(--ink-2)',
                fontWeight: filter === f ? 600 : 400,
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.15s var(--ease)',
              }}
            >
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              {' '}
              <span style={{ opacity: 0.65, fontSize: '0.72rem' }}>
                {f === 'ALL' ? bookings.length : bookings.filter(b => b.status === f).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.85rem' }}>
          {[1,2,3].map(i => (
            <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="skeleton" style={{ height: 32, width: '60%' }} />
              <div className="skeleton" style={{ height: 14, width: '80%' }} />
              <div className="skeleton" style={{ height: 14, width: '50%' }} />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          <span>No {filter === 'ALL' ? '' : filter.toLowerCase() + ' '}requests.</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.85rem' }}>
          {visible.map(b => (
            <RequestCard
              key={b.id}
              b={b}
              acting={acting}
              onApprove={id => handleAction(id, 'APPROVED')}
              onReject={id => handleAction(id, 'REJECTED')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
