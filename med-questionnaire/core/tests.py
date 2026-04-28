from datetime import timedelta
import secrets

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import Disease, DoctorProfile, Questionnaire, QuestionnaireSession


class BaseApiTestCase(APITestCase):
    password = "DemoPass123"

    def create_user_with_role(self, username, email, role):
        user = User.objects.create_user(
            username=username,
            email=email,
            password=self.password,
        )
        DoctorProfile.objects.create(user=user, role=role)
        return user

    def login_and_get_access(self, email):
        response = self.client.post(
            "/api/auth/login/",
            {"email": email, "password": self.password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        return response.data["access"]

    def auth_client_for(self, user):
        token = self.login_and_get_access(user.email)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client

    def questionnaire_payload(self, disease_id, title_suffix="A"):
        return {
            "disease": disease_id,
            "title": f"Questionnaire {title_suffix}",
            "title_ru": f"Опросник {title_suffix}",
            "description": "Test questionnaire",
            "questions": [
                {
                    "order": 1,
                    "text": "Do you smoke?",
                    "qtype": "yesno",
                    "score_yes": 2,
                    "score_no": 0,
                    "is_required": True,
                }
            ],
            "is_standardized": False,
        }


class JwtAuthApiTests(BaseApiTestCase):
    def setUp(self):
        self.user = self.create_user_with_role(
            "doctor_auth",
            "doctor_auth@example.com",
            DoctorProfile.ROLE_DOCTOR,
        )

    def test_login_success_returns_tokens(self):
        response = self.client.post(
            "/api/auth/login/",
            {"email": self.user.email, "password": self.password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_me_with_access_token_returns_user_data(self):
        token = self.login_and_get_access(self.user.email)
        response = self.client.get(
            "/api/auth/me/",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], self.user.email)

    def test_me_without_token_returns_401(self):
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class PatientScopingApiTests(BaseApiTestCase):
    def setUp(self):
        self.doctor1 = self.create_user_with_role("doctor1", "doctor1@example.com", DoctorProfile.ROLE_DOCTOR)
        self.doctor2 = self.create_user_with_role("doctor2", "doctor2@example.com", DoctorProfile.ROLE_DOCTOR)
        self.chief = self.create_user_with_role(
            "chief_doctor",
            "chief@example.com",
            DoctorProfile.ROLE_CHIEF_DOCTOR,
        )
        self.admin = self.create_user_with_role("admin_user", "admin@example.com", DoctorProfile.ROLE_ADMIN)

    def test_patient_scoping_for_doctors_chief_and_admin(self):
        doctor1_client = self.auth_client_for(self.doctor1)
        create_response = doctor1_client.post(
            "/api/patients/",
            {
                "patient_code": "PAT-1001",
                "full_name": "Patient One",
                "age": 45,
                "sex": 1,
                "data": {},
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED, create_response.data)
        patient_id = create_response.data["id"]

        doctor1_list = doctor1_client.get("/api/patients/")
        self.assertEqual(doctor1_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(doctor1_list.data), 1)
        self.assertEqual(doctor1_list.data[0]["id"], patient_id)

        doctor2_client = self.auth_client_for(self.doctor2)
        doctor2_list = doctor2_client.get("/api/patients/")
        self.assertEqual(doctor2_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(doctor2_list.data), 0)

        doctor2_detail = doctor2_client.get(f"/api/patients/{patient_id}/")
        self.assertIn(doctor2_detail.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))

        doctor2_create = doctor2_client.post(
            "/api/patients/",
            {
                "patient_code": "PAT-2002",
                "full_name": "Patient Two",
                "age": 38,
                "sex": 2,
                "data": {},
            },
            format="json",
        )
        self.assertEqual(doctor2_create.status_code, status.HTTP_201_CREATED, doctor2_create.data)

        chief_client = self.auth_client_for(self.chief)
        chief_list = chief_client.get("/api/patients/")
        self.assertEqual(chief_list.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(chief_list.data), 2)

        admin_client = self.auth_client_for(self.admin)
        admin_list = admin_client.get("/api/patients/")
        self.assertEqual(admin_list.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(admin_list.data), 2)


class DuplicatePatientCodeApiTests(BaseApiTestCase):
    def setUp(self):
        self.doctor = self.create_user_with_role("doctor_dup", "doctor_dup@example.com", DoctorProfile.ROLE_DOCTOR)
        self.client = self.auth_client_for(self.doctor)

    def test_duplicate_patient_code_returns_400_with_expected_message(self):
        payload = {
            "patient_code": "DUP-001",
            "full_name": "Patient Duplicate",
            "age": 34,
            "sex": 1,
            "data": {},
        }
        first_response = self.client.post("/api/patients/", payload, format="json")
        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED, first_response.data)

        second_response = self.client.post("/api/patients/", payload, format="json")
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("patient_code", second_response.data)
        self.assertIn("Пациент с таким ID уже существует.", second_response.data["patient_code"])


class QuestionnaireApprovalApiTests(BaseApiTestCase):
    def setUp(self):
        self.doctor = self.create_user_with_role("doctor_q", "doctor_q@example.com", DoctorProfile.ROLE_DOCTOR)
        self.chief = self.create_user_with_role("chief_q", "chief_q@example.com", DoctorProfile.ROLE_CHIEF_DOCTOR)
        self.doctor_client = self.auth_client_for(self.doctor)
        self.chief_client = self.auth_client_for(self.chief)
        self.disease = Disease.objects.create(name="Approval Disease")

    def test_questionnaire_approval_workflow(self):
        create_response = self.doctor_client.post(
            "/api/questionnaires/",
            self.questionnaire_payload(self.disease.id, "Workflow"),
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED, create_response.data)
        questionnaire_id = create_response.data["id"]
        self.assertEqual(create_response.data["approval_status"], Questionnaire.APPROVAL_DRAFT)

        submit_response = self.doctor_client.post(
            f"/api/questionnaires/{questionnaire_id}/submit-for-approval/",
            {},
            format="json",
        )
        self.assertEqual(submit_response.status_code, status.HTTP_200_OK, submit_response.data)
        questionnaire = Questionnaire.objects.get(id=questionnaire_id)
        self.assertEqual(questionnaire.approval_status, Questionnaire.APPROVAL_PENDING)

        doctor_approve = self.doctor_client.post(
            f"/api/questionnaires/{questionnaire_id}/approve/",
            {},
            format="json",
        )
        self.assertEqual(doctor_approve.status_code, status.HTTP_403_FORBIDDEN)

        reject_without_comment = self.chief_client.post(
            f"/api/questionnaires/{questionnaire_id}/reject/",
            {},
            format="json",
        )
        self.assertEqual(reject_without_comment.status_code, status.HTTP_400_BAD_REQUEST)

        request_changes_without_comment = self.chief_client.post(
            f"/api/questionnaires/{questionnaire_id}/request-changes/",
            {},
            format="json",
        )
        self.assertEqual(request_changes_without_comment.status_code, status.HTTP_400_BAD_REQUEST)

        approve_response = self.chief_client.post(
            f"/api/questionnaires/{questionnaire_id}/approve/",
            {},
            format="json",
        )
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK, approve_response.data)
        questionnaire.refresh_from_db()
        self.assertEqual(questionnaire.approval_status, Questionnaire.APPROVAL_APPROVED)


class QrPublicSubmitApiTests(BaseApiTestCase):
    def setUp(self):
        self.doctor = self.create_user_with_role("doctor_qr", "doctor_qr@example.com", DoctorProfile.ROLE_DOCTOR)
        self.client_doctor = self.auth_client_for(self.doctor)
        self.disease = Disease.objects.create(name="Risk Disease")
        self.questionnaire = Questionnaire.objects.create(
            title="QR Approved",
            description="QR flow questionnaire",
            disease=self.disease,
            created_by=self.doctor,
            approval_status=Questionnaire.APPROVAL_APPROVED,
        )
        self.questionnaire.questions.create(
            order=1,
            text="Headache today?",
            qtype="yesno",
            score_yes=1,
            score_no=0,
            is_required=True,
        )
        patient_response = self.client_doctor.post(
            "/api/patients/",
            {
                "patient_code": "QR-100",
                "full_name": "QR Patient",
                "age": 50,
                "sex": 1,
                "data": {},
            },
            format="json",
        )
        self.assertEqual(patient_response.status_code, status.HTTP_201_CREATED, patient_response.data)
        self.patient_id = patient_response.data["id"]

    def test_public_qr_submit_and_reuse_protection(self):
        session_response = self.client_doctor.post(
            "/api/questionnaire-sessions/",
            {
                "patient_id": self.patient_id,
                "questionnaire_id": self.questionnaire.id,
            },
            format="json",
        )
        self.assertEqual(session_response.status_code, status.HTTP_201_CREATED, session_response.data)
        token = session_response.data["token"]

        public_get = self.client.get(f"/api/public/questionnaire/{token}/")
        self.assertEqual(public_get.status_code, status.HTTP_200_OK, public_get.data)

        question_id = public_get.data["questions"][0]["id"]
        submit_response = self.client.post(
            f"/api/public/questionnaire/{token}/submit/",
            {"answers": {str(question_id): "yes"}},
            format="json",
        )
        self.assertEqual(submit_response.status_code, status.HTTP_201_CREATED, submit_response.data)

        session = QuestionnaireSession.objects.get(token=token)
        self.assertEqual(session.status, QuestionnaireSession.STATUS_COMPLETED)
        self.assertIsNotNone(session.completed_at)

        second_submit = self.client.post(
            f"/api/public/questionnaire/{token}/submit/",
            {"answers": {str(question_id): "yes"}},
            format="json",
        )
        self.assertEqual(second_submit.status_code, status.HTTP_400_BAD_REQUEST)

    def test_expired_token_returns_error_code(self):
        expired_session = QuestionnaireSession.objects.create(
            patient_id=self.patient_id,
            questionnaire=self.questionnaire,
            doctor=self.doctor,
            token=secrets.token_urlsafe(24),
            expires_at=timezone.now() - timedelta(hours=1),
        )
        response = self.client.get(f"/api/public/questionnaire/{expired_session.token}/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get("code"), "expired")


class AuditPermissionsApiTests(BaseApiTestCase):
    def setUp(self):
        self.doctor = self.create_user_with_role("doctor_a", "doctor_a@example.com", DoctorProfile.ROLE_DOCTOR)
        self.chief = self.create_user_with_role("chief_a", "chief_a@example.com", DoctorProfile.ROLE_CHIEF_DOCTOR)
        self.admin = self.create_user_with_role("admin_a", "admin_a@example.com", DoctorProfile.ROLE_ADMIN)

    def test_audit_logs_permissions(self):
        doctor_client = self.auth_client_for(self.doctor)
        chief_client = self.auth_client_for(self.chief)
        admin_client = self.auth_client_for(self.admin)

        doctor_response = doctor_client.get("/api/audit-logs/")
        self.assertEqual(doctor_response.status_code, status.HTTP_403_FORBIDDEN)

        chief_response = chief_client.get("/api/audit-logs/")
        self.assertEqual(chief_response.status_code, status.HTTP_200_OK)

        admin_response = admin_client.get("/api/audit-logs/")
        self.assertEqual(admin_response.status_code, status.HTTP_200_OK)
