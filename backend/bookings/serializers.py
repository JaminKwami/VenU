from rest_framework import serializers

from users.serializers import UserSerializer
from venues.serializers import VenueSerializer
from .models import Booking


class BookingSerializer(serializers.ModelSerializer):
    """
    Full representation — used for list/retrieve responses.
    Nested user and venue are read-only so the frontend gets human-readable
    data without extra requests.
    """

    user = UserSerializer(read_only=True)
    venue = VenueSerializer(read_only=True)

    class Meta:
        model = Booking
        fields = [
            'id', 'user', 'venue', 'date', 'start_time', 'end_time',
            'status', 'purpose', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'status', 'created_at', 'updated_at']


class BookingCreateSerializer(serializers.ModelSerializer):
    """
    Write serializer — accepts venue_id as a FK integer.
    Conflict detection is delegated to the service layer (services.py),
    not duplicated here.
    """

    class Meta:
        model = Booking
        fields = ['venue', 'date', 'start_time', 'end_time', 'purpose']

    def validate(self, data):
        if data['end_time'] <= data['start_time']:
            raise serializers.ValidationError(
                {'end_time': 'End time must be after start time.'}
            )
        return data


class BookingStatusSerializer(serializers.ModelSerializer):
    """Minimal serializer for approve/reject actions."""

    class Meta:
        model = Booking
        fields = ['id', 'status']
        read_only_fields = ['id', 'status']
