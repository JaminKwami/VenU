from django.conf import settings
from django.db import models


class Notification(models.Model):
    """
    A persistent, in-app alert for a user — the notification bell's actual
    content. Created for every call to notify_user(), independent of
    whether push is configured or an email was also sent, so "in-app" never
    silently depends on those other channels being set up.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True, default='')
    url = models.CharField(max_length=255, blank=True, default='/dashboard')
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Notification(user={self.user_id}, {self.title!r})'


class PushSubscription(models.Model):
    """A single browser/device Web Push subscription belonging to a user."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='push_subscriptions',
    )
    endpoint = models.URLField(max_length=600, unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    user_agent = models.CharField(max_length=300, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'PushSubscription(user={self.user_id}, {self.endpoint[:40]}…)'

    def as_subscription_info(self):
        """Shape pywebpush expects."""
        return {
            'endpoint': self.endpoint,
            'keys': {'p256dh': self.p256dh, 'auth': self.auth},
        }
