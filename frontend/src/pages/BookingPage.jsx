import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';

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
          📍 {venue.location} &nbsp;·&nbsp; 👥 Capacity {venue.capacity}
        </div>
      </div>
    </div>
  );
}

export default function BookingPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [venues, setVenues] = useState([]);
  const [form, setForm] = useState({
    venue: state?.venueId ? String(state.venueId) : '',
    date: '', start_time: '', end_time: '', purpose: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/venues/').then(r => setVenues(r.data));
  }, []);

  const selectedVenue = venues.find(v => v.id === Number(form.venue));

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.venue) { setError('Please select a venue.'); return; }
    if (form.start_time >= form.end_time) { setError('End time must be after start time.'); return; }
    setError(''); setLoading(true);
    try {
      await api.post('/bookings/', { ...form, venue: Number(form.venue) });
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

          {/* Purpose */}
          <div>
            <label className="label">Purpose <span style={{ color: 'var(--ink-3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <input className="input" name="purpose" placeholder="e.g. Study group, Lecture, Club meeting…" value={form.purpose} onChange={handleChange} />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '0.75rem' }}>
            {loading ? 'Submitting…' : 'Submit booking request'}
          </button>
        </form>
      </div>
    </div>
  );
}


