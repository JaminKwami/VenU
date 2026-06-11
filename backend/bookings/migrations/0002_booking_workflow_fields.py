# Adds cancellation status, rejection reason, audit trail, and attendee count.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bookings', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='booking',
            name='status',
            field=models.CharField(
                choices=[
                    ('PENDING', 'Pending'),
                    ('APPROVED', 'Approved'),
                    ('REJECTED', 'Rejected'),
                    ('CANCELLED', 'Cancelled'),
                ],
                default='PENDING',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='booking',
            name='attendee_count',
            field=models.PositiveIntegerField(
                blank=True,
                help_text='Expected number of attendees (checked against venue capacity).',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='booking',
            name='rejection_reason',
            field=models.CharField(blank=True, default='', max_length=500),
        ),
        migrations.AddField(
            model_name='booking',
            name='decided_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='decided_bookings',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='booking',
            name='decided_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
