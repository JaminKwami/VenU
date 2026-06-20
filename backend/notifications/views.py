from django.conf import settings
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PushSubscription
from .services import vapid_configured


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
