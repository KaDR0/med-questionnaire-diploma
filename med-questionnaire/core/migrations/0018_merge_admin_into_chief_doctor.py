from django.db import migrations, models


def migrate_admin_role_to_chief(apps, schema_editor):
    DoctorProfile = apps.get_model("core", "DoctorProfile")
    DoctorProfile.objects.filter(role="admin").update(role="chief_doctor")


def reverse_migrate_chief_to_admin(apps, schema_editor):
    # Keep rollback conservative: do not reclassify users automatically.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0017_patient_assigned_doctor_question_is_required_and_more"),
    ]

    operations = [
        migrations.RunPython(migrate_admin_role_to_chief, reverse_migrate_chief_to_admin),
        migrations.AlterField(
            model_name="doctorprofile",
            name="role",
            field=models.CharField(
                choices=[("doctor", "Doctor"), ("chief_doctor", "Chief doctor")],
                default="doctor",
                max_length=32,
            ),
        ),
    ]
