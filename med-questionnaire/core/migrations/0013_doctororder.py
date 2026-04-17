from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0012_riskredflag_ml_and_flag_code"),
    ]

    operations = [
        migrations.CreateModel(
            name="DoctorOrder",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order_text", models.TextField(blank=True, default="")),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "patient",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="doctor_order",
                        to="core.patient",
                    ),
                ),
            ],
        ),
    ]
