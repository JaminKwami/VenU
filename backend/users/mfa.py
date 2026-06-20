"""TOTP two-factor auth helpers."""
import secrets

import pyotp
from django.contrib.auth.hashers import check_password, make_password

from .models import MfaBackupCode

ISSUER = 'VenU · UHAS'
BACKUP_CODE_COUNT = 8


def new_secret():
    return pyotp.random_base32()


def provisioning_uri(user, secret):
    return pyotp.TOTP(secret).provisioning_uri(name=user.email, issuer_name=ISSUER)


def verify_totp(secret, code):
    if not (secret and code):
        return False
    try:
        return pyotp.TOTP(secret).verify(str(code).strip(), valid_window=1)
    except Exception:
        return False


def generate_backup_codes(user):
    """Replace any existing codes with a fresh set; return the plaintext codes once."""
    user.mfa_backup_codes.all().delete()
    plain = []
    for _ in range(BACKUP_CODE_COUNT):
        code = f'{secrets.randbelow(10**8):08d}'  # 8-digit numeric
        plain.append(code)
        MfaBackupCode.objects.create(user=user, code_hash=make_password(code))
    return plain


def consume_backup_code(user, code):
    """If `code` matches an unused backup code, mark it used and return True."""
    code = str(code).strip()
    for bc in user.mfa_backup_codes.filter(used_at__isnull=True):
        if check_password(code, bc.code_hash):
            from django.utils import timezone
            bc.used_at = timezone.now()
            bc.save(update_fields=['used_at'])
            return True
    return False


def verify_user_otp(user, code):
    """Accept either a valid TOTP code or an unused backup code."""
    if verify_totp(user.mfa_secret, code):
        return True
    return consume_backup_code(user, code)
