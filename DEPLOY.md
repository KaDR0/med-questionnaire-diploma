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

## QR link behavior

QR links now use:

- `VITE_PUBLIC_SITE_URL` when it is configured
- fallback: `window.location.origin` when env is missing

Result format:

- `${VITE_PUBLIC_SITE_URL}/public/questionnaire/${token}`

## Validation checklist

1. Open doctor page to create QR.
2. Generate QR and confirm it contains your real frontend domain (not localhost).
3. Scan QR from phone on mobile network.
4. Complete questionnaire and confirm success page opens.

## Local network testing (QR from phone without deploy)

Use this mode when frontend/backend run on your MacBook and phone is on the same Wi-Fi.

1. Find your MacBook LAN IP (example: `192.168.1.42`):
   - `ipconfig getifaddr en0`
   - if empty, try: `ipconfig getifaddr en1`
2. Set frontend env (`frontend/.env`):
   - `VITE_API_BASE_URL=http://192.168.x.x:8000/api`
   - `VITE_PUBLIC_SITE_URL=http://192.168.x.x:5175`
3. Set backend env (`med-questionnaire/.env`):
   - `ALLOWED_HOSTS=localhost,127.0.0.1,192.168.x.x`
   - `CORS_ALLOWED_ORIGINS=http://localhost:5175,http://127.0.0.1:5175,http://192.168.x.x:5175`
   - `CSRF_TRUSTED_ORIGINS=http://localhost:5175,http://127.0.0.1:5175,http://192.168.x.x:5175`
4. Start backend:
   - `python3 manage.py runserver 0.0.0.0:8000`
5. Start frontend:
   - `npm run dev -- --host 0.0.0.0 --port 5175`
6. Open on phone:
   - `http://192.168.x.x:5175`
7. Generate QR and verify visible link near QR starts with:
   - `http://192.168.x.x:5175/public/questionnaire/...`
