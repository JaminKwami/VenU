from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification, PushSubscription
from .serializers import NotificationSerializer
from .services import vapid_configured


class NotificationListView(APIView):
    """
    GET /api/notifications/?limit=20 — the current user's notifications
    (most recent first), plus their unread count. This is what the bell
    icon polls.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(user=request.user)
        try:
            limit = max(1, min(100, int(request.query_params.get('limit', 20))))
        except (TypeError, ValueError):
            limit = 20
        return Response({
            'results': NotificationSerializer(qs[:limit], many=True).data,
            'unread_count': qs.filter(read_at__isnull=True).count(),
        })


class NotificationMarkReadView(APIView):
    """POST /api/notifications/{id}/read/ — mark one notification read."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            n = Notification.objects.get(pk=pk, user=request.user)
        except Notification.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if n.read_at is None:
            n.read_at = timezone.now()
            n.save(update_fields=['read_at'])
        return Response(NotificationSerializer(n).data)


class NotificationMarkAllReadView(APIView):
    """POST /api/notifications/read-all/ — mark every unread notification read."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        updated = Notification.objects.filter(user=request.user, read_at__isnull=True).update(read_at=timezone.now())
        return Response({'updated': updated})


class VapidPublicKeyView(APIView):
    """GET /api/push/vapid-public-key/ — the application server key for the browser."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'public_key': getattr(settings, 'VAPID_PUBLIC_KEY', '') or '',
            'configured': vapid_configured(),
        })


class PushSubscribeView(APIView):
    """POST /api/push/subscribe/ — register a browser push subscription."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not vapid_configured():
            return Response(
                {'detail': 'Push notifications are not configured on the server.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        data = request.data or {}
        endpoint = data.get('endpoint')
        keys = data.get('keys') or {}
        p256dh, auth = keys.get('p256dh'), keys.get('auth')
        if not (endpoint and p256dh and auth):
            return Response({'detail': 'Invalid subscription payload.'}, status=status.HTTP_400_BAD_REQUEST)

        PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={
                'user': request.user,
                'p256dh': p256dh,
                'auth': auth,
                'user_agent': request.META.get('HTTP_USER_AGENT', '')[:300],
            },
        )
        return Response({'detail': 'Subscribed.'}, status=status.HTTP_201_CREATED)


class PushUnsubscribeView(APIView):
    """POST /api/push/unsubscribe/ — remove a subscription by endpoint."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        endpoint = (request.data or {}).get('endpoint')
        if endpoint:
            PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
