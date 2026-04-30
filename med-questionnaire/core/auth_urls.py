from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .auth_views import (
    SignupAPIView,
    LoginAPIView,
    LogoutAPIView,
    MeAPIView,
    DoctorProfilePhotoAPIView,
    DoctorProfileUpdateAPIView,
    VerificationCodeSendAPIView,
    VerificationCodeCheckAPIView,
    PatientLoginVerifyCodeAPIView,
    PatientSignupRequestCodeAPIView,
    PatientSignupVerifyCodeAPIView,
    DoctorSignupRequestCodeAPIView,
    DoctorSignupVerifyCodeAPIView,
)

urlpatterns = [
    path("register/", SignupAPIView.as_view(), name="auth_register"),
    path("signup/", SignupAPIView.as_view(), name="auth_signup_legacy"),
    path("login/", LoginAPIView.as_view(), name="auth_login"),
    path("logout/", LogoutAPIView.as_view(), name="auth_logout"),
    path("token/refresh/", TokenRefreshView.as_view(), name="auth_token_refresh"),
    path("refresh/", TokenRefreshView.as_view(), name="auth_refresh_legacy"),
    path("me/", MeAPIView.as_view(), name="auth_me"),
    path("profile/", DoctorProfileUpdateAPIView.as_view(), name="auth_profile_update"),
    path("profile-photo/", DoctorProfilePhotoAPIView.as_view(), name="auth_profile_photo"),
    path("verification/send-code/", VerificationCodeSendAPIView.as_view(), name="auth_verification_send_code"),
    path("verification/check-code/", VerificationCodeCheckAPIView.as_view(), name="auth_verification_check_code"),
    path("patient-login/verify-code/", PatientLoginVerifyCodeAPIView.as_view(), name="auth_patient_login_verify_code"),
    path("patient-signup/request-code/", PatientSignupRequestCodeAPIView.as_view(), name="auth_patient_signup_request_code"),
    path("patient-signup/verify-code/", PatientSignupVerifyCodeAPIView.as_view(), name="auth_patient_signup_verify_code"),
    path("doctor-signup/request-code/", DoctorSignupRequestCodeAPIView.as_view(), name="auth_doctor_signup_request_code"),
    path("doctor-signup/verify-code/", DoctorSignupVerifyCodeAPIView.as_view(), name="auth_doctor_signup_verify_code"),
]