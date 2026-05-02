import json

from django.core.management.base import BaseCommand

from core.models import Disease, Question, Questionnaire

QUESTIONNAIRE_TITLE = "FRAIL Scale"
DISEASE_NAME = "Риск синдрома хрупкости"

LOW_RISK_RECOMMENDATION = (
    "Сейчас выраженных признаков синдрома хрупкости не выявлено. Рекомендуется сохранять регулярную физическую активность, "
    "следить за достаточным питанием и сообщать врачу, если появятся слабость, снижение выносливости или непреднамеренная потеря веса."
)

MODERATE_RISK_RECOMMENDATION = (
    "Есть признаки повышенного риска. Рекомендуется обсудить с врачом программу физической активности, упражнения на силу и баланс, "
    "а также достаточное питание."
)

HIGH_RISK_RECOMMENDATION = (
    "Рекомендуется обратиться к врачу для более полной оценки состояния, риска падений и функциональных ограничений. "
    "Полезно обсудить силовые упражнения, баланс/реабилитацию и индивидуальный план питания."
)

INTERPRETATION_RULES = [
    {
        "min": 0,
        "max": 0,
        "level": "Низкий риск синдрома хрупкости",
        "recommendation": LOW_RISK_RECOMMENDATION,
    },
    {
        "min": 1,
        "max": 2,
        "level": "Умеренный риск синдрома хрупкости (pre-frailty)",
        "recommendation": MODERATE_RISK_RECOMMENDATION,
    },
    {
        "min": 3,
        "max": 5,
        "level": "Высокий риск синдрома хрупкости",
        "recommendation": HIGH_RISK_RECOMMENDATION,
    },
]

QUESTIONS_RU = [
    "За последние 4 недели вы чувствовали усталость большую часть времени?",
    "Трудно ли вам без посторонней помощи подняться на 10 ступеней без остановки?",
    "Трудно ли вам без посторонней помощи пройти несколько сотен метров?",
    "Есть ли у вас пять или более хронических заболеваний?",
    "Была ли у вас непреднамеренная потеря веса более чем на 5% за последний год?",
]

QUESTIONS_EN = [
    "During the past 4 weeks, did you feel tired most of the time?",
    "Do you have difficulty climbing 10 steps without resting, without help from another person?",
    "Do you have difficulty walking several hundred meters without help from another person?",
    "Do you have five or more chronic diseases?",
    "Have you had unintentional weight loss of more than 5% over the past year?",
]


class Command(BaseCommand):
    help = "Create or update FRAIL Scale questionnaire (5 yes/no items, score = count of \"yes\")."

    def handle(self, *args, **kwargs):
        disease, disease_created = Disease.objects.get_or_create(
            name=DISEASE_NAME,
            defaults={"code": "FRAILTY_RISK", "is_active": True},
        )
        if not disease.is_active:
            disease.is_active = True
            disease.save(update_fields=["is_active"])

        questionnaire_defaults = {
            "title": QUESTIONNAIRE_TITLE,
            "title_en": QUESTIONNAIRE_TITLE,
            "title_ru": "Шкала FRAIL",
            "description": (
                "Короткий опросник для скрининга риска синдрома хрупкости у взрослых, особенно пожилых пациентов."
            ),
            "description_ru": (
                "Короткий опросник для скрининга риска синдрома хрупкости у взрослых, особенно пожилых пациентов."
            ),
            "description_en": (
                "A brief questionnaire for screening frailty syndrome risk in adults, especially older adults."
            ),
            "medical_area": "Гериатрия / Семейная медицина",
            "risk_target": (
                "Раннее выявление пациентов с признаками pre-frailty или frailty для дальнейшей оценки, профилактики падений "
                "и коррекции образа жизни."
            ),
            "source_name": "FRAIL Scale",
            "source_url": "https://doi.org/10.1016/j.jamda.2007.11.005",
            "source_type": "Clinical screening questionnaire",
            "evidence_note": (
                "Опросник FRAIL (Fatigue, Resistance, Ambulation, Illness, Loss of weight): 5 вопросов, ответ «Да» = 1 балл, "
                "«Нет» = 0. Сумма 0–5. Интерпретация: 0 — низкий риск; 1–2 — pre-frailty; 3–5 — frailty. "
                "Первичная публикация шкалы: Abellan van Kan G, et al. J Am Med Dir Assoc. 2008;9(2):71-72."
            ),
            "scoring_method": "count_yes",
            "is_standardized": True,
            "interpretation_rules": json.dumps(INTERPRETATION_RULES, ensure_ascii=False),
            "interpretation_schema": {
                "bands": [
                    {
                        "min_ratio": 0.6,
                        "label": "frailty_high",
                        "title": "Высокий риск синдрома хрупкости",
                        "recommendation": HIGH_RISK_RECOMMENDATION,
                    },
                    {
                        "min_ratio": 0.2,
                        "label": "pre_frailty",
                        "title": "Умеренный риск синдрома хрупкости (pre-frailty)",
                        "recommendation": MODERATE_RISK_RECOMMENDATION,
                    },
                    {
                        "min_ratio": 0.0,
                        "label": "low_frailty_risk",
                        "title": "Низкий риск синдрома хрупкости",
                        "recommendation": LOW_RISK_RECOMMENDATION,
                    },
                ]
            },
            "is_active": True,
            "approval_status": Questionnaire.APPROVAL_APPROVED,
            "min_completion_percent": 100,
            "target_condition_code": "FRAILTY_RISK",
            "kind": Questionnaire.KIND_SCREENING,
            "review_comment": "Seeded FRAIL Scale as validated frailty screening questionnaire (yes=1, no=0 per item).",
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

        expected_orders = set(range(1, len(QUESTIONS_RU) + 1))
        questionnaire.questions.exclude(order__in=expected_orders).delete()

        created_count = 0
        updated_count = 0
        for idx, text_ru in enumerate(QUESTIONS_RU, start=1):
            text_en = QUESTIONS_EN[idx - 1]
            question, q_created = Question.objects.get_or_create(
                questionnaire=questionnaire,
                order=idx,
                defaults={
                    "text": text_ru,
                    "text_ru": text_ru,
                    "text_en": text_en,
                    "qtype": Question.YESNO,
                    "is_required": True,
                    "score_yes": 1,
                    "score_no": 0,
                    "options": [],
                },
            )
            if q_created:
                created_count += 1
                continue
            question.text = text_ru
            question.text_ru = text_ru
            question.text_en = text_en
            question.qtype = Question.YESNO
            question.is_required = True
            question.score_yes = 1
            question.score_no = 0
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
