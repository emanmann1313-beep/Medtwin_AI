-- =====================================================================
-- MedTwin AI Pro - Safe Additive Migration 003:
-- Multi-Role Profiles, Verification Status, Authorizations & RLS
-- Safe to run on existing Supabase / PostgreSQL database (no table drops)
-- =====================================================================

create table if not exists user_profiles (
    id                  uuid primary key references auth.users(id) on delete cascade,
    email               text unique not null,
    full_name           text not null,
    role                text not null check (role in ('patient', 'caregiver', 'doctor', 'hospital_admin')),
    verification_status text not null default 'unverified'
                        check (verification_status in ('unverified', 'pending_verification', 'verified', 'rejected')),
    date_of_birth       date,
    phone               text,
    preferred_language  text not null default 'en',
    country             text,
    relationship_label  text,
    license_number      text,
    specialty           text,
    affiliation         text,
    jurisdiction        text,
    hospital_name       text,
    hospital_address    text,
    admin_contact_name  text,
    registration_detail text,
    consent_accepted_at timestamptz,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create table if not exists hospital_organizations (
    id                  uuid primary key default gen_random_uuid(),
    admin_user_id       uuid not null references user_profiles(id) on delete cascade,
    name                text not null,
    official_email      text not null,
    registration_detail text,
    contact_phone       text,
    address             text,
    verification_status text not null default 'pending_verification'
                        check (verification_status in ('pending_verification', 'verified', 'rejected')),
    created_at          timestamptz not null default now()
);

create table if not exists patient_doctor_authorizations (
    id                  uuid primary key default gen_random_uuid(),
    patient_user_id     uuid not null references user_profiles(id) on delete cascade,
    doctor_user_id      uuid not null references user_profiles(id) on delete cascade,
    status              text not null default 'pending'
                        check (status in ('pending', 'authorized', 'revoked')),
    authorized_at       timestamptz,
    revoked_at          timestamptz,
    created_at          timestamptz not null default now(),
    unique (patient_user_id, doctor_user_id)
);

alter table patients
    add column if not exists owner_user_id uuid references user_profiles(id) on delete set null;

alter table caregivers
    add column if not exists caregiver_user_id uuid references user_profiles(id) on delete set null;

create index if not exists idx_user_profiles_role on user_profiles (role, verification_status);
create index if not exists idx_pda_doctor on patient_doctor_authorizations (doctor_user_id, status);
create index if not exists idx_pda_patient on patient_doctor_authorizations (patient_user_id, status);

alter table user_profiles enable row level security;
alter table hospital_organizations enable row level security;
alter table patient_doctor_authorizations enable row level security;

-- Users can read/update only their own profile (without self-escalating role or verification_status)
do $$
begin
    if not exists (
        select 1 from pg_policies where tablename = 'user_profiles' and policyname = 'user_profiles_select_own'
    ) then
        create policy user_profiles_select_own on user_profiles
            for select using (auth.uid() = id);
    end if;

    if not exists (
        select 1 from pg_policies where tablename = 'user_profiles' and policyname = 'user_profiles_update_own'
    ) then
        create policy user_profiles_update_own on user_profiles
            for update using (auth.uid() = id)
            with check (auth.uid() = id);
    end if;

    if not exists (
        select 1 from pg_policies where tablename = 'patients' and policyname = 'patients_owner_or_authorized'
    ) then
        create policy patients_owner_or_authorized on patients
            for select using (
                owner_user_id = auth.uid()
                or exists (
                    select 1 from patient_doctor_authorizations pda
                    join user_profiles doc on doc.id = pda.doctor_user_id
                    where pda.patient_user_id = patients.owner_user_id
                      and pda.doctor_user_id = auth.uid()
                      and pda.status = 'authorized'
                      and doc.verification_status = 'verified'
                )
                or exists (
                    select 1 from caregivers cg
                    where cg.patient_id = patients.id
                      and cg.caregiver_user_id = auth.uid()
                      and cg.consent_given = true
                )
            );
    end if;

    if not exists (
        select 1 from pg_policies where tablename = 'medications' and policyname = 'medications_owner_or_authorized'
    ) then
        create policy medications_owner_or_authorized on medications
            for select using (
                exists (
                    select 1 from patients p
                    where p.id = medications.patient_id
                      and (
                          p.owner_user_id = auth.uid()
                          or exists (
                              select 1 from patient_doctor_authorizations pda
                              join user_profiles doc on doc.id = pda.doctor_user_id
                              where pda.patient_user_id = p.owner_user_id
                                and pda.doctor_user_id = auth.uid()
                                and pda.status = 'authorized'
                                and doc.verification_status = 'verified'
                          )
                          or exists (
                              select 1 from caregivers cg
                              where cg.patient_id = p.id
                                and cg.caregiver_user_id = auth.uid()
                                and cg.consent_given = true
                          )
                      )
                )
            );
    end if;
end $$;
