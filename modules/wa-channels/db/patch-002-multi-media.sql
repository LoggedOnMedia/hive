-- wa-channels patch 002 — multiple images/videos per post.
-- Only needed if up.sql was run before this file existed (up.sql includes it).

-- Ordered media for a post: images (JPEG/PNG) and videos (MP4). Each goes out
-- as its own channel post, in sort_order; the caption rides on the last one.
create table public.wa_post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.wa_posts (id) on delete cascade,
  path text not null,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'video/mp4')),
  sort_order int not null default 0
);
create index wa_post_media_post_idx on public.wa_post_media (post_id, sort_order);
alter table public.wa_post_media enable row level security;

-- How many of a post's parts (media items, then a separate long-caption text)
-- already reached this channel, so a retry resumes instead of re-sending.
alter table public.wa_post_targets add column parts_sent int not null default 0;

-- Content is now media in wa_post_media and/or a caption; the app enforces it.
alter table public.wa_posts drop constraint if exists wa_posts_has_content;

-- Allow MP4 in the bucket (WhatsApp's limit for channel media is 16 MB).
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'video/mp4'],
    file_size_limit = 16777216
where id = 'wa-media';
