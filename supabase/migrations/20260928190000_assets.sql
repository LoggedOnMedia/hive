-- Campaign assets: files uploaded to Hive, or external download links
-- (e.g. SwissTransfer) that expire. Every open/download goes through Hive so
-- it can be logged per store.

-- ---------------------------------------------------------------------------
-- Where a post came from, and who it shows as sent by
-- ---------------------------------------------------------------------------

alter table public.posts
  add column source text not null default 'hive',   -- 'hive' | 'the_log'
  add column source_ref text,                         -- e.g. The Log job id
  add column sender_name text;                        -- shown instead of the author, e.g. 'Logged On Media'

-- ---------------------------------------------------------------------------
-- Assets
-- ---------------------------------------------------------------------------

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  kind text not null check (kind in ('file', 'link')),
  name text not null check (length(trim(name)) > 0),
  -- kind = 'file': object path in the private 'assets' bucket
  storage_path text,
  mime_type text,
  size_bytes bigint,
  -- kind = 'link': external download URL, and when it stops working
  url text,
  expires_at timestamptz,
  -- false = preview only: shown inline, no Download/Forward
  downloadable boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint assets_file_has_path check (kind <> 'file' or storage_path is not null),
  constraint assets_link_has_url check (kind <> 'link' or url ~* '^https?://')
);

create index assets_post_idx on public.assets (post_id, sort_order);

-- One row per open of an asset through Hive.
create table public.asset_downloads (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid references public.stores (id) on delete cascade,
  downloaded_at timestamptz not null default now()
);

create index asset_downloads_asset_idx on public.asset_downloads (asset_id);

create function public.can_see_asset(p_asset_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assets a
    where a.id = p_asset_id
      and (public.is_regional_manager() or public.post_is_for_my_store(a.post_id))
  );
$$;

alter table public.assets enable row level security;
alter table public.asset_downloads enable row level security;

create policy "assets: rm all" on public.assets
  for all to authenticated
  using (public.is_regional_manager()) with check (public.is_regional_manager());
create policy "assets: sm reads targeted" on public.assets
  for select to authenticated
  using (public.post_is_for_my_store(post_id));

create policy "downloads: rm reads all" on public.asset_downloads
  for select to authenticated
  using (public.is_regional_manager());
create policy "downloads: sm reads own" on public.asset_downloads
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "downloads: log own" on public.asset_downloads
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and store_id is not distinct from public.my_store_id()
    and public.can_see_asset(asset_id)
  );

-- ---------------------------------------------------------------------------
-- create_post now takes attachments too. Runs as the caller (RLS applies).
-- p_assets: [{kind, name, storage_path?, mime_type?, size_bytes?, url?,
--             expires_at?, downloadable?}]
-- ---------------------------------------------------------------------------

drop function public.create_post(text, text, public.priority, boolean, uuid[]);

create function public.create_post(
  p_title text,
  p_body text,
  p_priority public.priority,
  p_replies_shared boolean,
  p_store_ids uuid[],
  p_assets jsonb default '[]'
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_post_id uuid;
begin
  if coalesce(array_length(p_store_ids, 1), 0) = 0 then
    raise exception 'A message needs at least one store';
  end if;

  insert into public.posts (author_id, title, body, priority, replies_shared)
  values ((select auth.uid()), trim(p_title), trim(p_body), p_priority, p_replies_shared)
  returning id into v_post_id;

  insert into public.post_targets (post_id, store_id)
  select v_post_id, unnest(p_store_ids);

  insert into public.assets
    (post_id, kind, name, storage_path, mime_type, size_bytes, url, expires_at, downloadable, sort_order)
  select v_post_id, a->>'kind', a->>'name', a->>'storage_path', a->>'mime_type',
         (a->>'size_bytes')::bigint, a->>'url', (a->>'expires_at')::timestamptz,
         coalesce((a->>'downloadable')::boolean, true), (ord - 1)::int
  from jsonb_array_elements(p_assets) with ordinality as t(a, ord);

  return v_post_id;
end $$;

-- ---------------------------------------------------------------------------
-- Storage: private bucket. The regional manager uploads from the browser;
-- everyone downloads through Hive, which checks access, logs it, and hands
-- out a short-lived signed URL.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('assets', 'assets', false, 52428800) -- 50 MB; bigger files go via a download link
on conflict (id) do nothing;

create policy "assets bucket: rm uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'assets' and public.is_regional_manager());

create policy "assets bucket: rm deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'assets' and public.is_regional_manager());

-- Storage's remove() needs select as well as delete.
create policy "assets bucket: rm reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'assets' and public.is_regional_manager());
