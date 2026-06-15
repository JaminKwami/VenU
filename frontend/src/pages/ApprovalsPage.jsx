import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReveal } from '../hooks/useReveal';
import { useTopbar } from '../components/TopbarContext';
import { Icon } from '../components/icons';
import { venueGradient, hm, prettyDate, todayISO, STATUS_BADGE } from '../utils/venueUi';

function initials(name) {
  return name.split(/[\s@.]/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}

export default function ApprovalsPage() {
  usePageTitle('Approvals');
  useTopbar('Approvals');
  const [bookings, setBookings] = useState(null);
  const [selId, setSelId] = useState(null);
  const [filter, setFilter] = useState('Pending');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const revealRef = useReveal([bookings != null]);

  useEffect(() => {
    api.get('/bookings/').then(r => {
      const data = r.data.results ?? r.data;
      setBookings(data);
      const firstPending = data.find(b => b.status === 'PENDING');
      if (firstPending) setSelId(firstPending.id);
    }).catch(() => setBookings([]));
  }, []);

  const today = todayISO();
  const all = bookings || [];
  const pending = all.filter(b => b.status === 'PENDING');
  const approvedToday = all.filter(b => b.status === 'APPROVED' && b.decided_at?.startsWith(today)).length;
  const declinedToday = all.filter(b => b.status === 'REJECTED' && b.decided_at?.startsWith(today)).length;
  const avgResponse = useMemo(() => {
    const decided = all.filter(b => b.decided_at);
    if (!decided.length) return null;
    const ms = decided.reduce((acc, b) => acc + (new Date(b.decided_at) - new Date(b.created_at)), 0) / decided.length;
    const h = ms / 3600000;
    return h < 1 ? `${Math.max(1, Math.round(h * 60))}m` : `${h.toFixed(1)}h`;
  }, [all]);

  const FILTERS = ['Pending', 'Today', 'High capacity', 'Decided'];
  const visible = useMemo(() => {
    switch (filter) {
      case 'Today': return pending.filter(b => b.date === today);
      case 'High capacity': return pending.filter(b => (b.attendee_count || 0) >= 100 || b.venue.capacity >= 200);
      case 'Decided': return all.filter(b => ['APPROVED', 'REJECTED'].includes(b.status)).slice(0, 20);
      default: return pending;
    }
  }, [filter, pending, all, today]);

  const sel = all.find(b => b.id === selId) || visible[0] || null;

  async function act(booking, action, declineReason = '') {
    setActing(true);
    setError('');
    try {
      const url = action === 'ok' ? `/bookings/${booking.id}/approve/` : `/bookings/${booking.id}/reject/`;
      const res = await api.patch(url, action === 'ok' ? {} : { reason: declineReason });
      setBookings(prev => prev.map(b => b.id === booking.id
        ? { ...b, status: res.data.status, rejection_reason: res.data.rejection_reason, decided_at: res.data.decided_at }
        : b));
      setDeclining(false);
      setReason('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Action failed — please try again.');
    } finally {
      setActing(false);
    }
  }

  const loading = bookings == null;
  const fill = sel?.attendee_count ? Math.round((sel.attendee_count / sel.venue.capacity) * 100) : null;

  return (
    <div className="page" style={{ maxWidth: 1280 }} ref={revealRef}>
      <div className="page-head reveal">
        <span className="eyebrow">Facilities queue</span>
        <h1>Approvals</h1>
        <p>
          Review and action booking requests across all spaces.{' '}
          {!loading && <b>{pending.length} pending</b>}{!loading && ` need${pending.length === 1 ? 's' : ''} your attention.`}
        </p>
      </div>

      <div className="ap-stats reveal">
        <div className="card stat-card"><div className="stat-label">Pending</div><div className="stat-val">{loading ? '—' : pending.length}</div></div>
        <div className="card stat-card"><div className="stat-label">Approved today</div><div className="stat-val">{loading ? '—' : approvedToday}</div></div>
        <div className="card stat-card"><div className="stat-label">Declined today</div><div className="stat-val">{loading ? '—' : declinedToday}</div></div>
        <div className="card stat-card"><div className="stat-label">Avg response</div><div className="stat-val" style={{ fontSize: '1.7rem', marginTop: '.9rem' }}>{avgResponse || '—'}</div></div>
      </div>

      <div className="filters reveal">
        {FILTERS.map(f => (
          <button key={f} className={`chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {error && <div className="conflict reveal in" style={{ marginBottom: '1rem' }}><Icon.X strokeWidth={2} /><span>{error}</span></div>}

      <div className="ap-grid reveal">
        <div className="card req-list">
          {loading && [1, 2, 3].map(i => (
            <div key={i} className="req"><div className="skeleton" style={{ width: 38, height: 38, borderRadius: '50%' }} /><div style={{ flex: 1 }}><div className="skeleton" style={{ height: 14, width: '50%', marginBottom: 6 }} /><div className="skeleton" style={{ height: 12, width: '70%' }} /></div></div>
          ))}
          {!loading && visible.length === 0 && (
            <div className="empty">
              <span className="ic"><Icon.Approvals width={22} height={22} /></span>
              <span>Queue is clear. Nothing waiting on you.</span>
            </div>
          )}
          {!loading && visible.map(b => {
            const [cls, label] = STATUS_BADGE[b.status];
            const decided = b.status !== 'PENDING';
            return (
              <button
                type="button"
                key={b.id}
                className={`req${sel?.id === b.id ? ' sel' : ''}${decided && filter !== 'Decided' ? ' dim' : ''}`}
                onClick={() => { setSelId(b.id); setDeclining(false); setError(''); }}
              >
                <span className="avatar">{initials(b.user.full_name || b.user.email)}</span>
                <div className="rinfo">
                  <div className="rtitle">{b.purpose || b.venue.name}</div>
                  <div className="rmeta">{b.venue.name} · {b.user.full_name || b.user.email}</div>
                  <div className="rwhen">{prettyDate(b.date)} · {hm(b.start_time)}–{hm(b.end_time)}</div>
                </div>
                <div className="ract">
                  <span className={`badge ${cls}`}><span className="dot" />{label}</span>
                  {!decided && (
                    <div className="mini-btns">
                      <button className="ok" title="Approve" aria-label="Approve request" disabled={acting} onClick={e => { e.stopPropagation(); act(b, 'ok'); }}><Icon.Check /></button>
                      <button className="no" title="Decline" aria-label="Decline request" disabled={acting} onClick={e => { e.stopPropagation(); setSelId(b.id); setDeclining(true); }}><Icon.X /></button>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <aside>
          {sel && (
            <div className="card detail-card">
              <div className="dh">
                <span className="dvis" style={{ background: venueGradient(sel.venue.id) }} />
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.15rem' }}>{sel.purpose || sel.venue.name}</div>
                  <div className="muted" style={{ fontSize: '.82rem' }}>{sel.venue.name}</div>
                </div>
              </div>
              <div className="dline"><span className="k">Requested by</span><span className="v">{sel.user.full_name || sel.user.email}</span></div>
              {sel.department && <div className="dline"><span className="k">Department</span><span className="v">{sel.department}</span></div>}
              <div className="dline"><span className="k">When</span><span className="v" style={{ textAlign: 'right' }}>{prettyDate(sel.date)} · {hm(sel.start_time)}–{hm(sel.end_time)}</span></div>
              <div className="dline"><span className="k">Attendees</span><span className="v">{sel.attendee_count != null ? `${sel.attendee_count} / ${sel.venue.capacity}` : `— / ${sel.venue.capacity}`}</span></div>
              {fill != null && (
                <div style={{ margin: '.8rem 0 .2rem' }}>
                  <div className="cap-bar"><span style={{ width: `${Math.min(fill, 100)}%`, background: fill > 90 ? 'var(--warn)' : 'var(--accent)' }} /></div>
                  <div className="muted" style={{ fontSize: '.74rem', marginTop: '.4rem' }}>{fill}% of capacity{fill > 90 ? ' · near limit' : ''}</div>
                </div>
              )}
              {(sel.notes || sel.rejection_reason) && (
                <div className="req-note">
                  {sel.status === 'REJECTED' && sel.rejection_reason ? `Declined: ${sel.rejection_reason}` : `“${sel.notes}”`}
                </div>
              )}
              {sel.status === 'PENDING' && !declining && (
                <div className="stack" style={{ gap: '.6rem', marginTop: '1rem' }}>
                  <button className="btn btn-success btn-block" disabled={acting} onClick={() => act(sel, 'ok')}>
                    <Icon.Check width={16} height={16} /> Approve request
                  </button>
                  <button className="btn btn-danger btn-block" disabled={acting} onClick={() => setDeclining(true)}>Decline</button>
                </div>
              )}
              {sel.status === 'PENDING' && declining && (
                <div className="stack" style={{ gap: '.6rem', marginTop: '1rem' }}>
                  <div className="field">
                    <label>Reason (shown to the requester)</label>
                    <input className="input" autoFocus maxLength={500} placeholder="e.g. Venue reserved for maintenance" value={reason} onChange={e => setReason(e.target.value)} />
                  </div>
                  <div className="row" style={{ gap: '.6rem' }}>
                    <button className="btn btn-ghost" style={{ flex: 1 }} disabled={acting} onClick={() => { setDeclining(false); setReason(''); }}>Cancel</button>
                    <button className="btn btn-danger" style={{ flex: 1 }} disabled={acting} onClick={() => act(sel, 'no', reason)}>
                      {acting ? '…' : 'Confirm decline'}
                    </button>
                  </div>
                </div>
              )}
              {sel.status !== 'PENDING' && (
                <div className="muted" style={{ fontSize: '.84rem', marginTop: '1rem' }}>
                  This request has been {sel.status === 'APPROVED' ? 'approved' : sel.status === 'REJECTED' ? 'declined' : 'cancelled'}.
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
