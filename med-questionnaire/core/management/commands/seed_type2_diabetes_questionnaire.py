import json

from django.core.management.base import BaseCommand

from core.models import Disease, Question, Questionnaire


QUESTIONNAIRE_TITLE = "Type 2 Diabetes Risk Questionnaire"

INTERPRETATION_RULES = [
    {
        "min": 0,
        "max": 3,
        "level": "Low risk",
        "recommendation": (
            "The patient has a low preliminary risk of type 2 diabetes. "
            "Recommend maintaining a balanced diet, regular physical activity and routine preventive check-ups."
        ),
    },
    {
        "min": 4,
        "max": 7,
        "level": "Moderate risk",
        "recommendation": (
            "The patient has a moderate preliminary risk of type 2 diabetes. "
            "Recommend checking fasting blood glucose or HbA1c, improving diet, increasing physical activity "
            "and monitoring body weight."
        ),
    },
    {
        "min": 8,
        "max": 11,
        "level": "High risk",
        "recommendation": (
            "The patient has a high preliminary risk of type 2 diabetes. "
            "Recommend medical consultation, laboratory testing such as fasting glucose and HbA1c, and lifestyle "
            "correction under medical supervision."
        ),
    },
    {
        "min": 12,
        "max": 14,
        "level": "Very high risk",
        "recommendation": (
            "The patient has a very high preliminary risk of type 2 diabetes. "
            "Recommend prompt medical consultation and detailed laboratory evaluation. "
            "This result is not a diagnosis, but it requires further clinical assessment."
        ),
    },
]

QUESTIONS = [
    ("Do you often feel unusually thirsty?", 2, 0),
    ("Do you urinate more often than usual, especially at night?", 2, 0),
    ("Do you often feel tired without a clear reason?", 1, 0),
    ("Do you have close relatives with type 2 diabetes?", 2, 0),
    ("Do you have excess body weight or abdominal obesity?", 2, 0),
    ("Do you have low physical activity during the week?", 1, 0),
    ("Have you ever had high blood glucose in previous tests?", 3, 0),
    ("Do you often eat sweets, sweet drinks, or high-carbohydrate food?", 1, 0),
]


class Command(BaseCommand):
    help = "Create or update one ready Type 2 Diabetes risk questionnaire without duplicates."

    def handle(self, *args, **kwargs):
        disease, disease_created = Disease.objects.get_or_create(
            name="Type 2 Diabetes",
            defaults={"code": "T2DM", "is_active": True},
        )
        if not disease.is_active:
            disease.is_active = True
            disease.save(update_fields=["is_active"])

        questionnaire_defaults = {
            "title": QUESTIONNAIRE_TITLE,
            "title_en": QUESTIONNAIRE_TITLE,
            "title_ru": "Опросник риска диабета 2 типа",
            "description": (
                "Questionnaire for preliminary assessment of type 2 diabetes risk based on lifestyle, "
                "symptoms and family history."
            ),
            "description_en": (
                "Questionnaire for preliminary assessment of type 2 diabetes risk based on lifestyle, "
                "symptoms and family history."
            ),
            "medical_area": "Endocrinology",
            "risk_target": "Risk of developing type 2 diabetes",
            "source_name": "American Diabetes Association",
            "source_url": "https://diabetes.org/diabetes/risk-test",
            "source_type": "Clinical screening questionnaire",
            "evidence_note": (
                "Based on common diabetes risk factors such as family history, excess body weight, "
                "low physical activity, symptoms of high blood glucose and previous abnormal glucose results."
            ),
            "scoring_method": "Sum of question scores",
            "is_standardized": True,
            "interpretation_rules": json.dumps(INTERPRETATION_RULES, ensure_ascii=False),
            "interpretation_schema": {
                "bands": [
                    {
                        "min_ratio": 12 / 14,
                        "label": "very_high_risk",
                        "title": "Very high risk",
                        "recommendation": INTERPRETATION_RULES[3]["recommendation"],
                    },
                    {
                        "min_ratio": 8 / 14,
                        "label": "high_risk",
                        "title": "High risk",
                        "recommendation": INTERPRETATION_RULES[2]["recommendation"],
                    },
                    {
                        "min_ratio": 4 / 14,
                        "label": "moderate_risk",
                        "title": "Moderate risk",
                        "recommendation": INTERPRETATION_RULES[1]["recommendation"],
                    },
                    {
                        "min_ratio": 0.0,
                        "label": "low_risk",
                        "title": "Low risk",
                        "recommendation": INTERPRETATION_RULES[0]["recommendation"],
                    },
                ]
            },
            "is_active": True,
            "approval_status": Questionnaire.APPROVAL_APPROVED,
            "min_completion_percent": 100,
            "target_condition_code": "T2DM",
            "kind": Questionnaire.KIND_SCREENING,
            "review_comment": "Seeded as ready-to-use validated screening questionnaire.",
        }

        questionnaire, created = Questionnaire.objects.get_or_create(
            title=QUESTIONNAIRE_TITLE,
            disease=disease,
            defaults=questionnaire_defaults,
        )
        if not created:
            for field, value in questionnaire_defaults.items():
                setattr(questionnaire, field, value)
            questionnaire.save()

        expected_orders = set(range(1, len(QUESTIONS) + 1))
        questionnaire.questions.exclude(order__in=expected_orders).delete()

        created_count = 0
        updated_count = 0
        for order, (text, score_yes, score_no) in enumerate(QUESTIONS, start=1):
            question, question_created = Question.objects.get_or_create(
                questionnaire=questionnaire,
                order=order,
                defaults={
                    "text": text,
                    "text_en": text,
                    "qtype": Question.YESNO,
                    "is_required": True,
                    "score_yes": score_yes,
                    "score_no": score_no,
                    "options": [],
                },
            )
            if question_created:
                created_count += 1
                continue

            question.text = text
            question.text_en = text
            question.qtype = Question.YESNO
            question.is_required = True
            question.score_yes = score_yes
            question.score_no = score_no
            question.options = []
            question.save()
            updated_count += 1

        action = "created" if created else "updated"
        disease_state = "created" if disease_created else "reused"
        self.stdout.write(
            self.style.SUCCESS(
                f"Disease {disease_state}: id={disease.id}, name='{disease.name}'. "
                f"Questionnaire {action}: id={questionnaire.id}, title='{questionnaire.title}'. "
                f"Questions created: {created_count}, updated: {updated_count}."
            )
        )
