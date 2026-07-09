// Institution this VenU deployment serves.
export const INSTITUTION = 'University of Health and Allied Sciences';
export const INSTITUTION_SHORT = 'UHAS';
export const INSTITUTION_FULL = `${INSTITUTION} (${INSTITUTION_SHORT})`;

// Shared amenity vocabulary — used by the admin venue form (what a venue can
// be tagged with) and the venue browse filters (what a user can filter by).
// Keeping these in sync means "filter by Projector" actually matches what
// admins assigned, rather than drifting into free text that never matches.
export const AMENITY_OPTIONS = [
  'Projector', 'Whiteboard', 'WiFi', 'Video conferencing',
  'Wheelchair access', 'Air conditioning', 'PA system',
];
