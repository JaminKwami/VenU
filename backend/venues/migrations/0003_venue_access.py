from django.db import migrations, models


class Migration(migrations.Migration):
    """Add `access` field to Venue — controls which user roles can book it."""

    dependencies = [
        ('venues', '0002_venue_amenities_venue_building_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='venue',
            name='access',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('both',    'Staff and students'),
                    ('staff',   'Staff only'),
                    ('student', 'Students only'),
                    ('none',    'Not bookable (hidden)'),
                ],
                default='both',
                help_text='Which roles can see and book this venue.',
            ),
        ),
    ]
