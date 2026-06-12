from django.core.exceptions import ValidationError
from django.db.models import Q
from django.http import HttpResponse
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdmin, IsOwnerOrAdmin
from venues.models import Venue
from .models import Booking, BookingStatus, WaitlistEntry
from .serializers import (
    BookingSerializer,
    BookingCreateSerializer,
    BookingStatusSerializer,
    WaitlistEntrySerializer,
)
from . import services


class BookingListCreateView(APIView):
    """
    GET  /api/bookings/  — students see their own; admins see all
    POST /api/bookings/  — any authenticated user can request a booking
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.is_admin or request.user.is_staff_member:
            bookings = Booking.objects.select_related('user', 'venue', 'decided_by').all()
        else:
            bookings = Booking.objects.select_related('user', 'venue', 'decided_by').filter(user=request.user)

        # Optional filters: ?status=&venue=&date_from=&date_to=&q=
        status_param = request.query_params.get('status')
        if status_param in BookingStatus.values:
            bookings = bookings.filter(status=status_param)
        venue_param = request.query_params.get('venue')
        if venue_param and venue_param.isdigit():
            bookings = bookings.filter(venue_id=venue_param)
        date_from = parse_date(request.query_params.get('date_from') or '')
        if date_from:
            bookings = bookings.filter(date__gte=date_from)
        date_to = parse_date(request.query_params.get('date_to') or '')
        if date_to:
            bookings = bookings.filter(date__lte=date_to)
        q = request.query_params.get('q', '').strip()
        if q:
            bookings = bookings.filter(
                Q(purpose__icontains=q) | Q(venue__name__icontains=q) | Q(department__icontains=q)
            )

        serializer = BookingSerializer(bookings, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = BookingCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        # Resolve venue FK
        venue = data.get('venue')
        if not venue.is_active:
            return Response(
                {'detail': 'This venue is not available for booking.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        details = dict(
            purpose=data.get('purpose', ''),
            department=data.get('department', ''),
            notes=data.get('notes', ''),
            attendee_count=data.get('attendee_count'),
        )

        # Optional recurrence: {"frequency": "weekly"|"biweekly", "until": "YYYY-MM-DD"}
        repeat = request.data.get('repeat')
        if repeat:
            frequency = repeat.get('frequency')
            until = parse_date(str(repeat.get('until', '')))
            if frequency not in ('weekly', 'biweekly') or until is None:
                return Response(
                    {'detail': 'Recurrence needs a frequency (weekly/biweekly) and an end date.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                created, skipped = services.create_recurring_bookings(
                    user=request.user, venue=venue,
                    date=data['date'], start_time=data['start_time'], end_time=data['end_time'],
                    frequency=frequency, until=until, **details,
                )
            except ValidationError as exc:
                return Response({'detail': exc.message}, status=status.HTTP_409_CONFLICT)
            payload = BookingSerializer(created[0]).data
            payload['series_count'] = len(created)
            payload['skipped_dates'] = [d.isoformat() for d in skipped]
            return Response(payload, status=status.HTTP_201_CREATED)

        try:
            booking = services.create_booking(
                user=request.user,
                venue=venue,
                date=data['date'],
                start_time=data['start_time'],
                end_time=data['end_time'],
                **details,
            )
        except ValidationError as exc:
            return Response({'detail': exc.message}, status=status.HTTP_409_CONFLICT)

        return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)


class BookingDetailView(APIView):
    """
    GET /api/bookings/{id}/  — retrieve a single booking
    Owner or admin can retrieve.
    """
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]

    def _get_booking(self, pk):
        try:
            return Booking.objects.select_related('user', 'venue').get(pk=pk)
        except Booking.DoesNotExist:
            return None

    def get(self, request, pk):
        booking = self._get_booking(pk)
        if booking is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        self.check_object_permissions(request, booking)
        return Response(BookingSerializer(booking).data)


class BookingApproveView(APIView):
    """
    PATCH /api/bookings/{id}/approve/  — admin only
    """
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = services.approve_booking(booking, decided_by=request.user)
        except ValidationError as exc:
            return Response({'detail': exc.message}, status=status.HTTP_409_CONFLICT)

        return Response(BookingStatusSerializer(booking).data)


class BookingRejectView(APIView):
    """
    PATCH /api/bookings/{id}/reject/  — admin only
    """
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = services.reject_booking(
                booking,
                decided_by=request.user,
                reason=str(request.data.get('reason', ''))[:500],
            )
        except ValidationError as exc:
            return Response({'detail': exc.message}, status=status.HTTP_400_BAD_REQUEST)

        return Response(BookingStatusSerializer(booking).data)


class BookingCancelView(APIView):
    """
    PATCH /api/bookings/{id}/cancel/  — owner or admin
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = services.cancel_booking(booking, cancelled_by=request.user)
        except ValidationError as exc:
            return Response({'detail': exc.message}, status=status.HTTP_400_BAD_REQUEST)

        return Response(BookingStatusSerializer(booking).data)


class BookingAvailabilityView(APIView):
    """
    GET /api/bookings/availability/?venue={id}&date=YYYY-MM-DD
    Returns the taken (pending/approved) slots so users can pick a free time.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        venue_id = request.query_params.get('venue')
        date_str = request.query_params.get('date')
        if not venue_id or not date_str:
            return Response(
                {'detail': 'Both "venue" and "date" query parameters are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        date = parse_date(date_str)
        if date is None:
            return Response(
                {'detail': 'Invalid date — use YYYY-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            venue = Venue.objects.get(pk=venue_id, is_active=True)
        except (Venue.DoesNotExist, ValueError):
            return Response({'detail': 'Venue not found.'}, status=status.HTTP_404_NOT_FOUND)

        slots = services.get_taken_slots(venue, date)
        return Response({'venue': venue.pk, 'date': date, 'taken_slots': list(slots)})


class BookingExportView(APIView):
    """
    GET /api/bookings/export/  — download the user's approved bookings
    as an iCalendar (.ics) file for Outlook / Google / Apple Calendar.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        bookings = (
            Booking.objects
            .select_related('venue')
            .filter(user=request.user, status=BookingStatus.APPROVED)
            .order_by('date', 'start_time')
        )
        ical = services.build_ical(bookings)
        response = HttpResponse(ical, content_type='text/calendar; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="venu-bookings.ics"'
        return response


class WaitlistView(APIView):
    """
    GET  /api/bookings/waitlist/  — the user's active waitlist entries
    POST /api/bookings/waitlist/  — join the waitlist for a taken slot
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        entries = (
            WaitlistEntry.objects
            .select_related('venue')
            .filter(user=request.user, notified=False)
        )
        return Response(WaitlistEntrySerializer(entries, many=True).data)

    def post(self, request):
        serializer = WaitlistEntrySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        try:
            entry = services.join_waitlist(
                user=request.user,
                venue=data['venue'],
                date=data['date'],
                start_time=data['start_time'],
                end_time=data['end_time'],
            )
        except ValidationError as exc:
            return Response({'detail': exc.message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(WaitlistEntrySerializer(entry).data, status=status.HTTP_201_CREATED)


class WaitlistDetailView(APIView):
    """
    DELETE /api/bookings/waitlist/{id}/  — leave the waitlist
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            entry = WaitlistEntry.objects.get(pk=pk, user=request.user)
        except WaitlistEntry.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
