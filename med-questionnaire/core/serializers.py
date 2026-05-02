import logging

from django.contrib.auth.models import User
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers

logger = logging.getLogger(__name__)

from .permissions import permitted_patients_queryset
from .models import (
    DoctorOrder,
    DoctorOrderRevision,
    DoctorProfile,
    Disease,
    Patient,
    Questionnaire,
    Question,
    Assessment,
    Answer,
    LabIndicator,
    LabResult,
    LabValue,
    PatientNote,
    PatientRiskProfile,
    RiskFinding,
    RiskRedFlag,
    QuestionnaireAssignment,
)


def _preferred_lang(serializer_obj):
    request = serializer_obj.context.get("request") if hasattr(serializer_obj, "context") else None
    raw = ""
    if request is not None:
        raw = request.headers.get("Accept-Language", "") or ""
    normalized = raw.split(",")[0].strip().lower()
    if normalized.startswith("ru"):
        return "ru"
    if normalized.startswith("kk"):
        return "kk"
    return "en"


def _localized_value(obj, base_field, lang):
    if lang == "ru":
        return (
            getattr(obj, f"{base_field}_ru", None)
            or getattr(obj, f"{base_field}_en", None)
            or getattr(obj, f"{base_field}_kk", None)
            or getattr(obj, base_field, None)
        )
    if lang == "kk":
        return (
            getattr(obj, f"{base_field}_kk", None)
            or getattr(obj, f"{base_field}_en", None)
            or getattr(obj, f"{base_field}_ru", None)
            or getattr(obj, base_field, None)
        )
    return (
        getattr(obj, f"{base_field}_en", None)
        or getattr(obj, f"{base_field}_ru", None)
        or getattr(obj, f"{base_field}_kk", None)
        or getattr(obj, base_field, None)
    )


class PatientSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    doctor_order_text = serializers.SerializerMethodField()

    def get_doctor_order_text(self, obj):
        row = DoctorOrder.objects.filter(patient_id=obj.id).only("order_text").first()
        return row.order_text if row else ""

    class Meta:
        model = Patient
        fields = "__all__"
        extra_kwargs = {
            "patient_code": {"validators": []},
        }

    def validate_patient_code(self, value):
        patient_code = (value or "").strip()
        if not patient_code:
            return value
        queryset = Patient.objects.filter(patient_code=patient_code)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Пациент с таким ID уже существует.")
        return patient_code


class QuestionnaireSerializer(serializers.ModelSerializer):
    disease_name = serializers.CharField(source="disease.name", read_only=True)
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    questions = serializers.SerializerMethodField()

    def get_questions(self, obj):
        return QuestionSerializer(obj.questions.all().order_by("order"), many=True).data

    class Meta:
        model = Questionnaire
        fields = '__all__'
        read_only_fields = ["approved_by", "approved_at", "created_by"]


class QuestionWriteSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = Question
        fields = [
            "id",
            "order",
            "text",
            "text_en",
            "text_ru",
            "text_kk",
            "qtype",
            "is_required",
            "options",
            "score_yes",
            "score_no",
            "feature_key",
            "red_flag_level",
            "red_flag_message",
        ]

    def validate(self, attrs):
        qtype = attrs.get("qtype", getattr(self.instance, "qtype", Question.YESNO))
        options = attrs.get("options", getattr(self.instance, "options", []))
        if qtype == Question.SINGLE_CHOICE:
            if not isinstance(options, list) or len(options) < 2:
                raise serializers.ValidationError({"options": "Single choice question must have at least 2 options."})
            for option in options:
                if "text" not in option:
                    raise serializers.ValidationError({"options": "Each option must contain text."})
                try:
                    int(option.get("score", 0))
                except (TypeError, ValueError):
                    raise serializers.ValidationError({"options": "Option score must be a number."})
        return attrs


class QuestionnaireWriteSerializer(serializers.ModelSerializer):
    questions = QuestionWriteSerializer(many=True)
    disease_name = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Questionnaire
        fields = "__all__"
        read_only_fields = ["approved_by", "approved_at", "created_by", "created_at", "updated_at"]
        extra_kwargs = {
            "disease": {"required": False, "allow_null": True},
        }

    def validate(self, attrs):
        title = (attrs.get("title") or "").strip()
        if not title:
            raise serializers.ValidationError({"title": "Title is required."})
        disease_name = (attrs.get("disease_name") or "").strip()
        current_disease = attrs.get("disease", getattr(self.instance, "disease", None))
        if current_disease is None and not disease_name:
            raise serializers.ValidationError({"disease_name": "Disease is required."})
        questions = attrs.get("questions", [])
        if not questions:
            raise serializers.ValidationError({"questions": "At least one question is required."})
        if attrs.get("is_standardized"):
            if not (attrs.get("source_name") or "").strip():
                raise serializers.ValidationError({"source_name": "Source name is required for standardized questionnaires."})
            if not (attrs.get("source_url") or "").strip():
                raise serializers.ValidationError({"source_url": "Source URL is required for standardized questionnaires."})
        return attrs

    def _resolve_disease(self, validated_data, instance=None):
        disease_name = (validated_data.pop("disease_name", "") or "").strip()
        disease = validated_data.get("disease", instance.disease if instance else None)
        if disease_name:
            disease = Disease.objects.filter(name__iexact=disease_name).first()
            if disease is None:
                disease = Disease.objects.create(name=disease_name, is_active=True)
            validated_data["disease"] = disease
            return
        if disease is not None:
            validated_data["disease"] = disease

    def create(self, validated_data):
        questions_data = validated_data.pop("questions", [])
        self._resolve_disease(validated_data)
        questionnaire = Questionnaire.objects.create(**validated_data)
        for question_data in questions_data:
            Question.objects.create(questionnaire=questionnaire, **question_data)
        return questionnaire

    def update(self, instance, validated_data):
        questions_data = validated_data.pop("questions", None)
        self._resolve_disease(validated_data, instance=instance)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if questions_data is not None:
            existing_questions = {question.id: question for question in instance.questions.all()}
            kept_ids = set()
            for question_data in questions_data:
                question_id = question_data.pop("id", None)
                if question_id and question_id in existing_questions:
                    question = existing_questions[question_id]
                    for key, value in question_data.items():
                        setattr(question, key, value)
                    question.save()
                    kept_ids.add(question.id)
                else:
                    question = Question.objects.create(questionnaire=instance, **question_data)
                    kept_ids.add(question.id)
            instance.questions.exclude(id__in=kept_ids).delete()
        return instance


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = '__all__'


class AnswerSerializer(serializers.ModelSerializer):
    question_text = serializers.SerializerMethodField()

    def get_question_text(self, obj):
        lang = _preferred_lang(self)
        return _localized_value(obj.question, "text", lang)

    class Meta:
        model = Answer
        fields = '__all__'


class AssessmentSerializer(serializers.ModelSerializer):
    answers = AnswerSerializer(many=True, read_only=True)
    questionnaire_title = serializers.SerializerMethodField()
    doctor_username = serializers.CharField(source="doctor.username", read_only=True)
    doctor_full_name = serializers.SerializerMethodField()
    quality_flag_label = serializers.CharField(source="get_quality_flag_display", read_only=True)

    def get_questionnaire_title(self, obj):
        lang = _preferred_lang(self)
        return _localized_value(obj.questionnaire, "title", lang)

    def get_doctor_full_name(self, obj):
        if not obj.doctor:
            return ""
        full_name = f"{obj.doctor.first_name} {obj.doctor.last_name}".strip()
        return full_name or obj.doctor.username

    class Meta:
        model = Assessment
        fields = '__all__'


class LabValueSerializer(serializers.ModelSerializer):
    indicator_name = serializers.CharField(source="indicator.name", read_only=True)
    indicator_unit = serializers.CharField(source="indicator.unit", read_only=True)
    min_norm = serializers.FloatField(source="indicator.min_norm", read_only=True)
    max_norm = serializers.FloatField(source="indicator.max_norm", read_only=True)
    status = serializers.SerializerMethodField()
    status_text = serializers.SerializerMethodField()
    clinical_status = serializers.SerializerMethodField()

    def get_status(self, obj):
        min_norm = obj.indicator.min_norm
        max_norm = obj.indicator.max_norm

        if min_norm is not None and obj.value < min_norm:
            return "below"
        if max_norm is not None and obj.value > max_norm:
            return "above"
        return "normal"

    def get_status_text(self, obj):
        status = self.get_status(obj)
        labels = {
            "below": "Below norm",
            "above": "Above norm",
            "normal": "Normal",
        }
        return labels[status]

    def get_clinical_status(self, obj):
        min_norm = obj.indicator.min_norm
        max_norm = obj.indicator.max_norm
        value = obj.value
        if min_norm is None and max_norm is None:
            return "normal"
        if min_norm is not None and value < min_norm:
            if min_norm and value <= min_norm * 0.8:
                return "critical"
            return "low"
        if max_norm is not None and value > max_norm:
            if max_norm and value >= max_norm * 1.2:
                return "critical"
            return "high"
        return "normal"

    class Meta:
        model = LabValue
        fields = '__all__'


class LabResultSerializer(serializers.ModelSerializer):
    values = LabValueSerializer(many=True, read_only=True)

    class Meta:
        model = LabResult
        fields = '__all__'


class LabIndicatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabIndicator
        fields = "__all__"


class LabValueUpdateSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    indicator = serializers.IntegerField(required=False)
    value = serializers.FloatField()


class LabResultUpdateSerializer(serializers.ModelSerializer):
    values = LabValueUpdateSerializer(many=True)

    class Meta:
        model = LabResult
        fields = ["date", "values"]


class PatientNoteSerializer(serializers.ModelSerializer):
    doctor_username = serializers.CharField(source="doctor.username", read_only=True)
    doctor_full_name = serializers.SerializerMethodField()
    category_label = serializers.CharField(source="get_category_display", read_only=True)

    def get_doctor_full_name(self, obj):
        if not obj.doctor:
            return ""
        full_name = f"{obj.doctor.first_name} {obj.doctor.last_name}".strip()
        return full_name or obj.doctor.username

    class Meta:
        model = PatientNote
        fields = '__all__'


class PatientStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = ["next_visit_date", "age", "sex", "height_cm", "weight_kg", "email"]

    def validate_email(self, value):
        if value in (None, ""):
            if self.instance and self.instance.user_id:
                raise serializers.ValidationError("Email cannot be empty for a linked patient account.")
            return value
        normalized = str(value).strip().lower()
        if self.instance and self.instance.user_id:
            if User.objects.filter(email__iexact=normalized).exclude(id=self.instance.user_id).exists():
                raise serializers.ValidationError("This email is already in use by another account.")
        return normalized

    def update(self, instance, validated_data):
        # Keep auth.User.email in sync when staff edits Patient.email (login uses User.email).
        new_email = validated_data.get("email", serializers.empty)
        if new_email is not serializers.empty and instance.user_id and new_email:
            u = instance.user
            u.email = new_email
            u.save(update_fields=["email"])
        return super().update(instance, validated_data)


class DoctorOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = DoctorOrder
        fields = ["order_text", "updated_at"]
        read_only_fields = ["updated_at"]


class DoctorOrderRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DoctorOrderRevision
        fields = ["id", "order_text", "created_at"]
        read_only_fields = ["id", "order_text", "created_at"]


class PatientIntakeSerializer(serializers.Serializer):
    chief_complaint = serializers.CharField(allow_blank=True, required=False)
    chronic_conditions = serializers.CharField(allow_blank=True, required=False)
    medications = serializers.CharField(allow_blank=True, required=False)
    allergies = serializers.CharField(allow_blank=True, required=False)
    family_history = serializers.CharField(allow_blank=True, required=False)
    habits = serializers.CharField(allow_blank=True, required=False)
    blood_pressure = serializers.CharField(allow_blank=True, required=False)
    temperature = serializers.CharField(allow_blank=True, required=False)

    def update(self, instance, validated_data):
        data = instance.data or {}
        intake = data.get("intake", {})
        intake.update(validated_data)
        data["intake"] = intake
        instance.data = data
        instance.save(update_fields=["data"])
        return instance

    def create(self, validated_data):
        raise NotImplementedError


class PatientNoteCreateUpdateSerializer(serializers.ModelSerializer):
    doctor_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = PatientNote
        fields = ["text", "category", "pinned", "doctor_id"]


class RiskFindingSerializer(serializers.ModelSerializer):
    recommendation = serializers.SerializerMethodField()

    def get_recommendation(self, obj):
        if not obj.recommendation_template:
            return None
        tpl = obj.recommendation_template
        return {
            "template_id": tpl.template_id,
            "title": tpl.title,
            "preliminary_conclusion": tpl.preliminary_conclusion,
            "next_steps": tpl.next_steps,
            "disclaimer": tpl.disclaimer,
        }

    class Meta:
        model = RiskFinding
        fields = "__all__"


class RiskRedFlagSerializer(serializers.ModelSerializer):
    class Meta:
        model = RiskRedFlag
        fields = "__all__"


class PatientRiskProfileSerializer(serializers.ModelSerializer):
    findings = RiskFindingSerializer(many=True, read_only=True)
    red_flags = RiskRedFlagSerializer(many=True, read_only=True)

    class Meta:
        model = PatientRiskProfile
        fields = "__all__"


class QuestionnaireAssignmentSerializer(serializers.ModelSerializer):
    """Doctor-assigned questionnaires: duplicate active rows prevented by DB + validate()."""

    status_label = serializers.CharField(source="get_status_display", read_only=True)
    assigned_by_username = serializers.CharField(source="assigned_by.username", read_only=True)
    questionnaire_title = serializers.SerializerMethodField()
    assessment_summary = serializers.SerializerMethodField()

    def get_questionnaire_title(self, obj):
        lang = _preferred_lang(self)
        return _localized_value(obj.questionnaire, "title", lang)

    def get_assessment_summary(self, obj):
        a = obj.result_assessment
        if not a:
            return None
        interpretation = a.interpretation if isinstance(a.interpretation, dict) else {}
        return {
            "id": a.id,
            "total_score": a.total_score,
            "conclusion": a.conclusion or "",
            "interpretation": interpretation,
            "created_at": a.created_at,
        }

    def validate_patient(self, value):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")
        if not permitted_patients_queryset(request).filter(pk=value.pk).exists():
            raise serializers.ValidationError("Patient not found or access denied.")
        return value

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        patient = attrs.get("patient", instance.patient if instance else None)
        questionnaire = attrs.get("questionnaire", instance.questionnaire if instance else None)
        default_status = instance.status if instance else QuestionnaireAssignment.STATUS_ASSIGNED
        status_val = attrs.get("status", default_status)
        if patient is None or questionnaire is None:
            return attrs
        if status_val in QuestionnaireAssignment.ACTIVE_STATUSES:
            qs = QuestionnaireAssignment.objects.filter(
                patient=patient,
                questionnaire=questionnaire,
                status__in=QuestionnaireAssignment.ACTIVE_STATUSES,
            )
            if instance is not None:
                qs = qs.exclude(pk=instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "An active assignment already exists for this patient and questionnaire."
                )
        return attrs

    class Meta:
        model = QuestionnaireAssignment
        fields = [
            "id",
            "patient",
            "questionnaire",
            "questionnaire_title",
            "assigned_by",
            "assigned_by_username",
            "assigned_at",
            "status",
            "status_label",
            "due_date",
            "note",
            "completed_at",
            "result_assessment",
            "assessment_summary",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "assigned_by",
            "assigned_by_username",
            "assigned_at",
            "completed_at",
            "result_assessment",
            "updated_at",
        ]

    def create(self, validated_data):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")
        user = request.user
        profile = getattr(user, "doctor_profile", None)
        if not profile or profile.role not in (
            DoctorProfile.ROLE_DOCTOR,
            DoctorProfile.ROLE_CHIEF_DOCTOR,
        ):
            raise serializers.ValidationError(
                "Only a doctor or chief doctor can assign questionnaires."
            )
        validated_data["assigned_by"] = user
        return super().create(validated_data)


class QuestionnaireAssignmentCreateSerializer(serializers.Serializer):
    """POST body: patient_id, questionnaire_id, optional due_date and comment (stored as note)."""

    patient_id = serializers.IntegerField()
    questionnaire_id = serializers.IntegerField()
    due_date = serializers.DateField(required=False, allow_null=True)
    comment = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        request = self.context["request"]
        patient = get_object_or_404(permitted_patients_queryset(request), pk=attrs["patient_id"])
        questionnaire = get_object_or_404(Questionnaire, pk=attrs["questionnaire_id"])
        if questionnaire.approval_status == Questionnaire.APPROVAL_ARCHIVED:
            raise serializers.ValidationError(
                {"questionnaire_id": "Cannot assign an archived questionnaire."}
            )
        if not questionnaire.is_active:
            raise serializers.ValidationError({"questionnaire_id": "Questionnaire is not active."})
        if (
            QuestionnaireAssignment.objects.filter(
                patient=patient,
                questionnaire=questionnaire,
                status__in=QuestionnaireAssignment.ACTIVE_STATUSES,
            ).exists()
        ):
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "An active assignment already exists for this patient and questionnaire."
                    ]
                }
            )
        attrs["_patient"] = patient
        attrs["_questionnaire"] = questionnaire
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        instance = QuestionnaireAssignment.objects.create(
            patient=validated_data["_patient"],
            questionnaire=validated_data["_questionnaire"],
            assigned_by=request.user,
            status=QuestionnaireAssignment.STATUS_ASSIGNED,
            due_date=validated_data.get("due_date"),
            note=validated_data.get("comment", ""),
        )

        def _notify_after_commit():
            try:
                from .assignment_mail import send_questionnaire_assignment_notification

                send_questionnaire_assignment_notification(instance)
            except Exception:
                logger.exception(
                    "Unexpected error while sending questionnaire assignment notification (assignment_id=%s)",
                    getattr(instance, "pk", None),
                )

        # Runs after DB commit: assignment stays persisted even if mail fails or outer atomic rolls back.
        transaction.on_commit(_notify_after_commit)
        return instance