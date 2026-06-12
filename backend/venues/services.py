"""
Venue business logic and matching.
"""

from django.core.exceptions import ValidationError

from bookings.services import check_booking_conflict
from .models import Venue


def get_available_venues(date, start_time, end_time):
    """
    Return all active venues that have no conflicts during the requested slot.

    Parameters
    ----------
    date : datetime.date
    start_time : datetime.time
    end_time : datetime.time

    Returns
    -------
    QuerySet of Venue objects with no bookings during the slot
    """
    all_active = Venue.objects.filter(is_active=True)
    unavailable_ids = set()

    for venue in all_active:
        try:
            check_booking_conflict(venue, date, start_time, end_time)
        except ValidationError:
            unavailable_ids.add(venue.id)

    return Venue.objects.filter(is_active=True).exclude(id__in=unavailable_ids)


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

    # Same building bonus
    building_bonus = 20 if current_venue.building == candidate_venue.building else 0

    # Weighted composite
    score = (
        capacity_score * 0.4 +
        amenities_score * 0.4 +
        building_bonus * 0.2
    )

    return round(score, 1)


def get_venue_alternatives(date, start_time, end_time, current_venue_id, min_capacity, limit=5):
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

    Returns
    -------
    list of dict : Venue data with 'similarity_score' added
    """
    try:
        current_venue = Venue.objects.get(id=current_venue_id)
    except Venue.DoesNotExist:
        return []

    available = get_available_venues(date, start_time, end_time)

    scored = []
    for venue in available:
        if venue.id == current_venue_id:
            continue

        score = calculate_similarity_score(current_venue, venue, min_capacity)
        if score > 0:
            scored.append((venue, score))

    ranked = sorted(scored, key=lambda x: x[1], reverse=True)[:limit]
    return ranked
