from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.config import MISSED_GRACE_MINUTES
from app.database import fetch_one, get_db
from app.schemas import PatientCreate
from app.services import adherence
from app.services.scheduler import local_today

router = APIRouter(tags=["Patients"])


@router.post("/patients", status_code=201)
def create_patient(payload: PatientCreate, db=Depends(get_db)):
    return db.table("patients").insert(payload.model_dump(mode="json")).execute().data[0]


@router.get("/patients")
def list_patients(db=Depends(get_db)):
    return db.table("patients").select("*").order("created_at", desc=True).execute().data


@router.get("/patients/{patient_id}")
def get_patient(patient_id: UUID, db=Depends(get_db)):
    return fetch_one(db, "patients", patient_id, "Patient")


@router.get("/patients/{patient_id}/schedule")
def patient_schedule(
    patient_id: UUID,
    day: date | None = Query(default=None, description="YYYY-MM-DD, defaults to today"),
    db=Depends(get_db),
):
    """All doses for one day (patient's local day) with medicine details. For the dashboard."""
    patient = fetch_one(db, "patients", patient_id, "Patient")
    day = day or local_today(patient.get("timezone") or "UTC")
    doses = adherence.get_day_schedule(db, patient, day)
    return {"patient_id": patient["id"], "date": day.isoformat(), "doses": doses}


@router.get("/patients/{patient_id}/doses")
def patient_doses(
    patient_id: UUID,
    status: str | None = Query(default=None, pattern="^(pending|taken|missed|skipped)$"),
    start: str | None = Query(default=None, description="ISO datetime, inclusive"),
    end: str | None = Query(default=None, description="ISO datetime, exclusive"),
    limit: int = Query(default=500, ge=1, le=5000),
    db=Depends(get_db),
):
    """Raw dose history - the data source for the digital twin (Member 4)."""
    fetch_one(db, "patients", patient_id, "Patient")
    q = db.table("dose_logs").select("*").eq("patient_id", str(patient_id))
    if status:
        q = q.eq("status", status)
    if start:
        q = q.gte("scheduled_at", start)
    if end:
        q = q.lt("scheduled_at", end)
    return q.order("scheduled_at").limit(limit).execute().data


@router.get("/patients/{patient_id}/adherence")
def patient_adherence(patient_id: UUID, days: int = Query(default=7, ge=1, le=90), db=Depends(get_db)):
    patient = fetch_one(db, "patients", patient_id, "Patient")
    return adherence.compute_adherence(db, patient, days)


@router.get("/patients/{patient_id}/refills")
def patient_refills(patient_id: UUID, db=Depends(get_db)):
    """Baseline refill status per medicine (days left, run-out date). Member 4 builds forecasts on top."""
    patient = fetch_one(db, "patients", patient_id, "Patient")
    return adherence.compute_refills(db, patient)


@router.post("/patients/{patient_id}/doses/mark-missed")
def sweep_missed(patient_id: UUID, db=Depends(get_db)):
    """Marks overdue pending doses as missed and returns them (use this to trigger caregiver alerts)."""
    patient = fetch_one(db, "patients", patient_id, "Patient")
    newly_missed = adherence.mark_missed(db, patient, MISSED_GRACE_MINUTES)
    return {"patient_id": patient["id"], "newly_missed": len(newly_missed), "doses": newly_missed}
