"""
Management command: auto_release_no_shows

Cancels approved bookings where no check-in was recorded within a grace
period of the scheduled start time, then notifies the waitlist.

Run this every 5 minutes with a cron job or Render cron service:
    python manage.py auto_release_no_shows --grace 15

Usage:
    python manage.py auto_release_no_shows
    python manage.py auto_release_no_shows --grace 10   # 10-minute grace period
"""

from django.core.management.base import BaseCommand

from bookings.services import auto_release_no_shows


class Command(BaseCommand):
    help = 'Cancel approved bookings where no check-in occurred within the grace period.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--grace',
            type=int,
            default=15,
            help='Minutes after start time before a no-show booking is released (default: 15).',
        )

    def handle(self, *args, **options):
        grace = options['grace']
        count = auto_release_no_shows(grace_minutes=grace)
        if count:
            self.stdout.write(f'Released {count} no-show booking(s) (grace: {grace} min).')
        else:
            self.stdout.write(f'No no-shows found (grace: {grace} min).')
