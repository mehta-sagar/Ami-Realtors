-- ===== Version 4 (Nov 2026): richer "Mari Milkat" listings =====
-- Paste into Supabase › SQL Editor › Run. Safe to run twice.
alter table properties add column if not exists title text;
alter table properties add column if not exists address text;
alter table properties add column if not exists lat double precision;
alter table properties add column if not exists lng double precision;
alter table properties add column if not exists rent numeric;          -- current monthly rent (pre-leased)
alter table properties add column if not exists status text default 'available'; -- available / sold / on-hold
alter table properties add column if not exists source text;           -- e.g. 'WhatsApp: VVIP BUYERS'
alter table properties add column if not exists source_key text;       -- stops the same post being saved twice
alter table properties add column if not exists posted_on date;
create unique index if not exists properties_source_key on properties(team_id, source_key) where source_key is not null;
alter table brokers add column if not exists area_text text;
