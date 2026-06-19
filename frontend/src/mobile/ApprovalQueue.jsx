import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';
import { Icon } from '../components/icons';
import { hm, prettyDate } from '../utils/venueUi';
import { initials } from './mobileUi';

const DECLINE_REASONS = [
  'Venue reserved for maintenance',
  'Insufficient notice',
  'Outside operating hours',
  'Double booked',
  'Incomplete details',
];

export default function ApprovalQueue() {
  usePageTitle('Approvals');
  const [bookings, setBookings] = useState(null);
  const [acting, setActing] = useState(null);
  const [leaving, setLeaving] = useState(new Set());
  const [declining, setDeclining] = useState(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    api.get('/bookings/')
      .then((r) => setBookings(r.data.results ?? r.data))
      .catch(() => setBookings([]));
  }, []);

  const loading = bookings == null;
  const pending = useMemo(
    () => (bookings || [])
      .filter((b) => b.status === 'PENDING')
      .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time)),
    [bookings],
  );

  function removeAfterAnimation(id) {
    setLeaving((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setBookings((prev) => prev.filter((b) => b.id !== id));
      setLeaving((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }, 360);
  }

  async function approve(b) {
    setActing(b.id);
    try {
      await api.patch(`/bookings/${b.id}/approve/`);
      removeAfterAnimation(b.id);
    } catch (err) {
      window.alert(err.response?.data?.detail || 'Approval failed.');
    } finally {
      setActing(null);
    }
  }

  async function confirmDecline(b) {
    setActing(b.id);
    try {
      await api.patch(`/bookings/${b.id}/reject/`, { reason });
      setDeclining(null);
      setReason('');
      removeAfterAnimation(b.id);
    } catch (err) {
      window.alert(err.response?.data?.detail || 'Decline failed.');
    } finally {
      setActing(null);
    }
  }

  return (
    <>
      <div className="m-top-bar"><h1>Approvals</h1></div>

      <div className="m-queue-banner static">
        <div>
          <div className="qb-n">{loading ? '—' : pending.length}</div>
          <div className="qb-l">pending {pending.length === 1 ? 'request' : 'requests'}</div>
        </div>
      </div>

      {loading && [1, 2].map((i) => (
        <div className="m-queue-card" key={i}>
          <div className="skel" style={{ height: 14, width: '60%', marginBottom: 8 }} />
          <div className="skel" style={{ height: 12, width: '80%' }} />
        </div>
      ))}

      {!loading && pending.length === 0 && (
        <div className="m-empty" style={{ padding: '50px 20px' }}>
          <div className="m-empty-ic"><Icon.Approvals width={26} height={26} /></div>
          <p>Queue is clear. Nothing waiting on you.</p>
        </div>
      )}

      {!loading && pending.map((b) => (
        <div className={`m-queue-card${leaving.has(b.id) ? ' leaving' : ''}`} key={b.id}>
          <div className="m-qc-head">
            <div className="m-qc-avatar">{initials(b.user?.full_name || b.user?.email)}</div>
            <div className="m-qc-info">
              <div className="m-qc-title">{b.purpose || b.venue.name}</div>
              <div className="m-qc-meta">{b.venue.name} · {b.user?.full_name || b.user?.email}</div>
            </div>
          </div>
          <div className="m-qc-when">{prettyDate(b.date)} · {hm(b.start_time)}–{hm(b.end_time)}{b.attendee_count ? ` · ${b.attendee_count} attending` : ''}</div>

          {declining === b.id ? (
            <div className="m-decline-panel">
              <div className="m-decline-chips">
                {DECLINE_REASONS.map((r) => (
                  <button key={r} className={`chip${reason === r ? ' active' : ''}`} onClick={() => setReason((p) => (p === r ? '' : r))}>{r}</button>
                ))}
              </div>
              <input className="input" placeholder="Or type a reason…" value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="m-qc-actions">
                <button className="btn btn-ghost" onClick={() => { setDeclining(null); setReason(''); }}>Cancel</button>
                <button className="btn btn-danger" style={{ flex: 1 }} disabled={acting === b.id} onClick={() => confirmDecline(b)}>
                  {acting === b.id ? '…' : 'Confirm decline'}
                </button>
              </div>
            </div>
          ) : (
            <div className="m-qc-actions">
              <button className="btn btn-success" style={{ flex: 1 }} disabled={acting === b.id} onClick={() => approve(b)}>
                <Icon.Check width={16} height={16} /> Approve
              </button>
              <button className="btn btn-ghost" style={{ flex: 1 }} disabled={acting === b.id} onClick={() => { setDeclining(b.id); setReason(''); }}>
                Decline
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
