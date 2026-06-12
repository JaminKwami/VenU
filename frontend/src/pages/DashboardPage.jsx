import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReveal } from '../hooks/useReveal';
import { useTopbar } from '../components/TopbarContext';
import { Icon } from '../components/icons';
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

export default function DashboardPage() {
  usePageTitle('Dashboard');
  useTopbar('Dashboard', (
    <Link className="btn btn-primary btn-sm" to="/book"><Icon.Plus width={15} height={15} /> New booking</Link>
  ));
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'STAFF';
  const [bookings, setBookings] = useState(null);
  const revealRef = useReveal([bookings != null]);

  useEffect(() => {
    api.get('/bookings/').then(r => setBookings(r.data)).catch(() => setBookings([]));
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

  const loading = bookings == null;
  const firstName = (user?.full_name || user?.email || '').split(/[\s@]/)[0];
  const days = weekDays();
  const upcomingCount = upcoming.filter(b => b.status === 'APPROVED').length;

  return (
    <div className="page" ref={revealRef}>
      <div className="page-head reveal">
        <span className="eyebrow">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        <h1>{greeting()}, {firstName}.</h1>
        <p>
          {loading ? 'Loading your bookings…' : (
            <>You have <b style={{ color: 'var(--ink)' }}>{upcomingCount} confirmed {upcomingCount === 1 ? 'booking' : 'bookings'}</b> coming up and <b style={{ color: 'var(--warn)' }}>{pendingCount} {pendingCount === 1 ? 'request' : 'requests'}</b> awaiting approval.</>
          )}
        </p>
      </div>

      <div className="stats-row">
        <div className="card stat-card reveal">
          <span className="stat-accent" />
          <div className="stat-label">Upcoming</div>
          <div className="stat-val">{loading ? '—' : upcomingCount}</div>
          <div className="muted" style={{ fontSize: '.8rem' }}>bookings confirmed</div>
        </div>
        <div className="card stat-card reveal" data-d="1">
          <span className="stat-accent" style={{ background: 'var(--warn)' }} />
          <div className="stat-label">Pending</div>
          <div className="stat-val">{loading ? '—' : pendingCount}</div>
          <div className="muted" style={{ fontSize: '.8rem' }}>awaiting approval</div>
        </div>
        <div className="card stat-card reveal" data-d="2">
          <span className="stat-accent" style={{ background: 'var(--success)' }} />
          <div className="stat-label">Hours booked</div>
          <div className="stat-val">{loading ? '—' : Math.round(approvedHours)}</div>
          <div className="muted" style={{ fontSize: '.8rem' }}>across {venuesUsed} {venuesUsed === 1 ? 'venue' : 'venues'}</div>
        </div>
        <div className="card stat-card reveal" data-d="3">
          <span className="stat-accent" style={{ background: 'var(--coral)' }} />
          <div className="stat-label">Most booked</div>
          <div className="stat-val" style={{ fontSize: '1.5rem', marginTop: '1rem' }}>{loading ? '—' : (mostBooked?.name || '—')}</div>
          <div className="muted" style={{ fontSize: '.8rem' }}>{mostBooked ? `${mostBooked.n} ${mostBooked.n === 1 ? 'session' : 'sessions'}` : 'no bookings yet'}</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="stack" style={{ gap: '1.4rem' }}>
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
                      <div className="s">{b.venue.name} · {hm(b.start_time)}–{hm(b.end_time)} · <span className="mono" style={{ fontSize: '.78rem' }}>{b.venue.capacity} cap</span></div>
                    </div>
                    <span className={`badge ${cls}`}><span className="dot" />{label}</span>
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
                    <div className="wdot" style={{ background: bookedDays[d.iso] || 'var(--accent)' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: '1.4rem' }}>
          <div className="card card-pad reveal" data-d="1">
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>Quick actions</h3>
            <div className="qa">
              <Link to="/book">
                <span className="qi"><Icon.Plus strokeWidth={2} /></span>
                <div><div className="qt">New booking</div><div className="qd">Request a space in seconds</div></div>
              </Link>
              <Link to="/venues">
                <span className="qi" style={{ background: 'var(--coral)' }}><Icon.Venues strokeWidth={1.8} /></span>
                <div><div className="qt">Browse venues</div><div className="qd">Explore every bookable space</div></div>
              </Link>
              {isAdmin && (
                <Link to="/admin/approvals">
                  <span className="qi" style={{ background: 'var(--success)' }}><Icon.Approvals strokeWidth={1.8} /></span>
                  <div><div className="qt">Review approvals</div><div className="qd">{pendingCount} {pendingCount === 1 ? 'request' : 'requests'} in the queue</div></div>
                </Link>
              )}
            </div>
          </div>

          <div className="card reveal" data-d="2">
            <div className="card-head"><h3>Recent activity</h3></div>
            <div className="activity">
              {loading && [1, 2, 3].map(i => (
                <div key={i} className="act-item"><div className="skeleton" style={{ width: '100%', height: 14 }} /></div>
              ))}
              {!loading && activity.length === 0 && (
                <div className="empty" style={{ padding: '2rem 1rem' }}><span>No activity yet.</span></div>
              )}
              {!loading && activity.map((a, i) => (
                <div className="act-item" key={i}>
                  <span className="ad" style={{ background: a.color }} />
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
  );
}
