from django.db.models import Q

from rest_framework.permissions import BasePermission

from .models import DoctorProfile, Patient


def get_user_role(user):
    if not user or not user.is_authenticated:
        return None
    if getattr(user, "is_superuser", False):
        return DoctorProfile.ROLE_CHIEF_DOCTOR
    profile = getattr(user, "doctor_profile", None)
    if profile:
        if profile.role == "admin":
            return DoctorProfile.ROLE_CHIEF_DOCTOR
        return profile.role
    return DoctorProfile.ROLE_PENDING


def permitted_patients_queryset(request):
    """
    Patients visible to the current user (same rules as patient list API).
    Used by assignment serializers and other APIs that must scope by patient access.
    """
    user = request.user
    role = get_user_role(user)
    queryset = Patient.objects.all()
    if role == DoctorProfile.ROLE_PATIENT:
        return queryset.filter(user=user)
    if role == DoctorProfile.ROLE_DOCTOR:
        return queryset.filter(Q(assigned_doctor=user) | Q(created_by=user))
    if role == DoctorProfile.ROLE_PENDING:
        return queryset.none()
    return queryset


class IsDoctorOrAbove(BasePermission):
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        return role in {DoctorProfile.ROLE_DOCTOR, DoctorProfile.ROLE_CHIEF_DOCTOR}


class IsChiefDoctorOrAdmin(BasePermission):
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        return role == DoctorProfile.ROLE_CHIEF_DOCTOR


class IsPatient(BasePermission):
    def has_permission(self, request, view):
        return get_user_role(request.user) == DoctorProfile.ROLE_PATIENT
