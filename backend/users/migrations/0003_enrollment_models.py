import uuid

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """Add AllowedDomain and EnrollLink models for self-serve enrollment."""

    dependencies = [
        ('users', '0002_receptionist_role'),
    ]

    operations = [
        migrations.CreateModel(
            name='AllowedDomain',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('domain', models.CharField(max_length=253, unique=True)),
                ('default_role', models.CharField(
                    choices=[
                        ('ADMIN', 'Admin'),
                        ('RECEPTIONIST', 'Receptionist'),
                        ('STAFF', 'Staff'),
                        ('STUDENT', 'Student'),
                    ],
                    default='STUDENT',
                    max_length=20,
                )),
                ('note', models.CharField(blank=True, default='', max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['domain'],
            },
        ),
        migrations.CreateModel(
            name='EnrollLink',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('default_role', models.CharField(
                    choices=[
                        ('ADMIN', 'Admin'),
                        ('RECEPTIONIST', 'Receptionist'),
                        ('STAFF', 'Staff'),
                        ('STUDENT', 'Student'),
                    ],
                    default='STUDENT',
                    max_length=20,
                )),
                ('uses_limit', models.PositiveIntegerField(default=0, help_text='0 = unlimited')),
                ('uses_count', models.PositiveIntegerField(default=0)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('note', models.CharField(blank=True, default='', max_length=255)),
                ('is_active', models.BooleanField(default=True)),
                ('created_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='enroll_links_created',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
