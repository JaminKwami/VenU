"""
OpenID Connect (SSO) integration — scaffolded for Microsoft Entra ID / Google.

Disabled until configured via env (OIDC_ENABLED=True + client id/secret +
discovery URL). When off, all OIDC endpoints report disabled and the rest of
auth is unaffected. Uses Authlib's Django client; state/nonce live in the
session during the redirect handshake (same-origin to the API domain).
"""
from django.conf import settings

from .models import AllowedDomain, User, UserRole

_oauth = None


def oidc_enabled():
    return bool(
        getattr(settings, 'OIDC_ENABLED', False)
        and settings.OIDC_CLIENT_ID
        and settings.OIDC_CLIENT_SECRET
        and settings.OIDC_DISCOVERY_URL
    )


def get_client():
    """Lazily build + cache the Authlib OAuth client registered as 'oidc'."""
    global _oauth
    if _oauth is None:
        from authlib.integrations.django_client import OAuth
        _oauth = OAuth()
        _oauth.register(
            name='oidc',
            client_id=settings.OIDC_CLIENT_ID,
            client_secret=settings.OIDC_CLIENT_SECRET,
            server_metadata_url=settings.OIDC_DISCOVERY_URL,
            client_kwargs={'scope': 'openid email profile'},
        )
    return _oauth.oidc


def provision_user_from_claims(claims):
    """
    Find or create a VenU user from OIDC ID-token claims.
    Matches on email; new users get the role from a matching AllowedDomain,
    else OIDC_DEFAULT_ROLE. Never elevates an existing user's role.
    Returns (user, created) or raises ValueError if no email claim.
    """
    email = (claims.get('email') or claims.get('preferred_username') or '').strip().lower()
    if not email:
        raise ValueError('No email in OIDC claims.')

    existing = User.objects.filter(email__iexact=email).first()
    if existing:
        return existing, False

    domain = email.split('@')[-1]
    allowed = AllowedDomain.objects.filter(domain__iexact=domain).first()
    role = allowed.default_role if allowed else getattr(settings, 'OIDC_DEFAULT_ROLE', UserRole.STUDENT)

    given = claims.get('given_name') or claims.get('name', '').split(' ')[0] or 'New'
    family = claims.get('family_name') or ' '.join(claims.get('name', '').split(' ')[1:]) or 'User'

    user = User.objects.create_user(
        email=email, password=None,  # SSO accounts have no usable local password
        first_name=given, last_name=family, role=role,
    )
    user.set_unusable_password()
    user.save(update_fields=['password'])
    return user, True
