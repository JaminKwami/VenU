import { useEffect, useState } from 'react';
import api from '../api/axios';

const EMPTY = { name: '', location: '', capacity: '', description: '' };

export default function ManageVenuesPage() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);

  const load = () => api.get('/venues/').then(r => setVenues(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  function openAdd() { setEditing(null); setForm(EMPTY); setError(''); setPanelOpen(true); }
  function openEdit(v) { setEditing(v); setForm({ name: v.name, location: v.location, capacity: v.capacity, description: v.description || '' }); setError(''); setPanelOpen(true); }
  function closePanel() { setPanelOpen(false); setEditing(null); setError(''); }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (editing) {
        const res = await api.put(`/venues/${editing.id}/`, { ...form, capacity: Number(form.capacity) });
        setVenues(prev => prev.map(v => v.id === editing.id ? res.data : v));
      } else {
        const res = await api.post('/venues/', { ...form, capacity: Number(form.capacity) });
        setVenues(prev => [...prev, res.data]);
      }
      closePanel();
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this venue? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await api.delete(`/venues/${id}/`);
      setVenues(prev => prev.filter(v => v.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="page-content fade-up">
      <div className="page-header">
        <div>
          <h1>Manage Venues</h1>
          <p>Add, edit, and remove bookable spaces</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Venue</button>
      </div>

      {panelOpen && (
        <div onClick={closePanel} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s var(--ease)' }} />
      )}

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 51,
        width: 'min(420px, 100vw)',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        padding: '2rem 1.75rem',
        display: 'flex', flexDirection: 'column', gap: '1.5rem',
        transform: panelOpen ? 'translateX(0)' : 'translateX(110%)',
        transition: 'transform 0.3s var(--ease)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.2rem' }}>{editing ? 'Edit Venue' : 'New Venue'}</h2>
          <button onClick={closePanel} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', lineHeight: 1, borderRadius: 6 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div>
            <label className="label">Venue name</label>
            <input className="input" name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Main Auditorium" />
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" name="location" value={form.location} onChange={handleChange} required placeholder="e.g. Block A, Ground Floor" />
          </div>
          <div>
            <label className="label">Capacity</label>
            <input className="input" type="number" min="1" name="capacity" value={form.capacity} onChange={handleChange} required placeholder="200" />
          </div>
          <div>
            <label className="label">Description <span style={{ color: 'var(--ink-3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <textarea className="input" name="description" value={form.description} onChange={handleChange} rows={3} placeholder="Additional details about this space…" style={{ resize: 'vertical', minHeight: 80 }} />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.25rem' }}>
            <button type="button" className="btn" onClick={closePanel} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create venue'}
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
          {[1,2,3].map(i => (
            <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="skeleton" style={{ height: 20, width: '60%' }} />
              <div className="skeleton" style={{ height: 14, width: '40%' }} />
              <div className="skeleton" style={{ height: 14, width: '80%' }} />
            </div>
          ))}
        </div>
      ) : venues.length === 0 ? (
        <div className="empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>No venues yet. Create your first one!</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
          {venues.map((v, i) => (
            <div key={v.id} className={`card fade-up stagger-${(i % 6) + 1}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ fontSize: '1rem' }}>{v.name}</h3>
                <span className="badge badge-active">Active</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--ink-2)' }}>📍 {v.location}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--ink-2)' }}>👥 Capacity: <strong style={{ color: 'var(--ink)' }}>{v.capacity}</strong></div>
              {v.description && (
                <p style={{ fontSize: '0.8rem', color: 'var(--ink-3)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.description}</p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button className="btn" onClick={() => openEdit(v)} style={{ flex: 1, fontSize: '0.82rem' }}>Edit</button>
                <button className="btn btn-danger" onClick={() => handleDelete(v.id)} disabled={deleting === v.id} style={{ flex: 1, fontSize: '0.82rem' }}>
                  {deleting === v.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

