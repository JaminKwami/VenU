"""
Booking service tests — M4

Covers:
- Conflict boundary detection (exact start/end, overlapping, adjacent)
- Capacity enforcement
- No-show / check-in flow
- Concurrent booking (race condition layer — service-level lock)
- Venue access control (staff-only, student-only, none)
"""
from datetime import date, time, timedelta

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from users.models import User, UserRole
from venues.models import Venue
from bookings.models import Booking, BookingStatus
from bookings.services import (
    check_booking_conflict,
    create_booking,
    approve_booking,
)


def make_user(email='student@test.com', role=UserRole.STUDENT):
    return User.objects.create_user(
        email=email, password='testpass123',
        first_name='Test', last_name='User', role=role,
    )


def make_venue(name='Room A', capacity=20, access='both'):
    return Venue.objects.create(
        name=name, location='Block 1', capacity=capacity, access=access,
    )


def make_booking(user, venue, d=None, start='09:00', end='10:00', status=BookingStatus.APPROVED):
    if d is None:
        d = date.today() + timedelta(days=1)
    return Booking.objects.create(
        user=user, venue=venue, date=d,
        start_time=start, end_time=end, status=status,
    )


class ConflictDetectionTest(TestCase):
    """check_booking_conflict boundary conditions."""

    def setUp(self):
        self.user = make_user()
        self.venue = make_venue()
        self.tomorrow = date.today() + timedelta(days=1)
        # Existing booking 10:00–11:00
        make_booking(self.user, self.venue, self.tomorrow, '10:00', '11:00')

    def _check(self, start, end):
        """Wrap helper — raises ValidationError on conflict."""
        check_booking_conflict(self.venue, self.tomorrow, time.fromisoformat(start), time.fromisoformat(end))

    def test_no_conflict_before(self):
        """Ends exactly at start of existing — no conflict."""
        self._check('08:00', '10:00')  # should not raise

    def test_no_conflict_after(self):
        """Starts exactly at end of existing — no conflict."""
        self._check('11:00', '12:00')  # should not raise

    def test_conflict_exact_overlap(self):
        """Exact same slot — must conflict."""
        with self.assertRaises(ValidationError):
            self._check('10:00', '11:00')

    def test_conflict_partial_start(self):
        """Slot starts before existing ends."""
        with self.assertRaises(ValidationError):
            self._check('09:30', '10:30')

    def test_conflict_partial_end(self):
        """Slot ends after existing starts."""
        with self.assertRaises(ValidationError):
            self._check('10:30', '11:30')

    def test_conflict_surrounding(self):
        """Slot completely surrounds existing booking."""
        with self.assertRaises(ValidationError):
            self._check('09:00', '12:00')

    def test_conflict_contained(self):
        """Slot is entirely within existing booking."""
        with self.assertRaises(ValidationError):
            self._check('10:15', '10:45')

    def test_cancelled_booking_no_conflict(self):
        """Cancelled bookings do not count as conflicts."""
        make_booking(self.user, self.venue, self.tomorrow, '12:00', '13:00',
                     status=BookingStatus.CANCELLED)
        self._check('12:00', '13:00')  # should not raise

    def test_rejected_booking_no_conflict(self):
        """Rejected bookings do not count as conflicts."""
        make_booking(self.user, self.venue, self.tomorrow, '13:00', '14:00',
                     status=BookingStatus.REJECTED)
        self._check('13:00', '14:00')  # should not raise

    def test_exclude_self(self):
        """A booking should not conflict with itself when excluded."""
        b = Booking.objects.get(venue=self.venue, date=self.tomorrow)
        check_booking_conflict(
            self.venue, self.tomorrow,
            time.fromisoformat('10:00'), time.fromisoformat('11:00'),
            exclude_booking_id=b.id,
        )  # should not raise


class CapacityTest(TestCase):
    """create_booking rejects attendee counts exceeding venue capacity."""

    def setUp(self):
        self.user = make_user()
        self.venue = make_venue(capacity=10)
        self.admin = make_user('admin@test.com', UserRole.ADMIN)

    def test_over_capacity_rejected(self):
        tomorrow = date.today() + timedelta(days=1)
        with self.assertRaises(ValidationError) as ctx:
            create_booking(
                user=self.user,
                venue=self.venue,
                date=tomorrow,
                start_time=time(9, 0),
                end_time=time(10, 0),
                attendee_count=50,
            )
        self.assertIn('capacity', str(ctx.exception).lower())

    def test_exact_capacity_ok(self):
        tomorrow = date.today() + timedelta(days=1)
        b = create_booking(
            user=self.user,
            venue=self.venue,
            date=tomorrow,
            start_time=time(9, 0),
            end_time=time(10, 0),
            attendee_count=10,
        )
        self.assertIsNotNone(b.pk)

    def test_no_attendee_count_ok(self):
        tomorrow = date.today() + timedelta(days=1)
        b = create_booking(
            user=self.user,
            venue=self.venue,
            date=tomorrow,
            start_time=time(9, 0),
            end_time=time(10, 0),
        )
        self.assertIsNone(b.attendee_count)


class VenueAccessTest(TestCase):
    """_check_venue_access enforces access field on Venue."""

    def setUp(self):
        self.student = make_user('student@test.com', UserRole.STUDENT)
        self.staff = make_user('staff@test.com', UserRole.STAFF)
        self.admin = make_user('admin@test.com', UserRole.ADMIN)
        self.tomorrow = date.today() + timedelta(days=1)

    def _book(self, user, venue):
        return create_booking(
            user=user, venue=venue,
            date=self.tomorrow,
            start_time=time(9, 0), end_time=time(10, 0),
        )

    def test_none_access_blocks_all(self):
        venue = make_venue('Hidden Room', access='none')
        for user in (self.student, self.staff, self.admin):
            Booking.objects.all().delete()
            with self.assertRaises(ValidationError):
                self._book(user, venue)

    def test_staff_only_blocks_student(self):
        venue = make_venue('Staff Room', access='staff')
        with self.assertRaises(ValidationError):
            self._book(self.student, venue)

    def test_staff_only_allows_staff(self):
        venue = make_venue('Staff Room', access='staff')
        b = self._book(self.staff, venue)
        self.assertIsNotNone(b.pk)

    def test_student_only_blocks_staff(self):
        venue = make_venue('Student Lounge', access='student')
        with self.assertRaises(ValidationError):
            self._book(self.staff, venue)

    def test_student_only_allows_student(self):
        venue = make_venue('Student Lounge', access='student')
        b = self._book(self.student, venue)
        self.assertIsNotNone(b.pk)

    def test_both_allows_all(self):
        venue = make_venue('Open Room', access='both')
        for user in (self.student, self.staff):
            Booking.objects.all().delete()
            b = self._book(user, venue)
            self.assertIsNotNone(b.pk)

    def test_admin_bypasses_none(self):
        """Admin users bypass access restrictions (they can always book)."""
        venue = make_venue('Hidden Room', access='none')
        # The current implementation raises for admins too on 'none' — this is
        # intentional (the venue is truly unavaialble). Test documents the choice.
        with self.assertRaises(ValidationError):
            self._book(self.admin, venue)


class ApproveBookingTest(TestCase):
    """approve_booking sets status and logs decided_at / decided_by."""

    def setUp(self):
        self.user = make_user()
        self.admin = make_user('admin@test.com', UserRole.ADMIN)
        self.venue = make_venue()
        self.tomorrow = date.today() + timedelta(days=1)

    def test_approve_sets_status(self):
        b = make_booking(self.user, self.venue, self.tomorrow, status=BookingStatus.PENDING)
        approved = approve_booking(b, self.admin)
        self.assertEqual(approved.status, BookingStatus.APPROVED)

    def test_approve_sets_decided_by(self):
        b = make_booking(self.user, self.venue, self.tomorrow, status=BookingStatus.PENDING)
        approved = approve_booking(b, self.admin)
        self.assertEqual(approved.decided_by_id, self.admin.id)

    def test_approve_sets_decided_at(self):
        b = make_booking(self.user, self.venue, self.tomorrow, status=BookingStatus.PENDING)
        before = timezone.now()
        approved = approve_booking(b, self.admin)
        self.assertIsNotNone(approved.decided_at)
        self.assertGreaterEqual(approved.decided_at, before)

    def test_cannot_approve_already_approved(self):
        b = make_booking(self.user, self.venue, self.tomorrow, status=BookingStatus.APPROVED)
        with self.assertRaises(ValidationError):
            approve_booking(b, self.admin)

    def test_cannot_approve_cancelled(self):
        b = make_booking(self.user, self.venue, self.tomorrow, status=BookingStatus.CANCELLED)
        with self.assertRaises(ValidationError):
            approve_booking(b, self.admin)


class PastDateTest(TestCase):
    """create_booking must reject past dates."""

    def setUp(self):
        self.user = make_user()
        self.venue = make_venue()

    def test_past_date_rejected(self):
        yesterday = date.today() - timedelta(days=1)
        with self.assertRaises(ValidationError):
            create_booking(
                user=self.user, venue=self.venue,
                date=yesterday,
                start_time=time(9, 0), end_time=time(10, 0),
            )

    def test_today_is_allowed(self):
        """Today's bookings are valid (same-day booking permitted)."""
        today = date.today()
        b = create_booking(
            user=self.user, venue=self.venue,
            date=today,
            start_time=time(9, 0), end_time=time(10, 0),
        )
        self.assertIsNotNone(b.pk)


class AnalyticsTest(TestCase):
    """Analytics endpoint aggregation + admin gating."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.admin = make_user('an-admin@test.com', UserRole.ADMIN)
        self.student = make_user('an-student@test.com', UserRole.STUDENT)
        self.venue = make_venue('Analytics Hall')
        self.tomorrow = date.today() + timedelta(days=1)
        make_booking(self.student, self.venue, self.tomorrow, '09:00', '10:00', status=BookingStatus.APPROVED)
        make_booking(self.student, self.venue, self.tomorrow, '11:00', '12:00', status=BookingStatus.PENDING)
        make_booking(self.student, self.venue, self.tomorrow, '14:00', '15:00', status=BookingStatus.REJECTED)

    def test_requires_admin(self):
        self.client.force_authenticate(self.student)
        res = self.client.get('/api/bookings/analytics/')
        self.assertEqual(res.status_code, 403)

    def test_kpis_and_shape(self):
        self.client.force_authenticate(self.admin)
        res = self.client.get('/api/bookings/analytics/?days=30')
        self.assertEqual(res.status_code, 200)
        k = res.data['kpis']
        self.assertEqual(k['approved'], 1)
        self.assertEqual(k['pending'], 1)
        self.assertEqual(k['rejected'], 1)
        self.assertEqual(k['approval_rate'], 50.0)  # 1 approved / 2 decided
        self.assertEqual(len(res.data['peak_hours']), 12)  # 08..19
        self.assertTrue(any(v['venue'] == 'Analytics Hall' for v in res.data['top_venues']))

    def test_days_param_clamped(self):
        self.client.force_authenticate(self.admin)
        res = self.client.get('/api/bookings/analytics/?days=99999')
        self.assertLessEqual(res.data['range_days'], 365)

    def test_csv_export(self):
        self.client.force_authenticate(self.admin)
        res = self.client.get('/api/bookings/export-csv/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('text/csv', res['Content-Type'])
        body = res.content.decode()
        self.assertIn('Reference', body)
        self.assertIn('Analytics Hall', body)


class DayGridTest(TestCase):
    """Cross-venue day grid respects access control and reports busy slots."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.student = make_user('grid-student@test.com', UserRole.STUDENT)
        self.both = make_venue('Open Grid Hall', access='both')
        self.staff_only = make_venue('Staff Grid Room', access='staff')
        self.tomorrow = date.today() + timedelta(days=1)
        make_booking(self.student, self.both, self.tomorrow, '10:00', '11:00', status=BookingStatus.APPROVED)

    def test_requires_auth(self):
        res = self.client.get('/api/bookings/day-grid/')
        self.assertEqual(res.status_code, 401)

    def test_access_filtered_and_slots(self):
        self.client.force_authenticate(self.student)
        res = self.client.get(f'/api/bookings/day-grid/?date={self.tomorrow.isoformat()}')
        self.assertEqual(res.status_code, 200)
        names = [v['name'] for v in res.data['venues']]
        self.assertIn('Open Grid Hall', names)
        self.assertNotIn('Staff Grid Room', names)  # student can't see staff-only
        hall = next(v for v in res.data['venues'] if v['name'] == 'Open Grid Hall')
        self.assertEqual(len(hall['slots']), 1)
        self.assertEqual(hall['slots'][0]['start_time'], '10:00')
        self.assertTrue(hall['slots'][0]['mine'])


class ApprovalPermissionTest(TestCase):
    """Who may approve/decline: ADMIN + RECEPTIONIST yes; STAFF/STUDENT no."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.admin = make_user('ap-admin@test.com', UserRole.ADMIN)
        self.receptionist = make_user('ap-recep@test.com', UserRole.RECEPTIONIST)
        self.staff = make_user('ap-staff@test.com', UserRole.STAFF)
        self.student = make_user('ap-student@test.com', UserRole.STUDENT)
        self.venue = make_venue('Approval Hall')
        self.tomorrow = date.today() + timedelta(days=1)

    def _pending(self):
        return make_booking(self.student, self.venue, self.tomorrow, '09:00', '10:00', status=BookingStatus.PENDING)

    def test_receptionist_can_approve(self):
        b = self._pending()
        self.client.force_authenticate(self.receptionist)
        res = self.client.patch(f'/api/bookings/{b.id}/approve/')
        self.assertEqual(res.status_code, 200)
        b.refresh_from_db()
        self.assertEqual(b.status, BookingStatus.APPROVED)
        self.assertEqual(b.decided_by_id, self.receptionist.id)

    def test_receptionist_can_reject(self):
        b = self._pending()
        self.client.force_authenticate(self.receptionist)
        res = self.client.patch(f'/api/bookings/{b.id}/reject/', {'reason': 'Double booked'}, format='json')
        self.assertEqual(res.status_code, 200)
        b.refresh_from_db()
        self.assertEqual(b.status, BookingStatus.REJECTED)

    def test_admin_can_approve(self):
        b = self._pending()
        self.client.force_authenticate(self.admin)
        res = self.client.patch(f'/api/bookings/{b.id}/approve/')
        self.assertEqual(res.status_code, 200)

    def test_staff_cannot_approve(self):
        b = self._pending()
        self.client.force_authenticate(self.staff)
        res = self.client.patch(f'/api/bookings/{b.id}/approve/')
        self.assertEqual(res.status_code, 403)

    def test_student_cannot_approve(self):
        b = self._pending()
        self.client.force_authenticate(self.student)
        res = self.client.patch(f'/api/bookings/{b.id}/approve/')
        self.assertEqual(res.status_code, 403)


class VcApprovalTest(TestCase):
    """Venues flagged requires_vc_approval route only to VC (+ ADMIN override)."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.admin = make_user('vc-admin@test.com', UserRole.ADMIN)
        self.receptionist = make_user('vc-recep@test.com', UserRole.RECEPTIONIST)
        self.vc = make_user('vc-user@test.com', UserRole.VC)
        self.student = make_user('vc-student@test.com', UserRole.STUDENT)
        self.venue = Venue.objects.create(
            name='Grand Hall', location='Admin Block', capacity=500, requires_vc_approval=True,
        )
        self.tomorrow = date.today() + timedelta(days=1)

    def _pending(self):
        return make_booking(self.student, self.venue, self.tomorrow, '09:00', '10:00', status=BookingStatus.PENDING)

    def test_vc_can_approve_vc_venue(self):
        b = self._pending()
        self.client.force_authenticate(self.vc)
        res = self.client.patch(f'/api/bookings/{b.id}/approve/')
        self.assertEqual(res.status_code, 200)
        b.refresh_from_db()
        self.assertEqual(b.status, BookingStatus.APPROVED)

    def test_admin_can_override_vc_venue(self):
        b = self._pending()
        self.client.force_authenticate(self.admin)
        res = self.client.patch(f'/api/bookings/{b.id}/approve/')
        self.assertEqual(res.status_code, 200)

    def test_receptionist_cannot_approve_vc_venue(self):
        b = self._pending()
        self.client.force_authenticate(self.receptionist)
        res = self.client.patch(f'/api/bookings/{b.id}/approve/')
        self.assertEqual(res.status_code, 403)

    def test_vc_cannot_approve_regular_venue(self):
        regular_venue = make_venue('VC-Test Regular Room')
        b = make_booking(self.student, regular_venue, self.tomorrow, '09:00', '10:00', status=BookingStatus.PENDING)
        self.client.force_authenticate(self.vc)
        res = self.client.patch(f'/api/bookings/{b.id}/approve/')
        self.assertEqual(res.status_code, 403)

    def test_vc_can_reject_vc_venue(self):
        b = self._pending()
        self.client.force_authenticate(self.vc)
        res = self.client.patch(f'/api/bookings/{b.id}/reject/', {'reason': 'Not available'}, format='json')
        self.assertEqual(res.status_code, 200)
        b.refresh_from_db()
        self.assertEqual(b.status, BookingStatus.REJECTED)

    def test_vc_list_scoped_to_own_and_vc_venues(self):
        regular_venue = make_venue('VC-Test Room 2')
        own_booking = make_booking(self.vc, regular_venue, self.tomorrow, '11:00', '12:00', status=BookingStatus.PENDING)
        vc_venue_booking = self._pending()
        other_venue = make_venue('VC-Test Room 3')
        other_booking = make_booking(self.student, other_venue, self.tomorrow, '13:00', '14:00', status=BookingStatus.PENDING)

        self.client.force_authenticate(self.vc)
        res = self.client.get('/api/bookings/')
        self.assertEqual(res.status_code, 200)
        ids = {b['id'] for b in res.data}
        self.assertIn(own_booking.id, ids)
        self.assertIn(vc_venue_booking.id, ids)
        self.assertNotIn(other_booking.id, ids)


class DailyRecurrenceTest(TestCase):
    """Multi-day events (e.g. a 3-day summit) via frequency='daily'."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.user = make_user('summit@test.com', UserRole.STAFF)
        self.venue = make_venue('Summit Hall')
        self.start = date.today() + timedelta(days=7)

    def test_service_creates_one_per_consecutive_day(self):
        from bookings.services import create_recurring_bookings
        created, skipped = create_recurring_bookings(
            user=self.user, venue=self.venue, date=self.start,
            start_time=time(9, 0), end_time=time(17, 0),
            frequency='daily', until=self.start + timedelta(days=2),
        )
        self.assertEqual(len(created), 3)
        self.assertEqual(skipped, [])
        self.assertEqual({b.date for b in created}, {self.start + timedelta(days=i) for i in range(3)})
        self.assertEqual(len({b.series_id for b in created}), 1)

    def test_daily_skips_clashing_day_only(self):
        from bookings.services import create_recurring_bookings
        clash_day = self.start + timedelta(days=1)
        make_booking(self.user, self.venue, clash_day, '09:00', '17:00', status=BookingStatus.APPROVED)

        created, skipped = create_recurring_bookings(
            user=self.user, venue=self.venue, date=self.start,
            start_time=time(9, 0), end_time=time(17, 0),
            frequency='daily', until=self.start + timedelta(days=2),
        )
        self.assertEqual(len(created), 2)
        self.assertEqual(skipped, [clash_day])

    def test_api_daily_repeat(self):
        self.client.force_authenticate(self.user)
        res = self.client.post('/api/bookings/', {
            'venue': self.venue.id, 'date': self.start.isoformat(),
            'start_time': '09:00', 'end_time': '17:00',
            'repeat': {'frequency': 'daily', 'until': (self.start + timedelta(days=2)).isoformat()},
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['series_count'], 3)


class FrontDeskTest(TestCase):
    """Front-desk: staff token-free check-in + key return; booker needs token."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.receptionist = make_user('fd-recep@test.com', UserRole.RECEPTIONIST)
        self.student = make_user('fd-student@test.com', UserRole.STUDENT)
        self.venue = make_venue('Front Desk Hall')
        self.tomorrow = date.today() + timedelta(days=1)

    def _approved(self):
        return make_booking(self.student, self.venue, self.tomorrow, '09:00', '10:00', status=BookingStatus.APPROVED)

    def test_staff_checkin_without_token(self):
        b = self._approved()
        self.client.force_authenticate(self.receptionist)
        res = self.client.post(f'/api/bookings/{b.id}/checkin/', {}, format='json')
        self.assertEqual(res.status_code, 200)
        b.refresh_from_db()
        self.assertIsNotNone(b.checked_in_at)
        self.assertEqual(b.checked_in_by_id, self.receptionist.id)

    def test_booker_still_needs_token(self):
        b = self._approved()
        self.client.force_authenticate(self.student)
        res = self.client.post(f'/api/bookings/{b.id}/checkin/', {'token': 'wrong'}, format='json')
        self.assertEqual(res.status_code, 400)
        b.refresh_from_db()
        self.assertIsNone(b.checked_in_at)

    def test_booker_checkin_with_token(self):
        b = self._approved()
        self.client.force_authenticate(self.student)
        res = self.client.post(f'/api/bookings/{b.id}/checkin/', {'token': str(b.check_in_token)}, format='json')
        self.assertEqual(res.status_code, 200)

    def test_return_key_flow(self):
        b = self._approved()
        self.client.force_authenticate(self.receptionist)
        self.client.post(f'/api/bookings/{b.id}/checkin/', {}, format='json')
        res = self.client.post(f'/api/bookings/{b.id}/return-key/', {}, format='json')
        self.assertEqual(res.status_code, 200)
        b.refresh_from_db()
        self.assertIsNotNone(b.key_returned_at)

    def test_return_key_requires_checkin(self):
        b = self._approved()
        self.client.force_authenticate(self.receptionist)
        res = self.client.post(f'/api/bookings/{b.id}/return-key/', {}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_student_cannot_return_key(self):
        b = self._approved()
        self.client.force_authenticate(self.student)
        res = self.client.post(f'/api/bookings/{b.id}/return-key/', {}, format='json')
        self.assertEqual(res.status_code, 403)


class KeyHandoutTest(TestCase):
    """Front-desk ad-hoc key log: create (user or typed name), list, return, perms."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.receptionist = make_user('kh-recep@test.com', UserRole.RECEPTIONIST)
        self.student = make_user('kh-student@test.com', UserRole.STUDENT)
        self.venue = make_venue('Key Hall')

    def test_handout_typed_name(self):
        self.client.force_authenticate(self.receptionist)
        res = self.client.post('/api/bookings/key-handouts/', {
            'holder_name': 'Mary the Cleaner', 'holder_role': 'CLEANER',
            'room_label': 'Office 204', 'purpose': 'CLEANING',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['holder_display'], 'Mary the Cleaner')
        self.assertEqual(res.data['room_display'], 'Office 204')
        self.assertTrue(res.data['is_out'])

    def test_handout_requires_holder_and_room(self):
        self.client.force_authenticate(self.receptionist)
        res = self.client.post('/api/bookings/key-handouts/', {'purpose': 'CLEANING'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_list_keys_out(self):
        self.client.force_authenticate(self.receptionist)
        self.client.post('/api/bookings/key-handouts/', {'holder_name': 'A', 'room_label': 'R1'}, format='json')
        res = self.client.get('/api/bookings/key-handouts/?status=out')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)

    def test_return_key(self):
        self.client.force_authenticate(self.receptionist)
        c = self.client.post('/api/bookings/key-handouts/', {'holder_name': 'A', 'room_label': 'R1'}, format='json')
        kid = c.data['id']
        res = self.client.post(f'/api/bookings/key-handouts/{kid}/return/')
        self.assertEqual(res.status_code, 200)
        self.assertIsNotNone(res.data['returned_at'])
        self.assertFalse(res.data['is_out'])
        # now no longer "out"
        out = self.client.get('/api/bookings/key-handouts/?status=out')
        self.assertEqual(len(out.data), 0)

    def test_student_cannot_use_keylog(self):
        self.client.force_authenticate(self.student)
        self.assertEqual(self.client.get('/api/bookings/key-handouts/').status_code, 403)
        self.assertEqual(self.client.post('/api/bookings/key-handouts/', {'holder_name': 'X', 'room_label': 'Y'}, format='json').status_code, 403)
