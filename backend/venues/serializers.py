from rest_framework import serializers

from .models import Venue


class VenueSerializer(serializers.ModelSerializer):

    class Meta:
        model = Venue
        fields = [
            'id', 'name', 'location', 'building', 'venue_type', 'capacity',
            'amenities', 'min_notice_hours', 'description', 'is_active', 'access',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_capacity(self, value):
        if value < 1:
            raise serializers.ValidationError('Capacity must be at least 1.')
        return value

    def validate_amenities(self, value):
        if not isinstance(value, list) or not all(isinstance(a, str) for a in value):
            raise serializers.ValidationError('Amenities must be a list of strings.')
        return value
