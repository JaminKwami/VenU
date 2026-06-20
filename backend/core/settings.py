"""
Django settings for VenU project.
"""

from pathlib import Path
from datetime import timedelta

import dj_database_url
from decouple import config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# ------------------------------------------------------------------
# SECURITY
# ------------------------------------------------------------------
SECRET_KEY = config('SECRET_KEY')

DEBUG = config('DEBUG', default=False, cast=bool)

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',')

# Render injects the external hostname at runtime.
RENDER_EXTERNAL_HOSTNAME = config('RENDER_EXTERNAL_HOSTNAME', default='')
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

# Behind Render's proxy, trust the forwarded protocol header so Django
# knows the original request was HTTPS.
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True


# ------------------------------------------------------------------
# APPLICATIONS
# ------------------------------------------------------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',

    # Local
    'users',
    'venues',
    'bookings',
    'notifications',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',          # must be before CommonMiddleware
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'


# ------------------------------------------------------------------
# DATABASE  (SQLite for dev — swap ENGINE for PostgreSQL in prod)
# ------------------------------------------------------------------
# DATABASE_URL (Neon Postgres in prod) takes precedence; SQLite otherwise.
DATABASES = {
    'default': dj_database_url.config(
        default=f'sqlite:///{BASE_DIR / "db.sqlite3"}',
        conn_max_age=600,
        conn_health_checks=True,
        ssl_require=config('DATABASE_SSL', default=not DEBUG, cast=bool),
    )
}


# ------------------------------------------------------------------
# CUSTOM USER MODEL
# ------------------------------------------------------------------
AUTH_USER_MODEL = 'users.User'


# ------------------------------------------------------------------
# DRF + JWT
# ------------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.ScopedRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'login': '10/min',
        'token_refresh': '30/min',
        'kiosk': '60/min',
        'password_reset': '5/min',
    },
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.LimitOffsetPagination',
    'PAGE_SIZE': 100,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}


# ------------------------------------------------------------------
# CORS (allow frontend dev server)
# ------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in config(
        'CORS_ALLOWED_ORIGINS',
        default='http://localhost:5173,http://127.0.0.1:5173',
    ).split(',')
    if origin.strip()
]


# ------------------------------------------------------------------
# PASSWORD VALIDATION
# ------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# ------------------------------------------------------------------
# INTERNATIONALISATION
# ------------------------------------------------------------------
LANGUAGE_CODE = 'en-us'
TIME_ZONE = config('TIME_ZONE', default='Africa/Accra')  # UHAS — Ghana (GMT)
USE_I18N = True
USE_TZ = True


# ------------------------------------------------------------------
# EMAIL  (H1)
# ------------------------------------------------------------------
EMAIL_BACKEND = config(
    'EMAIL_BACKEND',
    default='django.core.mail.backends.console.EmailBackend',
)
EMAIL_HOST = config('EMAIL_HOST', default='')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='noreply@venu.local')


# ------------------------------------------------------------------
# WEB PUSH (VAPID)
# ------------------------------------------------------------------
# Generate a keypair once and set these env vars on the server. When unset,
# push is silently disabled (the API reports configured=false) and the rest
# of the app is unaffected.
# Public URL of the SPA, used to build password-reset links in emails.
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:5173')


# ------------------------------------------------------------------
# SSO / OpenID Connect (Microsoft Entra ID, Google, …)
# ------------------------------------------------------------------
# Disabled until all of OIDC_ENABLED + client id/secret + discovery URL are set.
# For Microsoft: OIDC_DISCOVERY_URL =
#   https://login.microsoftonline.com/<tenant-id>/v2.0/.well-known/openid-configuration
OIDC_ENABLED = config('OIDC_ENABLED', default=False, cast=bool)
OIDC_CLIENT_ID = config('OIDC_CLIENT_ID', default='')
OIDC_CLIENT_SECRET = config('OIDC_CLIENT_SECRET', default='')
OIDC_DISCOVERY_URL = config('OIDC_DISCOVERY_URL', default='')
OIDC_REDIRECT_URI = config('OIDC_REDIRECT_URI', default='')  # else built from the request
OIDC_LABEL = config('OIDC_LABEL', default='Microsoft')
OIDC_DEFAULT_ROLE = config('OIDC_DEFAULT_ROLE', default='STUDENT')

VAPID_PUBLIC_KEY = config('VAPID_PUBLIC_KEY', default='')
VAPID_PRIVATE_KEY = config('VAPID_PRIVATE_KEY', default='')
VAPID_ADMIN_EMAIL = config('VAPID_ADMIN_EMAIL', default='admin@uhas.edu.gh')


# ------------------------------------------------------------------
# STATIC FILES
# ------------------------------------------------------------------
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
