from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0018_merge_admin_into_chief_doctor"),
    ]

    operations = [
        migrations.AlterField(
            model_name="questionnaire",
            name="approval_status",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("pending_approval", "Pending approval"),
                    ("approved", "Approved"),
                    ("rejected", "Rejected"),
                    ("changes_requested", "Changes requested"),
                    ("archived", "Archived"),
                ],
                default="draft",
                max_length=32,
            ),
        ),
    ]
