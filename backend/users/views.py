from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.permissions import IsAdmin
from .serializers import UserSerializer, RegisterSerializer, UserUpdateSerializer

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
    Admin-only endpoint to create new user accounts.
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
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
                f'Hi {user.full_name},\n\n'
                f'Your temporary password is: {temp}\n\n'
                'Please log in and change it immediately.'
            ),
            from_email=getattr(django_settings, 'DEFAULT_FROM_EMAIL', 'noreply@venu.local'),
            recipient_list=[user.email],
            fail_silently=False,
        )
        return Response({'detail': 'Password reset email sent.'})
