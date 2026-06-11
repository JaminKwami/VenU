import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';

function VenuePreview({ venue }) {
  if (!venue) return null;
  return (
    <div style={{
      padding: '0.85rem 1rem',
      background: 'rgba(0,0,0,0.04)',
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--border)',
      marginTop: '0.5rem',
      display: 'flex',
      gap: '0.75rem',
      alignItems: 'flex-start',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{venue.name}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--ink-2)', marginTop: '0.15rem' }}>
          {venue.location} &nbsp;·&nbsp; Capacity {venue.capacity}
        </div>
      </div>
    </div>
  );
}

function AvailabilityPanel({ slots, loading }) {
  if (loading) return (
    <div style={{ marginTop: '0.5rem' }}>
      <div className="skeleton" style={{ height: 14, width: '60%' }} />
    </div>
  );
  if (slots === null) return null;
  return (
    <div style={{
      marginTop: '0.5rem',
      padding: '0.75rem 1rem',
      borderRadius: 'var(--r-sm)',
      border: '1px solid var(--border)',
      background: slots.length ? 'var(--warning-bg, rgba(146,64,14,0.06))' : 'var(--success-bg, rgba(21,128,61,0.06))',
      fontSize: '0.8rem',
    }}>
      {slots.length === 0 ? (
        <span style={{ color: 'var(--success, #15803d)', fontWeight: 600 }}>
          All time slots are free on this date.
        </span>
      ) : (
        <>
          <div style={{ fontWeight: 600, marginBottom: '0.35rem', color: 'var(--ink)' }}>
            Already taken on this date:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {slots.map((s, i) => (
              <span key={i} style={{
                padding: '0.15rem 0.55rem',
                borderRadius: 99,
                border: '1px solid var(--border)',
                background: '#fff',
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--ink-2)',
              }}>
                {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                {s.status === 'PENDING' && <span style={{ color: 'var(--ink-3)' }}> (pending)</span>}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function BookingPage() {
  usePageTitle('New Booking');
  const navigate = useNavigate();
  const { state } = useLocation();
  const [venues, setVenues] = useState([]);
  const [form, setForm] = useState({
    venue: state?.venueId ? String(state.venueId) : '',
    date: '', start_time: '', end_time: '', purpose: '', attendee_count: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [takenSlots, setTakenSlots] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    api.get('/venues/').then(r => setVenues(r.data));
  }, []);

  // Fetch availability whenever venue + date are both chosen.
  useEffect(() => {
    if (!form.venue || !form.date) { setTakenSlots(null); return; }
    let stale = false;
    setSlotsLoading(true);
    api.get('/bookings/availability/', { params: { venue: form.venue, date: form.date } })
      .then(r => { if (!stale) setTakenSlots(r.data.taken_slots); })
      .catch(() => { if (!stale) setTakenSlots(null); })
      .finally(() => { if (!stale) setSlotsLoading(false); });
    return () => { stale = true; };
  }, [form.venue, form.date]);

  const selectedVenue = venues.find(v => v.id === Number(form.venue));

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  }

  // Client-side overlap check so users get instant feedback.
  const hasLocalConflict = takenSlots?.some(s =>
    form.start_time && form.end_time &&
    form.start_time < s.end_time.slice(0, 5) &&
    form.end_time > s.start_time.slice(0, 5)
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.venue) { setError('Please select a venue.'); return; }
    if (form.start_time >= form.end_time) { setError('End time must be after start time.'); return; }
    if (selectedVenue && form.attendee_count && Number(form.attendee_count) > selectedVenue.capacity) {
      setError(`Attendee count exceeds the venue capacity of ${selectedVenue.capacity}.`);
      return;
    }
    setError(''); setLoading(true);
    try {
      await api.post('/bookings/', {
        ...form,
        venue: Number(form.venue),
        attendee_count: form.attendee_count ? Number(form.attendee_count) : null,
      });
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 2200);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not submit — check for conflicts and try again.');
    } finally {
      setLoading(false);
    }
  }

  const today = new Date().toISOString().split('T')[0];

  if (success) return (
    <div className="page-content fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-bg)', border: '2px solid var(--success-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <h2>Booking submitted!</h2>
      <p>Your request is pending admin approval.<br/>Redirecting you to the dashboard…</p>
    </div>
  );

  return (
    <div className="page-content fade-up">
      <div className="page-header">
        <div>
          <h1>New Booking</h1>
          <p>Request a space for your event or activity</p>
        </div>
      </div>

      <div style={{ maxWidth: 540 }}>
        <form className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} onSubmit={handleSubmit}>

          {/* Venue */}
          <div>
            <label className="label">Venue</label>
            <select className="select" name="venue" value={form.venue} onChange={handleChange} required>
              <option value="">Select a venue…</option>
              {venues.map(v => (
                <option key={v.id} value={v.id}>{v.name} — {v.location} (cap {v.capacity})</option>
              ))}
            </select>
            <VenuePreview venue={selectedVenue} />
          </div>

          {/* Date */}
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" name="date" value={form.date} onChange={handleChange} required min={today} />
            <AvailabilityPanel slots={takenSlots} loading={slotsLoading} />
          </div>

          {/* Time range */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="label">Start</label>
              <input className="input" type="time" name="start_time" value={form.start_time} onChange={handleChange} required />
            </div>
            <div>
              <label className="label">End</label>
              <input className="input" type="time" name="end_time" value={form.end_time} onChange={handleChange} required />
            </div>
          </div>

          {/* Conflict warning */}
          {hasLocalConflict && (
            <p className="error-msg" style={{ marginTop: -8 }}>
              This time overlaps an existing booking — pick a different slot.
            </p>
          )}

          {/* Duration hint */}
          {form.start_time && form.end_time && form.end_time > form.start_time && (() => {
            const [sh, sm] = form.start_time.split(':').map(Number);
            const [eh, em] = form.end_time.split(':').map(Number);
            const mins = (eh * 60 + em) - (sh * 60 + sm);
            const h = Math.floor(mins / 60), m = mins % 60;
            return (
              <div style={{ marginTop: -8, fontSize: '0.78rem', color: 'var(--ink-3)' }}>
                Duration: {h > 0 ? `${h}h ` : ''}{m > 0 ? `${m}m` : ''}
              </div>
            );
          })()}

          {/* Attendees */}
          <div>
            <label className="label">Expected attendees <span style={{ color: 'var(--ink-3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <input
              className="input"
              type="number"
              name="attendee_count"
              min="1"
              max={selectedVenue?.capacity || undefined}
              placeholder={selectedVenue ? `Up to ${selectedVenue.capacity}` : 'e.g. 30'}
              value={form.attendee_count}
              onChange={handleChange}
            />
          </div>

          {/* Purpose */}
          <div>
            <label className="label">Purpose <span style={{ color: 'var(--ink-3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <input className="input" name="purpose" placeholder="e.g. Study group, Lecture, Club meeting…" value={form.purpose} onChange={handleChange} />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button className="btn btn-primary" type="submit" disabled={loading || hasLocalConflict} style={{ width: '100%', padding: '0.75rem' }}>
            {loading ? 'Submitting…' : 'Submit booking request'}
          </button>
        </form>
      </div>
    </div>
  );
}
