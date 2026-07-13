import { useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import { Icon } from './icons';
import { AMENITY_OPTIONS } from '../constants';
import '../styles/venue-form.css';

const VENUE_TYPES = [
  'Seminar room', 'Lecture hall', 'Lab', 'Auditorium',
  'Breakout room', 'Meeting room', 'Studio', 'Workshop',
];

/* DRF errors arrive as {field: ["msg", ...]} or {detail: "msg"}. */
const firstError = v => (Array.isArray(v) ? v[0] : v);

export default function VenueForm({ venue = null, onSuccess, onCancel }) {
  const isEdit = !!venue;
  const containerRef = useRef(null);
  const [form, setForm] = useState({
    name: venue?.name || '',
    location: venue?.location || '',
    building: venue?.building || '',
    venue_type: venue?.venue_type || VENUE_TYPES[0],
    capacity: venue?.capacity ?? 20,
    amenities: venue?.amenities || [],
    min_notice_hours: venue?.min_notice_hours ?? 24,
    description: venue?.description || '',
    access: venue?.access || 'both',
    requires_vc_approval: venue?.requires_vc_approval || false,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Personnel (who prepares this venue) — a separate resource from the venue
  // itself, so changes save immediately rather than waiting on the main form.
  const [personnel, setPersonnel] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [newPersonUser, setNewPersonUser] = useState('');
  const [newPersonRole, setNewPersonRole] = useState('');
  const [addingPersonnel, setAddingPersonnel] = useState(false);
  const [personnelError, setPersonnelError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    api.get('/venues/personnel/', { params: { venue: venue.id } }).then(r => setPersonnel(r.data)).catch(() => {});
    api.get('/auth/users/').then(r => setAssignableUsers(r.data.results ?? r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, venue?.id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    document.addEventListener('keydown', onKey);
    // Focus first focusable element inside the modal
    const first = containerRef.current?.querySelector('input, select, textarea, button');
    first?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    const el = containerRef.current;
    if (!el) return;
    const focusable = [...el.querySelectorAll('input, select, textarea, button, [href]')].filter(n => !n.disabled);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  }

  function set(name, value) {
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(e => ({ ...e, [name]: null }));
  }

  function toggleAmenity(a) {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(a)
        ? f.amenities.filter(x => x !== a)
        : [...f.amenities, a],
    }));
  }

  async function addPersonnel(e) {
    e.preventDefault();
    if (!newPersonUser) return;
    setAddingPersonnel(true);
    setPersonnelError('');
    try {
      const { data } = await api.post('/venues/personnel/', {
        venue: venue.id, user: Number(newPersonUser), role_label: newPersonRole,
      });
      setPersonnel(prev => [...prev, data]);
      setNewPersonUser('');
      setNewPersonRole('');
    } catch (err) {
      const d = err.response?.data;
      setPersonnelError(d?.detail || d?.non_field_errors?.[0] || d?.user?.[0] || 'Could not assign this person.');
    } finally {
      setAddingPersonnel(false);
    }
  }

  async function removePersonnel(id) {
    setPersonnel(prev => prev.filter(p => p.id !== id)); // optimistic
    try {
      await api.delete(`/venues/personnel/${id}/`);
    } catch {
      // Re-fetch on failure rather than leaving the list silently wrong.
      api.get('/venues/personnel/', { params: { venue: venue.id } }).then(r => setPersonnel(r.data)).catch(() => {});
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const local = {};
    if (!form.name.trim()) local.name = 'A venue name is required.';
    if (Number(form.capacity) < 1) local.capacity = 'Capacity must be at least 1.';
    if (Object.keys(local).length) { setErrors(local); return; }

    setSaving(true);
    setErrors({});
    try {
      const res = isEdit
        ? await api.patch(`/venues/${venue.id}/`, form)
        : await api.post('/venues/', form);
      onSuccess?.(res.data);
    } catch (err) {
      setErrors(err.response?.data || { detail: 'Could not save the venue — please try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="venue-form-modal" role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit venue' : 'Create venue'}>
      <div className="venue-form-overlay" onClick={onCancel} />
      <div className="venue-form-container" ref={containerRef} onKeyDown={trapFocus}>
        <div className="venue-form-header">
          <h2>{isEdit ? `Edit ${venue.name}` : 'Add a venue'}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Close">
            <Icon.X width={16} height={16} />
          </button>
        </div>

        <form className="venue-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="vf-name">Venue name</label>
            <input id="vf-name" className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Turing Lecture Theatre" autoFocus />
            {errors.name && <span className="field-error">{firstError(errors.name)}</span>}
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="vf-building">Building</label>
              <input id="vf-building" className="input" value={form.building} onChange={e => set('building', e.target.value)} placeholder="e.g. Engineering Block" />
            </div>
            <div className="field">
              <label htmlFor="vf-location">Location</label>
              <input id="vf-location" className="input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Level 2, Room 204" />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="vf-type">Type</label>
              <select id="vf-type" className="select" value={form.venue_type} onChange={e => set('venue_type', e.target.value)}>
                {VENUE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="vf-capacity">Capacity</label>
              <input id="vf-capacity" className="input" type="number" min="1" value={form.capacity} onChange={e => set('capacity', Number(e.target.value))} />
              {errors.capacity && <span className="field-error">{firstError(errors.capacity)}</span>}
            </div>
          </div>

          <div className="field">
            <label>Amenities</label>
            <div className="amenity-chips">
              {AMENITY_OPTIONS.map(a => (
                <button key={a} type="button" className={`amenity-chip${form.amenities.includes(a) ? ' on' : ''}`} onClick={() => toggleAmenity(a)}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="vf-notice">Minimum notice (hours)</label>
              <input id="vf-notice" className="input" type="number" min="0" value={form.min_notice_hours} onChange={e => set('min_notice_hours', Number(e.target.value))} />
            </div>
            <div className="field">
              <label htmlFor="vf-access">Who can book</label>
              <select id="vf-access" className="select" value={form.access} onChange={e => set('access', e.target.value)}>
                <option value="both">Staff and students</option>
                <option value="staff">Staff only</option>
                <option value="student">Students only</option>
                <option value="none">Not bookable (hidden)</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '.6rem', textTransform: 'none', letterSpacing: 0, fontFamily: 'inherit', fontSize: '.9rem', fontWeight: 500, color: 'var(--ink-65)' }}>
              <input type="checkbox" checked={form.requires_vc_approval} onChange={e => set('requires_vc_approval', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
              Requires VC approval
            </label>
            <span style={{ fontSize: '.8rem', color: 'var(--ink-45)' }}>
              Only the Vice-Chancellor role can approve or decline bookings for this venue — regular admins and receptionists can't decide these.
            </span>
          </div>

          <div className="field">
            <label>Personnel</label>
            {!isEdit ? (
              <span style={{ fontSize: '.82rem', color: 'var(--ink-45)' }}>Save the venue first, then assign the staff who prepare it.</span>
            ) : (
              <>
                {personnel.length > 0 && (
                  <div className="stack" style={{ gap: '.4rem', marginBottom: '.7rem' }}>
                    {personnel.map(p => (
                      <div key={p.id} className="row" style={{ alignItems: 'center', gap: '.6rem', padding: '.5rem .7rem', border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)', background: 'var(--surface-2)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '.86rem', fontWeight: 600 }}>{p.user_name || p.user_email}</div>
                          <div style={{ fontSize: '.74rem', color: 'var(--ink-45)' }}>{p.role_label || 'Personnel'} · {p.user_email}</div>
                        </div>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => removePersonnel(p.id)} aria-label={`Remove ${p.user_name || p.user_email}`}>
                          <Icon.X width={14} height={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="row" style={{ gap: '.5rem', flexWrap: 'wrap' }}>
                  <select
                    className="select"
                    style={{ flex: '1 1 160px' }}
                    value={newPersonUser}
                    onChange={e => setNewPersonUser(e.target.value)}
                    aria-label="Person to assign"
                  >
                    <option value="">Pick a person…</option>
                    {assignableUsers.filter(u => !personnel.some(p => p.user === u.id)).map(u => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                    ))}
                  </select>
                  <input
                    className="input"
                    style={{ flex: '1 1 140px' }}
                    placeholder="Role (e.g. Caretaker)"
                    value={newPersonRole}
                    onChange={e => setNewPersonRole(e.target.value)}
                  />
                  <button type="button" className="btn btn-outline btn-sm" onClick={addPersonnel} disabled={!newPersonUser || addingPersonnel}>
                    {addingPersonnel ? 'Adding…' : 'Add'}
                  </button>
                </div>
                {personnelError && <span className="field-error">{personnelError}</span>}
                <span style={{ fontSize: '.78rem', color: 'var(--ink-45)', marginTop: '.4rem', display: 'block' }}>
                  They'll be notified (in-app, push and email) whenever a booking here is approved.
                </span>
              </>
            )}
          </div>

          <div className="field">
            <label htmlFor="vf-desc">Description</label>
            <textarea id="vf-desc" className="input" rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What makes this space useful — layout, equipment, access notes…" />
          </div>

          {errors.detail && (
            <div className="conflict"><Icon.X strokeWidth={2} /><span>{firstError(errors.detail)}</span></div>
          )}
        </form>

        <div className="venue-form-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add venue'}
          </button>
        </div>
      </div>
    </div>
  );
}
