from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0020_doctorprofile_clinical_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="doctorprofile",
            name="competencies",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="doctorprofile",
            name="experience_years",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="doctorprofile",
            name="work_direction",
            field=models.CharField(blank=True, default="", max_length=160),
        ),
        migrations.AddField(
            model_name="doctorprofile",
            name="workplace",
            field=models.CharField(blank=True, default="", max_length=160),
        ),
    ]
