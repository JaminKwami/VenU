import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../api/axios';
import { Icon } from '../components/icons';
import '../styles/kiosk.css';

/* ── helpers ──────────────────────────────────────────────────────────────── */
function fmt(t) { return t ? t.slice(0, 5) : '—'; }
function prettyDate(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

const STATUS_LABEL = {
  APPROVED: 'Approved',
  PENDING: 'Pending',
  CANCELLED: 'Cancelled',
  REJECTED: 'Declined',
};

/* ── KioskPage ────────────────────────────────────────────────────────────── */
export default function CheckInKioskPage() {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') || '');
  const [input, setInput] = useState('');
  const [booking, setBooking] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | loading | found | done | error
  const [errMsg, setErrMsg] = useState('');
  const inputRef = useRef(null);

  // If a token arrives via URL (from QR scan), auto-lookup
  useEffect(() => {
    const t = params.get('token');
    if (t) { setToken(t); lookup(t); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus input when idle
  useEffect(() => {
    if (phase === 'idle') inputRef.current?.focus();
  }, [phase]);

  // Auto-reset after 20 s of "done"
  useEffect(() => {
    if (phase !== 'done') return;
    const t = setTimeout(reset, 20_000);
    return () => clearTimeout(t);
  }, [phase]);

  function reset() {
    setPhase('idle');
    setBooking(null);
    setToken('');
    setInput('');
    setErrMsg('');
  }

  async function lookup(tok) {
    const t = (tok || token).trim();
    if (!t) return;
    setPhase('loading');
    try {
      const { data } = await api.get('/bookings/kiosk/', { params: { token: t } });
      setBooking(data);
      setPhase('found');
    } catch (e) {
      setErrMsg(e.response?.data?.detail || 'Token not found. Check the code and try again.');
      setPhase('error');
    }
  }

  async function checkIn() {
    setPhase('loading');
    try {
      const { data } = await api.post('/bookings/kiosk/', { token });
      setBooking(data);
      setPhase('done');
    } catch (e) {
      setErrMsg(e.response?.data?.detail || 'Check-in failed. Please contact facilities.');
      setPhase('error');
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const t = input.trim();
    if (!t) return;
    setToken(t);
    lookup(t);
  }

  const alreadyIn = booking?.checked_in_at;

  /* ── Render ── */
  return (
    <div className="kiosk-shell">
      <div className="kiosk-brand">
        <span className="kiosk-logo">VenU</span>
        <span className="kiosk-tagline">Venue Check-in · Security Desk</span>
      </div>

      {/* ── IDLE: code entry ── */}
      {(phase === 'idle' || phase === 'loading') && (
        <div className="kiosk-card">
          <div className="kiosk-card-icon"><Icon.QR width={44} height={44} /></div>
          <h1 className="kiosk-h1">Scan or enter check-in code</h1>
          <p className="kiosk-sub">
            Ask the guest to show their QR code, or type the 8-character code
            from their confirmation email.
          </p>
          <form onSubmit={handleSubmit} className="kiosk-form">
            <input
              ref={inputRef}
              className="kiosk-input"
              value={input}
              onChange={e => setInput(e.target.value.toUpperCase())}
              placeholder="e.g. A3F9C12E or full UUID"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              disabled={phase === 'loading'}
            />
            <button
              type="submit"
              className="kiosk-btn kiosk-btn-primary"
              disabled={!input.trim() || phase === 'loading'}
            >
              {phase === 'loading' ? 'Looking up…' : 'Look up booking'}
            </button>
          </form>
        </div>
      )}

      {/* ── FOUND: show booking card, await confirmation ── */}
      {phase === 'found' && booking && (
        <div className={`kiosk-card kiosk-found${alreadyIn ? ' already-in' : ''}`}>
          <div className={`kiosk-status-chip ${alreadyIn ? 'chip-done' : 'chip-ok'}`}>
            {alreadyIn ? '✓ Already checked in' : '● Valid booking'}
          </div>

          <div className="kiosk-venue">{booking.venue_name}</div>
          <div className="kiosk-time">
            {fmt(booking.start_time)} – {fmt(booking.end_time)}
          </div>
          <div className="kiosk-date">{prettyDate(booking.date)}</div>

          <div className="kiosk-divider" />

          <div className="kiosk-detail-grid">
            <div className="kd"><span>Guest</span><strong>{booking.booker_name}</strong></div>
            <div className="kd"><span>Attendees</span><strong>{booking.attendee_count ?? '—'}</strong></div>
            <div className="kd"><span>Purpose</span><strong>{booking.purpose || '—'}</strong></div>
            <div className="kd"><span>Department</span><strong>{booking.department || '—'}</strong></div>
            <div className="kd"><span>Status</span><strong>{STATUS_LABEL[booking.status] || booking.status}</strong></div>
            {alreadyIn && (
              <div className="kd"><span>Checked in at</span><strong>{new Date(booking.checked_in_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</strong></div>
            )}
          </div>

          <div className="kiosk-actions">
            {!alreadyIn && booking.status === 'APPROVED' && (
              <button className="kiosk-btn kiosk-btn-checkin" onClick={checkIn}>
                <Icon.Check width={22} height={22} strokeWidth={2.5} /> Confirm check-in
              </button>
            )}
            {(alreadyIn || booking.status !== 'APPROVED') && (
              <p className="kiosk-note">
                {alreadyIn
                  ? `Checked in at ${new Date(booking.checked_in_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. No further action needed.`
                  : `Booking status is "${STATUS_LABEL[booking.status]}". This booking cannot be checked in.`}
              </p>
            )}
            <button className="kiosk-btn kiosk-btn-ghost" onClick={reset}>
              Back
            </button>
          </div>
        </div>
      )}

      {/* ── DONE: success splash ── */}
      {phase === 'done' && booking && (
        <div className="kiosk-card kiosk-success">
          <div className="kiosk-success-icon">✓</div>
          <h1 className="kiosk-h1">Checked in!</h1>
          <div className="kiosk-venue" style={{ marginTop: '.5rem' }}>{booking.venue_name}</div>
          <div className="kiosk-time">{fmt(booking.start_time)} – {fmt(booking.end_time)}</div>
          <p className="kiosk-sub" style={{ marginTop: '1rem' }}>
            Welcome, <strong>{booking.booker_name}</strong>. Have a great session.
          </p>
          <button className="kiosk-btn kiosk-btn-ghost" style={{ marginTop: '2rem' }} onClick={reset}>
            Check in another guest
          </button>
          <p className="kiosk-countdown">Screen resets in 20 s</p>
        </div>
      )}

      {/* ── ERROR ── */}
      {phase === 'error' && (
        <div className="kiosk-card kiosk-error">
          <div className="kiosk-error-icon">✗</div>
          <h1 className="kiosk-h1">Not found</h1>
          <p className="kiosk-sub">{errMsg}</p>
          <button className="kiosk-btn kiosk-btn-ghost" style={{ marginTop: '2rem' }} onClick={reset}>
            Try again
          </button>
        </div>
      )}

      <div className="kiosk-footer">Powered by VenU · AroLabs</div>
    </div>
  );
}
