from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .auth_views import SignupAPIView, LoginAPIView, LogoutAPIView, MeAPIView, DoctorProfilePhotoAPIView, DoctorProfileUpdateAPIView

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
]