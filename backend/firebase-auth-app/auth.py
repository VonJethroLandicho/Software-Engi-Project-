"""
auth.py — authentication helpers and route handlers.

Covers:
  - Email/password login  → client calls Firebase SDK, then sends the ID token here
  - Google OAuth          → redirect flow using Firebase's OAuth via REST
  - Token verification    → FastAPI dependency to guard protected routes
"""
import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth as firebase_auth
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer()

FIREBASE_API_KEY = os.getenv("FIREBASE_API_KEY")           # Web API key from Firebase console
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")

# ── Models ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None

class TokenResponse(BaseModel):
    id_token: str
    refresh_token: str
    expires_in: str
    uid: str
    email: str

# ── Dependency: verify Firebase ID token ─────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    FastAPI dependency.  Use as:
        @router.get("/protected")
        def protected(user = Depends(get_current_user)):
    """
    token = credentials.credentials
    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

# ── Helpers ───────────────────────────────────────────────────────────────────

async def _firebase_rest(endpoint: str, payload: dict) -> dict:
    """Call Firebase Auth REST API (used for email/password flows)."""
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:{endpoint}?key={FIREBASE_API_KEY}"
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload)
    data = resp.json()
    if "error" in data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=data["error"].get("message", "Firebase error"),
        )
    return data

# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    """Create a new user with email/password and return an ID token."""
    data = await _firebase_rest("signUp", {
        "email": body.email,
        "password": body.password,
        "returnSecureToken": True,
    })
    # Optionally update display name
    if body.display_name:
        firebase_auth.update_user(data["localId"], display_name=body.display_name)

    return TokenResponse(
        id_token=data["idToken"],
        refresh_token=data["refreshToken"],
        expires_in=data["expiresIn"],
        uid=data["localId"],
        email=data["email"],
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    """Sign in with email/password and return a Firebase ID token."""
    data = await _firebase_rest("signInWithPassword", {
        "email": body.email,
        "password": body.password,
        "returnSecureToken": True,
    })
    return TokenResponse(
        id_token=data["idToken"],
        refresh_token=data["refreshToken"],
        expires_in=data["expiresIn"],
        uid=data["localId"],
        email=data["email"],
    )


@router.get("/google")
async def google_login():
    """
    Redirect the browser to Google's OAuth consent screen via Firebase.
    In production, your frontend SDK (firebase/auth signInWithPopup or
    signInWithRedirect) handles this more smoothly — this endpoint shows
    the server-side redirect pattern for reference.
    """
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={os.getenv('GOOGLE_CLIENT_ID')}"
        f"&redirect_uri={redirect_uri}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        "&access_type=offline"
    )
    return RedirectResponse(url=google_auth_url)


@router.get("/google/callback")
async def google_callback(code: str):
    """
    Exchange the Google auth code for a Firebase custom token.
    NOTE: In most setups, the frontend SDK handles the OAuth callback
    directly and sends the resulting Firebase ID token to your backend.
    This route is here for fully server-side flows.
    """
    # Exchange code for Google tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "redirect_uri": os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback"),
            "grant_type": "authorization_code",
        })
    token_data = token_resp.json()
    if "error" in token_data:
        raise HTTPException(status_code=400, detail=token_data.get("error_description", "OAuth error"))

    # Use the id_token to get user info and mint a Firebase custom token
    id_token_google = token_data.get("id_token")
    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
    userinfo = userinfo_resp.json()
    uid = f"google_{userinfo['sub']}"

    # Create or update the user in Firebase
    try:
        firebase_auth.get_user(uid)
    except firebase_auth.UserNotFoundError:
        firebase_auth.create_user(
            uid=uid,
            email=userinfo.get("email"),
            display_name=userinfo.get("name"),
            photo_url=userinfo.get("picture"),
            email_verified=userinfo.get("email_verified", False),
        )

    custom_token = firebase_auth.create_custom_token(uid)
    return {"custom_token": custom_token.decode(), "uid": uid, "email": userinfo.get("email")}


@router.post("/logout")
async def logout(user: dict = Depends(get_current_user)):
    """
    Revoke all refresh tokens for the user (server-side logout).
    The client should also delete the ID token locally.
    """
    firebase_auth.revoke_refresh_tokens(user["uid"])
    return {"message": "Logged out. All sessions revoked."}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    """Return the decoded token claims for the authenticated user."""
    return {
        "uid": user.get("uid"),
        "email": user.get("email"),
        "email_verified": user.get("email_verified"),
        "name": user.get("name"),
        "picture": user.get("picture"),
    }