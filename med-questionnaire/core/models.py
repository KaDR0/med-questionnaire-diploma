from django.db import models
from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone


class Disease(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=64, blank=True, default="")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Questionnaire(models.Model):
    KIND_SCREENING = "screening"
    KIND_SEVERITY = "severity"
    KIND_FOLLOWUP = "followup"

    KIND_CHOICES = [
        (KIND_SCREENING, "Screening"),
        (KIND_SEVERITY, "Severity"),
        (KIND_FOLLOWUP, "Follow-up"),
    ]

    disease = models.ForeignKey(Disease, on_delete=models.CASCADE, related_name="questionnaires")

    title = models.CharField(max_length=255, blank=True, default="")
    title_en = models.CharField(max_length=255, blank=True, default="")
    title_ru = models.CharField(max_length=255, blank=True, default="")
    title_kk = models.CharField(max_length=255, blank=True, default="")

    version = models.CharField(max_length=50, default="v1")

    description = models.TextField(blank=True, default="")
    description_en = models.TextField(blank=True, default="")
    description_ru = models.TextField(blank=True, default="")
    description_kk = models.TextField(blank=True, default="")

    is_active = models.BooleanField(default=True)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default=KIND_SCREENING)
    target_condition_code = models.CharField(max_length=64, blank=True, default="")
    interpretation_schema = models.JSONField(default=dict, blank=True)
    min_completion_percent = models.PositiveSmallIntegerField(default=70)
    source_name = models.CharField(max_length=255, blank=True, default="")
    source_url = models.URLField(blank=True, default="")
    source_type = models.CharField(max_length=100, blank=True, default="")
    medical_area = models.CharField(max_length=120, blank=True, default="")
    risk_target = models.CharField(max_length=255, blank=True, default="")
    scoring_method = models.TextField(blank=True, default="")
    interpretation_rules = models.TextField(blank=True, default="")
    evidence_note = models.TextField(blank=True, default="")
    is_standardized = models.BooleanField(default=False)
    APPROVAL_DRAFT = "draft"
    APPROVAL_PENDING = "pending_approval"
    APPROVAL_APPROVED = "approved"
    APPROVAL_REJECTED = "rejected"
    APPROVAL_CHANGES = "changes_requested"
    APPROVAL_ARCHIVED = "archived"
    APPROVAL_CHOICES = [
        (APPROVAL_DRAFT, "Draft"),
        (APPROVAL_PENDING, "Pending approval"),
        (APPROVAL_APPROVED, "Approved"),
        (APPROVAL_REJECTED, "Rejected"),
        (APPROVAL_CHANGES, "Changes requested"),
        (APPROVAL_ARCHIVED, "Archived"),
    ]
    approval_status = models.CharField(max_length=32, choices=APPROVAL_CHOICES, default=APPROVAL_DRAFT)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_questionnaires"
    )
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_questionnaires"
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    review_comment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        display_title = self.title_en or self.title_ru or self.title_kk or self.title
        return f"{self.disease.name} — {display_title} ({self.version})"


class Question(models.Model):
    YESNO = "yesno"
    SINGLE_CHOICE = "single_choice"
    NUMBER = "number"
    TEXT = "text"

    QUESTION_TYPES = [
        (YESNO, "Yes/No"),
        (SINGLE_CHOICE, "Single choice"),
        (NUMBER, "Number"),
        (TEXT, "Text"),
    ]

    questionnaire = models.ForeignKey(Questionnaire, on_delete=models.CASCADE, related_name="questions")
    order = models.PositiveSmallIntegerField()

    text = models.CharField(max_length=500, blank=True, default="")
    text_en = models.CharField(max_length=500, blank=True, default="")
    text_ru = models.CharField(max_length=500, blank=True, default="")
    text_kk = models.CharField(max_length=500, blank=True, default="")

    qtype = models.CharField(max_length=20, choices=QUESTION_TYPES, default=YESNO)
    is_required = models.BooleanField(default=True)
    options = models.JSONField(default=list, blank=True)

    score_yes = models.IntegerField(default=1)
    score_no = models.IntegerField(default=0)
    feature_key = models.CharField(max_length=64, blank=True, default="")
    red_flag_level = models.CharField(max_length=20, blank=True, default="")
    red_flag_message = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        unique_together = ("questionnaire", "order")
        ordering = ["order"]

    def __str__(self):
        display_text = self.text_en or self.text_ru or self.text_kk or self.text
        return f"Q{self.order}: {display_text}"


class Patient(models.Model):
    STATUS_STABLE = "stable"
    STATUS_MONITORING = "monitoring"
    STATUS_ATTENTION = "attention"
    STATUS_CRITICAL = "critical"

    STATUS_CHOICES = [
        (STATUS_STABLE, "Stable"),
        (STATUS_MONITORING, "Monitoring"),
        (STATUS_ATTENTION, "Attention"),
        (STATUS_CRITICAL, "Critical"),
    ]

    patient_code = models.CharField(max_length=12, unique=True, null=True, blank=True, verbose_name="Patient ID")
    full_name = models.CharField(max_length=255)

    age = models.IntegerField(null=True, blank=True)
    sex = models.IntegerField(null=True, blank=True)
    height_cm = models.FloatField(null=True, blank=True)
    weight_kg = models.FloatField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_MONITORING)
    next_visit_date = models.DateField(null=True, blank=True)

    data = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_patients"
    )
    assigned_doctor = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_patients"
    )
    updated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="updated_patients"
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.full_name


class DoctorOrder(models.Model):
    """Free-text doctor instructions for the patient; optional PDF export."""

    patient = models.OneToOneField(Patient, on_delete=models.CASCADE, related_name="doctor_order")
    order_text = models.TextField(blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Doctor order for {self.patient_id}"


class DoctorOrderRevision(models.Model):
    """Append-only history of doctor orders (stored in DB table `core_doctororderrevision`)."""

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="doctor_order_revisions")
    order_text = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"DoctorOrderRevision #{self.id} patient={self.patient_id}"


class Assessment(models.Model):
    QUALITY_VALID = "valid"
    QUALITY_PARTIAL = "partial"
    QUALITY_INVALID = "invalid"

    QUALITY_CHOICES = [
        (QUALITY_VALID, "Valid"),
        (QUALITY_PARTIAL, "Partial"),
        (QUALITY_INVALID, "Invalid"),
    ]

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="assessments")
    questionnaire = models.ForeignKey(Questionnaire, on_delete=models.PROTECT, related_name="assessments")
    doctor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    total_score = models.IntegerField(default=0)
    completion_percent = models.FloatField(default=0)
    quality_flag = models.CharField(max_length=20, choices=QUALITY_CHOICES, default=QUALITY_VALID)
    interpretation = models.JSONField(default=dict, blank=True)
    conclusion = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.patient} — {self.questionnaire} ({self.created_at.date()})"


class Answer(models.Model):
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(Question, on_delete=models.PROTECT)
    value = models.CharField(max_length=255)
    score = models.IntegerField(default=0)

    class Meta:
        unique_together = ("assessment", "question")

    def __str__(self):
        return f"{self.assessment_id} / {self.question_id}: {self.value}"


class LabIndicator(models.Model):
    CATEGORY_CHOICES = [
        ("metabolic", "Metabolic"),
        ("cardiovascular", "Cardiovascular"),
        ("inflammation", "Inflammation"),
        ("anemia", "Anemia"),
        ("renal", "Renal"),
        ("hepatic", "Hepatic"),
        ("mineral", "Mineral"),
        ("hormone", "Hormone"),
        ("vitamin", "Vitamin"),
        ("other", "Other"),
    ]

    code = models.CharField(max_length=64, blank=True, default="")
    standard_name = models.CharField(max_length=120, blank=True, default="")
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    synonyms = models.JSONField(default=list, blank=True)
    unit = models.CharField(max_length=20, blank=True)
    min_norm = models.FloatField(null=True, blank=True)
    max_norm = models.FloatField(null=True, blank=True)

    def __str__(self):
        return self.name


class LabResult(models.Model):
    patient = models.ForeignKey("Patient", on_delete=models.CASCADE)
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.patient} — {self.date}"


class LabValue(models.Model):
    result = models.ForeignKey(LabResult, on_delete=models.CASCADE, related_name="values")
    indicator = models.ForeignKey(LabIndicator, on_delete=models.CASCADE)
    value = models.FloatField()

    def __str__(self):
        return f"{self.indicator.name}: {self.value}"


class PatientNote(models.Model):
    CATEGORY_COMPLAINTS = "complaints"
    CATEGORY_DIAGNOSIS = "diagnosis"
    CATEGORY_RECOMMENDATIONS = "recommendations"
    CATEGORY_GENERAL = "general"
    CATEGORY_VISIT = "visit"
    CATEGORY_TREATMENT = "treatment"
    CATEGORY_LAB = "lab"

    CATEGORY_CHOICES = [
        (CATEGORY_COMPLAINTS, "Complaints"),
        (CATEGORY_DIAGNOSIS, "Diagnosis"),
        (CATEGORY_RECOMMENDATIONS, "Recommendations"),
        (CATEGORY_GENERAL, "General"),
        (CATEGORY_VISIT, "Visit"),
        (CATEGORY_TREATMENT, "Treatment"),
        (CATEGORY_LAB, "Lab"),
    ]

    patient = models.ForeignKey("Patient", on_delete=models.CASCADE, related_name="notes")
    doctor = models.ForeignKey("auth.User", on_delete=models.SET_NULL, null=True, blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default=CATEGORY_GENERAL)
    pinned = models.BooleanField(default=False)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["patient"],
                condition=Q(pinned=True),
                name="unique_pinned_note_per_patient",
            )
        ]

    def __str__(self):
        return f"Note for {self.patient.full_name} at {self.created_at:%d.%m.%Y %H:%M}"


class DoctorProfile(models.Model):
    ROLE_DOCTOR = "doctor"
    ROLE_CHIEF_DOCTOR = "chief_doctor"
    ROLE_CHOICES = [
        (ROLE_DOCTOR, "Doctor"),
        (ROLE_CHIEF_DOCTOR, "Chief doctor"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="doctor_profile")
    photo_data_url = models.TextField(blank=True, default="")
    specialty = models.CharField(max_length=120, blank=True, default="")
    department = models.CharField(max_length=120, blank=True, default="")
    workplace = models.CharField(max_length=160, blank=True, default="")
    experience_years = models.CharField(max_length=32, blank=True, default="")
    work_direction = models.CharField(max_length=160, blank=True, default="")
    competencies = models.TextField(blank=True, default="")
    phone = models.CharField(max_length=40, blank=True, default="")
    schedule = models.CharField(max_length=120, blank=True, default="")
    status = models.CharField(max_length=40, blank=True, default="")
    short_info = models.TextField(blank=True, default="")
    role = models.CharField(max_length=32, choices=ROLE_CHOICES, default=ROLE_DOCTOR)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Doctor profile: {self.user.username}"


class RecommendationTemplate(models.Model):
    template_id = models.CharField(max_length=64, unique=True)
    title = models.CharField(max_length=255)
    preliminary_conclusion = models.TextField()
    next_steps = models.TextField()
    disclaimer = models.TextField(
        default="Clinical decision support only. This output is not a final diagnosis."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.template_id


class PatientRiskProfile(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="risk_profiles")
    assessment = models.ForeignKey(
        Assessment, on_delete=models.SET_NULL, null=True, blank=True, related_name="risk_profiles"
    )
    overall_risk_level = models.CharField(max_length=20, default="low")
    summary = models.TextField(blank=True, default="")
    profile_data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Risk profile {self.patient_id} @ {self.created_at:%Y-%m-%d %H:%M}"


class RiskFinding(models.Model):
    risk_profile = models.ForeignKey(PatientRiskProfile, on_delete=models.CASCADE, related_name="findings")
    problem_code = models.CharField(max_length=64)
    risk_level = models.CharField(max_length=20)
    evidence = models.JSONField(default=list, blank=True)
    ml_probability = models.FloatField(null=True, blank=True)
    confidence_score = models.FloatField(null=True, blank=True)
    recommendation_template = models.ForeignKey(
        RecommendationTemplate, on_delete=models.SET_NULL, null=True, blank=True
    )

    def __str__(self):
        return f"{self.problem_code}: {self.risk_level}"


class RiskRedFlag(models.Model):
    risk_profile = models.ForeignKey(PatientRiskProfile, on_delete=models.CASCADE, related_name="red_flags")
    flag_code = models.CharField(max_length=32, blank=True, default="")
    urgency_level = models.CharField(max_length=20)
    trigger_signs = models.JSONField(default=list, blank=True)
    recommended_action = models.TextField()
    ml_probability = models.FloatField(null=True, blank=True)
    ml_confidence = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"{self.urgency_level} red flag"


class QuestionnaireSession(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_COMPLETED = "completed"
    STATUS_EXPIRED = "expired"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_EXPIRED, "Expired"),
    ]

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="questionnaire_sessions")
    questionnaire = models.ForeignKey(Questionnaire, on_delete=models.CASCADE, related_name="questionnaire_sessions")
    doctor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="questionnaire_sessions")
    token = models.CharField(max_length=128, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    used_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Session {self.id} for patient {self.patient_id}"


class AuditLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=128)
    object_type = models.CharField(max_length=64)
    object_id = models.CharField(max_length=64, blank=True, default="")
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.CharField(max_length=45, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.action} {self.object_type}:{self.object_id}"