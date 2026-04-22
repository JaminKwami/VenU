from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdmin, IsOwnerOrAdmin
from venues.models import Venue
from .models import Booking
from .serializers import BookingSerializer, BookingCreateSerializer, BookingStatusSerializer
from . import services


class BookingListCreateView(APIView):
    """
    GET  /api/bookings/  — students see their own; admins see all
    POST /api/bookings/  — any authenticated user can request a booking
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.is_admin or request.user.is_staff_member:
            bookings = Booking.objects.select_related('user', 'venue').all()
        else:
            bookings = Booking.objects.select_related('user', 'venue').filter(user=request.user)
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

        try:
            booking = services.create_booking(
                user=request.user,
                venue=venue,
                date=data['date'],
                start_time=data['start_time'],
                end_time=data['end_time'],
                purpose=data.get('purpose', ''),
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
            booking = services.approve_booking(booking)
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
            booking = services.reject_booking(booking)
        except ValidationError as exc:
            return Response({'detail': exc.message}, status=status.HTTP_400_BAD_REQUEST)

        return Response(BookingStatusSerializer(booking).data)
