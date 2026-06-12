from datetime import time

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdmin
from .models import Venue
from .serializers import VenueSerializer
from .services import get_venue_alternatives


class VenueListCreateView(APIView):
    """
    GET  /api/venues/       — all active venues (any authenticated user)
    POST /api/venues/       — create a venue (admin only)
    """

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdmin()]
        return [IsAuthenticated()]

    def get(self, request):
        venues = Venue.objects.filter(is_active=True)
        serializer = VenueSerializer(venues, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = VenueSerializer(data=request.data)
        if serializer.is_valid():
            venue = serializer.save()
            return Response(VenueSerializer(venue).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VenueDetailView(APIView):
    """
    GET    /api/venues/{id}/  — retrieve (any authenticated user)
    PUT    /api/venues/{id}/  — full update (admin only)
    PATCH  /api/venues/{id}/  — partial update (admin only)
    DELETE /api/venues/{id}/  — soft-delete by setting is_active=False (admin only)
    """

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAdmin()]

    def _get_venue(self, pk):
        try:
            return Venue.objects.get(pk=pk)
        except Venue.DoesNotExist:
            return None

    def get(self, request, pk):
        venue = self._get_venue(pk)
        if venue is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(VenueSerializer(venue).data)

    def put(self, request, pk):
        venue = self._get_venue(pk)
        if venue is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = VenueSerializer(venue, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        venue = self._get_venue(pk)
        if venue is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = VenueSerializer(venue, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        venue = self._get_venue(pk)
        if venue is None:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        # Soft-delete: preserves booking history
        venue.is_active = False
        venue.save(update_fields=['is_active', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class VenueAlternativesView(APIView):
    """
    GET /api/venues/alternatives/  — find similar venues available at requested time

    Query parameters:
    - date: YYYY-MM-DD
    - start_time: HH:MM:SS
    - end_time: HH:MM:SS
    - current_venue_id: int
    - min_capacity: int
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            date_str = request.query_params.get('date')
            start_time_str = request.query_params.get('start_time')
            end_time_str = request.query_params.get('end_time')
            current_venue_id = int(request.query_params.get('current_venue_id'))
            min_capacity = int(request.query_params.get('min_capacity', 1))

            if not all([date_str, start_time_str, end_time_str]):
                return Response(
                    {'detail': 'Missing required parameters: date, start_time, end_time'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            from datetime import datetime
            date = datetime.fromisoformat(date_str).date()
            start_time = datetime.fromisoformat(f'2000-01-01T{start_time_str}').time()
            end_time = datetime.fromisoformat(f'2000-01-01T{end_time_str}').time()
        except (ValueError, TypeError) as e:
            return Response(
                {'detail': f'Invalid parameter format: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ranked = get_venue_alternatives(date, start_time, end_time, current_venue_id, min_capacity)

        results = []
        for venue, score in ranked:
            data = VenueSerializer(venue).data
            data['similarity_score'] = score
            results.append(data)

        return Response(results)
