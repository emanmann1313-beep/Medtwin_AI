from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.database import fetch_one, get_db
from app.schemas import CaregiverCreate, ConsentUpdate
from app.services import adherence
from app.services.scheduler import local_today

router = APIRouter(tags=["Caregivers"])


@router.post("/patients/{patient_id}/caregivers", status_code=201)
def add_caregiver(patient_id: UUID, payload: CaregiverCreate, db=Depends(get_db)):
    """Adds a caregiver. Consent is OFF until the patient explicitly grants it."""
    fetch_one(db, "patients", patient_id, "Patient")
    row = payload.model_dump(mode="json")
    row["patient_id"] = str(patient_id)
    row["consent_given"] = False
    return db.table("caregivers").insert(row).execute().data[0]


@router.get("/patients/{patient_id}/caregivers")
def list_caregivers(patient_id: UUID, db=Depends(get_db)):
    fetch_one(db, "patients", patient_id, "Patient")
    return db.table("caregivers").select("*").eq("patient_id", str(patient_id)).order("created_at").execute().data


@router.post("/caregivers/{caregiver_id}/consent")
def set_consent(caregiver_id: UUID, payload: ConsentUpdate, db=Depends(get_db)):
    """Patient grants or revokes consent for this caregiver."""
    fetch_one(db, "caregivers", caregiver_id, "Caregiver")
    now = datetime.now(timezone.utc).isoformat()
    changes = (
        {"consent_given": True, "consent_granted_at": now, "consent_revoked_at": None}
        if payload.consent_given
        else {"consent_given": False, "consent_revoked_at": now}
    )
    return db.table("caregivers").update(changes).eq("id", str(caregiver_id)).execute().data[0]


@router.get("/caregivers/{caregiver_id}/dashboard")
def caregiver_dashboard(caregiver_id: UUID, db=Depends(get_db)):
    """Everything the caregiver dashboard needs. Blocked (403) unless the patient consented."""
    caregiver = fetch_one(db, "caregivers", caregiver_id, "Caregiver")
    if not caregiver["consent_given"]:
        raise HTTPException(status_code=403, detail="Patient has not given consent to this caregiver")

    patient = fetch_one(db, "patients", caregiver["patient_id"], "Patient")
    today = local_today(patient.get("timezone") or "UTC")
    recent_alerts = (
        db.table("alerts")
        .select("*")
        .eq("caregiver_id", str(caregiver_id))
        .order("created_at", desc=True)
        .limit(20)
        .execute()
        .data
    )
    return {
        "caregiver": caregiver,
        "patient": {"id": patient["id"], "full_name": patient["full_name"], "age": patient.get("age")},
        "today": adherence.get_day_schedule(db, patient, today),
        "adherence_7d": adherence.compute_adherence(db, patient, 7),
        "refills": adherence.compute_refills(db, patient),
        "recent_alerts": recent_alerts,
    }
