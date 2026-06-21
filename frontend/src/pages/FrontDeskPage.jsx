import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReveal } from '../hooks/useReveal';
import { useTopbar } from '../components/TopbarContext';
import { Icon } from '../components/icons';
import { hm, todayISO, venueGradient } from '../utils/venueUi';

function initials(name) {
  return (name || '?').split(/[\s@.]/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}

function since(ts) {
  const m = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

const PILLS = [
  { id: 'arrivals', label: 'Arrivals' },
  { id: 'onsite', label: 'Keys out' },
  { id: 'returned', label: 'Returned' },
  { id: 'all', label: 'All today' },
];

export default function FrontDeskPage() {
  usePageTitle('Front desk');
  const [bookings, setBookings] = useState(null);
  const [handouts, setHandouts] = useState([]);
  const [filter, setFilter] = useState('arrivals');
  const [query, setQuery] = useState('');
  const [acting, setActing] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const revealRef = useReveal([bookings != null, filter]);

  useTopbar('Front desk', (
    <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
      <Icon.Key width={15} height={15} /> Hand out key
    </button>
  ));

  const today = todayISO();

  function load() {
    api.get('/bookings/').then(r => setBookings(r.data.results ?? r.data)).catch(() => setBookings([]));
    api.get('/bookings/key-handouts/?status=all').then(r => setHandouts(r.data)).catch(() => setHandouts([]));
  }
  useEffect(load, []);

  const todays = useMemo(
    () => (bookings || []).filter(b => b.date === today && b.status === 'APPROVED'),
    [bookings, today],
  );

  // Normalise both sources into one card shape.
  const items = useMemo(() => {
    const out = [];
    todays.forEach(b => {
      const checkedIn = !!b.checked_in_at;
      const returned = !!b.key_returned_at;
      out.push({
        kind: 'booking', id: `b${b.id}`, raw: b,
        who: b.user?.full_name || b.user?.email || 'Guest',
        room: `${b.venue.name}${b.venue.building ? ` · ${b.venue.building}` : ''}`,
        sub: `Booking · ${hm(b.start_time)}–${hm(b.end_time)}`,
        gradId: b.venue.id,
        state: returned ? 'returned' : checkedIn ? 'out' : 'arrival',
        when: checkedIn ? b.checked_in_at : null,
        start: b.start_time,
      });
    });
    handouts.forEach(h => {
      const isToday = (h.handed_out_at || '').startsWith(today) || (h.returned_at || '').startsWith(today) || h.is_out;
      if (!isToday) return;
      out.push({
        kind: 'handout', id: `h${h.id}`, raw: h,
        who: h.holder_display,
        room: h.room_display,
        sub: `${h.holder_role_label} · ${h.purpose_label}${h.note ? ` · ${h.note}` : ''}`,
        gradId: h.venue || (h.id + 3),
        state: h.is_out ? 'out' : 'returned',
        when: h.is_out ? h.handed_out_at : h.returned_at,
        start: '99:99',
      });
    });
    return out;
  }, [todays, handouts, today]);

  const keysOut = items.filter(i => i.state === 'out').length;

  const nowHM = new Date().toTimeString().slice(0, 5);

  const list = useMemo(() => {
    const q = query.toLowerCase();
    let arr = items.filter(i => !q || i.who.toLowerCase().includes(q) || i.room.toLowerCase().includes(q));
    if (filter === 'arrivals') arr = arr.filter(i => i.state === 'arrival');
    else if (filter === 'onsite') arr = arr.filter(i => i.state === 'out');
    else if (filter === 'returned') arr = arr.filter(i => i.state === 'returned');
    return arr.sort((a, b) => a.start.localeCompare(b.start));
  }, [items, filter, query]);

  async function checkInBooking(b) {
    setActing(`b${b.id}`); setError('');
    try {
      const { data } = await api.post(`/bookings/${b.id}/checkin/`);
      setBookings(prev => prev.map(x => x.id === b.id ? { ...x, ...data } : x));
    } catch (err) { setError(err.response?.data?.detail || 'Check-in failed.'); }
    finally { setActing(null); }
  }
  async function returnBookingKey(b) {
    setActing(`b${b.id}`); setError('');
    try {
      const { data } = await api.post(`/bookings/${b.id}/return-key/`);
      setBookings(prev => prev.map(x => x.id === b.id ? { ...x, ...data } : x));
    } catch (err) { setError(err.response?.data?.detail || 'Failed to update.'); }
    finally { setActing(null); }
  }
  async function returnHandout(h) {
    setActing(`h${h.id}`); setError('');
    try {
      const { data } = await api.post(`/bookings/key-handouts/${h.id}/return/`);
      setHandouts(prev => prev.map(x => x.id === h.id ? data : x));
    } catch (err) { setError(err.response?.data?.detail || 'Failed to update.'); }
    finally { setActing(null); }
  }

  const loading = bookings == null;

  return (
    <>
    <div className="page" style={{ maxWidth: 1100 }} ref={revealRef}>
      <div className="page-head reveal">
        <span className="eyebrow">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <h1>Front desk</h1>
        <p>{loading ? 'Loading…' : <><b>{keysOut} key{keysOut !== 1 ? 's' : ''} out</b> · {todays.length} booking{todays.length !== 1 ? 's' : ''} today</>}</p>
      </div>

      <div className="filter-pills reveal">
        {PILLS.map(p => (
          <button key={p.id} className={`fp${filter === p.id ? ' on' : ''}`} onClick={() => setFilter(p.id)}>{p.label}</button>
        ))}
        <div className="search-box fp-search">
          <Icon.Search />
          <input className="input" placeholder="Search name or room…" value={query} onChange={e => setQuery(e.target.value)} />
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
            <span className="ic"><Icon.Key width={22} height={22} /></span>
            <span>{filter === 'arrivals' ? 'No one waiting to check in.' : filter === 'onsite' ? 'No keys out right now.' : 'Nothing here.'}</span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>Hand out a key</button>
          </div>
        )}

        {!loading && list.map(i => {
          const overdue = i.state === 'arrival' && i.start.slice(0, 5) < nowHM;
          return (
            <div className="lo-card" key={i.id}>
              <div className="lo-thumb" style={{ background: venueGradient(i.gradId) }}>
                <span className="fd-av">{initials(i.who)}</span>
              </div>
              <div className="lo-body">
                <div className="lo-title">{i.who}</div>
                <div className="lo-desc">{i.room} · {i.sub}</div>
                <div className="lo-meta">
                  {i.state === 'returned' ? <span className="badge badge-neutral"><span className="dot" />Returned</span>
                    : i.state === 'out' ? <span className="badge badge-approved"><span className="dot" />Key out{i.when ? ` · ${since(i.when)}` : ''}</span>
                    : overdue ? <span className="badge badge-rejected"><span className="dot" />Overdue</span>
                    : <span className="badge badge-pending"><span className="dot" />Expected {hm(i.start)}</span>}
                  {i.kind === 'handout' && <span className="lo-tag">Ad-hoc</span>}
                </div>
              </div>
              <div className="fd-actions">
                {i.kind === 'booking' && i.state === 'arrival' && (
                  <button className="btn btn-primary btn-sm" disabled={acting === i.id} onClick={() => checkInBooking(i.raw)}>
                    {acting === i.id ? '…' : 'Check in & hand key'}
                  </button>
                )}
                {i.state === 'out' && (
                  <button className="btn btn-outline btn-sm" disabled={acting === i.id} onClick={() => i.kind === 'booking' ? returnBookingKey(i.raw) : returnHandout(i.raw)}>
                    {acting === i.id ? '…' : 'Key returned'}
                  </button>
                )}
                {i.state === 'returned' && <span className="fd-done"><Icon.Check width={16} height={16} /></span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {showForm && (
      <HandoutForm
        onClose={() => setShowForm(false)}
        onCreated={(h) => { setHandouts(prev => [h, ...prev]); setShowForm(false); setFilter('onsite'); }}
      />
    )}
    </>
  );
}

function HandoutForm({ onClose, onCreated }) {
  const [venues, setVenues] = useState([]);
  const [holderName, setHolderName] = useState('');
  const [role, setRole] = useState('CLEANER');
  const [venueId, setVenueId] = useState('');
  const [roomLabel, setRoomLabel] = useState('');
  const [purpose, setPurpose] = useState('CLEANING');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/venues/').then(r => setVenues(r.data.results ?? r.data)).catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr(''); setSaving(true);
    try {
      const { data } = await api.post('/bookings/key-handouts/', {
        holder_name: holderName, holder_role: role,
        venue: venueId || null, room_label: roomLabel,
        purpose, note,
      });
      onCreated(data);
    } catch (e2) {
      const d = e2.response?.data;
      setErr(d?.holder_name?.[0] || d?.room_label?.[0] || d?.detail || 'Could not log this key.');
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h3>Hand out a key</h3>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="hf-name">Who is taking the key?</label>
            <input id="hf-name" className="input" placeholder="Name (e.g. Mary — Cleaning)" value={holderName} onChange={e => setHolderName(e.target.value)} required autoFocus />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.7rem' }}>
            <div className="field">
              <label htmlFor="hf-role">Role</label>
              <select id="hf-role" className="select" value={role} onChange={e => setRole(e.target.value)}>
                <option value="CLEANER">Cleaner</option>
                <option value="STAFF">Staff</option>
                <option value="CONTRACTOR">Contractor</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="hf-purpose">Purpose</label>
              <select id="hf-purpose" className="select" value={purpose} onChange={e => setPurpose(e.target.value)}>
                <option value="CLEANING">Cleaning</option>
                <option value="OFFICE">Office access</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="EVENT">Event setup</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="hf-venue">Room / office</label>
            <select id="hf-venue" className="select" value={venueId} onChange={e => setVenueId(e.target.value)}>
              <option value="">— Pick a venue, or type below —</option>
              {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          {!venueId && (
            <div className="field">
              <label htmlFor="hf-room">Or type a room/office</label>
              <input id="hf-room" className="input" placeholder="e.g. Office 204, B-Block store" value={roomLabel} onChange={e => setRoomLabel(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label htmlFor="hf-note">Note (optional)</label>
            <input id="hf-note" className="input" placeholder="e.g. master key, 2 keys" value={note} onChange={e => setNote(e.target.value)} />
          </div>
          {err && <p style={{ color: 'var(--danger)', fontSize: '.85rem', marginBottom: '.8rem' }}>{err}</p>}
          <div className="row" style={{ gap: '.6rem' }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving…' : 'Hand out key'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
