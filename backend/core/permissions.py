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


class IsApprover(BasePermission):
    """
    Allow access to users who may action booking requests — ADMIN or
    RECEPTIONIST (see User.is_staff_member). Receptionists run the desk and
    approve/decline; students and staff cannot.
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_staff_member
        )


class IsApproverOrVC(BasePermission):
    """
    Allow access to users who may action SOME booking request — ADMIN,
    RECEPTIONIST, or VC. This only gates entry to the approve/reject
    endpoints; which specific bookings a VC or receptionist may decide is
    enforced per-venue in the view via services.can_decide_booking(), since
    a VC may only decide bookings for venues flagged requires_vc_approval
    and a receptionist may not decide those.
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_staff_member or request.user.is_vc)
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
