import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { usePageTitle } from '../hooks/usePageTitle';
import { useTopbar } from '../components/TopbarContext';
import { Icon } from '../components/icons';
import '../styles/venue-calendar.css';

// ── constants ─────────────────────────────────────────────────────────────────
const HOUR_START = 7;   // 07:00
const HOUR_END   = 22;  // 22:00 (exclusive row boundary)
const HOURS      = HOUR_END - HOUR_START; // 15 visible hours

const STATUS_COLOR = {
  APPROVED: 'var(--success)',
  PENDING:  'var(--warn)',
};

// ── helpers ───────────────────────────────────────────────────────────────────
function isoWeekStart(refISO) {
  const d = new Date(refISO + 'T00:00:00');
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - ((day + 6) % 7)); // shift to Monday
  return d.toISOString().split('T')[0];
}

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function shortDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return {
    wd: d.toLocaleString('en', { weekday: 'short' }),
    n:  d.getDate(),
    isToday: iso === todayISO(),
  };
}

/** Convert HH:MM:SS to fractional hours past midnight. */
function timeToHours(t) {
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
}

/** Position a slot within the visible grid (0–100 %). */
function slotStyle(start_time, end_time) {
  const s = Math.max(timeToHours(start_time), HOUR_START);
  const e = Math.min(timeToHours(end_time),   HOUR_END);
  const top    = ((s - HOUR_START) / HOURS) * 100;
  const height = ((e - s)          / HOURS) * 100;
  return { top: `${top}%`, height: `${Math.max(height, 1.5)}%` };
}

function hm(t) {
  const [h, m] = t.split(':');
  return `${h}:${m}`;
}

// ── component ─────────────────────────────────────────────────────────────────
export default function VenueCalendarPage() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'STAFF';

  const [venue, setVenue]   = useState(null);
  const [slots, setSlots]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => isoWeekStart(todayISO()));

  usePageTitle(venue ? `${venue.name} — Calendar` : 'Calendar');
  useTopbar(venue?.name || 'Calendar', (
    <Link className="btn btn-outline btn-sm" to={`/venues/${id}`}>
      <Icon.Venues width={15} height={15} /> Venue details
    </Link>
  ), [id, venue?.name]);

  useEffect(() => {
    api.get(`/venues/${id}/`).then(r => setVenue(r.data)).catch(() => {});
  }, [id]);

  const weekEnd = addDays(weekStart, 6);

  const fetchSlots = useCallback(() => {
    setLoading(true);
    const params = { venue: id, date_from: weekStart, date_to: weekEnd };
    api.get('/bookings/availability/', { params })
      .then(r => setSlots(r.data.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [id, weekStart, weekEnd]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const slotsByDay = useMemo(() => {
    const map = {};
    days.forEach(d => { map[d] = []; });
    slots.forEach(s => { if (map[s.date]) map[s.date].push(s); });
    return map;
  }, [slots, days]);

  const hourLabels = Array.from({ length: HOURS + 1 }, (_, i) => {
    const h = HOUR_START + i;
    return `${String(h).padStart(2, '0')}:00`;
  });

  const prevWeek = () => setWeekStart(w => addDays(w, -7));
  const nextWeek = () => setWeekStart(w => addDays(w,  7));
  const goToday  = () => setWeekStart(isoWeekStart(todayISO()));

  const rangeLabel = (() => {
    const fmt = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
  })();

  return (
    <div className="page vcal-page">
      <div className="page-head">
        <span className="eyebrow">{venue?.building || venue?.location || 'Venue calendar'}</span>
        <h1>{venue?.name || '…'}</h1>
        {!isAdmin && (
          <p className="muted" style={{ fontSize: '.88rem' }}>Showing your bookings only. Contact an admin to see all reservations.</p>
        )}
      </div>

      <div className="vcal-nav">
        <div className="row" style={{ gap: '.5rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={prevWeek}><Icon.ChevronLeft width={16} height={16} /></button>
          <button className="btn btn-ghost btn-sm" onClick={nextWeek}><Icon.ChevronRight width={16} height={16} /></button>
          <button className="btn btn-outline btn-sm" onClick={goToday}>Today</button>
        </div>
        <span className="vcal-range">{rangeLabel}</span>
        <Link className="btn btn-primary btn-sm" to={`/book?venue=${id}`}>
          <Icon.Plus width={14} height={14} /> Book this space
        </Link>
      </div>

      <div className="vcal-wrap card">
        {loading && <div className="vcal-loading"><div className="skeleton" style={{ width: '100%', height: '100%', borderRadius: 'var(--r-lg)' }} /></div>}

        {/* Header row: day labels */}
        <div className="vcal-grid">
          <div className="vcal-timecol" />
          {days.map(iso => {
            const { wd, n, isToday } = shortDate(iso);
            return (
              <div key={iso} className={`vcal-dayhdr${isToday ? ' today' : ''}`}>
                <span className="vcal-wd">{wd}</span>
                <span className="vcal-dn">{n}</span>
              </div>
            );
          })}
        </div>

        {/* Body: time lanes + booking blocks */}
        <div className="vcal-body-wrap">
          <div className="vcal-grid vcal-body">
            {/* Time labels */}
            <div className="vcal-timecol vcal-labels">
              {hourLabels.map(label => (
                <div key={label} className="vcal-hlabel">{label}</div>
              ))}
            </div>

            {/* Day columns */}
            {days.map(iso => {
              const daySlots = slotsByDay[iso] || [];
              const { isToday } = shortDate(iso);
              return (
                <div key={iso} className={`vcal-daycol${isToday ? ' today' : ''}`}>
                  {/* Hour grid lines */}
                  {Array.from({ length: HOURS }, (_, i) => (
                    <div key={i} className="vcal-hline" style={{ top: `${(i / HOURS) * 100}%` }} />
                  ))}
                  {/* Booking blocks */}
                  {daySlots.map((s, i) => {
                    const color = STATUS_COLOR[s.status] || 'var(--accent)';
                    return (
                      <div
                        key={i}
                        className="vcal-block"
                        style={{ ...slotStyle(s.start_time, s.end_time), borderColor: color }}
                        title={`${hm(s.start_time)}–${hm(s.end_time)}${s.purpose ? ` · ${s.purpose}` : ''}`}
                      >
                        <span className="vcal-block-dot" style={{ background: color }} />
                        <span className="vcal-block-time">{hm(s.start_time)}–{hm(s.end_time)}</span>
                        {s.purpose && <span className="vcal-block-title">{s.purpose}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="vcal-legend">
        <span className="vcal-leg-item"><span className="vcal-leg-dot" style={{ background: 'var(--success)' }} />Approved</span>
        <span className="vcal-leg-item"><span className="vcal-leg-dot" style={{ background: 'var(--warn)' }} />Pending</span>
      </div>
    </div>
  );
}
