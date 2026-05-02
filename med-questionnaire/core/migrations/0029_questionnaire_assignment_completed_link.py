import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0028_questionnaire_assignment_active_unique"),
    ]

    operations = [
        migrations.AddField(
            model_name="questionnaireassignment",
            name="completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="questionnaireassignment",
            name="result_assessment",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="questionnaire_assignments",
                to="core.assessment",
            ),
        ),
    ]
