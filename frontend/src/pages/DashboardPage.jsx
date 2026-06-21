import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReveal } from '../hooks/useReveal';
import { useTopbar } from '../components/TopbarContext';
import { Icon } from '../components/icons';
import CheckInModal from '../components/CheckInModal';
import { hm, hoursBetween, relTime, todayISO, prettyDate, venueGradient, STATUS_BADGE } from '../utils/venueUi';

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

/* Month calendar — the signature widget of the new layout. Marks today and
   any day that carries a booking (approved or pending). */
function MonthCalendar({ bookedDays }) {
  const now = new Date();
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const todayKey = todayISO();

  const first = new Date(cur.y, cur.m, 1);
  const startOffset = (first.getDay() + 6) % 7;             // Monday-first
  const daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();
  const monthLabel = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const shift = n => setCur(c => {
    let m = c.m + n, y = c.y;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    return { y, m };
  });
  const keyFor = d => `${cur.y}-${String(cur.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <div className="card cal reveal" data-d="1">
      <div className="cal-head">
        <span className="cal-title">{monthLabel}</span>
        <div className="cal-nav">
          <button onClick={() => shift(-1)} aria-label="Previous month"><Icon.ChevronLeft width={15} height={15} /></button>
          <button onClick={() => shift(1)} aria-label="Next month"><Icon.ChevronRight width={15} height={15} /></button>
        </div>
      </div>
      <div className="cal-grid cal-dow">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => <span key={d}>{d}</span>)}
      </div>
      <div className="cal-grid">
        {cells.map((d, i) => {
          if (d === null) return <span key={i} className="cal-cell empty" />;
          const k = keyFor(d);
          const isToday = k === todayKey;
          const booked = bookedDays[k];
          return (
            <span key={i} className={`cal-cell${isToday ? ' today' : ''}`}>
              {d}
              {booked && !isToday && <i className="cal-dot" />}
            </span>
          );
        })}
      </div>
    </div>
  );
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
  const revealRef = useReveal([bookings != null, filter]);

  useEffect(() => {
    api.get('/bookings/').then(r => setBookings(r.data.results ?? r.data)).catch(() => setBookings([]));
  }, []);

  const today = todayISO();
  const loading = bookings == null;
  const all = bookings || [];

  const upcomingCount = all.filter(b => b.date >= today && b.status === 'APPROVED').length;
  const pendingCount = all.filter(b => b.status === 'PENDING').length;
  const approvedHours = all.filter(b => b.status === 'APPROVED').reduce((a, b) => a + hoursBetween(b.start_time, b.end_time), 0);

  const bookedDays = useMemo(() => {
    const map = {};
    all.forEach(b => {
      if (b.status === 'APPROVED') map[b.date] = 'approved';
      else if (b.status === 'PENDING' && !map[b.date]) map[b.date] = 'pending';
    });
    return map;
  }, [all]);

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

  const activity = useMemo(
    () => all
      .map(b => {
        if (b.status === 'APPROVED' && b.decided_at) return { who: b.venue.name, sub: 'Approved', tone: 'ok', ts: b.decided_at };
        if (b.status === 'REJECTED' && b.decided_at) return { who: b.venue.name, sub: 'Declined', tone: 'no', ts: b.decided_at };
        if (b.status === 'CANCELLED') return { who: b.purpose || b.venue.name, sub: 'Cancelled', tone: 'mute', ts: b.updated_at };
        return { who: b.venue.name, sub: isAdmin ? `Requested by ${b.user?.full_name || 'user'}` : 'You requested', tone: 'pend', ts: b.created_at };
      })
      .sort((a, b) => new Date(b.ts) - new Date(a.ts))
      .slice(0, 5),
    [all, isAdmin],
  );

  async function cancelBooking(b) {
    if (!confirm(`Cancel your booking of ${b.venue.name} on ${b.date}?`)) return;
    setCancelling(b.id);
    try {
      await api.patch(`/bookings/${b.id}/cancel/`);
      setBookings(prev => prev.map(x => x.id === b.id ? { ...x, status: 'CANCELLED' } : x));
    } catch {
      alert('Cancellation failed — please try again.');
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
    <div className="page" ref={revealRef}>
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

      {/* Filter pills (reference: Time / Level / Language / Type) */}
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

      <div className="dash-grid">
        {/* Left — card-row list */}
        <div className="stack" style={{ gap: '1.4rem' }}>
          {!isAdmin && <QuickBook />}

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
                        <button className="btn btn-danger btn-sm" style={{ fontSize: '.74rem', padding: '.3em .7em' }} disabled={cancelling === b.id} onClick={() => cancelBooking(b)}>
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

        {/* Right — calendar + lists */}
        <div className="stack" style={{ gap: '1.4rem' }}>
          <MonthCalendar bookedDays={bookedDays} />

          <div className="stat-trio reveal" data-d="2">
            <div className="stat-seg"><div className="stat-seg-n">{loading ? '—' : upcomingCount}</div><div className="stat-seg-label">Upcoming</div></div>
            <div className="stat-seg"><div className="stat-seg-n">{loading ? '—' : pendingCount}</div><div className="stat-seg-label">Pending</div></div>
            <div className="stat-seg"><div className="stat-seg-n">{loading ? '—' : Math.round(approvedHours)}<span style={{ fontSize: '1rem', fontWeight: 400 }}>h</span></div><div className="stat-seg-label">Term</div></div>
          </div>

          <div className="card reveal" data-d="3">
            <div className="card-head">
              <h3>{isAdmin ? 'Recent activity' : 'Your activity'}</h3>
              {isAdmin && <Link className="btn btn-outline btn-sm" to="/admin/approvals">Approvals</Link>}
            </div>
            <div className="rail-list" style={{ padding: '0 1.3rem 1rem' }}>
              {loading && [1, 2, 3].map(i => (
                <div className="rl-item" key={i}><div className="skeleton" style={{ width: 38, height: 38, borderRadius: '50%' }} /><div style={{ flex: 1 }}><div className="skeleton" style={{ height: 12, width: '60%' }} /></div></div>
              ))}
              {!loading && activity.length === 0 && (
                <div className="empty" style={{ padding: '1.5rem 1rem' }}><span>No activity yet.</span></div>
              )}
              {!loading && activity.map((a, i) => (
                <div className="rl-item" key={i}>
                  <span className="rl-av">{initials(a.who)}</span>
                  <div className="rl-main">
                    <div className="rl-nm">{a.who}</div>
                    <div className="rl-sub">{a.sub} · {relTime(a.ts)}</div>
                  </div>
                  <span className={`rl-dot tone-${a.tone}`} />
                </div>
              ))}
            </div>
          </div>

          <div className="reveal" data-d="4">
            <div className="cmd-list">
              <Link className="cmd-item" to="/book">
                <div><div className="cmd-label">Book a room</div><div className="cmd-sub">{upcomingCount > 0 ? `${upcomingCount} scheduled` : 'No upcoming bookings'}</div></div>
                <span className="cmd-arrow">›</span>
              </Link>
              <Link className="cmd-item" to="/venues">
                <div><div className="cmd-label">Browse venues</div><div className="cmd-sub">Lecture halls · Seminar rooms · Labs</div></div>
                <span className="cmd-arrow">›</span>
              </Link>
              {isAdmin && (
                <Link className="cmd-item" to="/admin/approvals">
                  <div><div className="cmd-label">Review approvals</div><div className={`cmd-sub${pendingCount > 0 ? ' urgent' : ''}`}>{pendingCount > 0 ? `${pendingCount} waiting` : 'No pending requests'}</div></div>
                  <span className="cmd-arrow">›</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    {qrBooking && <CheckInModal booking={qrBooking} onClose={() => setQrBooking(null)} />}
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
