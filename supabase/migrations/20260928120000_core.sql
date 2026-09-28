-- Hive core layer: stores, departments, profiles.
-- Every section of the app reads "who are the stores and who manages them"
-- from here. Comms (posts, reads, threads, assets) builds on top in its own
-- migration.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('regional_manager', 'store_manager');

-- Declared order is the sort order: urgent first.
create type public.priority as enum ('urgent', 'high', 'normal', 'low');

-- ---------------------------------------------------------------------------
-- Stores
-- ---------------------------------------------------------------------------

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  location text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Departments
-- One shared list for the whole region (Bakery, Deli, Beantree, ...). Each
-- store gets a row per department in store_departments; a department the
-- store doesn't have (e.g. no Beantree) is disabled for that store rather
-- than missing, so enabling it later is a toggle, not a data-entry job.
-- ---------------------------------------------------------------------------

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.store_departments (
  store_id uuid not null references public.stores (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  enabled boolean not null default true,
  -- Forward-to address for this department at this store. A department is
  -- only offered as a forward target when enabled and email is set.
  email text,
  primary key (store_id, department_id)
);

-- New store → one row per existing department, enabled by default. The
-- create-store flow then switches off the ones that store doesn't have.
create function public.seed_store_departments() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.store_departments (store_id, department_id)
  select new.id, d.id from public.departments d
  on conflict do nothing;
  return new;
end $$;

create trigger stores_seed_departments
after insert on public.stores
for each row execute function public.seed_store_departments();

-- New department → added to every store, disabled until turned on per store,
-- so a newly added department never silently appears everywhere.
create function public.seed_department_stores() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.store_departments (store_id, department_id, enabled)
  select s.id, new.id, false from public.stores s
  on conflict do nothing;
  return new;
end $$;

create trigger departments_seed_stores
after insert on public.departments
for each row execute function public.seed_department_stores();

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text, -- copy of the login email so the regional manager can see it (auth.users is not readable)
  role public.user_role not null,
  store_id uuid references public.stores (id) on delete set null,
  phone text,
  created_at timestamptz not null default now(),
  constraint store_manager_has_store check (role <> 'store_manager' or store_id is not null)
);

create index profiles_store_id_idx on public.profiles (store_id);

-- One login per store.
create unique index profiles_one_manager_per_store on public.profiles (store_id)
  where role = 'store_manager';

-- ---------------------------------------------------------------------------
-- RLS helpers
-- security definer so policies can consult profiles without recursing into
-- profiles' own RLS.
-- ---------------------------------------------------------------------------

create function public.is_regional_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'regional_manager'
  );
$$;

create function public.my_store_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select store_id from public.profiles where id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Regional manager: full read/write on the core layer.
-- Store manager: reads their own store, its departments, and their profile.
-- Provisioning (creating auth users) happens server-side with the secret key.
-- ---------------------------------------------------------------------------

alter table public.stores enable row level security;
alter table public.departments enable row level security;
alter table public.store_departments enable row level security;
alter table public.profiles enable row level security;

create policy "stores: rm all" on public.stores
  for all to authenticated
  using (public.is_regional_manager()) with check (public.is_regional_manager());
create policy "stores: sm reads own" on public.stores
  for select to authenticated
  using (id = public.my_store_id());

create policy "departments: read" on public.departments
  for select to authenticated using (true);
create policy "departments: rm write" on public.departments
  for all to authenticated
  using (public.is_regional_manager()) with check (public.is_regional_manager());

create policy "store_departments: rm all" on public.store_departments
  for all to authenticated
  using (public.is_regional_manager()) with check (public.is_regional_manager());
create policy "store_departments: sm reads own" on public.store_departments
  for select to authenticated
  using (store_id = public.my_store_id());

create policy "profiles: rm all" on public.profiles
  for all to authenticated
  using (public.is_regional_manager()) with check (public.is_regional_manager());
create policy "profiles: read self" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- create_store: store + its department switches in one transaction.
-- Runs as the caller, so RLS limits it to the regional manager.
-- ---------------------------------------------------------------------------

create function public.create_store(
  p_name text,
  p_location text,
  p_disabled_department_ids uuid[] default '{}'
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_store_id uuid;
begin
  insert into public.stores (name, location)
  values (trim(p_name), nullif(trim(p_location), ''))
  returning id into v_store_id;

  update public.store_departments
  set enabled = false
  where store_id = v_store_id and department_id = any (p_disabled_department_ids);

  return v_store_id;
end $$;

-- ---------------------------------------------------------------------------
-- Seed: the region's department list
-- ---------------------------------------------------------------------------

insert into public.departments (name, sort_order) values
  ('Fresh Produce', 1),
  ('Hot Deli', 2),
  ('Cold Deli', 3),
  ('Bakery', 4),
  ('Butchery', 5),
  ('Beantree', 6),
  ('General', 7);
