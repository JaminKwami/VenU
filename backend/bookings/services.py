"""
Booking business logic.

Kept separate from views so it can be reused by management commands,
signals, or a future async task queue without touching HTTP code.
"""

from django.core.exceptions import ValidationError
from django.utils import timezone

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


def get_taken_slots(venue, date):
    """
    Return the pending/approved time slots for a venue on a date,
    so users can see availability before submitting a request.
    """
    return (
        Booking.objects
        .filter(
            venue=venue,
            date=date,
            status__in=[BookingStatus.PENDING, BookingStatus.APPROVED],
        )
        .order_by('start_time')
        .values('start_time', 'end_time', 'status')
    )


def create_booking(user, venue, date, start_time, end_time, purpose='',
                   attendee_count=None, department='', notes=''):
    """
    Validate and create a new Booking.  Always call this instead of
    Booking.objects.create() directly.
    """
    if date < timezone.localdate():
        raise ValidationError('Bookings cannot be made for past dates.')

    if attendee_count is not None and attendee_count > venue.capacity:
        raise ValidationError(
            f'Attendee count ({attendee_count}) exceeds the venue capacity '
            f'({venue.capacity}).'
        )

    check_booking_conflict(venue, date, start_time, end_time)

    return Booking.objects.create(
        user=user,
        venue=venue,
        date=date,
        start_time=start_time,
        end_time=end_time,
        purpose=purpose,
        department=department,
        notes=notes,
        attendee_count=attendee_count,
        status=BookingStatus.PENDING,
    )


def approve_booking(booking, decided_by=None):
    """Approve a pending booking, stamping who decided and when."""
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
    booking.decided_by = decided_by
    booking.decided_at = timezone.now()
    booking.save(update_fields=['status', 'decided_by', 'decided_at', 'updated_at'])
    return booking


def reject_booking(booking, decided_by=None, reason=''):
    """Reject a pending booking with an optional reason shown to the requester."""
    if booking.status != BookingStatus.PENDING:
        raise ValidationError('Only pending bookings can be rejected.')

    booking.status = BookingStatus.REJECTED
    booking.rejection_reason = reason
    booking.decided_by = decided_by
    booking.decided_at = timezone.now()
    booking.save(update_fields=['status', 'rejection_reason', 'decided_by', 'decided_at', 'updated_at'])
    return booking


def cancel_booking(booking, cancelled_by):
    """
    Cancel a booking.  The owner can cancel their own pending/approved
    bookings before the event date; admins can cancel any.
    """
    if booking.status not in (BookingStatus.PENDING, BookingStatus.APPROVED):
        raise ValidationError('Only pending or approved bookings can be cancelled.')

    is_owner = booking.user_id == cancelled_by.pk
    if not (is_owner or cancelled_by.is_admin):
        raise ValidationError('You can only cancel your own bookings.')

    if booking.date < timezone.localdate():
        raise ValidationError('Past bookings cannot be cancelled.')

    booking.status = BookingStatus.CANCELLED
    booking.save(update_fields=['status', 'updated_at'])
    return booking
