from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.database import fetch_one, get_db
from app.schemas import PrescriptionCreate
from app.services.interactions import check_interactions
from app.services.scheduler import create_medication

router = APIRouter(tags=["Prescriptions"])


@router.post("/prescriptions", status_code=201)
def save_prescription(payload: PrescriptionCreate, db=Depends(get_db)):
    """Member 1 calls this with the Gemini-extracted JSON.

    Saves the prescription, creates every medication and generates all dose schedules.
    The response includes `interaction_report`: if `play_alarm` is true, show the loud warning.
    If anything fails halfway, the prescription (and everything under it) is removed.
    """
    patient = fetch_one(db, "patients", payload.patient_id, "Patient")

    prescription = (
        db.table("prescriptions")
        .insert(
            {
                "patient_id": patient["id"],
                "doctor_name": payload.doctor_name,
                "image_url": payload.image_url,
                "raw_text": payload.raw_text,
            }
        )
        .execute()
        .data[0]
    )

    medications = []
    total_doses = 0
    try:
        for item in payload.medications:
            med, doses_created = create_medication(db, patient, item, prescription["id"])
            medications.append(med)
            total_doses += doses_created
    except Exception as exc:
        # roll back: cascade delete removes medications and dose logs too
        db.table("prescriptions").delete().eq("id", prescription["id"]).execute()
        raise HTTPException(status_code=500, detail=f"Could not save prescription: {exc}") from exc

    # "Second Doctor" check: new medicines vs everything else the patient already takes
    existing = (
        db.table("medications")
        .select("*")
        .eq("patient_id", patient["id"])
        .eq("active", True)
        .execute()
        .data
    )
    for m in existing:
        m["group"] = m.get("prescription_id")
    report = check_interactions(existing, cross_only=True, focus_ids={m["id"] for m in medications})

    return {
        "prescription": prescription,
        "medications": medications,
        "doses_created": total_doses,
        "interaction_report": report,
    }


@router.get("/patients/{patient_id}/prescriptions")
def list_prescriptions(patient_id: UUID, db=Depends(get_db)):
    fetch_one(db, "patients", patient_id, "Patient")
    return (
        db.table("prescriptions")
        .select("*")
        .eq("patient_id", str(patient_id))
        .order("created_at", desc=True)
        .execute()
        .data
    )
