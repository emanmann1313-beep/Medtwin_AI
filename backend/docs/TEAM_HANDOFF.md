# Team handoff messages (Member 3 - Backend + Database)

## 1. Message for the whole team group chat
> Backend + database are DONE and tested. Repo: <GITHUB-URL>
> Setup takes 5 minutes - follow the README (Supabase schema, `.env`, `uvicorn app.main:app --reload`).
> Every endpoint is documented and testable at http://localhost:8000/docs.
> I'll DM the Supabase URL + service key privately - do NOT commit `.env` and never put the service key in React code.
> Everything goes through the API. If you need a new endpoint or field, message me - usually 5-10 min.

## 2. Member 1 (Gemini / prescription scanning)
> After Gemini extracts the prescription, POST the result to `/prescriptions` (JSON format in the README under
> "JSON contract"). Required: `patient_id` and each medicine's `name`. Use 24h `"HH:MM"` for `times`, or just send
> `frequency_per_day`. The response gives you the saved medicines and how many doses were scheduled.
> NEW optional fields per medicine: `generic_name` (active ingredient, e.g. "diclofenac"), `meal_timing`
> (`before_food|after_food|with_food|empty_stomach`), `avoid_with` (`painkillers|alcohol|antacids|dairy|grapefruit|drowsy`).
> Please ask Gemini for `generic_name` and `meal_timing` - they make the clash checker and the voice note much better.
> Do NOT ask Gemini for prices (prescriptions don't have them). The response of `POST /prescriptions` now contains
> `interaction_report` - if `play_alarm` is true, the second-doctor warning must trigger.
> Create a patient first with `POST /patients`. For the demo you can use the seeded patient id
> `11111111-1111-1111-1111-111111111111`.

## 3. Member 2 (Frontend)
> Dashboard data: `GET /patients/{id}/schedule` (today's doses with names + local times),
> `POST /doses/{id}/take` for the "Taken" button, `GET /patients/{id}/adherence?days=7` for charts
> (has a `daily` series), `GET /patients/{id}/refills` for low-stock badges, `GET /patients/{id}/medications` for the list.
> CORS is open for localhost:5173 and localhost:3000. Tell me if your dev port differs.

### Member 2 - new features
> Two ready components are in `docs/frontend-snippets/`: `ElderAudioPlayer.jsx` (giant button + Hindi/Punjabi/English toggle)
> and `ClashAlarm.jsx` (red flashing screen + siren + spoken warning). Pass them `patientId` and the `interaction_report`
> from `POST /prescriptions` (or from `POST /interactions/check` if you want to warn BEFORE saving).
> Browsers often lack a Punjabi voice, so the component plays the MP3 from the API first and falls back to the browser voice.

## 4. Member 4 (Digital twin)
> Raw history for simulations: `GET /patients/{id}/doses?start=&end=&status=` returns every dose with
> `scheduled_at`, `taken_at`, `status`. Baseline refill math is in `GET /patients/{id}/refills`
> (`daily_use`, `days_left`, `runs_out_on`). Run `database/seed.sql` for 14 days of realistic history
> (~80% adherence, one medicine nearly out) so you can build without waiting for real data.

### Member 4 - note
> The clash checker and the voice notes are rule-based and don't touch your prediction code - no changes needed on your side.

## 5. Member 5 (Caregiver alerts + dashboard)
> Consent is enforced server-side. Add caregiver -> `POST /patients/{id}/caregivers` (store their Telegram chat id in
> `telegram_chat_id`), patient approves with `POST /caregivers/{id}/consent {"consent_given": true}`.
> Create alerts with `POST /alerts` - rows are only created for consenting caregivers.
> Your worker: `GET /alerts?status=pending` -> send via Telegram -> `PATCH /alerts/{id} {"status":"sent"}`.
> Caregiver dashboard: `GET /caregivers/{id}/dashboard` (403 if consent is missing/revoked).
> To detect missed doses call `POST /patients/{id}/doses/mark-missed` every few minutes - it returns the newly missed doses.

## 6. Team leader - what to say about the two new features
> "Audio summaries and clash warnings are NOT written by AI. They come from fixed, reviewed templates and a curated
> interaction table, so they're predictable and traceable. Gemini only reads the prescription, and a human confirms it.
> Our interaction list is a demo list - 'no clash found' never means 'safe', and the app says so."
