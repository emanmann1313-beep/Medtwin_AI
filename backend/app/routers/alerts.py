from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import fetch_one, get_db
from app.schemas import AlertCreate, AlertUpdate

router = APIRouter(tags=["Alerts"])


@router.post("/alerts", status_code=201)
def create_alerts(payload: AlertCreate, db=Depends(get_db)):
    """Creates one 'pending' alert per caregiver who HAS CONSENTED. No consent = no alert.

    Member 5's Telegram worker then sends the pending alerts and calls PATCH /alerts/{id}.
    """
    fetch_one(db, "patients", payload.patient_id, "Patient")
    if payload.medication_id:
        fetch_one(db, "medications", payload.medication_id, "Medication")

    caregivers = db.table("caregivers").select("*").eq("patient_id", str(payload.patient_id)).execute().data
    consented = [c for c in caregivers if c["consent_given"]]

    rows = [
        {
            "patient_id": str(payload.patient_id),
            "caregiver_id": c["id"],
            "medication_id": str(payload.medication_id) if payload.medication_id else None,
            "alert_type": payload.alert_type,
            "message": payload.message,
            "status": "pending",
        }
        for c in consented
    ]
    created = db.table("alerts").insert(rows).execute().data if rows else []
    return {
        "created": len(created),
        "skipped_no_consent": len(caregivers) - len(consented),
        "alerts": created,
    }


@router.get("/alerts")
def list_alerts(
    patient_id: UUID | None = None,
    caregiver_id: UUID | None = None,
    status: str | None = Query(default=None, pattern="^(pending|sent|failed)$"),
    limit: int = Query(default=100, ge=1, le=1000),
    db=Depends(get_db),
):
    q = db.table("alerts").select("*")
    if patient_id:
        q = q.eq("patient_id", str(patient_id))
    if caregiver_id:
        q = q.eq("caregiver_id", str(caregiver_id))
    if status:
        q = q.eq("status", status)
    return q.order("created_at", desc=True).limit(limit).execute().data


@router.patch("/alerts/{alert_id}")
def update_alert(alert_id: UUID, payload: AlertUpdate, db=Depends(get_db)):
    alert = fetch_one(db, "alerts", alert_id, "Alert")
    if alert["status"] == "sent":
        raise HTTPException(status_code=409, detail="Alert was already sent")
    changes = {"status": payload.status}
    if payload.status == "sent":
        changes["sent_at"] = datetime.now(timezone.utc).isoformat()
    return db.table("alerts").update(changes).eq("id", str(alert_id)).execute().data[0]
