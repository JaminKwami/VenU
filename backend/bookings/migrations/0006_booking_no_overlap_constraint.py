from django.db import migrations


class Migration(migrations.Migration):
    """
    Adds a database-level exclusion constraint that prevents overlapping
    PENDING/APPROVED bookings for the same venue on the same date.

    Uses btree_gist + int4range (minutes since midnight) because Postgres
    has no native timerange type.  This is Layer 2 of the double-booking fix;
    Layer 1 is the select_for_update() lock in services.py.
    """

    dependencies = [
        ('bookings', '0005_auto_approval_term_dates_checkin'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE EXTENSION IF NOT EXISTS btree_gist;

                ALTER TABLE bookings_booking
                ADD CONSTRAINT booking_no_overlap
                EXCLUDE USING gist (
                    venue_id WITH =,
                    date WITH =,
                    int4range(
                        EXTRACT(HOUR FROM start_time)::int * 60
                            + EXTRACT(MINUTE FROM start_time)::int,
                        EXTRACT(HOUR FROM end_time)::int * 60
                            + EXTRACT(MINUTE FROM end_time)::int
                    ) WITH &&
                )
                WHERE (status IN ('PENDING', 'APPROVED'));
            """,
            reverse_sql="""
                ALTER TABLE bookings_booking
                DROP CONSTRAINT IF EXISTS booking_no_overlap;
            """,
        ),
    ]
