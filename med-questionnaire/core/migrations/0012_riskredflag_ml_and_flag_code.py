from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0011_risk_engine_and_lab_dictionary"),
    ]

    operations = [
        migrations.AddField(
            model_name="riskredflag",
            name="flag_code",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="riskredflag",
            name="ml_confidence",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="riskredflag",
            name="ml_probability",
            field=models.FloatField(blank=True, null=True),
        ),
    ]
