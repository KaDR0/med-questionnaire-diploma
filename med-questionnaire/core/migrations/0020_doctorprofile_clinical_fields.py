from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0019_questionnaire_archived_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="doctorprofile",
            name="department",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="doctorprofile",
            name="phone",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="doctorprofile",
            name="schedule",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="doctorprofile",
            name="short_info",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="doctorprofile",
            name="specialty",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="doctorprofile",
            name="status",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
    ]
