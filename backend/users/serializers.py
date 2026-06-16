from rest_framework import serializers

from .models import AllowedDomain, EnrollLink, User, UserRole


class UserSerializer(serializers.ModelSerializer):
    """Read-only representation of a user (used in nested responses)."""

    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name', 'role', 'is_active', 'date_joined']
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name()


class RegisterSerializer(serializers.ModelSerializer):
    """Used by admins to create new users."""

    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'role', 'password']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Admin-only: update a user's role or active status."""

    class Meta:
        model = User
        fields = ['role', 'is_active']

    def validate_role(self, value):
        valid = [r.value for r in UserRole]
        if value not in valid:
            raise serializers.ValidationError(f'Role must be one of: {", ".join(valid)}')
        return value


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)


class AllowedDomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = AllowedDomain
        fields = ['id', 'domain', 'default_role', 'note', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_domain(self, value):
        value = value.lower().strip().lstrip('@')
        if not value or '.' not in value:
            raise serializers.ValidationError('Enter a valid domain, e.g. "example.edu".')
        return value


class EnrollLinkSerializer(serializers.ModelSerializer):
    token = serializers.UUIDField(read_only=True)
    uses_remaining = serializers.SerializerMethodField()
    is_valid = serializers.SerializerMethodField()
    created_by_email = serializers.SerializerMethodField()

    class Meta:
        model = EnrollLink
        fields = [
            'id', 'token', 'default_role', 'uses_limit', 'uses_count', 'uses_remaining',
            'expires_at', 'note', 'is_active', 'is_valid', 'created_by_email', 'created_at',
        ]
        read_only_fields = ['id', 'token', 'uses_count', 'created_at']

    def get_uses_remaining(self, obj):
        if not obj.uses_limit:
            return None
        return max(0, obj.uses_limit - obj.uses_count)

    def get_is_valid(self, obj):
        return obj.is_valid

    def get_created_by_email(self, obj):
        return obj.created_by.email if obj.created_by else None
