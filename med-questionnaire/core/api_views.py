from datetime import date, timedelta
import secrets

from django.http import FileResponse
from django.contrib.auth.models import User
from django.db import models, transaction
from django.db.models import Case, IntegerField, Value, When
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from .models import (
    Disease,
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
    QuestionnaireSession,
    AuditLog,
    DoctorProfile,
)
from .serializers import (
    DoctorOrderRevisionSerializer,
    DoctorOrderSerializer,
    PatientSerializer,
    PatientStatusUpdateSerializer,
    PatientIntakeSerializer,
    QuestionnaireSerializer,
    QuestionnaireWriteSerializer,
    QuestionSerializer,
    AssessmentSerializer,
    LabIndicatorSerializer,
    LabResultSerializer,
    LabResultUpdateSerializer,
    PatientNoteSerializer,
    PatientNoteCreateUpdateSerializer,
    PatientRiskProfileSerializer,
    QuestionnaireSessionCreateSerializer,
    QuestionnaireSessionSerializer,
)
from .services import (
    build_assessment_pdf,
    build_doctor_order_pdf,
    build_patient_report_pdf,
    calculate_and_save_assessment,
    create_lab_template_workbook,
    create_patient_template_workbook,
    import_labs_from_excel,
    import_patients_from_excel,
)
from .risk_engine import calculate_and_store_risk_profile
from .patient_clinical_status import refresh_patient_clinical_status
from .permissions import IsDoctorOrAbove, IsChiefDoctorOrAdmin, get_user_role


def _client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _audit(request, action, object_type, object_id="", details=None):
    AuditLog.objects.create(
        user=request.user if getattr(request.user, "is_authenticated", False) else None,
        action=action,
        object_type=object_type,
        object_id=str(object_id or ""),
        details=details or {},
        ip_address=_client_ip(request),
    )


def _permitted_patient_queryset(request):
    role = get_user_role(request.user)
    queryset = Patient.objects.all()
    if role == DoctorProfile.ROLE_DOCTOR:
        return queryset.filter(
            models.Q(assigned_doctor=request.user)
            | models.Q(created_by=request.user)
        )
    return queryset


def _get_permitted_patient_or_404(request, patient_id):
    return generics.get_object_or_404(_permitted_patient_queryset(request), pk=patient_id)


class PatientListAPIView(generics.ListCreateAPIView):
    serializer_class = PatientSerializer

    def get_queryset(self):
        base_queryset = _permitted_patient_queryset(self.request)
        far_future = Value(date(2099, 12, 31), output_field=models.DateField())
        return (
            base_queryset.annotate(
                _urg_rank=Case(
                    When(status=Patient.STATUS_CRITICAL, then=Value(0)),
                    When(status=Patient.STATUS_ATTENTION, then=Value(1)),
                    When(status=Patient.STATUS_MONITORING, then=Value(2)),
                    When(status=Patient.STATUS_STABLE, then=Value(3)),
                    default=Value(2),
                    output_field=IntegerField(),
                ),
                _visit_sort=Coalesce("next_visit_date", far_future),
            )
            .order_by("_urg_rank", "_visit_sort", "-id")
        )

    def perform_create(self, serializer):
        role = get_user_role(self.request.user)
        assigned_doctor = None
        if role == DoctorProfile.ROLE_DOCTOR:
            assigned_doctor = self.request.user
        elif role == DoctorProfile.ROLE_CHIEF_DOCTOR:
            assigned_doctor_id = self.request.data.get("assigned_doctor")
            if assigned_doctor_id:
                assigned_doctor = User.objects.filter(id=assigned_doctor_id).first()
            else:
                assigned_doctor = self.request.user
        instance = serializer.save(
            created_by=self.request.user if self.request.user.is_authenticated else None,
            updated_by=self.request.user if self.request.user.is_authenticated else None,
            assigned_doctor=assigned_doctor,
        )
        _audit(self.request, "patient_created", "Patient", instance.id, {"patient_code": instance.patient_code})
        refresh_patient_clinical_status(instance.id)


class PatientDetailAPIView(generics.RetrieveAPIView):
    serializer_class = PatientSerializer

    def get_queryset(self):
        return _permitted_patient_queryset(self.request)


class PatientPdfAPIView(APIView):
    def get(self, request, pk):
        patient = generics.get_object_or_404(
            _permitted_patient_queryset(request).select_related("doctor_order").prefetch_related(
                "assessments__questionnaire",
                "labresult_set__values__indicator",
                "notes__doctor",
            ),
            pk=pk,
        )
        pdf_file = build_patient_report_pdf(patient)
        return FileResponse(
            pdf_file,
            as_attachment=True,
            filename=f"patient_{patient.id}_report.pdf",
            content_type="application/pdf",
        )


class PatientUpdateAPIView(generics.UpdateAPIView):
    serializer_class = PatientStatusUpdateSerializer

    def get_queryset(self):
        return _permitted_patient_queryset(self.request)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        instance.updated_by = request.user if request.user.is_authenticated else None
        instance.save(update_fields=["updated_by", "updated_at"])
        refresh_patient_clinical_status(instance.pk)
        instance.refresh_from_db()
        return Response(PatientSerializer(instance).data)


class PatientIntakeAPIView(APIView):
    def patch(self, request, pk):
        patient = _get_permitted_patient_or_404(request, pk)
        serializer = PatientIntakeSerializer(instance=patient, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(patient.data.get("intake", {}))


class QuestionnaireListAPIView(generics.ListCreateAPIView):
    serializer_class = QuestionnaireSerializer

    def get_queryset(self):
        role = get_user_role(self.request.user)
        queryset = Questionnaire.objects.exclude(approval_status=Questionnaire.APPROVAL_ARCHIVED).order_by("id")
        if role == DoctorProfile.ROLE_CHIEF_DOCTOR:
            return queryset
        return queryset.filter(
            models.Q(approval_status=Questionnaire.APPROVAL_APPROVED, is_active=True)
            | models.Q(created_by=self.request.user)
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return QuestionnaireWriteSerializer
        return QuestionnaireSerializer

    def perform_create(self, serializer):
        disease = serializer.validated_data.get("disease")
        if disease is None:
            disease, _ = Disease.objects.get_or_create(
                code="general_screening",
                defaults={"name": "General screening"},
            )
        questionnaire = serializer.save(
            created_by=self.request.user,
            approval_status=Questionnaire.APPROVAL_DRAFT,
            disease=disease,
        )
        _audit(
            self.request,
            "questionnaire_created",
            "Questionnaire",
            questionnaire.id,
            {"title": questionnaire.title, "approval_status": questionnaire.approval_status},
        )


class QuestionnaireQuestionsAPIView(APIView):
    def get(self, request, questionnaire_id):
        questions = Question.objects.filter(questionnaire_id=questionnaire_id).order_by("order")
        serializer = QuestionSerializer(questions, many=True)
        return Response(serializer.data)


class PatientAssessmentsAPIView(APIView):
    def get(self, request, patient_id):
        _get_permitted_patient_or_404(request, patient_id)
        assessments = Assessment.objects.filter(patient_id=patient_id).order_by("-created_at")
        serializer = AssessmentSerializer(assessments, many=True)
        return Response(serializer.data)


class PatientAssessmentTrendAPIView(APIView):
    def get(self, request, patient_id):
        _get_permitted_patient_or_404(request, patient_id)
        assessments = Assessment.objects.filter(patient_id=patient_id).order_by("created_at", "id")
        serializer = AssessmentSerializer(assessments, many=True)
        history = serializer.data
        scores = [item["total_score"] for item in history]

        return Response(
            {
                "history": history,
                "chart_points": [
                    {
                        "assessment_id": item["id"],
                        "label": item["created_at"],
                        "total_score": item["total_score"],
                        "questionnaire_title": item.get("questionnaire_title"),
                        "conclusion": item.get("conclusion"),
                    }
                    for item in history
                ],
                "stats": {
                    "count": len(history),
                    "max_score": max(scores) if scores else 0,
                    "min_score": min(scores) if scores else 0,
                    "latest_score": scores[-1] if scores else 0,
                },
            }
        )


class AssessmentDetailAPIView(generics.RetrieveAPIView):
    queryset = Assessment.objects.all()
    serializer_class = AssessmentSerializer

    def get_queryset(self):
        role = get_user_role(self.request.user)
        queryset = Assessment.objects.all()
        if role == DoctorProfile.ROLE_DOCTOR:
            return queryset.filter(
                models.Q(patient__assigned_doctor=self.request.user)
                | models.Q(patient__created_by=self.request.user)
            )
        return queryset


class PatientRiskProfileAPIView(APIView):
    def get(self, request, patient_id):
        _get_permitted_patient_or_404(request, patient_id)
        profile = (
            PatientRiskProfile.objects.filter(patient_id=patient_id)
            .prefetch_related("findings__recommendation_template", "red_flags")
            .order_by("-created_at")
            .first()
        )
        if not profile:
            profile = calculate_and_store_risk_profile(patient_id)
        serializer = PatientRiskProfileSerializer(profile)
        return Response(serializer.data)

    def post(self, request, patient_id):
        _get_permitted_patient_or_404(request, patient_id)
        profile = calculate_and_store_risk_profile(patient_id)
        serializer = PatientRiskProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PatientRiskHistoryAPIView(APIView):
    def get(self, request, patient_id):
        _get_permitted_patient_or_404(request, patient_id)
        profiles = (
            PatientRiskProfile.objects.filter(patient_id=patient_id)
            .prefetch_related("findings", "red_flags")
            .order_by("created_at", "id")
        )
        chart_points = []
        for profile in profiles:
            findings = list(profile.findings.all())
            chart_points.append(
                {
                    "id": profile.id,
                    "label": profile.created_at.isoformat(),
                    "overall_risk_level": profile.overall_risk_level,
                    "findings_count": len(findings),
                    "red_flags_count": profile.red_flags.count(),
                    "metabolic_count": sum(1 for f in findings if "metabolic" in f.problem_code),
                    "cardiovascular_count": sum(1 for f in findings if "cardio" in f.problem_code),
                    "anemia_count": sum(1 for f in findings if "anemia" in f.problem_code),
                    "psycho_count": sum(1 for f in findings if "psycho" in f.problem_code),
                }
            )
        return Response(
            {
                "chart_points": chart_points,
                "stats": {
                    "count": len(chart_points),
                    "latest_level": chart_points[-1]["overall_risk_level"] if chart_points else "low",
                },
            }
        )


class AssessmentRiskProfileAPIView(APIView):
    def get(self, request, pk):
        assessment = generics.get_object_or_404(Assessment, pk=pk)
        _get_permitted_patient_or_404(request, assessment.patient_id)
        profile = (
            PatientRiskProfile.objects.filter(patient_id=assessment.patient_id)
            .prefetch_related("findings__recommendation_template", "red_flags")
            .order_by("-created_at")
            .first()
        )
        if not profile:
            profile = calculate_and_store_risk_profile(assessment.patient_id)
        serializer = PatientRiskProfileSerializer(profile)
        return Response(serializer.data)


class AssessmentPdfAPIView(APIView):
    def get(self, request, pk):
        assessment = generics.get_object_or_404(
            Assessment.objects.select_related("patient", "questionnaire", "doctor").prefetch_related("answers__question"),
            pk=pk,
        )
        _get_permitted_patient_or_404(request, assessment.patient_id)
        pdf_file = build_assessment_pdf(assessment)
        return FileResponse(
            pdf_file,
            as_attachment=True,
            filename=f"assessment_{assessment.id}.pdf",
            content_type="application/pdf",
        )


def _apply_lab_period_filter(queryset, period):
    field_name = "result__date" if queryset.model is LabValue else "date"

    if period == "week":
        return queryset.filter(**{f"{field_name}__gte": timezone.localdate() - timedelta(days=7)})
    if period == "month":
        return queryset.filter(**{f"{field_name}__gte": timezone.localdate() - timedelta(days=30)})
    return queryset


class PatientLabResultsAPIView(APIView):
    def get(self, request, patient_id):
        _get_permitted_patient_or_404(request, patient_id)
        period = request.query_params.get("period", "all")
        indicator_name = request.query_params.get("indicator")
        indicator_id = request.query_params.get("indicator_id")

        labs = LabResult.objects.filter(patient_id=patient_id)
        labs = _apply_lab_period_filter(labs, period)

        if indicator_id:
            labs = labs.filter(values__indicator_id=indicator_id)
        elif indicator_name:
            labs = labs.filter(values__indicator__name=indicator_name)

        labs = labs.prefetch_related("values__indicator").distinct().order_by("-date", "-id")
        serializer = LabResultSerializer(labs, many=True)
        return Response(serializer.data)


class PatientLabTrendAPIView(APIView):
    def get(self, request, patient_id):
        _get_permitted_patient_or_404(request, patient_id)
        period = request.query_params.get("period", "all")
        indicator_name = request.query_params.get("indicator")
        indicator_id = request.query_params.get("indicator_id")

        indicator_options = list(
            LabIndicator.objects.filter(labvalue__result__patient_id=patient_id)
            .distinct()
            .order_by("name")
            .values("id", "name", "unit", "category")
        )

        trend_queryset = LabValue.objects.filter(result__patient_id=patient_id)
        trend_queryset = _apply_lab_period_filter(trend_queryset, period)

        if indicator_id:
            trend_queryset = trend_queryset.filter(indicator_id=indicator_id)
        elif indicator_name:
            trend_queryset = trend_queryset.filter(indicator__name=indicator_name)

        trend_queryset = trend_queryset.select_related("indicator", "result").order_by("result__date", "id")

        chart_points = [
            {
                "id": value.id,
                "date": value.result.date,
                "label": value.result.date.isoformat(),
                "indicator_name": value.indicator.name,
                "indicator_unit": value.indicator.unit,
                "value": value.value,
                "min_norm": value.indicator.min_norm,
                "max_norm": value.indicator.max_norm,
            }
            for value in trend_queryset
        ]

        values = [point["value"] for point in chart_points]

        return Response(
            {
                "indicator_options": indicator_options,
                "selected_indicator": indicator_name or "",
                "selected_period": period,
                "chart_points": chart_points,
                "stats": {
                    "count": len(chart_points),
                    "latest_value": values[-1] if values else None,
                    "min_value": min(values) if values else None,
                    "max_value": max(values) if values else None,
                },
            }
        )


class LabIndicatorListAPIView(APIView):
    def get(self, request):
        indicators = LabIndicator.objects.all().order_by("category", "name")
        serializer = LabIndicatorSerializer(indicators, many=True)
        return Response(serializer.data)


class DiseaseListAPIView(APIView):
    def get(self, request):
        diseases = Disease.objects.filter(is_active=True).order_by("name")
        return Response([{"id": disease.id, "name": disease.name, "code": disease.code} for disease in diseases])


class PatientLabResultDetailAPIView(APIView):
    def patch(self, request, patient_id, lab_result_id):
        _get_permitted_patient_or_404(request, patient_id)
        lab_result = generics.get_object_or_404(
            LabResult.objects.prefetch_related("values"),
            id=lab_result_id,
            patient_id=patient_id,
        )
        serializer = LabResultUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        values_data = serializer.validated_data.get("values", [])
        date_value = serializer.validated_data.get("date")

        with transaction.atomic():
            if date_value:
                lab_result.date = date_value
                lab_result.save(update_fields=["date"])

            existing_values = {value.id: value for value in lab_result.values.all()}
            seen_ids = set()

            for item in values_data:
                value_id = item.get("id")
                if value_id and value_id in existing_values:
                    lab_value = existing_values[value_id]
                    lab_value.value = item["value"]
                    lab_value.save(update_fields=["value"])
                    seen_ids.add(value_id)
                    continue

                indicator_id = item.get("indicator")
                if indicator_id:
                    lab_value, _ = LabValue.objects.update_or_create(
                        result=lab_result,
                        indicator_id=indicator_id,
                        defaults={"value": item["value"]},
                    )
                    seen_ids.add(lab_value.id)

            LabValue.objects.filter(result=lab_result, id__in=existing_values.keys()).exclude(id__in=seen_ids).delete()

        lab_result = LabResult.objects.prefetch_related("values__indicator").get(id=lab_result.id)
        refresh_patient_clinical_status(patient_id)
        return Response(LabResultSerializer(lab_result).data)

    def delete(self, request, patient_id, lab_result_id):
        _get_permitted_patient_or_404(request, patient_id)
        lab_result = generics.get_object_or_404(LabResult, id=lab_result_id, patient_id=patient_id)
        lab_result.delete()
        refresh_patient_clinical_status(patient_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PatientNotesAPIView(APIView):
    def get(self, request, patient_id):
        _get_permitted_patient_or_404(request, patient_id)
        notes = PatientNote.objects.filter(patient_id=patient_id).order_by("-pinned", "-created_at")
        serializer = PatientNoteSerializer(notes, many=True)
        return Response(serializer.data)

    def post(self, request, patient_id):
        patient = _get_permitted_patient_or_404(request, patient_id)
        serializer = PatientNoteCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        doctor = request.user if getattr(request.user, "is_authenticated", False) else None

        if doctor is None:
            doctor_id = serializer.validated_data.pop("doctor_id", None)
            if doctor_id:
                doctor = User.objects.filter(id=doctor_id).first()
        else:
            serializer.validated_data.pop("doctor_id", None)

        with transaction.atomic():
            if serializer.validated_data.get("pinned"):
                PatientNote.objects.filter(patient=patient, pinned=True).update(pinned=False)

            note = serializer.save(
                patient=patient,
                doctor=doctor,
            )

        return Response(PatientNoteSerializer(note).data, status=status.HTTP_201_CREATED)


class PatientNoteDetailAPIView(APIView):
    def _get_request_doctor(self, request):
        if getattr(request.user, "is_authenticated", False):
            return request.user

        doctor_id = request.data.get("doctor_id")
        if doctor_id:
            return User.objects.filter(id=doctor_id).first()

        return None

    def patch(self, request, patient_id, note_id):
        _get_permitted_patient_or_404(request, patient_id)
        note = generics.get_object_or_404(PatientNote, id=note_id, patient_id=patient_id)
        request_doctor = self._get_request_doctor(request)

        if note.doctor_id and request_doctor and note.doctor_id != request_doctor.id:
            return Response(
                {"error": "Only the author can edit this note."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if note.doctor_id and request_doctor is None:
            return Response(
                {"error": "Author identification is required to edit this note."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = PatientNoteCreateUpdateSerializer(note, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.validated_data.pop("doctor_id", None)

        with transaction.atomic():
            if serializer.validated_data.get("pinned"):
                PatientNote.objects.filter(patient_id=patient_id, pinned=True).exclude(id=note.id).update(
                    pinned=False
                )
            serializer.save()

        return Response(PatientNoteSerializer(note).data)

    def delete(self, request, patient_id, note_id):
        _get_permitted_patient_or_404(request, patient_id)
        note = generics.get_object_or_404(PatientNote, id=note_id, patient_id=patient_id)
        request_doctor = self._get_request_doctor(request)

        if note.doctor_id and request_doctor and note.doctor_id != request_doctor.id:
            return Response(
                {"error": "Only the author can delete this note."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if note.doctor_id and request_doctor is None:
            return Response(
                {"error": "Author identification is required to delete this note."},
                status=status.HTTP_403_FORBIDDEN,
            )

        note.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PatientDeleteAPIView(generics.DestroyAPIView):
    serializer_class = PatientSerializer

    def get_queryset(self):
        return _permitted_patient_queryset(self.request)


class PatientImportAPIView(APIView):
    def post(self, request):
        excel_file = request.FILES.get("file")
        if not excel_file:
            return Response({"error": "Excel file is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = import_patients_from_excel(excel_file, importing_user=request.user)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response(
                {"error": f"Failed to import patients: {str(exc)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for item in result.get("imported_patients") or []:
            pid = item.get("id")
            if pid:
                refresh_patient_clinical_status(pid)

        return Response(
            {
                "message": "Patients imported successfully.",
                **result,
            },
            status=status.HTTP_201_CREATED,
        )


_DOCTOR_ORDER_REVISION_LIMIT = 40


class PatientDoctorOrderAPIView(APIView):
    def get(self, request, patient_id):
        _get_permitted_patient_or_404(request, patient_id)
        order, _ = DoctorOrder.objects.get_or_create(patient_id=patient_id)
        revisions = DoctorOrderRevision.objects.filter(patient_id=patient_id).order_by("-created_at")[
            :_DOCTOR_ORDER_REVISION_LIMIT
        ]
        return Response(
            {
                "order_text": order.order_text,
                "updated_at": order.updated_at,
                "revisions": DoctorOrderRevisionSerializer(revisions, many=True).data,
            }
        )

    def patch(self, request, patient_id):
        _get_permitted_patient_or_404(request, patient_id)
        order, _ = DoctorOrder.objects.get_or_create(patient_id=patient_id)
        serializer = DoctorOrderSerializer(order, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        order.refresh_from_db()
        DoctorOrderRevision.objects.create(patient_id=patient_id, order_text=order.order_text or "")
        revisions = DoctorOrderRevision.objects.filter(patient_id=patient_id).order_by("-created_at")[
            :_DOCTOR_ORDER_REVISION_LIMIT
        ]
        return Response(
            {
                "order_text": order.order_text,
                "updated_at": order.updated_at,
                "revisions": DoctorOrderRevisionSerializer(revisions, many=True).data,
            }
        )


class PatientDoctorOrderPdfAPIView(APIView):
    def get(self, request, patient_id):
        patient = _get_permitted_patient_or_404(request, patient_id)
        order, _ = DoctorOrder.objects.get_or_create(patient=patient)
        pdf_file = build_doctor_order_pdf(patient, order.order_text or "")
        return FileResponse(
            pdf_file,
            as_attachment=True,
            filename=f"patient_{patient_id}_doctor_order.pdf",
            content_type="application/pdf",
        )


class LabTemplateAPIView(APIView):
    def get(self, request):
        workbook = create_lab_template_workbook()
        return FileResponse(
            workbook,
            as_attachment=True,
            filename="lab_import_template.xlsx",
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )


class PatientTemplateAPIView(APIView):
    def get(self, request):
        workbook = create_patient_template_workbook()
        return FileResponse(
            workbook,
            as_attachment=True,
            filename="patient_import_template.xlsx",
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )


class LabImportAPIView(APIView):
    def post(self, request):
        excel_file = request.FILES.get("file")
        if not excel_file:
            return Response({"error": "Excel file is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = import_labs_from_excel(excel_file, importing_user=request.user)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response(
                {"error": f"Failed to import lab results: {str(exc)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for pid in result.get("affected_patient_ids") or []:
            refresh_patient_clinical_status(pid)

        return Response(
            {
                "message": "Lab results imported successfully.",
                **result,
            },
            status=status.HTTP_201_CREATED,
        )


class SubmitAssessmentAPIView(APIView):
    def post(self, request):
        patient_id = request.data.get("patient_id")
        questionnaire_id = request.data.get("questionnaire_id")
        answers = request.data.get("answers", {})
        doctor_id = request.user.id if request.user.is_authenticated else request.data.get("doctor_id")

        if not patient_id or not questionnaire_id:
            return Response(
                {"error": "patient_id and questionnaire_id are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            patient = _permitted_patient_queryset(request).get(id=patient_id)
            questionnaire = Questionnaire.objects.get(id=questionnaire_id)
        except Patient.DoesNotExist:
            return Response(
                {"error": "Patient not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Questionnaire.DoesNotExist:
            return Response(
                {"error": "Questionnaire not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        assessment = calculate_and_save_assessment(
            patient=patient,
            questionnaire=questionnaire,
            answers=answers,
            doctor=doctor_id,
        )
        calculate_and_store_risk_profile(patient.id)
        _audit(
            request,
            "assessment_submitted",
            "Assessment",
            assessment.id,
            {"patient_id": patient.id, "questionnaire_id": questionnaire.id},
        )

        return Response(
            {
                "message": "Assessment submitted successfully",
                "assessment_id": assessment.id,
                "total_score": assessment.total_score,
                "conclusion": assessment.conclusion,
            },
            status=status.HTTP_201_CREATED,
        )


class QuestionnaireDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = QuestionnaireSerializer

    def get_queryset(self):
        role = get_user_role(self.request.user)
        queryset = Questionnaire.objects.exclude(approval_status=Questionnaire.APPROVAL_ARCHIVED)
        if role == DoctorProfile.ROLE_CHIEF_DOCTOR:
            return queryset
        return queryset.filter(
            models.Q(created_by=self.request.user)
            | models.Q(approval_status=Questionnaire.APPROVAL_APPROVED, is_active=True)
        )

    def get_serializer_class(self):
        if self.request.method in {"PUT", "PATCH"}:
            return QuestionnaireWriteSerializer
        return QuestionnaireSerializer

    def update(self, request, *args, **kwargs):
        questionnaire = self.get_object()
        role = get_user_role(request.user)
        if role != DoctorProfile.ROLE_CHIEF_DOCTOR:
            if questionnaire.created_by_id != request.user.id:
                return Response({"detail": "Вы можете редактировать только свои опросники."}, status=403)
            if questionnaire.approval_status not in {
                Questionnaire.APPROVAL_DRAFT,
                Questionnaire.APPROVAL_REJECTED,
                Questionnaire.APPROVAL_CHANGES,
            }:
                return Response({"detail": "Редактирование запрещено для текущего статуса."}, status=400)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        questionnaire = self.get_object()
        role = get_user_role(request.user)
        if role != DoctorProfile.ROLE_CHIEF_DOCTOR:
            if questionnaire.created_by_id != request.user.id:
                return Response({"detail": "Вы можете удалять только свои опросники."}, status=403)
            if questionnaire.approval_status not in {
                Questionnaire.APPROVAL_DRAFT,
                Questionnaire.APPROVAL_REJECTED,
                Questionnaire.APPROVAL_CHANGES,
            }:
                return Response({"detail": "Удаление запрещено для текущего статуса."}, status=400)
        questionnaire.approval_status = Questionnaire.APPROVAL_ARCHIVED
        questionnaire.is_active = False
        questionnaire.save(update_fields=["approval_status", "is_active", "updated_at"])
        _audit(request, "questionnaire_archived", "Questionnaire", questionnaire.id)
        return Response({"detail": "Questionnaire moved to archive."}, status=status.HTTP_200_OK)


class SubmitQuestionnaireForApprovalAPIView(APIView):
    permission_classes = [IsDoctorOrAbove]

    def post(self, request, pk):
        questionnaire = generics.get_object_or_404(Questionnaire, pk=pk)
        if questionnaire.approval_status == Questionnaire.APPROVAL_ARCHIVED:
            return Response({"detail": "Archived questionnaire cannot be submitted for approval."}, status=400)
        if questionnaire.created_by_id != request.user.id and get_user_role(request.user) == DoctorProfile.ROLE_DOCTOR:
            return Response({"detail": "Можно отправить только свой опросник."}, status=403)
        questionnaire.approval_status = Questionnaire.APPROVAL_PENDING
        questionnaire.review_comment = ""
        questionnaire.save(update_fields=["approval_status", "review_comment", "updated_at"])
        _audit(request, "questionnaire_submitted_for_approval", "Questionnaire", questionnaire.id)
        return Response({"detail": "Questionnaire sent for approval."})


class PendingQuestionnairesAPIView(generics.ListAPIView):
    permission_classes = [IsChiefDoctorOrAdmin]
    serializer_class = QuestionnaireSerializer

    def get_queryset(self):
        return Questionnaire.objects.filter(approval_status=Questionnaire.APPROVAL_PENDING).order_by("-updated_at")


class ArchivedQuestionnairesAPIView(generics.ListAPIView):
    permission_classes = [IsChiefDoctorOrAdmin]
    serializer_class = QuestionnaireSerializer

    def get_queryset(self):
        return Questionnaire.objects.filter(approval_status=Questionnaire.APPROVAL_ARCHIVED).order_by("-updated_at")

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()[:200]
        serialized = self.get_serializer(queryset, many=True).data
        ids = [row["id"] for row in serialized]

        archive_log_rows = (
            AuditLog.objects.select_related("user")
            .filter(action="questionnaire_archived", object_type="Questionnaire", object_id__in=[str(i) for i in ids])
            .order_by("-created_at")
        )
        archive_by_questionnaire = {}
        for row in archive_log_rows:
            if row.object_id in archive_by_questionnaire:
                continue
            archive_by_questionnaire[row.object_id] = row

        payload = []
        for row in serialized:
            log_row = archive_by_questionnaire.get(str(row["id"]))
            payload.append(
                {
                    **row,
                    "archived_at": log_row.created_at if log_row else row.get("updated_at"),
                    "archived_by_email": log_row.user.email if log_row and log_row.user else "",
                }
            )
        return Response(payload)


class RestoreQuestionnaireAPIView(APIView):
    permission_classes = [IsChiefDoctorOrAdmin]

    def post(self, request, pk):
        questionnaire = generics.get_object_or_404(Questionnaire, pk=pk)
        if questionnaire.approval_status != Questionnaire.APPROVAL_ARCHIVED:
            return Response({"detail": "Only archived questionnaires can be restored."}, status=400)

        questionnaire.approval_status = Questionnaire.APPROVAL_DRAFT
        questionnaire.is_active = True
        questionnaire.review_comment = ""
        questionnaire.approved_by = None
        questionnaire.approved_at = None
        questionnaire.save(
            update_fields=[
                "approval_status",
                "is_active",
                "review_comment",
                "approved_by",
                "approved_at",
                "updated_at",
            ]
        )
        _audit(request, "questionnaire_restored", "Questionnaire", questionnaire.id)
        return Response({"detail": "Questionnaire restored from archive."}, status=status.HTTP_200_OK)


class ApproveQuestionnaireAPIView(APIView):
    permission_classes = [IsChiefDoctorOrAdmin]

    def post(self, request, pk):
        questionnaire = generics.get_object_or_404(Questionnaire, pk=pk)
        if questionnaire.approval_status == Questionnaire.APPROVAL_ARCHIVED:
            return Response({"detail": "Archived questionnaire cannot be approved."}, status=400)
        questionnaire.approval_status = Questionnaire.APPROVAL_APPROVED
        questionnaire.approved_by = request.user
        questionnaire.approved_at = timezone.now()
        questionnaire.review_comment = request.data.get("review_comment", "")
        questionnaire.save(update_fields=["approval_status", "approved_by", "approved_at", "review_comment", "updated_at"])
        _audit(request, "questionnaire_approved", "Questionnaire", questionnaire.id, {"comment": questionnaire.review_comment})
        return Response({"detail": "Questionnaire approved."})


class RejectQuestionnaireAPIView(APIView):
    permission_classes = [IsChiefDoctorOrAdmin]

    def post(self, request, pk):
        questionnaire = generics.get_object_or_404(Questionnaire, pk=pk)
        if questionnaire.approval_status == Questionnaire.APPROVAL_ARCHIVED:
            return Response({"detail": "Archived questionnaire cannot be rejected."}, status=400)
        comment = (request.data.get("review_comment") or "").strip()
        if not comment:
            return Response({"review_comment": ["Комментарий обязателен."]}, status=400)
        questionnaire.approval_status = Questionnaire.APPROVAL_REJECTED
        questionnaire.review_comment = comment
        questionnaire.save(update_fields=["approval_status", "review_comment", "updated_at"])
        _audit(request, "questionnaire_rejected", "Questionnaire", questionnaire.id, {"comment": comment})
        return Response({"detail": "Questionnaire rejected."})


class RequestQuestionnaireChangesAPIView(APIView):
    permission_classes = [IsChiefDoctorOrAdmin]

    def post(self, request, pk):
        questionnaire = generics.get_object_or_404(Questionnaire, pk=pk)
        if questionnaire.approval_status == Questionnaire.APPROVAL_ARCHIVED:
            return Response({"detail": "Archived questionnaire cannot be sent for changes."}, status=400)
        comment = (request.data.get("review_comment") or "").strip()
        if not comment:
            return Response({"review_comment": ["Комментарий обязателен."]}, status=400)
        questionnaire.approval_status = Questionnaire.APPROVAL_CHANGES
        questionnaire.review_comment = comment
        questionnaire.save(update_fields=["approval_status", "review_comment", "updated_at"])
        _audit(request, "questionnaire_changes_requested", "Questionnaire", questionnaire.id, {"comment": comment})
        return Response({"detail": "Changes requested."})


class QuestionnaireSessionCreateAPIView(APIView):
    permission_classes = [IsDoctorOrAbove]

    def post(self, request):
        serializer = QuestionnaireSessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        patient_id = serializer.validated_data["patient_id"]
        questionnaire_id = serializer.validated_data["questionnaire_id"]
        questionnaire = generics.get_object_or_404(Questionnaire, pk=questionnaire_id)
        if not questionnaire.is_active or questionnaire.approval_status != Questionnaire.APPROVAL_APPROVED:
            return Response({"detail": "Questionnaire is not approved for patient use."}, status=400)
        patient = _get_permitted_patient_or_404(request, patient_id)
        expires_at = timezone.now() + timedelta(hours=24)
        session = QuestionnaireSession.objects.create(
            patient=patient,
            questionnaire=questionnaire,
            doctor=request.user,
            token=secrets.token_urlsafe(32),
            expires_at=expires_at,
        )
        _audit(request, "questionnaire_session_created", "QuestionnaireSession", session.id, {"patient_id": patient_id})
        return Response(
            {
                "id": session.id,
                "public_url": f"/public/questionnaire/{session.token}",
                "token": session.token,
                "expires_at": session.expires_at,
                "questionnaire_title": questionnaire.title_en or questionnaire.title_ru or questionnaire.title_kk or questionnaire.title,
                "patient_display": patient.patient_code or f"Patient #{patient.id}",
            },
            status=201,
        )


class PublicQuestionnaireAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        session = generics.get_object_or_404(
            QuestionnaireSession.objects.select_related("questionnaire"),
            token=token,
        )
        if session.status == QuestionnaireSession.STATUS_COMPLETED:
            return Response({"detail": "Ссылка уже использована.", "code": "used"}, status=400)
        if session.expires_at < timezone.now():
            session.status = QuestionnaireSession.STATUS_EXPIRED
            session.save(update_fields=["status"])
            return Response({"detail": "Срок действия ссылки истек.", "code": "expired"}, status=400)
        questionnaire = session.questionnaire
        questions = Question.objects.filter(questionnaire=questionnaire).order_by("order")
        return Response(
            {
                "title": questionnaire.title_en or questionnaire.title_ru or questionnaire.title_kk or questionnaire.title,
                "description": questionnaire.description_en or questionnaire.description_ru or questionnaire.description_kk or questionnaire.description,
                "token": session.token,
                "expires_at": session.expires_at,
                "questions": QuestionSerializer(questions, many=True).data,
                "screening_disclaimer": "This tool is for screening and educational purposes only. Final diagnosis must be made by a qualified doctor.",
            }
        )


class PublicQuestionnaireSubmitAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, token):
        session = generics.get_object_or_404(
            QuestionnaireSession.objects.select_related("questionnaire", "patient", "doctor"),
            token=token,
        )
        if session.status == QuestionnaireSession.STATUS_COMPLETED:
            return Response({"detail": "Ответы уже отправлены по этой ссылке.", "code": "used"}, status=400)
        if session.expires_at < timezone.now():
            session.status = QuestionnaireSession.STATUS_EXPIRED
            session.save(update_fields=["status"])
            return Response({"detail": "Срок действия ссылки истек.", "code": "expired"}, status=400)
        answers = request.data.get("answers", {})
        assessment = calculate_and_save_assessment(
            patient=session.patient,
            questionnaire=session.questionnaire,
            answers=answers,
            doctor=session.doctor.id if session.doctor else None,
        )
        calculate_and_store_risk_profile(session.patient_id)
        session.status = QuestionnaireSession.STATUS_COMPLETED
        session.completed_at = timezone.now()
        session.used_at = timezone.now()
        session.save(update_fields=["status", "completed_at", "used_at"])
        _audit(
            request,
            "public_questionnaire_completed",
            "QuestionnaireSession",
            session.id,
            {"assessment_id": assessment.id, "patient_id": session.patient_id},
        )
        return Response({"detail": "Спасибо, ваши ответы отправлены врачу.", "assessment_id": assessment.id}, status=201)


class DashboardStatsAPIView(APIView):
    def get(self, request):
        patient_queryset = _permitted_patient_queryset(request)
        patient_ids = patient_queryset.values_list("id", flat=True)
        completed_assessments = Assessment.objects.filter(patient_id__in=patient_ids).count()
        high_risk_count = PatientRiskProfile.objects.filter(
            patient_id__in=patient_ids, overall_risk_level__in=["high", "critical"]
        ).values("patient_id").distinct().count()
        role = get_user_role(request.user)
        pending_questionnaires = Questionnaire.objects.filter(approval_status=Questionnaire.APPROVAL_PENDING).count()
        if role == DoctorProfile.ROLE_DOCTOR:
            pending_questionnaires = Questionnaire.objects.filter(
                created_by=request.user, approval_status=Questionnaire.APPROVAL_PENDING
            ).count()
        recent_activity = AuditLog.objects.all().order_by("-created_at")
        if role == DoctorProfile.ROLE_DOCTOR:
            recent_activity = recent_activity.filter(user=request.user)
        recent_activity = recent_activity[:12]
        recent_activity_payload = [
            {
                "id": item.id,
                "user_id": item.user_id,
                "user_email": item.user.email if item.user else "",
                "action": item.action,
                "object_type": item.object_type,
                "object_id": item.object_id,
                "created_at": item.created_at,
                "details": item.details,
            }
            for item in recent_activity
        ]
        return Response(
            {
                "total_patients": patient_queryset.count(),
                "completed_assessments": completed_assessments,
                "pending_questionnaires": pending_questionnaires,
                "high_risk_patients": high_risk_count,
                "recent_activity": recent_activity_payload,
            }
        )


class AuditLogListAPIView(generics.ListAPIView):
    permission_classes = [IsChiefDoctorOrAdmin]

    def get_queryset(self):
        return AuditLog.objects.select_related("user").order_by("-created_at")

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()[:200]
        return Response(
            [
                {
                    "id": item.id,
                    "user_id": item.user_id,
                    "user_email": item.user.email if item.user else "",
                    "action": item.action,
                    "object_type": item.object_type,
                    "object_id": item.object_id,
                    "details": item.details,
                    "ip_address": item.ip_address,
                    "created_at": item.created_at,
                }
                for item in queryset
            ]
        )


class QuestionnaireSessionListAPIView(generics.ListAPIView):
    serializer_class = QuestionnaireSessionSerializer

    def get_queryset(self):
        queryset = QuestionnaireSession.objects.select_related("patient", "questionnaire", "doctor").order_by("-created_at")
        role = get_user_role(self.request.user)
        if role == DoctorProfile.ROLE_DOCTOR:
            return queryset.filter(doctor=self.request.user)
        return queryset