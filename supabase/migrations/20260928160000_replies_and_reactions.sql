-- Answers to a specific reply, and emoji reactions on posts and replies.

-- ---------------------------------------------------------------------------
-- Nested answers (one level): parent_id points at the top-level reply being
-- answered. Answering an answer attaches to the same top-level reply.
-- ---------------------------------------------------------------------------

alter table public.thread_messages
  add column parent_id uuid references public.thread_messages (id) on delete cascade;

create index thread_messages_parent_idx on public.thread_messages (parent_id);

-- Can the current user see this reply? Same rule as the thread select policy.
create function public.can_see_thread_message(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.thread_messages m
    join public.posts p on p.id = m.post_id
    where m.id = p_id
      and (
        public.is_regional_manager()
        or (public.post_is_for_my_store(m.post_id) and (p.replies_shared or m.store_id = public.my_store_id()))
      )
  );
$$;

-- An answer must hang off a visible top-level reply on the same post, in the
-- same conversation (matters for private-replies posts).
create function public.thread_parent_ok(p_parent_id uuid, p_post_id uuid, p_store_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_parent_id is null or exists (
    select 1 from public.thread_messages m
    join public.posts p on p.id = m.post_id
    where m.id = p_parent_id
      and m.post_id = p_post_id
      and m.parent_id is null
      and (p.replies_shared or m.store_id is not distinct from p_store_id)
      and public.can_see_thread_message(p_parent_id)
  );
$$;

drop policy "thread: sm replies" on public.thread_messages;
create policy "thread: sm replies" on public.thread_messages
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and store_id = public.my_store_id()
    and public.post_is_for_my_store(post_id)
    and public.thread_parent_ok(parent_id, post_id, store_id)
  );

drop policy "thread: rm all" on public.thread_messages;
create policy "thread: rm all" on public.thread_messages
  for all to authenticated
  using (public.is_regional_manager())
  with check (public.is_regional_manager() and public.thread_parent_ok(parent_id, post_id, store_id));

-- ---------------------------------------------------------------------------
-- Reactions — on a post or on a reply, never both.
-- store_id is the reacting user's store (null for the regional manager), so
-- private-replies posts can keep each store's reactions to itself.
-- ---------------------------------------------------------------------------

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid references public.stores (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  thread_message_id uuid references public.thread_messages (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  constraint reactions_one_target check ((post_id is null) <> (thread_message_id is null))
);

create unique index reactions_post_unique on public.reactions (post_id, user_id, emoji) where post_id is not null;
create unique index reactions_message_unique on public.reactions (thread_message_id, user_id, emoji)
  where thread_message_id is not null;
create index reactions_post_idx on public.reactions (post_id);
create index reactions_message_idx on public.reactions (thread_message_id);

-- Reactions on a post follow the post's reply visibility: shared → everyone
-- on the post sees them; private → a store sees its own and the RM's.
create function public.can_see_post_reaction(p_post_id uuid, p_store_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_regional_manager()
    or (
      public.post_is_for_my_store(p_post_id)
      and (public.post_replies_shared(p_post_id) or p_store_id is null or p_store_id = public.my_store_id())
    );
$$;

alter table public.reactions enable row level security;

create policy "reactions: read" on public.reactions
  for select to authenticated
  using (
    (post_id is not null and public.can_see_post_reaction(post_id, store_id))
    or (thread_message_id is not null and public.can_see_thread_message(thread_message_id))
  );

create policy "reactions: add own" on public.reactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and store_id is not distinct from public.my_store_id()
    and (
      (post_id is not null and (public.is_regional_manager() or public.post_is_for_my_store(post_id)))
      or (thread_message_id is not null and public.can_see_thread_message(thread_message_id))
    )
  );

create policy "reactions: remove own" on public.reactions
  for delete to authenticated
  using (user_id = (select auth.uid()));
