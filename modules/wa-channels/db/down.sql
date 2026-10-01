-- WhatsApp Channel Poster (wa-channels module) — DOWN
-- Removes everything up.sql and setup.mjs created. Run in the Supabase SQL editor.
--
-- BEFORE running: empty the 'wa-media' bucket (Storage → wa-media → select all
-- → Delete). Supabase doesn't allow deleting stored files from SQL.

-- The every-minute trigger and its secret (created by setup.mjs).
-- Wrapped so this still runs if the scheduler was never set up.
do $$
begin
  perform cron.unschedule('wa-channels-tick');
exception when others then null;
end $$;
do $$
begin
  delete from vault.secrets where name = 'wa_cron_secret';
exception when others then null;
end $$;

drop function if exists public.wa_fail_stale_sends();
drop function if exists public.wa_refresh_post_status(uuid);
drop function if exists public.wa_claim_next(int);
drop function if exists public.wa_bump_usage(int, int);

drop table if exists public.wa_post_targets;
drop table if exists public.wa_posts;
drop table if exists public.wa_group_channels;
drop table if exists public.wa_groups;
drop table if exists public.wa_channels;
drop table if exists public.wa_usage;
drop table if exists public.wa_state;

delete from storage.buckets where id = 'wa-media';
