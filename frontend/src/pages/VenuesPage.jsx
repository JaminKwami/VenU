import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReveal } from '../hooks/useReveal';
import { useTopbar } from '../components/TopbarContext';
import { Icon } from '../components/icons';
import { venueGradient } from '../utils/venueUi';

const CAP_RANGES = {
  'Any capacity': [0, Infinity],
  '1–20': [1, 20],
  '20–60': [20, 60],
  '60–200': [60, 200],
  '200+': [200, Infinity],
};

export default function VenuesPage() {
  usePageTitle('Venues');
  useTopbar('Venues', (
    <Link className="btn btn-primary btn-sm" to="/book"><Icon.Plus width={15} height={15} /> New booking</Link>
  ));
  const [venues, setVenues] = useState(null);
  const [search, setSearch] = useState('');
  const [building, setBuilding] = useState('All buildings');
  const [capRange, setCapRange] = useState('Any capacity');
  const [type, setType] = useState('All types');
  const revealRef = useReveal([venues != null, search, building, capRange, type]);

  useEffect(() => {
    api.get('/venues/').then(r => setVenues(r.data)).catch(() => setVenues([]));
  }, []);

  const buildings = useMemo(
    () => ['All buildings', ...new Set((venues || []).map(v => v.building).filter(Boolean))],
    [venues],
  );
  const types = useMemo(
    () => ['All types', ...new Set((venues || []).map(v => v.venue_type).filter(Boolean))],
    [venues],
  );

  const filtered = useMemo(() => {
    const [lo, hi] = CAP_RANGES[capRange];
    const q = search.toLowerCase();
    return (venues || []).filter(v =>
      (v.name.toLowerCase().includes(q) ||
        v.location.toLowerCase().includes(q) ||
        (v.building || '').toLowerCase().includes(q) ||
        (v.amenities || []).some(a => a.toLowerCase().includes(q))) &&
      (building === 'All buildings' || v.building === building) &&
      (type === 'All types' || v.venue_type === type) &&
      v.capacity >= lo && v.capacity <= hi,
    );
  }, [venues, search, building, capRange, type]);

  const loading = venues == null;
  const buildingCount = new Set((venues || []).map(v => v.building).filter(Boolean)).size;

  return (
    <div className="page" style={{ maxWidth: 1320 }} ref={revealRef}>
      <div className="page-head reveal">
        <span className="eyebrow">
          {loading ? 'Loading…' : `${venues.length} ${venues.length === 1 ? 'space' : 'spaces'}${buildingCount ? ` · ${buildingCount} ${buildingCount === 1 ? 'building' : 'buildings'}` : ''}`}
        </span>
        <h1>Find your space.</h1>
        <p>Browse every bookable room, studio, lab and outdoor space on campus. Filter by what matters, then request in one tap.</p>
      </div>

      <div className="filter-bar reveal">
        <div className="search-box">
          <Icon.Search />
          <input
            className="input"
            placeholder="Search venues, buildings or amenities…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="select" style={{ maxWidth: 170 }} value={building} onChange={e => setBuilding(e.target.value)}>
          {buildings.map(b => <option key={b}>{b}</option>)}
        </select>
        <select className="select" style={{ maxWidth: 150 }} value={capRange} onChange={e => setCapRange(e.target.value)}>
          {Object.keys(CAP_RANGES).map(c => <option key={c}>{c}</option>)}
        </select>
        <span className="toolbar-right count-label">
          {loading ? '…' : `Showing ${filtered.length} of ${venues.length}`}
        </span>
      </div>

      {types.length > 1 && (
        <div className="filter-bar reveal" data-d="1" style={{ marginBottom: '1.8rem' }}>
          {types.map(t => (
            <button key={t} className={`chip${type === t ? ' active' : ''}`} onClick={() => setType(t)}>{t}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="vgrid">
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 330, borderRadius: 'var(--r-lg)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty card" style={{ borderRadius: 'var(--r-lg)' }}>
          <span className="ic"><Icon.Venues width={24} height={24} /></span>
          <span>{search || type !== 'All types' ? 'Nothing matches those filters.' : 'No venues in the catalogue yet.'}</span>
        </div>
      ) : (
        <div className="vgrid">
          {filtered.map((v, i) => (
            <Link className="vcard reveal" data-d={(i % 3) + 1} key={v.id} to={`/venues/${v.id}`}>
              <div className="vis">
                <div style={{ position: 'absolute', inset: 0, background: venueGradient(v.id) }} />
                <div className="iso" />
                <span className={`vstatus badge ${v.is_active ? 'badge-approved' : 'badge-cancelled'}`}><span className="dot" />{v.is_active ? 'Bookable' : 'Unavailable'}</span>
                <span className="vcap">CAP {v.capacity}</span>
              </div>
              <div className="body">
                <h3>{v.name}</h3>
                <div className="vmeta">{[v.building, v.venue_type].filter(Boolean).join(' · ') || v.location}</div>
                {(v.amenities || []).length > 0 && (
                  <div className="amen">{v.amenities.slice(0, 4).map(a => <span className="a" key={a}>{a}</span>)}</div>
                )}
                <div className="vfoot">
                  <span className="rate mono" style={{ fontSize: '.72rem' }}>{v.location}</span>
                  <span className="btn btn-outline btn-sm">View &amp; book</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
