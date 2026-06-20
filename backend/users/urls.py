from django.urls import path

from .views import (
    LoginView, RefreshView, MeView, RegisterView,
    LogoutView, UserListView, UserDetailView, UserPasswordResetView,
    PasswordResetRequestView, PasswordResetConfirmView, ChangePasswordView,
    MfaSetupView, MfaEnableView, MfaDisableView,
    AllowedDomainListCreateView, AllowedDomainDetailView,
    EnrollLinkListCreateView, EnrollLinkDetailView,
    BulkInviteView,
)

urlpatterns = [
    path('login/',                              LoginView.as_view(),                    name='auth-login'),
    path('refresh/',                            RefreshView.as_view(),                  name='auth-refresh'),
    path('logout/',                             LogoutView.as_view(),                   name='auth-logout'),
    path('me/',                                 MeView.as_view(),                       name='auth-me'),
    path('register/',                           RegisterView.as_view(),                 name='auth-register'),
    path('password-reset/',                     PasswordResetRequestView.as_view(),     name='auth-password-reset'),
    path('password-reset/confirm/',             PasswordResetConfirmView.as_view(),     name='auth-password-reset-confirm'),
    path('change-password/',                    ChangePasswordView.as_view(),           name='auth-change-password'),
    path('mfa/setup/',                          MfaSetupView.as_view(),                 name='auth-mfa-setup'),
    path('mfa/enable/',                         MfaEnableView.as_view(),                name='auth-mfa-enable'),
    path('mfa/disable/',                        MfaDisableView.as_view(),               name='auth-mfa-disable'),
    path('users/',                              UserListView.as_view(),                 name='auth-users'),
    path('users/<int:pk>/',                     UserDetailView.as_view(),               name='auth-user-detail'),
    path('users/<int:pk>/reset-password/',      UserPasswordResetView.as_view(),        name='auth-user-reset-password'),

    # Enrollment
    path('enrollment/domains/',                 AllowedDomainListCreateView.as_view(),  name='enrollment-domains'),
    path('enrollment/domains/<int:pk>/',        AllowedDomainDetailView.as_view(),      name='enrollment-domain-detail'),
    path('enrollment/links/',                   EnrollLinkListCreateView.as_view(),     name='enrollment-links'),
    path('enrollment/links/<int:pk>/',          EnrollLinkDetailView.as_view(),         name='enrollment-link-detail'),
    path('enrollment/bulk-invite/',             BulkInviteView.as_view(),               name='enrollment-bulk-invite'),
]
