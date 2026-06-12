import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Icon } from './icons';

/* ── CheckInModal ─────────────────────────────────────────────────────────────
   Shows the full QR code + short code for a booking's check-in token.
   Opens when user clicks the check-in chip on their Dashboard booking item.
────────────────────────────────────────────────────────────────────────────── */
export default function CheckInModal({ booking, onClose }) {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const token = booking.check_in_token;
  // Short display code: first 8 hex chars of the UUID (strip dashes)
  const shortCode = token?.replace(/-/g, '').slice(0, 8).toUpperCase() ?? '';
  // URL that the QR encodes — opens the kiosk pre-filled
  const kioskUrl = `${window.location.origin}/checkin?token=${token}`;

  useEffect(() => {
    if (!canvasRef.current || !token) return;
    QRCode.toCanvas(canvasRef.current, kioskUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: getComputedStyle(document.documentElement)
          .getPropertyValue('--ink').trim() || '#1a1a1a',
        light: '#ffffff00', // transparent background
      },
    });
  }, [token, kioskUrl]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function copyCode() {
    navigator.clipboard.writeText(shortCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function fmt(t) { return t ? t.slice(0, 5) : '—'; }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Check-in code"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="checkin-modal">
        <div className="checkin-modal-head">
          <div>
            <div className="checkin-modal-title">Your check-in code</div>
            <div className="checkin-modal-sub">Show this to security or scan at the kiosk</div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Close check-in modal"
          >
            <Icon.X width={16} height={16} />
          </button>
        </div>

        <div className="checkin-qr-area">
          <canvas ref={canvasRef} className="checkin-qr-canvas" />
        </div>

        <div className="checkin-code-row">
          <span className="checkin-code">{shortCode}</span>
          <button
            className={`btn btn-sm ${copied ? 'btn-success' : 'btn-outline'}`}
            onClick={copyCode}
            aria-label="Copy check-in code"
          >
            {copied ? <><Icon.Check width={13} height={13} /> Copied</> : 'Copy'}
          </button>
        </div>

        <div className="checkin-booking-info">
          <div className="cbi-row">
            <span>Venue</span>
            <strong>{booking.venue?.name}</strong>
          </div>
          <div className="cbi-row">
            <span>Date</span>
            <strong>{new Date(booking.date + 'T00:00:00').toLocaleDateString('en-GB', {
              weekday: 'short', day: 'numeric', month: 'short',
            })}</strong>
          </div>
          <div className="cbi-row">
            <span>Time</span>
            <strong>{fmt(booking.start_time)} – {fmt(booking.end_time)}</strong>
          </div>
        </div>

        {booking.checked_in_at ? (
          <div className="checkin-done-banner">
            <Icon.Check width={16} height={16} strokeWidth={2.5} />
            Checked in at{' '}
            {new Date(booking.checked_in_at).toLocaleTimeString('en-GB', {
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
        ) : (
          <p className="checkin-hint">
            The QR code and short code both work. The short code is handy if
            the scanner isn't available — just read it out to the desk.
          </p>
        )}
      </div>
    </div>
  );
}
