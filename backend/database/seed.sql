-- =====================================================================
-- OPTIONAL demo data: 1 patient with a cardiologist's prescription (4 medicines), 14 days of
-- dose history (~80% taken) and a caregiver (consent NOT granted).
-- Run AFTER schema.sql. Safe to re-run.
--
-- PRICES BELOW ARE DEMO VALUES, NOT REAL. Replace them with real prices from the Jan Aushadhi
-- (PMBI) product list before showing them as facts.
--
-- CLASH DEMO: after seeding, upload a 2nd prescription from an orthopedic doctor containing a
-- painkiller such as Voveran (diclofenac) -> POST /prescriptions will return play_alarm = true
-- (diclofenac + Ecosprin/aspirin). See README "Live demo script".
-- =====================================================================

insert into patients (id, full_name, age, email, timezone) values
    ('11111111-1111-1111-1111-111111111111', 'Demo Patient', 67, 'demo@medtwin.ai', 'UTC')
on conflict (id) do nothing;

insert into prescriptions (id, patient_id, doctor_name, raw_text) values
    ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
     'Dr. Sharma (Cardiologist)', 'Demo prescription')
on conflict (id) do nothing;

insert into medications
    (id, patient_id, prescription_id, name, dosage, form, frequency_per_day, times, pills_per_dose,
     duration_days, start_date, end_date, instructions, pills_remaining, refill_threshold_days,
     generic_name, meal_timing, avoid_with, brand_price_inr, jan_aushadhi_price_inr)
values
    ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
     'cccccccc-0000-0000-0000-000000000001', 'Metformin', '500 mg', 'tablet', 2,
     array['08:00','20:00'], 1, 30, current_date - 14, current_date + 15, 'Take after meals', 32, 3,
     'metformin', 'after_food', '{}', null, null),
    ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
     'cccccccc-0000-0000-0000-000000000001', 'Amlodipine', '5 mg', 'tablet', 1,
     array['09:00'], 1, 30, current_date - 14, current_date + 15, 'Take in the morning', 5, 3,
     'amlodipine', null, '{}', null, null),
    ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
     'cccccccc-0000-0000-0000-000000000001', 'Atorvastatin', '10 mg', 'tablet', 1,
     array['21:00'], 1, 30, current_date - 14, current_date + 15, 'Take at bedtime', 16, 3,
     'atorvastatin', 'after_food', '{}', 450, 65),
    ('aaaaaaaa-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
     'cccccccc-0000-0000-0000-000000000001', 'Ecosprin 75', '75 mg', 'tablet', 1,
     array['09:00'], 1, 30, current_date - 14, current_date + 15, 'Take after breakfast', 20, 3,
     'aspirin', 'after_food', '{painkillers}', null, null)
on conflict (id) do nothing;

-- 14 days of history (yesterday and back)
insert into dose_logs (medication_id, patient_id, scheduled_at, taken_at, status)
select medication_id, patient_id, scheduled_at,
       case when r < 0.8 then scheduled_at + interval '10 minutes' end,
       case when r < 0.8 then 'taken' else 'missed' end
from (
    select m.id as medication_id,
           m.patient_id,
           (((current_date - n) + slot::time) at time zone 'UTC') as scheduled_at,
           random() as r
    from medications m
    cross join generate_series(1, 14) as n
    cross join lateral unnest(m.times) as slot
    where m.patient_id = '11111111-1111-1111-1111-111111111111'
) history
on conflict (medication_id, scheduled_at) do nothing;

-- Today and the next 2 days as upcoming pending doses
insert into dose_logs (medication_id, patient_id, scheduled_at, status)
select m.id, m.patient_id,
       (((current_date + n) + slot::time) at time zone 'UTC'),
       'pending'
from medications m
cross join generate_series(0, 2) as n
cross join lateral unnest(m.times) as slot
where m.patient_id = '11111111-1111-1111-1111-111111111111'
on conflict (medication_id, scheduled_at) do nothing;

-- One caregiver (consent NOT granted yet - the patient must grant it)
insert into caregivers (id, patient_id, name, relationship, consent_given) values
    ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
     'Demo Caregiver', 'Daughter', false)
on conflict (id) do nothing;
