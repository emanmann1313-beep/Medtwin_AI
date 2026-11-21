from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.database import fetch_one, get_db
from app.schemas import InteractionCheckRequest
from app.services.interactions import check_interactions

router = APIRouter(tags=["Clash Checker"])


@router.post("/interactions/check")
def check_prescriptions(payload: InteractionCheckRequest):
    """Stateless check - nothing is saved. Send two prescriptions, get an instant clash report.

    Great for the live demo and for checking BEFORE saving: the frontend sends both prescriptions'
    medicines and plays the alarm when `play_alarm` is true.
    """
    meds = []
    for g_index, group in enumerate(payload.prescriptions):
        for m_index, m in enumerate(group.medications):
            meds.append({
                "id": f"{g_index}-{m_index}",
                "name": m.name,
                "generic_name": m.generic_name,
                "dosage": m.dosage,
                "group": f"{g_index}:{group.label}",
            })
    report = check_interactions(meds, cross_only=payload.cross_only)
    labels = {f"{i}:{g.label}": g.label for i, g in enumerate(payload.prescriptions)}
    for item in report["interactions"]:
        for key in ("medication_a", "medication_b"):
            item[key]["prescription_label"] = labels.get(item[key].pop("group"))
    return report


@router.get("/patients/{patient_id}/clashes")
def patient_clashes(
    patient_id: UUID,
    scope: str = Query(default="cross", pattern="^(cross|all)$",
                       description="cross = only medicines from different prescriptions; all = every pair"),
    prescription_ids: list[UUID] | None = Query(default=None, description="limit to these prescriptions"),
    db=Depends(get_db),
):
    """Clash report for the patient's ACTIVE medicines saved in the database."""
    fetch_one(db, "patients", patient_id, "Patient")
    meds = db.table("medications").select("*").eq("patient_id", str(patient_id)).eq("active", True).execute().data
    if prescription_ids:
        wanted = {str(p) for p in prescription_ids}
        meds = [m for m in meds if m.get("prescription_id") in wanted]
    for m in meds:
        m["group"] = m.get("prescription_id")
    report = check_interactions(meds, cross_only=(scope == "cross"))
    report["patient_id"] = str(patient_id)
    return report
