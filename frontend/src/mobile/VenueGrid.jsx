import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';
import { Icon } from '../components/icons';
import { venueGradient } from '../utils/venueUi';
import { AMENITY_OPTIONS } from '../constants';
import '../styles/venue-form.css';

const FILTERS = [
  { label: 'All', type: '' },
  { label: 'Lectures', type: 'Lecture hall' },
  { label: 'Studios', type: 'Studio' },
  { label: 'Labs', type: 'Lab' },
  { label: 'Outdoor', type: 'Outdoor' },
  { label: 'Music', type: 'Music' },
  { label: 'Sports', type: 'Sports' },
];

export default function VenueGrid() {
  usePageTitle('Venues');
  const navigate = useNavigate();
  const [venues, setVenues] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [minCapacity, setMinCapacity] = useState('');
  const [amenityFilter, setAmenityFilter] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    api.get('/venues/')
      .then((r) => setVenues(r.data.results ?? r.data))
      .catch(() => setVenues([]));
  }, []);

  const loading = venues == null;
  const activeFilterCount = (minCapacity ? 1 : 0) + amenityFilter.length;
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const min = Number(minCapacity) || 0;
    return (venues || []).filter((v) =>
      (!typeFilter || v.venue_type === typeFilter) &&
      (!q || v.name.toLowerCase().includes(q) ||
        (v.location || '').toLowerCase().includes(q) ||
        (v.building || '').toLowerCase().includes(q)) &&
      v.capacity >= min &&
      amenityFilter.every((a) => (v.amenities || []).includes(a)),
    );
  }, [venues, search, typeFilter, minCapacity, amenityFilter]);

  function toggleAmenity(a) {
    setAmenityFilter((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  return (
    <>
      <div className="m-top-bar">
        <h1>Venues</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icon-btn" aria-label="Filter by capacity and facilities" title="Filters" style={{ position: 'relative' }} onClick={() => setSheetOpen(true)}>
            <Icon.Layers width={20} height={20} />
            {activeFilterCount > 0 && <span className="notif-dot" style={{ top: -4, right: -4 }}>{activeFilterCount}</span>}
          </button>
          <button className="icon-btn" aria-label="Find a free room" title="Find a free room" onClick={() => navigate('/timetable')}>
            <Icon.Calendar width={20} height={20} />
          </button>
        </div>
      </div>

      <div className="m-search-wrap">
        <div className="m-search-box">
          <Icon.Search className="m-search-icon" width={20} height={20} />
          <input
            className="input"
            placeholder="Search venues…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search venues"
          />
        </div>
      </div>

      <div className="m-filter-row">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            className={`chip${typeFilter === f.type ? ' active' : ''}`}
            onClick={() => setTypeFilter(f.type)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="m-venue-grid">
          {[1, 2, 3, 4].map((i) => (
            <div className="m-venue-tile" key={i}>
              <div className="skel" style={{ height: 100 }} />
              <div className="m-vt-body">
                <div className="skel" style={{ height: 14, width: '80%', marginBottom: 6 }} />
                <div className="skel" style={{ height: 11, width: '55%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="m-empty" style={{ padding: '60px 20px' }}>
          <div className="m-empty-ic"><Icon.Venues width={26} height={26} /></div>
          <p>{search || typeFilter || activeFilterCount > 0 ? 'No venues match those filters.' : 'No venues available yet.'}</p>
        </div>
      ) : (
        <div className="m-venue-grid">
          {filtered.map((v) => (
            <button className="m-venue-tile" key={v.id} onClick={() => navigate(`/venues/${v.id}`)}>
              <div className="m-vt-vis">
                <div className="m-vt-fill" style={{ background: venueGradient(v.id) }} />
                <div className="m-iso" />
                {v.venue_type && <span className="m-vt-type">{v.venue_type}</span>}
              </div>
              <div className="m-vt-body">
                <h3>{v.name}</h3>
                <div className="m-vt-meta">{v.building || v.location}</div>
                <div className="m-vt-foot">
                  <span className="m-vt-cap">↑ {v.capacity}</span>
                  {v.is_active
                    ? <span className="badge badge-approved" style={{ fontSize: 9, padding: '.2em .5em' }}><span className="dot" />Open</span>
                    : <span className="badge badge-cancelled" style={{ fontSize: 9, padding: '.2em .5em' }}>Closed</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {sheetOpen && (
        <div className="m-sheet-overlay" onClick={() => setSheetOpen(false)}>
          <div className="m-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 className="m-sheet-title" style={{ marginBottom: 16 }}>Filters</h3>
            <div className="field">
              <label htmlFor="vg-min-cap">Minimum capacity</label>
              <input
                id="vg-min-cap"
                className="input"
                type="number"
                min="0"
                placeholder="Any"
                value={minCapacity}
                onChange={(e) => setMinCapacity(e.target.value)}
              />
            </div>
            <div className="field" style={{ marginTop: 14 }}>
              <label>Facilities</label>
              <div className="amenity-chips">
                {AMENITY_OPTIONS.map((a) => (
                  <button key={a} type="button" className={`amenity-chip${amenityFilter.includes(a) ? ' on' : ''}`} onClick={() => toggleAmenity(a)}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="m-sheet-actions">
              <button
                type="button"
                className="btn btn-ghost btn-block"
                onClick={() => { setMinCapacity(''); setAmenityFilter([]); }}
                disabled={activeFilterCount === 0}
              >
                Clear
              </button>
              <button type="button" className="btn btn-primary btn-block" onClick={() => setSheetOpen(false)}>
                Show {filtered.length} {filtered.length === 1 ? 'venue' : 'venues'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
