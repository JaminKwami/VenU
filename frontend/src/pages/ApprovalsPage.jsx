import { useEffect, useState } from 'react';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';

const STATUS_MAP = {
  PENDING: 'badge-pending',
  APPROVED: 'badge-approved',
  REJECTED: 'badge-rejected',
  CANCELLED: 'badge-cancelled',
};

function Detail({ label, children }) {
  return (
    <div>
      <span style={{ color: 'var(--ink-3)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 2 }}>{label}</span>
      {children}
    </div>
  );
}

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
        <Detail label="Venue"><strong style={{ color: 'var(--ink)' }}>{b.venue.name}</strong></Detail>
        <Detail label="Date">{b.date}</Detail>
        <Detail label="Time">{b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}</Detail>
        {b.attendee_count != null && <Detail label="Attendees">{b.attendee_count} / {b.venue.capacity}</Detail>}
        {b.purpose && <Detail label="Purpose">{b.purpose}</Detail>}
        {b.status === 'REJECTED' && b.rejection_reason && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Detail label="Rejection reason">{b.rejection_reason}</Detail>
          </div>
        )}
      </div>

      {/* Actions */}
      {b.status === 'PENDING' && (
        <div style={{ display: 'flex', gap: '0.55rem', marginTop: '0.25rem' }}>
          <button
            className="btn btn-success"
            disabled={acting === b.id}
            onClick={() => onApprove(b)}
            style={{ flex: 1 }}
          >
            {acting === b.id ? '…' : 'Approve'}
          </button>
          <button
            className="btn btn-danger"
            disabled={acting === b.id}
            onClick={() => onReject(b)}
            style={{ flex: 1 }}
          >
            {acting === b.id ? '…' : 'Reject'}
          </button>
        </div>
      )}
    </div>
  );
}

function ConfirmModal({ booking, mode, onConfirm, onClose, busy }) {
  const [reason, setReason] = useState('');
  const isReject = mode === 'reject';
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
    >
      <div className="card fade-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h3 style={{ marginBottom: '0.35rem' }}>{isReject ? 'Reject booking?' : 'Approve booking?'}</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--ink-2)' }}>
            {booking.venue.name} · {booking.date} · {booking.start_time.slice(0, 5)}–{booking.end_time.slice(0, 5)}
            <br />Requested by {booking.user.full_name || booking.user.email}
          </p>
        </div>

        {isReject && (
          <div>
            <label className="label">Reason <span style={{ color: 'var(--ink-3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(shown to the requester)</span></label>
            <input
              className="input"
              placeholder="e.g. Venue reserved for maintenance"
              value={reason}
              maxLength={500}
              onChange={e => setReason(e.target.value)}
              autoFocus
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.55rem' }}>
          <button className="btn" onClick={onClose} disabled={busy} style={{ flex: 1 }}>Cancel</button>
          <button
            className={`btn ${isReject ? 'btn-danger' : 'btn-success'}`}
            onClick={() => onConfirm(reason)}
            disabled={busy}
            style={{ flex: 1 }}
          >
            {busy ? '…' : isReject ? 'Reject' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  usePageTitle('Approvals');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [filter, setFilter] = useState('PENDING');
  const [modal, setModal] = useState(null);   // { booking, mode }
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/bookings/').then(r => setBookings(r.data)).finally(() => setLoading(false));
  }, []);

  async function handleConfirm(reason) {
    const { booking, mode } = modal;
    setActing(booking.id);
    setError('');
    try {
      const url = mode === 'reject'
        ? `/bookings/${booking.id}/reject/`
        : `/bookings/${booking.id}/approve/`;
      const res = await api.patch(url, mode === 'reject' ? { reason } : {});
      setBookings(prev => prev.map(b =>
        b.id === booking.id
          ? { ...b, status: res.data.status, rejection_reason: res.data.rejection_reason }
          : b
      ));
      setModal(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Action failed — please try again.');
    } finally {
      setActing(null);
    }
  }

  const filters = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
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

      {error && <p className="error-msg" style={{ marginBottom: '1rem' }}>{error}</p>}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.85rem' }}>
          {[1, 2, 3].map(i => (
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
              onApprove={booking => setModal({ booking, mode: 'approve' })}
              onReject={booking => setModal({ booking, mode: 'reject' })}
            />
          ))}
        </div>
      )}

      {modal && (
        <ConfirmModal
          booking={modal.booking}
          mode={modal.mode}
          busy={acting === modal.booking.id}
          onConfirm={handleConfirm}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
