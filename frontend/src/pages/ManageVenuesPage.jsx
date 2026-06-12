import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReveal } from '../hooks/useReveal';
import { useTopbar } from '../components/TopbarContext';
import { Icon } from '../components/icons';
import { venueGradient } from '../utils/venueUi';
import VenueForm from '../components/VenueForm';

export default function ManageVenuesPage() {
  usePageTitle('Manage Venues');
  useTopbar('Manage Venues', null);
  const navigate = useNavigate();
  const [venues, setVenues] = useState(null);
  const [statsMap, setStatsMap] = useState({});
  const [search, setSearch] = useState('');
  const [building, setBuilding] = useState('All buildings');
  const [status, setStatus] = useState('All statuses');
  const [toggling, setToggling] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingVenue, setEditingVenue] = useState(null);
  const revealRef = useReveal([venues != null, search, building, status]);

  useEffect(() => {
    api.get('/venues/').then(r => setVenues(r.data)).catch(() => setVenues([]));
    api.get('/venues/stats/').then(r => {
      const map = {};
      r.data.forEach(s => { map[s.venue_id] = s; });
      setStatsMap(map);
    }).catch(() => {});
  }, []);

  const buildings = useMemo(
    () => ['All buildings', ...new Set((venues || []).map(v => v.building).filter(Boolean))],
    [venues],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (venues || []).filter(v =>
      (v.name.toLowerCase().includes(q) ||
        v.location.toLowerCase().includes(q) ||
        (v.building || '').toLowerCase().includes(q)) &&
      (building === 'All buildings' || v.building === building) &&
      (status === 'All statuses' ||
        (status === 'Bookable' && v.is_active) ||
        (status === 'Maintenance' && !v.is_active)),
    );
  }, [venues, search, building, status]);

  async function toggleBookable(venue) {
    setToggling(venue.id);
    setError('');
    try {
      const res = await api.patch(`/venues/${venue.id}/`, { is_active: !venue.is_active });
      setVenues(prev => prev.map(v => v.id === venue.id ? res.data : v));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update venue.');
    } finally {
      setToggling(null);
    }
  }

  function handleFormSuccess(newVenue) {
    if (editingVenue) {
      setVenues(prev => prev.map(v => v.id === newVenue.id ? newVenue : v));
    } else {
      setVenues(prev => [...prev, newVenue]);
    }
    setShowForm(false);
    setEditingVenue(null);
    setError('');
  }

  function handleFormCancel() {
    setShowForm(false);
    setEditingVenue(null);
  }

  function openCreateForm() {
    setEditingVenue(null);
    setShowForm(true);
  }

  function openEditForm(venue) {
    setEditingVenue(venue);
    setShowForm(true);
  }

  const loading = venues == null;
  const total = venues?.length || 0;
  const bookable = (venues || []).filter(v => v.is_active).length;
  const maintenance = total - bookable;
  const utilVals = Object.values(statsMap);
  const utilAvg = utilVals.length
    ? Math.round(utilVals.reduce((a, s) => a + s.utilisation_pct, 0) / utilVals.length)
    : 0;

  return (
    <div className="page" style={{ maxWidth: 1320 }} ref={revealRef}>
      <div className="page-head reveal">
        <span className="eyebrow">Catalogue</span>
        <h1>Manage venues</h1>
        <p>Add, edit and toggle availability across all {total} bookable spaces.</p>
      </div>

      <div className="mg-stats reveal">
        <div className="card stat-card"><span className="stat-accent" /><div className="stat-label">Total venues</div><div className="stat-val">{loading ? '—' : total}</div></div>
        <div className="card stat-card"><span className="stat-accent" style={{ background: 'var(--success)' }} /><div className="stat-label">Bookable</div><div className="stat-val">{loading ? '—' : bookable}</div></div>
        <div className="card stat-card"><span className="stat-accent" style={{ background: 'var(--warn)' }} /><div className="stat-label">Under maintenance</div><div className="stat-val">{loading ? '—' : maintenance}</div></div>
        <div className="card stat-card"><span className="stat-accent" style={{ background: 'var(--coral)' }} /><div className="stat-label">Avg utilisation</div><div className="stat-val" style={{ fontSize: '1.7rem', marginTop: '.9rem' }}>{utilAvg}%</div></div>
      </div>

      <div className="toolbar reveal">
        <div className="search-box">
          <Icon.Search />
          <input className="input" placeholder="Search the catalogue…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select" style={{ maxWidth: 160 }} value={building} onChange={e => setBuilding(e.target.value)}>
          {buildings.map(b => <option key={b}>{b}</option>)}
        </select>
        <select className="select" style={{ maxWidth: 150 }} value={status} onChange={e => setStatus(e.target.value)}>
          <option>All statuses</option>
          <option>Bookable</option>
          <option>Maintenance</option>
        </select>
        <button className="btn btn-primary btn-sm" onClick={openCreateForm}>
          <Icon.Plus width={14} height={14} /> Create venue
        </button>
      </div>

      {error && <div className="conflict reveal in" style={{ marginBottom: '1rem' }}><Icon.X strokeWidth={2} /><span>{error}</span></div>}

      {loading ? (
        <div className="table-wrap reveal">
          <table className="tbl"><tbody>{[1, 2, 3].map(i => <tr key={i}><td colSpan={7}><div className="skeleton" style={{ height: 14 }} /></td></tr>)}</tbody></table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty card" style={{ borderRadius: 'var(--r-lg)' }}>
          <span className="ic"><Icon.Manage width={24} height={24} /></span>
          <span>{search || building !== 'All buildings' ? 'Nothing matches those filters.' : 'No venues in the catalogue yet.'}</span>
        </div>
      ) : (
        <div className="table-wrap reveal">
          <table className="tbl">
            <thead>
              <tr>
                <th>Venue</th>
                <th className="hide-sm">Type</th>
                <th>Capacity</th>
                <th className="hide-sm">Utilisation</th>
                <th>Status</th>
                <th>Bookable</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id}>
                  <td>
                    <div className="vcell">
                      <span className="vthumb" style={{ background: venueGradient(v.id) }} />
                      <div>
                        <div className="vn">{v.name}</div>
                        <div className="vl">{v.building || v.location}</div>
                      </div>
                    </div>
                  </td>
                  <td className="hide-sm"><span className="badge badge-neutral">{v.venue_type || '—'}</span></td>
                  <td className="mono" style={{ fontWeight: 700 }}>{v.capacity}</td>
                  <td className="hide-sm">
                    {(() => {
                      const s = statsMap[v.id];
                      const pct = s ? s.utilisation_pct : 0;
                      const label = s ? `${pct}%` : '—';
                      return (
                        <div className="row" style={{ gap: '.6rem', alignItems: 'center' }}>
                          <div className="cap-bar util-bar"><span style={{ width: `${pct}%`, background: 'var(--accent)' }} /></div>
                          <span className="mono" style={{ fontSize: '.78rem', color: 'var(--ink-65)' }}>{label}</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td>{v.is_active ? <span className="badge badge-approved"><span className="dot" />Live</span> : <span className="badge badge-pending"><span className="dot" />Maintenance</span>}</td>
                  <td>
                    <button
                      role="switch"
                      className={`toggle${v.is_active ? ' on' : ''}`}
                      disabled={toggling === v.id}
                      aria-checked={v.is_active}
                      aria-label={`Toggle ${v.name} bookable`}
                      onClick={() => toggleBookable(v)}
                    />
                  </td>
                  <td>
                    <div className="row-act">
                      <button title="Edit" aria-label={`Edit ${v.name}`} onClick={() => openEditForm(v)}><Icon.Edit width={15} height={15} /></button>
                      <button title="View" aria-label={`View ${v.name}`} onClick={() => navigate(`/venues/${v.id}`)}><Icon.Eye width={15} height={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <VenueForm
          venue={editingVenue}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}
    </div>
  );
}

