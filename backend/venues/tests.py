"""
Venue suggestion (AI) tests.

Covers the alternatives engine that recommends similar, available venues when
a booking slot clashes:
- calculate_similarity_score: capacity, amenities, building, capacity floor
- get_available_venues: conflict exclusion + role-based access filtering
- get_venue_alternatives: ranking, current-venue exclusion, access safety
"""
from datetime import date, time, timedelta

from django.test import TestCase

from users.models import User, UserRole
from venues.models import Venue
from bookings.models import Booking, BookingStatus
from venues.services import (
    calculate_similarity_score,
    get_available_venues,
    get_venue_alternatives,
)


def make_user(email='s@test.com', role=UserRole.STUDENT):
    return User.objects.create_user(
        email=email, password='testpass123',
        first_name='Test', last_name='User', role=role,
    )


def make_venue(name, capacity=20, building='Block A', amenities=None, access='both'):
    return Venue.objects.create(
        name=name, location=building, building=building, capacity=capacity,
        amenities=amenities or [], access=access,
    )


def make_booking(user, venue, d, start, end, status=BookingStatus.APPROVED):
    return Booking.objects.create(
        user=user, venue=venue, date=d, start_time=start, end_time=end, status=status,
    )


class SimilarityScoreTest(TestCase):
    def setUp(self):
        self.current = make_venue('Origin', capacity=20, building='Block A', amenities=['Projector', 'WiFi'])

    def test_capacity_below_minimum_returns_none(self):
        # Too small to use → None (filtered out), distinct from a 0 "dissimilar" score
        small = make_venue('Tiny', capacity=5, building='Block A', amenities=['Projector', 'WiFi'])
        self.assertIsNone(calculate_similarity_score(self.current, small, min_capacity=10))

    def test_big_but_dissimilar_scores_zero_not_none(self):
        # Far bigger, different building, no shared amenities → 0, but still a
        # valid suggestion (not None) since it meets the capacity requirement.
        dissimilar = make_venue('Hall', capacity=400, building='Block Z', amenities=[])
        score = calculate_similarity_score(self.current, dissimilar, min_capacity=1)
        self.assertEqual(score, 0)

    def test_perfect_match_scores_100(self):
        twin = make_venue('Twin', capacity=20, building='Block A', amenities=['Projector', 'WiFi'])
        self.assertAlmostEqual(calculate_similarity_score(self.current, twin, min_capacity=1), 100.0, places=1)

    def test_different_building_loses_location_weight(self):
        # Same capacity + amenities, different building → 40 + 40 + 0
        other = make_venue('Faraway', capacity=20, building='Block Z', amenities=['Projector', 'WiFi'])
        self.assertAlmostEqual(calculate_similarity_score(self.current, other, min_capacity=1), 80.0, places=1)

    def test_partial_amenity_overlap(self):
        # 1 of 2 amenities shared, same building, same capacity → 40 + 20 + 20
        partial = make_venue('Partial', capacity=20, building='Block A', amenities=['Projector'])
        self.assertAlmostEqual(calculate_similarity_score(self.current, partial, min_capacity=1), 80.0, places=1)

    def test_no_amenities_on_origin_uses_neutral_baseline(self):
        bare = make_venue('Bare', capacity=20, building='Block A', amenities=[])
        cand = make_venue('Cand', capacity=20, building='Block A', amenities=['Anything'])
        # amenities_score = 50 → 40 + 20 + 20 = 80
        self.assertAlmostEqual(calculate_similarity_score(bare, cand, min_capacity=1), 80.0, places=1)

    def test_higher_capacity_difference_lowers_score(self):
        near = make_venue('Near', capacity=22, building='Block A', amenities=['Projector', 'WiFi'])
        far = make_venue('Far', capacity=120, building='Block A', amenities=['Projector', 'WiFi'])
        self.assertGreater(
            calculate_similarity_score(self.current, near, min_capacity=1),
            calculate_similarity_score(self.current, far, min_capacity=1),
        )


class AvailableVenuesTest(TestCase):
    def setUp(self):
        self.student = make_user('stud@test.com', UserRole.STUDENT)
        self.tomorrow = date.today() + timedelta(days=1)
        self.both = make_venue('Open Hall', access='both')
        self.staff_only = make_venue('Staff Room', access='staff')
        self.student_only = make_venue('Student Lounge', access='student')
        self.hidden = make_venue('Hidden Store', access='none')

    def test_conflict_excludes_venue(self):
        make_booking(self.student, self.both, self.tomorrow, time(10, 0), time(11, 0))
        free = get_available_venues(self.tomorrow, time(10, 0), time(11, 0))
        self.assertNotIn(self.both, list(free))

    def test_adjacent_slot_is_available(self):
        make_booking(self.student, self.both, self.tomorrow, time(10, 0), time(11, 0))
        # 11:00–12:00 starts exactly when the other ends → no overlap
        free = get_available_venues(self.tomorrow, time(11, 0), time(12, 0))
        self.assertIn(self.both, list(free))

    def test_student_access_filter(self):
        free = list(get_available_venues(self.tomorrow, time(13, 0), time(14, 0), user=self.student))
        self.assertIn(self.both, free)
        self.assertIn(self.student_only, free)
        self.assertNotIn(self.staff_only, free)
        self.assertNotIn(self.hidden, free)

    def test_staff_access_filter(self):
        staff = make_user('staff@test.com', UserRole.STAFF)
        free = list(get_available_venues(self.tomorrow, time(13, 0), time(14, 0), user=staff))
        self.assertIn(self.both, free)
        self.assertIn(self.staff_only, free)
        self.assertNotIn(self.student_only, free)
        self.assertNotIn(self.hidden, free)

    def test_no_user_skips_access_filter_but_excludes_nothing_extra(self):
        # Without a user, access is not filtered (admin/internal use)
        free = list(get_available_venues(self.tomorrow, time(13, 0), time(14, 0)))
        self.assertIn(self.staff_only, free)


class VenueAlternativesTest(TestCase):
    def setUp(self):
        self.student = make_user('stud2@test.com', UserRole.STUDENT)
        self.tomorrow = date.today() + timedelta(days=1)
        self.origin = make_venue('Origin', capacity=30, building='Block A', amenities=['Projector'])
        # Busy origin → the user needs an alternative
        make_booking(self.student, self.origin, self.tomorrow, time(10, 0), time(12, 0))

        self.good = make_venue('Good Match', capacity=30, building='Block A', amenities=['Projector'])
        self.ok = make_venue('OK Match', capacity=80, building='Block Z', amenities=[])
        self.staff_only = make_venue('Staff Only', capacity=30, building='Block A', amenities=['Projector'], access='staff')

    def test_excludes_current_venue(self):
        ranked = get_venue_alternatives(self.tomorrow, time(10, 0), time(12, 0), self.origin.id, 1, user=self.student)
        venues = [v for v, _ in ranked]
        self.assertNotIn(self.origin, venues)

    def test_best_match_ranked_first(self):
        ranked = get_venue_alternatives(self.tomorrow, time(10, 0), time(12, 0), self.origin.id, 1, user=self.student)
        self.assertTrue(ranked)
        self.assertEqual(ranked[0][0], self.good)

    def test_does_not_suggest_inaccessible_venue(self):
        ranked = get_venue_alternatives(self.tomorrow, time(10, 0), time(12, 0), self.origin.id, 1, user=self.student)
        venues = [v for v, _ in ranked]
        self.assertNotIn(self.staff_only, venues)

    def test_respects_minimum_capacity(self):
        # Require 50 seats → the 30-seat "Good Match" should drop out, 80-seat "OK" stays
        ranked = get_venue_alternatives(self.tomorrow, time(10, 0), time(12, 0), self.origin.id, 50, user=self.student)
        venues = [v for v, _ in ranked]
        self.assertNotIn(self.good, venues)
        self.assertIn(self.ok, venues)

    def test_busy_alternative_is_excluded(self):
        # Make the good match busy too → it should disappear from suggestions
        make_booking(self.student, self.good, self.tomorrow, time(10, 0), time(12, 0))
        ranked = get_venue_alternatives(self.tomorrow, time(10, 0), time(12, 0), self.origin.id, 1, user=self.student)
        venues = [v for v, _ in ranked]
        self.assertNotIn(self.good, venues)


class VenuePersonnelApiTest(TestCase):
    """Assigning/unassigning staff who prepare a venue — admin only."""

    def setUp(self):
        from rest_framework.test import APIClient
        from venues.models import VenuePersonnel
        self.VenuePersonnel = VenuePersonnel
        self.client = APIClient()
        self.admin = make_user('vp-admin@test.com', UserRole.ADMIN)
        self.staff = make_user('vp-caretaker@test.com', UserRole.STAFF)
        self.student = make_user('vp-student@test.com', UserRole.STUDENT)
        self.venue = make_venue('Prep Hall')

    def test_admin_can_assign_personnel(self):
        self.client.force_authenticate(self.admin)
        res = self.client.post('/api/venues/personnel/', {
            'venue': self.venue.id, 'user': self.staff.id, 'role_label': 'Caretaker',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(self.venue.personnel.count(), 1)
        self.assertEqual(res.data['role_label'], 'Caretaker')
        self.assertEqual(res.data['user_email'], self.staff.email)

    def test_non_admin_cannot_assign_personnel(self):
        self.client.force_authenticate(self.student)
        res = self.client.post('/api/venues/personnel/', {
            'venue': self.venue.id, 'user': self.staff.id, 'role_label': 'Caretaker',
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_cannot_assign_same_person_twice_to_same_venue(self):
        self.client.force_authenticate(self.admin)
        self.client.post('/api/venues/personnel/', {'venue': self.venue.id, 'user': self.staff.id}, format='json')
        res = self.client.post('/api/venues/personnel/', {'venue': self.venue.id, 'user': self.staff.id}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_list_filters_by_venue(self):
        other_venue = make_venue('Other Hall')
        self.VenuePersonnel.objects.create(venue=self.venue, user=self.staff, role_label='Caretaker')
        self.VenuePersonnel.objects.create(venue=other_venue, user=self.staff, role_label='Caretaker')
        self.client.force_authenticate(self.admin)
        res = self.client.get(f'/api/venues/personnel/?venue={self.venue.id}')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)

    def test_admin_can_unassign(self):
        vp = self.VenuePersonnel.objects.create(venue=self.venue, user=self.staff, role_label='Caretaker')
        self.client.force_authenticate(self.admin)
        res = self.client.delete(f'/api/venues/personnel/{vp.id}/')
        self.assertEqual(res.status_code, 204)
        self.assertEqual(self.venue.personnel.count(), 0)

    def test_non_admin_cannot_unassign(self):
        vp = self.VenuePersonnel.objects.create(venue=self.venue, user=self.staff, role_label='Caretaker')
        self.client.force_authenticate(self.student)
        res = self.client.delete(f'/api/venues/personnel/{vp.id}/')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(self.venue.personnel.count(), 1)
