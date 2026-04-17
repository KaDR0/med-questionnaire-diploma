from django.core.management.base import BaseCommand
from core.models import Disease, Questionnaire, Question


SCREENING_QUESTIONNAIRES = [
    {
        "disease": {"name": "Depressive symptoms screening", "code": "DEP-SCR"},
        "questionnaire": {
            "version": "v1",
            "kind": "severity",
            "target_condition_code": "DEP-SCR",
            "min_completion_percent": 80,
            "interpretation_schema": {
                "bands": [
                    {"min_ratio": 0.75, "label": "high_risk", "title": "High depressive symptom burden", "recommendation": "Prompt mental health evaluation is recommended."},
                    {"min_ratio": 0.4, "label": "moderate_risk", "title": "Moderate depressive symptom burden", "recommendation": "Clinical follow-up and symptom reassessment are recommended."},
                    {"min_ratio": 0.0, "label": "low_risk", "title": "Low depressive symptom burden", "recommendation": "Continue routine monitoring."},
                ]
            },
            "title_en": "Depressive Symptoms Screener (PHQ-9 style)",
            "title_ru": "Скрининг депрессивных симптомов (в стиле PHQ-9)",
            "title_kk": "Депрессивті симптомдар скринингі (PHQ-9 стилі)",
            "description_en": "Symptom severity screening tool. Not a final diagnosis.",
            "description_ru": "Инструмент скрининга выраженности симптомов. Не является окончательным диагнозом.",
            "description_kk": "Симптом айқындығын скринингтеу құралы. Қорытынды диагноз емес.",
        },
        "questions": [
            {
                "en": "Little interest or pleasure in doing things",
                "ru": "Снижение интереса или удовольствия от повседневных дел",
                "kk": "Күнделікті істерге қызығушылықтың немесе ләззаттың төмендеуі",
            },
            {
                "en": "Feeling down, depressed, or hopeless",
                "ru": "Чувство подавленности, тоски или безнадежности",
                "kk": "Көңілдің түсуі, мұң немесе үмітсіздік сезімі",
            },
            {
                "en": "Trouble falling/staying asleep or sleeping too much",
                "ru": "Трудности с засыпанием/сном или чрезмерная сонливость",
                "kk": "Ұйықтап кету/ұйқыны сақтау қиындығы немесе шамадан тыс ұйқышылдық",
            },
            {
                "en": "Feeling tired or having little energy",
                "ru": "Повышенная усталость или нехватка энергии",
                "kk": "Шаршағыштық немесе қуаттың азаюы",
            },
            {
                "en": "Poor appetite or overeating",
                "ru": "Снижение аппетита или переедание",
                "kk": "Тәбеттің төмендеуі немесе артық тамақтану",
            },
            {
                "en": "Feeling bad about yourself",
                "ru": "Негативные мысли о себе, чувство вины",
                "kk": "Өзіңіз туралы теріс ойлар, кінә сезімі",
            },
            {
                "en": "Trouble concentrating",
                "ru": "Трудности с концентрацией внимания",
                "kk": "Зейінді шоғырландыру қиындығы",
            },
            {
                "en": "Moving/speaking slowly or restlessness noticed by others",
                "ru": "Замедленность движений/речи или выраженная суетливость",
                "kk": "Қимыл/сөйлеудің баяулауы немесе айқын мазасыз қимылдар",
            },
            {
                "en": "Thoughts of self-harm or that you would be better off dead",
                "ru": "Мысли о самоповреждении или о том, что лучше бы вас не было",
                "kk": "Өзіңізге зиян келтіру туралы немесе өмір сүрмеу жақсы деген ойлар",
            },
        ],
    },
    {
        "disease": {"name": "Anxiety symptoms screening", "code": "ANX-SCR"},
        "questionnaire": {
            "version": "v1",
            "kind": "severity",
            "target_condition_code": "ANX-SCR",
            "min_completion_percent": 80,
            "interpretation_schema": {
                "bands": [
                    {"min_ratio": 0.75, "label": "high_risk", "title": "High anxiety symptom burden", "recommendation": "Clinical attention and mental health follow-up are recommended."},
                    {"min_ratio": 0.4, "label": "moderate_risk", "title": "Moderate anxiety symptom burden", "recommendation": "Monitor symptoms and reassess at follow-up."},
                    {"min_ratio": 0.0, "label": "low_risk", "title": "Low anxiety symptom burden", "recommendation": "Continue routine observation."},
                ]
            },
            "title_en": "Anxiety Symptoms Screener (GAD-7 style)",
            "title_ru": "Скрининг тревожных симптомов (в стиле GAD-7)",
            "title_kk": "Мазасыздық симптомдары скринингі (GAD-7 стилі)",
            "description_en": "Anxiety severity screening tool. Not a final diagnosis.",
            "description_ru": "Инструмент скрининга выраженности тревоги. Не является окончательным диагнозом.",
            "description_kk": "Мазасыздық айқындығын скринингтеу құралы. Қорытынды диагноз емес.",
        },
        "questions": [
            {
                "en": "Feeling nervous, anxious, or on edge",
                "ru": "Чувство нервозности, тревоги или внутреннего напряжения",
                "kk": "Жүйкелік, мазасыздық немесе ішкі қысым сезімі",
            },
            {
                "en": "Not being able to stop or control worrying",
                "ru": "Невозможность остановить или контролировать беспокойство",
                "kk": "Уайымды тоқтата алмау немесе оны бақылау қиындығы",
            },
            {
                "en": "Worrying too much about different things",
                "ru": "Чрезмерное беспокойство по разным поводам",
                "kk": "Әртүрлі нәрселерге шамадан тыс уайымдау",
            },
            {
                "en": "Trouble relaxing",
                "ru": "Трудности с расслаблением",
                "kk": "Босаңсудың қиындығы",
            },
            {
                "en": "Being so restless that it is hard to sit still",
                "ru": "Выраженное беспокойство, трудно усидеть на месте",
                "kk": "Мазасыздықтың күшеюі, бір орында отырудың қиындығы",
            },
            {
                "en": "Becoming easily annoyed or irritable",
                "ru": "Легкая раздражительность",
                "kk": "Тез ашуланшақтық немесе тітіркенгіштік",
            },
            {
                "en": "Feeling afraid as if something awful might happen",
                "ru": "Чувство страха, будто должно случиться что-то плохое",
                "kk": "Бір жаман нәрсе болатын сияқты қорқыныш сезімі",
            },
        ],
    },
    {
        "disease": {"name": "Obstructive sleep apnea risk screening", "code": "OSA-RISK"},
        "questionnaire": {
            "version": "v1",
            "kind": "screening",
            "target_condition_code": "OSA-RISK",
            "min_completion_percent": 75,
            "interpretation_schema": {
                "bands": [
                    {"min_ratio": 0.625, "label": "high_risk", "title": "High risk of obstructive sleep apnea", "recommendation": "Consider sleep specialist referral and confirmatory diagnostics."},
                    {"min_ratio": 0.375, "label": "moderate_risk", "title": "Intermediate risk of obstructive sleep apnea", "recommendation": "Evaluate risk factors and monitor symptoms."},
                    {"min_ratio": 0.0, "label": "low_risk", "title": "Low risk of obstructive sleep apnea", "recommendation": "Continue routine follow-up."},
                ]
            },
            "title_en": "Sleep Apnea Risk Screener (STOP-Bang style)",
            "title_ru": "Скрининг риска апноэ сна (в стиле STOP-Bang)",
            "title_kk": "Ұйқы апноэ қаупі скринингі (STOP-Bang стилі)",
            "description_en": "Risk stratification for obstructive sleep apnea. Requires clinical confirmation.",
            "description_ru": "Стратификация риска обструктивного апноэ сна. Требуется клиническое подтверждение.",
            "description_kk": "Ұйқыдағы обструктивті апноэ қаупін бағалау. Клиникалық растау қажет.",
        },
        "questions": [
            {"en": "Do you snore loudly?", "ru": "Вы громко храпите?", "kk": "Сіз қатты қорылдайсыз ба?"},
            {
                "en": "Do you often feel tired or sleepy during daytime?",
                "ru": "Вы часто чувствуете усталость или сонливость днем?",
                "kk": "Күндіз жиі шаршау немесе ұйқышылдық сезінесіз бе?",
            },
            {
                "en": "Has anyone observed you stop breathing during sleep?",
                "ru": "Замечали ли у вас остановки дыхания во сне?",
                "kk": "Ұйқы кезінде тыныс тоқтауы байқалған ба?",
            },
            {
                "en": "Do you have or are you treated for high blood pressure?",
                "ru": "Есть ли у вас высокое артериальное давление или лечение от него?",
                "kk": "Сізде жоғары қан қысымы бар ма немесе соған ем алып жүрсіз бе?",
            },
            {"en": "Is your BMI above 35 kg/m2?", "ru": "Ваш ИМТ выше 35 кг/м2?", "kk": "Сіздің ДСИ 35 кг/м2-ден жоғары ма?"},
            {"en": "Are you older than 50 years?", "ru": "Ваш возраст старше 50 лет?", "kk": "Жасыңыз 50-ден асқан ба?"},
            {
                "en": "Is your neck circumference greater than 40 cm?",
                "ru": "Окружность вашей шеи больше 40 см?",
                "kk": "Мойын шеңбері 40 см-ден үлкен бе?",
            },
            {"en": "Are you male?", "ru": "Ваш пол мужской?", "kk": "Жынысыңыз ер адам ба?"},
        ],
    },
    {
        "disease": {"name": "Type 2 diabetes risk screening", "code": "T2DM-RISK"},
        "questionnaire": {
            "version": "v1",
            "kind": "screening",
            "target_condition_code": "T2DM-RISK",
            "min_completion_percent": 75,
            "interpretation_schema": {
                "bands": [
                    {"min_ratio": 0.72, "label": "high_risk", "title": "High risk of type 2 diabetes", "recommendation": "Consider laboratory screening (HbA1c/fasting glucose) and physician review."},
                    {"min_ratio": 0.43, "label": "moderate_risk", "title": "Moderate risk of type 2 diabetes", "recommendation": "Advise lifestyle interventions and interval reassessment."},
                    {"min_ratio": 0.0, "label": "low_risk", "title": "Low risk of type 2 diabetes", "recommendation": "Continue preventive monitoring."},
                ]
            },
            "title_en": "Type 2 Diabetes Risk Screener",
            "title_ru": "Скрининг риска сахарного диабета 2 типа",
            "title_kk": "2 типті қант диабеті қаупі скринингі",
            "description_en": "Risk screening questionnaire. Diabetes diagnosis requires lab criteria.",
            "description_ru": "Опросник для скрининга риска. Диагноз диабета требует лабораторных критериев.",
            "description_kk": "Қауіпті скринингтеу сауалнамасы. Диабет диагнозы зертханалық критерийлерге негізделеді.",
        },
        "questions": [
            {"en": "Are you 45 years old or older?", "ru": "Вам 45 лет и старше?", "kk": "Жасыңыз 45-тен жоғары ма?"},
            {"en": "Is your BMI 25 kg/m2 or higher?", "ru": "Ваш ИМТ 25 кг/м2 или выше?", "kk": "ДСИ 25 кг/м2 немесе одан жоғары ма?"},
            {
                "en": "Do you have low physical activity most days?",
                "ru": "У вас низкая физическая активность большую часть дней?",
                "kk": "Күндердің көбінде дене белсенділігі төмен бе?",
            },
            {
                "en": "Do you have a first-degree relative with diabetes?",
                "ru": "Есть ли у вас близкий родственник с диабетом?",
                "kk": "Жақын туыстарыңыздың арасында диабет бар ма?",
            },
            {
                "en": "Have you ever been told you have high blood glucose?",
                "ru": "Говорили ли вам когда-либо о повышенном уровне глюкозы?",
                "kk": "Сізге бұрын қандағы глюкоза жоғары деп айтылған ба?",
            },
            {
                "en": "Do you have high blood pressure or use antihypertensive medications?",
                "ru": "Есть ли у вас гипертония или прием антигипертензивных препаратов?",
                "kk": "Сізде гипертония бар ма немесе қан қысымын түсіретін дәрі қабылдайсыз ба?",
            },
            {
                "en": "For women: history of gestational diabetes or delivery of a baby >4 kg?",
                "ru": "Для женщин: был ли гестационный диабет или рождение ребенка >4 кг?",
                "kk": "Әйелдер үшін: гестациялық диабет немесе салмағы >4 кг бала туу жағдайы болды ма?",
            },
            {
                "en": "Do you currently smoke tobacco?",
                "ru": "Курите ли вы табак в настоящее время?",
                "kk": "Қазір темекі тартасыз ба?",
            },
        ],
    },
    {
        "disease": {"name": "Urgent symptom screening", "code": "URG-SCR"},
        "questionnaire": {
            "version": "v2",
            "kind": "screening",
            "target_condition_code": "URG-SCR",
            "min_completion_percent": 55,
            "interpretation_schema": {
                "bands": [
                    {
                        "min_ratio": 0.055,
                        "label": "high_risk",
                        "title": "Urgent symptoms reported",
                        "recommendation": "Follow clinical triage and in-person evaluation as indicated.",
                    },
                    {
                        "min_ratio": 0.0,
                        "label": "low_risk",
                        "title": "No urgent symptoms reported on this form",
                        "recommendation": "Continue routine care.",
                    },
                ]
            },
            "title_en": "Urgent symptoms (red flags)",
            "title_ru": "Срочные симптомы (тревожные признаки)",
            "title_kk": "Шұғыл симптомдар (қауіпті белгілер)",
            "description_en": "Extended yes/no triage (cardiovascular, neuro, GI, infection, metabolic, self-harm). Feeds risk-engine red flags. Not a diagnosis.",
            "description_ru": "Расширенный да/нет опрос для срочной сортировки (сердце, неврология, ЖКТ, инфекция, метаболизм, самоповреждение). Используется движком риска. Не диагноз.",
            "description_kk": "Кеңейтілген иә/жоқ триаж (жүрек, неврология, АІЖ, инфекция, метаболизм, өзіне зиян). Тәуекел қозғалтқышына беріледі. Диагноз емес.",
        },
        "questions": [
            {
                "en": "Do you have chest pain or pressure?",
                "ru": "Есть ли у вас боль или давление в груди?",
                "kk": "Кеудеде ауырсыну немесе қысым бар ма?",
            },
            {
                "en": "Are you short of breath more than usual at rest or with light effort?",
                "ru": "Есть ли одышка в покое или при лёгкой нагрузке сильнее обычного?",
                "kk": "Тыныштықта немесе жеңіл күште әдеттегіден артық тыныс қысқаруы бар ма?",
            },
            {
                "en": "Have you noticed blood in your stool or black tarry stools?",
                "ru": "Замечали ли кровь в стуле или чёрный дегтеобразный стул?",
                "kk": "Нәжісте қан немесе қара-қоңыр нәжіс байқадыңыз ба?",
            },
            {
                "en": "Have you fainted or lost consciousness recently?",
                "ru": "Были ли недавно обмороки или потеря сознания?",
                "kk": "Соңғы уақытта есінен тану немесе құлап қалу болды ма?",
            },
            {
                "en": "Is this the worst sudden headache of your life, or a thunderclap-like onset within seconds to a minute?",
                "ru": "Это самая сильная внезапная головная боль в жизни или «удар» за секунды–минуту?",
                "kk": "Бұл өмірдегі ең күшті кенет басталған бас ауыру ма, немесе секунд-минут ішінде «сокқы» сияқты ма?",
            },
            {
                "en": "Sudden weakness or numbness on one side of the face, arm, or leg?",
                "ru": "Внезапная слабость или онемение с одной стороны лица, руки или ноги?",
                "kk": "Беттің, қолдың немесе аяқтың бір жағында кенет әлсіздік немесе уйіту бар ма?",
            },
            {
                "en": "Sudden trouble speaking or understanding what others say?",
                "ru": "Внезапные трудности с речью или пониманием речи?",
                "kk": "Сөйлеу немесе сөзді түсіну бойынша кенет қиындық бар ма?",
            },
            {
                "en": "Sudden facial droop or uneven smile?",
                "ru": "Внезапный перекос лица или асимметричная улыбка?",
                "kk": "Беттің кенет бұрылысы немесе күлкі асимметриясы бар ма?",
            },
            {
                "en": "Fever with confusion, unusual drowsiness, or not thinking clearly?",
                "ru": "Лихорадка с спутанностью сознания, сонливостью или невозможностью ясно мыслить?",
                "kk": "Қызба мен сананың бұлыңғырлануы, әдеттен тыс ұйқышылдық немесе ойлаудың анық еместігі бар ма?",
            },
            {
                "en": "Unintentional weight loss (>5% body weight) in recent months without dieting?",
                "ru": "Непреднамеренная потеря веса (>5%) за последние месяцы без диеты?",
                "kk": "Соңғы айларда диетасыз дене салмағының >5% төмендеуі бар ма?",
            },
            {
                "en": "Blood visible in urine?",
                "ru": "Замечали кровь в моче?",
                "kk": "Зәрде қан көрдіңіз бе?",
            },
            {
                "en": "Severe, unrelenting abdominal pain?",
                "ru": "Сильная, нестихающая боль в животе?",
                "kk": "Күшті, басылмайтын іш ауырсынуы бар ма?",
            },
            {
                "en": "Repeated vomiting so you cannot keep fluids down?",
                "ru": "Повторная рвота, из-за которой нельзя сохранить жидкость?",
                "kk": "Сұйықтықты ұстай алмайтындай қайталап құсу бар ма?",
            },
            {
                "en": "Coughing up blood or blood-streaked sputum?",
                "ru": "Кашель с кровью или прожилками крови в мокроте?",
                "kk": "Қан немесе қан ізі бар балағыммен жөтелу бар ма?",
            },
            {
                "en": "Very frequent urination with intense thirst for days?",
                "ru": "Очень частое мочеиспускание с сильной жаждой в течение нескольких дней?",
                "kk": "Бірнеше күн бойы жиі зәр шығару мен қатты шөлдегендік бар ма?",
            },
            {
                "en": "Racing heartbeat with dizziness or near-fainting?",
                "ru": "Учащённое сердцебиение с головокружением или предобморочным состоянием?",
                "kk": "Жүректің соғуының жиілеуі бас айналуы немесе есінен тануға дейінгі күймен бірге бар ма?",
            },
            {
                "en": "Thoughts of hurting yourself or that you would be better off dead?",
                "ru": "Были ли мысли о причинении себе вреда или о том, что лучше бы вас не было?",
                "kk": "Өзіңізге зиян келтіру немесе өмір сүрмеу жақсы деген ойлар болды ма?",
            },
        ],
    },
]


QUESTION_METADATA_BY_DISEASE_CODE = {
    "DEP-SCR": {
        3: {"feature_key": "sleep_problem"},
        4: {"feature_key": "fatigue"},
        9: {
            "feature_key": "suicidal_ideation",
            "red_flag_level": "critical",
            "red_flag_message": "Self-harm thoughts reported in questionnaire",
        },
    },
    "ANX-SCR": {
        1: {"feature_key": "anxiety_score"},
        4: {"feature_key": "sleep_problem"},
    },
    "OSA-RISK": {
        1: {"feature_key": "osa_loud_snoring"},
        2: {"feature_key": "osa_daytime_sleepiness"},
        3: {"feature_key": "osa_observed_apnea"},
        4: {"feature_key": "hypertension"},
        5: {"feature_key": "osa_high_bmi_35"},
    },
    "T2DM-RISK": {
        3: {"feature_key": "low_activity"},
        6: {"feature_key": "hypertension"},
        8: {"feature_key": "smoking"},
    },
    "URG-SCR": {
        1: {"feature_key": "chest_pain"},
        2: {"feature_key": "dyspnea"},
        3: {"feature_key": "blood_in_stool"},
        4: {"feature_key": "syncope"},
        5: {"feature_key": "thunderclap_headache"},
        6: {"feature_key": "focal_weakness"},
        7: {"feature_key": "speech_trouble_acute"},
        8: {"feature_key": "facial_droop_acute"},
        9: {"feature_key": "fever_confusion"},
        10: {"feature_key": "unintentional_weight_loss"},
        11: {"feature_key": "hematuria"},
        12: {"feature_key": "severe_abdominal_pain"},
        13: {"feature_key": "persistent_vomiting"},
        14: {"feature_key": "hemoptysis"},
        15: {"feature_key": "polyuria_polydipsia"},
        16: {"feature_key": "palpitations_presyncope"},
        17: {
            "feature_key": "suicidal_ideation",
            "red_flag_level": "critical",
            "red_flag_message": "Self-harm thoughts reported in urgent triage questionnaire",
        },
    },
}


class Command(BaseCommand):
    help = "Seed medically reasonable screening questionnaires and questions."

    def handle(self, *args, **kwargs):
        q_created = 0
        q_updated = 0
        question_created = 0
        question_updated = 0

        for item in SCREENING_QUESTIONNAIRES:
            disease_obj, _ = Disease.objects.get_or_create(
                code=item["disease"]["code"],
                defaults={
                    "name": item["disease"]["name"],
                    "is_active": True,
                },
            )
            if disease_obj.name != item["disease"]["name"]:
                disease_obj.name = item["disease"]["name"]
                disease_obj.is_active = True
                disease_obj.save(update_fields=["name", "is_active"])

            questionnaire_obj, created = Questionnaire.objects.get_or_create(
                disease=disease_obj,
                version=item["questionnaire"]["version"],
                defaults={
                    "title_en": item["questionnaire"]["title_en"],
                    "title_ru": item["questionnaire"]["title_ru"],
                    "title_kk": item["questionnaire"]["title_kk"],
                    "description_en": item["questionnaire"]["description_en"],
                    "description_ru": item["questionnaire"]["description_ru"],
                    "description_kk": item["questionnaire"]["description_kk"],
                    "title": item["questionnaire"]["title_en"],
                    "description": item["questionnaire"]["description_en"],
                    "is_active": True,
                    "kind": item["questionnaire"]["kind"],
                    "target_condition_code": item["questionnaire"]["target_condition_code"],
                    "interpretation_schema": item["questionnaire"]["interpretation_schema"],
                    "min_completion_percent": item["questionnaire"]["min_completion_percent"],
                },
            )

            if created:
                q_created += 1
            else:
                questionnaire_obj.title_en = item["questionnaire"]["title_en"]
                questionnaire_obj.title_ru = item["questionnaire"]["title_ru"]
                questionnaire_obj.title_kk = item["questionnaire"]["title_kk"]
                questionnaire_obj.description_en = item["questionnaire"]["description_en"]
                questionnaire_obj.description_ru = item["questionnaire"]["description_ru"]
                questionnaire_obj.description_kk = item["questionnaire"]["description_kk"]
                questionnaire_obj.title = item["questionnaire"]["title_en"]
                questionnaire_obj.description = item["questionnaire"]["description_en"]
                questionnaire_obj.is_active = True
                questionnaire_obj.kind = item["questionnaire"]["kind"]
                questionnaire_obj.target_condition_code = item["questionnaire"]["target_condition_code"]
                questionnaire_obj.interpretation_schema = item["questionnaire"]["interpretation_schema"]
                questionnaire_obj.min_completion_percent = item["questionnaire"]["min_completion_percent"]
                questionnaire_obj.save()
                q_updated += 1

            expected_orders = set(range(1, len(item["questions"]) + 1))
            existing_questions = Question.objects.filter(questionnaire=questionnaire_obj)

            # Keep table clean and deterministic by removing excess questions.
            existing_questions.exclude(order__in=expected_orders).delete()

            for order, question_text in enumerate(item["questions"], start=1):
                metadata = QUESTION_METADATA_BY_DISEASE_CODE.get(item["disease"]["code"], {}).get(order, {})
                question_obj, q_created_flag = Question.objects.get_or_create(
                    questionnaire=questionnaire_obj,
                    order=order,
                    defaults={
                        "qtype": Question.YESNO,
                        "score_yes": 1,
                        "score_no": 0,
                        "text_en": question_text["en"],
                        "text_ru": question_text["ru"],
                        "text_kk": question_text["kk"],
                        "text": question_text["en"],
                        "feature_key": metadata.get("feature_key", ""),
                        "red_flag_level": metadata.get("red_flag_level", ""),
                        "red_flag_message": metadata.get("red_flag_message", ""),
                    },
                )

                if q_created_flag:
                    question_created += 1
                    continue

                question_obj.qtype = Question.YESNO
                question_obj.score_yes = 1
                question_obj.score_no = 0
                question_obj.text_en = question_text["en"]
                question_obj.text_ru = question_text["ru"]
                question_obj.text_kk = question_text["kk"]
                question_obj.text = question_text["en"]
                question_obj.feature_key = metadata.get("feature_key", "")
                question_obj.red_flag_level = metadata.get("red_flag_level", "")
                question_obj.red_flag_message = metadata.get("red_flag_message", "")
                question_obj.save()
                question_updated += 1

        # URG-SCR v2 supersedes older rows: delete legacy questionnaires with no assessments (CASCADE removes
        # questions). Rows still referenced by assessments stay in DB (PROTECT) and are only deactivated.
        latest_urg = (
            Questionnaire.objects.filter(disease__code="URG-SCR", version="v2")
            .order_by("-id")
            .first()
        )
        if latest_urg:
            deleted = 0
            deactivated = 0
            for old in Questionnaire.objects.filter(disease__code="URG-SCR").exclude(pk=latest_urg.pk):
                if old.assessments.exists():
                    if old.is_active:
                        old.is_active = False
                        old.save(update_fields=["is_active"])
                    deactivated += 1
                else:
                    old.delete()
                    deleted += 1
            n_q = Question.objects.filter(questionnaire=latest_urg).count()
            self.stdout.write(
                f"URG-SCR: active questionnaire id={latest_urg.id} (v2, {n_q} questions); "
                f"deleted superseded without assessments: {deleted}; "
                f"inactive kept (has assessment history): {deactivated}"
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Screening questionnaires seeded. "
                f"Created: {q_created}, Updated: {q_updated}, "
                f"Questions created: {question_created}, Questions updated: {question_updated}"
            )
        )
