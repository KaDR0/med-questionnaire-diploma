# Deploy Guide (Render + Vercel)

## Frontend env (Vercel)

- `VITE_API_BASE_URL=https://MY_BACKEND_DOMAIN/api`
- `VITE_PUBLIC_SITE_URL=https://MY_FRONTEND_DOMAIN`

For local development use values from `frontend/.env.example`.

## Backend env (Render)

- `DEBUG=False`
- `SECRET_KEY=<strong-random-secret>`
- `ALLOWED_HOSTS=<your-backend-domain>,localhost,127.0.0.1`
- `CORS_ALLOWED_ORIGINS=https://MY_FRONTEND_DOMAIN,http://localhost:5175,http://127.0.0.1:5175`
- `CSRF_TRUSTED_ORIGINS=https://MY_FRONTEND_DOMAIN`
- `DATABASE_URL=postgresql://...`

For local development use values from `med-questionnaire/.env.example`.

## Render backend setup

- Root directory: `med-questionnaire`
- Build command:
  - `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
- Start command:
  - `gunicorn config.wsgi:application`

> Django project module is `config`, so `config.wsgi:application` is the correct gunicorn path.

## Vercel frontend setup

- Root directory: `frontend`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Set frontend env variables in Vercel project settings.

## Patient questionnaire flow (assignment)

Questionnaires are assigned to patients from the **patient card** in the doctor workspace; patients complete them in the **patient portal**. No separate public token URL is used.

`VITE_PUBLIC_SITE_URL` is optional for absolute links in emails (assignment notifications) if you configure it.

## Validation checklist

1. Assign a questionnaire from a patient card and confirm the patient sees it in the portal.
2. Complete the questionnaire as the patient and confirm results for doctor and patient.
3. On mobile, open the same frontend URL (see local LAN testing below) and repeat the login + portal flow.

## Local network testing (phone on same Wi‑Fi)

Use this when frontend/backend run on your machine and the phone is on the same network.

1. Find your LAN IP (example: `192.168.1.42`): `ipconfig getifaddr en0` (or `en1`).
2. Frontend (`frontend/.env`): `VITE_API_BASE_URL=http://192.168.x.x:8000/api`, optionally `VITE_PUBLIC_SITE_URL=http://192.168.x.x:5175`.
3. Backend (`med-questionnaire/.env`): add the LAN IP to `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS`.
4. Start backend: `python3 manage.py runserver 0.0.0.0:8000`
5. Start frontend: `npm run dev -- --host 0.0.0.0 --port 5175`
6. On the phone, open `http://192.168.x.x:5175` and test login + patient portal.
