"""Read-side calculations: day schedule, adherence stats, refill status, missed-dose sweep."""
from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from supabase import Client

from app.database import fetch_all
from app.services.scheduler import local_today


def parse_ts(value: str) -> datetime:
    """Parse a timestamp from Supabase into an aware datetime."""
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def day_bounds_utc(tz_name: str, day: date) -> tuple[datetime, datetime]:
    tz = ZoneInfo(tz_name)
    start = datetime.combine(day, time.min, tzinfo=tz).astimezone(timezone.utc)
    end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=tz).astimezone(timezone.utc)
    return start, end


def meds_by_id(db: Client, ids: set[str]) -> dict[str, dict[str, Any]]:
    if not ids:
        return {}
    rows = db.table("medications").select("*").in_("id", sorted(ids)).execute().data
    return {m["id"]: m for m in rows}


def _med_brief(med: dict[str, Any] | None) -> dict[str, Any] | None:
    if not med:
        return None
    return {k: med.get(k) for k in ("id", "name", "dosage", "form", "pills_per_dose", "instructions")}


# ------------------------------------------------------------ day schedule
def get_day_schedule(db: Client, patient: dict[str, Any], day: date) -> list[dict[str, Any]]:
    tz_name = patient.get("timezone") or "UTC"
    start, end = day_bounds_utc(tz_name, day)
    logs = (
        db.table("dose_logs")
        .select("*")
        .eq("patient_id", patient["id"])
        .gte("scheduled_at", start.isoformat())
        .lt("scheduled_at", end.isoformat())
        .order("scheduled_at")
        .execute()
        .data
    )
    meds = meds_by_id(db, {log["medication_id"] for log in logs})
    tz = ZoneInfo(tz_name)
    out = []
    for log in logs:
        item = dict(log)
        item["local_time"] = parse_ts(log["scheduled_at"]).astimezone(tz).strftime("%H:%M")
        item["medication"] = _med_brief(meds.get(log["medication_id"]))
        out.append(item)
    return out


# --------------------------------------------------------------- adherence
def compute_adherence(db: Client, patient: dict[str, Any], days: int) -> dict[str, Any]:
    tz = ZoneInfo(patient.get("timezone") or "UTC")
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)

    logs = fetch_all(
        lambda: db.table("dose_logs")
        .select("*")
        .eq("patient_id", patient["id"])
        .gte("scheduled_at", since.isoformat())
        .lte("scheduled_at", now.isoformat())
        .order("scheduled_at")
    )
    meds = meds_by_id(db, {log["medication_id"] for log in logs})

    totals = {"taken": 0, "missed": 0, "skipped": 0, "pending": 0}
    daily: dict[str, dict[str, int]] = {}
    per_med: dict[str, dict[str, Any]] = {}

    for log in logs:
        status = log["status"]
        totals[status] += 1
        day_key = parse_ts(log["scheduled_at"]).astimezone(tz).date().isoformat()
        d = daily.setdefault(day_key, {"taken": 0, "missed": 0, "skipped": 0, "pending": 0})
        d[status] += 1
        m = per_med.setdefault(
            log["medication_id"],
            {
                "medication_id": log["medication_id"],
                "name": (meds.get(log["medication_id"]) or {}).get("name"),
                "taken": 0,
                "missed": 0,
                "skipped": 0,
                "pending": 0,
            },
        )
        m[status] += 1

    def rate(taken: int, missed: int, skipped: int) -> float | None:
        due = taken + missed + skipped
        return round(taken / due * 100, 1) if due else None

    for m in per_med.values():
        m["adherence_rate"] = rate(m["taken"], m["missed"], m["skipped"])

    return {
        "patient_id": patient["id"],
        "days": days,
        "taken": totals["taken"],
        "missed": totals["missed"],
        "skipped": totals["skipped"],
        "pending_overdue": totals["pending"],
        "adherence_rate": rate(totals["taken"], totals["missed"], totals["skipped"]),
        "daily": [{"date": k, **v} for k, v in sorted(daily.items())],
        "per_medication": sorted(per_med.values(), key=lambda x: x["name"] or ""),
    }


# ----------------------------------------------------------------- refills
def refill_status(med: dict[str, Any], today: date) -> dict[str, Any]:
    daily_use = med["frequency_per_day"] * med["pills_per_dose"]
    remaining = med.get("pills_remaining")
    days_left: float | None = None
    runs_out_on: str | None = None
    status = "unknown"

    if remaining is not None and daily_use > 0:
        days_left = round(remaining / daily_use, 1)
        runs_out_on = (today + timedelta(days=int(remaining // daily_use))).isoformat()
        if remaining <= 0:
            status = "out"
        elif days_left <= med["refill_threshold_days"]:
            status = "low"
        else:
            status = "ok"

    return {
        "medication_id": med["id"],
        "name": med["name"],
        "pills_remaining": remaining,
        "daily_use": daily_use,
        "days_left": days_left,
        "runs_out_on": runs_out_on,
        "refill_threshold_days": med["refill_threshold_days"],
        "needs_refill": status in ("low", "out"),
        "status": status,
    }


def compute_refills(db: Client, patient: dict[str, Any]) -> list[dict[str, Any]]:
    meds = (
        db.table("medications")
        .select("*")
        .eq("patient_id", patient["id"])
        .eq("active", True)
        .order("name")
        .execute()
        .data
    )
    today = local_today(patient.get("timezone") or "UTC")
    return [refill_status(m, today) for m in meds]


# -------------------------------------------------------- missed-dose sweep
def mark_missed(db: Client, patient: dict[str, Any], grace_minutes: int) -> list[dict[str, Any]]:
    """Pending doses older than the grace period become 'missed'. Returns the newly missed ones."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=grace_minutes)).isoformat()
    pending = (
        db.table("dose_logs")
        .select("*")
        .eq("patient_id", patient["id"])
        .eq("status", "pending")
        .lt("scheduled_at", cutoff)
        .order("scheduled_at")
        .execute()
        .data
    )
    if not pending:
        return []

    (
        db.table("dose_logs")
        .update({"status": "missed"})
        .eq("patient_id", patient["id"])
        .eq("status", "pending")
        .lt("scheduled_at", cutoff)
        .execute()
    )
    meds = meds_by_id(db, {d["medication_id"] for d in pending})
    out = []
    for d in pending:
        item = dict(d)
        item["status"] = "missed"
        item["medication"] = _med_brief(meds.get(d["medication_id"]))
        out.append(item)
    return out
