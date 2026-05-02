from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
import logging
import hashlib
import secrets
from django.core import signing
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.db.utils import OperationalError, ProgrammingError

from .models import DoctorProfile, AuditLog, EmailVerificationCode
from .permissions import get_user_role
from .verification import VerificationError, create_and_send_verification_code, verify_code
from .models import Patient
from .trusted_device import attach_trusted_device_cookie, issue_trusted_device, validate_trusted_device

logger = logging.getLogger(__name__)
LOGIN_2FA_CHALLENGE_SALT = "login-2fa-verification"
MEDICAL_LOGIN_2FA_ROLES = {
    DoctorProfile.ROLE_PATIENT,
    DoctorProfile.ROLE_DOCTOR,
    DoctorProfile.ROLE_CHIEF_DOCTOR,
}
LOGIN_2FA_PURPOSE = EmailVerificationCode.PURPOSE_PATIENT_LOGIN


def _serialize_auth_payload(user):
    refresh = RefreshToken.for_user(user)
    return {
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
    }


def _login_2fa_challenge_cache_key(challenge_token):
    digest = hashlib.sha256(str(challenge_token or "").encode("utf-8")).hexdigest()
    return f"login_2fa_challenge_used:{digest}"


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


def _normalize_signup_email(value):
    return str(value or "").strip().lower()


def _validate_signup_password(password, confirm_password=None):
    raw = str(password or "")
    if len(raw) < 8:
        raise VerificationError("Password must be at least 8 characters long.")
    has_letter = any(ch.isalpha() for ch in raw)
    has_digit = any(ch.isdigit() for ch in raw)
    if not has_letter or not has_digit:
        raise VerificationError("Password must contain at least one letter and one digit.")
    if any("А" <= ch <= "я" or ch in "ЁёӘәІіҢңҒғҮүҰұҚқӨөҺһ" for ch in raw):
        raise VerificationError("Password must not contain Cyrillic characters.")
    if confirm_password is not None and raw != str(confirm_password or ""):
        raise VerificationError("Passwords do not match.")
    return raw


def _find_signup_patient(patient_id, email):
    patient_code = str(patient_id or "").strip()
    normalized_email = _normalize_signup_email(email)
    if not patient_code or not normalized_email:
        return None
    return (
        Patient.objects.filter(patient_code=patient_code, email__iexact=normalized_email)
        .select_related("user")
        .first()
    )


def _client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _audit_signup(request, action, object_type, object_id="", details=None):
    AuditLog.objects.create(
        user=request.user if getattr(request.user, "is_authenticated", False) else None,
        action=action,
        object_type=object_type,
        object_id=str(object_id or ""),
        details=details or {},
        ip_address=_client_ip(request),
    )


class SignupAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        logger.warning("Legacy signup endpoint is disabled; use OTP signup flow.")
        return Response(
            {"error": "Legacy signup is disabled. Use OTP-based patient or doctor signup."},
            status=status.HTTP_410_GONE,
        )


class LoginAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # Trusted device is evaluated only after successful password authentication.
        # Cookie alone cannot authenticate; validate_trusted_device() always pairs cookie hash with this user.
        login_value = request.data.get("email", "").strip() or request.data.get("username", "").strip()
        password = request.data.get("password", "")

        if not login_value or not password:
            return Response(
                {"error": "username/email and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = None
        normalized_login = str(login_value).strip().lower()

        if "@" in login_value:
            found_user = User.objects.filter(email__iexact=normalized_login).first()
            if found_user:
                user = authenticate(username=found_user.username, password=password)
            else:
                # Patient card email may differ from auth.User.email if updates were not synced.
                patient_row = (
                    Patient.objects.filter(email__iexact=normalized_login)
                    .exclude(user=None)
                    .select_related("user")
                    .first()
                )
                if patient_row and patient_row.user_id:
                    candidate = patient_row.user
                    user = authenticate(username=candidate.username, password=password)
                    if user is not None and user.id == candidate.id:
                        if (user.email or "").strip().lower() != normalized_login:
                            user.email = normalized_login
                            user.save(update_fields=["email"])
        else:
            user = authenticate(username=login_value, password=password)

        if user is None:
            return Response(
                {"error": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        role = get_user_role(user)
        if role in MEDICAL_LOGIN_2FA_ROLES:
            if validate_trusted_device(request, user):
                return Response(_serialize_auth_payload(user), status=status.HTTP_200_OK)
            logger.info("login_2fa: will_send_otp user_id=%s role=%s", user.id, role)
            if not (user.email or "").strip():
                logger.warning("login_2fa blocked: missing_email user_id=%s role=%s", user.id, role)
                return Response(
                    {
                        "error": "Account email is required for verification. Please contact an administrator.",
                        "error_code": "email_missing",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                create_and_send_verification_code(
                    email=user.email,
                    purpose=LOGIN_2FA_PURPOSE,
                )
            except VerificationError as exc:
                error_code = getattr(exc, "code", "")
                logger.warning(
                    "Login OTP request failed: user_id=%s role=%s email=%s code=%s detail=%s",
                    user.id,
                    role,
                    user.email,
                    error_code,
                    str(exc),
                )
                if error_code in {"cooldown", "rate_limit"}:
                    return Response(
                        {
                            "error": exc.public_message,
                            "error_code": error_code,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if error_code in {"smtp_config_error", "smtp_send_failed"}:
                    return Response(
                        {
                            "error": "Failed to send verification code. Please try again later.",
                            "error_code": error_code,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                return Response(
                    {"error": "Unable to start verification.", "error_code": error_code or "verification_error"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            challenge_token = signing.dumps(
                {
                    "user_id": user.id,
                    "email": user.email,
                    "role": role,
                    "nonce": secrets.token_urlsafe(8),
                },
                salt=LOGIN_2FA_CHALLENGE_SALT,
            )
            return Response(
                {
                    "verification_required": True,
                    "challenge_token": challenge_token,
                    "email": user.email,
                    "verification_role": role,
                    "message": "Verification code sent.",
                },
                status=status.HTTP_200_OK,
            )

        return Response(_serialize_auth_payload(user), status=status.HTTP_200_OK)


class LoginVerifyCodeAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        challenge_token = str(request.data.get("challenge_token") or "").strip()
        code = request.data.get("code")
        if not challenge_token or not code:
            return Response({"error": "challenge_token and code are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            max_age = int(getattr(settings, "VERIFICATION_CODE_TTL_SECONDS", 600))
            challenge_cache_key = _login_2fa_challenge_cache_key(challenge_token)
            if cache.get(challenge_cache_key):
                raise VerificationError("Login verification has already been completed.")
            payload = signing.loads(
                challenge_token,
                salt=LOGIN_2FA_CHALLENGE_SALT,
                max_age=max_age,
            )
            user_id = payload.get("user_id")
            email = _normalize_signup_email(payload.get("email"))
            if not user_id or not email:
                raise VerificationError("Invalid login verification session.")

            user = User.objects.filter(id=user_id, email__iexact=email).first()
            role = get_user_role(user) if user else None
            if not user or role not in MEDICAL_LOGIN_2FA_ROLES:
                raise VerificationError("Invalid login verification session.")

            verify_code(email=email, purpose=LOGIN_2FA_PURPOSE, code=code)
            cache.set(challenge_cache_key, True, timeout=max_age)
            remember_raw = request.data.get("remember_device")
            remember_device = remember_raw in (True, "true", "1", 1, "yes", "on")
            logger.info(
                "login_2fa_verify: user_id=%s role=%s remember_device=%s raw=%r",
                user.id,
                role,
                remember_device,
                remember_raw,
            )
            response = Response(_serialize_auth_payload(user), status=status.HTTP_200_OK)
            if remember_device:
                raw_token, td = issue_trusted_device(request, user)
                attach_trusted_device_cookie(response, raw_token, request)
                logger.info(
                    "Trusted device registered user_id=%s role=%s device_id=%s ttl_seconds=%s",
                    user.id,
                    role,
                    td.id,
                    getattr(settings, "PATIENT_TRUSTED_DEVICE_MAX_AGE_SECONDS", 0),
                )
            return response
        except signing.SignatureExpired:
            logger.warning("Login OTP verify failed: reason=challenge_expired")
            return Response(
                {
                    "error": "Login verification has expired. Please sign in again.",
                    "error_code": "challenge_expired",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except signing.BadSignature:
            logger.warning("Login OTP verify failed: reason=challenge_bad_signature")
            return Response(
                {"error": "Invalid login verification session.", "error_code": "challenge_invalid"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except VerificationError as exc:
            error_code = getattr(exc, "code", "")
            logger.warning(
                "Login OTP verify failed: code=%s detail=%s",
                error_code,
                str(exc),
            )
            return Response(
                {"error": exc.public_message, "error_code": error_code or "verification_error"},
                status=status.HTTP_400_BAD_REQUEST,
            )


# Backward-compatible alias for existing imports/urls.
PatientLoginVerifyCodeAPIView = LoginVerifyCodeAPIView


class LogoutAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        detail = {"detail": "Logged out"}
        status_code = status.HTTP_200_OK
        try:
            refresh_token = request.data.get("refresh")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except Exception:
            detail = {"detail": "Logout completed locally. Token blacklist is not enabled."}

        # JWT/session ends here; patient trusted-device cookie is intentionally kept until TTL expiry
        # so "remember this device" still skips OTP on the next password login (guarantee #4).
        return Response(detail, status=status_code)


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
                normalized_email = str(email or "").strip().lower()
                if not normalized_email:
                    return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
                if User.objects.filter(email__iexact=normalized_email).exclude(id=user.id).exists():
                    return Response({"error": "Email already exists."}, status=status.HTTP_400_BAD_REQUEST)
                user.email = normalized_email
            if first_name is not None or last_name is not None or email is not None:
                user.save(update_fields=["first_name", "last_name", "email"])
            # Patient portal profile email must stay aligned with linked Patient.email for cards / signup parity.
            if email is not None and get_user_role(user) == DoctorProfile.ROLE_PATIENT:
                linked_patient = Patient.objects.filter(user=user).first()
                if linked_patient:
                    linked_patient.email = user.email
                    linked_patient.save(update_fields=["email", "updated_at"])

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


class VerificationCodeSendAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        purpose = request.data.get("purpose")
        try:
            payload = create_and_send_verification_code(email=email, purpose=purpose)
            return Response(
                {
                    "message": "Verification code sent.",
                    "email": payload["email"],
                    "purpose": payload["purpose"],
                    "expires_at": payload["expires_at"],
                },
                status=status.HTTP_200_OK,
            )
        except VerificationError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.exception("Verification code send API failed: %s", exc)
            return Response(
                {"error": "Failed to send verification code."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class VerificationCodeCheckAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        purpose = request.data.get("purpose")
        code = request.data.get("code")
        try:
            payload = verify_code(email=email, purpose=purpose, code=code)
            return Response(payload, status=status.HTTP_200_OK)
        except VerificationError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.exception("Verification code check API failed: %s", exc)
            return Response({"error": "Failed to verify code."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PatientSignupRequestCodeAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        patient_id = request.data.get("patient_id")
        email = _normalize_signup_email(request.data.get("email"))
        password = request.data.get("password")
        confirm_password = request.data.get("confirm_password")

        try:
            _audit_signup(
                request,
                "patient_signup_request_attempt",
                "PatientSignup",
                object_id=str(patient_id or ""),
                details={"email": email},
            )
            _validate_signup_password(password, confirm_password)
            patient = _find_signup_patient(patient_id=patient_id, email=email)
            if not patient or not patient.email:
                logger.warning(
                    "patient-signup request rejected: reason=patient_not_found_or_email_mismatch patient_id=%s email=%s",
                    patient_id,
                    email,
                )
                raise VerificationError("Unable to process signup request.")
            if patient.user_id:
                logger.warning(
                    "patient-signup request rejected: reason=patient_already_linked patient_id=%s email=%s user_id=%s",
                    patient_id,
                    email,
                    patient.user_id,
                )
                raise VerificationError("Unable to process signup request.")
            create_and_send_verification_code(
                email=email,
                purpose="patient_signup",
            )
            _audit_signup(
                request,
                "patient_signup_code_sent",
                "PatientSignup",
                object_id=str(patient.id),
                details={"email": email},
            )
            return Response(
                {"message": "Verification code sent if patient credentials are valid."},
                status=status.HTTP_200_OK,
            )
        except VerificationError as exc:
            logger.warning(
                "patient-signup request failed: reason=%s patient_id=%s email=%s",
                str(exc),
                patient_id,
                email,
            )
            _audit_signup(
                request,
                "patient_signup_request_failed",
                "PatientSignup",
                object_id=str(patient_id or ""),
                details={"email": email, "reason": str(exc)},
            )
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.exception("Unexpected patient signup request failure: %s", exc)
            _audit_signup(
                request,
                "patient_signup_request_failed",
                "PatientSignup",
                object_id=str(patient_id or ""),
                details={"email": email, "reason": "unexpected_error"},
            )
            return Response({"error": "Unable to process signup request."}, status=status.HTTP_400_BAD_REQUEST)


class PatientSignupVerifyCodeAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        patient_id = request.data.get("patient_id")
        email = _normalize_signup_email(request.data.get("email"))
        password = request.data.get("password")
        code = request.data.get("code")

        try:
            _audit_signup(
                request,
                "patient_signup_verify_attempt",
                "PatientSignup",
                object_id=str(patient_id or ""),
                details={"email": email},
            )
            validated_password = _validate_signup_password(password)
            with transaction.atomic():
                patient = _find_signup_patient(patient_id=patient_id, email=email)
                if not patient or not patient.email:
                    raise VerificationError("Unable to complete signup.")
                if patient.user_id:
                    raise VerificationError("Unable to complete signup.")

                verify_code(email=email, purpose="patient_signup", code=code)

                if User.objects.filter(email__iexact=email).exists():
                    raise VerificationError("An account with this email already exists.")

                username_base = email.split("@")[0] or "patient"
                username = username_base
                suffix = 1
                while User.objects.filter(username=username).exists():
                    username = f"{username_base}{suffix}"
                    suffix += 1

                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=validated_password,
                )
                profile, _ = DoctorProfile.objects.get_or_create(user=user, defaults={"role": DoctorProfile.ROLE_PATIENT})
                if profile.role != DoctorProfile.ROLE_PATIENT:
                    profile.role = DoctorProfile.ROLE_PATIENT
                    profile.save(update_fields=["role", "updated_at"])

                patient.user = user
                patient.updated_by = None
                patient.save(update_fields=["user", "updated_by", "updated_at"])

            _audit_signup(
                request,
                "patient_signup_linked",
                "Patient",
                object_id=str(patient.id),
                details={"email": email, "user_id": user.id},
            )
            return Response(
                {
                    "message": "Patient account created successfully.",
                    "user_id": user.id,
                    "patient_id": patient.id,
                },
                status=status.HTTP_201_CREATED,
            )
        except VerificationError as exc:
            _audit_signup(
                request,
                "patient_signup_verify_failed",
                "PatientSignup",
                object_id=str(patient_id or ""),
                details={"email": email, "reason": str(exc)},
            )
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.exception("Unexpected patient signup verification failure: %s", exc)
            _audit_signup(
                request,
                "patient_signup_verify_failed",
                "PatientSignup",
                object_id=str(patient_id or ""),
                details={"email": email, "reason": "unexpected_error"},
            )
            return Response({"error": "Unable to complete signup."}, status=status.HTTP_400_BAD_REQUEST)


class DoctorSignupRequestCodeAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        first_name = str(request.data.get("first_name") or "").strip()
        last_name = str(request.data.get("last_name") or "").strip()
        email = _normalize_signup_email(request.data.get("email"))
        password = request.data.get("password")
        confirm_password = request.data.get("confirm_password")

        try:
            _audit_signup(
                request,
                "doctor_signup_request_attempt",
                "DoctorSignup",
                details={"email": email},
            )
            if not first_name:
                raise VerificationError("First name is required.")
            if not last_name:
                raise VerificationError("Last name is required.")
            _validate_signup_password(password, confirm_password)
            if not email:
                raise VerificationError("Email is required.")
            if User.objects.filter(email__iexact=email).exists():
                raise VerificationError("An account with this email already exists.")

            create_and_send_verification_code(email=email, purpose="doctor_signup")
            _audit_signup(
                request,
                "doctor_signup_code_sent",
                "DoctorSignup",
                details={"email": email},
            )
            return Response(
                {"message": "Verification code sent."},
                status=status.HTTP_200_OK,
            )
        except VerificationError as exc:
            _audit_signup(
                request,
                "doctor_signup_request_failed",
                "DoctorSignup",
                details={"email": email, "reason": str(exc)},
            )
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.exception("Unexpected doctor signup request failure: %s", exc)
            _audit_signup(
                request,
                "doctor_signup_request_failed",
                "DoctorSignup",
                details={"email": email, "reason": "unexpected_error"},
            )
            return Response({"error": "Unable to process signup request."}, status=status.HTTP_400_BAD_REQUEST)


class DoctorSignupVerifyCodeAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        first_name = str(request.data.get("first_name") or "").strip()
        last_name = str(request.data.get("last_name") or "").strip()
        email = _normalize_signup_email(request.data.get("email"))
        password = request.data.get("password")
        code = request.data.get("code")

        try:
            _audit_signup(
                request,
                "doctor_signup_verify_attempt",
                "DoctorSignup",
                details={"email": email},
            )
            if not first_name:
                raise VerificationError("First name is required.")
            if not last_name:
                raise VerificationError("Last name is required.")
            validated_password = _validate_signup_password(password)
            if not email:
                raise VerificationError("Email is required.")

            with transaction.atomic():
                verify_code(email=email, purpose="doctor_signup", code=code)
                if User.objects.filter(email__iexact=email).exists():
                    raise VerificationError("An account with this email already exists.")

                username_base = email.split("@")[0] or "doctor"
                username = username_base
                suffix = 1
                while User.objects.filter(username=username).exists():
                    username = f"{username_base}{suffix}"
                    suffix += 1

                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=validated_password,
                    first_name=first_name,
                    last_name=last_name,
                )
                profile, _ = DoctorProfile.objects.get_or_create(
                    user=user, defaults={"role": DoctorProfile.ROLE_PENDING}
                )
                if profile.role != DoctorProfile.ROLE_PENDING:
                    profile.role = DoctorProfile.ROLE_PENDING
                    profile.save(update_fields=["role", "updated_at"])

            _audit_signup(
                request,
                "doctor_signup_created",
                "User",
                object_id=str(user.id),
                details={"email": email, "role": DoctorProfile.ROLE_PENDING},
            )
            return Response(
                {
                    "message": "Account created successfully. Await role approval.",
                    "user_id": user.id,
                    "role": DoctorProfile.ROLE_PENDING,
                },
                status=status.HTTP_201_CREATED,
            )
        except VerificationError as exc:
            _audit_signup(
                request,
                "doctor_signup_verify_failed",
                "DoctorSignup",
                details={"email": email, "reason": str(exc)},
            )
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.exception("Unexpected doctor signup verification failure: %s", exc)
            _audit_signup(
                request,
                "doctor_signup_verify_failed",
                "DoctorSignup",
                details={"email": email, "reason": "unexpected_error"},
            )
            return Response({"error": "Unable to complete signup."}, status=status.HTTP_400_BAD_REQUEST)