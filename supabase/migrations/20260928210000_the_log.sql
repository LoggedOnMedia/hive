-- The Log → Hive: The Log (Logged On Media's job tracker) sends finished
-- artwork straight to stores. It talks to Hive's /api/the-log/* endpoints with
-- a shared secret; those endpoints use the secret key, so everything here is
-- for the service role only.

-- Which Log client a Hive store is. Set from The Log's client page.
alter table public.stores add column the_log_client_id text unique;

-- Who at the studio pressed Send (shown to the regional manager, not stores).
alter table public.posts add column source_actor text;

create index posts_source_idx on public.posts (source, source_ref);

-- Creates a post on behalf of an external source. Same shape as create_post,
-- but the author is passed in (there's no signed-in Hive user) and the source
-- fields are set. security definer + service_role only.
create function public.create_external_post(
  p_author_id uuid,
  p_title text,
  p_body text,
  p_priority public.priority,
  p_replies_shared boolean,
  p_store_ids uuid[],
  p_assets jsonb,
  p_source text,
  p_source_ref text,
  p_sender_name text,
  p_source_actor text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_post_id uuid;
begin
  if coalesce(array_length(p_store_ids, 1), 0) = 0 then
    raise exception 'A message needs at least one store';
  end if;
  if not exists (select 1 from public.profiles where id = p_author_id and role = 'regional_manager') then
    raise exception 'Author must be a regional manager';
  end if;

  insert into public.posts
    (author_id, title, body, priority, replies_shared, source, source_ref, sender_name, source_actor)
  values
    (p_author_id, trim(p_title), trim(coalesce(p_body, '')), p_priority, p_replies_shared,
     p_source, p_source_ref, p_sender_name, p_source_actor)
  returning id into v_post_id;

  insert into public.post_targets (post_id, store_id)
  select v_post_id, unnest(p_store_ids);

  insert into public.assets
    (post_id, kind, name, storage_path, mime_type, size_bytes, url, expires_at, downloadable, sort_order)
  select v_post_id, a->>'kind', a->>'name', a->>'storage_path', a->>'mime_type',
         (a->>'size_bytes')::bigint, a->>'url', (a->>'expires_at')::timestamptz,
         coalesce((a->>'downloadable')::boolean, true), (ord - 1)::int
  from jsonb_array_elements(coalesce(p_assets, '[]'::jsonb)) with ordinality as t(a, ord);

  return v_post_id;
end $$;

revoke execute on function public.create_external_post from public, anon, authenticated;
grant execute on function public.create_external_post to service_role;
