import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { usePageTitle } from '../hooks/usePageTitle';
import { Icon } from '../components/icons';
import { hm, dateChip, todayISO } from '../utils/venueUi';
import { M_STATUS, greeting, firstNameOf, weekDays } from './mobileUi';
import { useFeedback } from './MobileFeedback';

export default function HomeScreen() {
  usePageTitle('Home');
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = ['ADMIN', 'RECEPTIONIST'].includes(user?.role);
  const [bookings, setBookings] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const { toast, confirm } = useFeedback();

  useEffect(() => {
    api.get('/bookings/')
      .then((r) => setBookings(r.data.results ?? r.data))
      .catch(() => setBookings([]));
  }, []);

  const today = todayISO();
  const all = bookings || [];
  const loading = bookings == null;

  const bookedSet = useMemo(() => {
    const s = new Set();
    all.forEach((b) => { if (b.status === 'APPROVED' || b.status === 'PENDING') s.add(b.date); });
    return s;
  }, [all]);
  const days = weekDays(bookedSet);

  const upcoming = useMemo(
    () => all
      .filter((b) => b.date >= today && ['APPROVED', 'PENDING'].includes(b.status))
      .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time)),
    [all, today],
  );
  const upcomingCount = upcoming.filter((b) => b.status === 'APPROVED').length;
  const pendingCount = all.filter((b) => b.status === 'PENDING').length;
  const todaySchedule = useMemo(
    () => all
      .filter((b) => b.date === today && b.status === 'APPROVED')
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [all, today],
  );
  const approvedToday = all.filter((b) => b.status === 'APPROVED' && b.decided_at?.startsWith(today)).length;

  async function cancelBooking(b) {
    const ok = await confirm({
      title: 'Cancel this booking?',
      message: `${b.venue.name} on ${b.date}. This can't be undone.`,
      confirmLabel: 'Cancel booking',
      cancelLabel: 'Keep it',
      danger: true,
    });
    if (!ok) return;
    setCancelling(b.id);
    try {
      await api.patch(`/bookings/${b.id}/cancel/`);
      setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, status: 'CANCELLED' } : x)));
      toast('Booking cancelled');
    } catch {
      toast('Cancellation failed — please try again.');
    } finally {
      setCancelling(null);
    }
  }

  const dateLine = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <>
      <header className="m-hero">
        <div className="m-eyebrow">{dateLine}</div>
        <h1>{greeting()}, {firstNameOf(user)}.</h1>
        <p className="m-hero-sub">
          {loading ? 'Loading your bookings…' : isAdmin
            ? `${pendingCount} pending ${pendingCount === 1 ? 'request needs' : 'requests need'} your attention.`
            : `${upcomingCount} confirmed ${upcomingCount === 1 ? 'booking' : 'bookings'} this week.`}
        </p>
        {!isAdmin && (
          <div className="m-hero-cta">
            <button className="btn btn-block m-hero-btn" onClick={() => navigate('/book')}>
              <Icon.Plus width={18} height={18} /> Book a room
            </button>
          </div>
        )}
      </header>

      {isAdmin ? (
        <AdminHome
          pendingCount={pendingCount}
          approvedToday={approvedToday}
          todaySchedule={todaySchedule}
          loading={loading}
          navigate={navigate}
        />
      ) : (
        <>
          <div className="m-week-strip">
            {days.map((d) => (
              <div key={d.iso} className={`m-wd${d.today ? ' today' : ''}${d.booked ? ' booked' : ''}`}>
                <span className="m-wl">{d.label}</span>
                <span className="m-wn">{d.n}</span>
                {(d.today || d.booked) && <span className="m-wdot" />}
              </div>
            ))}
          </div>

          <div className="m-section-title">Upcoming</div>
          {loading ? (
            <div className="card m-list-card">
              {[1, 2, 3].map((i) => (
                <div className="m-bcard" key={i}>
                  <div className="skel" style={{ width: 52, height: 52, borderRadius: 16 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skel" style={{ height: 14, width: '60%', marginBottom: 6 }} />
                    <div className="skel" style={{ height: 12, width: '40%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="card m-list-card">
              <div className="m-empty">
                <div className="m-empty-ic"><Icon.Calendar width={26} height={26} /></div>
                <p>No upcoming bookings yet. Ready to plan something?</p>
                <button className="btn btn-primary" onClick={() => navigate('/book')}>Book a room</button>
              </div>
            </div>
          ) : (
            <div className="card m-list-card">
              {upcoming.slice(0, 4).map((b) => {
                const [cls, label] = M_STATUS[b.status];
                const chip = dateChip(b.date);
                return (
                  <div className="m-bcard" key={b.id}>
                    <div className="m-bc-date"><span className="d">{chip.d}</span><span className="m">{chip.m}</span></div>
                    <div className="m-bc-info">
                      <div className="bt">{b.purpose || b.venue.name}</div>
                      <div className="bs">{b.venue.name} · {hm(b.start_time)}–{hm(b.end_time)}</div>
                    </div>
                    <div className="m-bc-side">
                      <span className={`badge ${cls}`}><span className="dot" />{label}</span>
                      <button
                        className="m-mini-btn danger"
                        disabled={cancelling === b.id}
                        onClick={() => cancelBooking(b)}
                      >
                        {cancelling === b.id ? '…' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="m-section-title">Quick facts</div>
          <div className="m-stat-grid">
            <div className="card m-stat">
              <div className="m-stat-n" style={{ color: 'var(--accent)' }}>{loading ? '—' : upcomingCount}</div>
              <div className="m-stat-l">Confirmed</div>
            </div>
            <div className="card m-stat">
              <div className="m-stat-n" style={{ color: pendingCount > 0 ? 'var(--warn)' : 'var(--ink)' }}>{loading ? '—' : pendingCount}</div>
              <div className="m-stat-l">Awaiting ok</div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function AdminHome({ pendingCount, approvedToday, todaySchedule, loading, navigate }) {
  return (
    <>
      <button className="m-queue-banner" onClick={() => navigate('/approvals')}>
        <div>
          <div className="qb-n">{loading ? '—' : pendingCount}</div>
          <div className="qb-l">pending {pendingCount === 1 ? 'request' : 'requests'}</div>
        </div>
        <span className="qb-link">Review all →</span>
      </button>

      <div className="m-section-title">Today's schedule</div>
      {loading ? (
        <div className="card m-list-card">
          {[1, 2].map((i) => (
            <div className="m-sched-row" key={i}><div className="skel" style={{ height: 36, width: '100%' }} /></div>
          ))}
        </div>
      ) : todaySchedule.length === 0 ? (
        <div className="card m-list-card">
          <div className="m-empty"><p>No bookings scheduled for today.</p></div>
        </div>
      ) : (
        <div className="card m-list-card">
          {todaySchedule.map((b) => (
            <div className="m-sched-row" key={b.id}>
              <span className="m-sched-time">{hm(b.start_time)}</span>
              <span className="m-sched-bar" />
              <div className="m-sched-info">
                <div className="sv">{b.venue.name}</div>
                <div className="sw">{b.user?.full_name || b.user?.email} · {hm(b.start_time)}–{hm(b.end_time)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="m-section-title">Quick facts</div>
      <div className="m-stat-grid">
        <div className="card m-stat">
          <div className="m-stat-n" style={{ color: 'var(--success)' }}>{loading ? '—' : approvedToday}</div>
          <div className="m-stat-l">Approved today</div>
        </div>
        <div className="card m-stat">
          <div className="m-stat-n" style={{ color: pendingCount > 0 ? 'var(--warn)' : 'var(--ink)' }}>{loading ? '—' : pendingCount}</div>
          <div className="m-stat-l">In queue</div>
        </div>
      </div>
    </>
  );
}
