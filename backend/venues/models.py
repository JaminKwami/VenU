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
