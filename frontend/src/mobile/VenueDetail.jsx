import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';
import { Icon } from '../components/icons';
import { hm, todayISO, venueGradient } from '../utils/venueUi';

const SLOT_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const pad = (h) => `${String(h).padStart(2, '0')}:00`;

function slotBusy(taken, hour) {
  const start = pad(hour);
  const end = pad(hour + 1);
  return (taken || []).some((s) => hm(s.start_time) < end && hm(s.end_time) > start);
}

export default function VenueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [venue, setVenue] = useState(null);
  const [missing, setMissing] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [taken, setTaken] = useState([]);
  const [slot, setSlot] = useState(null);
  usePageTitle(venue?.name || 'Venue');

  useEffect(() => {
    api.get(`/venues/${id}/`).then((r) => setVenue(r.data)).catch(() => setMissing(true));
  }, [id]);

  useEffect(() => {
    let stale = false;
    api.get('/bookings/availability/', { params: { venue: id, date } })
      .then((r) => { if (!stale) setTaken(r.data.taken_slots || []); })
      .catch(() => { if (!stale) setTaken([]); });
    return () => { stale = true; };
  }, [id, date]);

  if (missing) {
    return (
      <div className="m-empty" style={{ padding: '80px 24px' }}>
        <div className="m-empty-ic"><Icon.Venues width={26} height={26} /></div>
        <p>Venue not found.</p>
        <button className="btn btn-primary" onClick={() => navigate('/venues')}>Back to venues</button>
      </div>
    );
  }

  if (!venue) {
    return (
      <>
        <div className="skel" style={{ height: 200, borderRadius: '0 0 28px 28px' }} />
        <div style={{ padding: 20 }}>
          <div className="skel" style={{ height: 16, width: '60%', marginBottom: 10 }} />
          <div className="skel" style={{ height: 12, width: '80%' }} />
        </div>
      </>
    );
  }

  const meta = [venue.building, venue.location, venue.venue_type].filter(Boolean).join(' · ');

  return (
    <div className="m-vd">
      <header className="m-vd-hero" style={{ background: venueGradient(venue.id) }}>
        <div className="m-iso" />
        <div className="m-vd-hero-top">
          <button className="m-vd-back" aria-label="Back" onClick={() => navigate(-1)}>
            <Icon.ArrowLeft width={20} height={20} />
          </button>
          <span className="m-vd-cap">CAP {venue.capacity}</span>
        </div>
        <div className="m-vd-hero-name">
          <h1>{venue.name}</h1>
          <div className="m-vd-loc">{meta}</div>
        </div>
      </header>

      <div className="m-vd-specs">
        <div className="m-vd-spec"><span className="sl">Capacity</span><span className="sv">{venue.capacity}</span></div>
        <div className="m-vd-spec"><span className="sl">Type</span><span className="sv">{venue.venue_type || '—'}</span></div>
        <div className="m-vd-spec"><span className="sl">Min notice</span><span className="sv">{venue.min_notice_hours ? `${venue.min_notice_hours}h` : 'None'}</span></div>
      </div>

      {venue.description && (
        <div className="m-vd-block">
          <div className="m-section-title" style={{ padding: '0 0 8px' }}>About this space</div>
          <p className="m-vd-desc">{venue.description}</p>
        </div>
      )}

      {(venue.amenities || []).length > 0 && (
        <div className="m-vd-block">
          <div className="m-section-title" style={{ padding: '0 0 8px' }}>Amenities</div>
          <div className="m-vd-amen">
            {venue.amenities.map((a) => (
              <span className="m-vd-amen-item" key={a}><Icon.Check width={14} height={14} /> {a}</span>
            ))}
          </div>
        </div>
      )}

      <div className="m-vd-block">
        <div className="m-section-title" style={{ padding: '0 0 8px' }}>Check availability</div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="m-vd-date">Date</label>
          <input id="m-vd-date" className="input" type="date" min={todayISO()} value={date} onChange={(e) => { setDate(e.target.value); setSlot(null); }} />
        </div>
        <div className="m-vd-slots">
          {SLOT_HOURS.map((h) => {
            const busy = slotBusy(taken, h);
            return (
              <button
                key={h}
                className={`m-time-btn${slot === h ? ' on' : ''}${busy ? ' busy' : ''}`}
                disabled={busy}
                onClick={() => setSlot(h)}
              >
                {pad(h)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="m-vd-footer">
        <button
          className="btn btn-primary btn-block"
          disabled={!venue.is_active}
          onClick={() => navigate('/book', { state: { venueId: venue.id, venueName: venue.name, date, hour: slot } })}
        >
          {venue.is_active ? <>Request this space <Icon.Arrow width={18} height={18} /></> : 'Currently unavailable'}
        </button>
      </div>
    </div>
  );
}
