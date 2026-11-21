from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.database import get_db
from app.main import app
from tests.fake_supabase import FakeSupabase


@pytest.fixture()
def fake():
    return FakeSupabase()


@pytest.fixture()
def client(fake):
    app.dependency_overrides[get_db] = lambda: fake
    yield TestClient(app)
    app.dependency_overrides.clear()


def tomorrow() -> str:
    return (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat()


def make_patient(client, **extra):
    r = client.post("/patients", json={"full_name": "Asha Rao", "age": 70, "timezone": "Asia/Kolkata", **extra})
    assert r.status_code == 201, r.text
    return r.json()


def make_prescription(client, patient_id):
    body = {
        "patient_id": patient_id,
        "doctor_name": "Dr. Mehta",
        "raw_text": "Metformin 500mg BD x 5 days",
        "medications": [
            {"name": "Metformin", "dosage": "500 mg", "times": ["08:00", "20:00"],
             "duration_days": 5, "start_date": tomorrow()},
            {"name": "Amlodipine", "dosage": "5 mg", "frequency_per_day": 1,
             "duration_days": 3, "start_date": tomorrow(), "pills_remaining": 4},
        ],
    }
    r = client.post("/prescriptions", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_patient_validation(client):
    assert client.post("/patients", json={"full_name": "  "}).status_code == 422
    assert client.post("/patients", json={"full_name": "X", "timezone": "Mars/Base"}).status_code == 422
    assert client.get("/patients/not-a-uuid").status_code == 422
    assert client.get("/patients/11111111-1111-1111-1111-111111111111").status_code == 404


def test_prescription_creates_meds_and_doses(client):
    p = make_patient(client)
    data = make_prescription(client, p["id"])
    assert len(data["medications"]) == 2
    assert data["doses_created"] == 5 * 2 + 3 * 1
    metformin = data["medications"][0]
    assert metformin["pills_remaining"] == 10  # auto: 5 days x 2 x 1
    assert metformin["end_date"] is not None
    assert data["medications"][1]["pills_remaining"] == 4  # explicit value kept
    meds = client.get(f"/patients/{p['id']}/medications").json()
    assert [m["name"] for m in meds] == ["Amlodipine", "Metformin"]


def test_bad_times_rejected(client):
    p = make_patient(client)
    r = client.post("/medications", json={"patient_id": p["id"], "name": "X", "times": ["25:99"]})
    assert r.status_code == 422


def test_schedule_take_and_refill(client):
    p = make_patient(client)
    make_prescription(client, p["id"])
    sched = client.get(f"/patients/{p['id']}/schedule", params={"day": tomorrow()}).json()
    assert len(sched["doses"]) == 3  # metformin x2 + amlodipine x1
    amlo = next(d for d in sched["doses"] if d["medication"]["name"] == "Amlodipine")
    assert amlo["local_time"] == "09:00"  # default dose time is LOCAL time for the patient
    assert amlo["scheduled_at"].endswith("03:30:00+00:00")  # ...stored in UTC (IST = UTC+5:30)

    r = client.post(f"/doses/{amlo['id']}/take")
    assert r.status_code == 200
    assert r.json()["dose"]["status"] == "taken"
    assert r.json()["medication"]["pills_remaining"] == 3
    # double tap is harmless
    assert client.post(f"/doses/{amlo['id']}/take").json()["medication"]["pills_remaining"] == 3
    assert client.post(f"/doses/{amlo['id']}/skip").status_code == 409

    refills = {x["name"]: x for x in client.get(f"/patients/{p['id']}/refills").json()}
    assert refills["Amlodipine"]["status"] == "low"  # 3 pills = 3 days <= threshold 3
    assert refills["Amlodipine"]["needs_refill"] is True
    assert refills["Metformin"]["status"] == "ok"

    med_id = refills["Amlodipine"]["medication_id"]
    assert client.post(f"/medications/{med_id}/refill", json={"pills_added": 30}).json()["pills_remaining"] == 33
    assert client.post(f"/medications/{med_id}/refill", json={"pills_added": 0}).status_code == 422


def test_mark_missed_and_adherence(client, fake):
    p = make_patient(client)
    data = make_prescription(client, p["id"])
    med_id = data["medications"][0]["id"]
    past = datetime.now(timezone.utc) - timedelta(hours=5)
    for i, status in enumerate(["taken", "taken", "taken", "pending"]):
        fake.table("dose_logs").insert({
            "medication_id": med_id, "patient_id": p["id"],
            "scheduled_at": (past - timedelta(hours=i)).isoformat(), "status": status,
        }).execute()

    r = client.post(f"/patients/{p['id']}/doses/mark-missed").json()
    assert r["newly_missed"] == 1
    assert r["doses"][0]["medication"]["name"] == "Metformin"
    assert client.post(f"/patients/{p['id']}/doses/mark-missed").json()["newly_missed"] == 0

    a = client.get(f"/patients/{p['id']}/adherence", params={"days": 7}).json()
    assert (a["taken"], a["missed"]) == (3, 1)
    assert a["adherence_rate"] == 75.0
    assert a["per_medication"][0]["name"] == "Metformin"
    assert client.get(f"/patients/{p['id']}/adherence", params={"days": 0}).status_code == 422

    raw = client.get(f"/patients/{p['id']}/doses", params={"status": "missed"}).json()
    assert len(raw) == 1


def test_consent_gates_alerts_and_dashboard(client):
    p = make_patient(client)
    make_prescription(client, p["id"])
    cg = client.post(f"/patients/{p['id']}/caregivers", json={"name": "Ravi", "telegram_chat_id": "12345"}).json()
    assert cg["consent_given"] is False

    # no consent -> no alert, dashboard blocked
    r = client.post("/alerts", json={"patient_id": p["id"], "alert_type": "missed_dose", "message": "Missed dose"})
    assert r.json()["created"] == 0 and r.json()["skipped_no_consent"] == 1
    assert client.get(f"/caregivers/{cg['id']}/dashboard").status_code == 403

    # consent granted
    assert client.post(f"/caregivers/{cg['id']}/consent", json={"consent_given": True}).json()["consent_given"] is True
    r = client.post("/alerts", json={"patient_id": p["id"], "alert_type": "missed_dose", "message": "Missed dose"})
    assert r.json()["created"] == 1
    alert_id = r.json()["alerts"][0]["id"]
    dash = client.get(f"/caregivers/{cg['id']}/dashboard")
    assert dash.status_code == 200
    assert dash.json()["patient"]["full_name"] == "Asha Rao"
    assert len(dash.json()["recent_alerts"]) == 1

    # worker marks it sent
    assert client.get("/alerts", params={"status": "pending"}).json()[0]["id"] == alert_id
    assert client.patch(f"/alerts/{alert_id}", json={"status": "sent"}).json()["sent_at"] is not None
    assert client.patch(f"/alerts/{alert_id}", json={"status": "failed"}).status_code == 409

    # consent revoked -> blocked again
    client.post(f"/caregivers/{cg['id']}/consent", json={"consent_given": False})
    assert client.get(f"/caregivers/{cg['id']}/dashboard").status_code == 403
    r = client.post("/alerts", json={"patient_id": p["id"], "message": "again"})
    assert r.json()["created"] == 0


def test_stop_medication_removes_future_doses(client):
    p = make_patient(client)
    data = make_prescription(client, p["id"])
    med_id = data["medications"][0]["id"]
    r = client.delete(f"/medications/{med_id}").json()
    assert r["active"] is False and r["future_doses_removed"] == 10
    assert [m["name"] for m in client.get(f"/patients/{p['id']}/medications").json()] == ["Amlodipine"]
    assert client.patch(f"/medications/{med_id}", json={}).status_code == 400
