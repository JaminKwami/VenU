import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReveal } from '../hooks/useReveal';
import { useTopbar } from '../components/TopbarContext';
import { Icon } from '../components/icons';
import { todayISO, prettyDate } from '../utils/venueUi';

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const pad = (h) => `${String(h).padStart(2, '0')}:00`;

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

/* Returns 'mine' | 'approved' | 'pending' | null for a venue's hour cell. */
function cellState(slots, hour) {
  const s = pad(hour);
  const e = pad(hour + 1);
  let state = null;
  for (const slot of slots) {
    if (slot.start_time < e && slot.end_time > s) {
      if (slot.mine) return 'mine';
      state = slot.status === 'APPROVED' ? 'approved' : 'pending';
    }
  }
  return state;
}

export default function TimetablePage() {
  usePageTitle('Timetable');
  useTopbar('Find a room');
  const navigate = useNavigate();
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const revealRef = useReveal([data != null, date]);

  useEffect(() => {
    setData(null); setError(false);
    api.get('/bookings/day-grid/', { params: { date } })
      .then((r) => setData(r.data))
      .catch(() => setError(true));
  }, [date]);

  const isPast = date < todayISO();
  const isToday = date === todayISO();
  const currentHour = isToday ? new Date().getHours() : null;
  const venues = data?.venues || [];
  const loading = data == null && !error;

  const summary = useMemo(() => {
    if (!venues.length) return null;
    const free = venues.filter((v) => HOURS.some((h) => !cellState(v.slots, h))).length;
    return { total: venues.length, free };
  }, [venues]);

  function book(venueId, hour) {
    if (isPast) return;
    navigate('/book', { state: { venueId, date, hour } });
  }

  return (
    <div className="page" style={{ maxWidth: 1280 }} ref={revealRef}>
      <div className="page-head reveal">
        <span className="eyebrow">Availability</span>
        <h1>Find a room</h1>
        <p>Every room's free time at a glance. Tap a green slot to request it.</p>
      </div>

      <div className="tt-toolbar reveal">
        <div className="tt-nav">
          <button className="btn btn-outline btn-sm" aria-label="Previous day" onClick={() => setDate((d) => addDays(d, -1))}><Icon.ChevronLeft width={16} height={16} /></button>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 170 }} />
          <button className="btn btn-outline btn-sm" aria-label="Next day" onClick={() => setDate((d) => addDays(d, 1))}><Icon.ChevronRight width={16} height={16} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => setDate(todayISO())}>Today</button>
        </div>
        <div className="tt-legend">
          <span><i className="tt-sw free" /> Free</span>
          <span><i className="tt-sw approved"><Icon.X width={10} height={10} /></i> Booked</span>
          <span><i className="tt-sw pending"><Icon.Clock width={10} height={10} /></i> Pending</span>
          <span><i className="tt-sw mine"><Icon.Check width={10} height={10} /></i> Yours</span>
        </div>
      </div>

      {summary && !loading && (
        <p className="muted reveal" style={{ margin: '0 0 1rem', fontSize: '.9rem' }}>
          {prettyDate(date)} · <b style={{ color: 'var(--ink)' }}>{summary.free}</b> of {summary.total} rooms have free time.
        </p>
      )}

      {error && <div className="conflict reveal in"><Icon.X strokeWidth={2} /><span>Couldn't load the timetable. Please try again.</span></div>}

      {!error && (
        <div className="tt-scroll reveal">
          <div className="tt-grid" style={{ gridTemplateColumns: `var(--tt-name) repeat(${HOURS.length}, 1fr)` }}>
            <div className="tt-corner">Room</div>
            {HOURS.map((h) => <div key={h} className={`tt-head${h === currentHour ? ' tt-now' : ''}`}>{pad(h)}</div>)}

            {loading && [1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ display: 'contents' }}>
                <div className="tt-name"><div className="skeleton" style={{ height: 14, width: '70%' }} /></div>
                {HOURS.map((h) => <div key={h} className="tt-cell"><div className="skeleton" style={{ height: '100%', borderRadius: 4 }} /></div>)}
              </div>
            ))}

            {!loading && venues.map((v) => (
              <div key={v.id} style={{ display: 'contents' }}>
                <button className="tt-name tt-name-btn" onClick={() => navigate(`/venues/${v.id}`)} title={`${v.name} · ${v.capacity} cap`}>
                  <span className="tt-name-t">{v.name}</span>
                  <span className="tt-name-m">{v.capacity} cap</span>
                </button>
                {HOURS.map((h) => {
                  const st = cellState(v.slots, h);
                  const free = !st;
                  return (
                    <button
                      key={h}
                      className={`tt-cell tt-c-${st || (isPast ? 'past' : 'free')}`}
                      disabled={!free || isPast}
                      title={free ? `${v.name} · ${pad(h)} — free` : `${pad(h)} — ${st === 'mine' ? 'yours' : st}`}
                      onClick={() => book(v.id, h)}
                    >
                      {st === 'approved' && <Icon.X width={13} height={13} />}
                      {st === 'pending' && <Icon.Clock width={13} height={13} />}
                      {st === 'mine' && <Icon.Check width={13} height={13} />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {!loading && venues.length === 0 && (
            <div className="empty" style={{ padding: '2.5rem 1rem' }}><span>No bookable rooms available.</span></div>
          )}
        </div>
      )}
    </div>
  );
}
