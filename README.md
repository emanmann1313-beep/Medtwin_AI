<h1 align="center">MedTwin AI</h1>

**Your medicines. Your care team. One connected view.**

An AI-powered medication management platform that scans prescriptions, builds medicine schedules,
tracks missed doses, predicts refill shortages, simulates "what if" scenarios with a **digital twin**,
and keeps caregivers, doctors and hospitals connected, always with the patient's consent.

**Live demo:** https://medtwin-ai-r7u9.onrender.com

> Hosted on a free Render instance. If the first load takes 30-60 seconds, the server is waking up.

---

<img width="1902" height="867" alt="image" src="https://github.com/user-attachments/assets/a4ba8d74-5fb2-458c-9ce3-a94bfa16a1b7" />


## Why MedTwin?

Most medication apps only send reminders. Real patients, especially older adults, take medicines from
several doctors, in different languages, with different timings. One missed dose or one unnoticed refill gap
can lead to a hospital visit. MedTwin goes beyond reminders: it **simulates** how a medication routine will
play out, warns the care circle early, and speaks to elderly users in their own language.

## Features

| Area | What it does |
|---|---|
| **Prescription scanner** | Upload a prescription (image or PDF). Gemini extracts the medicines, doses and timings; the user reviews and confirms before anything is saved. |
| **Medicines and schedules** | Daily schedule, mark doses taken or undo them, pause or resume medicines, full dose history. |
| **Refill tracking** | Pills remaining, days left and refill-needed flags; log a refill when stock is added. |
| **Digital twin** | Simulates a medication routine over a chosen period under scenarios: on-time baseline, missed doses, delayed refill, planned refill. |
| **Dadi-Nani mode** | Elderly-friendly assistant in **English, Hindi (हिन्दी) and Punjabi (ਪੰਜਾਬੀ)** for health, home-comfort and medicine questions. |
| **AI assistant** | Floating chat assistant backed by Gemini (`/api/ai/chat`). |
| **Care circle** | Patients invite caregivers and control exactly what each one can see. Caregivers can acknowledge alerts and get insights. |
| **Alerts** | Missed-dose and refill alerts to caregivers. WhatsApp can be launched manually in one tap, or sent automatically via the WhatsApp Business Cloud API; SMS goes through Twilio when configured. |
| **Doctor dashboard** | Authorized patients, prescription updates, caregiver escalation queue, upcoming follow-ups, AI visit summaries. |
| **Hospital dashboard** | Organization-bounded view of enrolled patients, clinicians and refill-attention queue. |
| **Accounts** | Role-based registration and login for patients, caregivers, doctors and hospital admins; password reset; profile settings. |

### Roles
`patient` · `caregiver` · `doctor` · `hospital_admin`

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, React Router, Recharts, Radix UI, Motion
- **Backend:** Node.js + Express (`server.ts`), written in TypeScript, run with `tsx`
- **AI:** Google Gemini via `@google/genai` (model `gemini-4-hydrogen`)
- **Storage:** Supabase (Postgres) for durable app state, with a local JSON file as fallback
- **Messaging:** Twilio SMS and WhatsApp Cloud API (optional)
- **Hosting:** Render (one service serves both the API and the built frontend)

## Architecture

```
Browser (React SPA)
      │  fetch /api/*  (same origin, session token)
      ▼
Express server  (server.ts)
  ├─ serves the built React app  (dist/)
  ├─ /api/auth, /api/workspace, /api/access, /api/caregiver, /api/hospital
  ├─ /api/ai/*        ──►  Google Gemini
  ├─ /api/alerts/*    ──►  Twilio / WhatsApp Cloud API
  └─ server/authStore.ts  ──►  Supabase table `medtwin_app_state`  (file fallback)
```

The frontend and API deploy together, so there is no CORS setup to manage.

## Getting started (local)

**Requirements:** Node.js 22+

```bash
git clone https://github.com/emanmann1313-beep/medtwin-ai-final.git
cd medtwin-ai-final
npm install
cp .env.example .env      # Windows: copy .env.example .env, then fill in values
npm run dev               # http://localhost:3000
```

Without any keys the app still runs: data is stored in a local file (`.medtwin-store.json`) and AI features
are disabled until `GEMINI_API_KEY` is set.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the API and the Vite dev server |
| `npm run build` | Build the frontend into `dist/` |
| `npm start` | Start the production server (serves `dist/` and `/api`) |
| `npm run lint` | Type-check with `tsc --noEmit` |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | For AI features | Prescription extraction, chat assistant, visit summaries |
| `SUPABASE_URL` | Recommended | Base URL only, e.g. `https://xxxx.supabase.co` (no `/rest/v1/`) |
| `SUPABASE_SERVICE_KEY` | Recommended | The **secret** key (`sb_secret_...`) or legacy `service_role` key. **Not** the publishable/anon key. |
| `PORT` | No | Defaults to `3000` (set automatically on Render) |
| `MEDTWIN_STORE_PATH` | No | Custom path for the local fallback file |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Optional | SMS alerts |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Optional | WhatsApp alerts |
| `VITE_USE_MOCKS` | No | Frontend caregiver adapter uses mock data unless set to `false` |

> **Never commit `.env`** and never expose `SUPABASE_SERVICE_KEY` to the browser.

Check the server at `/api/health`. It reports whether Gemini and Supabase are configured and which storage
is active (`"persistence":{"source":"supabase"}` is what you want in production).

## Deploying to Render

1. In Supabase, open **SQL Editor** and run `backend/database/migration_005_app_state_store.sql`
   (creates the `medtwin_app_state` table).
2. On Render choose **New → Blueprint**, select this repo (it reads `render.yaml`).
3. Set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` and `GEMINI_API_KEY`.
4. Deploy, then open `/api/health` and confirm `persistence.source` is `supabase`.

Manual settings if you skip the Blueprint: build `npm install --include=dev && npm run build`,
start `npm start`, `NODE_VERSION=22`, `NODE_ENV=production`.

> Without the Supabase table, accounts live in a local file that Render erases on restart.

## API overview

| Group | Endpoints |
|---|---|
| Health | `GET /api/health` |
| Auth | `POST /api/auth/register` · `login` · `logout` · `forgot-password` · `reset-password` · `verify-email` · `GET /api/auth/session` · `PATCH /api/auth/profile` |
| Workspace | `GET /api/workspace/state` · `POST /api/workspace/prescription` · `dose` · `dose/undo` · `medication/status` · `medication/refill` · `dadi-nani` · `clinician-note` |
| Access control | `POST /api/access/caregiver-request` · `caregiver-respond` · `caregiver-update` · `caregiver-permissions` · `caregiver-remove` · `doctor-authorization` |
| Caregiver | `POST /api/caregiver/alerts/acknowledge` · `insights` |
| Hospital | `POST /api/hospital/enroll-patient` |
| AI | `POST /api/ai/extract-prescription` · `chat` · `visit-summary` |
| Alerts | `GET /api/alerts/provider-status` · `POST /api/alerts/dispatch` |

## Project structure

```
medtwin-ai-final/
├── server.ts                 # Express app: API routes + static frontend
├── server/authStore.ts       # Accounts, sessions, workspace data, Supabase persistence
├── src/
│   ├── App.tsx               # Routes
│   ├── modules/              # auth, patient, prescriptions, medications, digital-twin,
│   │                         # caregivers, doctor, hospital, settings, landing
│   ├── components/           # ai, auth, landing, layout, shared, ui
│   ├── services/             # API clients (auth, caregiver adapter, messaging)
│   ├── context/              # Auth and app state
│   └── types/                # Shared TypeScript types
├── backend/                  # Optional companion FastAPI service (see below)
├── render.yaml               # One-click Render deployment
└── .env.example
```

### About the `backend/` folder
`backend/` contains a standalone **FastAPI + Supabase** service (medication schedules, dose logs, a rule-based
drug-clash checker, and Hindi/Punjabi/English audio summaries). The main app does **not** depend on it today;
it is a companion service that can be integrated later. The main app deploys and runs without it.

## Safety and privacy

- AI reads the prescription; **a person reviews and confirms** the extracted medicines before saving.
- Caregivers and doctors only see data the patient has authorized, and access can be revoked.
- MedTwin is a decision-support and reminder tool. It **does not diagnose** or change doses, and it is
  **not a medical device**. Always follow your doctor's and pharmacist's advice.
- Secrets live only in environment variables.

## Known limitations

- Free-tier hosting sleeps after inactivity (cold start of up to about a minute).
- Email delivery for verification and password reset needs an email provider to be configured.
- Automated alert delivery needs Twilio or WhatsApp Business credentials; without them the app offers a manual WhatsApp launch instead.
- No automated test suite for the Express app yet.

## Team

Built for a 24-hour hackathon by a team of five: AI integration and leadership, frontend, backend and
database, digital twin and prediction, and caregiver alerts and dashboard.

## License

Add a license of your choice (for example MIT) before open-sourcing.
