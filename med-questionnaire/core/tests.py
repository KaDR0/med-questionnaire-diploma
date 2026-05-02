from datetime import date, timedelta
import re
import smtplib
import uuid
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import User
from django.core import mail
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import (
    Assessment,
    Disease,
    DoctorProfile,
    LabIndicator,
    LabResult,
    LabValue,
    Patient,
    Question,
    Questionnaire,
    QuestionnaireAssignment,
)
from .lab_recommendation_engine import build_lab_recommendation_bundle
from .patient_recommendation_engine import build_full_patient_recommendation_bundle
from .questionnaire_recommendation_engine import build_questionnaire_recommendation_bundle


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
        mail.outbox = []
        response = self.client.post(
            "/api/auth/login/",
            {"email": email, "password": self.password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        if response.data.get("verification_required"):
            self.assertTrue(mail.outbox, "Expected OTP email in outbox")
            body = mail.outbox[-1].body or ""
            m = re.search(r"\b(\d{6})\b", body)
            self.assertIsNotNone(m, f"Could not extract OTP from email body: {body!r}")
            verify_response = self.client.post(
                "/api/auth/login/verify-code/",
                {
                    "challenge_token": response.data.get("challenge_token"),
                    "code": m.group(1),
                    "remember_device": False,
                },
                format="json",
            )
            self.assertEqual(verify_response.status_code, status.HTTP_200_OK, verify_response.data)
            response = verify_response
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
        token = self.login_and_get_access(self.user.email)
        self.assertTrue(token)

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


class Login2FAMedicalRolesApiTests(BaseApiTestCase):
    def setUp(self):
        self.patient = self.create_user_with_role("pat_login_2fa", "pat_login_2fa@example.com", DoctorProfile.ROLE_PATIENT)
        self.doctor = self.create_user_with_role("doc_login_2fa", "doc_login_2fa@example.com", DoctorProfile.ROLE_DOCTOR)
        self.chief = self.create_user_with_role(
            "chief_login_2fa", "chief_login_2fa@example.com", DoctorProfile.ROLE_CHIEF_DOCTOR
        )
        self.pending = self.create_user_with_role("pending_login_2fa", "pending_login_2fa@example.com", DoctorProfile.ROLE_PENDING)

    def _start_login(self, email):
        mail.outbox = []
        return self.client.post(
            "/api/auth/login/",
            {"email": email, "password": self.password},
            format="json",
        )

    def _extract_last_otp(self):
        self.assertTrue(mail.outbox, "Expected OTP email in outbox")
        body = mail.outbox[-1].body or ""
        m = re.search(r"\b(\d{6})\b", body)
        self.assertIsNotNone(m, f"Could not extract OTP from email body: {body!r}")
        return m.group(1)

    def test_patient_doctor_chief_require_otp_on_new_device(self):
        for user in (self.patient, self.doctor, self.chief):
            with self.subTest(role=user.doctor_profile.role):
                r = self._start_login(user.email)
                self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
                self.assertTrue(r.data.get("verification_required"))
                self.assertIn("challenge_token", r.data)
                self.assertEqual(r.data.get("email"), user.email)

    def test_pending_keeps_direct_login_without_otp(self):
        r = self._start_login(self.pending.email)
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertIn("access", r.data)
        self.assertIn("refresh", r.data)
        self.assertNotIn("verification_required", r.data)

    def test_doctor_trusted_device_skips_otp_after_remember(self):
        first = self._start_login(self.doctor.email)
        self.assertEqual(first.status_code, status.HTTP_200_OK, first.data)
        self.assertTrue(first.data.get("verification_required"))
        code = self._extract_last_otp()

        verify = self.client.post(
            "/api/auth/login/verify-code/",
            {
                "challenge_token": first.data["challenge_token"],
                "code": code,
                "remember_device": True,
            },
            format="json",
        )
        self.assertEqual(verify.status_code, status.HTTP_200_OK, verify.data)
        cookie_name = getattr(settings, "PATIENT_TRUSTED_DEVICE_COOKIE_NAME", "mq_patient_td")
        self.assertIn(cookie_name, verify.cookies)

        second = self.client.post(
            "/api/auth/login/",
            {"email": self.doctor.email, "password": self.password},
            format="json",
        )
        self.assertEqual(second.status_code, status.HTTP_200_OK, second.data)
        self.assertIn("access", second.data)
        self.assertNotIn("verification_required", second.data)

class PatientScopingApiTests(BaseApiTestCase):
    def setUp(self):
        self.doctor1 = self.create_user_with_role("doctor1", "doctor1@example.com", DoctorProfile.ROLE_DOCTOR)
        self.doctor2 = self.create_user_with_role("doctor2", "doctor2@example.com", DoctorProfile.ROLE_DOCTOR)
        self.chief = self.create_user_with_role(
            "chief_doctor",
            "chief@example.com",
            DoctorProfile.ROLE_CHIEF_DOCTOR,
        )
        self.admin = self.create_user_with_role(
            "admin_user", "admin@example.com", DoctorProfile.ROLE_CHIEF_DOCTOR
        )

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


class QuestionnaireDiseaseNameInputApiTests(BaseApiTestCase):
    def setUp(self):
        self.doctor = self.create_user_with_role("doctor_disease_name", "doctor_disease_name@example.com", DoctorProfile.ROLE_DOCTOR)
        self.client = self.auth_client_for(self.doctor)

    def test_create_questionnaire_with_manual_disease_name(self):
        payload = {
            "disease_name": "Артериальная гипертензия",
            "title": "Manual disease questionnaire",
            "description": "Test",
            "questions": [
                {
                    "order": 1,
                    "text": "Q1",
                    "qtype": "yesno",
                    "score_yes": 1,
                    "score_no": 0,
                    "is_required": True,
                }
            ],
            "is_standardized": False,
        }
        r = self.client.post("/api/questionnaires/", payload, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        q = Questionnaire.objects.get(id=r.data["id"])
        self.assertEqual(q.disease.name, "Артериальная гипертензия")

    def test_edit_questionnaire_with_manual_disease_name(self):
        disease = Disease.objects.create(name="Initial disease")
        q = Questionnaire.objects.create(
            title="Editable questionnaire",
            description="Test",
            disease=disease,
            created_by=self.doctor,
            approval_status=Questionnaire.APPROVAL_DRAFT,
        )
        q.questions.create(order=1, text="Q1", qtype="yesno", score_yes=1, score_no=0, is_required=True)
        payload = {
            "disease_name": "Скрининг депрессивных симптомов",
            "title": q.title,
            "description": q.description,
            "questions": [
                {
                    "id": q.questions.first().id,
                    "order": 1,
                    "text": "Q1",
                    "qtype": "yesno",
                    "score_yes": 1,
                    "score_no": 0,
                    "is_required": True,
                }
            ],
            "is_standardized": False,
        }
        r = self.client.patch(f"/api/questionnaires/{q.id}/", payload, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        q.refresh_from_db()
        self.assertEqual(q.disease.name, "Скрининг депрессивных симптомов")


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


class PatientAssignmentSubmitApiTests(BaseApiTestCase):
    """Submit via /api/assessments/submit/ as patient: must match an active assignment."""

    def setUp(self):
        self.doctor = self.create_user_with_role("doc_asg", "doc_asg@example.com", DoctorProfile.ROLE_DOCTOR)
        self.patient_user = self.create_user_with_role("pat_asg", "pat_asg@example.com", DoctorProfile.ROLE_PATIENT)
        self.doctor_client = self.auth_client_for(self.doctor)
        self.patient_client = APIClient()
        self.patient_client.force_authenticate(user=self.patient_user)

        self.disease = Disease.objects.create(name="Assignment Disease")
        self.questionnaire = Questionnaire.objects.create(
            title="Assignment Q",
            description="Test",
            disease=self.disease,
            created_by=self.doctor,
            approval_status=Questionnaire.APPROVAL_APPROVED,
        )
        self.q1 = self.questionnaire.questions.create(
            order=1,
            text="Q1",
            qtype="yesno",
            score_yes=1,
            score_no=0,
            is_required=True,
        )
        self.patient = Patient.objects.create(
            patient_code="ASG-01",
            full_name="Assignment Patient",
            age=40,
            sex=1,
            data={},
            user=self.patient_user,
            created_by=self.doctor,
            assigned_doctor=self.doctor,
        )

    def _submit_payload(self):
        return {
            "patient_id": self.patient.id,
            "questionnaire_id": self.questionnaire.id,
            "answers": {str(self.q1.id): "no"},
        }

    def test_patient_rejects_without_active_assignment(self):
        r = self.patient_client.post("/api/assessments/submit/", self._submit_payload(), format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)
        self.assertIn("error", r.data)

    def test_patient_submits_once_then_rejected(self):
        QuestionnaireAssignment.objects.create(
            patient=self.patient,
            questionnaire=self.questionnaire,
            assigned_by=self.doctor,
            status=QuestionnaireAssignment.STATUS_ASSIGNED,
        )
        first = self.patient_client.post("/api/assessments/submit/", self._submit_payload(), format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)

        assignment = QuestionnaireAssignment.objects.get(
            patient=self.patient, questionnaire=self.questionnaire
        )
        self.assertEqual(assignment.status, QuestionnaireAssignment.STATUS_COMPLETED)
        self.assertIsNotNone(assignment.completed_at)
        self.assertEqual(assignment.result_assessment_id, first.data["assessment_id"])

        second = self.patient_client.post("/api/assessments/submit/", self._submit_payload(), format="json")
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST, second.data)

    def test_doctor_submit_completes_active_assignment_and_links_result(self):
        assignment = QuestionnaireAssignment.objects.create(
            patient=self.patient,
            questionnaire=self.questionnaire,
            assigned_by=self.doctor,
            status=QuestionnaireAssignment.STATUS_ASSIGNED,
        )
        response = self.doctor_client.post("/api/assessments/submit/", self._submit_payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, QuestionnaireAssignment.STATUS_COMPLETED)
        self.assertIsNotNone(assignment.completed_at)
        self.assertEqual(assignment.result_assessment_id, response.data["assessment_id"])
        self.assertEqual(response.data.get("assignment_id"), assignment.id)

        patient_assignments = self.patient_client.get("/api/patient/questionnaire-assignments/")
        self.assertEqual(patient_assignments.status_code, status.HTTP_200_OK)
        payload_row = next((row for row in patient_assignments.data if row["id"] == assignment.id), None)
        self.assertIsNotNone(payload_row)
        self.assertEqual(payload_row["status"], QuestionnaireAssignment.STATUS_COMPLETED)
        self.assertEqual(payload_row["result_assessment"], response.data["assessment_id"])

    def test_doctor_submit_without_assignment_keeps_manual_assessment(self):
        response = self.doctor_client.post("/api/assessments/submit/", self._submit_payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIsNone(response.data.get("assignment_id"))
        self.assertEqual(
            QuestionnaireAssignment.objects.filter(
                patient=self.patient, questionnaire=self.questionnaire
            ).count(),
            0,
        )
        self.assertTrue(
            Assessment.objects.filter(
                id=response.data["assessment_id"],
                patient=self.patient,
                questionnaire=self.questionnaire,
            ).exists()
        )

    def test_patient_rejects_completed_assignment(self):
        QuestionnaireAssignment.objects.create(
            patient=self.patient,
            questionnaire=self.questionnaire,
            assigned_by=self.doctor,
            status=QuestionnaireAssignment.STATUS_COMPLETED,
        )
        r = self.patient_client.post("/api/assessments/submit/", self._submit_payload(), format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)

    def test_patient_rejects_past_due_date(self):
        QuestionnaireAssignment.objects.create(
            patient=self.patient,
            questionnaire=self.questionnaire,
            assigned_by=self.doctor,
            status=QuestionnaireAssignment.STATUS_ASSIGNED,
            due_date=timezone.localdate() - timedelta(days=1),
        )
        r = self.patient_client.post("/api/assessments/submit/", self._submit_payload(), format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.data)
        self.assertIn("due date", r.data.get("error", "").lower())

    def test_patient_allows_due_today(self):
        QuestionnaireAssignment.objects.create(
            patient=self.patient,
            questionnaire=self.questionnaire,
            assigned_by=self.doctor,
            status=QuestionnaireAssignment.STATUS_ASSIGNED,
            due_date=timezone.localdate(),
        )
        r = self.patient_client.post("/api/assessments/submit/", self._submit_payload(), format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

    def test_assignment_save_rejects_result_assessment_wrong_patient(self):
        other_patient = Patient.objects.create(
            patient_code="ASG-02",
            full_name="Other Patient",
            age=35,
            sex=1,
            data={},
            created_by=self.doctor,
            assigned_doctor=self.doctor,
        )
        foreign_assessment = Assessment.objects.create(
            patient=other_patient,
            questionnaire=self.questionnaire,
            doctor=None,
            total_score=0,
        )
        assignment = QuestionnaireAssignment(
            patient=self.patient,
            questionnaire=self.questionnaire,
            assigned_by=self.doctor,
            status=QuestionnaireAssignment.STATUS_COMPLETED,
            result_assessment=foreign_assessment,
        )
        with self.assertRaises(ValidationError):
            assignment.save()

    def test_assignment_save_rejects_result_assessment_wrong_questionnaire(self):
        q2 = Questionnaire.objects.create(
            title="Other Q",
            description="Test",
            disease=self.disease,
            created_by=self.doctor,
            approval_status=Questionnaire.APPROVAL_APPROVED,
        )
        wrong_q_assessment = Assessment.objects.create(
            patient=self.patient,
            questionnaire=q2,
            doctor=None,
            total_score=0,
        )
        assignment = QuestionnaireAssignment(
            patient=self.patient,
            questionnaire=self.questionnaire,
            assigned_by=self.doctor,
            status=QuestionnaireAssignment.STATUS_COMPLETED,
            result_assessment=wrong_q_assessment,
        )
        with self.assertRaises(ValidationError):
            assignment.save()


class AssessmentAccessApiTests(BaseApiTestCase):
    """Assessment detail / risk / PDF must use the same scope — no cross-patient access by URL."""

    def setUp(self):
        self.doctor_a = self.create_user_with_role(
            "doc_acc_a", "doc_acc_a@example.com", DoctorProfile.ROLE_DOCTOR
        )
        self.doctor_b = self.create_user_with_role(
            "doc_acc_b", "doc_acc_b@example.com", DoctorProfile.ROLE_DOCTOR
        )
        self.patient_user = self.create_user_with_role(
            "pat_acc", "pat_acc@example.com", DoctorProfile.ROLE_PATIENT
        )
        self.client_doc_a = self.auth_client_for(self.doctor_a)
        self.client_doc_b = self.auth_client_for(self.doctor_b)
        self.patient_client = APIClient()
        self.patient_client.force_authenticate(user=self.patient_user)

        self.disease = Disease.objects.create(name="Access Test Disease")
        self.questionnaire = Questionnaire.objects.create(
            title="Access Q",
            description="Test",
            disease=self.disease,
            created_by=self.doctor_a,
            approval_status=Questionnaire.APPROVAL_APPROVED,
        )

        self.patient_own = Patient.objects.create(
            patient_code="ACC-OWN",
            full_name="Own Patient",
            age=40,
            sex=1,
            data={},
            user=self.patient_user,
            created_by=self.doctor_a,
            assigned_doctor=self.doctor_a,
        )
        self.patient_other = Patient.objects.create(
            patient_code="ACC-OTH",
            full_name="Other Patient",
            age=41,
            sex=1,
            data={},
            created_by=self.doctor_b,
            assigned_doctor=self.doctor_b,
        )

        self.assessment_own = Assessment.objects.create(
            patient=self.patient_own,
            questionnaire=self.questionnaire,
            doctor=None,
            total_score=0,
        )
        self.assessment_other = Assessment.objects.create(
            patient=self.patient_other,
            questionnaire=self.questionnaire,
            doctor=None,
            total_score=1,
        )

    def test_patient_cannot_read_other_patient_assessment_detail(self):
        r = self.patient_client.get(f"/api/assessments/{self.assessment_other.id}/")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_patient_can_read_own_assessment_detail(self):
        r = self.patient_client.get(f"/api/assessments/{self.assessment_own.id}/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_doctor_cannot_read_assessment_outside_scope(self):
        r = self.client_doc_a.get(f"/api/assessments/{self.assessment_other.id}/")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_doctor_can_read_assessment_in_scope(self):
        r = self.client_doc_a.get(f"/api/assessments/{self.assessment_own.id}/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_patient_risk_endpoint_requires_scope(self):
        r = self.patient_client.get(f"/api/assessments/{self.assessment_other.id}/risk/")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_patient_pdf_endpoint_requires_scope(self):
        r = self.patient_client.get(f"/api/assessments/{self.assessment_other.id}/pdf/")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)


class QuestionnaireAssignmentEmailApiTests(BaseApiTestCase):
    """Transactional email on POST /api/questionnaire-assignments/ — must not break assignment."""

    def setUp(self):
        self.doctor = self.create_user_with_role(
            "doc_mail", "doc_mail@example.com", DoctorProfile.ROLE_DOCTOR
        )
        self.client_doctor = self.auth_client_for(self.doctor)
        self.disease = Disease.objects.create(name="Mail Disease")
        self.questionnaire = Questionnaire.objects.create(
            title="Mail Q",
            description="Test",
            disease=self.disease,
            created_by=self.doctor,
            approval_status=Questionnaire.APPROVAL_APPROVED,
        )

    def _create_patient(self, *, email=None):
        code = f"P-{uuid.uuid4().hex[:10]}"
        return Patient.objects.create(
            patient_code=code,
            full_name="Mail Patient",
            age=40,
            sex=1,
            data={},
            email=email,
            created_by=self.doctor,
            assigned_doctor=self.doctor,
        )

    def _assign_payload(self, patient_id):
        return {
            "patient_id": patient_id,
            "questionnaire_id": self.questionnaire.id,
        }

    @patch("core.assignment_mail.send_mail")
    def test_sends_email_when_patient_has_email(self, mock_send):
        mock_send.return_value = 1
        p = self._create_patient(email="patient_has_mail@example.com")
        with self.captureOnCommitCallbacks(execute=True):
            r = self.client_doctor.post(
                "/api/questionnaire-assignments/",
                self._assign_payload(p.id),
                format="json",
            )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        mock_send.assert_called_once()
        subj = mock_send.call_args.kwargs.get("subject") or ""
        self.assertIn("Mail Q", subj)

    @patch("core.assignment_mail.send_mail")
    def test_skips_email_when_no_email(self, mock_send):
        p = self._create_patient(email=None)
        with self.captureOnCommitCallbacks(execute=True):
            r = self.client_doctor.post(
                "/api/questionnaire-assignments/",
                self._assign_payload(p.id),
                format="json",
            )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        mock_send.assert_not_called()

    @patch("core.assignment_mail.send_mail")
    def test_assignment_created_when_email_fails(self, mock_send):
        mock_send.side_effect = smtplib.SMTPException("smtp down")
        p = self._create_patient(email="fail_smtp@example.com")
        with self.captureOnCommitCallbacks(execute=True):
            r = self.client_doctor.post(
                "/api/questionnaire-assignments/",
                self._assign_payload(p.id),
                format="json",
            )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertTrue(QuestionnaireAssignment.objects.filter(patient=p).exists())

    @patch("core.assignment_mail.send_mail")
    def test_email_priority_patient_card_before_linked_login(self, mock_send):
        """Patient.email wins when both card and linked User have addresses."""
        mock_send.return_value = 1
        login_user = self.create_user_with_role(
            "pat_prio_login",
            "login_only_for_fallback@example.com",
            DoctorProfile.ROLE_PATIENT,
        )
        p = Patient.objects.create(
            patient_code=f"P-{uuid.uuid4().hex[:10]}",
            full_name="Priority Patient",
            age=40,
            sex=1,
            data={},
            email="card_wins@example.com",
            user=login_user,
            created_by=self.doctor,
            assigned_doctor=self.doctor,
        )
        with self.captureOnCommitCallbacks(execute=True):
            r = self.client_doctor.post(
                "/api/questionnaire-assignments/",
                self._assign_payload(p.id),
                format="json",
            )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        mock_send.assert_called_once()
        recipients = mock_send.call_args.kwargs.get("recipient_list") or []
        self.assertEqual(recipients, ["card_wins@example.com"])


class QuestionnaireAssignmentAccessApiTests(BaseApiTestCase):
    """Only doctors/chief can create or list global assignments; patients use /patient/questionnaire-assignments/ only."""

    def setUp(self):
        self.doctor = self.create_user_with_role(
            "doc_asg_access", "doc_asg_access@example.com", DoctorProfile.ROLE_DOCTOR
        )
        self.chief = self.create_user_with_role(
            "chief_asg_access", "chief_asg_access@example.com", DoctorProfile.ROLE_CHIEF_DOCTOR
        )
        self.patient_user = self.create_user_with_role(
            "pat_asg_access", "pat_asg_access@example.com", DoctorProfile.ROLE_PATIENT
        )
        self.patient_user_b = self.create_user_with_role(
            "pat_asg_access_b", "pat_asg_access_b@example.com", DoctorProfile.ROLE_PATIENT
        )
        self.doctor_client = self.auth_client_for(self.doctor)
        self.chief_client = self.auth_client_for(self.chief)
        self.patient_client = APIClient()
        self.patient_client.force_authenticate(user=self.patient_user)
        self.patient_b_client = APIClient()
        self.patient_b_client.force_authenticate(user=self.patient_user_b)

        self.disease = Disease.objects.create(name="Assignment Access Disease")
        self.questionnaire = Questionnaire.objects.create(
            title="Access Q",
            description="Test",
            disease=self.disease,
            created_by=self.doctor,
            approval_status=Questionnaire.APPROVAL_APPROVED,
        )
        self.patient_a = Patient.objects.create(
            patient_code="ASG-ACC-A",
            full_name="Patient A",
            age=40,
            sex=1,
            data={},
            user=self.patient_user,
            created_by=self.doctor,
            assigned_doctor=self.doctor,
        )
        self.patient_b = Patient.objects.create(
            patient_code="ASG-ACC-B",
            full_name="Patient B",
            age=35,
            sex=1,
            data={},
            user=self.patient_user_b,
            created_by=self.doctor,
            assigned_doctor=self.doctor,
        )
        self.assignment_a = QuestionnaireAssignment.objects.create(
            patient=self.patient_a,
            questionnaire=self.questionnaire,
            assigned_by=self.doctor,
            status=QuestionnaireAssignment.STATUS_ASSIGNED,
        )
        self.assignment_b = QuestionnaireAssignment.objects.create(
            patient=self.patient_b,
            questionnaire=self.questionnaire,
            assigned_by=self.doctor,
            status=QuestionnaireAssignment.STATUS_ASSIGNED,
        )

    def _create_payload(self, patient_id):
        return {"patient_id": patient_id, "questionnaire_id": self.questionnaire.id}

    def test_patient_cannot_post_questionnaire_assignment(self):
        r = self.patient_client.post(
            "/api/questionnaire-assignments/",
            self._create_payload(self.patient_a.id),
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_patient_cannot_get_global_assignment_list(self):
        r = self.patient_client.get("/api/questionnaire-assignments/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_patient_cannot_cancel_via_doctor_endpoint(self):
        r = self.patient_client.post(f"/api/questionnaire-assignments/{self.assignment_a.id}/cancel/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_patient_my_assignments_only_own_rows(self):
        r = self.patient_client.get("/api/patient/questionnaire-assignments/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIsInstance(r.data, list)
        ids = {row["id"] for row in r.data}
        self.assertIn(self.assignment_a.id, ids)
        self.assertNotIn(self.assignment_b.id, ids)

    def test_patient_b_sees_only_their_assignments(self):
        r = self.patient_b_client.get("/api/patient/questionnaire-assignments/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = {row["id"] for row in r.data}
        self.assertIn(self.assignment_b.id, ids)
        self.assertNotIn(self.assignment_a.id, ids)

    def test_chief_doctor_can_create_assignment(self):
        other = Patient.objects.create(
            patient_code="ASG-ACC-CHIEF",
            full_name="Chief Patient",
            age=30,
            sex=1,
            data={},
            created_by=self.chief,
            assigned_doctor=self.chief,
        )
        r = self.chief_client.post(
            "/api/questionnaire-assignments/",
            self._create_payload(other.id),
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

    def test_doctor_list_includes_patient_in_scope(self):
        r = self.doctor_client.get(
            f"/api/patients/{self.patient_a.id}/questionnaire-assignments/"
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIsInstance(r.data, list)
        self.assertTrue(any(row["id"] == self.assignment_a.id for row in r.data))


class AuditPermissionsApiTests(BaseApiTestCase):
    def setUp(self):
        self.doctor = self.create_user_with_role("doctor_a", "doctor_a@example.com", DoctorProfile.ROLE_DOCTOR)
        self.chief = self.create_user_with_role("chief_a", "chief_a@example.com", DoctorProfile.ROLE_CHIEF_DOCTOR)
        self.admin = self.create_user_with_role("admin_a", "admin_a@example.com", DoctorProfile.ROLE_CHIEF_DOCTOR)

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


class LabRecommendationEngineTests(BaseApiTestCase):
    def setUp(self):
        self.doctor = self.create_user_with_role(
            "lab_rec_doc", "lab_rec_doc@example.com", DoctorProfile.ROLE_DOCTOR
        )
        self.doctor_client = self.auth_client_for(self.doctor)
        self.patient_user = self.create_user_with_role(
            "lab_rec_pat", "lab_rec_pat@example.com", DoctorProfile.ROLE_PATIENT
        )
        self.patient = Patient.objects.create(
            patient_code="LAB-REC-1",
            full_name="Lab Rec Patient",
            age=45,
            sex=1,
            data={},
            user=self.patient_user,
            created_by=self.doctor,
            assigned_doctor=self.doctor,
        )

    def test_bundle_empty_labs_has_note(self):
        bundle = build_lab_recommendation_bundle(self.patient)
        self.assertEqual(bundle["version"], 1)
        self.assertEqual(bundle["items"], [])
        self.assertIsNotNone(bundle["note"])

    def test_glucose_above_ref_produces_structured_item(self):
        g = LabIndicator.objects.create(
            code="glucose",
            standard_name="Glucose",
            name="Glucose",
            category="metabolic",
            unit="mmol/L",
            min_norm=3.9,
            max_norm=6.0,
        )
        lr = LabResult.objects.create(patient=self.patient, date=timezone.now().date())
        LabValue.objects.create(result=lr, indicator=g, value=8.5)
        bundle = build_lab_recommendation_bundle(self.patient)
        self.assertEqual(len(bundle["items"]), 1)
        item = bundle["items"][0]
        self.assertEqual(item["id"], "lab_glucose_above_ref_v1")
        self.assertEqual(item["source_type"], "lab")
        self.assertEqual(item["priority"], "high")
        self.assertEqual(item["related_metrics"][0]["code"], "glucose")
        self.assertIn("8.5", item["patient_text"])
        self.assertIn("Актуальное значение по последнему", item["patient_text"])
        self.assertTrue(bundle["what_is_normal"] == [])
        self.assertTrue(bundle["patient_recommendations"])

    def test_duplicate_glucose_codes_use_newest_sample_not_older_abnormal(self):
        """Two dictionary rows with code=glucose: newest normal must not be overridden by older high glucose."""
        def make_glucose_indicator(suffix):
            return LabIndicator.objects.create(
                code="glucose",
                standard_name="Glucose",
                name=f"Glucose {suffix}",
                category="metabolic",
                unit="mmol/L",
                min_norm=3.9,
                max_norm=6.0,
            )

        g_old = make_glucose_indicator("A")
        g_new = make_glucose_indicator("B")
        lr_high = LabResult.objects.create(patient=self.patient, date=date(2025, 1, 10))
        lr_ok = LabResult.objects.create(patient=self.patient, date=date(2025, 4, 1))
        LabValue.objects.create(result=lr_high, indicator=g_old, value=12.0)
        LabValue.objects.create(result=lr_ok, indicator=g_new, value=5.3)
        bundle = build_lab_recommendation_bundle(self.patient)
        self.assertEqual(len(bundle["items"]), 0)
        self.assertEqual(len(bundle["what_is_normal"]), 1)
        self.assertIn("5.3", bundle["what_is_normal"][0])

    def test_duplicate_glucose_codes_newer_abnormal_yields_single_item(self):
        g_old = LabIndicator.objects.create(
            code="glucose",
            standard_name="Glucose",
            name="Glucose Old",
            category="metabolic",
            unit="mmol/L",
            min_norm=3.9,
            max_norm=6.0,
        )
        g_new = LabIndicator.objects.create(
            code="glucose",
            standard_name="Glucose",
            name="Glucose New",
            category="metabolic",
            unit="mmol/L",
            min_norm=3.9,
            max_norm=6.0,
        )
        lr_ok = LabResult.objects.create(patient=self.patient, date=date(2025, 1, 10))
        lr_high = LabResult.objects.create(patient=self.patient, date=date(2025, 5, 1))
        LabValue.objects.create(result=lr_ok, indicator=g_old, value=5.2)
        LabValue.objects.create(result=lr_high, indicator=g_new, value=8.8)
        bundle = build_lab_recommendation_bundle(self.patient)
        self.assertEqual(len(bundle["items"]), 1)
        self.assertEqual(bundle["items"][0]["id"], "lab_glucose_above_ref_v1")
        self.assertEqual(len(bundle["patient_recommendations"]), 1)

    def test_api_doctor_can_fetch_lab_recommendations(self):
        r = self.doctor_client.get(f"/api/patients/{self.patient.id}/lab-recommendations/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["version"], 1)

    def test_api_patient_can_fetch_own_lab_recommendations(self):
        patient_client = APIClient()
        patient_client.force_authenticate(user=self.patient_user)
        r = patient_client.get(f"/api/patients/{self.patient.id}/lab-recommendations/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)


class QuestionnaireRecommendationEngineTests(BaseApiTestCase):
    def setUp(self):
        self.doctor = self.create_user_with_role(
            "qrec_doc", "qrec_doc@example.com", DoctorProfile.ROLE_DOCTOR
        )
        self.doctor_client = self.auth_client_for(self.doctor)
        self.patient_user = self.create_user_with_role(
            "qrec_pat", "qrec_pat@example.com", DoctorProfile.ROLE_PATIENT
        )
        self.patient = Patient.objects.create(
            patient_code="QREC-1",
            full_name="Q Rec Patient",
            age=55,
            sex=1,
            data={},
            user=self.patient_user,
            created_by=self.doctor,
            assigned_doctor=self.doctor,
        )
        self.disease = Disease.objects.create(name="OSA Test", code="OSA-RISK", is_active=True)
        self.questionnaire = Questionnaire.objects.create(
            disease=self.disease,
            version="vtest",
            title="OSA Test Q",
            title_en="OSA Test Q",
            kind=Questionnaire.KIND_SCREENING,
            target_condition_code="OSA-RISK",
            min_completion_percent=75,
            interpretation_schema={
                "bands": [
                    {"min_ratio": 0.625, "label": "high_risk", "title": "High", "recommendation": "See doctor"},
                    {"min_ratio": 0.375, "label": "moderate_risk", "title": "Mod", "recommendation": "Monitor"},
                    {"min_ratio": 0.0, "label": "low_risk", "title": "Low", "recommendation": "OK"},
                ]
            },
            approval_status=Questionnaire.APPROVAL_APPROVED,
        )
        for i in range(8):
            Question.objects.create(
                questionnaire=self.questionnaire,
                order=i + 1,
                text=f"Q{i+1}",
                qtype=Question.YESNO,
                score_yes=1,
                score_no=0,
                is_required=True,
            )

    def test_osa_high_risk_emits_questionnaire_item(self):
        Assessment.objects.create(
            patient=self.patient,
            questionnaire=self.questionnaire,
            doctor=self.doctor,
            total_score=6,
            completion_percent=100,
            quality_flag=Assessment.QUALITY_VALID,
            interpretation={
                "label": "high_risk",
                "title": "High risk",
                "recommendation": "Seed text",
                "score_ratio": 0.75,
            },
            conclusion="High risk",
        )
        bundle = build_questionnaire_recommendation_bundle(self.patient)
        self.assertEqual(len(bundle["items"]), 1)
        item = bundle["items"][0]
        self.assertEqual(item["source_type"], "questionnaire")
        self.assertEqual(item["id"], "q_osa-risk_osa_high_risk_v1")
        self.assertEqual(item["priority"], "high")
        m = item["related_metrics"][0]
        self.assertEqual(m["target_condition_code"], "OSA-RISK")
        self.assertEqual(m["risk_band_normalized"], "high")

    def test_latest_assessment_wins_for_same_questionnaire(self):
        Assessment.objects.create(
            patient=self.patient,
            questionnaire=self.questionnaire,
            doctor=self.doctor,
            total_score=1,
            completion_percent=100,
            interpretation={"label": "low_risk", "title": "Low", "recommendation": "OK"},
            conclusion="Low",
        )
        Assessment.objects.create(
            patient=self.patient,
            questionnaire=self.questionnaire,
            doctor=self.doctor,
            total_score=7,
            completion_percent=100,
            interpretation={"label": "high_risk", "title": "High", "recommendation": "See doctor"},
            conclusion="High",
        )
        bundle = build_questionnaire_recommendation_bundle(self.patient)
        self.assertEqual(len(bundle["items"]), 1)
        self.assertEqual(bundle["items"][0]["trigger_reason"], "osa_high_risk")

    def test_same_target_code_multiple_questionnaires_keeps_newest_low_over_old_high(self):
        """Two OSA-RISK questionnaire rows: newer low-risk assessment must win over older high-risk."""
        q_old = Questionnaire.objects.create(
            disease=self.disease,
            version="v_legacy_osa",
            title="OSA Legacy",
            title_en="OSA Legacy",
            kind=Questionnaire.KIND_SCREENING,
            target_condition_code="OSA-RISK",
            min_completion_percent=75,
            interpretation_schema=self.questionnaire.interpretation_schema,
            approval_status=Questionnaire.APPROVAL_APPROVED,
        )
        for i in range(8):
            Question.objects.create(
                questionnaire=q_old,
                order=i + 1,
                text=f"Legacy {i+1}",
                qtype=Question.YESNO,
                score_yes=1,
                score_no=0,
                is_required=True,
            )
        a_old = Assessment.objects.create(
            patient=self.patient,
            questionnaire=q_old,
            doctor=self.doctor,
            total_score=7,
            completion_percent=100,
            interpretation={"label": "high_risk", "title": "High", "recommendation": "x"},
            conclusion="High",
        )
        Assessment.objects.filter(pk=a_old.pk).update(created_at=timezone.now() - timedelta(days=90))
        a_new = Assessment.objects.create(
            patient=self.patient,
            questionnaire=self.questionnaire,
            doctor=self.doctor,
            total_score=2,
            completion_percent=100,
            interpretation={"label": "low_risk", "title": "Low", "recommendation": "ok"},
            conclusion="Low",
        )
        bundle = build_questionnaire_recommendation_bundle(self.patient)
        self.assertEqual(len(bundle["items"]), 1)
        self.assertEqual(bundle["items"][0]["trigger_reason"], "osa_low_risk")
        self.assertEqual(bundle["items"][0]["related_metrics"][0]["assessment_id"], a_new.pk)

    def test_combined_bundle_includes_lab_and_questionnaire(self):
        Assessment.objects.create(
            patient=self.patient,
            questionnaire=self.questionnaire,
            doctor=self.doctor,
            total_score=7,
            completion_percent=100,
            interpretation={"label": "high_risk", "title": "High", "recommendation": "x"},
            conclusion="High",
        )
        g = LabIndicator.objects.create(
            code="glucose",
            standard_name="Glucose",
            name="Glucose",
            category="metabolic",
            unit="mmol/L",
            min_norm=3.9,
            max_norm=6.0,
        )
        lr = LabResult.objects.create(patient=self.patient, date=timezone.now().date())
        LabValue.objects.create(result=lr, indicator=g, value=9.0)
        full = build_full_patient_recommendation_bundle(self.patient)
        self.assertEqual(full["version"], 3)
        types = {x["source_type"] for x in full["items"]}
        self.assertIn("combined", types)
        self.assertTrue({"lab", "questionnaire"}.intersection(types) or len(full["combined_items"]) > 0)
        self.assertIn("sources", full)
        self.assertIn("overall_status", full)
        self.assertIn("combined_items", full)

    def test_api_combined_recommendations_endpoint(self):
        r = self.doctor_client.get(f"/api/patients/{self.patient.id}/recommendations/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data["version"], 3)

    def test_combined_diabetes_and_glucose_produces_combined_item(self):
        dm_disease = Disease.objects.create(name="T2DM test", code="T2DM-RISK", is_active=True)
        q_dm = Questionnaire.objects.create(
            disease=dm_disease,
            version="vdm1",
            title="DM Screener",
            title_en="DM Screener",
            kind=Questionnaire.KIND_SCREENING,
            target_condition_code="T2DM-RISK",
            min_completion_percent=75,
            interpretation_schema={
                "bands": [
                    {"min_ratio": 0.72, "label": "high_risk", "title": "High", "recommendation": "x"},
                    {"min_ratio": 0.43, "label": "moderate_risk", "title": "Mod", "recommendation": "y"},
                    {"min_ratio": 0.0, "label": "low_risk", "title": "Low", "recommendation": "z"},
                ]
            },
            approval_status=Questionnaire.APPROVAL_APPROVED,
        )
        for i in range(7):
            Question.objects.create(
                questionnaire=q_dm,
                order=i + 1,
                text=f"D{i}",
                qtype=Question.YESNO,
                score_yes=1,
                score_no=0,
                is_required=True,
            )
        Assessment.objects.create(
            patient=self.patient,
            questionnaire=q_dm,
            doctor=self.doctor,
            total_score=4,
            completion_percent=100,
            interpretation={"label": "moderate_risk", "title": "Mod", "recommendation": "y"},
            conclusion="Mod",
        )
        g = LabIndicator.objects.create(
            code="glucose",
            standard_name="Glucose",
            name="Glucose",
            category="metabolic",
            unit="mmol/L",
            min_norm=3.9,
            max_norm=6.0,
        )
        lr = LabResult.objects.create(patient=self.patient, date=timezone.now().date())
        LabValue.objects.create(result=lr, indicator=g, value=8.0)
        full = build_full_patient_recommendation_bundle(self.patient)
        combo_ids = [x["id"] for x in full["combined_items"]]
        self.assertIn("combo_diabetes_screen_plus_glycemic_lab_v1", combo_ids)
        self.assertFalse(any(i["id"].startswith("lab_glucose_above_ref") for i in full["items"]))
        self.assertFalse(
            any(
                i.get("source_type") == "questionnaire" and str(i.get("id", "")).startswith("q_t2dm-risk")
                for i in full["items"]
            ),
            "Diabetes singleton questionnaire row must be suppressed when combined glycemic rule fires.",
        )

    def test_combined_multiple_elevated_suppresses_per_screen_singletons(self):
        """Several elevated screens → one synthesis item; no duplicate questionnaire bullet rows."""
        dep_disease = Disease.objects.create(name="DEP Test", code="DEP-SCR", is_active=True)
        q_dep = Questionnaire.objects.create(
            disease=dep_disease,
            version="vdep-multicombo",
            title="DEP Screener",
            title_en="DEP Screener",
            kind=Questionnaire.KIND_SCREENING,
            target_condition_code="DEP-SCR",
            min_completion_percent=75,
            interpretation_schema={
                "bands": [
                    {"min_ratio": 0.72, "label": "high_risk", "title": "H", "recommendation": "h"},
                    {"min_ratio": 0.42, "label": "moderate_risk", "title": "M", "recommendation": "m"},
                    {"min_ratio": 0.0, "label": "low_risk", "title": "L", "recommendation": "l"},
                ]
            },
            approval_status=Questionnaire.APPROVAL_APPROVED,
        )
        for i in range(8):
            Question.objects.create(
                questionnaire=q_dep,
                order=i + 1,
                text=f"D{i}",
                qtype=Question.YESNO,
                score_yes=1,
                score_no=0,
                is_required=True,
            )
        Assessment.objects.create(
            patient=self.patient,
            questionnaire=self.questionnaire,
            doctor=self.doctor,
            total_score=6,
            completion_percent=100,
            interpretation={"label": "high_risk", "title": "High", "recommendation": "x"},
            conclusion="High",
        )
        Assessment.objects.create(
            patient=self.patient,
            questionnaire=q_dep,
            doctor=self.doctor,
            total_score=4,
            completion_percent=100,
            interpretation={"label": "moderate_risk", "title": "Mod", "recommendation": "y"},
            conclusion="Mod",
        )
        full = build_full_patient_recommendation_bundle(self.patient)
        combo_ids = [x["id"] for x in full["combined_items"]]
        self.assertIn("combo_multiple_questionnaire_elevated_v1", combo_ids)
        q_rows = [i for i in full["items"] if i.get("source_type") == "questionnaire"]
        self.assertEqual(
            len(q_rows),
            0,
            "Per-screen questionnaire items should be suppressed when the multi-screen synthesis rule applies.",
        )
        titles_in_recs = [t for t in full["patient_recommendations"] if "Скрининг апноэ сна" in t]
        self.assertEqual(
            len(titles_in_recs),
            0,
            "OSA singleton patient text must not repeat after suppression.",
        )
