# Med Questionnaire Manual Test Checklist

## Backend checks
- `python manage.py makemigrations`
- `python manage.py migrate`
- `python manage.py check`
- Run backend: `python3 manage.py runserver`

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
11. Open a patient card and assign an approved questionnaire (Questionnaire assignments block).
12. Login as the linked patient (or use patient cabinet).
13. Open the assigned questionnaire from the patient portal and submit answers.
14. Confirm assignment becomes completed and assessment appears for doctor and patient.
15. Confirm risk profile is recalculated when applicable.
16. Verify doctor cannot open pending review actions endpoint.
17. Verify doctor sees only own patients.
18. Verify duplicate patient code returns clear error.
