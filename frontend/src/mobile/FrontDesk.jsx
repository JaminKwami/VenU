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
  const [handouts, setHandouts] = useState([]);
  const [filter, setFilter] = useState('arrivals');
  const [acting, setActing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useFeedback();
  const today = todayISO();

  function load() {
    api.get('/bookings/').then((r) => setBookings(r.data.results ?? r.data)).catch(() => setBookings([]));
    api.get('/bookings/key-handouts/?status=all').then((r) => setHandouts(r.data)).catch(() => setHandouts([]));
  }
  useEffect(load, []);

  const loading = bookings == null;
  const todays = useMemo(
    () => (bookings || []).filter((b) => b.date === today && b.status === 'APPROVED'),
    [bookings, today],
  );

  const items = useMemo(() => {
    const out = [];
    todays.forEach((b) => {
      const checkedIn = !!b.checked_in_at;
      const returned = !!b.key_returned_at;
      out.push({
        kind: 'booking', id: `b${b.id}`, raw: b, who: b.user?.full_name || b.user?.email || 'Guest',
        sub: `${b.venue.name} · ${hm(b.start_time)}–${hm(b.end_time)}`,
        state: returned ? 'returned' : checkedIn ? 'out' : 'arrival', start: b.start_time,
      });
    });
    handouts.forEach((h) => {
      const isToday = (h.handed_out_at || '').startsWith(today) || h.is_out;
      if (!isToday) return;
      out.push({
        kind: 'handout', id: `h${h.id}`, raw: h, who: h.holder_display,
        sub: `${h.room_display} · ${h.holder_role_label}`,
        state: h.is_out ? 'out' : 'returned', start: '99:99',
      });
    });
    return out;
  }, [todays, handouts, today]);

  const keysOut = items.filter((i) => i.state === 'out').length;

  const list = useMemo(() => {
    let arr = [...items];
    if (filter === 'arrivals') arr = arr.filter((i) => i.state === 'arrival');
    else if (filter === 'onsite') arr = arr.filter((i) => i.state === 'out');
    else if (filter === 'returned') arr = arr.filter((i) => i.state === 'returned');
    return arr.sort((a, b) => a.start.localeCompare(b.start));
  }, [items, filter]);

  async function checkIn(b) {
    setActing(`b${b.id}`);
    try {
      const { data } = await api.post(`/bookings/${b.id}/checkin/`);
      setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, ...data } : x)));
      toast('Checked in · key handed over');
    } catch (err) { toast(err.response?.data?.detail || 'Check-in failed.'); }
    finally { setActing(null); }
  }
  async function returnBookingKey(b) {
    setActing(`b${b.id}`);
    try {
      const { data } = await api.post(`/bookings/${b.id}/return-key/`);
      setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, ...data } : x)));
      toast('Key returned');
    } catch (err) { toast(err.response?.data?.detail || 'Failed.'); }
    finally { setActing(null); }
  }
  async function returnHandout(h) {
    setActing(`h${h.id}`);
    try {
      const { data } = await api.post(`/bookings/key-handouts/${h.id}/return/`);
      setHandouts((prev) => prev.map((x) => (x.id === h.id ? data : x)));
      toast('Key returned');
    } catch (err) { toast(err.response?.data?.detail || 'Failed.'); }
    finally { setActing(null); }
  }

  return (
    <>
      <div className="m-top-bar"><h1>Front desk</h1></div>

      <div className="m-queue-banner static">
        <div>
          <div className="qb-n">{loading ? '—' : keysOut}</div>
          <div className="qb-l">key{keysOut === 1 ? '' : 's'} currently out</div>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowForm(true)}>
          <Icon.Key width={15} height={15} /> Hand out
        </button>
      </div>

      <div className="m-filter-row">
        {FILTERS.map((f) => (
          <button key={f.id} className={`chip${filter === f.id ? ' active' : ''}`} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>

      {loading && [1, 2].map((i) => (
        <div className="m-queue-card" key={i}><div className="skel" style={{ height: 14, width: '60%', marginBottom: 8 }} /><div className="skel" style={{ height: 12, width: '80%' }} /></div>
      ))}

      {!loading && list.length === 0 && (
        <div className="m-empty" style={{ padding: '50px 20px' }}>
          <div className="m-empty-ic"><Icon.Key width={26} height={26} /></div>
          <p>{filter === 'arrivals' ? 'No one waiting to check in.' : 'Nothing here right now.'}</p>
        </div>
      )}

      {!loading && list.map((i) => (
        <div className="m-queue-card" key={i.id}>
          <div className="m-qc-head">
            <div className="m-qc-avatar">{initials(i.who)}</div>
            <div className="m-qc-info">
              <div className="m-qc-title">{i.who}</div>
              <div className="m-qc-meta">{i.sub}</div>
            </div>
            {i.state === 'returned' ? <span className="badge badge-neutral">Returned</span>
              : i.state === 'out' ? <span className="badge badge-approved">Key out</span>
              : <span className="badge badge-pending">{hm(i.start)}</span>}
          </div>
          {i.state !== 'returned' && (
            <div className="m-qc-actions">
              {i.kind === 'booking' && i.state === 'arrival' ? (
                <button className="btn btn-primary" style={{ flex: 1 }} disabled={acting === i.id} onClick={() => checkIn(i.raw)}>
                  <Icon.Key width={16} height={16} /> {acting === i.id ? '…' : 'Check in & hand key'}
                </button>
              ) : i.state === 'out' ? (
                <button className="btn btn-ghost" style={{ flex: 1 }} disabled={acting === i.id} onClick={() => i.kind === 'booking' ? returnBookingKey(i.raw) : returnHandout(i.raw)}>
                  {acting === i.id ? '…' : 'Key returned'}
                </button>
              ) : null}
            </div>
          )}
        </div>
      ))}

      {showForm && (
        <HandoutSheet
          onClose={() => setShowForm(false)}
          onCreated={(h) => { setHandouts((prev) => [h, ...prev]); setShowForm(false); setFilter('onsite'); toast('Key handed out'); }}
        />
      )}
    </>
  );
}

function HandoutSheet({ onClose, onCreated }) {
  const [venues, setVenues] = useState([]);
  const [holderName, setHolderName] = useState('');
  const [role, setRole] = useState('CLEANER');
  const [venueId, setVenueId] = useState('');
  const [roomLabel, setRoomLabel] = useState('');
  const [purpose, setPurpose] = useState('CLEANING');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const { toast } = useFeedback();

  useEffect(() => { api.get('/venues/').then((r) => setVenues(r.data.results ?? r.data)).catch(() => {}); }, []);

  async function submit(e) {
    e.preventDefault();
    setErr(''); setSaving(true);
    try {
      const { data } = await api.post('/bookings/key-handouts/', {
        holder_name: holderName, holder_role: role, venue: venueId || null, room_label: roomLabel, purpose, note,
      });
      onCreated(data);
    } catch (e2) {
      const d = e2.response?.data;
      setErr(d?.holder_name?.[0] || d?.room_label?.[0] || d?.detail || 'Could not log this key.');
    } finally { setSaving(false); }
  }

  return (
    <div className="m-sheet-overlay" onClick={onClose}>
      <div className="m-sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="m-sheet-title" style={{ marginBottom: 16 }}>Hand out a key</h2>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="ms-name">Who is taking it?</label>
            <input id="ms-name" className="input" placeholder="Name (e.g. Mary — Cleaning)" value={holderName} onChange={(e) => setHolderName(e.target.value)} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label htmlFor="ms-role">Role</label>
              <select id="ms-role" className="select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="CLEANER">Cleaner</option><option value="STAFF">Staff</option>
                <option value="CONTRACTOR">Contractor</option><option value="OTHER">Other</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="ms-purpose">Purpose</label>
              <select id="ms-purpose" className="select" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                <option value="CLEANING">Cleaning</option><option value="OFFICE">Office access</option>
                <option value="MAINTENANCE">Maintenance</option><option value="EVENT">Event setup</option><option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="ms-venue">Room / office</label>
            <select id="ms-venue" className="select" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
              <option value="">— Pick a venue, or type below —</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          {!venueId && (
            <div className="field">
              <label htmlFor="ms-room">Or type a room/office</label>
              <input id="ms-room" className="input" placeholder="e.g. Office 204" value={roomLabel} onChange={(e) => setRoomLabel(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label htmlFor="ms-note">Note (optional)</label>
            <input id="ms-note" className="input" placeholder="e.g. master key" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {err && <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 10 }}>{err}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={saving}>{saving ? 'Saving…' : 'Hand out key'}</button>
        </form>
      </div>
    </div>
  );
}
