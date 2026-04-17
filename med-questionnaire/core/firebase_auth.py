import os
import firebase_admin
from firebase_admin import credentials, auth

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVICE_ACCOUNT_PATH = os.path.join(BASE_DIR, "firebase-service-account.json")


def initialize_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)


def verify_firebase_token(id_token: str):
    initialize_firebase()
    decoded_token = auth.verify_id_token(id_token)
    return decoded_token