"""Account self-service tests: password reset (forgot) + change password."""
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient

from users.models import User, UserRole


def make_user(email='student@uhas.edu.gh', password='OldPassw0rd!'):
    return User.objects.create_user(
        email=email, password=password,
        first_name='Ama', last_name='Mensah', role=UserRole.STUDENT,
    )


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    FRONTEND_URL='https://venu.example',
)
class PasswordResetRequestTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        cache.clear()
        self.user = make_user()

    def test_known_email_sends_link(self):
        res = self.client.post('/api/auth/password-reset/', {'email': self.user.email}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('venu.example/login?uid=', mail.outbox[0].body)

    def test_unknown_email_is_silent_but_ok(self):
        res = self.client.post('/api/auth/password-reset/', {'email': 'nobody@uhas.edu.gh'}, format='json')
        self.assertEqual(res.status_code, 200)          # no account enumeration
        self.assertEqual(len(mail.outbox), 0)

    def test_blank_email_ok(self):
        res = self.client.post('/api/auth/password-reset/', {}, format='json')
        self.assertEqual(res.status_code, 200)


class PasswordResetConfirmTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        cache.clear()
        self.user = make_user()
        self.uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        self.token = default_token_generator.make_token(self.user)

    def test_valid_token_sets_password(self):
        res = self.client.post('/api/auth/password-reset/confirm/', {
            'uid': self.uid, 'token': self.token, 'new_password': 'BrandNew!2026',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('BrandNew!2026'))

    def test_bad_token_rejected(self):
        res = self.client.post('/api/auth/password-reset/confirm/', {
            'uid': self.uid, 'token': 'not-a-real-token', 'new_password': 'BrandNew!2026',
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_token_single_use(self):
        ok = self.client.post('/api/auth/password-reset/confirm/', {
            'uid': self.uid, 'token': self.token, 'new_password': 'BrandNew!2026',
        }, format='json')
        self.assertEqual(ok.status_code, 200)
        # token is invalidated once the password hash changes
        again = self.client.post('/api/auth/password-reset/confirm/', {
            'uid': self.uid, 'token': self.token, 'new_password': 'Another!2026',
        }, format='json')
        self.assertEqual(again.status_code, 400)

    def test_weak_password_rejected(self):
        res = self.client.post('/api/auth/password-reset/confirm/', {
            'uid': self.uid, 'token': self.token, 'new_password': '123',
        }, format='json')
        self.assertEqual(res.status_code, 400)


class ChangePasswordTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        cache.clear()
        self.user = make_user()
        self.client.force_authenticate(self.user)

    def test_requires_auth(self):
        self.client.force_authenticate(None)
        res = self.client.post('/api/auth/change-password/', {
            'current_password': 'OldPassw0rd!', 'new_password': 'BrandNew!2026',
        }, format='json')
        self.assertEqual(res.status_code, 401)

    def test_wrong_current_rejected(self):
        res = self.client.post('/api/auth/change-password/', {
            'current_password': 'WRONG', 'new_password': 'BrandNew!2026',
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_change_succeeds(self):
        res = self.client.post('/api/auth/change-password/', {
            'current_password': 'OldPassw0rd!', 'new_password': 'BrandNew!2026',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('BrandNew!2026'))

    def test_weak_new_password_rejected(self):
        res = self.client.post('/api/auth/change-password/', {
            'current_password': 'OldPassw0rd!', 'new_password': 'abc',
        }, format='json')
        self.assertEqual(res.status_code, 400)
