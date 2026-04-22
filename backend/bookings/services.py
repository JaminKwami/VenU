"""
Booking business logic.

Kept separate from views so it can be reused by management commands,
signals, or a future async task queue without touching HTTP code.
"""

from django.core.exceptions import ValidationError

from .models import Booking, BookingStatus


def check_booking_conflict(venue, date, start_time, end_time, exclude_booking_id=None):
    """
    Raise ValidationError if a confirmed or pending booking already occupies
    the requested slot for the given venue.

    Overlap condition (Allen's interval algebra):
        existing.start_time < requested.end_time
        AND
        existing.end_time   > requested.start_time

    Parameters
    ----------
    venue            : Venue instance
    date             : datetime.date
    start_time       : datetime.time
    end_time         : datetime.time
    exclude_booking_id : int | None  — skip this booking ID (used on updates)
    """
    conflicting_statuses = [BookingStatus.PENDING, BookingStatus.APPROVED]

    qs = Booking.objects.filter(
        venue=venue,
        date=date,
        status__in=conflicting_statuses,
        start_time__lt=end_time,
        end_time__gt=start_time,
    )

    if exclude_booking_id is not None:
        qs = qs.exclude(pk=exclude_booking_id)

    if qs.exists():
        conflict = qs.first()
        raise ValidationError(
            f'This venue is already booked from {conflict.start_time} '
            f'to {conflict.end_time} on {date}.'
        )


def create_booking(user, venue, date, start_time, end_time, purpose=''):
    """
    Validate and create a new Booking.  Always call this instead of
    Booking.objects.create() directly.
    """
    check_booking_conflict(venue, date, start_time, end_time)

    return Booking.objects.create(
        user=user,
        venue=venue,
        date=date,
        start_time=start_time,
        end_time=end_time,
        purpose=purpose,
        status=BookingStatus.PENDING,
    )


def approve_booking(booking):
    """Approve a pending booking."""
    if booking.status != BookingStatus.PENDING:
        raise ValidationError('Only pending bookings can be approved.')

    # Re-check for conflicts in case another booking was approved in the meantime.
    check_booking_conflict(
        booking.venue,
        booking.date,
        booking.start_time,
        booking.end_time,
        exclude_booking_id=booking.pk,
    )

    booking.status = BookingStatus.APPROVED
    booking.save(update_fields=['status', 'updated_at'])
    return booking


def reject_booking(booking):
    """Reject a pending booking."""
    if booking.status != BookingStatus.PENDING:
        raise ValidationError('Only pending bookings can be rejected.')

    booking.status = BookingStatus.REJECTED
    booking.save(update_fields=['status', 'updated_at'])
    return booking
