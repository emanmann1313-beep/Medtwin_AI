from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError

from app.config import CORS_ORIGINS
from app.database import get_db
from app.routers import alerts, audio, caregivers, doses, interactions, medications, patients, prescriptions

app = FastAPI(
    title="MedTwin AI Pro - Backend API",
    description="Patients, prescriptions, medication schedules, dose tracking, caregivers and alerts.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (patients, prescriptions, medications, doses, caregivers, alerts, interactions, audio):
    app.include_router(r.router)


@app.exception_handler(APIError)
async def database_error_handler(request: Request, exc: APIError):
    return JSONResponse(status_code=400, content={"detail": f"Database error: {exc.message}"})


@app.get("/", tags=["System"])
def root():
    return {"app": "MedTwin AI Pro API", "docs": "/docs", "health": "/health"}


@app.get("/health", tags=["System"])
def health():
    return {"status": "ok"}


@app.get("/health/db", tags=["System"])
def health_db():
    """Checks the Supabase connection and that the tables exist."""
    get_db().table("patients").select("id").limit(1).execute()
    return {"status": "ok", "database": "connected"}
