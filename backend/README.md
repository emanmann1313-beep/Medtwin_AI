# MedTwin AI Pro - Backend (FastAPI + Supabase)

REST API for patients, prescriptions, medication schedules, dose tracking, refill status,
caregivers (consent-based) and alerts. Built for the MedTwin AI Pro hackathon.

**Requires Python 3.10+**

## 1. Set up Supabase (5 min)
1. Create a project at https://supabase.com (free tier is fine).
2. Open **SQL Editor -> New query**, paste all of `database/schema.sql`, click **Run**.
   *(Already ran the first version of the schema? Run `database/migration_002_audio_and_clash.sql` instead - it only adds the new columns.)*
3. (Optional demo data) New query, paste `database/seed.sql`, **Run**.
4. Open **Project Settings -> API** and copy the **Project URL** and the **service_role** key.

## 2. Run the backend
```bash
git clone <your-repo-url> && cd medtwin-backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # Windows: copy .env.example .env  -> then fill in the 2 Supabase values
uvicorn app.main:app --reload --port 8000
```
- Interactive docs (try every endpoint): http://localhost:8000/docs
- Health: http://localhost:8000/health and http://localhost:8000/health/db (checks Supabase)

## 3. Run the tests (no internet / Supabase needed)
```bash
pytest
```

## API reference
| Method | Path | Purpose |
|---|---|---|
| POST | `/patients` | Create patient `{full_name, age?, email?, phone?, timezone?}` |
| GET | `/patients`, `/patients/{id}` | List / get patients |
| POST | `/prescriptions` | **Save Gemini result**: creates prescription + medicines + dose schedule |
| GET | `/patients/{id}/prescriptions` | Prescription history |
| POST | `/medications` | Add one medicine manually (+ auto schedule) |
| GET | `/patients/{id}/medications` | Medicines (`?active_only=false` for all) |
| PATCH | `/medications/{id}` | Edit `pills_remaining, refill_threshold_days, instructions, active` |
| DELETE | `/medications/{id}` | Stop medicine (soft delete, removes future doses) |
| POST | `/medications/{id}/refill` | `{pills_added}` after the patient buys more |
| GET | `/patients/{id}/schedule?day=YYYY-MM-DD` | Day's doses with medicine info (default today) |
| POST | `/doses/{id}/take` | Mark taken (also lowers pill count) |
| POST | `/doses/{id}/skip` | Mark skipped |
| POST | `/patients/{id}/doses/mark-missed` | Sweep overdue doses to `missed`, returns them |
| GET | `/patients/{id}/doses` | **Raw dose history** `?status&start&end&limit` (digital twin input) |
| GET | `/patients/{id}/adherence?days=7` | Rate, daily series, per-medicine breakdown |
| GET | `/patients/{id}/refills` | Days left, run-out date, `status: ok/low/out/unknown` |
| POST | `/patients/{id}/caregivers` | Add caregiver (consent starts OFF) |
| GET | `/patients/{id}/caregivers` | List caregivers |
| POST | `/caregivers/{id}/consent` | `{consent_given: true/false}` |
| GET | `/caregivers/{id}/dashboard` | Caregiver view - **403 without consent** |
| GET | `/patients/{id}/audio-summary?lang=hi\|pa\|en&prescription_id=` | **Voice-note script** for the "Play Audio Summary" button (text, sentences, `tts_lang_code`, `audio_url`) |
| GET | `/patients/{id}/audio-summary.mp3?lang=` | Same voice note as an MP3 (gTTS; server needs internet) |
| POST | `/interactions/check` | **Clash checker**: send 2+ prescriptions, get an instant report (nothing is saved) |
| GET | `/patients/{id}/clashes?scope=cross\|all` | Clash report for medicines already saved for the patient |
| POST | `/alerts` | Creates `pending` alerts **only for consenting caregivers** |
| GET | `/alerts` | `?patient_id&caregiver_id&status=pending/sent/failed` |
| PATCH | `/alerts/{id}` | Worker sets `{status: "sent"|"failed"}` |

## JSON contract for the Gemini output (Member 1)
`POST /prescriptions`
```json
{
  "patient_id": "uuid-of-patient",
  "doctor_name": "Dr. Mehta",
  "raw_text": "full text read from the prescription (optional)",
  "image_url": null,
  "medications": [
    {
      "name": "Metformin",
      "dosage": "500 mg",
      "form": "tablet",
      "frequency_per_day": 2,
      "times": ["08:00", "20:00"],
      "pills_per_dose": 1,
      "duration_days": 30,
      "instructions": "after meals"
    }
  ]
}
```
Optional extra fields per medicine (these power the clash checker and the audio player):
```json
{
  "generic_name": "aspirin",
  "meal_timing": "after_food",
  "avoid_with": ["painkillers"],
  "brand_price_inr": 450,
  "jan_aushadhi_price_inr": 65
}
```
- `generic_name`: active ingredient(s). Much better clash detection than the brand name alone ("ibuprofen + paracetamol" for combination tablets).
- `meal_timing`: `before_food | after_food | with_food | empty_stomach`.
- `avoid_with` (any of): `painkillers, alcohol, antacids, dairy, grapefruit, drowsy`.
- `brand_price_inr` / `jan_aushadhi_price_inr`: shown in the voice note only when the Jan Aushadhi price is lower.
  Prescriptions do not contain prices - fill these from the official Jan Aushadhi (PMBI) price list.

Only `patient_id` and `medications[].name` are required. If `times` is missing, sensible defaults
are used from `frequency_per_day`. If `start_date` is missing, today (patient's timezone) is used.
Times are the patient's **local** 24-hour time; the API stores UTC.

## Second Doctor clash checker
- `POST /prescriptions` now returns `interaction_report`: the NEW medicines are compared with everything the patient
  already takes from other prescriptions. If `interaction_report.play_alarm` is `true`, the frontend shows the loud warning.
- `alert_level`: `danger` (major/critical -> alarm), `caution` (moderate -> yellow notice), `clear`.
- Every interaction has `title`, `detail`, `advice`, `severity`, and `speech.{en,hi,pa}` (ready to speak).
- Works with brand names (Ecosprin, Voveran, Dolo, ...) and `generic_name`. Medicines it does not recognise are listed in
  `unrecognised` - the UI should say "not checked" for those instead of "safe".
- The rules live in `app/services/interaction_data.py` (about 30 curated rules). Add more there; no code changes needed.

## Audio summary ("Elderly Parent" player)
- The script is assembled from fixed Hindi / Punjabi / English templates and the stored medicine data.
  No AI writes it, so it cannot invent a dose, warning or price.
- If the patient has a clash, the warning is spoken right after the greeting.
- Frontend: speak `text` with the browser voice (`SpeechSynthesisUtterance.lang = tts_lang_code`) or play `audio_url`.
  Browsers often have no Punjabi voice - for Punjabi use the MP3 endpoint.
- Copy-paste React components: `docs/frontend-snippets/ElderAudioPlayer.jsx` and `ClashAlarm.jsx`.
- Ask a native Hindi and Punjabi speaker to read the sample output once before the demo.

## Live demo script (2 minutes)
1. Run `database/seed.sql` (patient `11111111-1111-1111-1111-111111111111` with a cardiologist prescription incl. Ecosprin/aspirin).
2. Play the audio summary in Hindi, then switch to Punjabi.
3. Upload a 2nd prescription from an "orthopedic doctor" containing **Voveran SR 100** (diclofenac).
4. `POST /prescriptions` returns `interaction_report.play_alarm = true` -> red screen + siren + spoken warning.

## How doses and "missed" work
- Creating a medicine generates one `dose_logs` row per scheduled time (max 60 days ahead, past slots skipped).
- Status flow: `pending -> taken | skipped | missed`.
- Call `POST /patients/{id}/doses/mark-missed` every few minutes (frontend timer or a small worker).
  Doses overdue by `MISSED_GRACE_MINUTES` (default 60) become `missed` and are returned - use that list to raise alerts.

## Project structure
```
medtwin-backend/
├── app/
│   ├── main.py            # FastAPI app, CORS, error handling
│   ├── config.py          # reads .env
│   ├── database.py        # Supabase client + helpers
│   ├── schemas.py         # request validation (Pydantic)
│   ├── routers/           # patients, prescriptions, medications, doses, caregivers, alerts,
│   │                      #   interactions (clash checker), audio (voice summary)
│   └── services/          # scheduler.py, adherence.py, interactions.py + interaction_data.py, voice.py
├── database/              # schema.sql, seed.sql, migration_002_audio_and_clash.sql
├── tests/                 # pytest suite with an in-memory fake Supabase
├── docs/                  # TEAM_HANDOFF.md, frontend-snippets/ (ElderAudioPlayer.jsx, ClashAlarm.jsx)
├── requirements.txt  .env.example  .gitignore
```

## Safety notes (say this to the judges)
- AI (Gemini) is only used to READ the prescription; a person confirms the extracted medicines.
- Clash warnings and voice scripts are rule/template based and traceable - nothing is generated by an LLM.
- The interaction list is a limited demo list. It does not replace a doctor or pharmacist, and "no clash found"
  never means "safe". Planned next step: validate against a full drug database.
- The app only reminds and warns. It never changes a dose or diagnoses.

## Security notes
- `.env` holds the **service_role** key: never commit it and never use it in React code.
- RLS is enabled on every table with no policies, so the public anon key cannot read data directly.
  Frontend and Telegram code must go through this API.
- This hackathon version has no user login. Add Supabase Auth + JWT checks before real-world use.
