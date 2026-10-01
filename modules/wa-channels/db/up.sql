-- WhatsApp Channel Poster (wa-channels module) — UP
-- Self-contained: only new wa_* tables, functions, one private storage bucket
-- and (separately, see setup.mjs) one pg_cron job. Nothing existing is altered.
-- Undo everything with down.sql.
--
-- Every wa_* table has RLS on with NO policies: only the module's server code,
-- using the secret key after its own role checks, can read or write them.

-- ---------------------------------------------------------------------------
-- Channels (synced from Whapi) and groups of channels
-- ---------------------------------------------------------------------------

create table public.wa_channels (
  id uuid primary key default gen_random_uuid(),
  whapi_channel_id text not null unique check (whapi_channel_id like '%@newsletter'),
  name text not null,
  -- The Hive store whose manager may post to this channel (null = regional manager only).
  store_id uuid references public.stores (id) on delete set null,
  active boolean not null default true,
  -- false when the last sync no longer saw this channel as administered by the number.
  in_last_sync boolean not null default true,
  synced_at timestamptz not null default now()
);

create table public.wa_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.wa_group_channels (
  group_id uuid not null references public.wa_groups (id) on delete cascade,
  channel_id uuid not null references public.wa_channels (id) on delete cascade,
  primary key (group_id, channel_id)
);

-- ---------------------------------------------------------------------------
-- Posts and their per-channel delivery
-- ---------------------------------------------------------------------------

create table public.wa_posts (
  id uuid primary key default gen_random_uuid(),
  caption text not null default '',
  media_path text,          -- object path in the private 'wa-media' bucket
  media_mime text,
  -- draft | scheduled | sending | sent | partial | failed
  status text not null default 'scheduled'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'partial', 'failed')),
  scheduled_at timestamptz not null default now(),   -- UTC; shown in Africa/Johannesburg
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint wa_posts_has_content check (media_path is not null or length(trim(caption)) > 0)
);

create index wa_posts_due_idx on public.wa_posts (status, scheduled_at);

create table public.wa_post_targets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.wa_posts (id) on delete cascade,
  channel_id uuid not null references public.wa_channels (id) on delete cascade,
  -- pending | sending | sent | failed
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  whapi_message_id text,
  error text,
  attempts int not null default 0,
  claimed_at timestamptz,
  sent_at timestamptz,
  unique (post_id, channel_id)
);

create index wa_post_targets_pending_idx on public.wa_post_targets (status, post_id);

-- ---------------------------------------------------------------------------
-- Usage (sandbox quotas) and sender state
-- ---------------------------------------------------------------------------

-- period: 'YYYY-MM' (month) or 'YYYY-MM-DD' (day), UTC.
create table public.wa_usage (
  period text primary key,
  request_count int not null default 0,
  message_count int not null default 0
);

create table public.wa_state (
  id int primary key default 1 check (id = 1),
  paused boolean not null default false,
  paused_reason text,
  last_sent_at timestamptz,
  backoff_until timestamptz
);
insert into public.wa_state (id) values (1);

alter table public.wa_channels enable row level security;
alter table public.wa_groups enable row level security;
alter table public.wa_group_channels enable row level security;
alter table public.wa_posts enable row level security;
alter table public.wa_post_targets enable row level security;
alter table public.wa_usage enable row level security;
alter table public.wa_state enable row level security;

-- ---------------------------------------------------------------------------
-- Functions (service role only)
-- ---------------------------------------------------------------------------

-- Atomically adds to this month's and today's counters (UTC).
create function public.wa_bump_usage(p_requests int, p_messages int) returns void
language sql security definer set search_path = '' as $$
  insert into public.wa_usage (period, request_count, message_count)
  values (to_char(now() at time zone 'utc', 'YYYY-MM'), p_requests, p_messages),
         (to_char(now() at time zone 'utc', 'YYYY-MM-DD'), p_requests, p_messages)
  on conflict (period) do update
    set request_count = public.wa_usage.request_count + excluded.request_count,
        message_count = public.wa_usage.message_count + excluded.message_count;
$$;

-- Hands out the next due target, one at a time across all workers, and
-- reserves the send slot so consecutive sends are at least p_gap_seconds apart.
-- Returns one row: either a target to send now, or wait_seconds until the next
-- slot (null wait and null target = nothing due / paused).
create function public.wa_claim_next(p_gap_seconds int)
returns table (
  target_id uuid,
  post_id uuid,
  channel_id uuid,
  whapi_channel_id text,
  caption text,
  media_path text,
  media_mime text,
  wait_seconds int
)
language plpgsql security definer set search_path = '' as $$
declare
  v_state public.wa_state;
  v_target uuid;
begin
  -- Serialise claimers; anyone who can't get the lock just waits a moment.
  if not pg_try_advisory_xact_lock(hashtext('wa_claim_next')) then
    return query select null::uuid, null::uuid, null::uuid, null::text, null::text, null::text, null::text, 3;
    return;
  end if;

  select * into v_state from public.wa_state where id = 1 for update;
  if v_state.paused or (v_state.backoff_until is not null and v_state.backoff_until > now()) then
    return;
  end if;

  select t.id into v_target
  from public.wa_post_targets t
  join public.wa_posts p on p.id = t.post_id
  where t.status = 'pending'
    and p.status in ('scheduled', 'sending', 'partial', 'failed')
    and p.scheduled_at <= now()
  order by p.scheduled_at, t.id
  limit 1
  for update of t skip locked;

  if v_target is null then
    return;
  end if;

  if v_state.last_sent_at is not null and v_state.last_sent_at + make_interval(secs => p_gap_seconds) > now() then
    return query select null::uuid, null::uuid, null::uuid, null::text, null::text, null::text, null::text,
      ceil(extract(epoch from (v_state.last_sent_at + make_interval(secs => p_gap_seconds) - now())))::int;
    return;
  end if;

  update public.wa_state set last_sent_at = now() where id = 1;
  update public.wa_post_targets
    set status = 'sending', claimed_at = now(), attempts = attempts + 1
    where id = v_target;
  update public.wa_posts p set status = 'sending'
    from public.wa_post_targets t
    where t.id = v_target and p.id = t.post_id;

  return query
    select t.id, p.id, c.id, c.whapi_channel_id, p.caption, p.media_path, p.media_mime, null::int
    from public.wa_post_targets t
    join public.wa_posts p on p.id = t.post_id
    join public.wa_channels c on c.id = t.channel_id
    where t.id = v_target;
end $$;

-- Recomputes a post's status from its targets.
create function public.wa_refresh_post_status(p_post_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_total int; v_sent int; v_failed int; v_open int; v_status text;
begin
  select count(*),
         count(*) filter (where status = 'sent'),
         count(*) filter (where status = 'failed'),
         count(*) filter (where status in ('pending', 'sending'))
    into v_total, v_sent, v_failed, v_open
  from public.wa_post_targets where post_id = p_post_id;

  v_status := case
    when v_open > 0 then null                       -- leave scheduled/sending as is
    when v_sent = v_total then 'sent'
    when v_failed = v_total then 'failed'
    else 'partial'
  end;
  if v_status is not null then
    update public.wa_posts set status = v_status where id = p_post_id;
  end if;
  return v_status;
end $$;

-- A send that was claimed but never finished (server crashed mid-request) is
-- marked failed rather than resent: it may have reached WhatsApp.
create function public.wa_fail_stale_sends() returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  with stale as (
    update public.wa_post_targets
      set status = 'failed',
          error = 'Interrupted while sending — check the channel before retrying'
      where status = 'sending' and claimed_at < now() - interval '5 minutes'
      returning post_id
  )
  select count(*) into v_count from stale;
  return v_count;
end $$;

revoke execute on function public.wa_bump_usage(int, int) from public, anon, authenticated;
revoke execute on function public.wa_claim_next(int) from public, anon, authenticated;
revoke execute on function public.wa_refresh_post_status(uuid) from public, anon, authenticated;
revoke execute on function public.wa_fail_stale_sends() from public, anon, authenticated;
grant execute on function public.wa_bump_usage(int, int) to service_role;
grant execute on function public.wa_claim_next(int) to service_role;
grant execute on function public.wa_refresh_post_status(uuid) to service_role;
grant execute on function public.wa_fail_stale_sends() to service_role;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for post images (JPEG/PNG, max 16 MB like WhatsApp).
-- Uploads use one-time signed URLs issued by the server; no policies needed.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wa-media', 'wa-media', false, 16777216, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;
