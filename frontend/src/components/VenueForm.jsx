import { useState } from 'react';
import api from '../api/axios';
import { Icon } from './icons';
import '../styles/venue-form.css';

const VENUE_TYPES = [
  'Seminar room', 'Lecture hall', 'Lab', 'Auditorium',
  'Breakout room', 'Meeting room', 'Studio', 'Workshop',
];

const COMMON_AMENITIES = [
  'Projector', 'Whiteboard', 'WiFi', 'Video conferencing',
  'Wheelchair access', 'Air conditioning', 'PA system',
];

/* DRF errors arrive as {field: ["msg", ...]} or {detail: "msg"}. */
const firstError = v => (Array.isArray(v) ? v[0] : v);

export default function VenueForm({ venue = null, onSuccess, onCancel }) {
  const isEdit = !!venue;
  const [form, setForm] = useState({
    name: venue?.name || '',
    location: venue?.location || '',
    building: venue?.building || '',
    venue_type: venue?.venue_type || VENUE_TYPES[0],
    capacity: venue?.capacity ?? 20,
    amenities: venue?.amenities || [],
    min_notice_hours: venue?.min_notice_hours ?? 24,
    description: venue?.description || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

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
      <div className="venue-form-container">
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
              {COMMON_AMENITIES.map(a => (
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
