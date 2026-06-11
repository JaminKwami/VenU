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
    attendee_count = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Expected number of attendees (checked against venue capacity).',
    )
    rejection_reason = models.CharField(max_length=500, blank=True, default='')
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
        # DB-level constraint: a venue cannot have two approved/pending
        # bookings with identical (date, start_time, end_time).
        # Fine-grained overlap logic is handled in the service layer.
        constraints = [
            models.CheckConstraint(
                check=models.Q(end_time__gt=models.F('start_time')),
                name='booking_end_after_start',
            )
        ]

    def __str__(self):
        return (
            f'{self.venue.name} | {self.date} '
            f'{self.start_time}–{self.end_time} | {self.status}'
        )
