"""
app.py — Flask application entry point.
Run with:
    python app.py
Auth flow:
  1. Frontend submits email/password → Flask calls Firebase REST API → returns ID token
  2. Token stored in localStorage
  3. All protected routes verified via Firebase Admin SDK (@require_auth)
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

from flask import Flask, send_file, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import requests

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, '../../frontend')

app = Flask(__name__,
    static_folder=FRONTEND_DIR,
    static_url_path=''
)

# Allow requests from both Live Server and Flask itself
CORS(app, origins=[
    "http://127.0.0.1:5000",
    "http://localhost:5000",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://localhost:3000",
])

# ── Initialize Firebase Admin SDK ─────────────────────────────────────────────
from middleware import init_firebase, require_auth
init_firebase()

# ── Blueprints ────────────────────────────────────────────────────────────────
from admin_side.routes.dashboard_api import dashboard_bp
from admin_side.routes.queue_api import queue_bp
from admin_side.routes.appointment_api import appointment_bp
from customer_side.routes.customer_api import customer_bp

app.register_blueprint(dashboard_bp,   url_prefix='/api/admin')
app.register_blueprint(queue_bp,       url_prefix='/api/admin/queue')
app.register_blueprint(appointment_bp, url_prefix='/api/admin/appointments')
app.register_blueprint(customer_bp,    url_prefix='/api/customer')

# ── Auth routes ───────────────────────────────────────────────────────────────
@app.post('/auth/login')
def login():
    data = request.get_json()
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

# ── Frontend routes ───────────────────────────────────────────────────────────
@app.get('/')
def login_page():
    return send_file(os.path.join(FRONTEND_DIR, 'index.html'))

@app.get('/admin')
def admin_dashboard():
    return send_file(os.path.join(FRONTEND_DIR, 'admin_side/index.html'))

# ── Health check ──────────────────────────────────────────────────────────────
@app.get('/health')
def health():
    return {"status": "ok", "service": "Mugshot Flask API"}

if __name__ == '__main__':
    print("Mugshot Backend Server Running on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)