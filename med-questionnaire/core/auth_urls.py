from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .auth_views import SignupAPIView, LoginAPIView, FirebaseLoginAPIView, MeAPIView, DoctorProfilePhotoAPIView

urlpatterns = [
    path("signup/", SignupAPIView.as_view(), name="auth_signup"),
    path("login/", LoginAPIView.as_view(), name="auth_login"),
    path("firebase-login/", FirebaseLoginAPIView.as_view(), name="auth_firebase_login"),
    path("refresh/", TokenRefreshView.as_view(), name="auth_refresh"),
    path("me/", MeAPIView.as_view(), name="auth_me"),
    path("profile-photo/", DoctorProfilePhotoAPIView.as_view(), name="auth_profile_photo"),
]