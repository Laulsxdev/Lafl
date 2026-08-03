-- Lafl TMS · Migration 005 · RLS, role helpers, updated_at triggers
-- Applied to project hmmkebxbmnftxxkkkrqc via Supabase MCP on 2026-08-01.

-- role of the calling user (security definer so it can read profiles under RLS)
create or replace function public.current_app_role() returns user_role
language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() $$;

create or replace function public.current_driver_id() returns uuid
language sql stable security definer set search_path = public as
$$ select driver_id from profiles where id = auth.uid() $$;

create or replace function public.is_staff() returns boolean
language sql stable as
$$ select current_app_role() in ('admin','supervisor','accountant') $$;

-- updated_at maintenance
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger trg_vehicles_touch before update on vehicles for each row execute function touch_updated_at();
create trigger trg_drivers_touch before update on drivers for each row execute function touch_updated_at();
create trigger trg_trips_touch before update on trips for each row execute function touch_updated_at();

-- enable RLS everywhere + staff full access
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','customers','routes','vehicles','drivers','master_trip_rates','geofences',
    'eway_bills','trips','trip_eway_bills','trip_drivers',
    'trip_charges','trip_expenses','advances','driver_settlements','customer_invoices',
    'pods','gps_logs','geofence_events','notifications','activity_logs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy staff_all on %I for all to authenticated using (is_staff()) with check (is_staff())', t);
  end loop;
end $$;

-- users can always read their own profile (needed before role resolves)
create policy own_profile_read on profiles for select to authenticated using (id = auth.uid());

-- ── Driver-scoped policies ─────────────────────────────
create policy driver_read_own_assignments on trip_drivers for select to authenticated
  using (driver_id = current_driver_id());

create policy driver_read_own_trips on trips for select to authenticated
  using (exists (select 1 from trip_drivers td where td.trip_id = trips.id and td.driver_id = current_driver_id()));

create policy driver_read_trip_ewbs on trip_eway_bills for select to authenticated
  using (exists (select 1 from trip_drivers td where td.trip_id = trip_eway_bills.trip_id and td.driver_id = current_driver_id()));

create policy driver_read_own_advances on advances for select to authenticated
  using (driver_id = current_driver_id());

create policy driver_read_own_settlements on driver_settlements for select to authenticated
  using (driver_id = current_driver_id());

create policy driver_insert_pods on pods for insert to authenticated
  with check (exists (select 1 from trip_drivers td where td.trip_id = pods.trip_id
              and td.driver_id = current_driver_id() and td.released_at is null));

create policy driver_insert_expenses on trip_expenses for insert to authenticated
  with check (exists (select 1 from trip_drivers td where td.trip_id = trip_expenses.trip_id
              and td.driver_id = current_driver_id() and td.released_at is null));

create policy driver_read_own_expenses on trip_expenses for select to authenticated
  using (added_by = auth.uid());

-- auto-create profile on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, 'supervisor')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
