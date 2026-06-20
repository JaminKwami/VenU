from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.permissions import IsAdmin
from .models import AllowedDomain, EnrollLink
from .serializers import (
    UserSerializer, RegisterSerializer, UserUpdateSerializer,
    AllowedDomainSerializer, EnrollLinkSerializer,
)

User = get_user_model()


class LoginView(TokenObtainPairView):
    """
    POST /api/auth/login
    Returns access + refresh tokens.
    Inherits all logic from simplejwt — no extra code needed.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'login'


class RefreshView(TokenRefreshView):
    """
    POST /api/auth/refresh
    Exchange a refresh token for a new access token.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'token_refresh'


class MeView(APIView):
    """
    GET  /api/auth/me  — return the authenticated user's profile.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class RegisterView(APIView):
    """
    POST /api/auth/register

    Three paths:
    1. Admin token in Authorization header → create any role (existing behaviour).
    2. enroll_token in body → validate EnrollLink, self-register with link's default_role.
    3. Email domain matches AllowedDomain → self-register with domain's default_role.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        # ── Path 1: authenticated admin ──────────────────────────────
        if request.user and request.user.is_authenticated and request.user.is_admin:
            serializer = RegisterSerializer(data=request.data)
            if serializer.is_valid():
                user = serializer.save()
                return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # ── Path 2: enroll token ─────────────────────────────────────
        enroll_token = request.data.get('enroll_token')
        enroll_link = None
        if enroll_token:
            try:
                enroll_link = EnrollLink.objects.get(token=enroll_token)
            except EnrollLink.DoesNotExist:
                return Response({'detail': 'Invalid enrolment link.'}, status=status.HTTP_400_BAD_REQUEST)
            if not enroll_link.is_valid:
                return Response({'detail': 'This enrolment link has expired or reached its limit.'}, status=status.HTTP_400_BAD_REQUEST)

        # ── Path 3: domain whitelist ─────────────────────────────────
        domain_entry = None
        if not enroll_link:
            email = (request.data.get('email') or '').lower()
            domain = email.split('@')[-1] if '@' in email else ''
            try:
                domain_entry = AllowedDomain.objects.get(domain=domain)
            except AllowedDomain.DoesNotExist:
                return Response(
                    {'detail': 'Self-registration is not available. Contact your administrator.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        # ── Create user ───────────────────────────────────────────────
        data = dict(request.data)
        # Override role from link/domain — self-registrants can't pick their own role
        if enroll_link:
            data['role'] = enroll_link.default_role
        elif domain_entry:
            data['role'] = domain_entry.default_role

        serializer = RegisterSerializer(data=data)
        if serializer.is_valid():
            user = serializer.save()
            if enroll_link:
                EnrollLink.objects.filter(pk=enroll_link.pk).update(uses_count=enroll_link.uses_count + 1)
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    """
    POST /api/auth/logout
    Blacklist the provided refresh token so it cannot be used again.
    Body: {"refresh": "<token>"}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'detail': 'refresh token required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            return Response({'detail': 'Token is invalid or already blacklisted.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetRequestView(APIView):
    """
    POST /api/auth/password-reset/   Body: {"email": "..."}
    Always returns 200 (never reveals whether an account exists). If the email
    matches an active user, emails a tokenised reset link to the SPA.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'password_reset'

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        generic = Response(
            {'detail': 'If that email is registered, a reset link is on its way.'},
            status=status.HTTP_200_OK,
        )
        if not email:
            return generic
        try:
            user = User.objects.get(email__iexact=email, is_active=True)
        except User.DoesNotExist:
            return generic

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        link = f'{settings.FRONTEND_URL.rstrip("/")}/login?uid={uid}&token={token}'
        send_mail(
            subject='VenU — reset your password',
            message=(
                f'Hi {user.first_name or "there"},\n\n'
                f'Use the link below to set a new password. It expires shortly and '
                f'can only be used once:\n\n{link}\n\n'
                f'If you didn’t request this, you can safely ignore this email.'
            ),
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@venu.local'),
            recipient_list=[user.email],
            fail_silently=True,
        )
        return generic


class PasswordResetConfirmView(APIView):
    """
    POST /api/auth/password-reset/confirm/
    Body: {"uid": "...", "token": "...", "new_password": "..."}
    """
    permission_classes = [AllowAny]
    throttle_scope = 'password_reset'

    def post(self, request):
        uid = request.data.get('uid', '')
        token = request.data.get('token', '')
        new_password = request.data.get('new_password', '')

        try:
            user = User.objects.get(pk=urlsafe_base64_decode(uid).decode())
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response({'detail': 'This reset link is invalid or has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({'detail': 'This reset link is invalid or has expired.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(new_password, user)
        except DjangoValidationError as exc:
            return Response({'detail': ' '.join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=['password'])
        return Response({'detail': 'Password updated. You can now sign in.'})


class ChangePasswordView(APIView):
    """
    POST /api/auth/change-password/
    Body: {"current_password": "...", "new_password": "..."}
    For signed-in users (e.g. after a temporary password was issued).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current = request.data.get('current_password', '')
        new_password = request.data.get('new_password', '')

        if not request.user.check_password(current):
            return Response({'detail': 'Your current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_password(new_password, request.user)
        except DjangoValidationError as exc:
            return Response({'detail': ' '.join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new_password)
        request.user.save(update_fields=['password'])
        return Response({'detail': 'Password changed.'})


class UserListView(APIView):
    """
    GET /api/auth/users
    Admin-only list of all users.
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        users = User.objects.all()
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)


class UserDetailView(APIView):
    """
    GET    /api/auth/users/{id}/   — retrieve user (admin only)
    PATCH  /api/auth/users/{id}/   — update role or active status (admin only)
    DELETE /api/auth/users/{id}/   — deactivate (set is_active=False)
    """
    permission_classes = [IsAdmin]

    def _get(self, pk):
        try:
            return User.objects.get(pk=pk)
        except User.DoesNotExist:
            return None

    def get(self, request, pk):
        user = self._get(pk)
        if not user:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(UserSerializer(user).data)

    def patch(self, request, pk):
        user = self._get(pk)
        if not user:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if user == request.user and 'role' in request.data:
            from users.models import UserRole
            if request.data['role'] != UserRole.ADMIN:
                return Response({'detail': 'You cannot change your own role.'}, status=status.HTTP_400_BAD_REQUEST)
        allowed = {'role', 'is_active'}
        data = {k: v for k, v in request.data.items() if k in allowed}
        serializer = UserUpdateSerializer(user, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(UserSerializer(user).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        user = self._get(pk)
        if not user:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if user == request.user:
            return Response({'detail': 'You cannot deactivate yourself.'}, status=status.HTTP_400_BAD_REQUEST)
        user.is_active = False
        user.save(update_fields=['is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserPasswordResetView(APIView):
    """
    POST /api/auth/users/{id}/reset-password/
    Admin triggers a password reset email for a user.
    """
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        import secrets
        import string
        from django.conf import settings as django_settings
        from django.core.mail import send_mail
        temp = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
        user.set_password(temp)
        user.save(update_fields=['password'])
        send_mail(
            subject='VenU — your temporary password',
            message=(
                f'Hi {user.get_full_name()},\n\n'
                f'Your temporary password is: {temp}\n\n'
                'Please log in and change it immediately.'
            ),
            from_email=getattr(django_settings, 'DEFAULT_FROM_EMAIL', 'noreply@venu.local'),
            recipient_list=[user.email],
            fail_silently=False,
        )
        return Response({'detail': 'Password reset email sent.'})


# ──────────────────────────────────────────────────────────────────────────────
# Enrollment: AllowedDomain CRUD (EN1)
# ──────────────────────────────────────────────────────────────────────────────

class AllowedDomainListCreateView(APIView):
    """
    GET  /api/auth/enrollment/domains/  — list domains (admin)
    POST /api/auth/enrollment/domains/  — add domain (admin)
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        serializer = AllowedDomainSerializer(AllowedDomain.objects.all(), many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = AllowedDomainSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AllowedDomainDetailView(APIView):
    """
    DELETE /api/auth/enrollment/domains/{id}/  — remove domain (admin)
    PATCH  /api/auth/enrollment/domains/{id}/  — update domain (admin)
    """
    permission_classes = [IsAdmin]

    def _get(self, pk):
        try:
            return AllowedDomain.objects.get(pk=pk)
        except AllowedDomain.DoesNotExist:
            return None

    def patch(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = AllowedDomainSerializer(obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ──────────────────────────────────────────────────────────────────────────────
# Enrollment: EnrollLink CRUD (EN2)
# ──────────────────────────────────────────────────────────────────────────────

class EnrollLinkListCreateView(APIView):
    """
    GET  /api/auth/enrollment/links/  — list links (admin)
    POST /api/auth/enrollment/links/  — create link (admin)
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        serializer = EnrollLinkSerializer(EnrollLink.objects.all(), many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = EnrollLinkSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class EnrollLinkDetailView(APIView):
    """
    PATCH  /api/auth/enrollment/links/{id}/  — update (admin)
    DELETE /api/auth/enrollment/links/{id}/  — delete (admin)
    """
    permission_classes = [IsAdmin]

    def _get(self, pk):
        try:
            return EnrollLink.objects.get(pk=pk)
        except EnrollLink.DoesNotExist:
            return None

    def patch(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = EnrollLinkSerializer(obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        obj = self._get(pk)
        if not obj:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ──────────────────────────────────────────────────────────────────────────────
# Enrollment: Bulk invite (EN4)
# ──────────────────────────────────────────────────────────────────────────────

class BulkInviteView(APIView):
    """
    POST /api/auth/enrollment/bulk-invite/

    Body: { "emails": ["a@x.com", ...], "role": "STUDENT", "send_email": true }
    Creates accounts with a random temp password and optionally emails them.
    Returns {created: [...], skipped: [...]} where skipped = emails that already exist.
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        import secrets
        import string
        from django.conf import settings as django_settings
        from django.core.mail import send_mail

        emails = request.data.get('emails', [])
        role = request.data.get('role', 'STUDENT')
        send_email = request.data.get('send_email', True)

        if not isinstance(emails, list) or not emails:
            return Response({'detail': 'Provide a non-empty list of email addresses.'}, status=status.HTTP_400_BAD_REQUEST)

        valid_roles = [r.value for r in __import__('users.models', fromlist=['UserRole']).UserRole]
        if role not in valid_roles:
            return Response({'detail': f'Invalid role. Choose from: {", ".join(valid_roles)}'}, status=status.HTTP_400_BAD_REQUEST)

        created = []
        skipped = []

        for email in emails:
            email = email.strip().lower()
            if not email:
                continue
            if User.objects.filter(email=email).exists():
                skipped.append(email)
                continue
            temp = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
            user = User.objects.create_user(
                email=email,
                password=temp,
                first_name='',
                last_name='',
                role=role,
            )
            created.append(email)
            if send_email:
                try:
                    send_mail(
                        subject='You have been invited to VenU',
                        message=(
                            f'Hi,\n\n'
                            f'You have been invited to VenU, the campus venue booking system.\n\n'
                            f'Log in at: {getattr(django_settings, "FRONTEND_URL", "https://venu.up.railway.app")}/login\n'
                            f'Email: {email}\n'
                            f'Temporary password: {temp}\n\n'
                            'Please change your password after first login.'
                        ),
                        from_email=getattr(django_settings, 'DEFAULT_FROM_EMAIL', 'noreply@venu.local'),
                        recipient_list=[email],
                        fail_silently=True,
                    )
                except Exception:
                    pass

        return Response({'created': created, 'skipped': skipped}, status=status.HTTP_201_CREATED)
