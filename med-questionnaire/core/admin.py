from django.contrib import admin
from .models import Disease, Questionnaire, Question, Patient, Assessment, Answer
from .models import LabIndicator, LabResult, LabValue
from .models import PatientNote



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