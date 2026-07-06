import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReveal } from '../hooks/useReveal';
import { useTopbar } from '../components/TopbarContext';
import { Icon } from '../components/icons';
import CheckInModal from '../components/CheckInModal';
import { hm, todayISO, prettyDate, venueGradient, STATUS_BADGE } from '../utils/venueUi';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function initials(name) {
  return (name || '?').split(/[\s@.]/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}

async function downloadIcs() {
  const res = await api.get('/bookings/export/', { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'venu-bookings.ics';
  a.click();
  URL.revokeObjectURL(url);
}

const PILLS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'past', label: 'Past' },
  { id: 'all', label: 'All' },
];

export default function DashboardPage() {
  usePageTitle('Dashboard');
  const navigate = useNavigate();
  useTopbar('Dashboard', (
    <Link className="btn btn-primary btn-sm" to="/book"><Icon.Plus width={15} height={15} /> New booking</Link>
  ));
  const { user } = useAuthStore();
  // Admin-style dashboard = those who manage the queue (ADMIN + RECEPTIONIST),
  // matching the sidebar, route guards and backend (User.is_staff_member).
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'RECEPTIONIST';
  const [bookings, setBookings] = useState(null);
  const [qrBooking, setQrBooking] = useState(null);
  const [filter, setFilter] = useState('upcoming');
  const [query, setQuery] = useState('');
  const [cancelling, setCancelling] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelError, setCancelError] = useState('');
  const [acting, setActing] = useState(null);
  const [actError, setActError] = useState('');
  const revealRef = useReveal([bookings != null, filter]);

  useEffect(() => {
    api.get('/bookings/').then(r => setBookings(r.data.results ?? r.data)).catch(() => setBookings([]));
  }, []);

  const today = todayISO();
  const loading = bookings == null;
  const all = bookings || [];

  const upcomingCount = all.filter(b => b.date >= today && b.status === 'APPROVED').length;
  const pendingCount = all.filter(b => b.status === 'PENDING').length;
  const approvedToday = all.filter(b => b.status === 'APPROVED' && b.decided_at?.startsWith(today)).length;

  // Top-priority queue for admins/receptionists: oldest requests first, capped
  // to a handful so the dashboard stays a quick triage stop, not a full inbox.
  const needsApproval = useMemo(
    () => all.filter(b => b.status === 'PENDING').sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, 4),
    [all],
  );

  async function actOnBooking(booking, action) {
    setActing(booking.id);
    setActError('');
    try {
      const url = action === 'approve' ? `/bookings/${booking.id}/approve/` : `/bookings/${booking.id}/reject/`;
      const res = await api.patch(url);
      setBookings(prev => prev.map(x => x.id === booking.id ? { ...x, status: res.data.status, decided_at: res.data.decided_at } : x));
    } catch (err) {
      setActError(err.response?.data?.detail || 'Action failed — please try again.');
    } finally {
      setActing(null);
    }
  }

  const list = useMemo(() => {
    const q = query.toLowerCase();
    let arr = all.filter(b => !q
      || (b.purpose || '').toLowerCase().includes(q)
      || b.venue.name.toLowerCase().includes(q)
      || (b.department || '').toLowerCase().includes(q));
    if (filter === 'upcoming') arr = arr.filter(b => b.date >= today && ['APPROVED', 'PENDING'].includes(b.status));
    else if (filter === 'pending') arr = arr.filter(b => b.status === 'PENDING');
    else if (filter === 'approved') arr = arr.filter(b => b.status === 'APPROVED');
    else if (filter === 'past') arr = arr.filter(b => b.date < today);
    const desc = filter === 'past';
    return arr.sort((a, b) => {
      const ka = a.date + a.start_time, kb = b.date + b.start_time;
      return desc ? kb.localeCompare(ka) : ka.localeCompare(kb);
    });
  }, [all, filter, query, today]);

  async function confirmCancel() {
    const b = cancelTarget;
    setCancelTarget(null);
    setCancelError('');
    setCancelling(b.id);
    try {
      await api.patch(`/bookings/${b.id}/cancel/`);
      setBookings(prev => prev.map(x => x.id === b.id ? { ...x, status: 'CANCELLED' } : x));
    } catch {
      setCancelError('Cancellation failed — please try again.');
    } finally {
      setCancelling(null);
    }
  }

  function tryAgain(b) {
    navigate('/book', { state: { venueId: b.venue.id, venueName: b.venue.name, openAtStep: 2 } });
  }

  const firstName = (user?.full_name || user?.email || '').split(/[\s@]/)[0];

  return (
    <>
    <div className="page" style={{ maxWidth: 980 }} ref={revealRef}>
      <div className="page-head reveal">
        <span className="eyebrow">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        <h1>{greeting()}, {firstName}.</h1>
        <p>
          {loading ? 'Loading…' : isAdmin ? (
            pendingCount > 0
              ? <><b>{pendingCount} {pendingCount === 1 ? 'request' : 'requests'}</b> {pendingCount === 1 ? 'needs' : 'need'} your approval.</>
              : <>Queue is clear.{upcomingCount > 0 && <> <b>{upcomingCount} confirmed</b> coming up.</>}</>
          ) : (
            <>You have <b>{upcomingCount} confirmed {upcomingCount === 1 ? 'booking' : 'bookings'}</b> coming up{pendingCount > 0 ? <> and <b>{pendingCount} awaiting approval</b></> : ''}.</>
          )}
        </p>
      </div>

      {!isAdmin && <div style={{ marginBottom: '1.4rem' }}><QuickBook /></div>}

      {isAdmin && (
        <>
          <div className="stat-trio reveal" data-d="0" style={{ marginBottom: '1.4rem' }}>
            <div className="stat-seg"><div className="stat-seg-n">{loading ? '—' : pendingCount}</div><div className="stat-seg-label">Pending</div></div>
            <div className="stat-seg"><div className="stat-seg-n">{loading ? '—' : approvedToday}</div><div className="stat-seg-label">Approved today</div></div>
            <div className="stat-seg"><div className="stat-seg-n">{loading ? '—' : upcomingCount}</div><div className="stat-seg-label">Upcoming</div></div>
          </div>

          {!loading && needsApproval.length > 0 && (
            <div className="card reveal" data-d="1" style={{ marginBottom: '1.4rem' }}>
              <div className="card-head">
                <h3>Needs your approval</h3>
                {pendingCount > needsApproval.length && (
                  <Link className="btn btn-outline btn-sm" to="/admin/approvals">View all {pendingCount}</Link>
                )}
              </div>
              {actError && <div className="conflict in" style={{ margin: '0 1.3rem 1rem' }}><Icon.X strokeWidth={2} /><span>{actError}</span></div>}
              <div className="req-list">
                {needsApproval.map(b => (
                  <div className="req" key={b.id}>
                    <span className="avatar">{initials(b.user?.full_name || b.user?.email)}</span>
                    <div className="rinfo">
                      <div className="rtitle">{b.purpose || b.venue.name}</div>
                      <div className="rmeta">{b.venue.name} · {b.user?.full_name || b.user?.email}</div>
                      <div className="rwhen">{prettyDate(b.date)} · {hm(b.start_time)}–{hm(b.end_time)}</div>
                    </div>
                    <div className="ract">
                      <div className="mini-btns">
                        <button className="ok" title="Approve" aria-label="Approve request" disabled={acting === b.id} onClick={() => actOnBooking(b, 'approve')}><Icon.Check /></button>
                        <button className="no" title="Decline" aria-label="Decline request" disabled={acting === b.id} onClick={() => actOnBooking(b, 'reject')}><Icon.X /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="filter-pills reveal">
        {PILLS.map(p => (
          <button key={p.id} className={`fp${filter === p.id ? ' on' : ''}`} onClick={() => setFilter(p.id)}>
            {p.label}
          </button>
        ))}
        <div className="search-box fp-search">
          <Icon.Search />
          <input className="input" placeholder="Search bookings…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="lo-list">
        {loading && [1, 2, 3].map(i => (
          <div className="lo-card" key={i}>
            <div className="skeleton" style={{ width: 84, height: 84, borderRadius: 'var(--r-lg)' }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 16, width: '55%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 12, width: '75%' }} />
            </div>
          </div>
        ))}

        {!loading && list.length === 0 && (
          <div className="card empty" style={{ padding: '3rem 1rem' }}>
            <span className="ic"><Icon.Calendar width={22} height={22} /></span>
            <span>{query || filter !== 'upcoming' ? 'Nothing matches those filters.' : 'No upcoming bookings. Ready to plan something?'}</span>
            <Link className="btn btn-primary btn-sm" to="/book">New booking</Link>
          </div>
        )}

        {!loading && list.slice(0, 10).map(b => {
          const [cls, label] = STATUS_BADGE[b.status];
          const canCancel = ['PENDING', 'APPROVED'].includes(b.status) && b.date >= today && !b.checked_in_at;
          return (
            <div className="lo-card" key={b.id}>
              <div className="lo-thumb" style={{ background: venueGradient(b.venue.id) }}>
                <Icon.Venues />
              </div>
              <div className="lo-body">
                <div className="lo-title">{b.purpose || b.venue.name}</div>
                <div className="lo-desc">
                  {b.venue.name}{b.venue.building ? ` · ${b.venue.building}` : ''} · {prettyDate(b.date)} · {hm(b.start_time)}–{hm(b.end_time)}
                  {isAdmin && b.user ? ` · ${b.user.full_name || b.user.email}` : ''}
                </div>
                <div className="lo-meta">
                  <span className={`badge ${cls}`}><span className="dot" />{label}</span>
                  {b.status === 'APPROVED' && b.check_in_token && (
                    <button className={`bi-checkin${b.checked_in_at ? ' done' : ''}`} onClick={() => setQrBooking(b)}>
                      <Icon.QR width={12} height={12} />{b.checked_in_at ? 'Checked in' : 'Check in'}
                    </button>
                  )}
                  {canCancel && (
                    <button className="btn btn-danger btn-sm" style={{ fontSize: '.74rem', padding: '.3em .7em' }} disabled={cancelling === b.id} onClick={() => setCancelTarget(b)}>
                      {cancelling === b.id ? '…' : 'Cancel'}
                    </button>
                  )}
                  {b.status === 'REJECTED' && (
                    <button className="btn btn-outline btn-sm" style={{ fontSize: '.74rem', padding: '.3em .7em' }} onClick={() => tryAgain(b)}>
                      Try again →
                    </button>
                  )}
                </div>
              </div>
              <Link className="lo-go" to={`/venues/${b.venue.id}`} aria-label={`Open ${b.venue.name}`}>
                <Icon.Arrow />
              </Link>
            </div>
          );
        })}

        {!loading && list.length > 0 && (
          <button className="btn btn-outline btn-sm lo-export" onClick={() => downloadIcs().catch(() => {})}>
            <Icon.Calendar width={14} height={14} /> Export .ics
          </button>
        )}
      </div>
    </div>

    {qrBooking && <CheckInModal booking={qrBooking} onClose={() => setQrBooking(null)} />}

    {cancelTarget && (
      <div className="modal-scrim" onClick={() => setCancelTarget(null)}>
        <div className="modal-card" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
          <h3>Cancel booking?</h3>
          <p style={{ color: 'var(--ink-65)', margin: '.6rem 0 1.2rem' }}>
            Cancel <b>{cancelTarget.venue.name}</b> on <b>{cancelTarget.date}</b>?<br />
            This cannot be undone.
          </p>
          {cancelError && <p style={{ color: 'var(--danger)', fontSize: '.85rem', marginBottom: '.8rem' }}>{cancelError}</p>}
          <div className="row" style={{ gap: '.6rem' }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setCancelTarget(null)}>Keep it</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmCancel}>Yes, cancel</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function QuickBook() {
  const navigate = useNavigate();
  const [venues, setVenues] = useState([]);
  const [venueId, setVenueId] = useState(null);
  const [hour, setHour] = useState(null);
  const [taken, setTaken] = useState([]);
  const today = todayISO();

  useEffect(() => {
    api.get('/venues/').then(r => {
      const data = r.data.results ?? r.data;
      setVenues(data.slice(0, 8));
      if (data.length) setVenueId(data[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!venueId) return;
    api.get('/bookings/availability/', { params: { venue: venueId, date: today } })
      .then(r => setTaken(r.data.taken_slots || []))
      .catch(() => setTaken([]));
    setHour(null);
  }, [venueId, today]);

  const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const pad = h => `${String(h).padStart(2, '0')}:00`;

  function isBusy(h) {
    const s = pad(h);
    const e = pad(h + 1);
    return taken.some(t => hm(t.start_time) < e && hm(t.end_time) > s);
  }

  function go() {
    if (!venueId || hour === null) return;
    navigate('/book', { state: { venueId, date: today, hour } });
  }

  const selectedVenue = venues.find(v => v.id === venueId);

  return (
    <div className="card reveal" data-d="0">
      <div className="card-head">
        <h3>Quick book for today</h3>
        <span className="label">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
      </div>
      <div style={{ padding: '1rem 1.3rem 1.3rem' }}>
        {venues.length > 0 && (
          <div className="field" style={{ marginBottom: '.9rem' }}>
            <label htmlFor="qb-venue">Space</label>
            <select id="qb-venue" className="select" value={venueId || ''} onChange={e => setVenueId(Number(e.target.value))}>
              {venues.map(v => <option key={v.id} value={v.id}>{v.name} · {v.capacity} cap</option>)}
            </select>
          </div>
        )}
        <span className="label" style={{ display: 'block', marginBottom: '.4rem' }}>Pick a start time</span>
        <div className="time-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', gap: '.35rem', marginBottom: '1rem' }}>
          {HOURS.map(h => {
            const busy = isBusy(h);
            return (
              <button
                key={h}
                className={`${hour === h ? 'on' : ''}${busy ? ' busy' : ''}`}
                style={{ fontSize: '.72rem', padding: '.4em' }}
                disabled={busy}
                onClick={() => setHour(h)}
              >
                {pad(h)}
              </button>
            );
          })}
        </div>
        <button className="btn btn-primary btn-block" disabled={!venueId || hour === null} onClick={go}>
          Continue to request <Icon.Arrow width={15} height={15} />
        </button>
        {selectedVenue && hour !== null && !isBusy(hour) && (
          <p style={{ fontSize: '.78rem', color: 'var(--ink-45)', marginTop: '.6rem', textAlign: 'center' }}>
            {selectedVenue.name} · {pad(hour)} – {pad(hour + 1)} · today
          </p>
        )}
      </div>
    </div>
  );
}
