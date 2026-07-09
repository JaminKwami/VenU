from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from users.models import User, UserRole
from notifications.models import Notification, PushSubscription
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
    def test_creates_in_app_notification_even_when_push_unconfigured(self):
        # The in-app record is the one guarantee that doesn't depend on
        # push being set up — must not raise, and must still be recorded.
        self.assertFalse(vapid_configured())
        notify_user(self.user, 'Title', 'Body')
        n = Notification.objects.get(user=self.user)
        self.assertEqual(n.title, 'Title')
        self.assertIsNone(n.read_at)

    def test_notify_noop_for_none_user(self):
        notify_user(None, 'Title', 'Body')  # must not raise
        self.assertEqual(Notification.objects.count(), 0)

    def test_email_flag_sends_mail(self):
        from django.core import mail
        mail.outbox = []
        notify_user(self.user, 'Subject', 'Body text', email=True)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.user.email])

    def test_no_email_by_default(self):
        from django.core import mail
        mail.outbox = []
        notify_user(self.user, 'Subject', 'Body text')
        self.assertEqual(len(mail.outbox), 0)


class NotificationApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = make_user('inbox@test.com')
        self.other = make_user('other@test.com')
        self.client.force_authenticate(self.user)

    def test_list_requires_auth(self):
        self.client.force_authenticate(None)
        res = self.client.get('/api/notifications/')
        self.assertEqual(res.status_code, 401)

    def test_list_returns_own_notifications_and_unread_count(self):
        notify_user(self.user, 'A', 'a')
        notify_user(self.user, 'B', 'b')
        notify_user(self.other, 'Not mine', 'x')

        res = self.client.get('/api/notifications/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['results']), 2)
        self.assertEqual(res.data['unread_count'], 2)
        titles = {n['title'] for n in res.data['results']}
        self.assertEqual(titles, {'A', 'B'})

    def test_list_most_recent_first(self):
        notify_user(self.user, 'First', '')
        notify_user(self.user, 'Second', '')
        res = self.client.get('/api/notifications/')
        self.assertEqual([n['title'] for n in res.data['results']], ['Second', 'First'])

    def test_mark_one_read(self):
        notify_user(self.user, 'A', 'a')
        n = Notification.objects.get(user=self.user)
        res = self.client.post(f'/api/notifications/{n.id}/read/')
        self.assertEqual(res.status_code, 200)
        n.refresh_from_db()
        self.assertIsNotNone(n.read_at)

        res2 = self.client.get('/api/notifications/')
        self.assertEqual(res2.data['unread_count'], 0)

    def test_cannot_mark_another_users_notification_read(self):
        notify_user(self.other, 'Not mine', 'x')
        n = Notification.objects.get(user=self.other)
        res = self.client.post(f'/api/notifications/{n.id}/read/')
        self.assertEqual(res.status_code, 404)

    def test_mark_all_read(self):
        notify_user(self.user, 'A', '')
        notify_user(self.user, 'B', '')
        notify_user(self.other, 'Not mine', '')

        res = self.client.post('/api/notifications/read-all/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['updated'], 2)

        self.assertEqual(Notification.objects.filter(user=self.user, read_at__isnull=True).count(), 0)
        # Doesn't touch other users' notifications.
        self.assertEqual(Notification.objects.filter(user=self.other, read_at__isnull=True).count(), 1)
