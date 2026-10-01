"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEDIA, waEnabled } from "./config";
import { listGroups, postableChannelIds, waViewer, type WaViewer } from "./server/data";
import { runTick } from "./server/sender";
import { getUsage, sandboxBlock } from "./server/usage";
import { listAdminChannels, WhapiError } from "./server/whapi";

// All mutations for the WhatsApp channels module. Each checks the feature
// flag and the viewer's role; wa_* tables are only reachable from here.

export type Result = { ok?: string; error?: string };

const BASE = "/whatsapp";
const done = (ok: string): Result => {
  revalidatePath(BASE, "layout");
  return { ok };
};

async function rm(): Promise<WaViewer | Result> {
  if (!waEnabled()) return { error: "WhatsApp channels are switched off." };
  const v = await waViewer();
  return v.isRM ? v : { error: "Only the regional manager can do that." };
}
const isResult = (x: WaViewer | Result): x is Result => !("role" in x);

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export async function syncChannels(): Promise<Result> {
  const v = await rm();
  if (isResult(v)) return v;
  let channels;
  try {
    channels = await listAdminChannels();
  } catch (e) {
    if (e instanceof WhapiError && e.kind === "unauthorized") {
      return { error: "WhatsApp disconnected — re-scan the QR code in the Whapi dashboard (or check WA_API_TOKEN)." };
    }
    return { error: `Couldn't reach Whapi: ${(e as Error).message}` };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  if (channels.length) {
    const { error } = await admin.from("wa_channels").upsert(
      channels.map((c) => ({ whapi_channel_id: c.id, name: c.name, in_last_sync: true, synced_at: now })),
      { onConflict: "whapi_channel_id" },
    );
    if (error) return { error: error.message };
  }
  // Channels the number no longer administers stay (history keeps working) but are flagged.
  const seen = channels.map((c) => c.id);
  let stale = admin.from("wa_channels").update({ in_last_sync: false });
  stale = seen.length ? stale.not("whapi_channel_id", "in", `(${seen.map((s) => `"${s}"`).join(",")})`) : stale.not("id", "is", null);
  await stale;
  return done(`Synced ${channels.length} ${channels.length === 1 ? "channel" : "channels"} this number administers.`);
}

export async function setChannelActive(channelId: string, active: boolean): Promise<Result> {
  const v = await rm();
  if (isResult(v)) return v;
  const { error } = await createAdminClient().from("wa_channels").update({ active }).eq("id", channelId);
  return error ? { error: error.message } : done(active ? "Channel on" : "Channel off");
}

export async function setChannelStore(channelId: string, storeId: string | null): Promise<Result> {
  const v = await rm();
  if (isResult(v)) return v;
  const { error } = await createAdminClient()
    .from("wa_channels")
    .update({ store_id: storeId || null })
    .eq("id", channelId);
  return error ? { error: error.message } : done("Saved");
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export async function saveGroup(groupId: string | null, name: string, channelIds: string[]): Promise<Result> {
  const v = await rm();
  if (isResult(v)) return v;
  const clean = name.trim();
  if (!clean) return { error: "Give the group a name." };

  const admin = createAdminClient();
  let id = groupId;
  if (id) {
    const { error } = await admin.from("wa_groups").update({ name: clean }).eq("id", id);
    if (error) return { error: error.code === "23505" ? "There's already a group with that name." : error.message };
  } else {
    const { data, error } = await admin.from("wa_groups").insert({ name: clean }).select("id").single();
    if (error) return { error: error.code === "23505" ? "There's already a group with that name." : error.message };
    id = data.id;
  }
  await admin.from("wa_group_channels").delete().eq("group_id", id!);
  const unique = [...new Set(channelIds)];
  if (unique.length) {
    const { error } = await admin.from("wa_group_channels").insert(unique.map((c) => ({ group_id: id!, channel_id: c })));
    if (error) return { error: error.message };
  }
  return done(groupId ? "Group saved" : "Group created");
}

export async function deleteGroup(groupId: string): Promise<Result> {
  const v = await rm();
  if (isResult(v)) return v;
  const { error } = await createAdminClient().from("wa_groups").delete().eq("id", groupId);
  return error ? { error: error.message } : done("Group deleted");
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

/** One-time upload URL so the browser sends the image straight to storage. */
export async function getImageUploadUrl(name: string, size: number, type: string): Promise<Result & { path?: string; url?: string }> {
  if (!waEnabled()) return { error: "WhatsApp channels are switched off." };
  await waViewer();
  if (!MEDIA.types.includes(type)) return { error: "Use a JPEG or PNG image." };
  if (size <= 0 || size > MEDIA.maxBytes) return { error: "Images must be under 16 MB." };
  const ext = type === "image/png" ? "png" : "jpg";
  const path = `posts/${randomUUID()}/${name.replace(/[^\w.\-]+/g, "_").replace(/\.[^.]*$/, "").slice(0, 60) || "image"}.${ext}`;
  const { data, error } = await createAdminClient().storage.from("wa-media").createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "Couldn't prepare the upload." };
  return { path, url: data.signedUrl };
}

export type NewPost = {
  caption: string;
  mediaPath: string | null;
  mediaMime: string | null;
  channelIds: string[];
  groupIds: string[];
  /** ISO time (UTC) to send at, or null for now. */
  scheduledAt: string | null;
};

export async function createWaPost(input: NewPost): Promise<Result & { postId?: string }> {
  if (!waEnabled()) return { error: "WhatsApp channels are switched off." };
  const v = await waViewer();
  const caption = input.caption.trim().slice(0, 4096);
  if (!caption && !input.mediaPath) return { error: "Add an image, some text, or both." };
  if (input.mediaPath && !input.mediaPath.startsWith("posts/")) return { error: "That image didn't upload properly." };
  if (input.mediaMime && !MEDIA.types.includes(input.mediaMime)) return { error: "Use a JPEG or PNG image." };

  // Expand groups (regional manager only) and de-duplicate.
  const allowed = await postableChannelIds(v);
  const wanted = new Set(input.channelIds);
  if (input.groupIds.length) {
    if (!v.isRM) return { error: "Only the regional manager can post to groups." };
    for (const g of await listGroups()) if (input.groupIds.includes(g.id)) g.channel_ids.forEach((c) => wanted.add(c));
  }
  const targets = [...wanted].filter((id) => allowed.has(id));
  if (targets.length === 0) return { error: "Choose at least one channel." };
  if (targets.length < wanted.size && !v.isRM) return { error: "You can only post to your own store's channels." };

  let when = new Date();
  if (input.scheduledAt) {
    when = new Date(input.scheduledAt);
    if (Number.isNaN(when.getTime())) return { error: "That date and time isn't valid." };
    if (when.getTime() < Date.now() - 60_000) return { error: "Pick a time in the future." };
  }

  // Sandbox: refuse up front rather than queue something that can't go out.
  const blocked = sandboxBlock(await getUsage(), targets.length, targets);
  if (blocked) return { error: blocked };

  const admin = createAdminClient();
  const { data: post, error } = await admin
    .from("wa_posts")
    .insert({
      caption,
      media_path: input.mediaPath,
      media_mime: input.mediaMime,
      status: "scheduled",
      scheduled_at: when.toISOString(),
      created_by: v.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const { error: tErr } = await admin
    .from("wa_post_targets")
    .insert(targets.map((channel_id) => ({ post_id: post.id, channel_id })));
  if (tErr) {
    await admin.from("wa_posts").delete().eq("id", post.id);
    return { error: tErr.message };
  }

  if (!input.scheduledAt) after(() => runTick().then(() => undefined));
  revalidatePath(BASE, "layout");
  return {
    ok: input.scheduledAt
      ? `Scheduled for ${targets.length} ${targets.length === 1 ? "channel" : "channels"}.`
      : `Sending to ${targets.length} ${targets.length === 1 ? "channel" : "channels"}, one at a time.`,
    postId: post.id,
  };
}

async function ownPost(v: WaViewer, postId: string) {
  const { data } = await createAdminClient().from("wa_posts").select("id, created_by, status, media_path").eq("id", postId).single();
  if (!data) return null;
  return v.isRM || data.created_by === v.id ? data : null;
}

/** Re-queues only the failed channels of a post. */
export async function retryFailed(postId: string): Promise<Result> {
  if (!waEnabled()) return { error: "WhatsApp channels are switched off." };
  const v = await waViewer();
  if (!(await ownPost(v, postId))) return { error: "You can't retry that post." };

  const admin = createAdminClient();
  const { data: failed } = await admin.from("wa_post_targets").select("channel_id").eq("post_id", postId).eq("status", "failed");
  if (!failed?.length) return { error: "Nothing failed on this post." };
  const blocked = sandboxBlock(await getUsage(), failed.length, failed.map((f) => f.channel_id));
  if (blocked) return { error: blocked };

  await admin
    .from("wa_post_targets")
    .update({ status: "pending", error: null, claimed_at: null })
    .eq("post_id", postId)
    .eq("status", "failed");
  await admin.from("wa_posts").update({ status: "sending", scheduled_at: new Date().toISOString() }).eq("id", postId);
  after(() => runTick().then(() => undefined));
  return done(`Retrying ${failed.length} ${failed.length === 1 ? "channel" : "channels"}.`);
}

/** Cancels a post that hasn't started sending. */
export async function cancelPost(postId: string): Promise<Result> {
  if (!waEnabled()) return { error: "WhatsApp channels are switched off." };
  const v = await waViewer();
  const post = await ownPost(v, postId);
  if (!post) return { error: "You can't cancel that post." };
  if (post.status !== "scheduled") return { error: "It has already started sending." };
  const admin = createAdminClient();
  const { error } = await admin.from("wa_posts").delete().eq("id", postId).eq("status", "scheduled");
  if (error) return { error: error.message };
  if (post.media_path) await admin.storage.from("wa-media").remove([post.media_path]);
  return done("Cancelled");
}

/** After re-scanning the QR code in Whapi: clear the pause and carry on. */
export async function resumeSending(): Promise<Result> {
  const v = await rm();
  if (isResult(v)) return v;
  await createAdminClient()
    .from("wa_state")
    .update({ paused: false, paused_reason: null, backoff_until: null })
    .eq("id", 1);
  after(() => runTick().then(() => undefined));
  return done("Sending resumed");
}
