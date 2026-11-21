import re
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.database import get_db
from app.main import app
from app.routers import audio as audio_module
from app.services.interactions import check_interactions, ingredients_of
from tests.fake_supabase import FakeSupabase

DEVANAGARI = re.compile(r"[\u0900-\u097F]")
GURMUKHI = re.compile(r"[\u0A00-\u0A7F]")


def med(name, group="A", generic=None, i=None):
    return {"id": i or name, "name": name, "generic_name": generic, "group": group}


# ------------------------------------------------------------ engine only
def test_ingredient_detection_handles_brands_and_noise():
    assert ingredients_of(med("Tab. Ecosprin 75mg")) == {"aspirin"}
    assert ingredients_of(med("Voveran SR 100")) == {"diclofenac"}
    assert ingredients_of(med("Combiflam")) == {"ibuprofen", "paracetamol"}
    assert ingredients_of(med("Whatever", generic="Warfarin Sodium 5 mg")) == {"warfarin"}
    assert ingredients_of(med("Mysterious Syrup")) == set()


def test_orthopedic_painkiller_vs_cardiology_aspirin_is_danger():
    r = check_interactions([med("Ecosprin 75", "cardio"), med("Voveran SR 100", "ortho")])
    assert r["alert_level"] == "danger" and r["play_alarm"] is True
    top = r["interactions"][0]
    assert top["severity"] == "major" and top["risk"] == "bleeding"
    assert {top["medication_a"]["name"], top["medication_b"]["name"]} == {"Ecosprin 75", "Voveran SR 100"}
    assert DEVANAGARI.search(top["speech"]["hi"]) and GURMUKHI.search(top["speech"]["pa"])
    assert "{" not in top["speech"]["en"] + top["speech"]["hi"] + top["speech"]["pa"]


def test_critical_pair():
    r = check_interactions([med("Viagra 50", "x"), med("Sorbitrate", "y")])
    assert r["highest_severity"] == "critical" and r["play_alarm"] is True
    assert r["interactions"][0]["speech"]["en"].startswith("Danger!")


def test_clear_and_caution_levels():
    clear = check_interactions([med("Metformin", "a"), med("Amlodipine", "b")])
    assert clear["alert_level"] == "clear" and clear["play_alarm"] is False and clear["interactions"] == []
    caution = check_interactions([med("Ciprofloxacin 500", "a"), med("Calcium carbonate", "b")])
    assert caution["alert_level"] == "caution" and caution["play_alarm"] is False


def test_duplicate_ingredient_across_doctors():
    r = check_interactions([med("Dolo 650", "a"), med("Crocin", "b")])
    assert r["interactions"][0]["risk"] == "duplicate"
    r = check_interactions([med("Combiflam", "a"), med("Dolo 650", "b")])
    assert "paracetamol" in r["interactions"][0]["title"]


def test_cross_only_skips_same_prescription():
    meds = [med("Ecosprin 75", "same"), med("Voveran", "same")]
    assert check_interactions(meds, cross_only=True)["interaction_count"] == 0
    assert check_interactions(meds, cross_only=False)["interaction_count"] == 1


def test_unrecognised_is_reported_not_hidden():
    r = check_interactions([med("Mysterious Syrup", "a"), med("Metformin", "b")])
    assert r["unrecognised"] == ["Mysterious Syrup"] and r["alert_level"] == "clear"
    assert "does not replace a doctor" in r["disclaimer"]


# ---------------------------------------------------------------- API
@pytest.fixture()
def fake():
    return FakeSupabase()


@pytest.fixture()
def client(fake):
    app.dependency_overrides[get_db] = lambda: fake
    yield TestClient(app)
    app.dependency_overrides.clear()


def tomorrow():
    return (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat()


def new_patient(client):
    return client.post("/patients", json={"full_name": "Mohan Singh", "timezone": "Asia/Kolkata"}).json()["id"]


def new_prescription(client, pid, doctor, meds):
    body = {"patient_id": pid, "doctor_name": doctor, "medications": [{"start_date": tomorrow(), **m} for m in meds]}
    r = client.post("/prescriptions", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_stateless_check_with_two_prescriptions(client):
    r = client.post("/interactions/check", json={"prescriptions": [
        {"label": "Dr. Sharma (Cardiologist)", "medications": [{"name": "Ecosprin 75"}, {"name": "Metformin"}]},
        {"label": "Dr. Gill (Orthopedic)", "medications": [{"name": "Voveran SR 100"}]},
    ]})
    assert r.status_code == 200
    data = r.json()
    assert data["play_alarm"] is True and data["interaction_count"] == 1
    labels = {data["interactions"][0]["medication_a"]["prescription_label"],
              data["interactions"][0]["medication_b"]["prescription_label"]}
    assert labels == {"Dr. Sharma (Cardiologist)", "Dr. Gill (Orthopedic)"}
    assert client.post("/interactions/check", json={"prescriptions": []}).status_code == 422


def test_second_doctor_prescription_triggers_alarm_immediately(client):
    pid = new_patient(client)
    first = new_prescription(client, pid, "Dr. Sharma", [
        {"name": "Ecosprin 75", "dosage": "75 mg", "generic_name": "aspirin"}, {"name": "Metformin"}])
    assert first["interaction_report"]["alert_level"] == "clear"

    second = new_prescription(client, pid, "Dr. Gill", [{"name": "Voveran SR 100", "frequency_per_day": 2}])
    report = second["interaction_report"]
    assert report["play_alarm"] is True and report["interaction_count"] == 1

    cross = client.get(f"/patients/{pid}/clashes").json()
    assert cross["alert_level"] == "danger" and cross["patient_id"] == pid
    only_first = client.get(f"/patients/{pid}/clashes", params={"prescription_ids": first["prescription"]["id"]}).json()
    assert only_first["alert_level"] == "clear"


def test_audio_summary_three_languages(client):
    pid = new_patient(client)
    rx = new_prescription(client, pid, "Dr. Sharma", [
        {"name": "Ecosprin 75", "dosage": "75 mg", "times": ["09:00"], "meal_timing": "after_food",
         "avoid_with": ["painkillers"], "brand_price_inr": 450, "jan_aushadhi_price_inr": 65},
        {"name": "Metformin", "dosage": "500 mg", "times": ["08:00", "20:00"], "meal_timing": "with_food"},
    ])
    for lang, script in (("en", None), ("hi", DEVANAGARI), ("pa", GURMUKHI)):
        r = client.get(f"/patients/{pid}/audio-summary", params={"lang": lang})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["lang"] == lang and d["medicine_count"] == 2
        assert d["tts_lang_code"] == {"en": "en-IN", "hi": "hi-IN", "pa": "pa-IN"}[lang]
        assert "{" not in d["text"] and "}" not in d["text"] and "None" not in d["text"]
        assert "450" in d["text"] and "65" in d["text"] and d["total_savings_inr"] == 385.0
        assert d["audio_url"].endswith(f"audio-summary.mp3?lang={lang}")
        if script:
            assert script.search(d["text"])
        assert d["has_clash_warning"] is False
    hi = client.get(f"/patients/{pid}/audio-summary", params={"lang": "hi"}).json()["text"]
    assert "नमस्ते" in hi and "सुबह नाश्ते के बाद" in hi and "दर्द की गोली नहीं लेनी है" in hi
    assert "ecosprin 75 75" not in hi.lower()  # strength not repeated

    assert client.get(f"/patients/{pid}/audio-summary", params={"lang": "fr"}).status_code == 422
    one = client.get(f"/patients/{pid}/audio-summary",
                     params={"lang": "en", "prescription_id": rx["prescription"]["id"]}).json()
    assert one["medicine_count"] == 2


def test_audio_summary_includes_clash_warning_even_for_single_prescription(client):
    pid = new_patient(client)
    new_prescription(client, pid, "Dr. Sharma", [{"name": "Ecosprin 75", "generic_name": "aspirin"}])
    rx2 = new_prescription(client, pid, "Dr. Gill", [{"name": "Voveran SR 100"}])
    d = client.get(f"/patients/{pid}/audio-summary",
                   params={"lang": "pa", "prescription_id": rx2["prescription"]["id"]}).json()
    assert d["medicine_count"] == 1 and d["has_clash_warning"] is True and d["alert_level"] == "danger"
    assert "ਸਾਵਧਾਨ" in d["text"]


def test_audio_summary_404_without_medicines(client):
    pid = new_patient(client)
    assert client.get(f"/patients/{pid}/audio-summary").status_code == 404


def test_mp3_endpoint(client, monkeypatch):
    pid = new_patient(client)
    new_prescription(client, pid, "Dr. Sharma", [{"name": "Metformin"}])
    calls = []
    monkeypatch.setattr(audio_module, "synthesize", lambda text, lang: calls.append(lang) or b"ID3-fake-mp3")
    r = client.get(f"/patients/{pid}/audio-summary.mp3", params={"lang": "hi"})
    assert r.status_code == 200 and r.headers["content-type"] == "audio/mpeg" and r.content == b"ID3-fake-mp3"
    assert calls == ["hi"]

    def boom(text, lang):
        raise ConnectionError("no internet")

    monkeypatch.setattr(audio_module, "synthesize", boom)
    r = client.get(f"/patients/{pid}/audio-summary.mp3", params={"lang": "en"})
    assert r.status_code == 503 and "browser voice" in r.json()["detail"]


def test_new_medicine_fields_validated(client):
    pid = new_patient(client)
    base = {"patient_id": pid, "name": "X"}
    assert client.post("/medications", json={**base, "avoid_with": ["fireworks"]}).status_code == 422
    assert client.post("/medications", json={**base, "brand_price_inr": -5}).status_code == 422
    assert client.post("/medications", json={**base, "meal_timing": "whenever"}).status_code == 422
    ok = client.post("/medications", json={**base, "avoid_with": ["alcohol"], "meal_timing": "empty_stomach"})
    assert ok.status_code == 201 and ok.json()["medication"]["avoid_with"] == ["alcohol"]
    default = client.post("/medications", json={**base, "name": "Y"}).json()["medication"]
    assert default["avoid_with"] == []
