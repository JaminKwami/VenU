from rest_framework import serializers

from .models import Venue, VenuePersonnel


class VenueSerializer(serializers.ModelSerializer):

    class Meta:
        model = Venue
        fields = [
            'id', 'name', 'location', 'building', 'venue_type', 'capacity',
            'amenities', 'min_notice_hours', 'description', 'is_active',
            'requires_vc_approval', 'access',
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


class VenuePersonnelSerializer(serializers.ModelSerializer):
    """Staff assigned to a venue. venue/user are FK ints on write; name/email for display."""

    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    venue_name = serializers.CharField(source='venue.name', read_only=True)

    class Meta:
        model = VenuePersonnel
        fields = ['id', 'venue', 'venue_name', 'user', 'user_name', 'user_email', 'role_label', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate(self, data):
        venue = data.get('venue') or getattr(self.instance, 'venue', None)
        user = data.get('user') or getattr(self.instance, 'user', None)
        qs = VenuePersonnel.objects.filter(venue=venue, user=user)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('This person is already assigned to this venue.')
        return data
