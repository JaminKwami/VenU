import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReveal } from '../hooks/useReveal';
import { useTopbar } from '../components/TopbarContext';
import { Icon } from '../components/icons';
import { hm, prettyDate, todayISO, venueGradient } from '../utils/venueUi';

function initials(name) {
  return (name || '?').split(/[\s@.]/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}

const PILLS = [
  { id: 'arrivals', label: 'Arrivals' },
  { id: 'onsite', label: 'Keys out' },
  { id: 'returned', label: 'Returned' },
  { id: 'all', label: 'All today' },
];

export default function FrontDeskPage() {
  usePageTitle('Front desk');
  useTopbar('Front desk', null);
  const [bookings, setBookings] = useState(null);
  const [filter, setFilter] = useState('arrivals');
  const [query, setQuery] = useState('');
  const [acting, setActing] = useState(null);
  const [error, setError] = useState('');
  const revealRef = useReveal([bookings != null, filter]);

  const today = todayISO();

  function load() {
    api.get('/bookings/')
      .then(r => setBookings(r.data.results ?? r.data))
      .catch(() => setBookings([]));
  }
  useEffect(load, []);

  const todays = useMemo(
    () => (bookings || []).filter(b => b.date === today && b.status === 'APPROVED'),
    [bookings, today],
  );

  const keysOut = todays.filter(b => b.checked_in_at && !b.key_returned_at).length;

  const nowHM = new Date().toTimeString().slice(0, 5);

  const list = useMemo(() => {
    const q = query.toLowerCase();
    let arr = todays.filter(b => !q
      || (b.user?.full_name || b.user?.email || '').toLowerCase().includes(q)
      || b.venue.name.toLowerCase().includes(q)
      || (b.purpose || '').toLowerCase().includes(q));
    if (filter === 'arrivals') arr = arr.filter(b => !b.checked_in_at);
    else if (filter === 'onsite') arr = arr.filter(b => b.checked_in_at && !b.key_returned_at);
    else if (filter === 'returned') arr = arr.filter(b => b.key_returned_at);
    return arr.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [todays, filter, query]);

  async function checkIn(b) {
    setActing(b.id); setError('');
    try {
      const { data } = await api.post(`/bookings/${b.id}/checkin/`);
      setBookings(prev => prev.map(x => x.id === b.id ? { ...x, ...data } : x));
    } catch (err) {
      setError(err.response?.data?.detail || 'Check-in failed.');
    } finally { setActing(null); }
  }

  async function returnKey(b) {
    setActing(b.id); setError('');
    try {
      const { data } = await api.post(`/bookings/${b.id}/return-key/`);
      setBookings(prev => prev.map(x => x.id === b.id ? { ...x, ...data } : x));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update.');
    } finally { setActing(null); }
  }

  const loading = bookings == null;

  return (
    <div className="page" style={{ maxWidth: 1100 }} ref={revealRef}>
      <div className="page-head reveal">
        <span className="eyebrow">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <h1>Front desk</h1>
        <p>
          {loading ? 'Loading today’s bookings…'
            : <>{todays.length} booking{todays.length !== 1 ? 's' : ''} today · <b>{keysOut} key{keysOut !== 1 ? 's' : ''} out</b></>}
        </p>
      </div>

      <div className="filter-pills reveal">
        {PILLS.map(p => (
          <button key={p.id} className={`fp${filter === p.id ? ' on' : ''}`} onClick={() => setFilter(p.id)}>{p.label}</button>
        ))}
        <div className="search-box fp-search">
          <Icon.Search />
          <input className="input" placeholder="Search name or venue…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </div>

      {error && <div className="conflict reveal in" style={{ marginBottom: '1rem' }}><Icon.X strokeWidth={2} /><span>{error}</span></div>}

      <div className="lo-list">
        {loading && [1, 2, 3].map(i => (
          <div className="lo-card" key={i}>
            <div className="skeleton" style={{ width: 84, height: 84, borderRadius: 'var(--r-lg)' }} />
            <div style={{ flex: 1 }}><div className="skeleton" style={{ height: 16, width: '50%', marginBottom: 8 }} /><div className="skeleton" style={{ height: 12, width: '70%' }} /></div>
          </div>
        ))}

        {!loading && list.length === 0 && (
          <div className="card empty" style={{ padding: '3rem 1rem' }}>
            <span className="ic"><Icon.Calendar width={22} height={22} /></span>
            <span>{filter === 'arrivals' ? 'No one waiting to check in.' : 'Nothing here right now.'}</span>
          </div>
        )}

        {!loading && list.map(b => {
          const name = b.user?.full_name || b.user?.email || 'Guest';
          const checkedIn = !!b.checked_in_at;
          const returned = !!b.key_returned_at;
          const overdue = !checkedIn && b.start_time.slice(0, 5) < nowHM;
          return (
            <div className="lo-card" key={b.id}>
              <div className="lo-thumb" style={{ background: venueGradient(b.venue.id) }}>
                <span className="fd-av">{initials(name)}</span>
              </div>
              <div className="lo-body">
                <div className="lo-title">{name}</div>
                <div className="lo-desc">
                  {b.venue.name}{b.venue.building ? ` · ${b.venue.building}` : ''} · {hm(b.start_time)}–{hm(b.end_time)}
                  {b.purpose ? ` · ${b.purpose}` : ''}
                </div>
                <div className="lo-meta">
                  {returned ? <span className="badge badge-neutral"><span className="dot" />Key returned</span>
                    : checkedIn ? <span className="badge badge-approved"><span className="dot" />Key out</span>
                    : overdue ? <span className="badge badge-rejected"><span className="dot" />Overdue</span>
                    : <span className="badge badge-pending"><span className="dot" />Expected {hm(b.start_time)}</span>}
                  {b.attendee_count != null && <span className="lo-tag mono">{b.attendee_count} ppl</span>}
                </div>
              </div>
              <div className="fd-actions">
                {!checkedIn && (
                  <button className="btn btn-primary btn-sm" disabled={acting === b.id} onClick={() => checkIn(b)}>
                    {acting === b.id ? '…' : 'Check in & hand key'}
                  </button>
                )}
                {checkedIn && !returned && (
                  <button className="btn btn-outline btn-sm" disabled={acting === b.id} onClick={() => returnKey(b)}>
                    {acting === b.id ? '…' : 'Key returned'}
                  </button>
                )}
                {returned && <span className="fd-done"><Icon.Check width={16} height={16} /></span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
