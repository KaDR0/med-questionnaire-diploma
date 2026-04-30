from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.db.utils import OperationalError, ProgrammingError

from .models import DoctorProfile
from .permissions import get_user_role


def _get_photo_data_url(user):
    try:
        profile, _ = DoctorProfile.objects.get_or_create(user=user)
        return profile.photo_data_url or ""
    except (OperationalError, ProgrammingError):
        # DoctorProfile table may be unavailable before migrations are applied.
        return ""


def _get_profile_payload(user):
    try:
        profile, _ = DoctorProfile.objects.get_or_create(user=user)
        return {
            "specialty": getattr(profile, "specialty", "") or "",
            "department": getattr(profile, "department", "") or "",
            "workplace": getattr(profile, "workplace", "") or "",
            "experience_years": getattr(profile, "experience_years", "") or "",
            "work_direction": getattr(profile, "work_direction", "") or "",
            "competencies": getattr(profile, "competencies", "") or "",
            "phone": getattr(profile, "phone", "") or "",
            "schedule": getattr(profile, "schedule", "") or "",
            "status": getattr(profile, "status", "") or "",
            "short_info": getattr(profile, "short_info", "") or "",
            "photo_data_url": profile.photo_data_url or "",
        }
    except (OperationalError, ProgrammingError):
        # Profile table/columns may be unavailable before latest migrations.
        return {
            "specialty": "",
            "department": "",
            "workplace": "",
            "experience_years": "",
            "work_direction": "",
            "competencies": "",
            "phone": "",
            "schedule": "",
            "status": "",
            "short_info": "",
            "photo_data_url": "",
        }


class SignupAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip()
        password = request.data.get("password", "")
        full_name = request.data.get("full_name", "").strip()
        role = request.data.get("role", DoctorProfile.ROLE_DOCTOR)
        allowed_roles = {DoctorProfile.ROLE_DOCTOR, DoctorProfile.ROLE_CHIEF_DOCTOR}
        if role == "admin":
            role = DoctorProfile.ROLE_CHIEF_DOCTOR
        if role not in allowed_roles:
            role = DoctorProfile.ROLE_DOCTOR
        first_name = request.data.get("first_name", "").strip()
        last_name = request.data.get("last_name", "").strip()
        if full_name and (not first_name and not last_name):
            parts = full_name.split(" ", 1)
            first_name = parts[0]
            if len(parts) > 1:
                last_name = parts[1]

        if not email or not password:
            return Response(
                {"error": "email and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(email=email).exists():
            return Response(
                {"error": "Email already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username_base = email.split("@")[0] or "user"
        username = username_base
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{username_base}{counter}"
            counter += 1

        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
            )
            DoctorProfile.objects.get_or_create(user=user, defaults={"role": role})

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "message": "User created successfully",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "email": user.email,
                    "full_name": f"{user.first_name} {user.last_name}".strip() or user.username,
                    "role": get_user_role(user),
                    "is_active": user.is_active,
                    "created_at": user.date_joined,
                    **_get_profile_payload(user),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class LoginAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        login_value = request.data.get("email", "").strip() or request.data.get("username", "").strip()
        password = request.data.get("password", "")

        if not login_value or not password:
            return Response(
                {"error": "username/email and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = None

        if "@" in login_value:
            try:
                found_user = User.objects.get(email=login_value)
                user = authenticate(username=found_user.username, password=password)
            except User.DoesNotExist:
                user = None
        else:
            user = authenticate(username=login_value, password=password)

        if user is None:
            return Response(
                {"error": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "email": user.email,
                    "full_name": f"{user.first_name} {user.last_name}".strip() or user.username,
                    "role": get_user_role(user),
                    "is_active": user.is_active,
                    "created_at": user.date_joined,
                    **_get_profile_payload(user),
                },
            },
            status=status.HTTP_200_OK,
        )


class LogoutAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except Exception:
            return Response(
                {"detail": "Logout completed locally. Token blacklist is not enabled."},
                status=status.HTTP_200_OK,
            )

        return Response({"detail": "Logged out"}, status=status.HTTP_200_OK)


class MeAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response(
            {
                "id": user.id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
                "full_name": f"{user.first_name} {user.last_name}".strip() or user.username,
                "role": get_user_role(user),
                "is_active": user.is_active,
                "created_at": user.date_joined,
                **_get_profile_payload(user),
            }
        )


class DoctorProfileUpdateAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        try:
            user = request.user
            profile, _ = DoctorProfile.objects.get_or_create(user=user)

            first_name = request.data.get("first_name")
            last_name = request.data.get("last_name")
            email = request.data.get("email")
            if first_name is not None:
                user.first_name = str(first_name or "").strip()
            if last_name is not None:
                user.last_name = str(last_name or "").strip()
            if email is not None:
                normalized_email = str(email or "").strip()
                if not normalized_email:
                    return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
                if User.objects.filter(email=normalized_email).exclude(id=user.id).exists():
                    return Response({"error": "Email already exists."}, status=status.HTTP_400_BAD_REQUEST)
                user.email = normalized_email
            if first_name is not None or last_name is not None or email is not None:
                user.save(update_fields=["first_name", "last_name", "email"])

            allowed_fields = {
                "specialty",
                "department",
                "workplace",
                "experience_years",
                "work_direction",
                "competencies",
                "phone",
                "schedule",
                "status",
                "short_info",
            }
            profile_update_fields = []
            for field in allowed_fields:
                if field in request.data:
                    setattr(profile, field, str(request.data.get(field) or "").strip())
                    profile_update_fields.append(field)
            if profile_update_fields:
                profile.save(update_fields=profile_update_fields + ["updated_at"])
            payload = {
                "id": user.id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
                "full_name": f"{user.first_name} {user.last_name}".strip() or user.username,
                **_get_profile_payload(user),
            }
            return Response(payload, status=status.HTTP_200_OK)
        except (OperationalError, ProgrammingError):
            return Response(
                {"error": "Doctor profile fields are not initialized yet. Apply migrations first."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class DoctorProfilePhotoAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        photo_data_url = request.data.get("photo_data_url", "")
        if photo_data_url and not str(photo_data_url).startswith("data:image/"):
            return Response({"error": "photo_data_url must be a valid image data URL"}, status=status.HTTP_400_BAD_REQUEST)
        if photo_data_url and len(photo_data_url) > 8_000_000:
            return Response({"error": "Image is too large"}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user if getattr(request.user, "is_authenticated", False) else None
        if user is None:
            user_id = request.data.get("user_id")
            if not user_id:
                return Response({"error": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            user = User.objects.filter(id=user_id).first()
            if not user:
                return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        try:
            profile, _ = DoctorProfile.objects.get_or_create(user=user)
            profile.photo_data_url = photo_data_url or ""
            profile.save(update_fields=["photo_data_url", "updated_at"])
        except (OperationalError, ProgrammingError):
            return Response(
                {"error": "Doctor profile storage is not initialized. Apply migrations first."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({"photo_data_url": profile.photo_data_url})