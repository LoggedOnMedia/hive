-- Personal archive: hides a post from one user's feed only. Store managers
-- can only archive posts they've opened. A reply after archived_at brings the
-- post back into the feed (worked out in the app).

create table public.post_archives (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  archived_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_archives enable row level security;

create policy "archives: read own" on public.post_archives
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "archives: add own" on public.post_archives
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      public.is_regional_manager()
      or (
        public.post_is_for_my_store(post_id)
        and exists (
          select 1 from public.post_reads r
          where r.post_id = post_archives.post_id and r.user_id = (select auth.uid())
        )
      )
    )
  );

-- Re-archiving after a post resurfaces refreshes the timestamp.
create policy "archives: update own" on public.post_archives
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "archives: remove own" on public.post_archives
  for delete to authenticated
  using (user_id = (select auth.uid()));
