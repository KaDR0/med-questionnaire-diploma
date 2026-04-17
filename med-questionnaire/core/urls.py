from django.urls import path
from . import views

urlpatterns = [
    path("", views.patient_list, name="patient_list"),

    path("patient/<int:patient_id>/detail/", views.patient_detail, name="patient_detail"),

    path("patient/<int:patient_id>/", views.start_assessment, name="start_assessment"),

    path(
        "patient/<int:patient_id>/questionnaire/<int:questionnaire_id>/",
        views.questionnaire_view,
        name="questionnaire_view",
    ),
    path("patient/<int:patient_id>/add-note/", views.add_patient_note, name="add_patient_note"),
    path("patient/<int:patient_id>/delete/", views.delete_patient, name="delete_patient"),
    path("note/<int:note_id>/delete/", views.delete_patient_note, name="delete_note"),
    path("note/<int:note_id>/edit/", views.edit_patient_note, name="edit_note"),
    path("import-patients-excel/", views.import_patients_excel, name="import_patients_excel"),
    path("assessment/<int:assessment_id>/", views.assessment_result, name="assessment_result"),
    path("assessment/<int:assessment_id>/pdf/", views.assessment_pdf, name="assessment_pdf"),
    path("patient/<int:patient_id>/pdf/", views.patient_pdf_all, name="patient_pdf_all"),
    path("export-lab-template/", views.export_lab_template, name="export_lab_template"),
    path("import-lab-excel/", views.import_lab_excel, name="import_lab_excel"),
]