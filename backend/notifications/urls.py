from django.urls import path

from .views import (
    NotificationListView,
    NotificationMarkAllReadView,
    NotificationMarkReadView,
    PushSubscribeView,
    PushUnsubscribeView,
    VapidPublicKeyView,
)

urlpatterns = [
    path('push/vapid-public-key/', VapidPublicKeyView.as_view(), name='vapid-public-key'),
    path('push/subscribe/', PushSubscribeView.as_view(), name='push-subscribe'),
    path('push/unsubscribe/', PushUnsubscribeView.as_view(), name='push-unsubscribe'),
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/<int:pk>/read/', NotificationMarkReadView.as_view(), name='notification-read'),
    path('notifications/read-all/', NotificationMarkAllReadView.as_view(), name='notification-read-all'),
]
