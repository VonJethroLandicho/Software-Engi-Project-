"""
main.py — FastAPI application entry point.

Run with:
    uvicorn main:app --reload
"""
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from firebase_config import init_firebase
from auth import router as auth_router, get_current_user


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_firebase()
    yield


app = FastAPI(
    title="Secure Firebase Auth API",
    version="1.0.0",
    description="FastAPI + Firebase Authentication (Email/Password + Google OAuth)",
    lifespan=lifespan,
)

# ── CORS (adjust origins for production) ─────────────────────────────────────
# In main.py, update the CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:5173",
        "http://127.0.0.1:5500", # Common for VS Code Live Server
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)


# ── Example protected route ───────────────────────────────────────────────────
@app.get("/dashboard", tags=["protected"])
async def dashboard(user: dict = Depends(get_current_user)):
    """
    Example of a protected route. Any route can be secured by adding
    `user: dict = Depends(get_current_user)` to its signature.
    """
    return {"message": f"Welcome, {user.get('email')}!", "uid": user.get("uid")}


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok"}