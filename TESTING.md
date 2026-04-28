# Med Questionnaire Manual Test Checklist

## Backend checks
- `python manage.py makemigrations`
- `python manage.py migrate`
- `python manage.py check`
- Run backend: `python manage.py runserver`

## Frontend checks
- `npm install`
- `npm run build`
- Run frontend: `npm run dev`

## End-to-end scenario
1. Create users with roles: `doctor`, `chief_doctor`.
2. Login as doctor.
3. Create patient and verify patient appears in list.
4. Create questionnaire draft in `My Questionnaires`.
5. Add questions/options/scores/source and save draft.
6. Submit questionnaire for approval.
7. Login as chief doctor.
8. Open `Pending Questionnaires` and open review page.
9. Approve questionnaire.
10. Login as doctor.
11. Open `Create QR Questionnaire`.
12. Select patient + approved questionnaire and generate QR.
13. Open public link in incognito/mobile.
14. Fill questionnaire and submit.
15. Confirm success page is shown.
16. Reopen same link and verify invalid/used flow.
17. Return doctor panel and confirm new assessment appears.
18. Confirm risk profile is recalculated.
19. Verify doctor cannot open pending review actions endpoint.
20. Verify doctor sees only own patients.
21. Verify duplicate patient code returns clear error.
