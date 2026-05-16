# Med Questionnaire — Техническая документация проекта

> Документ подготовлен для отчёта, защиты диплома и технического описания системы.  
> Проект: full-stack платформа медицинского скрининга и оценки рисков пациента.

---

## Содержание

1. [Общая архитектура проекта](#1-общая-архитектура-проекта)
2. [Структура проекта по папкам и файлам](#2-структура-проекта-по-папкам-и-файлам)
3. [Django: детальное описание](#3-django-детальное-описание)
4. [Frontend](#4-frontend)
5. [База данных](#5-база-данных)
6. [Технический стек](#6-технический-стек)
7. [Бизнес-логика](#7-бизнес-логика)
8. [Пошаговая работа системы](#8-пошаговая-работа-системы)
9. [Слабые места и направления развития](#9-слабые-места-и-направления-развития)
10. [Текст для отчёта (академический стиль)](#10-текст-для-отчёта-академический-стиль)

---

# 1. Общая архитектура проекта

## 1.1. Что это за проект

**Med Questionnaire** — веб-платформа для:

- ведения карточек пациентов;
- назначения и прохождения медицинских опросников;
- импорта лабораторных данных из Excel;
- расчёта клинических находок (findings) и красных флагов (red flags);
- формирования риск-профиля и клинического статуса пациента;
- рекомендаций (CDS-подобная логика);
- аудита действий и управления ролями.

Проект **не предназначен** для реальной клинической диагностики без валидации врачом — это учебно-демонстрационная система с элементами clinical decision support.

## 1.2. Какую задачу решает

Цепочка бизнес-цели:

**данные пациента → оценка (assessment) → риск-профиль → клинический статус → приоритизация и рекомендации**

Врач создаёт/импортирует пациента, назначает опросник, пациент заполняет его в личном кабинете, система считает баллы, интерпретацию, правила риска, обновляет статус (`stable` / `monitoring` / `attention` / `critical`).

## 1.3. Основные части

| Часть | Технология | Назначение |
|--------|------------|------------|
| **Frontend (SPA)** | React 19 + Vite 8 + MUI 9 | UI для врача, главврача, пациента |
| **Backend (API)** | Django 4.2–6 + DRF + SimpleJWT | REST API, бизнес-логика, PDF/Excel |
| **База данных** | SQLite (dev) / PostgreSQL (prod) | Хранение доменных сущностей |
| **Клинические движки** | Python-модули в `core/` | Rules + ML overlay |
| **Статика** | WhiteNoise | Раздача статики в production |
| **Email** | Django mail (console/SMTP) | OTP-коды, уведомления о назначениях |

**Не используется в активном коде:** Firebase (упомянут в корневом README, но в frontend нет SDK; `firebase-service-account.json` в `.gitignore`). Старый server-rendered UI (`core/views.py` + HTML-шаблоны) **не подключён** к URL.

## 1.4. Взаимодействие компонентов

```
┌─────────────┐     JSON + JWT      ┌──────────────┐     ORM/SQL     ┌────────────┐
│   Browser   │ ──────────────────► │ Django REST  │ ──────────────► │  Database  │
│  React SPA  │ ◄────────────────── │     API      │ ◄────────────── │ SQLite/PG  │
└─────────────┘                     └──────────────┘                 └────────────┘
       │                                    │
       │  /api (Vite proxy в dev)           ├── ml_artifacts/*.joblib
       └────────────────────────────────────├── Email (OTP, assignments)
```

1. Пользователь открывает React-приложение (`http://localhost:5173`).
2. `axios` шлёт запросы на `/api/...` (в dev — прокси на `127.0.0.1:8000`).
3. Django проверяет JWT (`Authorization: Bearer`), роль (`DoctorProfile.role`), права на пациента.
4. View вызывает сервисы (`services.py`, `risk_engine.py`, …), читает/пишет ORM-модели.
5. Ответ — JSON (или PDF/Excel как binary).
6. Frontend обновляет UI (таблицы, графики, формы).

---

# 2. Структура проекта по папкам и файлам

## 2.1. Корень репозитория

| Путь | Роль |
|------|------|
| `README.md` | Обзор, установка, стек (частично устарел про Firebase) |
| `DEPLOY.md` | Деплой на Render + Vercel |
| `TESTING.md` | Чеклист ручного E2E-тестирования |
| `.gitignore` | Исключает `db.sqlite3`, `.env`, venv, Firebase JSON |
| `med-questionnaire/` | Backend Django |
| `frontend/` | Frontend React |

## 2.2. Backend: `med-questionnaire/`

### `manage.py`

Точка входа Django CLI: `migrate`, `runserver`, management commands.

### `config/` — конфигурация проекта

| Файл | Роль | Связи |
|------|------|-------|
| `settings.py` | Apps, DB, CORS, JWT, email, OTP, timezone | Читает `.env` через `python-dotenv` |
| `urls.py` | Корневой роутинг: `admin/`, `api/auth/`, `api/` | Подключает `core.auth_urls`, `core.api_urls` |
| `wsgi.py` / `asgi.py` | WSGI/ASGI для Gunicorn/uWSGI | `DJANGO_SETTINGS_MODULE=config.settings` |

### `core/` — единственное доменное приложение

| Файл/папка | Роль |
|------------|------|
| **`models.py`** | Все ORM-модели (пациенты, опросники, оценки, риски, лабы) |
| **`api_views.py`** | Основные DRF API (~1500+ строк) |
| **`api_urls.py`** | Маршруты `/api/*` |
| **`auth_views.py`** | Логин, OTP, signup, profile (~850 строк) |
| **`auth_urls.py`** | Маршруты `/api/auth/*` |
| **`serializers.py`** | Валидация и сериализация JSON |
| **`permissions.py`** | RBAC: `get_user_role`, `permitted_patients_queryset` |
| **`services.py`** | Scoring assessment, PDF, Excel import |
| **`risk_engine.py`** | Rule-based findings/red flags + вызов ML |
| **`ml_risk.py`** | Загрузка `.joblib`, probability/confidence |
| **`patient_clinical_status.py`** | Пересчёт `Patient.status` |
| `lab_recommendation_engine.py` | Рекомендации по лаборатории |
| `questionnaire_recommendation_engine.py` | Рекомендации по опросникам |
| `combined_recommendation_engine.py` | Комбинированные правила |
| `patient_recommendation_engine.py` | Полный bundle рекомендаций |
| **`verification.py`** | OTP: создание/проверка кодов |
| **`trusted_device.py`** | Cookie «запомнить устройство» |
| **`assignment_mail.py`** | Email при назначении опросника |
| **`admin.py`** | Django Admin для части моделей |
| **`apps.py`** | Регистрация приложения `CoreConfig` |
| **`views.py`** | **Legacy** server-rendered views (не в URL) |
| **`urls.py`** | **Legacy** маршруты (не подключены) |
| **`templates/core/*.html`** | **Legacy** HTML (6 файлов) |
| **`migrations/`** | 30 миграций (0001–0030) |
| **`management/commands/`** | Seed, import, train ML |
| **`tests.py`** | Обширные API/движковые тесты |
| **`ml_artifacts/`** | Опционально на runtime (не в git) |

**Отсутствует:** `forms.py` — формы Django не используются (только DRF serializers).

### Management commands

| Команда | Назначение |
|---------|------------|
| `clear_verification_throttle` | Сброс OTP-лимитов для email |
| `import_patients_excel` | Импорт пациентов из Excel |
| `seed_lab_indicators` | Справочник лабораторных показателей |
| `seed_screening_questionnaires` | Скрининговые опросники |
| `seed_sarc_f_questionnaire` | Опросник SARC-F |
| `seed_frail_scale_questionnaire` | Шкала frailty |
| `seed_type2_diabetes_questionnaire` | Опросник СД 2 типа |
| `train_risk_ml` | Обучение ML → `ml_artifacts/*.joblib` |

## 2.3. Frontend: `frontend/`

| Путь | Роль |
|------|------|
| `index.html` | Точка входа, шрифты Google |
| `vite.config.js` | Dev-server, proxy `/api` → `:8000` |
| `package.json` | npm-скрипты и зависимости |
| `.env.example` | `VITE_API_BASE_URL`, `VITE_PUBLIC_SITE_URL` |
| `src/main.jsx` | ThemeProvider, AuthProvider, Snackbar, ErrorBoundary |
| `src/App.jsx` | React Router — все маршруты |
| `src/api/axios.js` | HTTP-клиент, JWT refresh, `Accept-Language` |
| `src/context/AuthContext.jsx` | Состояние авторизации |
| `src/i18n.js` | Переводы en/ru/kk (~4600 строк) |
| `src/theme/appTheme.js` | MUI theme (медицинская палитра) |
| `src/index.css` | Глобальные стили, анимации |
| `src/pages/` | 22 страницы |
| `src/components/` | Shells, UI-kit, charts, patient-компоненты |
| `src/utils/` | Toast, интерпретация assessment, подписи рисков |

**Не используются:** `src/App.css` (шаблон Vite), `Navbar.jsx`, `Footer.jsx` (заменены `AppShell` / `PatientShell`).

---

# 3. Django: детальное описание

## 3.1. `manage.py`

Устанавливает `DJANGO_SETTINGS_MODULE=config.settings` и вызывает `execute_from_command_line`.

## 3.2. `settings.py`

### INSTALLED_APPS

- Django: `admin`, `auth`, `contenttypes`, `sessions`, `messages`, `staticfiles`
- Third-party: `rest_framework`, `corsheaders`
- Local: `core`

### DATABASE

- Если `DATABASE_URL` задан → PostgreSQL через `dj-database-url`
- Иначе → `db.sqlite3` в корне `med-questionnaire/`

### REST_FRAMEWORK

```python
DEFAULT_AUTHENTICATION_CLASSES = ("rest_framework_simplejwt.authentication.JWTAuthentication",)
DEFAULT_PERMISSION_CLASSES = ("rest_framework.permissions.IsAuthenticated",)
```

### Прочие настройки

- `TIME_ZONE = Asia/Almaty`
- CORS/CSRF для Vite-портов (5173, 5175)
- OTP: `VERIFICATION_CODE_TTL_SECONDS`, `MAX_ATTEMPTS`, cooldown, hourly cap
- Trusted device: `PATIENT_TRUSTED_DEVICE_*`
- Email: `EMAIL_*`, `PATIENT_PORTAL_BASE_URL`

### MIDDLEWARE (порядок)

1. SecurityMiddleware  
2. WhiteNoiseMiddleware  
3. CorsMiddleware  
4. SessionMiddleware  
5. CommonMiddleware  
6. CsrfViewMiddleware  
7. AuthenticationMiddleware  
8. MessageMiddleware  
9. XFrameOptionsMiddleware  

## 3.3. `urls.py` (маршрутизация)

### Активная схема (`config/urls.py`)

```
/admin/          → Django Admin
/api/auth/       → core.auth_urls
/api/            → core.api_urls
```

### Legacy (`core/urls.py`)

Patient list, questionnaire HTML, PDF — **не включены** в root URLconf.

### Auth endpoints (`/api/auth/`)

| Path | View | Примечание |
|------|------|------------|
| `register/`, `signup/` | SignupAPIView | **410 Gone** (legacy) |
| `login/` | LoginAPIView | Password; может вернуть 2FA challenge |
| `logout/` | LogoutAPIView | JWT logout |
| `token/refresh/`, `refresh/` | TokenRefreshView | SimpleJWT |
| `me/` | MeAPIView | Текущий пользователь |
| `profile/` | DoctorProfileUpdateAPIView | PATCH |
| `profile-photo/` | DoctorProfilePhotoAPIView | PATCH |
| `verification/send-code/` | VerificationCodeSendAPIView | OTP |
| `verification/check-code/` | VerificationCodeCheckAPIView | OTP |
| `login/verify-code/` | LoginVerifyCodeAPIView | Завершение 2FA |
| `patient-signup/request-code/`, `verify-code/` | Patient signup OTP | |
| `doctor-signup/request-code/`, `verify-code/` | Doctor signup OTP | Создаёт ROLE_PENDING |

### API endpoints (`/api/`) — группы

| Группа | Примеры |
|--------|---------|
| Patient portal | `patient/questionnaire-assignments/`, `assessments/submit/` |
| Patients | CRUD, intake, PDF, import, link-user, labs, notes, risk |
| Questionnaires | CRUD, questions, approval workflow, archive |
| Assessments | detail, risk, PDF |
| Labs / diseases | indicators, template, import |
| Recommendations | `patients/<id>/recommendations/` |
| Admin | `dashboard/stats/`, `audit-logs/`, `users/roles/` |
| Assignments | `questionnaire-assignments/` |

## 3.4. `wsgi.py` / `asgi.py`

Стандартные обёртки для production: `gunicorn config.wsgi:application`.

## 3.5. `views.py` vs `api_views.py`

| Модуль | Статус | Содержание |
|--------|--------|------------|
| `views.py` | Legacy | Function-based views + ReportLab/openpyxl для HTML UI |
| `api_views.py` | **Активный** | Class-based DRF views для SPA |

### Основные классы в `api_views.py`

- `PatientListAPIView`, `PatientDetailAPIView`, `PatientUpdateAPIView`, `PatientIntakeAPIView`
- `PatientImportAPIView`, `PatientPdfAPIView`, `PatientDeleteAPIView`
- `QuestionnaireListAPIView`, `QuestionnaireDetailAPIView`, approval views
- `SubmitAssessmentAPIView`
- `PatientLabResultsAPIView`, `PatientLabTrendAPIView`, `LabImportAPIView`
- `PatientRiskProfileAPIView`, `PatientRiskHistoryAPIView`
- `QuestionnaireAssignmentListCreateAPIView`, `MyQuestionnaireAssignmentsAPIView`
- `DashboardStatsAPIView`, `AuditLogListAPIView`, `UserRoleListAPIView`, `AssignUserRoleAPIView`

## 3.6. `forms.py`

**Отсутствует** — валидация через `serializers.py`.

## 3.7. `admin.py`

**Зарегистрированы:** Disease, Questionnaire, Question, Patient, Assessment, Answer, PatientNote, LabIndicator, LabResult, LabValue, QuestionnaireAssignment.

**Не в admin:** DoctorProfile, DoctorOrder, DoctorOrderRevision, RecommendationTemplate, PatientRiskProfile, RiskFinding, RiskRedFlag, AuditLog, EmailVerificationCode, PatientTrustedDevice.

## 3.8. `apps.py`

`CoreConfig` — стандартная регистрация приложения `core`.

## 3.9. `migrations/`

30 файлов. Значимые этапы:

- `0001_initial` — базовая схема
- `0011` — risk engine + lab dictionary
- `0018` — роль `admin` → `chief_doctor`
- `0027–0029` — QuestionnaireAssignment
- `0030` — удаление `QuestionnaireSession` (старый публичный токен-флоу)

## 3.10. Templates и static

- **Templates:** `core/templates/core/` — 6 HTML для legacy UI. **Не используются** SPA.
- **Static:** `STATIC_ROOT`, WhiteNoise compressed manifest — для admin/production.

## 3.11. Authentication / Authorization

### Роли (`DoctorProfile.role`)

| Роль | Описание |
|------|----------|
| `pending` | Врач после регистрации, ждёт назначения роли |
| `doctor` | Врач |
| `chief_doctor` | Главврач (+ Django superuser) |
| `patient` | Пациент |

### Аутентификация

1. `POST /api/auth/login/` — email + password  
2. Для `patient` / `doctor` / `chief_doctor` — email OTP (2FA), если нет trusted device  
3. `POST /api/auth/login/verify-code/` — выдача JWT  
4. Access/refresh в `localStorage` (`mq_access_token`, `mq_refresh_token`)  
5. Refresh: `/api/auth/token/refresh/`  

### Signup

- **Пациент:** OTP + привязка к существующему `Patient` по `patient_code` + email  
- **Врач:** OTP → `User` + `ROLE_PENDING`  
- Legacy `register/` / `signup/` → **410 Gone**  

### Авторизация API

- `permitted_patients_queryset()` — врач видит только своих/созданных пациентов; пациент — только себя  
- Permission classes: `IsDoctorOrAbove`, `IsChiefDoctorOrAdmin`, `IsPatient`  

---

# 4. Frontend

## 4.1. Структура

```
frontend/src/
├── main.jsx, App.jsx
├── api/axios.js
├── context/AuthContext.jsx
├── theme/appTheme.js
├── i18n.js
├── pages/          (22 страницы)
├── components/
│   ├── AppShell, PatientShell
│   ├── ProtectedRoute, RoleRoute
│   ├── ui/         (дизайн-система)
│   ├── charts/
│   └── patient/
└── utils/
```

## 4.2. Маршруты (React Router)

| Path | Auth | Role(s) | Компонент |
|------|------|---------|-----------|
| `/login` | Public | — | LoginPage |
| `/signup`, `/signup/patient`, `/signup/doctor` | Public | — | Signup pages |
| `/about` | Public | — | AboutPage |
| `/awaiting-approval` | Protected | pending | AwaitingApprovalPage |
| `/` | Protected | non-patient | DashboardPage |
| `/patient/*` | Protected | patient | PatientPortalPage |
| `/patients`, `/patients/:id` | Protected | doctor, chief_doctor | PatientsPage, PatientDetailPage |
| `/questionnaires/my`, `/create`, `/:id/edit` | Protected | doctor, chief_doctor | Questionnaire pages |
| `/questionnaires/pending`, `/archive`, `/review/:id` | Protected | chief_doctor | Chief workflow |
| `/audit-log`, `/users/roles` | Protected | chief_doctor | Admin pages |
| `/profile` | Protected | doctor, chief, pending | ProfilePage |

## 4.3. Основные страницы

| Страница | Назначение |
|----------|------------|
| LoginPage | Вход + OTP 2FA |
| PatientSignupPage / DoctorSignupPage | OTP-регистрация |
| DashboardPage | KPI врача/главврача |
| PatientsPage | Список, создание, импорт Excel |
| PatientDetailPage | Полная клиническая карточка |
| QuestionnaireBuilderPage | Конструктор опросника |
| MyQuestionnairesPage | Опросники врача |
| PendingQuestionnairesPage | Очередь на утверждение |
| QuestionnaireReviewPage | Approve / reject / request changes |
| QuestionnaireFormPage | Заполнение опросника |
| AssessmentResultPage | Результат + риск + PDF |
| PatientPortalPage | Кабинет пациента (sections) |
| AuditLogPage | Журнал аудита |
| UserRoleManagementPage | Назначение ролей |

## 4.4. Компоненты

- **Layout:** AppShell, PatientShell, TopBar, SidebarNav, BreadcrumbsBar, UserMenu  
- **Guards:** ProtectedRoute, RoleRoute  
- **UI-kit:** DataTable, KpiCard, EmptyState, LoadingSkeleton, PageHeader  
- **Domain:** PatientQuestionnaireAssignmentsCard, MedicalLineChart, RiskTimelineChart  

## 4.5. Стили

- **MUI v9** + `sx` prop, `appTheme.js` (teal `#0b5c6d`)  
- **index.css** — фон workspace, анимации, `prefers-reduced-motion`  
- **notistack** — уведомления через `useToast`  

## 4.6. Связь с backend

```javascript
// axios.js
baseURL: VITE_API_BASE_URL || "/api/"
withCredentials: true  // trusted device cookie
// Request: Authorization: Bearer + Accept-Language
// 401 → refresh token → retry
```

Vite proxy в dev:

```javascript
proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } }
```

---

# 5. База данных

## 5.1. Схема связей (текстовая ER)

```
Disease 1──* Questionnaire 1──* Question
User 1──1 DoctorProfile
User 1──0..1 Patient
Patient 1──* Assessment *──1 Questionnaire
Assessment 1──* Answer *──1 Question
Patient 1──* LabResult 1──* LabValue *──1 LabIndicator
Patient 1──0..1 DoctorOrder
Patient 1──* DoctorOrderRevision
Patient 1──* PatientRiskProfile 1──* RiskFinding
PatientRiskProfile 1──* RiskRedFlag
Patient 1──* QuestionnaireAssignment *──1 Questionnaire
QuestionnaireAssignment 0..1──1 Assessment (result_assessment)
```

## 5.2. Таблицы и ключевые поля

### Disease

| Поле | Тип | Описание |
|------|-----|----------|
| name | CharField | Название |
| code | CharField | Код |
| is_active | BooleanField | Активность |

### Questionnaire

| Поле | Тип | Описание |
|------|-----|----------|
| disease_id | FK | Нозология |
| title_en/ru/kk | CharField | Локализованные названия |
| version | CharField | Версия |
| kind | CharField | screening / severity / followup |
| interpretation_schema | JSONField | Правила интерпретации |
| approval_status | CharField | draft → pending → approved / rejected / archived |
| created_by, approved_by | FK User | Авторство |

### Question

| Поле | Тип | Описание |
|------|-----|----------|
| questionnaire_id | FK | Опросник |
| order | PositiveSmallIntegerField | Порядок |
| qtype | CharField | yesno / single_choice / number / text |
| options | JSONField | Варианты ответов |
| score_yes, score_no | IntegerField | Баллы |
| feature_key | CharField | Ключ для risk engine |
| red_flag_level, red_flag_message | CharField | Срочные флаги |

### Patient

| Поле | Тип | Описание |
|------|-----|----------|
| patient_code | CharField unique | ID пациента |
| full_name, email | | Идентификация |
| age, sex, height_cm, weight_kg | | Антропометрия |
| status | CharField | stable / monitoring / attention / critical |
| next_visit_date | DateField | Следующий визит |
| data | JSONField | Доп. данные |
| user_id | O2O User | Аккаунт портала |
| assigned_doctor_id | FK User | Лечащий врач |

### Assessment

| Поле | Тип | Описание |
|------|-----|----------|
| patient_id, questionnaire_id | FK | Связи |
| total_score | IntegerField | Сумма баллов |
| completion_percent | FloatField | % заполнения |
| quality_flag | CharField | valid / partial / invalid |
| interpretation | JSONField | Результат по схеме |
| conclusion | CharField | Краткий вывод |

### Answer

| Поле | Тип | Описание |
|------|-----|----------|
| assessment_id, question_id | FK | |
| value | CharField | Ответ |
| score | IntegerField | Балл |
| unique_together | (assessment, question) | |

### LabIndicator / LabResult / LabValue

Справочник показателей с нормами; результаты по датам; значения с FK на indicator.

### PatientRiskProfile / RiskFinding / RiskRedFlag

Снимок риска после assessment; findings с `problem_code`, `risk_level`, ML fields; red flags с `urgency_level`.

### QuestionnaireAssignment

| Поле | Тип | Описание |
|------|-----|----------|
| patient_id, questionnaire_id | FK | |
| status | CharField | assigned / in_progress / completed / expired / cancelled |
| due_date | DateField | Срок |
| result_assessment_id | FK | Связь с результатом |
| constraint | unique active (patient, questionnaire) | |

### Служебные модели

- **AuditLog** — аудит действий  
- **EmailVerificationCode** — OTP (хеш кода)  
- **PatientTrustedDevice** — «запомнить устройство»  
- **RecommendationTemplate** — шаблоны рекомендаций CDS  

## 5.3. CRUD-паттерны

| Сущность | Create | Read | Update | Delete |
|----------|--------|------|--------|--------|
| Patient | POST /api/patients/ | list/detail | PATCH update, intake | DELETE |
| Questionnaire | POST (draft) | list/detail/questions | PATCH | DELETE (draft) |
| Assessment | POST assessments/submit/ | detail, trend | — | — |
| Labs | POST labs/import/ | list, trend | PATCH value | DELETE result |
| Assignment | POST questionnaire-assignments/ | lists | status | cancel |
| Risk profile | auto после submit | risk-profile/, history | recompute | cascade |

---

# 6. Технический стек

## Backend

| Компонент | Версия/пакет |
|-----------|--------------|
| Python | 3.10+ |
| Django | 4.2–6 |
| Django REST Framework | ≥3.14 |
| SimpleJWT | в коде (не в requirements.txt) |
| django-cors-headers | ≥4.0 |
| whitenoise | ≥6.7 |
| dj-database-url | ≥2.2 |
| scikit-learn, numpy, joblib | ML |
| openpyxl, reportlab | Excel/PDF (не в requirements.txt) |
| gunicorn, psycopg2-binary | Production |

## Frontend

| Компонент | Версия |
|-----------|--------|
| React | 19 |
| Vite | 8 |
| React Router | 7 |
| MUI | 9 |
| Axios | 1.15 |
| i18next | 26 |
| notistack | 3 |

## База данных

- Development: **SQLite** (`db.sqlite3`)  
- Production: **PostgreSQL** (`DATABASE_URL`)  

## Запуск проекта

```bash
# Backend (терминал 1)
cd med-questionnaire
python3 -m venv .venv && source .venv/bin/activate
cp .env.example .env
pip install -r requirements.txt
pip install openpyxl reportlab djangorestframework-simplejwt
python manage.py migrate
python manage.py runserver

# Frontend (терминал 2)
cd frontend
cp .env.example .env
npm install
npm run dev
```

- Backend: http://127.0.0.1:8000/  
- Frontend: http://localhost:5173/  

---

# 7. Бизнес-логика

## 7.1. Роли и функции

| Роль | Функции |
|------|---------|
| pending | Ожидание одобрения, профиль |
| doctor | Пациенты, назначения, опросники, лабы, PDF, заметки |
| chief_doctor | + утверждение опросников, архив, аудит, роли |
| patient | Кабинет: опросники, результаты, лабы, рекомендации |

## 7.2. Сценарий: врач

1. Регистрация (OTP) → `pending` → chief назначает `doctor`  
2. Логин (возможен OTP 2FA)  
3. Dashboard → Patients → создать/импортировать пациента  
4. Карточка → назначить **approved** опросник  
5. Просмотр assessment, риск-профиля, PDF, doctor order  

## 7.3. Сценарий: главврач

- Всё как врач + Pending Questionnaires → approve/reject  
- User roles, Audit log, Archive  

## 7.4. Сценарий: пациент

1. Регистрация по `patient_code` + email  
2. Логин (OTP / trusted device)  
3. Portal → опросники → заполнение → результат  

## 7.5. Конструктор опросника

1. Создать draft → вопросы, scoring, metadata  
2. Submit for approval → chief review → `approved`  
3. Только approved можно назначать пациентам  

## 7.6. Обработка submit assessment

1. `POST /api/assessments/submit/` с answers  
2. Проверка `QuestionnaireAssignment` (активное назначение)  
3. `calculate_and_save_assessment()` — баллы, interpretation, Assessment + Answer  
4. `calculate_and_store_risk_profile()` — findings, red flags, ML overlay  
5. `refresh_patient_clinical_status()` — обновление Patient.status  
6. Assignment → completed, `result_assessment`  

## 7.7. Клинический движок (принцип)

- **Правила первичны:** findings и red flags создаются rule-based логикой  
- **ML вторичен:** добавляет `ml_probability` и `confidence_score`, не создаёт новые findings самостоятельно  
- Источники: ответы опросника, BMI, лаборатории, assessment scores, просроченные визиты  

---

# 8. Пошаговая работа системы

## 8.1. Запуск

1. `manage.py` загружает `config.settings`  
2. Middleware chain (CORS, Session, Auth, …)  
3. `runserver` / Gunicorn на :8000  
4. Vite на :5173 с proxy `/api`  

## 8.2. Загрузка SPA

1. `main.jsx` → AuthProvider  
2. Чтение JWT из localStorage  
3. `GET /api/auth/me/` → user + role  
4. App.jsx → ProtectedRoute / RoleRoute → страница  

## 8.3. Обработка API-запроса (пример: submit assessment)

```
Browser
  → POST /api/assessments/submit/ + Authorization: Bearer
  → CorsMiddleware
  → JWTAuthentication → User
  → URL resolver (api_urls)
  → SubmitAssessmentAPIView
      → IsAuthenticated + assignment check
      → serializers validation
      → services.calculate_and_save_assessment()
      → risk_engine.calculate_and_store_risk_profile()
      → patient_clinical_status.refresh...
      → update QuestionnaireAssignment
      → AuditLog
  → JSON Response 201
```

## 8.4. Аутентификация (flow)

```
POST /api/auth/login/
  → valid password?
  → role in (patient, doctor, chief)?
      → trusted device cookie valid? → JWT
      → else → send OTP email → challenge_token
POST /api/auth/login/verify-code/
  → valid OTP? → optional remember_device cookie → JWT
```

---

# 9. Слабые места и направления развития

## Безопасность

- Дополнить `requirements.txt` (simplejwt, openpyxl, reportlab)  
- Настроить JWT blacklist для logout  
- `SECRET_KEY`, `DEBUG=False` в production  
- Rate limiting на API (сейчас в основном OTP)  
- CSP и security headers  

## Структура кода

- Удалить или архивировать legacy `views.py`, `urls.py`, templates  
- Разбить `api_views.py` и `PatientDetailPage.jsx` на модули  
- Вынести i18n из монолитного `i18n.js` в JSON-файлы  
- Синхронизировать README (Firebase) с реальным стеком  

## Функциональность (будущее)

- WebSocket / push-уведомления  
- FHIR/HL7 интеграция с ЛИС  
- Версионирование approved-опросников  
- E2E-тесты (Playwright)  
- OpenAPI/Swagger документация API  
- CI/CD pipeline  

## Качество

- Frontend unit/E2E тесты  
- Покрытие критических clinical paths  

---

# 10. Текст для отчёта (академический стиль)

## Technical Description of the Project

The **Med Questionnaire** system is a web-based clinical screening and patient risk assessment platform developed as an academic diploma project. The software supports multi-role access for physicians, chief physicians, and patients. Its primary purpose is to digitize structured medical questionnaires, integrate laboratory data, compute rule-based clinical findings and urgent red flags, augment results with machine-learning probability estimates, and maintain an auditable workflow for questionnaire authoring and approval.

The system follows a **three-tier architecture**: a single-page application (SPA) client, a RESTful API server, and a relational database. Communication occurs exclusively over HTTPS/HTTP using JSON payloads, with JSON Web Token (JWT) authentication for API access and optional email-based one-time password (OTP) verification for enhanced login security. The platform explicitly operates as **clinical decision support** and does not replace professional medical judgment.

---

## Project Architecture

The repository is organized into two principal deliverables: the **Django backend** (`med-questionnaire/`) and the **React frontend** (`frontend/`). The backend implements one Django application named `core`, which encapsulates all domain models, REST endpoints, authentication, clinical engines, and data import/export services. Project-level configuration resides in the `config` package (`settings.py`, `urls.py`, WSGI/ASGI entry points).

The frontend is a client-rendered application built with React and Vite. It consumes backend resources through a centralized Axios HTTP client configured with automatic JWT refresh, internationalization headers, and credential support for trusted-device cookies. In development, Vite proxies `/api` requests to the Django server to preserve same-origin semantics required for secure cookies.

**Architectural layers:**

1. **Presentation layer** — React pages, Material UI components, routing, and localization (English, Russian, Kazakh).
2. **Application layer** — Django REST Framework views and serializers enforcing role-based access control.
3. **Domain layer** — ORM models, clinical rule engines (`risk_engine.py`), recommendation engines, and assessment scoring (`services.py`).
4. **Infrastructure layer** — SQLite or PostgreSQL, email delivery, optional ML artifact storage (`ml_artifacts/`), and static file serving via WhiteNoise.

Legacy server-rendered Django views and HTML templates remain in the codebase but are **not connected** to the active URL configuration; the production user interface is entirely SPA-based.

**Role model:** User identity is stored in Django's built-in `User` model; application roles are stored in `DoctorProfile` (`pending`, `doctor`, `chief_doctor`, `patient`). Authorization filters patient data so physicians access only assigned or created records, while patients access only their linked profile.

---

## Database Design

The database schema is normalized around clinical entities. **Disease** categorizes **Questionnaire** templates, which contain ordered **Question** records with multilingual text and JSON-encoded answer options. **Patient** records store demographics, anthropometrics, clinical status, and optional linkage to a user account.

**Assessment** captures a completed questionnaire instance for a patient, with granular **Answer** rows. **LabIndicator**, **LabResult**, and **LabValue** model laboratory workflows. **PatientRiskProfile** aggregates **RiskFinding** and **RiskRedFlag** entries generated after assessment submission. **QuestionnaireAssignment** mediates the physician-to-patient workflow, enforcing at most one active assignment per patient-questionnaire pair.

Supporting tables include **DoctorOrder** and **DoctorOrderRevision** for care plans, **PatientNote** for clinical documentation, **AuditLog** for compliance tracing, **EmailVerificationCode** for OTP flows, and **PatientTrustedDevice** for optional two-factor bypass on recognized devices.

Referential integrity uses `PROTECT` on questionnaires in assessments and assignments to prevent deletion of in-use instruments. Patient status is derived programmatically rather than manually edited in most flows.

---

## Implementation Details

**Backend implementation** uses Django REST Framework class-based views grouped by domain in `api_views.py` (approximately fifty endpoints). Serializers in `serializers.py` perform field validation and localized field resolution. Authentication endpoints in `auth_views.py` implement password login, OTP challenge/response, patient and physician registration, and profile management.

**Clinical pipeline** upon assessment submission:

1. Validate assignment and permissions.
2. Execute `calculate_and_save_assessment()` for scoring and interpretation.
3. Execute `calculate_and_store_risk_profile()` for rule-based findings and red flags.
4. Apply `ml_risk` models when `.joblib` artifacts are present.
5. Refresh patient clinical status and complete the assignment record.

**Frontend implementation** uses React Router with nested layout shells (`AppShell`, `PatientShell`), route guards (`ProtectedRoute`, `RoleRoute`), and a shared UI component library. The largest clinical screen, `PatientDetailPage`, consolidates tabs for overview, laboratory trends, risk visualization, notes, and questionnaire assignments.

**Internationalization** is implemented via i18next with inline translation dictionaries. **Reporting** uses ReportLab for PDF generation on both patient summaries and assessment results.

**Data seeding** is provided through Django management commands (`seed_lab_indicators`, `seed_screening_questionnaires`, etc.) and optional ML training via `train_risk_ml`.

---

## System Workflow

1. **Deployment / startup:** Environment variables are loaded; database migrations are applied; Django serves API; Vite or static hosting serves the SPA.
2. **Authentication:** User submits credentials; sensitive roles receive OTP; upon verification JWT pair is issued and stored client-side.
3. **Clinical operations:** Physician creates patient → assigns approved questionnaire → patient completes form in portal → system persists assessment and computes risk → both parties view results and PDF exports.
4. **Governance:** Physician submits questionnaire drafts; chief physician approves or rejects; audit log records privileged actions.
5. **Data interchange:** Excel templates support bulk patient and laboratory import; post-import clinical status is recalculated.

End-to-end, the workflow implements: **patient data → assessment → risk profile → clinical status**, aligning with the project's stated medical informatics objective.

---

## Technologies Used

| Category | Technology |
|----------|------------|
| Language | Python 3, JavaScript (ES modules) |
| Backend framework | Django, Django REST Framework |
| Authentication | djangorestframework-simplejwt, email OTP |
| Frontend framework | React 19, Vite 8 |
| UI library | Material UI 9, Emotion |
| Routing | React Router 7 |
| HTTP client | Axios |
| Localization | i18next, react-i18next |
| Database | SQLite (development), PostgreSQL (production) |
| ML | scikit-learn, NumPy, joblib |
| Documents | ReportLab (PDF), openpyxl (Excel) |
| Deployment | Gunicorn, WhiteNoise; documented Vercel + Render |
| Development tools | ESLint, npm, Python venv |

The project is started locally by running Django migrations and `runserver` on port 8000 concurrently with `npm run dev` on port 5173, with API traffic proxied through Vite during development.

---

## Приложение: полный список API views (`api_views.py`)

| Класс | Назначение |
|-------|------------|
| PatientListAPIView | Список/создание пациентов |
| PatientDetailAPIView | Детали пациента |
| PatientAccountLinkAPIView | Привязка user к patient (chief) |
| PatientPdfAPIView | PDF отчёт по пациенту |
| PatientUpdateAPIView | Обновление данных |
| PatientIntakeAPIView | Первичный приём |
| PatientAssessmentsAPIView | Список assessments |
| PatientAssessmentTrendAPIView | Тренд оценок |
| AssessmentDetailAPIView | Детали assessment |
| PatientRiskProfileAPIView | Текущий риск-профиль |
| PatientRiskHistoryAPIView | История риска |
| AssessmentRiskProfileAPIView | Риск по assessment |
| AssessmentPdfAPIView | PDF assessment |
| PatientLabResultsAPIView | Лаборатории |
| PatientLabTrendAPIView | Тренд лабов |
| PatientLabRecommendationsAPIView | Рекомендации по лабам |
| PatientRecommendationsAPIView | Полный bundle рекомендаций |
| LabIndicatorListAPIView | Справочник показателей |
| DiseaseListAPIView | Список болезней |
| PatientLabResultDetailAPIView | CRUD результата лаба |
| PatientNotesAPIView | Заметки |
| PatientNoteDetailAPIView | Заметка по id |
| PatientDeleteAPIView | Удаление пациента |
| PatientImportAPIView | Импорт Excel |
| PatientDoctorOrderAPIView | Назначения врача |
| PatientDoctorOrderPdfAPIView | PDF назначений |
| LabTemplateAPIView / PatientTemplateAPIView | Шаблоны Excel |
| LabImportAPIView | Импорт лабов |
| SubmitAssessmentAPIView | Отправка опросника |
| MyQuestionnaireAssignmentsAPIView | Назначения пациента (portal) |
| QuestionnaireDetailAPIView | CRUD опросника |
| SubmitQuestionnaireForApprovalAPIView | На утверждение |
| PendingQuestionnairesAPIView | Очередь |
| ArchivedQuestionnairesAPIView | Архив |
| RestoreQuestionnaireAPIView | Восстановление |
| ApproveQuestionnaireAPIView | Утверждение |
| RejectQuestionnaireAPIView | Отклонение |
| RequestQuestionnaireChangesAPIView | Запрос правок |
| DashboardStatsAPIView | Статистика dashboard |
| AuditLogListAPIView | Журнал аудита |
| UserRoleListAPIView | Список пользователей |
| AssignUserRoleAPIView | Назначение роли |
| QuestionnaireAssignmentListCreateAPIView | Назначения (doctor) |
| PatientQuestionnaireAssignmentListAPIView | Назначения на карточке |
| QuestionnaireAssignmentDetailAPIView | Детали назначения |
| QuestionnaireAssignmentCancelAPIView | Отмена назначения |
| QuestionnaireListAPIView | Список опросников |
| QuestionnaireQuestionsAPIView | Вопросы опросника |

---

*Документ сгенерирован на основе анализа репозитория Med Questionnaire. Автор проекта: Batyrkhan Kadyrbay.*
