import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Icon } from './icons';
import '../styles/venue-form.css';

export default function VenueForm({ venue = null, onSuccess, onCancel }) {
  const isEdit = !!venue;
  const [formData, setFormData] = useState({
    name: venue?.name || '',
    location: venue?.location || '',
    building: venue?.building || '',
    venue_type: venue?.venue_type || 'Seminar room',
    capacity: venue?.capacity || 20,
    amenities: venue?.amenities || [],
    min_notice_hours: venue?.min_notice_hours || 24,
    description: venue?.description || '',
  });

  const [amenityInput, setAmenityInput] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const venueTypes = [
    'Seminar room',
    'Lecture hall',
    'Lab',
    'Auditorium',
    'Breakout room',
    'Meeting room',
    'Studio',
    'Workshop',
  ];

  const commonAmenities = [
    'Projector',
    'Whiteboard',
    'WiFi',
    'Parking',
    'Wheelchair access',
    'Kitchen',
    'Video conference',
  ];

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'capacity' || name === 'min_notice_hours' ? parseInt(value) || 0 : value,
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  }

  function addAmenity(amenity) {
    if (!formData.amenities.includes(amenity)) {
      setFormData(prev => ({
        ...prev,
        amenities: [...prev.amenities, amenity],
      }));
      setAmenityInput('');
    }
  }

  function removeAmenity(amenity) {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.filter(a => a !== amenity),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (formData.capacity < 1) newErrors.capacity = 'Capacity must be at least 1';
    if (formData.min_notice_hours < 0) newErrors.min_notice_hours = 'Cannot be negative';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const method = isEdit ? 'patch' : 'post';
      const url = isEdit ? `/venues/${venue.id}/` : '/venues/';
      const { data } = await api[method](url, formData);
      onSuccess?.(data);
    } catch (err) {
      const apiErrors = err.response?.data || {};
      setErrors(apiErrors);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="venue-form-modal">
      <div className="venue-form-overlay" onClick={onCancel} />
      <div className="venue-form-container">
        <div className="venue-form-header">
          <h2>{isEdit ? 'Edit Venue' : 'Create Venue'}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            <Icon.X width={16} height={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="venue-form">
          {/* Name */}
          <div className="field">
            <label>Venue Name</label>
            <input
              className="input"
              type="text"
              name="name"
              placeholder="e.g., Conference Room A"
              value={formData.name}
              onChange={handleChange}
              required
              autoFocus
            />
            {errors.name && <p className="conflict">{errors.name}</p>}
          </div>

          {/* Location & Building */}
          <div className="form-row">
            <div className="field flex-1">
              <label>Location</label>
              <input
                className="input"
                type="text"
                name="location"
                placeholder="e.g., Building 2, 3rd Floor"
                value={formData.location}
                onChange={handleChange}
              />
            </div>
            <div className="field flex-1">
              <label>Building</label>
              <input
                className="input"
                type="text"
                name="building"
                placeholder="e.g., Building 2"
                value={formData.building}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Type & Capacity */}
          <div className="form-row">
            <div className="field flex-1">
              <label>Type</label>
              <select
                className="input"
                name="venue_type"
                value={formData.venue_type}
                onChange={handleChange}
              >
                {venueTypes.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="field flex-1">
              <label>Capacity</label>
              <input
                className="input"
                type="number"
                name="capacity"
                min="1"
                value={formData.capacity}
                onChange={handleChange}
                required
              />
              {errors.capacity && <p className="conflict">{errors.capacity}</p>}
            </div>
          </div>

          {/* Amenities */}
          <div className="field">
            <label>Amenities</label>
            <div className="amenity-input-group">
              <input
                className="input"
                type="text"
                placeholder="Type or select from common ones"
                value={amenityInput}
                onChange={e => setAmenityInput(e.target.value)}
                onKeyPress={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (amenityInput.trim()) {
                      addAmenity(amenityInput.trim());
                    }
                  }
                }}
              />
              <div className="common-amenities">
                {commonAmenities.map(amenity => (
                  <button
                    key={amenity}
                    type="button"
                    className={`amenity-btn ${formData.amenities.includes(amenity) ? 'active' : ''}`}
                    onClick={() =>
                      formData.amenities.includes(amenity)
                        ? removeAmenity(amenity)
                        : addAmenity(amenity)
                    }
                  >
                    {amenity}
                  </button>
                ))}
              </div>
            </div>
            {formData.amenities.length > 0 && (
              <div className="amenity-tags">
                {formData.amenities.map(amenity => (
                  <span key={amenity} className="amenity-tag">
                    {amenity}
                    <button
                      type="button"
                      onClick={() => removeAmenity(amenity)}
                      className="tag-remove"
                    >
                      <Icon.X width={12} height={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Min Notice Hours */}
          <div className="field">
            <label>Min Notice Hours</label>
            <input
              className="input"
              type="number"
              name="min_notice_hours"
              min="0"
              value={formData.min_notice_hours}
              onChange={handleChange}
            />
            {errors.min_notice_hours && <p className="conflict">{errors.min_notice_hours}</p>}
          </div>

          {/* Description */}
          <div className="field">
            <label>Description</label>
            <textarea
              className="input"
              name="description"
              placeholder="e.g., Modern conference room with floor-to-ceiling windows"
              value={formData.description}
              onChange={handleChange}
              rows="3"
            />
          </div>

          {/* Form Errors */}
          {Object.keys(errors).length > 0 && !Object.values(errors).every(e => !e) && (
            <div className="conflict">
              Please fix the errors above before submitting.
            </div>
          )}

          {/* Actions */}
          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (isEdit ? 'Updating...' : 'Creating...') : isEdit ? 'Update Venue' : 'Create Venue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
