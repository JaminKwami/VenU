from django.conf import settings
from django.db import models


class Venue(models.Model):
    """
    Represents a bookable space (lecture hall, event room, lab, etc.).

    Capacity and location are kept generic so the system works for any
    institution.  Additional attributes (equipment list, images, etc.)
    will be added in Phase 2.
    """

    name = models.CharField(max_length=200, unique=True)
    location = models.CharField(max_length=255)
    building = models.CharField(max_length=120, blank=True, default='')
    venue_type = models.CharField(
        max_length=40, blank=True, default='',
        help_text='e.g. Lecture hall, Studio, Lab, Seminar room, Outdoor, Music, Sports',
    )
    capacity = models.PositiveIntegerField()
    amenities = models.JSONField(default=list, blank=True)
    min_notice_hours = models.PositiveIntegerField(default=0)
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    requires_vc_approval = models.BooleanField(
        default=False,
        help_text='Bookings for this venue may only be approved or declined by the VC role.',
    )
    access = models.CharField(
        max_length=20,
        choices=[
            ('both',    'Staff and students'),
            ('staff',   'Staff only'),
            ('student', 'Students only'),
            ('none',    'Not bookable (hidden)'),
        ],
        default='both',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.name} (cap: {self.capacity})'


class VenuePersonnel(models.Model):
    """
    Staff assigned to look after a specific venue (caretaker, AV technician,
    etc.). When a booking for the venue is approved, every assigned person is
    notified so they can prepare the space. A venue can have several people
    assigned, and a person can be assigned to several venues.
    """

    venue = models.ForeignKey(Venue, on_delete=models.CASCADE, related_name='personnel')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assigned_venues',
    )
    role_label = models.CharField(
        max_length=80, blank=True, default='',
        help_text='e.g. Caretaker, AV Technician',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['venue__name', 'role_label']
        constraints = [
            models.UniqueConstraint(fields=['venue', 'user'], name='unique_personnel_per_venue'),
        ]

    def __str__(self):
        return f'{self.user} → {self.venue} ({self.role_label or "Personnel"})'
