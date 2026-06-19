"""
Venue business logic and matching.
"""

from django.core.exceptions import ValidationError

from bookings.services import check_booking_conflict
from .models import Venue


def _accessible_to(qs, user):
    """
    Narrow a venue queryset to those the user is allowed to book, mirroring
    _check_venue_access(): hidden venues are always excluded, and staff/student
    only see venues open to their role.
    """
    from users.models import UserRole

    qs = qs.exclude(access='none')
    role = getattr(user, 'role', None)
    if role in (UserRole.ADMIN, UserRole.RECEPTIONIST):
        return qs
    if role == UserRole.STAFF:
        return qs.exclude(access='student')
    if role == UserRole.STUDENT:
        return qs.exclude(access='staff')
    return qs


def get_available_venues(date, start_time, end_time, user=None):
    """
    Return active venues that have no conflicts during the requested slot.

    If `user` is given, the result is also filtered to venues that user's role
    is permitted to book — so suggested alternatives are always bookable.

    Parameters
    ----------
    date : datetime.date
    start_time : datetime.time
    end_time : datetime.time
    user : User, optional
        When provided, restricts results by venue access control.

    Returns
    -------
    QuerySet of Venue objects with no bookings during the slot
    """
    base = Venue.objects.filter(is_active=True)
    if user is not None:
        base = _accessible_to(base, user)

    unavailable_ids = set()
    for venue in base:
        try:
            check_booking_conflict(venue, date, start_time, end_time)
        except ValidationError:
            unavailable_ids.add(venue.id)

    return base.exclude(id__in=unavailable_ids)


def calculate_similarity_score(current_venue, candidate_venue, min_capacity):
    """
    Score a candidate venue against the user's original choice (0-100 scale).

    Scoring breakdown:
    - Capacity match (40%): How close the capacity is
    - Amenities overlap (40%): How many shared amenities
    - Building bonus (20%): +20 if same building

    Parameters
    ----------
    current_venue : Venue
        The venue the user originally tried to book
    candidate_venue : Venue
        A potential alternative
    min_capacity : int
        Minimum required capacity from the booking

    Returns
    -------
    float : Score 0-100, or 0 if capacity insufficient
    """
    if candidate_venue.capacity < min_capacity:
        return 0

    # Capacity match: penalize for difference from original
    capacity_diff = abs(candidate_venue.capacity - current_venue.capacity)
    max_capacity = max(current_venue.capacity, 1)
    capacity_score = 100 - min(capacity_diff / max_capacity * 100, 100)

    # Amenities overlap
    current_amenities = set(current_venue.amenities or [])
    candidate_amenities = set(candidate_venue.amenities or [])

    if current_amenities:
        amenities_overlap = len(current_amenities & candidate_amenities) / len(current_amenities)
        amenities_score = amenities_overlap * 100
    else:
        amenities_score = 50

    # Same building: full marks on the location component (0 or 100),
    # so at the 20% weight it contributes up to 20 points to the score.
    building_score = 100 if current_venue.building and current_venue.building == candidate_venue.building else 0

    # Weighted composite
    score = (
        capacity_score * 0.4 +
        amenities_score * 0.4 +
        building_score * 0.2
    )

    return round(score, 1)


def get_venue_alternatives(date, start_time, end_time, current_venue_id, min_capacity, limit=5, user=None):
    """
    Find and rank alternative venues for a booking conflict.

    Parameters
    ----------
    date : datetime.date
    start_time : datetime.time
    end_time : datetime.time
    current_venue_id : int
        The venue ID the user originally wanted
    min_capacity : int
        Minimum attendee count
    limit : int
        Max alternatives to return (default 5)
    user : User, optional
        When provided, only venues the user may book are suggested.

    Returns
    -------
    list of (Venue, score) : ranked, capped at `limit`
    """
    try:
        current_venue = Venue.objects.get(id=current_venue_id)
    except Venue.DoesNotExist:
        return []

    available = get_available_venues(date, start_time, end_time, user=user)

    scored = []
    for venue in available:
        if venue.id == current_venue_id:
            continue

        score = calculate_similarity_score(current_venue, venue, min_capacity)
        if score > 0:
            scored.append((venue, score))

    ranked = sorted(scored, key=lambda x: x[1], reverse=True)[:limit]
    return ranked
