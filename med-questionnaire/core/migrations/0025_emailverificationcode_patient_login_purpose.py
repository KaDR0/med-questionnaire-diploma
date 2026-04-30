from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0024_alter_answer_id_alter_assessment_id_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="emailverificationcode",
            name="purpose",
            field=models.CharField(
                choices=[
                    ("patient_signup", "Patient signup"),
                    ("doctor_signup", "Doctor signup"),
                    ("patient_login", "Patient login"),
                ],
                max_length=32,
            ),
        ),
    ]

