"""
firebase_config.py — initialize Firebase Admin SDK once at startup.
Set GOOGLE_APPLICATION_CREDENTIALS in your .env to the path of your
serviceAccountKey.json downloaded from the Firebase console.
"""
import os
import firebase_admin
from firebase_admin import credentials

def init_firebase():
    if not firebase_admin._apps:
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if not cred_path:
            raise RuntimeError(
                "GOOGLE_APPLICATION_CREDENTIALS env var is not set. "
                "Download serviceAccountKey.json from Firebase console and point to it."
            )
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)