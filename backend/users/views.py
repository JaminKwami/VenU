from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.permissions import IsAdmin
from .serializers import UserSerializer, RegisterSerializer

User = get_user_model()


class LoginView(TokenObtainPairView):
    """
    POST /api/auth/login
    Returns access + refresh tokens.
    Inherits all logic from simplejwt — no extra code needed.
    """
    permission_classes = [AllowAny]


class RefreshView(TokenRefreshView):
    """
    POST /api/auth/refresh
    Exchange a refresh token for a new access token.
    """
    permission_classes = [AllowAny]


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
