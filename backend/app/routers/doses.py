from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.database import fetch_one, get_db

router = APIRouter(tags=["Doses"])


@router.post("/doses/{dose_id}/take")
def take_dose(dose_id: UUID, db=Depends(get_db)):
    """Patient pressed 'Taken'. Also reduces the remaining pill count."""
    dose = fetch_one(db, "dose_logs", dose_id, "Dose")
    med = fetch_one(db, "medications", dose["medication_id"], "Medication")
    if dose["status"] == "taken":  # idempotent: double-tap is harmless
        return {"dose": dose, "medication": med}

    now = datetime.now(timezone.utc).isoformat()
    dose = (
        db.table("dose_logs")
        .update({"status": "taken", "taken_at": now})
        .eq("id", str(dose_id))
        .execute()
        .data[0]
    )
    remaining = med.get("pills_remaining")
    if remaining is not None:
        med = (
            db.table("medications")
            .update({"pills_remaining": max(0, remaining - med["pills_per_dose"])})
            .eq("id", med["id"])
            .execute()
            .data[0]
        )
    return {"dose": dose, "medication": med}


@router.post("/doses/{dose_id}/skip")
def skip_dose(dose_id: UUID, db=Depends(get_db)):
    dose = fetch_one(db, "dose_logs", dose_id, "Dose")
    if dose["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"Dose is already {dose['status']}")
    return db.table("dose_logs").update({"status": "skipped"}).eq("id", str(dose_id)).execute().data[0]
