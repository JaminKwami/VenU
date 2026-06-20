from django.urls import path

from .views import VapidPublicKeyView, PushSubscribeView, PushUnsubscribeView

urlpatterns = [
    path('vapid-public-key/', VapidPublicKeyView.as_view(), name='vapid-public-key'),
    path('subscribe/', PushSubscribeView.as_view(), name='push-subscribe'),
    path('unsubscribe/', PushUnsubscribeView.as_view(), name='push-unsubscribe'),
]
