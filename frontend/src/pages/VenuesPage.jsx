import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

function CapacityBar({ capacity }) {
  const max = 500;
  const pct = Math.min((capacity / max) * 100, 100);
  return (
    <div style={{ marginTop: '0.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)' }}>Capacity</span>
        <span style={{ fontSize: '0.78rem', fontWeight: 650, color: 'var(--ink)' }}>{capacity.toLocaleString()}</span>
      </div>
      <div style={{ height: 4, borderRadius: 99, background: 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--ink)', borderRadius: 99, transition: 'width 0.6s var(--ease)' }} />
      </div>
    </div>
  );
}

export default function VenuesPage() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/venues/').then(r => setVenues(r.data)).finally(() => setLoading(false));
  }, []);

  const filtered = venues.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-content fade-up">
      <div className="page-header">
        <div>
          <h1>Venues</h1>
          <p>Browse available spaces and book instantly</p>
        </div>
        <input
          className="input"
          style={{ width: 220, marginTop: 0 }}
          placeholder="Search venues…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {[1,2,3].map(i => (
            <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="skeleton" style={{ height: 20, width: '70%' }} />
              <div className="skeleton" style={{ height: 14, width: '50%' }} />
              <div className="skeleton" style={{ height: 14, width: '90%' }} />
              <div className="skeleton" style={{ height: 14, width: '80%' }} />
              <div className="skeleton" style={{ height: 36, marginTop: '0.5rem' }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>{search ? 'No venues match your search.' : 'No venues available.'}</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))', gap: '1rem' }}>
          {filtered.map((v, i) => (
            <div key={v.id} className={`card fade-up stagger-${(i % 6) + 1}`}
              style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <h3 style={{ lineHeight: 1.3 }}>{v.name}</h3>
                <span className="badge badge-active" style={{ flexShrink: 0 }}>Active</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem', color: 'var(--ink-2)', fontSize: '0.82rem' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {v.location}
              </div>

              {v.description && (
                <p style={{ fontSize: '0.83rem', marginTop: '0.6rem', color: 'var(--ink-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {v.description}
                </p>
              )}

              <CapacityBar capacity={v.capacity} />

              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '1.1rem' }}
                onClick={() => navigate('/book', { state: { venueId: v.id } })}
              >
                Book this space
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
