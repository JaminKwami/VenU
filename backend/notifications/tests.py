from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from users.models import User, UserRole
from notifications.models import PushSubscription
from notifications.services import vapid_configured, notify_user


def make_user(email='push@test.com'):
    return User.objects.create_user(
        email=email, password='testpass123',
        first_name='Push', last_name='User', role=UserRole.STUDENT,
    )


SUB = {
    'endpoint': 'https://push.example.com/sub/abc123',
    'keys': {'p256dh': 'BPdh_key_value', 'auth': 'auth_secret'},
}

VAPID = dict(
    VAPID_PUBLIC_KEY='test-public',
    VAPID_PRIVATE_KEY='test-private',
    VAPID_ADMIN_EMAIL='admin@uhas.edu.gh',
)


class PushConfigTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user()
        self.client.force_authenticate(self.user)

    @override_settings(VAPID_PUBLIC_KEY='', VAPID_PRIVATE_KEY='')
    def test_unconfigured_reports_false(self):
        res = self.client.get('/api/push/vapid-public-key/')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['configured'])

    @override_settings(**VAPID)
    def test_configured_returns_public_key(self):
        res = self.client.get('/api/push/vapid-public-key/')
        self.assertTrue(res.data['configured'])
        self.assertEqual(res.data['public_key'], 'test-public')

    def test_vapid_key_requires_auth(self):
        self.client.force_authenticate(None)
        res = self.client.get('/api/push/vapid-public-key/')
        self.assertEqual(res.status_code, 401)


class PushSubscribeTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user()
        self.client.force_authenticate(self.user)

    @override_settings(VAPID_PUBLIC_KEY='', VAPID_PRIVATE_KEY='')
    def test_subscribe_blocked_when_unconfigured(self):
        res = self.client.post('/api/push/subscribe/', SUB, format='json')
        self.assertEqual(res.status_code, 503)

    @override_settings(**VAPID)
    def test_subscribe_creates_row(self):
        res = self.client.post('/api/push/subscribe/', SUB, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(PushSubscription.objects.filter(user=self.user).count(), 1)

    @override_settings(**VAPID)
    def test_subscribe_is_idempotent_by_endpoint(self):
        self.client.post('/api/push/subscribe/', SUB, format='json')
        self.client.post('/api/push/subscribe/', SUB, format='json')
        self.assertEqual(PushSubscription.objects.filter(endpoint=SUB['endpoint']).count(), 1)

    @override_settings(**VAPID)
    def test_subscribe_rejects_incomplete_payload(self):
        res = self.client.post('/api/push/subscribe/', {'endpoint': 'x'}, format='json')
        self.assertEqual(res.status_code, 400)

    @override_settings(**VAPID)
    def test_unsubscribe_removes_row(self):
        self.client.post('/api/push/subscribe/', SUB, format='json')
        res = self.client.post('/api/push/unsubscribe/', {'endpoint': SUB['endpoint']}, format='json')
        self.assertEqual(res.status_code, 204)
        self.assertEqual(PushSubscription.objects.count(), 0)


class NotifyUserTest(TestCase):
    def setUp(self):
        self.user = make_user()

    @override_settings(VAPID_PUBLIC_KEY='', VAPID_PRIVATE_KEY='')
    def test_notify_is_noop_when_unconfigured(self):
        # Must not raise even with no VAPID config / no subscriptions.
        self.assertFalse(vapid_configured())
        notify_user(self.user, 'Title', 'Body')  # should simply return
