import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';
import { Icon } from '../components/icons';
import { hm, todayISO } from '../utils/venueUi';
import { initials } from './mobileUi';
import { useFeedback } from './MobileFeedback';

const FILTERS = [
  { id: 'arrivals', label: 'Arrivals' },
  { id: 'onsite', label: 'Keys out' },
  { id: 'returned', label: 'Returned' },
  { id: 'all', label: 'All' },
];

export default function FrontDesk() {
  usePageTitle('Front desk');
  const [bookings, setBookings] = useState(null);
  const [filter, setFilter] = useState('arrivals');
  const [acting, setActing] = useState(null);
  const { toast } = useFeedback();
  const today = todayISO();

  useEffect(() => {
    api.get('/bookings/')
      .then((r) => setBookings(r.data.results ?? r.data))
      .catch(() => setBookings([]));
  }, []);

  const loading = bookings == null;
  const todays = useMemo(
    () => (bookings || []).filter((b) => b.date === today && b.status === 'APPROVED'),
    [bookings, today],
  );
  const keysOut = todays.filter((b) => b.checked_in_at && !b.key_returned_at).length;
  const nowHM = new Date().toTimeString().slice(0, 5);

  const list = useMemo(() => {
    let arr = [...todays];
    if (filter === 'arrivals') arr = arr.filter((b) => !b.checked_in_at);
    else if (filter === 'onsite') arr = arr.filter((b) => b.checked_in_at && !b.key_returned_at);
    else if (filter === 'returned') arr = arr.filter((b) => b.key_returned_at);
    return arr.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [todays, filter]);

  async function checkIn(b) {
    setActing(b.id);
    try {
      const { data } = await api.post(`/bookings/${b.id}/checkin/`);
      setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, ...data } : x)));
      toast('Checked in · key handed over');
    } catch (err) {
      toast(err.response?.data?.detail || 'Check-in failed.');
    } finally { setActing(null); }
  }

  async function returnKey(b) {
    setActing(b.id);
    try {
      const { data } = await api.post(`/bookings/${b.id}/return-key/`);
      setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, ...data } : x)));
      toast('Key returned');
    } catch (err) {
      toast(err.response?.data?.detail || 'Failed to update.');
    } finally { setActing(null); }
  }

  return (
    <>
      <div className="m-top-bar"><h1>Front desk</h1></div>

      <div className="m-queue-banner static">
        <div>
          <div className="qb-n">{loading ? '—' : keysOut}</div>
          <div className="qb-l">key{keysOut === 1 ? '' : 's'} currently out</div>
        </div>
      </div>

      <div className="m-filter-row">
        {FILTERS.map((f) => (
          <button key={f.id} className={`chip${filter === f.id ? ' active' : ''}`} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>

      {loading && [1, 2].map((i) => (
        <div className="m-queue-card" key={i}>
          <div className="skel" style={{ height: 14, width: '60%', marginBottom: 8 }} />
          <div className="skel" style={{ height: 12, width: '80%' }} />
        </div>
      ))}

      {!loading && list.length === 0 && (
        <div className="m-empty" style={{ padding: '50px 20px' }}>
          <div className="m-empty-ic"><Icon.Key width={26} height={26} /></div>
          <p>{filter === 'arrivals' ? 'No one waiting to check in.' : 'Nothing here right now.'}</p>
        </div>
      )}

      {!loading && list.map((b) => {
        const name = b.user?.full_name || b.user?.email || 'Guest';
        const checkedIn = !!b.checked_in_at;
        const returned = !!b.key_returned_at;
        const overdue = !checkedIn && b.start_time.slice(0, 5) < nowHM;
        return (
          <div className="m-queue-card" key={b.id}>
            <div className="m-qc-head">
              <div className="m-qc-avatar">{initials(name)}</div>
              <div className="m-qc-info">
                <div className="m-qc-title">{name}</div>
                <div className="m-qc-meta">{b.venue.name} · {hm(b.start_time)}–{hm(b.end_time)}</div>
              </div>
              {returned ? <span className="badge badge-neutral">Returned</span>
                : checkedIn ? <span className="badge badge-approved">Key out</span>
                : overdue ? <span className="badge badge-rejected">Overdue</span>
                : <span className="badge badge-pending">{hm(b.start_time)}</span>}
            </div>

            {!returned && (
              <div className="m-qc-actions">
                {!checkedIn ? (
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={acting === b.id} onClick={() => checkIn(b)}>
                    <Icon.Key width={16} height={16} /> {acting === b.id ? '…' : 'Check in & hand key'}
                  </button>
                ) : (
                  <button className="btn btn-ghost" style={{ flex: 1 }} disabled={acting === b.id} onClick={() => returnKey(b)}>
                    {acting === b.id ? '…' : 'Key returned'}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
