-- =====================================================================
-- MedTwin AI Pro - database schema (Supabase / PostgreSQL)
-- Run the WHOLE file once in: Supabase Dashboard -> SQL Editor -> New query
-- Safe to re-run: uses IF NOT EXISTS.
-- =====================================================================

create table if not exists patients (
    id          uuid primary key default gen_random_uuid(),
    full_name   text not null,
    age         int check (age between 0 and 130),
    email       text,
    phone       text,
    timezone    text not null default 'UTC',   -- IANA name, e.g. Asia/Kolkata
    created_at  timestamptz not null default now()
);

create table if not exists prescriptions (
    id           uuid primary key default gen_random_uuid(),
    patient_id   uuid not null references patients(id) on delete cascade,
    doctor_name  text,
    image_url    text,
    raw_text     text,
    created_at   timestamptz not null default now()
);

create table if not exists medications (
    id                     uuid primary key default gen_random_uuid(),
    patient_id             uuid not null references patients(id) on delete cascade,
    prescription_id        uuid references prescriptions(id) on delete cascade,
    name                   text not null,
    dosage                 text,
    form                   text,
    frequency_per_day      int not null default 1 check (frequency_per_day between 1 and 6),
    times                  text[] not null default '{}',   -- {'08:00','20:00'} local time
    pills_per_dose         int not null default 1 check (pills_per_dose > 0),
    duration_days          int check (duration_days > 0),
    start_date             date not null default current_date,
    end_date               date,
    instructions           text,
    pills_remaining        int check (pills_remaining >= 0),
    refill_threshold_days  int not null default 3 check (refill_threshold_days >= 0),
    active                 boolean not null default true,
    generic_name           text,                              -- active ingredient(s), used by the clash checker
    meal_timing            text check (meal_timing in ('before_food','after_food','with_food','empty_stomach')),
    avoid_with             text[] not null default '{}',      -- painkillers, alcohol, antacids, dairy, grapefruit, drowsy
    brand_price_inr        numeric(10,2) check (brand_price_inr >= 0),
    jan_aushadhi_price_inr numeric(10,2) check (jan_aushadhi_price_inr >= 0),
    created_at             timestamptz not null default now()
);

create table if not exists dose_logs (
    id              uuid primary key default gen_random_uuid(),
    medication_id   uuid not null references medications(id) on delete cascade,
    patient_id      uuid not null references patients(id) on delete cascade,
    scheduled_at    timestamptz not null,
    taken_at        timestamptz,
    status          text not null default 'pending'
                    check (status in ('pending', 'taken', 'missed', 'skipped')),
    created_at      timestamptz not null default now(),
    unique (medication_id, scheduled_at)
);

create table if not exists caregivers (
    id                  uuid primary key default gen_random_uuid(),
    patient_id          uuid not null references patients(id) on delete cascade,
    name                text not null,
    relationship        text,
    email               text,
    phone               text,
    telegram_chat_id    text,
    consent_given       boolean not null default false,
    consent_granted_at  timestamptz,
    consent_revoked_at  timestamptz,
    created_at          timestamptz not null default now()
);

create table if not exists alerts (
    id             uuid primary key default gen_random_uuid(),
    patient_id     uuid not null references patients(id) on delete cascade,
    caregiver_id   uuid not null references caregivers(id) on delete cascade,
    medication_id  uuid references medications(id) on delete set null,
    alert_type     text not null default 'custom'
                   check (alert_type in ('missed_dose', 'low_refill', 'custom')),
    message        text not null,
    status         text not null default 'pending'
                   check (status in ('pending', 'sent', 'failed')),
    sent_at        timestamptz,
    created_at     timestamptz not null default now()
);

-- Indexes for the queries the API runs most
create index if not exists idx_medications_patient  on medications (patient_id, active);
create index if not exists idx_dose_logs_patient_time on dose_logs (patient_id, scheduled_at);
create index if not exists idx_dose_logs_status     on dose_logs (patient_id, status, scheduled_at);
create index if not exists idx_caregivers_patient   on caregivers (patient_id);
create index if not exists idx_alerts_lookup        on alerts (patient_id, caregiver_id, status);

-- Security: only the backend (service-role key) may touch the data.
-- RLS is ON with no policies, so the public/anon key can read nothing directly.
alter table patients       enable row level security;
alter table prescriptions  enable row level security;
alter table medications    enable row level security;
alter table dose_logs      enable row level security;
alter table caregivers     enable row level security;
alter table alerts         enable row level security;
