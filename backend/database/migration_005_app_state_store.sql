-- =====================================================================
-- Durable storage for the Express app (accounts, sessions, workspace).
-- Run once in Supabase -> SQL Editor. Safe to re-run.
-- Without this table the app falls back to a local file, which is WIPED on
-- Vercel / Render restarts (registered accounts disappear).
-- =====================================================================
create table if not exists medtwin_app_state (
    key         text primary key,
    value       jsonb not null,
    updated_at  timestamptz not null default now()
);

-- Only the server (secret / service_role key) may read or write this table.
alter table medtwin_app_state enable row level security;
