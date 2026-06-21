import csv
from collections import Counter, defaultdict
from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdmin, IsApprover, IsOwnerOrAdmin
from venues.models import Venue
from .models import AutoApprovalRule, Booking, BookingStatus, TermDate, WaitlistEntry
from .serializers import (
    AutoApprovalRuleSerializer,
    BookingSerializer,
    BookingCreateSerializer,
    BookingStatusSerializer,
    TermDateSerializer,
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

        serializer = BookingSerializer(bookings, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        serializer = BookingCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

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
            payload = BookingSerializer(created[0], context={'request': request}).data
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
        except IntegrityError:
            return Response(
                {'detail': 'This slot was just taken by another booking. Please choose a different time.'},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(BookingSerializer(booking, context={'request': request}).data, status=status.HTTP_201_CREATED)


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
        return Response(BookingSerializer(booking, context={'request': request}).data)


class BookingApproveView(APIView):
    """PATCH /api/bookings/{id}/approve/  — admin or receptionist"""
    permission_classes = [IsApprover]

    def patch(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = services.approve_booking(booking, decided_by=request.user)
        except ValidationError as exc:
            return Response({'detail': exc.message}, status=status.HTTP_409_CONFLICT)
        except IntegrityError:
            return Response(
                {'detail': 'A conflicting booking was approved first. Please review before retrying.'},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(BookingStatusSerializer(booking).data)


class BookingRejectView(APIView):
    """PATCH /api/bookings/{id}/reject/  — admin or receptionist"""
    permission_classes = [IsApprover]

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
    """PATCH /api/bookings/{id}/cancel/  — owner or admin"""
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
    Also accepts date_from + date_to for a range (used by the venue calendar).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        venue_id = request.query_params.get('venue')
        if not venue_id:
            return Response(
                {'detail': '"venue" query parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            venue = Venue.objects.get(pk=venue_id, is_active=True)
        except (Venue.DoesNotExist, ValueError):
            return Response({'detail': 'Venue not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Single-date mode
        date_str = request.query_params.get('date')
        if date_str:
            date = parse_date(date_str)
            if date is None:
                return Response({'detail': 'Invalid date — use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
            slots = services.get_taken_slots(venue, date)
            return Response({'venue': venue.pk, 'date': date, 'taken_slots': list(slots)})

        # Range mode: date_from + date_to (max 31 days)
        date_from = parse_date(request.query_params.get('date_from') or '')
        date_to = parse_date(request.query_params.get('date_to') or '')
        if not date_from or not date_to:
            return Response(
                {'detail': 'Provide either "date" or both "date_from" and "date_to".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if (date_to - date_from).days > 31:
            return Response(
                {'detail': 'Date range cannot exceed 31 days.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = (
            Booking.objects
            .filter(
                venue=venue,
                date__range=[date_from, date_to],
                status__in=['PENDING', 'APPROVED'],
            )
            .order_by('date', 'start_time')
            .values('date', 'start_time', 'end_time', 'status', 'purpose')
        )
        return Response({'venue': venue.pk, 'date_from': date_from, 'date_to': date_to, 'slots': list(qs)})


class BookingExportView(APIView):
    """
    GET /api/bookings/export/  — download the user's approved bookings
    as an iCalendar (.ics) file.
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


class BookingCheckInView(APIView):
    """
    POST /api/bookings/{id}/checkin/
    Body: {"token": "<check_in_token>"}
    Marks the booking as checked in.  Owner or admin only.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        is_owner = booking.user_id == request.user.pk
        if not (is_owner or request.user.is_admin or request.user.is_staff_member):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        token = request.data.get('token', '')
        try:
            booking = services.check_in_booking(booking, token)
        except ValidationError as exc:
            return Response({'detail': exc.message}, status=status.HTTP_400_BAD_REQUEST)

        return Response(BookingSerializer(booking, context={'request': request}).data)


class KioskLookupView(APIView):
    """
    Public endpoint — no auth required.
    GET  /api/bookings/kiosk/?token=<full-uuid>
         Returns booking summary card for a given check-in token.
    POST /api/bookings/kiosk/
         Body: {"token": "<full-uuid>"}  — performs the check-in.
    The token is the full UUID stored on the booking (128-bit, safe to expose
    on a kiosk that is physically secured at the venue entrance).
    """
    permission_classes = [AllowAny]
    throttle_scope = 'kiosk'

    _SAFE_FIELDS = (
        'id', 'date', 'start_time', 'end_time', 'status',
        'checked_in_at', 'attendee_count', 'purpose', 'department',
    )

    def _safe_payload(self, booking):
        return {
            'id': booking.pk,
            'date': booking.date,
            'start_time': str(booking.start_time)[:5],
            'end_time': str(booking.end_time)[:5],
            'status': booking.status,
            'checked_in_at': booking.checked_in_at,
            'attendee_count': booking.attendee_count,
            'purpose': booking.purpose or '',
            'department': booking.department or '',
            'venue_name': booking.venue.name,
            'venue_location': booking.venue.location or booking.venue.building or '',
            'booker_name': booking.user.full_name,
        }

    def _get_booking(self, token_str):
        token_str = (token_str or '').strip()
        if not token_str:
            return None
        try:
            return Booking.objects.select_related('user', 'venue').get(
                check_in_token=token_str
            )
        except (Booking.DoesNotExist, ValidationError):
            return None

    def get(self, request):
        token = request.query_params.get('token', '')
        booking = self._get_booking(token)
        if booking is None:
            return Response({'detail': 'Invalid or unknown token.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(self._safe_payload(booking))

    def post(self, request):
        token = request.data.get('token', '')
        booking = self._get_booking(token)
        if booking is None:
            return Response({'detail': 'Invalid or unknown token.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            booking = services.check_in_booking(booking, token)
        except ValidationError as exc:
            return Response({'detail': exc.message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self._safe_payload(booking))


class NoShowListView(APIView):
    """
    GET /api/bookings/no-shows/  — admin only.
    Returns approved bookings for today where:
      - start_time <= now - grace_minutes
      - checked_in_at is None
    POST /api/bookings/no-shows/release/  — manually trigger release for all.
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        grace = int(request.query_params.get('grace', 15))
        count = services.auto_release_no_shows(grace_minutes=grace, dry_run=True)
        bookings = services.get_no_show_candidates(grace_minutes=grace)
        data = [
            {
                'id': b.pk,
                'date': b.date,
                'start_time': str(b.start_time)[:5],
                'end_time': str(b.end_time)[:5],
                'venue_name': b.venue.name,
                'booker_name': b.user.full_name,
                'booker_email': b.user.email,
                'attendee_count': b.attendee_count,
                'purpose': b.purpose or '',
            }
            for b in bookings
        ]
        return Response({'no_shows': data, 'count': len(data)})

    def post(self, request):
        grace = int(request.data.get('grace', 15))
        released = services.auto_release_no_shows(grace_minutes=grace)
        return Response({'released': released})


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
    """DELETE /api/bookings/waitlist/{id}/  — leave the waitlist"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            entry = WaitlistEntry.objects.get(pk=pk, user=request.user)
        except WaitlistEntry.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Admin settings views ──────────────────────────────────────────────────────

class AutoApprovalRuleListView(APIView):
    """
    GET  /api/admin/approval-rules/  — list all rules
    POST /api/admin/approval-rules/  — create a rule
    Admin only.
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        rules = AutoApprovalRule.objects.select_related('venue').all()
        return Response(AutoApprovalRuleSerializer(rules, many=True).data)

    def post(self, request):
        s = AutoApprovalRuleSerializer(data=request.data)
        if s.is_valid():
            s.save()
            return Response(s.data, status=status.HTTP_201_CREATED)
        return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)


class AutoApprovalRuleDetailView(APIView):
    """
    PATCH  /api/admin/approval-rules/{id}/
    DELETE /api/admin/approval-rules/{id}/
    """
    permission_classes = [IsAdmin]

    def _get(self, pk):
        try:
            return AutoApprovalRule.objects.get(pk=pk)
        except AutoApprovalRule.DoesNotExist:
            return None

    def patch(self, request, pk):
        rule = self._get(pk)
        if rule is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        s = AutoApprovalRuleSerializer(rule, data=request.data, partial=True)
        if s.is_valid():
            s.save()
            return Response(s.data)
        return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        rule = self._get(pk)
        if rule is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TermDateListView(APIView):
    """
    GET  /api/admin/term-dates/  — list all term/holiday periods
    POST /api/admin/term-dates/  — create a period
    Admin only.
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        return Response(TermDateSerializer(TermDate.objects.all(), many=True).data)

    def post(self, request):
        s = TermDateSerializer(data=request.data)
        if s.is_valid():
            s.save()
            return Response(s.data, status=status.HTTP_201_CREATED)
        return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)


class TermDateDetailView(APIView):
    """DELETE /api/admin/term-dates/{id}/"""
    permission_classes = [IsAdmin]

    def delete(self, request, pk):
        try:
            TermDate.objects.get(pk=pk).delete()
        except TermDate.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Day grid (cross-venue availability) ───────────────────────────────────────

class DayGridView(APIView):
    """
    GET /api/bookings/day-grid/?date=YYYY-MM-DD
    Every venue the user may book, plus its busy slots for that day — powers the
    "find a free room" timetable grid in one request.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from venues.models import Venue
        from venues.services import _accessible_to

        d = parse_date(request.query_params.get('date') or '') or timezone.localdate()
        venues = list(_accessible_to(Venue.objects.filter(is_active=True), request.user).order_by('name'))

        slots = defaultdict(list)
        bookings = (
            Booking.objects
            .filter(date=d, venue__in=venues, status__in=[BookingStatus.PENDING, BookingStatus.APPROVED])
            .only('venue_id', 'user_id', 'start_time', 'end_time', 'status')
        )
        for b in bookings:
            slots[b.venue_id].append({
                'start_time': str(b.start_time)[:5],
                'end_time': str(b.end_time)[:5],
                'status': b.status,
                'mine': b.user_id == request.user.id,
            })

        return Response({
            'date': d.isoformat(),
            'venues': [
                {
                    'id': v.id, 'name': v.name, 'capacity': v.capacity,
                    'building': v.building or v.location, 'venue_type': v.venue_type,
                    'slots': slots.get(v.id, []),
                }
                for v in venues
            ],
        })


# ── Analytics / reporting ─────────────────────────────────────────────────────

def _clamp_days(raw, default=30, lo=7, hi=365):
    try:
        return max(lo, min(hi, int(raw)))
    except (TypeError, ValueError):
        return default


class AnalyticsView(APIView):
    """
    GET /api/bookings/analytics/?days=30  — admin only.
    Aggregate booking metrics for the reporting dashboard.
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        days = _clamp_days(request.query_params.get('days'))
        today = timezone.localdate()
        since = today - timedelta(days=days - 1)

        qs = Booking.objects.filter(date__gte=since, date__lte=today + timedelta(days=days))
        # Window the "created" metrics on creation time instead of event date.
        created_window = Booking.objects.filter(created_at__date__gte=since)

        status_counts = Counter(qs.values_list('status', flat=True))
        approved = status_counts.get(BookingStatus.APPROVED, 0)
        pending = status_counts.get(BookingStatus.PENDING, 0)
        rejected = status_counts.get(BookingStatus.REJECTED, 0)
        cancelled = status_counts.get(BookingStatus.CANCELLED, 0)
        total = sum(status_counts.values())

        decided = approved + rejected
        approval_rate = round(approved / decided * 100, 1) if decided else None

        # Average approval turnaround (created → decided), in hours.
        turnarounds = [
            (b.decided_at - b.created_at).total_seconds() / 3600
            for b in created_window.filter(decided_at__isnull=False).only('created_at', 'decided_at')
        ]
        avg_turnaround = round(sum(turnarounds) / len(turnarounds), 1) if turnarounds else None

        # Check-in rate over approved bookings whose start is in the past.
        now = timezone.now()
        past_approved = qs.filter(status=BookingStatus.APPROVED, date__lte=today)
        past_approved_count = past_approved.count()
        checked_in = past_approved.filter(checked_in_at__isnull=False).count()
        checkin_rate = round(checked_in / past_approved_count * 100, 1) if past_approved_count else None

        # Busiest venues (approved/pending), top 6.
        venue_counts = Counter(
            qs.exclude(status=BookingStatus.CANCELLED).values_list('venue__name', flat=True)
        )
        top_venues = [{'venue': name, 'count': n} for name, n in venue_counts.most_common(6)]

        # Peak start hours 08–19.
        hour_counts = Counter(
            b.start_time.hour for b in qs.exclude(status=BookingStatus.REJECTED).only('start_time')
        )
        peak_hours = [{'hour': h, 'count': hour_counts.get(h, 0)} for h in range(8, 20)]

        # Bookings created per day (time series).
        day_counts = Counter(
            d.isoformat() for d in created_window.values_list('created_at__date', flat=True)
        )
        daily = []
        for i in range(days):
            d = (since + timedelta(days=i)).isoformat()
            daily.append({'date': d, 'count': day_counts.get(d, 0)})

        return Response({
            'range_days': days,
            'kpis': {
                'total': total,
                'approved': approved,
                'pending': pending,
                'rejected': rejected,
                'cancelled': cancelled,
                'approval_rate': approval_rate,
                'avg_turnaround_hours': avg_turnaround,
                'checkin_rate': checkin_rate,
            },
            'status_breakdown': [
                {'status': BookingStatus.APPROVED, 'count': approved},
                {'status': BookingStatus.PENDING, 'count': pending},
                {'status': BookingStatus.REJECTED, 'count': rejected},
                {'status': BookingStatus.CANCELLED, 'count': cancelled},
            ],
            'top_venues': top_venues,
            'peak_hours': peak_hours,
            'daily': daily,
        })


class BookingCsvExportView(APIView):
    """
    GET /api/bookings/export-csv/?days=90  — admin only.
    Download bookings as CSV for offline reporting.
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        days = _clamp_days(request.query_params.get('days'), default=90)
        since = timezone.localdate() - timedelta(days=days - 1)
        rows = (
            Booking.objects
            .select_related('user', 'venue', 'decided_by')
            .filter(date__gte=since)
            .order_by('-date', 'start_time')
        )

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="venu-bookings.csv"'
        writer = csv.writer(response)
        writer.writerow([
            'Reference', 'Venue', 'Date', 'Start', 'End', 'Status', 'Requested by',
            'Email', 'Attendees', 'Purpose', 'Department', 'Decided by', 'Decided at', 'Checked in',
        ])
        for b in rows:
            writer.writerow([
                f'VENU-{b.pk:04d}', b.venue.name, b.date,
                str(b.start_time)[:5], str(b.end_time)[:5], b.get_status_display(),
                b.user.full_name or b.user.email, b.user.email,
                b.attendee_count if b.attendee_count is not None else '',
                b.purpose, b.department,
                (b.decided_by.full_name or b.decided_by.email) if b.decided_by else '',
                b.decided_at.isoformat() if b.decided_at else '',
                b.checked_in_at.isoformat() if b.checked_in_at else '',
            ])
        return response
