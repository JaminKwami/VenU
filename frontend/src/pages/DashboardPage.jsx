import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReveal } from '../hooks/useReveal';
import { useTopbar } from '../components/TopbarContext';
import { Icon } from '../components/icons';
import CheckInModal from '../components/CheckInModal';
import { dateChip, hm, hoursBetween, relTime, todayISO, STATUS_BADGE } from '../utils/venueUi';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function weekDays() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      label: d.toLocaleString('en', { weekday: 'short' }),
      n: d.getDate(),
      iso: d.toISOString().split('T')[0],
      today: d.toDateString() === now.toDateString(),
    };
  });
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

export default function DashboardPage() {
  usePageTitle('Dashboard');
  const navigate = useNavigate();
  useTopbar('Dashboard', (
    <Link className="btn btn-primary btn-sm" to="/book"><Icon.Plus width={15} height={15} /> New booking</Link>
  ));
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'STAFF';
  const [bookings, setBookings] = useState(null);
  const [qrBooking, setQrBooking] = useState(null);
  const [histStatus, setHistStatus] = useState('All');
  const [histQuery, setHistQuery] = useState('');
  const revealRef = useReveal([bookings != null]);

  useEffect(() => {
    api.get('/bookings/').then(r => setBookings(r.data.results ?? r.data)).catch(() => setBookings([]));
  }, []);

  const today = todayISO();
  const upcoming = useMemo(
    () => (bookings || [])
      .filter(b => b.date >= today && (b.status === 'APPROVED' || b.status === 'PENDING'))
      .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time)),
    [bookings, today],
  );
  const pendingCount = (bookings || []).filter(b => b.status === 'PENDING').length;
  const approvedHours = (bookings || [])
    .filter(b => b.status === 'APPROVED')
    .reduce((acc, b) => acc + hoursBetween(b.start_time, b.end_time), 0);
  const venuesUsed = new Set((bookings || []).filter(b => b.status === 'APPROVED').map(b => b.venue.id)).size;

  const mostBooked = useMemo(() => {
    const counts = {};
    (bookings || []).forEach(b => { counts[b.venue.name] = (counts[b.venue.name] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? { name: top[0], n: top[1] } : null;
  }, [bookings]);

  const activity = useMemo(
    () => (bookings || [])
      .map(b => {
        if (b.status === 'APPROVED' && b.decided_at) {
          return { color: 'var(--success)', html: <><b>{b.venue.name}</b> approved{b.decided_by ? ` by ${b.decided_by.full_name}` : ''}</>, ts: b.decided_at };
        }
        if (b.status === 'REJECTED' && b.decided_at) {
          return { color: 'var(--danger)', html: <><b>{b.venue.name}</b> declined{b.rejection_reason ? ` — ${b.rejection_reason}` : ''}</>, ts: b.decided_at };
        }
        if (b.status === 'CANCELLED') {
          return { color: 'var(--warn)', html: <><b>{b.purpose || b.venue.name}</b> cancelled</>, ts: b.updated_at };
        }
        return { color: 'var(--accent)', html: <>{isAdmin ? `${b.user.full_name} requested ` : 'You requested '}<b>{b.venue.name}</b></>, ts: b.created_at };
      })
      .sort((a, b) => new Date(b.ts) - new Date(a.ts))
      .slice(0, 5),
    [bookings, isAdmin],
  );

  const bookedDays = useMemo(() => {
    const map = {};
    (bookings || []).forEach(b => {
      if (b.status === 'APPROVED') map[b.date] = 'var(--success)';
      else if (b.status === 'PENDING' && !map[b.date]) map[b.date] = 'var(--warn)';
    });
    return map;
  }, [bookings]);

  const history = useMemo(() => {
    const q = histQuery.toLowerCase();
    return (bookings || [])
      .filter(b =>
        (histStatus === 'All' || b.status === histStatus) &&
        (!q || (b.purpose || '').toLowerCase().includes(q) ||
          b.venue.name.toLowerCase().includes(q) ||
          (b.department || '').toLowerCase().includes(q)))
      .sort((a, b) => (b.date + b.start_time).localeCompare(a.date + a.start_time));
  }, [bookings, histStatus, histQuery]);

  const todayBookings = useMemo(
    () => (bookings || [])
      .filter(b => b.date === today && b.status === 'APPROVED')
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [bookings, today],
  );

  const [cancelling, setCancelling] = useState(null);

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
    navigate('/book', {
      state: {
        venueId: b.venue.id,
        venueName: b.venue.name,
        openAtStep: 2,
      },
    });
  }

  const loading = bookings == null;
  const firstName = (user?.full_name || user?.email || '').split(/[\s@]/)[0];
  const days = weekDays();
  const upcomingCount = upcoming.filter(b => b.status === 'APPROVED').length;

  return (
    <>
    <div className="page" ref={revealRef}>
      <div className="page-head reveal">
        <span className="eyebrow">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        <h1>{greeting()}, {firstName}.</h1>
        <p>
          {loading ? 'Loading…' : isAdmin ? (
            <>{pendingCount > 0
              ? <><b>{pendingCount} booking {pendingCount === 1 ? 'request' : 'requests'}</b> {pendingCount === 1 ? 'needs' : 'need'} your approval today.</>
              : <>Queue is clear — no pending requests. {upcomingCount > 0 && <><b>{upcomingCount} confirmed {upcomingCount === 1 ? 'booking' : 'bookings'}</b> scheduled.</>}</>
            }</>
          ) : (
            <>You have <b>{upcomingCount} confirmed {upcomingCount === 1 ? 'booking' : 'bookings'}</b> coming up{pendingCount > 0 ? <> and <b>{pendingCount} {pendingCount === 1 ? 'request' : 'requests'}</b> awaiting approval</> : ''}.</>
          )}
        </p>
      </div>

      <div className="stat-ribbon reveal">
        <div className="stat-seg">
          <div className="stat-seg-n">{loading ? '—' : upcomingCount}</div>
          <div className="stat-seg-label">Upcoming</div>
        </div>
        <div className="stat-seg">
          <div className="stat-seg-n">{loading ? '—' : pendingCount}</div>
          <div className="stat-seg-label">Pending</div>
        </div>
        <div className="stat-seg">
          <div className="stat-seg-n">
            {loading ? '—' : Math.round(approvedHours)}
            {!loading && <span style={{ fontSize: '1.1rem', fontWeight: 400, letterSpacing: 0 }}>h</span>}
          </div>
          <div className="stat-seg-label">Term total</div>
        </div>
        <div className="stat-seg">
          <div className="stat-seg-n" style={{ fontSize: mostBooked ? '1rem' : undefined, letterSpacing: mostBooked ? '-.01em' : undefined, marginTop: mostBooked ? '.4rem' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {loading ? '—' : (mostBooked?.name || '—')}
          </div>
          <div className="stat-seg-label">{mostBooked ? `Most used · ${mostBooked.n} sessions` : 'Most used'}</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="stack" style={{ gap: '1.4rem' }}>
          {!isAdmin && <QuickBook />}
          <div className="card reveal">
            <div className="card-head">
              <h3>Upcoming bookings</h3>
              <Link className="btn btn-outline btn-sm" to="/venues">Book another</Link>
            </div>
            <div>
              {loading && [1, 2, 3].map(i => (
                <div key={i} className="booking-item"><div className="skeleton" style={{ width: 56, height: 56 }} /><div style={{ flex: 1 }}><div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 6 }} /><div className="skeleton" style={{ height: 12, width: '40%' }} /></div></div>
              ))}
              {!loading && upcoming.length === 0 && (
                <div className="empty">
                  <span className="ic"><Icon.Calendar width={22} height={22} /></span>
                  <span>No upcoming bookings. Ready to plan something?</span>
                  <Link className="btn btn-primary btn-sm" to="/book">New booking</Link>
                </div>
              )}
              {!loading && upcoming.slice(0, 5).map(b => {
                const chip = dateChip(b.date);
                const [cls, label] = STATUS_BADGE[b.status];
                return (
                  <div className="booking-item" key={b.id}>
                    <div className="bi-date"><span className="d">{chip.d}</span><span className="m">{chip.m}</span></div>
                    <div className="bi-main">
                      <div className="t">{b.purpose || b.venue.name}</div>
                      <div className="s">
                        {b.venue.name} · {hm(b.start_time)}–{hm(b.end_time)} · <span className="mono" style={{ fontSize: '.78rem' }}>{b.venue.capacity} cap</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexShrink: 0 }}>
                      {b.status === 'APPROVED' && b.check_in_token && (
                        <button
                          className={`bi-checkin${b.checked_in_at ? ' done' : ''}`}
                          title={b.checked_in_at ? 'Checked in — click to view code' : 'View check-in QR code'}
                          aria-label="View check-in code"
                          onClick={() => setQrBooking(b)}
                        >
                          <Icon.QR width={12} height={12} />
                          {b.checked_in_at ? 'Checked in' : 'Check in'}
                        </button>
                      )}
                      {!b.checked_in_at && (
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ fontSize: '.75rem', padding: '.3em .7em' }}
                          disabled={cancelling === b.id}
                          onClick={() => cancelBooking(b)}
                        >
                          {cancelling === b.id ? '…' : 'Cancel'}
                        </button>
                      )}
                      <span className={`badge ${cls}`}><span className="dot" />{label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card card-pad reveal">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.15rem' }}>This week</h3>
              <span className="label">{days[0].label} {days[0].n} – {days[6].label} {days[6].n}</span>
            </div>
            <div className="week-strip">
              {days.map(d => (
                <div key={d.iso} className={`wd${d.today ? ' today' : ''}`}>
                  <div className="wl">{d.label}</div>
                  <div className="wn">{d.n}</div>
                  {(d.today || bookedDays[d.iso]) && (
                    <div className="wdot" style={{ background: 'var(--ink-28)' }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card reveal">
            <div className="card-head" style={{ gap: '.8rem', flexWrap: 'wrap' }}>
              <h3>All bookings</h3>
              <div className="row" style={{ gap: '.5rem' }}>
                <button className="btn btn-outline btn-sm" onClick={() => downloadIcs().catch(() => {})}>
                  <Icon.Calendar width={14} height={14} /> Export .ics
                </button>
                <input
                  className="input" style={{ maxWidth: 180, padding: '.45rem .8rem', fontSize: '.85rem' }}
                  placeholder="Search…" value={histQuery} onChange={e => setHistQuery(e.target.value)}
                />
                <select className="select" style={{ maxWidth: 130, padding: '.45rem 2.2rem .45rem .8rem', fontSize: '.85rem' }} value={histStatus} onChange={e => setHistStatus(e.target.value)}>
                  <option>All</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>
            <div>
              {!loading && history.length === 0 && (
                <div className="empty" style={{ padding: '2rem 1rem' }}>
                  <span>{histQuery || histStatus !== 'All' ? 'Nothing matches those filters.' : 'No bookings yet.'}</span>
                </div>
              )}
              {!loading && history.slice(0, 8).map(b => {
                const chip = dateChip(b.date);
                const [cls, label] = STATUS_BADGE[b.status];
                const canCancel = ['PENDING', 'APPROVED'].includes(b.status) && b.date >= today;
                const canRetry = b.status === 'REJECTED';
                return (
                  <div className="booking-item" key={b.id}>
                    <div className="bi-date"><span className="d">{chip.d}</span><span className="m">{chip.m}</span></div>
                    <div className="bi-main">
                      <div className="t">{b.purpose || b.venue.name}</div>
                      <div className="s">{b.venue.name} · {hm(b.start_time)}–{hm(b.end_time)}{b.rejection_reason ? <> · <span style={{ color: 'var(--danger)', fontSize: '.8rem' }}>{b.rejection_reason}</span></> : null}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flexShrink: 0 }}>
                      {canRetry && (
                        <button className="btn btn-outline btn-sm" style={{ fontSize: '.75rem', padding: '.3em .7em' }} onClick={() => tryAgain(b)}>
                          Try again →
                        </button>
                      )}
                      {canCancel && (
                        <button className="btn btn-danger btn-sm" style={{ fontSize: '.75rem', padding: '.3em .7em' }} disabled={cancelling === b.id} onClick={() => cancelBooking(b)}>
                          {cancelling === b.id ? '…' : 'Cancel'}
                        </button>
                      )}
                      <span className={`badge ${cls}`}><span className="dot" />{label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: '1.4rem' }}>
          <div className="reveal" data-d="1">
            <div className="cmd-list">
              <Link className="cmd-item" to="/book">
                <div>
                  <div className="cmd-label">Book a room</div>
                  <div className="cmd-sub">
                    {upcomingCount > 0 ? `${upcomingCount} booking${upcomingCount !== 1 ? 's' : ''} scheduled` : 'No upcoming bookings'}
                  </div>
                </div>
                <span className="cmd-arrow">›</span>
              </Link>
              <Link className="cmd-item" to="/venues">
                <div>
                  <div className="cmd-label">Browse venues</div>
                  <div className="cmd-sub">Lecture halls · Seminar rooms · Labs</div>
                </div>
                <span className="cmd-arrow">›</span>
              </Link>
              {isAdmin && (
                <Link className="cmd-item" to="/admin/approvals">
                  <div>
                    <div className="cmd-label">Review approvals</div>
                    <div className={`cmd-sub${pendingCount > 0 ? ' urgent' : ''}`}>
                      {pendingCount > 0 ? `${pendingCount} waiting for decision` : 'No pending requests'}
                    </div>
                  </div>
                  <span className="cmd-arrow">›</span>
                </Link>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="card reveal" data-d="2">
              <div className="card-head"><h3>Today's schedule</h3><span className="label">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></div>
              {loading && [1, 2, 3].map(i => (
                <div key={i} className="sched-row"><div className="skeleton" style={{ width: '100%', height: 13 }} /></div>
              ))}
              {!loading && todayBookings.length === 0 && (
                <div className="empty" style={{ padding: '1.5rem 1rem' }}><span>No bookings scheduled today.</span></div>
              )}
              {!loading && todayBookings.map(b => (
                <div className="sched-row" key={b.id}>
                  <span className="sched-time">{hm(b.start_time)}</span>
                  <span className="sched-bar" />
                  <div className="sched-info">
                    <div className="sched-venue">{b.venue.name}</div>
                    <div className="sched-who">{b.user?.full_name || b.user?.email} · {hm(b.start_time)}–{hm(b.end_time)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card reveal" data-d="3">
            <div className="card-head"><h3>Recent activity</h3></div>
            <div className="activity">
              {loading && [1, 2, 3].map(i => (
                <div key={i} className="act-item" style={{ gap: 0 }}><div className="skeleton" style={{ width: '100%', height: 14 }} /></div>
              ))}
              {!loading && activity.length === 0 && (
                <div className="empty" style={{ padding: '2rem 1rem' }}><span>No activity yet.</span></div>
              )}
              {!loading && activity.map((a, i) => (
                <div className="act-item" key={i} style={{ paddingLeft: '1.3rem' }}>
                  <div>
                    <div className="at">{a.html}</div>
                    <div className="ax">{relTime(a.ts)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>

    {qrBooking && (
      <CheckInModal booking={qrBooking} onClose={() => setQrBooking(null)} />
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
        <button
          className="btn btn-primary btn-block"
          disabled={!venueId || hour === null}
          onClick={go}
        >
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
