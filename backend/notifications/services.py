"""
Notification dispatch — the single entry point every part of the app
should call to alert a user of something.

notify_user() always creates the in-app Notification record (that's what
powers the bell icon and never depends on any other channel being set
up). Push and email are best-effort extra channels layered on top; a
future SMS channel plugs in the same way. All channels degrade
gracefully — a delivery problem on one channel never blocks the others
or raises into the caller's booking/approval flow.
"""
import json
import logging

from django.conf import settings
from django.core.mail import send_mail

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


def _push_to_user(user, title, body, url):
    """Best-effort Web Push to every device the user has registered. No-op if unconfigured."""
    if not vapid_configured():
        return
    from .models import PushSubscription

    payload = {'title': title, 'body': body, 'url': url}
    dead_ids = []
    for sub in PushSubscription.objects.filter(user=user):
        if not _send_one(sub, payload):
            dead_ids.append(sub.id)
    if dead_ids:
        PushSubscription.objects.filter(id__in=dead_ids).delete()


def notify_user(user, title, body, url='/dashboard', email=False):
    """
    Alert a user: always creates an in-app Notification (read by the bell
    icon), always attempts push, and optionally sends email too.

    `email=True` is for alerts where the recipient may not have the app
    open any time soon (e.g. venue personnel preparing a space, or a
    waitlist slot opening up) — most in-app-only alerts (booking decided,
    etc.) don't need it since the booker is actively using the app.
    """
    if user is None:
        return

    from .models import Notification
    Notification.objects.create(user=user, title=title, body=body, url=url)

    _push_to_user(user, title, body, url)

    if email:
        send_mail(
            subject=title,
            message=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@venu.local'),
            recipient_list=[user.email],
            fail_silently=True,
        )
