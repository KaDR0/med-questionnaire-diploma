from django.db import migrations


def refresh_all(apps, schema_editor):
    from core.patient_clinical_status import refresh_patient_clinical_status

    Patient = apps.get_model("core", "Patient")
    for pid in Patient.objects.values_list("id", flat=True):
        refresh_patient_clinical_status(pid)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0013_doctororder"),
    ]

    operations = [
        migrations.RunPython(refresh_all, migrations.RunPython.noop),
    ]
