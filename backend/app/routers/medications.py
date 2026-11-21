from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import fetch_one, get_db
from app.schemas import MedicationCreate, MedicationUpdate, RefillRequest
from app.services.scheduler import create_medication

router = APIRouter(tags=["Medications"])


@router.post("/medications", status_code=201)
def add_medication(payload: MedicationCreate, db=Depends(get_db)):
    """Add one medicine manually and auto-generate its dose schedule."""
    patient = fetch_one(db, "patients", payload.patient_id, "Patient")
    prescription_id = str(payload.prescription_id) if payload.prescription_id else None
    if prescription_id:
        fetch_one(db, "prescriptions", prescription_id, "Prescription")
    med, doses_created = create_medication(db, patient, payload, prescription_id)
    return {"medication": med, "doses_created": doses_created}


@router.get("/patients/{patient_id}/medications")
def list_medications(
    patient_id: UUID,
    active_only: bool = Query(default=True),
    db=Depends(get_db),
):
    fetch_one(db, "patients", patient_id, "Patient")
    q = db.table("medications").select("*").eq("patient_id", str(patient_id))
    if active_only:
        q = q.eq("active", True)
    return q.order("name").execute().data


@router.get("/medications/{medication_id}")
def get_medication(medication_id: UUID, db=Depends(get_db)):
    return fetch_one(db, "medications", medication_id, "Medication")


@router.patch("/medications/{medication_id}")
def update_medication(medication_id: UUID, payload: MedicationUpdate, db=Depends(get_db)):
    fetch_one(db, "medications", medication_id, "Medication")
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Nothing to update")
    return db.table("medications").update(changes).eq("id", str(medication_id)).execute().data[0]


@router.delete("/medications/{medication_id}")
def stop_medication(medication_id: UUID, db=Depends(get_db)):
    """Soft-delete: marks the medicine inactive and removes its future pending doses."""
    fetch_one(db, "medications", medication_id, "Medication")
    now = datetime.now(timezone.utc).isoformat()
    db.table("medications").update({"active": False}).eq("id", str(medication_id)).execute()
    removed = (
        db.table("dose_logs")
        .delete()
        .eq("medication_id", str(medication_id))
        .eq("status", "pending")
        .gte("scheduled_at", now)
        .execute()
        .data
    )
    return {"medication_id": str(medication_id), "active": False, "future_doses_removed": len(removed)}


@router.post("/medications/{medication_id}/refill")
def refill_medication(medication_id: UUID, payload: RefillRequest, db=Depends(get_db)):
    """Patient bought more pills: add them to the remaining stock."""
    med = fetch_one(db, "medications", medication_id, "Medication")
    new_total = (med.get("pills_remaining") or 0) + payload.pills_added
    return (
        db.table("medications")
        .update({"pills_remaining": new_total})
        .eq("id", str(medication_id))
        .execute()
        .data[0]
    )
