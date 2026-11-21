-- =====================================================================
-- ONLY for projects that already ran the FIRST version of schema.sql.
-- (If you are starting fresh, schema.sql already includes these columns - skip this file.)
-- Adds the columns used by the audio summary and the clash checker. Safe to re-run.
-- =====================================================================
alter table medications add column if not exists generic_name text;
alter table medications add column if not exists meal_timing text
    check (meal_timing in ('before_food','after_food','with_food','empty_stomach'));
alter table medications add column if not exists avoid_with text[] not null default '{}';
alter table medications add column if not exists brand_price_inr numeric(10,2) check (brand_price_inr >= 0);
alter table medications add column if not exists jan_aushadhi_price_inr numeric(10,2) check (jan_aushadhi_price_inr >= 0);
