"""
set_staff_role.py — Run this ONCE to assign the 'staff' role to your staff accounts.

Usage:
    python set_staff_role.py
"""
import os
import firebase_admin
from firebase_admin import auth, credentials
from dotenv import load_dotenv

# Always resolve paths relative to THIS script's location
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Load .env from the same folder as this script
load_dotenv(os.path.join(os.path.dirname(SCRIPT_DIR), '.env'))

# ── Add your staff emails here ─────────────────────────────────────────────
STAFF_EMAILS = [
    "staff@mugshotph.com",   # replace with your real staff emails
    # "barber2@mugshotph.com",
]
# ──────────────────────────────────────────────────────────────────────────

cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccountKey.json")

# If not absolute, resolve relative to this script's directory
if not os.path.isabs(cred_path):
    cred_path = os.path.join(SCRIPT_DIR, cred_path)

if not os.path.exists(cred_path):
    print(f"❌  serviceAccountKey.json not found at: {cred_path}")
    print("    Make sure serviceAccountKey.json is in the same folder as this script.")
    exit(1)

firebase_admin.initialize_app(credentials.Certificate(cred_path))

for email in STAFF_EMAILS:
    try:
        user = auth.get_user_by_email(email)
        auth.set_custom_user_claims(user.uid, {"role": "staff"})
        print(f"Staff role set for: {email} (uid: {user.uid})")
    except auth.UserNotFoundError:
        print(f"User not found in Firebase: {email}")
    except Exception as e:
        print(f"Error for {email}: {e}")

print("\nDone. Staff users must log out and back in for the role to take effect.")