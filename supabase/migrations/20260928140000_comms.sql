-- Hive comms layer: posts, who they went to, who has seen them, and the
-- reply thread under each one. Other sections plug into this later via
-- posts.module.

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id),
  title text not null check (length(trim(title)) > 0),
  body text not null default '',
  priority public.priority not null default 'normal',
  -- true: every recipient store sees every reply (labelled by store).
  -- false: each store sees only its own conversation with the regional manager.
  replies_shared boolean not null default true,
  -- null = plain comms message; set by future sections (e.g. 'leave_request').
  module text,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index posts_feed_idx on public.posts (priority, created_at desc);

-- Recipients, fixed at send time. "All stores" is stored as one row per store
-- that existed then, so stores added later never inherit old messages.
create table public.post_targets (
  post_id uuid not null references public.posts (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  primary key (post_id, store_id)
);

create index post_targets_store_idx on public.post_targets (store_id);

create table public.post_reads (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Thread
-- store_id says whose conversation a reply belongs to: a store manager's own
-- store, or — for the regional manager on a private-replies post — the store
-- he's answering. Null means "to everyone", only valid on shared posts.
-- ---------------------------------------------------------------------------

create table public.thread_messages (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid references public.stores (id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index thread_messages_post_idx on public.thread_messages (post_id, created_at);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.post_is_for_my_store(p_post_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.post_targets t
    where t.post_id = p_post_id and t.store_id = public.my_store_id()
  );
$$;

create function public.post_replies_shared(p_post_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select replies_shared from public.posts where id = p_post_id;
$$;

-- Post + recipients in one transaction. Runs as the caller (RLS applies).
create function public.create_post(
  p_title text,
  p_body text,
  p_priority public.priority,
  p_replies_shared boolean,
  p_store_ids uuid[]
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

  return v_post_id;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.posts enable row level security;
alter table public.post_targets enable row level security;
alter table public.post_reads enable row level security;
alter table public.thread_messages enable row level security;

-- posts
create policy "posts: rm all" on public.posts
  for all to authenticated
  using (public.is_regional_manager()) with check (public.is_regional_manager());
create policy "posts: sm reads targeted" on public.posts
  for select to authenticated
  using (public.post_is_for_my_store(id));

-- post_targets
create policy "post_targets: rm all" on public.post_targets
  for all to authenticated
  using (public.is_regional_manager()) with check (public.is_regional_manager());
create policy "post_targets: sm reads own store" on public.post_targets
  for select to authenticated
  using (store_id = public.my_store_id());

-- post_reads
create policy "post_reads: rm reads all" on public.post_reads
  for select to authenticated
  using (public.is_regional_manager());
create policy "post_reads: sm reads own" on public.post_reads
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "post_reads: sm marks own" on public.post_reads
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.post_is_for_my_store(post_id));

-- thread_messages
create policy "thread: rm all" on public.thread_messages
  for all to authenticated
  using (public.is_regional_manager()) with check (public.is_regional_manager());
create policy "thread: sm reads" on public.thread_messages
  for select to authenticated
  using (
    public.post_is_for_my_store(post_id)
    and (public.post_replies_shared(post_id) or store_id = public.my_store_id())
  );
create policy "thread: sm replies" on public.thread_messages
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and store_id = public.my_store_id()
    and public.post_is_for_my_store(post_id)
  );

-- Store managers need the names of fellow repliers on shared threads: every
-- store that shares at least one post with theirs. security definer because
-- post_targets RLS only shows a store manager their own store's rows.
create function public.co_recipient_store_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct t2.store_id
  from public.post_targets t1
  join public.post_targets t2 on t2.post_id = t1.post_id
  where t1.store_id = public.my_store_id();
$$;

create policy "profiles: sm reads rm and co-recipients" on public.profiles
  for select to authenticated
  using (
    role = 'regional_manager'
    or store_id in (select public.co_recipient_store_ids())
  );

create policy "stores: sm reads co-recipients" on public.stores
  for select to authenticated
  using (id in (select public.co_recipient_store_ids()));
