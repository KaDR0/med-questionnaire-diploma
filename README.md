# Med Questionnaire Diploma

A full-stack medical screening and patient risk assessment platform built with **Django REST Framework**, **React**, and **Firebase Authentication**.

## Overview

This project was developed as a diploma work. It helps collect patient data, import laboratory results, process questionnaire responses, calculate clinical findings and red flags, and maintain an up-to-date patient clinical status.

Main workflow:

**patient data → assessment → risk profile → clinical status**

## Features

- Patient profile management
- Medical questionnaire processing
- Excel import for patients and laboratory results
- Rule-based clinical findings and red flag detection
- ML-assisted probability and confidence scoring
- Doctor order editing with revision history
- PDF report generation
- Automatic patient status refresh
- Patient prioritization by severity and next visit date

## Tech Stack

### Backend
- Python
- Django
- Django REST Framework
- SQLite
- Firebase Admin SDK
- openpyxl
- ReportLab
- scikit-learn
- NumPy
- joblib

### Frontend
- React
- Vite
- Axios
- Firebase

## Project Structure

```bash
med-questionnaire-diploma/
├── med-questionnaire/   # Django backend
├── frontend/            # React frontend
└── README.md

Clinical Logic

The system is based on a rule-first clinical engine.

It uses:

questionnaire answers,
patient profile data,
BMI,
latest lab values,
assessment scores,
red flag severity,
overdue follow-up visits.

The platform generates:

findings such as metabolic, cardiovascular, anemia, thyroid, vitamin D, psychoemotional, and sleep apnea related risks;
red flags such as chest pain with dyspnea, suicidal ideation, GI bleeding, stroke-like symptoms, acute abdomen, and other urgent patterns.
ML Support

The project includes a lightweight ML layer.

Important:

clinical findings and red flags are created by rules
ML does not create new findings by itself
ML only adds:
probability
confidence
Authentication

Two authentication flows are supported:

Firebase login with backend synchronization in Django
JWT authentication for classic REST endpoints
Installation
Clone the repository
git clone https://github.com/KaDR0/med-questionnaire-diploma.git
cd med-questionnaire-diploma
Backend
cd med-questionnaire
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 manage.py migrate
python3 manage.py runserver

Backend runs at:

http://127.0.0.1:8000/
Frontend

Open a second terminal:

cd frontend
npm install
npm run dev

Frontend usually runs at:

http://localhost:5173/
Excel Import

The system supports:

patient import from Excel templates
laboratory import from Excel templates

After lab import, affected patients automatically get their clinical status refreshed.

Doctor Orders and PDF

The project supports:

doctor order editing,
revision history,
PDF report generation with safe text rendering.
Notes

This project was created for academic and demonstration purposes.
It is not intended for real clinical diagnosis or emergency decision-making without professional validation.

Author

Batyrkhan Kadyrbay
