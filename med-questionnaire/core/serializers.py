from rest_framework import serializers

from .models import (
    DoctorOrder,
    DoctorOrderRevision,
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
    QuestionnaireSession,
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

    class Meta:
        model = Questionnaire
        fields = "__all__"
        read_only_fields = ["approved_by", "approved_at", "created_by", "created_at", "updated_at"]

    def validate(self, attrs):
        title = (attrs.get("title") or "").strip()
        if not title:
            raise serializers.ValidationError({"title": "Title is required."})
        questions = attrs.get("questions", [])
        if not questions:
            raise serializers.ValidationError({"questions": "At least one question is required."})
        if attrs.get("is_standardized"):
            if not (attrs.get("source_name") or "").strip():
                raise serializers.ValidationError({"source_name": "Source name is required for standardized questionnaires."})
            if not (attrs.get("source_url") or "").strip():
                raise serializers.ValidationError({"source_url": "Source URL is required for standardized questionnaires."})
        return attrs

    def create(self, validated_data):
        questions_data = validated_data.pop("questions", [])
        questionnaire = Questionnaire.objects.create(**validated_data)
        for question_data in questions_data:
            Question.objects.create(questionnaire=questionnaire, **question_data)
        return questionnaire

    def update(self, instance, validated_data):
        questions_data = validated_data.pop("questions", None)
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
        return obj.question.text_en or obj.question.text_ru or obj.question.text_kk or obj.question.text

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
        questionnaire = obj.questionnaire
        return (
            questionnaire.title_en
            or questionnaire.title_ru
            or questionnaire.title_kk
            or questionnaire.title
        )

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
        fields = ["next_visit_date", "age", "sex", "height_cm", "weight_kg"]


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


class QuestionnaireSessionCreateSerializer(serializers.Serializer):
    patient_id = serializers.IntegerField()
    questionnaire_id = serializers.IntegerField()


class QuestionnaireSessionSerializer(serializers.ModelSerializer):
    questionnaire_title = serializers.SerializerMethodField()

    def get_questionnaire_title(self, obj):
        questionnaire = obj.questionnaire
        return questionnaire.title_en or questionnaire.title_ru or questionnaire.title_kk or questionnaire.title

    class Meta:
        model = QuestionnaireSession
        fields = "__all__"