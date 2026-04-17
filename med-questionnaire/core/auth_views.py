from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.db.utils import OperationalError, ProgrammingError

from .firebase_auth import verify_firebase_token
from .models import DoctorProfile


def _get_photo_data_url(user):
    try:
        profile, _ = DoctorProfile.objects.get_or_create(user=user)
        return profile.photo_data_url or ""
    except (OperationalError, ProgrammingError):
        # DoctorProfile table may be unavailable before migrations are applied.
        return ""


class SignupAPIView(APIView):
    def post(self, request):
        username = request.data.get("username", "").strip()
        email = request.data.get("email", "").strip()
        password = request.data.get("password", "")
        first_name = request.data.get("first_name", "").strip()
        last_name = request.data.get("last_name", "").strip()

        if not username or not password:
            return Response(
                {"error": "username and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {"error": "Username already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if email and User.objects.filter(email=email).exists():
            return Response(
                {"error": "Email already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "message": "User created successfully",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "photo_data_url": _get_photo_data_url(user),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class LoginAPIView(APIView):
    def post(self, request):
        login_value = request.data.get("username", "").strip()
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
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "photo_data_url": _get_photo_data_url(user),
                },
            },
            status=status.HTTP_200_OK,
        )


class FirebaseLoginAPIView(APIView):
    def post(self, request):
        id_token = request.data.get("id_token")

        if not id_token:
            return Response(
                {"error": "id_token is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            decoded = verify_firebase_token(id_token)
        except Exception as e:
            return Response(
                {"error": f"Invalid Firebase token: {str(e)}"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        email = decoded.get("email", "")
        uid = decoded.get("uid")
        name = decoded.get("name", "")

        if not email:
            return Response(
                {"error": "Firebase token does not contain email"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        first_name = ""
        last_name = ""

        if name:
            parts = name.strip().split(" ", 1)
            first_name = parts[0]
            if len(parts) > 1:
                last_name = parts[1]

        username_base = email.split("@")[0]
        username = username_base

        user = User.objects.filter(email=email).first()

        if not user:
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{username_base}{counter}"
                counter += 1

            temp_password = "firebase_temp_password_123"

            user = User.objects.create_user(
                username=username,
                email=email,
                password=temp_password,
                first_name=first_name,
                last_name=last_name,
            )
        else:
            updated = False
            if first_name and user.first_name != first_name:
                user.first_name = first_name
                updated = True
            if last_name and user.last_name != last_name:
                user.last_name = last_name
                updated = True
            if updated:
                user.save()

        return Response(
            {
                "message": "Firebase login successful",
                "firebase_uid": uid,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "photo_data_url": _get_photo_data_url(user),
                },
            },
            status=status.HTTP_200_OK,
        )


class MeAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "photo_data_url": _get_photo_data_url(user),
            }
        )


class DoctorProfilePhotoAPIView(APIView):
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