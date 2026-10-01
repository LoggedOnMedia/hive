import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Viewer } from "@/lib/viewer";

// Reads for the module's pages. wa_* tables have no RLS policies, so every
// read goes through the secret-key client and is scoped here by role:
// the regional manager sees everything; a store manager sees only the active
// channels linked to their own store, and posts that went to them.

export type WaViewer = Viewer & { isRM: boolean };

export type Channel = {
  id: string;
  whapi_channel_id: string;
  name: string;
  store_id: string | null;
  store_name: string | null;
  active: boolean;
  in_last_sync: boolean;
  synced_at: string;
};

export async function listChannels(v: WaViewer): Promise<Channel[]> {
  let q = createAdminClient()
    .from("wa_channels")
    .select("id, whapi_channel_id, name, store_id, active, in_last_sync, synced_at, stores(name)")
    .order("name");
  if (!v.isRM) q = q.eq("store_id", v.storeId ?? "00000000-0000-0000-0000-000000000000").eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data.map((c) => ({
    ...c,
    store_name: (c.stores as unknown as { name: string } | null)?.name ?? null,
  })) as Channel[];
}

/** Channel ids this viewer may post to. */
export async function postableChannelIds(v: WaViewer): Promise<Set<string>> {
  const channels = await listChannels(v);
  return new Set(channels.filter((c) => c.active).map((c) => c.id));
}

export type Group = { id: string; name: string; channel_ids: string[] };

export async function listGroups(): Promise<Group[]> {
  const { data, error } = await createAdminClient()
    .from("wa_groups")
    .select("id, name, wa_group_channels(channel_id)")
    .order("name");
  if (error) throw error;
  return data.map((g) => ({
    id: g.id,
    name: g.name,
    channel_ids: (g.wa_group_channels as { channel_id: string }[]).map((c) => c.channel_id),
  }));
}

export type PostTarget = {
  id: string;
  channel_id: string;
  channel_name: string;
  status: "pending" | "sending" | "sent" | "failed";
  error: string | null;
  sent_at: string | null;
};

export type Post = {
  id: string;
  caption: string;
  media_path: string | null;
  status: "draft" | "scheduled" | "sending" | "sent" | "partial" | "failed";
  scheduled_at: string;
  created_at: string;
  created_by: string | null;
  author: string | null;
  targets: PostTarget[];
  previewUrl: string | null;
};

export async function listPosts(v: WaViewer, limit = 50): Promise<Post[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wa_posts")
    .select(
      "id, caption, media_path, status, scheduled_at, created_at, created_by, profiles(full_name), wa_post_targets(id, channel_id, status, error, sent_at, wa_channels(name, store_id))",
    )
    .order("scheduled_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const posts = data.map((p) => {
    const targets = (
      p.wa_post_targets as unknown as {
        id: string;
        channel_id: string;
        status: PostTarget["status"];
        error: string | null;
        sent_at: string | null;
        wa_channels: { name: string; store_id: string | null } | null;
      }[]
    )
      // A store manager only sees deliveries to their own store's channels.
      .filter((t) => v.isRM || t.wa_channels?.store_id === v.storeId)
      .map((t) => ({
        id: t.id,
        channel_id: t.channel_id,
        channel_name: t.wa_channels?.name ?? "Channel",
        status: t.status,
        error: t.error,
        sent_at: t.sent_at,
      }));
    return {
      id: p.id,
      caption: p.caption,
      media_path: p.media_path,
      status: p.status as Post["status"],
      scheduled_at: p.scheduled_at,
      created_at: p.created_at,
      created_by: p.created_by,
      author: (p.profiles as unknown as { full_name: string } | null)?.full_name ?? null,
      targets,
      previewUrl: null as string | null,
    };
  });

  const visible = v.isRM ? posts : posts.filter((p) => p.targets.length > 0);

  const paths = visible.flatMap((p) => (p.media_path ? [p.media_path] : []));
  if (paths.length) {
    const { data: urls } = await admin.storage.from("wa-media").createSignedUrls(paths, 60 * 60);
    const map = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]));
    for (const p of visible) if (p.media_path) p.previewUrl = map.get(p.media_path) ?? null;
  }
  return visible;
}

export type SenderState = { paused: boolean; paused_reason: string | null; backoff_until: string | null };

export async function getSenderState(): Promise<SenderState> {
  const { data } = await createAdminClient().from("wa_state").select("paused, paused_reason, backoff_until").eq("id", 1).single();
  return data ?? { paused: false, paused_reason: null, backoff_until: null };
}

export async function listStoresForLinking() {
  const { data } = await createAdminClient().from("stores").select("id, name").order("name");
  return data ?? [];
}
