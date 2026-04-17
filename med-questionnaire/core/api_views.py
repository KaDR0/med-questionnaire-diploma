from datetime import date, timedelta

from django.http import FileResponse
from django.contrib.auth.models import User
from django.db import models, transaction
from django.db.models import Case, IntegerField, Value, When
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response

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
)
from .serializers import (
    DoctorOrderRevisionSerializer,
    DoctorOrderSerializer,
    PatientSerializer,
    PatientStatusUpdateSerializer,
    PatientIntakeSerializer,
    QuestionnaireSerializer,
    QuestionSerializer,
    AssessmentSerializer,
    LabIndicatorSerializer,
    LabResultSerializer,
    LabResultUpdateSerializer,
    PatientNoteSerializer,
    PatientNoteCreateUpdateSerializer,
    PatientRiskProfileSerializer,
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


class PatientListAPIView(generics.ListCreateAPIView):
    serializer_class = PatientSerializer

    def get_queryset(self):
        far_future = Value(date(2099, 12, 31), output_field=models.DateField())
        return (
            Patient.objects.annotate(
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
        instance = serializer.save()
        refresh_patient_clinical_status(instance.id)


class PatientDetailAPIView(generics.RetrieveAPIView):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer


class PatientPdfAPIView(APIView):
    def get(self, request, pk):
        patient = generics.get_object_or_404(
            Patient.objects.select_related("doctor_order").prefetch_related(
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
    queryset = Patient.objects.all()
    serializer_class = PatientStatusUpdateSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        refresh_patient_clinical_status(instance.pk)
        instance.refresh_from_db()
        return Response(PatientSerializer(instance).data)


class PatientIntakeAPIView(APIView):
    def patch(self, request, pk):
        patient = generics.get_object_or_404(Patient, pk=pk)
        serializer = PatientIntakeSerializer(instance=patient, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(patient.data.get("intake", {}))


class QuestionnaireListAPIView(generics.ListAPIView):
    queryset = Questionnaire.objects.all().order_by("id")
    serializer_class = QuestionnaireSerializer


class QuestionnaireQuestionsAPIView(APIView):
    def get(self, request, questionnaire_id):
        questions = Question.objects.filter(questionnaire_id=questionnaire_id).order_by("order")
        serializer = QuestionSerializer(questions, many=True)
        return Response(serializer.data)


class PatientAssessmentsAPIView(APIView):
    def get(self, request, patient_id):
        assessments = Assessment.objects.filter(patient_id=patient_id).order_by("-created_at")
        serializer = AssessmentSerializer(assessments, many=True)
        return Response(serializer.data)


class PatientAssessmentTrendAPIView(APIView):
    def get(self, request, patient_id):
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


class PatientRiskProfileAPIView(APIView):
    def get(self, request, patient_id):
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
        profile = calculate_and_store_risk_profile(patient_id)
        serializer = PatientRiskProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PatientRiskHistoryAPIView(APIView):
    def get(self, request, patient_id):
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


class PatientLabResultDetailAPIView(APIView):
    def patch(self, request, patient_id, lab_result_id):
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
        lab_result = generics.get_object_or_404(LabResult, id=lab_result_id, patient_id=patient_id)
        lab_result.delete()
        refresh_patient_clinical_status(patient_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PatientNotesAPIView(APIView):
    def get(self, request, patient_id):
        notes = PatientNote.objects.filter(patient_id=patient_id).order_by("-pinned", "-created_at")
        serializer = PatientNoteSerializer(notes, many=True)
        return Response(serializer.data)

    def post(self, request, patient_id):
        patient = generics.get_object_or_404(Patient, id=patient_id)
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
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer


class PatientImportAPIView(APIView):
    def post(self, request):
        excel_file = request.FILES.get("file")
        if not excel_file:
            return Response({"error": "Excel file is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = import_patients_from_excel(excel_file)
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
        generics.get_object_or_404(Patient, pk=patient_id)
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
        generics.get_object_or_404(Patient, pk=patient_id)
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
        patient = generics.get_object_or_404(Patient, pk=patient_id)
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
            result = import_labs_from_excel(excel_file)
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
        doctor_id = request.data.get("doctor_id")

        if not patient_id or not questionnaire_id:
            return Response(
                {"error": "patient_id and questionnaire_id are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            patient = Patient.objects.get(id=patient_id)
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

        return Response(
            {
                "message": "Assessment submitted successfully",
                "assessment_id": assessment.id,
                "total_score": assessment.total_score,
                "conclusion": assessment.conclusion,
            },
            status=status.HTTP_201_CREATED,
        )