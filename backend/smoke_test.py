"""One-off smoke test for the new booking workflow. Run: python smoke_test.py"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.test.utils import setup_test_environment, teardown_test_environment
from django.test.runner import DiscoverRunner
from rest_framework.test import APIClient

setup_test_environment()
runner = DiscoverRunner(interactive=False)
old_config = runner.setup_databases()

try:
    from users.models import User, UserRole
    from venues.models import Venue

    admin = User.objects.create_user('admin@test.com', 'pass12345', first_name='Ada', last_name='Admin', role=UserRole.ADMIN)
    student = User.objects.create_user('stu@test.com', 'pass12345', first_name='Sam', last_name='Student')
    venue = Venue.objects.create(name='Hall A', location='Block 1', capacity=100)

    c = APIClient()

    # login
    r = c.post('/api/auth/login/', {'email': 'stu@test.com', 'password': 'pass12345'}, format='json')
    assert r.status_code == 200, f'login: {r.status_code} {r.content}'
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")

    # create booking with attendee count
    r = c.post('/api/bookings/', {'venue': venue.id, 'date': '2026-12-01', 'start_time': '10:00', 'end_time': '12:00', 'purpose': 'Test', 'attendee_count': 50}, format='json')
    assert r.status_code == 201, f'create: {r.status_code} {r.content}'
    bid = r.data['id']

    # attendee count over capacity rejected
    r = c.post('/api/bookings/', {'venue': venue.id, 'date': '2026-12-02', 'start_time': '10:00', 'end_time': '12:00', 'attendee_count': 500}, format='json')
    assert r.status_code == 409, f'capacity: {r.status_code} {r.content}'

    # past date rejected
    r = c.post('/api/bookings/', {'venue': venue.id, 'date': '2020-01-01', 'start_time': '10:00', 'end_time': '12:00'}, format='json')
    assert r.status_code == 409, f'past date: {r.status_code} {r.content}'

    # availability shows the taken slot
    r = c.get(f'/api/bookings/availability/?venue={venue.id}&date=2026-12-01')
    assert r.status_code == 200 and len(r.data['taken_slots']) == 1, f'availability: {r.status_code} {r.data}'

    # conflicting booking rejected
    r = c.post('/api/bookings/', {'venue': venue.id, 'date': '2026-12-01', 'start_time': '11:00', 'end_time': '13:00'}, format='json')
    assert r.status_code == 409, f'conflict: {r.status_code} {r.content}'

    # student cannot approve
    r = c.patch(f'/api/bookings/{bid}/approve/')
    assert r.status_code == 403, f'student approve: {r.status_code}'

    # admin approves
    a = APIClient()
    r = a.post('/api/auth/login/', {'email': 'admin@test.com', 'password': 'pass12345'}, format='json')
    a.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
    r = a.patch(f'/api/bookings/{bid}/approve/')
    assert r.status_code == 200 and r.data['status'] == 'APPROVED', f'approve: {r.status_code} {r.content}'

    # audit trail recorded
    from bookings.models import Booking
    b = Booking.objects.get(pk=bid)
    assert b.decided_by_id == admin.id and b.decided_at is not None, 'audit trail missing'

    # student cancels own approved booking
    r = c.patch(f'/api/bookings/{bid}/cancel/')
    assert r.status_code == 200 and r.data['status'] == 'CANCELLED', f'cancel: {r.status_code} {r.content}'

    # reject with reason on a fresh booking
    r = c.post('/api/bookings/', {'venue': venue.id, 'date': '2026-12-03', 'start_time': '09:00', 'end_time': '10:00'}, format='json')
    bid2 = r.data['id']
    r = a.patch(f'/api/bookings/{bid2}/reject/', {'reason': 'Maintenance day'}, format='json')
    assert r.status_code == 200 and r.data['rejection_reason'] == 'Maintenance day', f'reject: {r.status_code} {r.content}'

    # student cannot cancel someone else's booking
    other = User.objects.create_user('other@test.com', 'pass12345', first_name='O', last_name='T')
    o = APIClient()
    r = o.post('/api/auth/login/', {'email': 'other@test.com', 'password': 'pass12345'}, format='json')
    o.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
    from bookings.models import BookingStatus
    b3 = Booking.objects.create(user=student, venue=venue, date='2026-12-05', start_time='09:00', end_time='10:00', status=BookingStatus.PENDING)
    r = o.patch(f'/api/bookings/{b3.id}/cancel/')
    assert r.status_code == 400, f'foreign cancel: {r.status_code} {r.content}'

    print('ALL SMOKE TESTS PASSED')
finally:
    runner.teardown_databases(old_config)
    teardown_test_environment()
