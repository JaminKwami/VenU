import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';
import { Icon } from '../components/icons';
import { venueGradient } from '../utils/venueUi';

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

  useEffect(() => {
    api.get('/venues/')
      .then((r) => setVenues(r.data.results ?? r.data))
      .catch(() => setVenues([]));
  }, []);

  const loading = venues == null;
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (venues || []).filter((v) =>
      (!typeFilter || v.venue_type === typeFilter) &&
      (!q || v.name.toLowerCase().includes(q) ||
        (v.location || '').toLowerCase().includes(q) ||
        (v.building || '').toLowerCase().includes(q)),
    );
  }, [venues, search, typeFilter]);

  return (
    <>
      <div className="m-top-bar">
        <h1>Venues</h1>
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
          <p>{search || typeFilter ? 'No venues match those filters.' : 'No venues available yet.'}</p>
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
    </>
  );
}
