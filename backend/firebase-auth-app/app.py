"""
app.py — Flask application entry point.
"""
import sys
import os
import json

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

import requests
from flask import Flask, send_file, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from middleware import init_firebase, require_auth

load_dotenv()

BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, '../../frontend')

app = Flask(__name__,
    static_folder=FRONTEND_DIR,
    static_url_path=''
)

CORS(app, origins=[
    "http://127.0.0.1:5000",
    "http://localhost:5000",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://localhost:3000",
])

init_firebase()

# ── Blueprints ────────────────────────────────────────────────────────────────
from admin_side.routes.dashboard_api    import dashboard_bp
from admin_side.routes.queue_api        import queue_bp
from admin_side.routes.appointment_api  import appointment_bp
from customer_side.routes.customer_api  import customer_bp

app.register_blueprint(dashboard_bp,   url_prefix='/api/admin')
app.register_blueprint(queue_bp,       url_prefix='/api/admin/queue')
app.register_blueprint(appointment_bp, url_prefix='/api/admin/appointments')
app.register_blueprint(customer_bp,    url_prefix='/api/customer')

# ── Auth routes ───────────────────────────────────────────────────────────────
@app.post('/auth/login')
def login():
    """Customer login — any authenticated Firebase user."""
    data    = request.get_json()
    api_key = os.getenv("FIREBASE_API_KEY")

    res = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}",
        json={"email": data["email"], "password": data["password"], "returnSecureToken": True}
    )
    result = res.json()

    if "error" in result:
        return jsonify({"detail": result["error"]["message"]}), 401

    return jsonify({
        "id_token":      result["idToken"],
        "refresh_token": result["refreshToken"],
        "expires_in":    result["expiresIn"],
        "uid":           result["localId"],
        "email":         result["email"]
    })


@app.post('/auth/staff-login')
def staff_login():
    """
    Staff-only login.
    After Firebase password auth succeeds, verify the user has
    role == 'staff' in their custom claims via Firebase Admin SDK.
    """
    from firebase_admin import auth as admin_auth

    data    = request.get_json()
    api_key = os.getenv("FIREBASE_API_KEY")

    # Step 1 — authenticate with Firebase
    res = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}",
        json={"email": data["email"], "password": data["password"], "returnSecureToken": True}
    )
    result = res.json()

    if "error" in result:
        return jsonify({"detail": result["error"]["message"]}), 401

    # Step 2 — verify role via Admin SDK custom claims
    try:
        user = admin_auth.get_user(result["localId"])
        claims = user.custom_claims or {}
        if claims.get("role") != "staff":
            return jsonify({"detail": "Access denied. Staff accounts only."}), 403
    except Exception as e:
        return jsonify({"detail": f"Role verification failed: {str(e)}"}), 500

    return jsonify({
        "id_token":      result["idToken"],
        "refresh_token": result["refreshToken"],
        "expires_in":    result["expiresIn"],
        "uid":           result["localId"],
        "email":         result["email"]
    })


@app.get('/auth/me')
@require_auth
def auth_me(current_user):
    return jsonify({
        "uid":   current_user.get("uid"),
        "email": current_user.get("email")
    })

@app.post('/auth/logout')
@require_auth
def auth_logout(current_user):
    from firebase_admin import auth
    auth.revoke_refresh_tokens(current_user["uid"])
    return jsonify({"message": "Logged out. All sessions revoked."})


# ── Firebase config helper ────────────────────────────────────────────────────
def render_html_with_firebase(filename):
    filepath = os.path.join(FRONTEND_DIR, filename)
    # FIX APPLIED HERE: Added encoding='utf-8' to prevent Windows charmap crashes
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()
    config = {
        "apiKey":            os.getenv("FIREBASE_API_KEY", ""),
        "authDomain":        os.getenv("FIREBASE_AUTH_DOMAIN", ""),
        "projectId":         os.getenv("FIREBASE_PROJECT_ID", ""),
        "storageBucket":     os.getenv("FIREBASE_STORAGE_BUCKET", ""),
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID", ""),
        "appId":             os.getenv("FIREBASE_APP_ID", ""),
    }
    config_script = f"<script>window.__FIREBASE_CONFIG__ = {json.dumps(config)};</script>"
    html = html.replace('</head>', f'{config_script}\n</head>', 1)
    return html


# ── Frontend routes ───────────────────────────────────────────────────────────
@app.get('/')
def root():
    return send_file(os.path.join(FRONTEND_DIR, 'welcome.html'))

@app.get('/welcome')
def welcome_page():
    return send_file(os.path.join(FRONTEND_DIR, 'welcome.html'))

@app.get('/staff-login')
def staff_login_page():
    return render_html_with_firebase('staff_login.html')

@app.get('/customer-login')
def customer_login_page():
    return render_html_with_firebase('customer_login.html')

@app.get('/customer-register')
def customer_register_page():
    return render_html_with_firebase('customer_register.html')

@app.get('/admin')
def admin_dashboard():
    return send_file(os.path.join(FRONTEND_DIR, 'admin_side/index.html'))

@app.get('/customer')
def customer_dashboard():
    return send_file(os.path.join(FRONTEND_DIR, 'customer_side/index.html'))

# ── Health check ──────────────────────────────────────────────────────────────
@app.get('/health')
def health():
    return {"status": "ok", "service": "Mugshot Flask API"}

if __name__ == '__main__':
    print("Mugshot Backend Server Running on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)