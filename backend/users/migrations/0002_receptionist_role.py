from django.db import migrations, models


class Migration(migrations.Migration):
    """Add RECEPTIONIST role and widen the role field to max_length=20."""

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('ADMIN',        'Admin'),
                    ('RECEPTIONIST', 'Receptionist'),
                    ('STAFF',        'Staff'),
                    ('STUDENT',      'Student'),
                ],
                default='STUDENT',
                max_length=20,
            ),
        ),
    ]
