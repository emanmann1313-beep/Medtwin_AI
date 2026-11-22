-- Migration 004: Caregiver Contacts, Country-Coded Phone/WhatsApp, 5 Alert Rules & Audit Alert History
-- Safe additive migration preserving existing care_circle_links and caregiver_alerts rows.

ALTER TABLE public.care_circle_links
  ADD COLUMN IF NOT EXISTS caregiver_name TEXT,
  ADD COLUMN IF NOT EXISTS caregiver_email TEXT,
  ADD COLUMN IF NOT EXISTS phone_country_code TEXT DEFAULT '+1',
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_same_as_phone BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'hi', 'pa')),
  ADD COLUMN IF NOT EXISTS alert_repeated_missed_doses BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS alert_supply_running_low BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS alert_upcoming_refill_date BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS alert_caregiver_invitation BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS alert_patient_assistance BOOLEAN DEFAULT TRUE;

ALTER TABLE public.caregiver_alerts
  ADD COLUMN IF NOT EXISTS caregiver_name TEXT,
  ADD COLUMN IF NOT EXISTS alert_type TEXT DEFAULT 'repeated_missed_doses',
  ADD COLUMN IF NOT EXISTS channel_kind TEXT DEFAULT 'in_app' CHECK (channel_kind IN ('whatsapp', 'sms', 'in_app')),
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT,
  ADD COLUMN IF NOT EXISTS message_body TEXT,
  ADD COLUMN IF NOT EXISTS provider_confirmed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_error TEXT;

-- Extend delivery_status check constraint if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'caregiver_alerts_delivery_status_check'
  ) THEN
    ALTER TABLE public.caregiver_alerts DROP CONSTRAINT caregiver_alerts_delivery_status_check;
  END IF;
  ALTER TABLE public.caregiver_alerts
    ADD CONSTRAINT caregiver_alerts_delivery_status_check
    CHECK (delivery_status IN ('draft', 'opened_messaging_app', 'created', 'queued', 'sent', 'delivered', 'failed', 'acknowledged'));
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
