import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserRole(models.TextChoices):
    ADMIN        = 'ADMIN',        'Admin'
    RECEPTIONIST = 'RECEPTIONIST', 'Receptionist'
    VC           = 'VC',           'Vice-Chancellor'
    STAFF        = 'STAFF',        'Staff'
    STUDENT      = 'STUDENT',      'Student'


class UserManager(BaseUserManager):
    """Custom manager that uses email as the unique identifier."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('An email address is required.')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('role', UserRole.ADMIN)
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom user model for VenU.

    Uses email as the login credential.
    Role determines access level throughout the system.
    """

    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.STUDENT,
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)   # required for Django admin access
    date_joined = models.DateTimeField(auto_now_add=True)

    # Two-factor auth (TOTP). `mfa_secret` is the base32 shared secret; it's set
    # during setup and only enforced once `mfa_enabled` is True.
    mfa_enabled = models.BooleanField(default=False)
    mfa_secret = models.CharField(max_length=64, blank=True, default='')

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    class Meta:
        verbose_name = 'user'
        verbose_name_plural = 'users'
        ordering = ['email']

    def __str__(self):
        return f'{self.get_full_name()} ({self.email})'

    def get_full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()

    # ------------------------------------------------------------------
    # Convenience role checks — use these in views/permissions
    # ------------------------------------------------------------------
    @property
    def is_admin(self):
        return self.role == UserRole.ADMIN

    @property
    def is_staff_member(self):
        return self.role in (UserRole.ADMIN, UserRole.RECEPTIONIST)

    @property
    def is_student(self):
        return self.role == UserRole.STUDENT

    @property
    def is_vc(self):
        return self.role == UserRole.VC

    @property
    def full_name(self):
        return self.get_full_name()


class MfaBackupCode(models.Model):
    """One-time backup codes for 2FA recovery (stored hashed)."""
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='mfa_backup_codes')
    code_hash = models.CharField(max_length=128)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'MfaBackupCode(user={self.user_id}, used={self.used_at is not None})'


class AllowedDomain(models.Model):
    """
    Email domains that may self-register without an enroll token.
    e.g. "example.edu" lets anyone@example.edu create an account.
    """
    domain = models.CharField(max_length=253, unique=True)
    default_role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.STUDENT,
    )
    note = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['domain']

    def __str__(self):
        return self.domain


class EnrollLink(models.Model):
    """
    One-time (or limited-use) enrolment links.
    Distribute to cohorts so they can self-register as a specific role.
    """
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    default_role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.STUDENT,
    )
    uses_limit = models.PositiveIntegerField(default=0, help_text='0 = unlimited')
    uses_count = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(null=True, blank=True)
    note = models.CharField(max_length=255, blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, related_name='enroll_links_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'EnrollLink {self.token} ({self.default_role})'

    @property
    def is_valid(self):
        if not self.is_active:
            return False
        if self.expires_at and timezone.now() > self.expires_at:
            return False
        if self.uses_limit and self.uses_count >= self.uses_limit:
            return False
        return True
