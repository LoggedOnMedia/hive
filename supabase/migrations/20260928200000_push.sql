-- Web Push: one row per browser/device that has allowed notifications.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Each person manages only their own devices. Sending reads across users
-- server-side with the secret key.
create policy "push: read own" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "push: add own" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "push: update own" on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "push: remove own" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
