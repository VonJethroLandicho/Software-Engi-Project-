"""
firebase_auth_middleware.py — shared Firebase Auth helper for the Flask app.

Initializes Firebase Admin SDK once and provides the @require_auth decorator
to protect Flask routes using the same Firebase ID tokens issued by FastAPI.
"""
import os
from functools import wraps
from flask import request, jsonify
import firebase_admin
from firebase_admin import auth, credentials


def init_firebase():
    if not firebase_admin._apps:
        # Build absolute path relative to this file's location
        base_dir = os.path.dirname(os.path.abspath(__file__))
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccountKey.json")
        
        # If it's a relative path, resolve it from this file's directory
        if not os.path.isabs(cred_path):
            cred_path = os.path.join(base_dir, cred_path)
        
        if not os.path.exists(cred_path):
            raise RuntimeError(f"serviceAccountKey.json not found at: {cred_path}")
        
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)


def require_auth(f):
    """
    Decorator to protect Flask routes with Firebase token verification.

    Usage:
        @dashboard_bp.route('/data')
        @require_auth
        def get_data(current_user):
            return jsonify({"uid": current_user["uid"], "email": current_user["email"]})

    The decoded Firebase token is passed as the first argument (current_user).
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