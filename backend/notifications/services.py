"""
Web Push delivery (VAPID).

All entry points degrade gracefully: if VAPID keys aren't configured, or
pywebpush isn't installed, notify_user() is a silent no-op so the booking
flow is never blocked by notification problems.
"""
import json
import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def vapid_configured():
    return bool(getattr(settings, 'VAPID_PRIVATE_KEY', '') and getattr(settings, 'VAPID_PUBLIC_KEY', ''))


def _send_one(subscription, payload):
    """
    Send a push to one subscription.
    Returns True if it was delivered (or a transient error — keep the sub),
    False if the subscription is gone (404/410 — caller should delete it).
    """
    from pywebpush import webpush, WebPushException

    try:
        webpush(
            subscription_info=subscription.as_subscription_info(),
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={'sub': f'mailto:{settings.VAPID_ADMIN_EMAIL}'},
            timeout=10,
        )
        return True
    except WebPushException as exc:
        status = getattr(getattr(exc, 'response', None), 'status_code', None)
        if status in (404, 410):
            return False  # subscription expired/unsubscribed
        logger.warning('Web push failed (status=%s): %s', status, exc)
        return True
    except Exception as exc:  # network, config, etc. — never break the request
        logger.warning('Web push error: %s', exc)
        return True


def notify_user(user, title, body, url='/my-bookings'):
    """Push a notification to every device a user has registered. No-op if unconfigured."""
    if not vapid_configured() or user is None:
        return

    from .models import PushSubscription

    payload = {'title': title, 'body': body, 'url': url}
    dead_ids = []
    for sub in PushSubscription.objects.filter(user=user):
        if not _send_one(sub, payload):
            dead_ids.append(sub.id)
    if dead_ids:
        PushSubscription.objects.filter(id__in=dead_ids).delete()
