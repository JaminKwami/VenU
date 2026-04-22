"""
Reusable DRF permission classes for VenU.

Import these in any view instead of writing inline role checks.
"""

from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Allow access only to users with the ADMIN role."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin)


class IsAdminOrStaff(BasePermission):
    """Allow access to ADMIN or STAFF users."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_admin or request.user.is_staff_member)
        )


class IsOwnerOrAdmin(BasePermission):
    """
    Object-level permission.
    - Admins can access any object.
    - Other users can only access objects they own (obj.user == request.user).
    """

    def has_object_permission(self, request, view, obj):
        if request.user.is_admin:
            return True
        return obj.user == request.user
