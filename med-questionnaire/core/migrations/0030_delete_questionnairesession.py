from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0029_questionnaire_assignment_completed_link"),
    ]

    operations = [
        migrations.DeleteModel(
            name="QuestionnaireSession",
        ),
    ]
