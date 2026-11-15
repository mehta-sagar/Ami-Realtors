-- ===== Automatic daily backup (Nov 2026) =====
-- Every night at 2:00 AM (India time) a full copy of all team data is saved inside the database
-- (schema "backup"), and the last 60 copies are kept. Nothing is ever overwritten: a wrong edit or a
-- delete can be brought back from any of the last 60 days. Safe to run twice.
create extension if not exists pg_cron;
create schema if not exists backup;
create table if not exists backup.snapshots (
  id bigserial primary key,
  taken_at timestamptz not null default now(),
  tbl text not null,
  row_count int not null,
  data jsonb not null
);
create index if not exists snapshots_taken on backup.snapshots(taken_at desc);
alter table backup.snapshots enable row level security;
revoke all on schema backup from anon, authenticated;
revoke all on all tables in schema backup from anon, authenticated;

create or replace function backup.take() returns int language plpgsql security definer set search_path = public as $$
declare tb text; n int; total int := 0;
begin
  foreach tb in array array['customers','inquiries','deals','activities','tasks','properties','price_points','brokers','area_notes','reports','teams','team_members'] loop
    if to_regclass('public.' || tb) is null then continue; end if;
    execute format('insert into backup.snapshots(tbl, row_count, data) select %L, count(*), coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.%I t returning row_count', tb, tb) into n;
    total := total + n;
  end loop;
  delete from backup.snapshots where taken_at < now() - interval '60 days';
  return total;
end $$;

-- Owners can see when the last backup ran (shown in the app under More › Backup).
create or replace function public.backup_status() returns json language sql stable security definer set search_path = public as $$
  select case when is_owner() then json_build_object(
    'last', (select max(taken_at) from backup.snapshots),
    'days', (select count(distinct date_trunc('day', taken_at)) from backup.snapshots),
    'rows', (select sum(row_count) from backup.snapshots where taken_at >= (select max(taken_at) - interval '5 minutes' from backup.snapshots)))
  else null end
$$;
grant execute on function public.backup_status() to authenticated;

-- Owners can also take one now from the app ("Back up now").
create or replace function public.backup_now() returns int language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'Only an owner can back up'; end if;
  if exists (select 1 from backup.snapshots where taken_at > now() - interval '10 minutes') then return 0; end if;
  return backup.take();
end $$;
grant execute on function public.backup_now() to authenticated;

-- Nightly at 20:30 UTC = 2:00 AM IST
select cron.unschedule(jobid) from cron.job where jobname = 'ami-nightly-backup';
select cron.schedule('ami-nightly-backup', '30 20 * * *', $$select backup.take()$$);

-- First backup right now
select backup.take();

-- To restore one deleted row later, e.g. a property:
--   select x from backup.snapshots s, jsonb_array_elements(s.data) x where s.tbl = 'properties' and x->>'title' ilike '%honey park%' order by s.taken_at desc limit 1;
