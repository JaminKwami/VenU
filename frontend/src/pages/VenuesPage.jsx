import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReveal } from '../hooks/useReveal';
import { useTopbar } from '../components/TopbarContext';
import { Icon } from '../components/icons';
import { venueGradient } from '../utils/venueUi';
import { AMENITY_OPTIONS } from '../constants';
import '../styles/venue-form.css';

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
  const [amenityFilter, setAmenityFilter] = useState([]);
  const revealRef = useReveal([venues != null, search, building, capRange, type, amenityFilter]);

  function toggleAmenity(a) {
    setAmenityFilter(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }

  useEffect(() => {
    api.get('/venues/').then(r => setVenues(r.data.results ?? r.data)).catch(() => setVenues([]));
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
      v.capacity >= lo && v.capacity <= hi &&
      amenityFilter.every(a => (v.amenities || []).includes(a)),
    );
  }, [venues, search, building, capRange, type, amenityFilter]);

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

      <div className="filter-pills reveal">
        {types.map(t => (
          <button key={t} className={`fp${type === t ? ' on' : ''}`} onClick={() => setType(t)}>{t}</button>
        ))}
        <div className="search-box fp-search">
          <Icon.Search />
          <input
            className="input"
            placeholder="Search venues, buildings or amenities…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-bar reveal" data-d="1" style={{ marginBottom: '1rem' }}>
        <select className="select" style={{ maxWidth: 180 }} value={building} onChange={e => setBuilding(e.target.value)}>
          {buildings.map(b => <option key={b}>{b}</option>)}
        </select>
        <select className="select" style={{ maxWidth: 160 }} value={capRange} onChange={e => setCapRange(e.target.value)}>
          {Object.keys(CAP_RANGES).map(c => <option key={c}>{c}</option>)}
        </select>
        <span className="toolbar-right count-label">
          {loading ? '…' : `Showing ${filtered.length} of ${venues.length}`}
        </span>
      </div>

      <div className="reveal" data-d="1" style={{ marginBottom: '1.6rem' }}>
        <span className="label" style={{ display: 'block', marginBottom: '.5rem' }}>Facilities</span>
        <div className="amenity-chips" style={{ marginTop: 0 }}>
          {AMENITY_OPTIONS.map(a => (
            <button key={a} type="button" className={`amenity-chip${amenityFilter.includes(a) ? ' on' : ''}`} onClick={() => toggleAmenity(a)}>
              {a}
            </button>
          ))}
          {amenityFilter.length > 0 && (
            <button type="button" className="amenity-chip" onClick={() => setAmenityFilter([])} style={{ color: 'var(--danger)' }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="lo-list lo-grid">
          {[1, 2, 3, 4].map(i => (
            <div className="lo-card" key={i}>
              <div className="skeleton" style={{ width: 84, height: 84, borderRadius: 'var(--r-lg)' }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 16, width: '55%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 12, width: '75%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty card" style={{ borderRadius: 'var(--r-lg)' }}>
          <span className="ic"><Icon.Venues width={24} height={24} /></span>
          <span>{search || type !== 'All types' || capRange !== 'Any capacity' || amenityFilter.length > 0 ? 'Nothing matches those filters.' : 'No venues in the catalogue yet.'}</span>
        </div>
      ) : (
        <div className="lo-list lo-grid">
          {filtered.map((v, i) => (
            <Link className="lo-card reveal" data-d={(i % 3) + 1} key={v.id} to={`/venues/${v.id}`}>
              <div className="lo-thumb" style={{ background: venueGradient(v.id) }}>
                <Icon.Venues />
              </div>
              <div className="lo-body">
                <div className="lo-title">{v.name}</div>
                <div className="lo-desc">{[v.building, v.venue_type, v.location].filter(Boolean).join(' · ')}</div>
                <div className="lo-meta">
                  <span className={`badge ${v.is_active ? 'badge-approved' : 'badge-cancelled'}`}><span className="dot" />{v.is_active ? 'Bookable' : 'Unavailable'}</span>
                  <span className="lo-tag mono">CAP {v.capacity}</span>
                  {(v.amenities || []).slice(0, 2).map(a => <span className="lo-tag" key={a}>{a}</span>)}
                </div>
              </div>
              <span className="lo-go"><Icon.Arrow /></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
