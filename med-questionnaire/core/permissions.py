from rest_framework.permissions import BasePermission

from .models import DoctorProfile


def get_user_role(user):
    if not user or not user.is_authenticated:
        return None
    if getattr(user, "is_superuser", False):
        return DoctorProfile.ROLE_ADMIN
    profile = getattr(user, "doctor_profile", None)
    if profile:
        return profile.role
    return DoctorProfile.ROLE_DOCTOR


class IsDoctorOrAbove(BasePermission):
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        return role in {DoctorProfile.ROLE_DOCTOR, DoctorProfile.ROLE_CHIEF_DOCTOR, DoctorProfile.ROLE_ADMIN}


class IsChiefDoctorOrAdmin(BasePermission):
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        return role in {DoctorProfile.ROLE_CHIEF_DOCTOR, DoctorProfile.ROLE_ADMIN}
