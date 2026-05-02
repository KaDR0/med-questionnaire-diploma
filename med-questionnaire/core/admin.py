from django.contrib import admin
from .models import Disease, Questionnaire, Question, Patient, Assessment, Answer
from .models import LabIndicator, LabResult, LabValue
from .models import PatientNote
from .models import QuestionnaireAssignment



admin.site.register(Disease)
admin.site.register(Questionnaire)
admin.site.register(Question)
admin.site.register(Patient)
admin.site.register(Assessment)
admin.site.register(Answer)


admin.site.register(PatientNote)


admin.site.register(LabIndicator)
admin.site.register(LabResult)
admin.site.register(LabValue)


@admin.register(QuestionnaireAssignment)
class QuestionnaireAssignmentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "patient",
        "questionnaire",
        "assigned_by",
        "status",
        "assigned_at",
        "completed_at",
        "due_date",
        "result_assessment",
    )
    list_filter = ("status", "assigned_at")
    search_fields = (
        "patient__full_name",
        "patient__patient_code",
        "questionnaire__title",
        "questionnaire__title_en",
        "assigned_by__username",
    )
    raw_id_fields = ("patient", "questionnaire", "assigned_by", "result_assessment")
    readonly_fields = ("assigned_at", "completed_at", "updated_at")