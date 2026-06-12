import uuid

from django.db import models
from django.conf import settings

from venues.models import Venue


class BookingStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'
    CANCELLED = 'CANCELLED', 'Cancelled'


class Booking(models.Model):
    """
    Records a user's request to use a venue during a specific time slot.

    Conflict detection is enforced at the service layer (services.py) before
    a booking is created or updated.  The model itself stores only facts.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='bookings',
    )
    venue = models.ForeignKey(
        Venue,
        on_delete=models.CASCADE,
        related_name='bookings',
    )
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    status = models.CharField(
        max_length=10,
        choices=BookingStatus.choices,
        default=BookingStatus.PENDING,
    )
    purpose = models.CharField(max_length=300, blank=True, default='')
    department = models.CharField(max_length=120, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    attendee_count = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Expected number of attendees (checked against venue capacity).',
    )
    rejection_reason = models.CharField(max_length=500, blank=True, default='')
    # Recurring bookings created together share a series_id.
    series_id = models.UUIDField(null=True, blank=True, db_index=True)
    # Check-in: token shown to booker; checked_in_at stamped on arrival.
    check_in_token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    checked_in_at = models.DateTimeField(null=True, blank=True)
    # Audit trail: which admin decided, and when.
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='decided_bookings',
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-start_time']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_time__gt=models.F('start_time')),
                name='booking_end_after_start',
            )
        ]

    def __str__(self):
        return (
            f'{self.venue.name} | {self.date} '
            f'{self.start_time}–{self.end_time} | {self.status}'
        )


class WaitlistEntry(models.Model):
    """
    A user waiting for a venue slot that is currently taken.
    When the blocking booking is cancelled or rejected, everyone on the
    waitlist for an overlapping slot is notified by email.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='waitlist_entries',
    )
    venue = models.ForeignKey(
        Venue,
        on_delete=models.CASCADE,
        related_name='waitlist_entries',
    )
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    notified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'venue', 'date', 'start_time', 'end_time'],
                name='waitlist_unique_slot_per_user',
            )
        ]

    def __str__(self):
        return f'{self.user.email} waiting for {self.venue.name} on {self.date}'


class AutoApprovalRule(models.Model):
    """
    When a new booking matches all criteria, it is auto-approved on creation.
    venue=None means the rule applies globally to every venue.
    """

    venue = models.ForeignKey(
        Venue,
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='auto_approval_rules',
        help_text='Leave blank to apply this rule to every venue.',
    )
    max_attendees = models.PositiveIntegerField(
        default=20,
        help_text='Auto-approve if attendee_count is at or below this value.',
    )
    max_duration_hours = models.FloatField(
        default=2.0,
        help_text='Auto-approve if the booking duration is at or below this many hours.',
    )
    min_notice_hours = models.PositiveIntegerField(
        default=24,
        help_text='Auto-approve only when the booking is made this far in advance.',
    )
    enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['venue__name']

    def __str__(self):
        scope = self.venue.name if self.venue_id else 'Global'
        return f'AutoApprovalRule [{scope}] ≤{self.max_attendees} ppl, ≤{self.max_duration_hours}h'


class TermDate(models.Model):
    """
    Academic calendar periods (terms, reading weeks, holiday breaks).
    Recurring bookings skip dates that fall within a period where
    skip_in_recurrence is True.
    """

    name = models.CharField(
        max_length=200,
        help_text='e.g. "Winter Break 2026" or "Reading Week — Spring"',
    )
    start_date = models.DateField()
    end_date = models.DateField()
    skip_in_recurrence = models.BooleanField(
        default=True,
        help_text='Recurring booking series will skip dates inside this period.',
    )

    class Meta:
        ordering = ['start_date']

    def __str__(self):
        return f'{self.name} ({self.start_date}–{self.end_date})'
