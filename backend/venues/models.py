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
    capacity = models.PositiveIntegerField()
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.name} (cap: {self.capacity})'
