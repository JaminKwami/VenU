"""
Booking business logic.

Kept separate from views so it can be reused by management commands,
signals, or a future async task queue without touching HTTP code.
"""

import uuid
from datetime import datetime, timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.db import models
from django.utils import timezone

from .models import AutoApprovalRule, Booking, BookingStatus, TermDate, WaitlistEntry

MAX_RECURRENCES = 26  # half a year of weekly bookings


# ── Conflict detection ────────────────────────────────────────────────────────

def check_booking_conflict(venue, date, start_time, end_time, exclude_booking_id=None):
    """
    Raise ValidationError if a confirmed or pending booking already occupies
    the requested slot for the given venue.

    Overlap condition (Allen's interval algebra):
        existing.start_time < requested.end_time
        AND
        existing.end_time   > requested.start_time
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


# ── Auto-approval ─────────────────────────────────────────────────────────────

def _should_auto_approve(venue, date, start_time, end_time, attendee_count):
    """
    Return True if the booking matches any enabled AutoApprovalRule.
    Checks: attendee count, duration, and advance notice.
    """
    now = timezone.now()
    booking_start = timezone.make_aware(datetime.combine(date, start_time))
    notice_hours = (booking_start - now).total_seconds() / 3600

    duration_hours = (
        datetime.combine(date, end_time) - datetime.combine(date, start_time)
    ).total_seconds() / 3600

    rules = AutoApprovalRule.objects.filter(
        enabled=True,
    ).filter(
        models.Q(venue=venue) | models.Q(venue__isnull=True)
    )

    for rule in rules:
        attendees_ok = attendee_count is None or attendee_count <= rule.max_attendees
        duration_ok = duration_hours <= rule.max_duration_hours
        notice_ok = notice_hours >= rule.min_notice_hours
        if attendees_ok and duration_ok and notice_ok:
            return True
    return False


# ── Term / holiday helpers ────────────────────────────────────────────────────

def _is_term_skip(date):
    """Return True if date falls in a TermDate period with skip_in_recurrence=True."""
    return TermDate.objects.filter(
        skip_in_recurrence=True,
        start_date__lte=date,
        end_date__gte=date,
    ).exists()


# ── Create bookings ───────────────────────────────────────────────────────────

def create_booking(user, venue, date, start_time, end_time, purpose='',
                   attendee_count=None, department='', notes='', series_id=None):
    """
    Validate and create a new Booking.  Always call this instead of
    Booking.objects.create() directly.

    If an auto-approval rule matches, the booking is immediately approved.
    """
    if date < timezone.localdate():
        raise ValidationError('Bookings cannot be made for past dates.')

    if attendee_count is not None and attendee_count > venue.capacity:
        raise ValidationError(
            f'Attendee count ({attendee_count}) exceeds the venue capacity '
            f'({venue.capacity}).'
        )

    check_booking_conflict(venue, date, start_time, end_time)

    initial_status = BookingStatus.PENDING
    decided_at = None
    if _should_auto_approve(venue, date, start_time, end_time, attendee_count):
        initial_status = BookingStatus.APPROVED
        decided_at = timezone.now()

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
        status=initial_status,
        decided_at=decided_at,
        series_id=series_id,
    )


def create_recurring_bookings(user, venue, date, start_time, end_time,
                              frequency, until, **details):
    """
    Create a weekly or bi-weekly series of bookings from `date` to `until`
    (inclusive).  Dates that clash with existing bookings, or that fall within
    a TermDate skip period, are skipped rather than failing the whole series.

    Returns (created_bookings, skipped_dates).
    """
    step = timedelta(days=14 if frequency == 'biweekly' else 7)
    if until < date:
        raise ValidationError('The series end date must be after the first booking.')

    series_id = uuid.uuid4()
    created, skipped = [], []
    current = date
    while current <= until and len(created) + len(skipped) < MAX_RECURRENCES:
        if _is_term_skip(current):
            skipped.append(current)
            current += step
            continue
        try:
            created.append(create_booking(
                user=user, venue=venue, date=current,
                start_time=start_time, end_time=end_time,
                series_id=series_id, **details,
            ))
        except ValidationError:
            skipped.append(current)
        current += step

    if not created:
        raise ValidationError('Every date in the series clashes with an existing booking or is within a blocked period.')
    return created, skipped


# ── Waitlist ──────────────────────────────────────────────────────────────────

def join_waitlist(user, venue, date, start_time, end_time):
    """Add the user to the waitlist for a slot that is currently taken."""
    if date < timezone.localdate():
        raise ValidationError('Cannot join a waitlist for a past date.')

    entry, created = WaitlistEntry.objects.get_or_create(
        user=user, venue=venue, date=date,
        start_time=start_time, end_time=end_time,
    )
    if not created:
        raise ValidationError('You are already on the waitlist for this slot.')
    return entry


def _notify_waitlist(booking):
    """
    Called when a booking is cancelled or rejected.  Emails everyone waiting
    for an overlapping slot on that venue/date and marks them notified.
    """
    entries = WaitlistEntry.objects.filter(
        venue=booking.venue,
        date=booking.date,
        notified=False,
        start_time__lt=booking.end_time,
        end_time__gt=booking.start_time,
    ).select_related('user')

    for entry in entries:
        send_mail(
            subject=f'A slot opened up at {booking.venue.name}',
            message=(
                f'Good news — {booking.venue.name} is now free on {entry.date} '
                f'from {entry.start_time:%H:%M} to {entry.end_time:%H:%M}.\n'
                f'Slots are first come, first served: book it from your VenU dashboard.'
            ),
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@venu.local'),
            recipient_list=[entry.user.email],
            fail_silently=True,
        )
    entries.update(notified=True)


# ── Check-in ──────────────────────────────────────────────────────────────────

def check_in_booking(booking, token):
    """
    Mark a booking as checked in.  Validates the check-in token that was
    issued when the booking was created.
    """
    if str(booking.check_in_token) != str(token):
        raise ValidationError('Invalid check-in code.')
    if booking.status != BookingStatus.APPROVED:
        raise ValidationError('Only approved bookings can be checked in.')
    if booking.checked_in_at is not None:
        raise ValidationError('This booking has already been checked in.')
    booking.checked_in_at = timezone.now()
    booking.save(update_fields=['checked_in_at', 'updated_at'])
    return booking


def auto_release_no_shows(grace_minutes=15):
    """
    Cancel approved bookings where no check-in was recorded within
    `grace_minutes` of the scheduled start time.  Returns the count released.
    Called by the auto_release_no_shows management command.
    """
    now = timezone.now()
    today = now.date()
    cutoff_dt = now - timedelta(minutes=grace_minutes)
    cutoff_time = cutoff_dt.time()

    no_shows = Booking.objects.filter(
        status=BookingStatus.APPROVED,
        date=today,
        start_time__lte=cutoff_time,
        checked_in_at__isnull=True,
    )

    count = 0
    for booking in no_shows:
        booking.status = BookingStatus.CANCELLED
        booking.save(update_fields=['status', 'updated_at'])
        _notify_waitlist(booking)
        count += 1
    return count


# ── Approval workflow ─────────────────────────────────────────────────────────

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
    _notify_waitlist(booking)
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
    _notify_waitlist(booking)
    return booking


# ── iCalendar export ──────────────────────────────────────────────────────────

def build_ical(bookings):
    """
    Render approved bookings as an iCalendar file (RFC 5545) so users can
    subscribe from Outlook, Google Calendar or Apple Calendar.
    """
    def fmt(date, time_):
        return f'{date:%Y%m%d}T{time_:%H%M%S}'

    def escape(text):
        return str(text).replace('\\', '\\\\').replace(';', '\\;').replace(',', '\\,').replace('\n', '\\n')

    now = timezone.now().strftime('%Y%m%dT%H%M%SZ')
    lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//VenU//Bookings//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
    ]
    for b in bookings:
        lines += [
            'BEGIN:VEVENT',
            f'UID:venu-booking-{b.pk}@venu',
            f'DTSTAMP:{now}',
            f'DTSTART:{fmt(b.date, b.start_time)}',
            f'DTEND:{fmt(b.date, b.end_time)}',
            f'SUMMARY:{escape(b.purpose or b.venue.name)}',
            f'LOCATION:{escape(f"{b.venue.name}, {b.venue.location}".strip(", "))}',
            f'DESCRIPTION:{escape(f"VenU booking #{b.pk} — {b.get_status_display()}")}',
            'END:VEVENT',
        ]
    lines.append('END:VCALENDAR')
    return '\r\n'.join(lines) + '\r\n'
