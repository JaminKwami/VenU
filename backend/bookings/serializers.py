from rest_framework import serializers

from users.serializers import UserSerializer
from venues.serializers import VenueSerializer
from .models import AutoApprovalRule, Booking, TermDate, WaitlistEntry


class BookingSerializer(serializers.ModelSerializer):
    """
    Full representation — used for list/retrieve responses.
    Nested user and venue are read-only so the frontend gets human-readable
    data without extra requests.

    check_in_token is only returned to the booking's owner (not leaked to
    admins listing other users' bookings).
    """

    user = UserSerializer(read_only=True)
    venue = VenueSerializer(read_only=True)
    decided_by = UserSerializer(read_only=True)
    check_in_token = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            'id', 'user', 'venue', 'date', 'start_time', 'end_time',
            'status', 'purpose', 'department', 'notes', 'attendee_count',
            'rejection_reason', 'series_id',
            'check_in_token', 'checked_in_at',
            'decided_by', 'decided_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'status', 'rejection_reason', 'series_id',
            'checked_in_at', 'decided_by', 'decided_at', 'created_at', 'updated_at',
        ]

    def get_check_in_token(self, obj):
        request = self.context.get('request')
        if request and request.user == obj.user:
            return str(obj.check_in_token)
        return None


class BookingCreateSerializer(serializers.ModelSerializer):
    """
    Write serializer — accepts venue_id as a FK integer.
    Conflict detection is delegated to the service layer (services.py),
    not duplicated here.
    """

    class Meta:
        model = Booking
        fields = ['venue', 'date', 'start_time', 'end_time', 'purpose', 'department', 'notes', 'attendee_count']

    def validate(self, data):
        if data['end_time'] <= data['start_time']:
            raise serializers.ValidationError(
                {'end_time': 'End time must be after start time.'}
            )
        return data


class BookingStatusSerializer(serializers.ModelSerializer):
    """Minimal serializer for approve/reject/cancel actions."""

    class Meta:
        model = Booking
        fields = ['id', 'status', 'rejection_reason', 'decided_at']
        read_only_fields = ['id', 'status', 'rejection_reason', 'decided_at']


class WaitlistEntrySerializer(serializers.ModelSerializer):
    """Waitlist entries — venue is a FK int on write, nested data on read."""

    venue_detail = VenueSerializer(source='venue', read_only=True)

    class Meta:
        model = WaitlistEntry
        fields = ['id', 'venue', 'venue_detail', 'date', 'start_time', 'end_time', 'notified', 'created_at']
        read_only_fields = ['id', 'notified', 'created_at']

    def validate(self, data):
        if data['end_time'] <= data['start_time']:
            raise serializers.ValidationError({'end_time': 'End time must be after start time.'})
        return data


class AutoApprovalRuleSerializer(serializers.ModelSerializer):
    """Read/write for auto-approval rules.  venue is a FK int on write."""

    venue_name = serializers.CharField(source='venue.name', read_only=True, default=None)

    class Meta:
        model = AutoApprovalRule
        fields = [
            'id', 'venue', 'venue_name',
            'max_attendees', 'max_duration_hours', 'min_notice_hours',
            'enabled', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class TermDateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TermDate
        fields = ['id', 'name', 'start_date', 'end_date', 'skip_in_recurrence']
        read_only_fields = ['id']

    def validate(self, data):
        if data.get('end_date') and data.get('start_date') and data['end_date'] < data['start_date']:
            raise serializers.ValidationError({'end_date': 'End date must be on or after start date.'})
        return data
