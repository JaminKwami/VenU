from rest_framework import serializers

from .models import Venue


class VenueSerializer(serializers.ModelSerializer):

    class Meta:
        model = Venue
        fields = [
            'id', 'name', 'location', 'capacity',
            'description', 'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_capacity(self, value):
        if value < 1:
            raise serializers.ValidationError('Capacity must be at least 1.')
        return value
