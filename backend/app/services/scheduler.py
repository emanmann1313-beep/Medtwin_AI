"""Turns a medication into concrete dose rows (one per scheduled time)."""
from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from supabase import Client

from app.schemas import MedicationBase

DEFAULT_DURATION_DAYS = 30  # used when the prescription has no duration
MAX_SCHEDULE_DAYS = 60  # never pre-generate more than this many days


def local_today(tz_name: str) -> date:
    return datetime.now(ZoneInfo(tz_name)).date()


def build_dose_rows(med: dict[str, Any], tz_name: str, now: datetime | None = None) -> list[dict[str, Any]]:
    """Dose rows for a medication row. Slots already in the past are skipped."""
    tz = ZoneInfo(tz_name)
    now = now or datetime.now(timezone.utc)
    start = date.fromisoformat(med["start_date"])
    days = min(med.get("duration_days") or DEFAULT_DURATION_DAYS, MAX_SCHEDULE_DAYS)

    rows: list[dict[str, Any]] = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        for slot in med["times"]:
            hh, mm = slot.split(":")
            local_dt = datetime.combine(day, time(int(hh), int(mm)), tzinfo=tz)
            utc_dt = local_dt.astimezone(timezone.utc)
            if utc_dt < now:
                continue
            rows.append(
                {
                    "medication_id": med["id"],
                    "patient_id": med["patient_id"],
                    "scheduled_at": utc_dt.isoformat(),
                    "status": "pending",
                }
            )
    return rows


def create_medication(
    db: Client,
    patient: dict[str, Any],
    payload: MedicationBase,
    prescription_id: str | None = None,
) -> tuple[dict[str, Any], int]:
    """Insert a medication and generate its dose schedule. Returns (row, doses_created)."""
    tz_name = patient.get("timezone") or "UTC"
    row = payload.model_dump(mode="json", exclude={"patient_id", "prescription_id"})

    start = payload.start_date or local_today(tz_name)
    row["start_date"] = start.isoformat()
    if payload.duration_days:
        row["end_date"] = (start + timedelta(days=payload.duration_days - 1)).isoformat()
    if row.get("pills_remaining") is None and payload.duration_days:
        row["pills_remaining"] = payload.duration_days * payload.frequency_per_day * payload.pills_per_dose
    row["avoid_with"] = row.get("avoid_with") or []
    row["patient_id"] = patient["id"]
    row["prescription_id"] = prescription_id

    med = db.table("medications").insert(row).execute().data[0]
    doses = build_dose_rows(med, tz_name)
    if doses:
        db.table("dose_logs").insert(doses).execute()
    return med, len(doses)
