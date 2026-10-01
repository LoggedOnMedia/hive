-- wa-channels patch 001 — only needed if up.sql was run before this file existed.
-- (up.sql already includes it for fresh installs.)

-- Restarts the send gap from when a send finished (database clock, not the
-- app server's, so clock differences can't shorten the gap).
create function public.wa_mark_sent() returns void
language sql security definer set search_path = '' as $$
  update public.wa_state set last_sent_at = now() where id = 1;
$$;
revoke execute on function public.wa_mark_sent() from public, anon, authenticated;
grant execute on function public.wa_mark_sent() to service_role;
