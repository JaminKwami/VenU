from django.urls import path

from .views import (
    LoginView, RefreshView, MeView, RegisterView,
    LogoutView, UserListView, UserDetailView, UserPasswordResetView,
)

urlpatterns = [
    path('login/',                              LoginView.as_view(),            name='auth-login'),
    path('refresh/',                            RefreshView.as_view(),          name='auth-refresh'),
    path('logout/',                             LogoutView.as_view(),           name='auth-logout'),
    path('me/',                                 MeView.as_view(),               name='auth-me'),
    path('register/',                           RegisterView.as_view(),         name='auth-register'),
    path('users/',                              UserListView.as_view(),         name='auth-users'),
    path('users/<int:pk>/',                     UserDetailView.as_view(),       name='auth-user-detail'),
    path('users/<int:pk>/reset-password/',      UserPasswordResetView.as_view(), name='auth-user-reset-password'),
]
