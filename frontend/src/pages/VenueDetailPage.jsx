import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReveal } from '../hooks/useReveal';
import { useTopbar } from '../components/TopbarContext';
import { Icon } from '../components/icons';
import { venueGradient, hm, prettyDate, todayISO } from '../utils/venueUi';

const SLOT_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function slotBusy(takenSlots, hour) {
  const start = `${String(hour).padStart(2, '0')}:00`;
  const end = `${String(hour + 1).padStart(2, '0')}:00`;
  return (takenSlots || []).some(s => hm(s.start_time) < end && hm(s.end_time) > start);
}

export default function VenueDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [venue, setVenue] = useState(null);
  const [missing, setMissing] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [days, setDays] = useState({});           // iso → taken_slots
  const [myBookings, setMyBookings] = useState([]);
  const [slot, setSlot] = useState(null);
  usePageTitle(venue?.name || 'Venue');
  useTopbar('Venue', null, [id]);
  const revealRef = useReveal([venue != null]);

  useEffect(() => {
    api.get(`/venues/${id}/`).then(r => setVenue(r.data)).catch(() => setMissing(true));
    api.get('/bookings/').then(r => setMyBookings(r.data.results ?? r.data)).catch(() => {});
  }, [id]);

  useEffect(() => {
    let stale = false;
    const isos = [date, addDays(date, 1), addDays(date, 2)];
    Promise.all(
      isos.map(d =>
        api.get('/bookings/availability/', { params: { venue: id, date: d } })
          .then(r => [d, r.data.taken_slots])
          .catch(() => [d, []]),
      ),
    ).then(entries => { if (!stale) setDays(Object.fromEntries(entries)); });
    return () => { stale = true; };
  }, [id, date]);

  const mineByDate = useMemo(() => {
    const map = {};
    myBookings
      .filter(b => String(b.venue.id) === String(id) && ['PENDING', 'APPROVED'].includes(b.status))
      .forEach(b => { (map[b.date] = map[b.date] || []).push(b); });
    return map;
  }, [myBookings, id]);

  function slotMine(iso, hour) {
    const start = `${String(hour).padStart(2, '0')}:00`;
    const end = `${String(hour + 1).padStart(2, '0')}:00`;
    return (mineByDate[iso] || []).some(b => hm(b.start_time) < end && hm(b.end_time) > start);
  }

  if (missing) {
    return (
      <div className="page">
        <div className="empty card" style={{ borderRadius: 'var(--r-lg)' }}>
          <span>Venue not found.</span>
          <Link className="btn btn-primary btn-sm" to="/venues">Back to venues</Link>
        </div>
      </div>
    );
  }
  if (!venue) {
    return (
      <div className="page" style={{ maxWidth: 1280 }}>
        <div className="skeleton" style={{ height: 280, borderRadius: 'var(--r-xl)', marginBottom: '1.6rem' }} />
        <div className="skeleton" style={{ height: 120, borderRadius: 'var(--r-lg)' }} />
      </div>
    );
  }

  const g = venueGradient(venue.id);
  const selectedTaken = days[date] || [];
  const slotStartHour = slot != null ? slot : null;
  const slotLabel = slotStartHour != null
    ? `${String(slotStartHour).padStart(2, '0')}:00 – ${String(slotStartHour + 1).padStart(2, '0')}:00`
    : 'Pick a time';

  return (
    <div className="page" style={{ maxWidth: 1280 }} ref={revealRef}>
      <div className="crumb reveal">
        <Link to="/venues">Venues</Link> <span>/</span>
        {venue.building && <><Link to="/venues">{venue.building}</Link> <span>/</span></>}
        <span style={{ color: 'var(--ink)' }}>{venue.name}</span>
      </div>

      <div className="v-hero reveal" style={{ background: g }}>
        <div className="iso" /><div className="shade" />
        <div className="htop">
          <span className={`badge ${venue.is_active ? 'badge-approved' : 'badge-cancelled'}`} style={{ background: 'rgba(255,255,255,.9)' }}>
            <span className="dot" />{venue.is_active ? 'Bookable' : 'Unavailable'}
          </span>
          <div className="row" style={{ gap: '.5rem' }}>
            <Link
              to={`/venues/${id}/calendar`}
              className="btn btn-sm"
              style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.3)', backdropFilter: 'blur(4px)' }}
            >
              <Icon.Calendar width={14} height={14} /> Full calendar
            </Link>
            <span className="badge" style={{ background: 'rgba(0,0,0,.3)', color: '#fff', backdropFilter: 'blur(4px)' }}>
              CAP {venue.capacity}
            </span>
          </div>
        </div>
        <div className="hname">
          <h1>{venue.name}</h1>
          <div className="loc">{[venue.building, venue.location, venue.venue_type].filter(Boolean).join(' · ')}</div>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <div className="spec-row reveal">
            <div className="spec"><div className="sl">Capacity</div><div className="sv">{venue.capacity}</div></div>
            <div className="spec"><div className="sl">Type</div><div className="sv" style={{ fontSize: '1.1rem', marginTop: '.6rem' }}>{venue.venue_type || '—'}</div></div>
            <div className="spec"><div className="sl">Building</div><div className="sv" style={{ fontSize: '1.1rem', marginTop: '.6rem' }}>{venue.building || venue.location}</div></div>
            <div className="spec"><div className="sl">Min notice</div><div className="sv" style={{ fontSize: '1.1rem', marginTop: '.6rem' }}>{venue.min_notice_hours ? `${venue.min_notice_hours} hrs` : 'None'}</div></div>
          </div>

          {venue.description && (
            <div className="sec-block reveal">
              <h2>About this space</h2>
              <p>{venue.description}</p>
            </div>
          )}

          {(venue.amenities || []).length > 0 && (
            <div className="sec-block reveal">
              <h2>Amenities</h2>
              <div className="amen-grid">
                {venue.amenities.map(a => (
                  <div className="amen-item" key={a}><Icon.Check strokeWidth={1.8} /> {a}</div>
                ))}
              </div>
            </div>
          )}

          <div className="sec-block reveal">
            <h2>Availability · {prettyDate(date)} – {prettyDate(addDays(date, 2))}</h2>
            <div className="card card-pad">
              <div className="avail">
                <div className="avail-row avail-ticks" aria-hidden="true">
                  <span className="dl" />
                  <div className="slot-track">
                    {SLOT_HOURS.map(h => (
                      <span key={h} className="slot-tick">{String(h).padStart(2, '0')}</span>
                    ))}
                  </div>
                </div>
                {[date, addDays(date, 1), addDays(date, 2)].map(iso => (
                  <div className="avail-row" key={iso}>
                    <span className="dl">{prettyDate(iso).split(' ')[0]}</span>
                    <div className="slot-track">
                      {SLOT_HOURS.map(h => (
                        <span
                          key={h}
                          className={`slot${slotMine(iso, h) ? ' mine' : slotBusy(days[iso], h) ? ' busy' : ''}`}
                          title={`${String(h).padStart(2, '0')}:00`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="legend">
                <span><i style={{ background: 'var(--success-soft)' }} /> Available</span>
                <span><i style={{ background: 'var(--canvas-2)' }} /> Booked</span>
                <span><i style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-line)' }} /> Your booking</span>
              </div>
            </div>
          </div>
        </div>

        <aside>
          <div className="card book-panel reveal" data-d="1">
            <h3>Request this space</h3>
            <p className="muted" style={{ fontSize: '.86rem', margin: '.3rem 0 1.2rem' }}>
              Conflicts are checked before you submit — requests go to a facilities admin for approval.
            </p>
            <div className="field" style={{ marginBottom: '1rem' }}>
              <label htmlFor="vd-date">Date</label>
              <input id="vd-date" className="input" type="date" min={todayISO()} value={date} onChange={e => { setDate(e.target.value); setSlot(null); }} />
            </div>
            <div className="field" style={{ marginBottom: '1rem' }}>
              <label htmlFor="vd-slot">Time slot</label>
              <div className="pill-times">
                {SLOT_HOURS.map(h => {
                  const busy = slotBusy(selectedTaken, h);
                  return (
                    <button
                      key={h}
                      disabled={busy}
                      className={slot === h ? 'on' : ''}
                      onClick={() => setSlot(h)}
                    >
                      {String(h).padStart(2, '0')}:00
                    </button>
                  );
                })}
              </div>
            </div>
            <hr className="divider" style={{ margin: '.4rem 0 1rem' }} />
            <div className="summary-line"><span className="muted">Slot</span><span>{slotLabel}</span></div>
            <div className="summary-line"><span className="muted">Capacity</span><span>{venue.capacity} {venue.venue_type === 'Lecture hall' ? 'seats' : 'people'}</span></div>
            <div className="summary-line"><span className="muted">Approval</span><span>Facilities admin</span></div>
            <div className="summary-line tot"><span>Status</span><span style={{ color: 'var(--warn)' }}>Pending on submit</span></div>
            <button
              className="btn btn-primary btn-lg btn-block"
              style={{ marginTop: '1.1rem' }}
              disabled={!venue.is_active}
              onClick={() => navigate('/book', { state: { venueId: venue.id, date, hour: slot } })}
            >
              Continue to request <Icon.Arrow width={16} height={16} />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
