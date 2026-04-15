"""
middleware.py — Firebase Auth helper for Flask.

Initializes the Firebase Admin SDK once at startup and provides the
@require_auth decorator to protect routes using Firebase ID tokens.
"""
import os
from functools import wraps
from flask import request, jsonify
import firebase_admin
from firebase_admin import auth, credentials


def init_firebase():
    """Initialize Firebase Admin SDK (idempotent — safe to call multiple times)."""
    if not firebase_admin._apps:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccountKey.json")

        if not os.path.isabs(cred_path):
            cred_path = os.path.join(base_dir, cred_path)

        if not os.path.exists(cred_path):
            raise RuntimeError(f"serviceAccountKey.json not found at: {cred_path}")

        firebase_admin.initialize_app(credentials.Certificate(cred_path))


def require_auth(f):
    """
    Decorator to protect Flask routes with Firebase ID token verification.

    The decoded token is injected as the first argument (current_user).

    Usage:
        @app.get('/protected')
        @require_auth
        def protected(current_user):
            return jsonify({"uid": current_user["uid"]})
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authorization header missing or malformed"}), 401

        token = auth_header.split("Bearer ")[1]

        try:
            decoded = auth.verify_id_token(token)
            return f(decoded, *args, **kwargs)
        except auth.ExpiredIdTokenError:
            return jsonify({"error": "Token has expired. Please log in again."}), 401
        except auth.InvalidIdTokenError:
            return jsonify({"error": "Invalid token."}), 401
        except Exception as e:
            return jsonify({"error": str(e)}), 401

    return decorated