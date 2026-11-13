-- Ami Realtors database. Paste this whole file into Supabase > SQL Editor > Run. Safe to run again.
create extension if not exists postgis;

-- Areas (public). Coordinates are approximate centre points.
create table if not exists areas (
  id text primary key, name_en text not null, name_gu text not null, district text,
  lat double precision not null, lng double precision not null,
  geom geography(Point, 4326) generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored
);
create index if not exists areas_geom on areas using gist (geom);

-- All areas within N km of a point, nearest first (used for the 200 km search).
create or replace function areas_within(p_lat double precision, p_lng double precision, p_km double precision default 200)
returns table (id text, name_en text, name_gu text, district text, lat double precision, lng double precision, km double precision)
language sql stable as $$
  select a.id, a.name_en, a.name_gu, a.district, a.lat, a.lng,
         st_distance(a.geom, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000
  from areas a
  where st_dwithin(a.geom, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_km * 1000)
  order by 7;
$$;

-- One row per price seen. price_sqft is always rupees per square foot.
-- owner is null for rows written by the daily agent (public); Dad's own rows carry his user id (private).
create table if not exists price_points (
  id uuid primary key default gen_random_uuid(),
  owner uuid references auth.users default auth.uid(),
  area_id text not null references areas(id),
  ptype text not null check (ptype in ('flat','bungalow','shop','office','plot','land','industrial')),
  kind text not null check (kind in ('market','dastavej','jantri')),
  price_sqft numeric not null check (price_sqft > 0),
  furnished boolean,
  source text default 'own', source_url text, note text,
  observed_on date not null default current_date,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists price_points_lookup on price_points (area_id, ptype, kind, observed_on desc);

create table if not exists news (
  id uuid primary key default gen_random_uuid(),
  published_on date not null default current_date,
  category text not null check (category in ('realestate','infra','rules','market')),
  title_gu text, title_en text, summary_gu text, summary_en text,
  source text, url text unique, created_at timestamptz default now()
);

create table if not exists market (
  day date primary key default current_date,
  gold_10g numeric, silver_kg numeric, sensex numeric, nifty numeric, home_loan_rate numeric, source text
);

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users default auth.uid(),
  ptype text, deal text, area_id text references areas(id),
  price numeric, size numeric, size_unit text, bhk numeric, floor text, facing text, furnished boolean,
  owner_name text, owner_phone text, notes text,
  photos jsonb default '[]', docs jsonb default '[]',
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists inquiries (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users default auth.uid(),
  name text, phone text, area_id text references areas(id), ptype text, deal text,
  budget numeric, notes text, status text default 'new', followup_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users default auth.uid(),
  title text, client text, deal_date date, deal_value numeric, brokerage_due numeric, brokerage_received numeric,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

-- Row level security: public reference data is read-only; private data is visible only to its owner.
alter table areas enable row level security;
alter table news enable row level security;
alter table market enable row level security;
alter table price_points enable row level security;
alter table properties enable row level security;
alter table inquiries enable row level security;
alter table deals enable row level security;

drop policy if exists "read areas" on areas;        create policy "read areas" on areas for select using (true);
drop policy if exists "read news" on news;          create policy "read news" on news for select using (true);
drop policy if exists "read market" on market;      create policy "read market" on market for select using (true);

drop policy if exists "read prices" on price_points;
create policy "read prices" on price_points for select using (owner is null or owner = auth.uid());
drop policy if exists "write own prices" on price_points;
create policy "write own prices" on price_points for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "own properties" on properties;
create policy "own properties" on properties for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "own inquiries" on inquiries;
create policy "own inquiries" on inquiries for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "own deals" on deals;
create policy "own deals" on deals for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

-- Private bucket for property photos and documents; each user can only touch their own folder.
insert into storage.buckets (id, name, public) values ('property-files', 'property-files', false) on conflict (id) do nothing;
drop policy if exists "own files" on storage.objects;
create policy "own files" on storage.objects for all to authenticated
  using (bucket_id = 'property-files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'property-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- Area list
insert into areas (id, name_en, name_gu, district, lat, lng) values
  ('piplod', 'Piplod', 'પીપલોદ', 'Surat', 21.158, 72.77),
  ('vesu', 'Vesu', 'વેસુ', 'Surat', 21.141, 72.771),
  ('adajan', 'Adajan', 'અડાજણ', 'Surat', 21.196, 72.793),
  ('pal', 'Pal', 'પાલ', 'Surat', 21.196, 72.776),
  ('katargam', 'Katargam', 'કતારગામ', 'Surat', 21.229, 72.831),
  ('varachha', 'Varachha', 'વરાછા', 'Surat', 21.21, 72.857),
  ('mota-varachha', 'Mota Varachha', 'મોટા વરાછા', 'Surat', 21.238, 72.884),
  ('sarthana', 'Sarthana', 'સરથાણા', 'Surat', 21.23, 72.905),
  ('city-light', 'City Light', 'સિટી લાઇટ', 'Surat', 21.17, 72.79),
  ('athwalines', 'Athwalines', 'અઠવાલાઇન્સ', 'Surat', 21.177, 72.803),
  ('ghod-dod-road', 'Ghod Dod Road', 'ઘોડ દોડ રોડ', 'Surat', 21.176, 72.808),
  ('althan', 'Althan', 'અલથાણ', 'Surat', 21.149, 72.797),
  ('bhatar', 'Bhatar', 'ભટાર', 'Surat', 21.165, 72.812),
  ('udhna', 'Udhna', 'ઉધના', 'Surat', 21.17, 72.842),
  ('pandesara', 'Pandesara', 'પાંડેસરા', 'Surat', 21.146, 72.838),
  ('dindoli', 'Dindoli', 'ડીંડોલી', 'Surat', 21.143, 72.874),
  ('sachin', 'Sachin', 'સચિન', 'Surat', 21.086, 72.881),
  ('hojiwala', 'Hojiwala (Sachin)', 'હોજીવાલા (સચિન)', 'Surat', 21.073, 72.905),
  ('vip-road-vesu', 'VIP Road (Vesu)', 'વીઆઈપી રોડ (વેસુ)', 'Surat', 21.148, 72.786),
  ('maroli', 'Maroli', 'મરોલી', 'Navsari', 21.025, 72.895),
  ('zadeshwar', 'Zadeshwar (Bharuch)', 'ઝાડેશ્વર (ભરૂચ)', 'Bharuch', 21.722, 73.02),
  ('rander', 'Rander', 'રાંદેર', 'Surat', 21.218, 72.795),
  ('jahangirpura', 'Jahangirpura', 'જહાંગીરપુરા', 'Surat', 21.228, 72.783),
  ('chowk-bazaar', 'Chowk Bazaar', 'ચોક બજાર', 'Surat', 21.196, 72.819),
  ('magdalla', 'Magdalla', 'મગદલ્લા', 'Surat', 21.14, 72.745),
  ('dumas', 'Dumas', 'ડુમસ', 'Surat', 21.085, 72.715),
  ('khajod', 'Khajod (DREAM City)', 'ખજોદ (ડ્રીમ સિટી)', 'Surat', 21.118, 72.79),
  ('hazira', 'Hazira', 'હજીરા', 'Surat', 21.113, 72.648),
  ('olpad', 'Olpad', 'ઓલપાડ', 'Surat', 21.337, 72.752),
  ('kamrej', 'Kamrej', 'કામરેજ', 'Surat', 21.268, 72.958),
  ('kim', 'Kim', 'કીમ', 'Surat', 21.401, 72.928),
  ('kosamba', 'Kosamba', 'કોસંબા', 'Surat', 21.462, 72.958),
  ('palsana', 'Palsana', 'પલસાણા', 'Surat', 21.085, 72.985),
  ('bardoli', 'Bardoli', 'બારડોલી', 'Surat', 21.122, 73.112),
  ('mandvi-surat', 'Mandvi', 'માંડવી', 'Surat', 21.255, 73.305),
  ('ubhrat', 'Ubhrat', 'ઉભરાટ', 'Navsari', 21.01, 72.74),
  ('navsari', 'Navsari', 'નવસારી', 'Navsari', 20.947, 72.952),
  ('gandevi', 'Gandevi', 'ગણદેવી', 'Navsari', 20.812, 72.997),
  ('bilimora', 'Bilimora', 'બીલીમોરા', 'Navsari', 20.769, 72.962),
  ('chikhli', 'Chikhli', 'ચીખલી', 'Navsari', 20.757, 73.064),
  ('valsad', 'Valsad', 'વલસાડ', 'Valsad', 20.599, 72.934),
  ('vapi', 'Vapi', 'વાપી', 'Valsad', 20.372, 72.905),
  ('vyara', 'Vyara', 'વ્યારા', 'Tapi', 21.11, 73.394),
  ('ankleshwar', 'Ankleshwar', 'અંકલેશ્વર', 'Bharuch', 21.626, 73.015),
  ('bharuch', 'Bharuch', 'ભરૂચ', 'Bharuch', 21.705, 72.996)
on conflict (id) do update set name_en = excluded.name_en, name_gu = excluded.name_gu, district = excluded.district, lat = excluded.lat, lng = excluded.lng;

-- ===== Version 2: CRM, brokers, price grades, area notes =====
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users default auth.uid(),
  name text, phone text, alt_phone text, notes text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists brokers (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users default auth.uid(),
  name text not null, phone text, firm text, notes text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users default auth.uid(),
  customer_id uuid references customers(id) on delete cascade,
  type text, text text, at timestamptz default now(),
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users default auth.uid(),
  customer_id uuid references customers(id) on delete cascade,
  title text, due_at timestamptz, done boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists area_notes (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users default auth.uid(),
  area_id text references areas(id), kind text check (kind in ('pro','con')), text text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table inquiries add column if not exists customer_id uuid references customers(id) on delete set null;
alter table price_points add column if not exists grade text check (grade in ('premium','standard','basic'));
alter table properties add column if not exists brokers jsonb default '[]';
alter table deals add column if not exists brokers jsonb default '[]';

alter table customers enable row level security;
alter table brokers enable row level security;
alter table activities enable row level security;
alter table tasks enable row level security;
alter table area_notes enable row level security;
drop policy if exists "own customers" on customers;
create policy "own customers" on customers for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "own brokers" on brokers;
create policy "own brokers" on brokers for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "own activities" on activities;
create policy "own activities" on activities for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "own tasks" on tasks;
create policy "own tasks" on tasks for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "own area notes" on area_notes;
create policy "own area notes" on area_notes for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
