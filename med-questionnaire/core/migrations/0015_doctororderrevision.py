import django.db.models.deletion
from django.db import migrations, models


def seed_revisions_from_current(apps, schema_editor):
    DoctorOrder = apps.get_model("core", "DoctorOrder")
    DoctorOrderRevision = apps.get_model("core", "DoctorOrderRevision")
    for order in DoctorOrder.objects.select_related("patient").all():
        text = (order.order_text or "").strip()
        if text:
            DoctorOrderRevision.objects.create(patient_id=order.patient_id, order_text=order.order_text)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0014_refresh_patient_status_from_rules"),
    ]

    operations = [
        migrations.CreateModel(
            name="DoctorOrderRevision",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order_text", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "patient",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="doctor_order_revisions",
                        to="core.patient",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.RunPython(seed_revisions_from_current, migrations.RunPython.noop),
    ]
