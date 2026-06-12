"""
Management command: send_approval_digest

Emails every admin/staff user a summary of pending booking approvals.
Designed to run daily via a cron job or Render cron service.

Usage:
    python manage.py send_approval_digest
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.core.management.base import BaseCommand

from bookings.models import Booking, BookingStatus


class Command(BaseCommand):
    help = 'Send a daily digest of pending booking approvals to all admin/staff users.'

    def handle(self, *args, **options):
        pending = (
            Booking.objects
            .filter(status=BookingStatus.PENDING)
            .select_related('user', 'venue')
            .order_by('date', 'start_time')
        )
        count = pending.count()
        if count == 0:
            self.stdout.write('No pending bookings — digest skipped.')
            return

        User = get_user_model()
        admins = User.objects.filter(role__in=['ADMIN', 'STAFF'], is_active=True)
        if not admins.exists():
            self.stdout.write('No admin/staff users found.')
            return

        noun = 'approval' if count == 1 else 'approvals'
        lines = [f'{count} booking {noun} are waiting for a decision:\n']
        for b in pending[:25]:
            requester = b.user.full_name or b.user.email
            lines.append(
                f'  {b.date}  {b.start_time:%H:%M}–{b.end_time:%H:%M}'
                f'  {b.venue.name}'
                f'  — {requester}'
                + (f'  ({b.purpose})' if b.purpose else '')
            )
        if count > 25:
            lines.append(f'  … and {count - 25} more.')

        lines.append('\nReview and decide at your VenU admin dashboard.')
        body = '\n'.join(lines)

        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@venu.local')
        sent = 0
        for admin in admins:
            send_mail(
                subject=f'VenU — {count} pending {noun}',
                message=body,
                from_email=from_email,
                recipient_list=[admin.email],
                fail_silently=True,
            )
            sent += 1

        self.stdout.write(f'Digest sent to {sent} admin(s) — {count} pending booking(s).')
