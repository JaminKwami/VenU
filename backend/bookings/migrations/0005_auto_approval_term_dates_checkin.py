import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bookings', '0004_booking_series_id_waitlistentry'),
        ('venues', '0001_initial'),
    ]

    operations = [
        # Check-in fields on Booking
        migrations.AddField(
            model_name='booking',
            name='check_in_token',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AddField(
            model_name='booking',
            name='checked_in_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        # Auto-approval rules
        migrations.CreateModel(
            name='AutoApprovalRule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('max_attendees', models.PositiveIntegerField(default=20)),
                ('max_duration_hours', models.FloatField(default=2.0)),
                ('min_notice_hours', models.PositiveIntegerField(default=24)),
                ('enabled', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('venue', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='auto_approval_rules',
                    to='venues.venue',
                )),
            ],
            options={'ordering': ['venue__name']},
        ),
        # Term / holiday dates
        migrations.CreateModel(
            name='TermDate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('start_date', models.DateField()),
                ('end_date', models.DateField()),
                ('skip_in_recurrence', models.BooleanField(default=True)),
            ],
            options={'ordering': ['start_date']},
        ),
    ]
