import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';
import { Icon } from '../components/icons';
import CheckInModal from '../components/CheckInModal';
import { hm, dateChip, todayISO } from '../utils/venueUi';
import { M_STATUS } from './mobileUi';
import { useFeedback } from './MobileFeedback';

const TABS = ['Upcoming', 'Past', 'Pending'];

export default function MyBookings() {
  usePageTitle('My bookings');
  const navigate = useNavigate();
  const [bookings, setBookings] = useState(null);
  const [tab, setTab] = useState(0);
  const [cancelling, setCancelling] = useState(null);
  const [qrBooking, setQrBooking] = useState(null);
  const { toast, confirm } = useFeedback();

  useEffect(() => {
    api.get('/bookings/')
      .then((r) => setBookings(r.data.results ?? r.data))
      .catch(() => setBookings([]));
  }, []);

  const today = todayISO();
  const loading = bookings == null;
  const all = bookings || [];

  const filtered = useMemo(() => {
    const list = all.filter((b) => {
      if (tab === 0) return b.date >= today && ['APPROVED', 'PENDING'].includes(b.status);
      if (tab === 1) return b.date < today || ['REJECTED', 'CANCELLED'].includes(b.status);
      if (tab === 2) return b.status === 'PENDING';
      return true;
    });
    return list.sort((a, b) =>
      tab === 1
        ? (b.date + b.start_time).localeCompare(a.date + a.start_time)
        : (a.date + a.start_time).localeCompare(b.date + b.start_time),
    );
  }, [all, tab, today]);

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

  function tryAgain(b) {
    navigate('/book', { state: { venueId: b.venue.id, venueName: b.venue.name } });
  }

  const EMPTY = ['No upcoming bookings.', 'Nothing in your history yet.', 'No pending requests.'];

  return (
    <>
      <div className="m-top-bar"><h1>My bookings</h1></div>

      <div className="m-filter-tabs">
        {TABS.map((t, i) => (
          <button key={t} className={`m-ftab${tab === i ? ' active' : ''}`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      <div className="m-blist">
        {loading && [1, 2, 3].map((i) => (
          <div className="card m-blist-card" key={i}>
            <div className="m-bcard">
              <div className="skel" style={{ width: 52, height: 52, borderRadius: 16 }} />
              <div style={{ flex: 1 }}>
                <div className="skel" style={{ height: 14, width: '60%', marginBottom: 6 }} />
                <div className="skel" style={{ height: 12, width: '40%' }} />
              </div>
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="m-empty" style={{ padding: '60px 20px' }}>
            <div className="m-empty-ic"><Icon.Calendar width={26} height={26} /></div>
            <p>{EMPTY[tab]}</p>
          </div>
        )}

        {!loading && filtered.map((b) => {
          const [cls, label] = M_STATUS[b.status];
          const chip = dateChip(b.date);
          const canCancel = ['APPROVED', 'PENDING'].includes(b.status) && b.date >= today;
          const canRetry = b.status === 'REJECTED';
          const canCheckIn = b.status === 'APPROVED' && b.check_in_token && b.date >= today;
          return (
            <div className="card m-blist-card" key={b.id}>
              <div className="m-bcard">
                <div className="m-bc-date"><span className="d">{chip.d}</span><span className="m">{chip.m}</span></div>
                <div className="m-bc-info">
                  <div className="bt">{b.purpose || b.venue.name}</div>
                  <div className="bs">{b.venue.name} · {hm(b.start_time)}–{hm(b.end_time)}</div>
                </div>
                <span className={`badge ${cls}`}><span className="dot" />{label}</span>
              </div>
              {(b.rejection_reason || canCancel || canRetry || canCheckIn) && (
                <div className="m-bcard-foot">
                  {b.rejection_reason && <span className="m-reason">{b.rejection_reason}</span>}
                  {canCheckIn && (
                    <button className="m-mini-btn" onClick={() => setQrBooking(b)}>
                      <Icon.QR width={13} height={13} /> {b.checked_in_at ? 'Checked in' : 'Check in'}
                    </button>
                  )}
                  {canRetry && (
                    <button className="m-mini-btn" onClick={() => tryAgain(b)}>Try again →</button>
                  )}
                  {canCancel && (
                    <button className="m-mini-btn danger" disabled={cancelling === b.id} onClick={() => cancelBooking(b)}>
                      {cancelling === b.id ? '…' : 'Cancel'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {qrBooking && <CheckInModal booking={qrBooking} onClose={() => setQrBooking(null)} />}
    </>
  );
}
