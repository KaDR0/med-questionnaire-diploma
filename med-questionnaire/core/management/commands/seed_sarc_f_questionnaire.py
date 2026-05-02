import json

from django.core.management.base import BaseCommand

from core.models import Disease, Question, Questionnaire


QUESTIONNAIRE_TITLE = "SARC-F questionnaire"
DISEASE_NAME = "Риск саркопении"

LOW_RISK_RECOMMENDATION = (
    "Сейчас выраженных признаков высокого риска не выявлено. "
    "Рекомендуется сохранять регулярную физическую активность, следить за достаточным потреблением белка "
    "и сообщать врачу, если появится слабость, снижение выносливости или частые падения."
)

HIGH_RISK_RECOMMENDATION = (
    "Рекомендуется обратиться к врачу для дополнительной оценки мышечной силы и физической функции. "
    "Полезно обсудить программу силовых упражнений, достаточное потребление белка, риск падений и "
    "необходимость дальнейшего обследования."
)

INTERPRETATION_RULES = [
    {
        "min": 0,
        "max": 3,
        "level": "Низкий риск саркопении",
        "recommendation": LOW_RISK_RECOMMENDATION,
    },
    {
        "min": 4,
        "max": 10,
        "level": "Повышенный риск саркопении, требуется дополнительная оценка мышечной силы и физической функции",
        "recommendation": HIGH_RISK_RECOMMENDATION,
    },
]

QUESTIONS = [
    {
        "order": 1,
        "text": "Насколько вам трудно поднимать и переносить груз около 4–5 кг?",
        "options": [
            {"value": "no_difficulty", "text": "Нет трудностей", "score": 0, "order": 1},
            {"value": "some_difficulty", "text": "Есть небольшие трудности", "score": 1, "order": 2},
            {"value": "severe_or_cannot", "text": "Очень трудно или не могу", "score": 2, "order": 3},
        ],
    },
    {
        "order": 2,
        "text": "Насколько вам трудно ходить по комнате?",
        "options": [
            {"value": "no_difficulty", "text": "Нет трудностей", "score": 0, "order": 1},
            {"value": "some_difficulty", "text": "Есть небольшие трудности", "score": 1, "order": 2},
            {
                "value": "severe_help_or_cannot",
                "text": "Очень трудно, нужна помощь или не могу",
                "score": 2,
                "order": 3,
            },
        ],
    },
    {
        "order": 3,
        "text": "Насколько вам трудно встать со стула или с кровати?",
        "options": [
            {"value": "no_difficulty", "text": "Нет трудностей", "score": 0, "order": 1},
            {"value": "some_difficulty", "text": "Есть небольшие трудности", "score": 1, "order": 2},
            {"value": "severe_or_help", "text": "Очень трудно или нужна помощь", "score": 2, "order": 3},
        ],
    },
    {
        "order": 4,
        "text": "Насколько вам трудно подняться по лестнице на один пролёт из 10 ступеней?",
        "options": [
            {"value": "no_difficulty", "text": "Нет трудностей", "score": 0, "order": 1},
            {"value": "some_difficulty", "text": "Есть небольшие трудности", "score": 1, "order": 2},
            {"value": "severe_or_cannot", "text": "Очень трудно или не могу", "score": 2, "order": 3},
        ],
    },
    {
        "order": 5,
        "text": "Сколько раз вы падали за последний год?",
        "options": [
            {"value": "none", "text": "Ни разу", "score": 0, "order": 1},
            {"value": "one_to_three", "text": "1–3 раза", "score": 1, "order": 2},
            {"value": "four_or_more", "text": "4 раза и больше", "score": 2, "order": 3},
        ],
    },
]


class Command(BaseCommand):
    help = "Create or update SARC-F questionnaire with 3-level single-choice scoring."

    def handle(self, *args, **kwargs):
        disease, disease_created = Disease.objects.get_or_create(
            name=DISEASE_NAME,
            defaults={"code": "SARCOPENIA_RISK", "is_active": True},
        )
        if not disease.is_active:
            disease.is_active = True
            disease.save(update_fields=["is_active"])

        questionnaire_defaults = {
            "title": QUESTIONNAIRE_TITLE,
            "title_en": QUESTIONNAIRE_TITLE,
            "title_ru": QUESTIONNAIRE_TITLE,
            "description": (
                "Короткий опросник для выявления пациентов с повышенным риском саркопении по жалобам на силу, "
                "ходьбу, вставание, подъём по лестнице и падения."
            ),
            "description_ru": (
                "Короткий опросник для выявления пациентов с повышенным риском саркопении по жалобам на силу, "
                "ходьбу, вставание, подъём по лестнице и падения."
            ),
            "medical_area": "Гериатрия / Реабилитология",
            "risk_target": (
                "Раннее выявление пациентов с вероятным снижением мышечной силы и функции, которым нужна "
                "дополнительная оценка мышечного здоровья."
            ),
            "source_name": "SARC-F questionnaire",
            "source_url": "https://www.cgakit.com/sarc-f-questionnaire",
            "source_type": "Clinical screening questionnaire",
            "evidence_note": (
                "Опросник используется для скрининга риска саркопении. Общий балл 0–10. Порог 4 и выше указывает "
                "на повышенный риск и необходимость дальнейшей оценки."
            ),
            "scoring_method": "sum_scores",
            "is_standardized": True,
            "interpretation_rules": json.dumps(INTERPRETATION_RULES, ensure_ascii=False),
            "interpretation_schema": {
                "bands": [
                    {
                        "min_ratio": 0.4,
                        "label": "high_risk",
                        "title": "Повышенный риск саркопении",
                        "recommendation": HIGH_RISK_RECOMMENDATION,
                    },
                    {
                        "min_ratio": 0.0,
                        "label": "low_risk",
                        "title": "Низкий риск саркопении",
                        "recommendation": LOW_RISK_RECOMMENDATION,
                    },
                ]
            },
            "is_active": True,
            "approval_status": Questionnaire.APPROVAL_APPROVED,
            "min_completion_percent": 100,
            "target_condition_code": "SARCOPENIA_RISK",
            "kind": Questionnaire.KIND_SCREENING,
            "review_comment": "Seeded SARC-F as validated sarcopenia risk screening questionnaire.",
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

        expected_orders = {item["order"] for item in QUESTIONS}
        questionnaire.questions.exclude(order__in=expected_orders).delete()

        created_count = 0
        updated_count = 0
        for item in QUESTIONS:
            order = item["order"]
            text = item["text"]
            options = item["options"]
            question, q_created = Question.objects.get_or_create(
                questionnaire=questionnaire,
                order=order,
                defaults={
                    "text": text,
                    "text_ru": text,
                    "text_en": text,
                    "qtype": Question.SINGLE_CHOICE,
                    "is_required": True,
                    "score_yes": 0,
                    "score_no": 0,
                    "options": options,
                },
            )
            if q_created:
                created_count += 1
                continue
            question.text = text
            question.text_ru = text
            question.text_en = text
            question.qtype = Question.SINGLE_CHOICE
            question.is_required = True
            question.score_yes = 0
            question.score_no = 0
            question.options = options
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
