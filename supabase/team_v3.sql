-- ===== Version 3 (Nov 2026): one team for Ami Realtors, a login per person, live sync =====
-- Paste this whole file into Supabase › SQL Editor › New query › Run. It is safe to run twice.
--  • Owners (Sagar, Dad) see and edit everything the team has.
--  • Staff see all properties, prices, brokers and area notes, but only the customers, inquiries,
--    deals, activities and tasks that are theirs (made by them or assigned to them). Staff cannot delete.
--  • Every change is pushed live to the other phones (Supabase Realtime).

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz default now()
);
create table if not exists team_members (
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null default 'staff' check (role in ('owner','staff')),
  name text, email text, phone text,
  created_at timestamptz default now(),
  primary key (team_id, user_id)
);
create table if not exists team_invites (
  code text primary key,
  team_id uuid references teams(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner','staff')),
  created_by uuid references auth.users default auth.uid(),
  used_by uuid references auth.users,
  expires_at timestamptz default now() + interval '14 days',
  created_at timestamptz default now()
);
alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_invites enable row level security;

-- helpers (security definer so policies can call them without recursion)
create or replace function my_team() returns uuid language sql stable security definer set search_path = public as
$$ select team_id from team_members where user_id = auth.uid() order by created_at limit 1 $$;
create or replace function is_owner() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from team_members where user_id = auth.uid() and role = 'owner') $$;
create or replace function same_team(u uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from team_members a join team_members b on a.team_id = b.team_id where a.user_id = auth.uid() and b.user_id = u) $$;

drop policy if exists "team read" on teams; create policy "team read" on teams for select to authenticated using (id = my_team());
drop policy if exists "members read" on team_members; create policy "members read" on team_members for select to authenticated using (team_id = my_team());
drop policy if exists "members owner edit" on team_members; create policy "members owner edit" on team_members for update to authenticated using (team_id = my_team() and is_owner()) with check (team_id = my_team());
drop policy if exists "members owner delete" on team_members; create policy "members owner delete" on team_members for delete to authenticated using (team_id = my_team() and is_owner() and user_id <> auth.uid());
drop policy if exists "invites owner" on team_invites; create policy "invites owner" on team_invites for all to authenticated using (team_id = my_team() and is_owner()) with check (team_id = my_team() and is_owner());

-- Who am I? {team_id, team_name, role, name}
create or replace function team_me() returns json language sql stable security definer set search_path = public as $$
  select json_build_object('team_id', m.team_id, 'team_name', t.name, 'role', m.role, 'name', m.name)
  from team_members m join teams t on t.id = m.team_id where m.user_id = auth.uid() order by m.created_at limit 1
$$;
-- First person: create the team and become owner. Their existing rows move into the team.
create or replace function create_team(p_name text, p_person text) returns json language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if my_team() is not null then return team_me(); end if;
  -- Only one team (Ami Realtors). Once it exists, everyone else needs an invite code from an owner.
  if exists (select 1 from teams) then raise exception 'The Ami Realtors team already exists. Ask an owner for an invite code.'; end if;
  insert into teams(name, created_by) values (coalesce(nullif(p_name,''),'Ami Realtors'), auth.uid()) returning id into tid;
  insert into team_members(team_id, user_id, role, name, email) values (tid, auth.uid(), 'owner', p_person, (select email from auth.users where id = auth.uid()));
  perform adopt_my_rows(tid);
  return team_me();
end $$;
-- Everyone else: join with the 6-letter code an owner made in the app.
create or replace function join_team(p_code text, p_person text) returns json language plpgsql security definer set search_path = public as $$
declare inv team_invites;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into inv from team_invites where upper(code) = upper(trim(p_code)) and used_by is null and expires_at > now();
  if inv.code is null then raise exception 'Invalid or expired code'; end if;
  insert into team_members(team_id, user_id, role, name, email) values (inv.team_id, auth.uid(), inv.role, p_person, (select email from auth.users where id = auth.uid()))
    on conflict (team_id, user_id) do update set role = excluded.role, name = coalesce(excluded.name, team_members.name);
  update team_invites set used_by = auth.uid() where code = inv.code;
  perform adopt_my_rows(inv.team_id);
  return team_me();
end $$;
create or replace function make_invite(p_role text default 'staff') returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not is_owner() then raise exception 'Only an owner can invite'; end if;
  c := upper(substr(translate(md5(random()::text || clock_timestamp()::text), '01', 'XY'), 1, 6));
  insert into team_invites(code, team_id, role) values (c, my_team(), coalesce(p_role,'staff'));
  return c;
end $$;

-- Team columns on every private table
do $$
declare tb text;
begin
  foreach tb in array array['customers','inquiries','deals','activities','tasks','properties','price_points','brokers','area_notes','reports'] loop
    execute format('alter table %I add column if not exists team_id uuid references teams(id) on delete cascade', tb);
    execute format('alter table %I add column if not exists assigned_to uuid references auth.users', tb);
    execute format('alter table %I add column if not exists updated_by uuid references auth.users', tb);
    execute format('alter table %I add column if not exists deleted_at timestamptz', tb);
    execute format('create index if not exists %I on %I(team_id)', tb || '_team_idx', tb);
  end loop;
end $$;

create or replace function adopt_my_rows(tid uuid) returns void language plpgsql security definer set search_path = public as $$
declare tb text;
begin
  foreach tb in array array['customers','inquiries','deals','activities','tasks','properties','price_points','brokers','area_notes','reports'] loop
    execute format('update %I set team_id = $1 where owner = auth.uid() and team_id is null', tb) using tid;
  end loop;
end $$;

-- New rows: stamp owner, team and editor automatically.
create or replace function stamp_team() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.owner := coalesce(new.owner, auth.uid());
    new.team_id := coalesce(new.team_id, my_team());
  else
    new.owner := old.owner; new.team_id := coalesce(old.team_id, new.team_id); -- joins a team once, never moves
  end if;
  new.updated_by := auth.uid();
  return new;
end $$;
do $$
declare tb text;
begin
  foreach tb in array array['customers','inquiries','deals','activities','tasks','properties','price_points','brokers','area_notes','reports'] loop
    execute format('drop trigger if exists stamp_team on %I', tb);
    execute format('create trigger stamp_team before insert or update on %I for each row execute function stamp_team()', tb);
  end loop;
end $$;

-- Policies. Shared tables: whole team. Personal tables: owners all; staff only their own / assigned.
do $$
declare tb text; vis text;
begin
  foreach tb in array array['properties','brokers','area_notes','reports'] loop
    execute format('drop policy if exists "own %s" on %I', replace(tb,'_',' '), tb);
    execute format('drop policy if exists "own area notes" on %I', tb);
    execute format('drop policy if exists "team read" on %I', tb);
    execute format('drop policy if exists "team write" on %I', tb);
    execute format('drop policy if exists "team update" on %I', tb);
    execute format('drop policy if exists "team delete" on %I', tb);
    execute format('create policy "team read" on %I for select to authenticated using ((team_id is not null and team_id = my_team()) or owner = auth.uid())', tb);
    execute format('create policy "team write" on %I for insert to authenticated with check (owner = auth.uid())', tb);
    execute format('create policy "team update" on %I for update to authenticated using ((team_id is not null and team_id = my_team()) or owner = auth.uid())', tb);
    execute format('create policy "team delete" on %I for delete to authenticated using (((team_id is not null and team_id = my_team()) and is_owner()) or (owner = auth.uid() and my_team() is null))', tb);
  end loop;
  foreach tb in array array['customers','inquiries','deals','activities','tasks'] loop
    execute format('drop policy if exists "own %s" on %I', tb, tb);
    execute format('drop policy if exists "team read" on %I', tb);
    execute format('drop policy if exists "team write" on %I', tb);
    execute format('drop policy if exists "team update" on %I', tb);
    execute format('drop policy if exists "team delete" on %I', tb);
    -- rows of a customer assigned to me are mine too (their inquiries, notes, tasks)
    vis := 'owner = auth.uid() or assigned_to = auth.uid() or (team_id is not null and team_id = my_team() and is_owner())'
      || case when tb in ('inquiries','activities','tasks') then ' or exists (select 1 from customers c where c.id = customer_id and c.assigned_to = auth.uid())' else '' end;
    execute format('create policy "team read" on %I for select to authenticated using (%s)', tb, vis);
    execute format('create policy "team write" on %I for insert to authenticated with check (owner = auth.uid())', tb);
    execute format('create policy "team update" on %I for update to authenticated using (%s)', tb, vis);
    execute format('create policy "team delete" on %I for delete to authenticated using ((team_id is not null and team_id = my_team() and is_owner()) or (owner = auth.uid() and my_team() is null))', tb);
  end loop;
end $$;
-- price_points: public rows (owner null) readable by all; team rows by the team
drop policy if exists "read prices" on price_points;
drop policy if exists "write own prices" on price_points;
drop policy if exists "team read" on price_points; create policy "team read" on price_points for select using (owner is null or owner = auth.uid() or (team_id is not null and team_id = my_team()));
drop policy if exists "team write" on price_points; create policy "team write" on price_points for insert to authenticated with check (owner = auth.uid());
drop policy if exists "team update" on price_points; create policy "team update" on price_points for update to authenticated using (owner = auth.uid() or (team_id is not null and team_id = my_team()));
drop policy if exists "team delete" on price_points; create policy "team delete" on price_points for delete to authenticated using (owner = auth.uid() or (team_id is not null and team_id = my_team() and is_owner()));

-- Photos and documents: anyone in the team can open files uploaded by a teammate.
drop policy if exists "own files" on storage.objects;
drop policy if exists "team files read" on storage.objects;
drop policy if exists "own files write" on storage.objects;
create policy "team files read" on storage.objects for select to authenticated
  using (bucket_id = 'property-files' and ((storage.foldername(name))[1] = auth.uid()::text or same_team(((storage.foldername(name))[1])::uuid)));
create policy "own files write" on storage.objects for all to authenticated
  using (bucket_id = 'property-files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'property-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- Live updates to every phone
do $$
declare tb text;
begin
  foreach tb in array array['customers','inquiries','deals','activities','tasks','properties','price_points','brokers','area_notes'] loop
    begin execute format('alter publication supabase_realtime add table %I', tb); exception when duplicate_object then null; end;
    execute format('alter table %I replica identity full', tb);
  end loop;
end $$;

grant execute on function team_me(), create_team(text, text), join_team(text, text), make_invite(text), my_team(), is_owner() to authenticated;
