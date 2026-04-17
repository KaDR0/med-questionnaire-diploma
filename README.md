# med-questionnaire-diploma

Дипломный проект: **веб-клиент** (React + Vite + MUI) и **бэкенд** (Django REST API) для клинического скрининга, учёта пациентов, анкет, лабораторных данных и профиля риска.

## Структура

- `frontend/` — SPA
- `med-questionnaire/` — Django-проект

## Локальный запуск (кратко)

**Бэкенд:** Python 3, из каталога `med-questionnaire/`:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

**Фронт:** из `frontend/`:

```bash
npm install
npm run dev
```

Переменная `VITE_API_URL` должна указывать на API (например `http://127.0.0.1:8000/api/`).

## Секреты

Файл `med-questionnaire/firebase-service-account.json` **не хранится в репозитории** — создайте его локально по ключу из Firebase Console.
