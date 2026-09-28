"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateAssets } from "@/lib/assets";
import { PRIORITIES, type Priority } from "@/lib/priority";
import { getViewer, requireRegionalManager } from "@/lib/viewer";
import type { FormState } from "./stores";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function readPriority(fd: FormData): Priority | null {
  const p = fd.get("priority");
  return PRIORITIES.includes(p as Priority) ? (p as Priority) : null;
}

export async function createPost(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRegionalManager();
  const title = text(fd, "title");
  const body = text(fd, "body");
  const priority = readPriority(fd);
  if (!title) return { error: "Give the message a title." };
  if (!priority) return { error: "Choose a priority." };
  if (fd.get("uploading")) return { error: "Wait for the uploads to finish, then send." };

  let assetsJson: unknown;
  try {
    assetsJson = JSON.parse(String(fd.get("assets") ?? "[]"));
  } catch {
    assetsJson = null;
  }
  const checked = validateAssets(assetsJson);
  if ("error" in checked) return { error: checked.error };

  const supabase = await createClient();
  let storeIds: string[];
  if (fd.get("audience") === "all") {
    // Snapshot of the stores that exist right now.
    const { data, error } = await supabase.from("stores").select("id");
    if (error) return { error: error.message };
    storeIds = data.map((s) => s.id);
  } else {
    storeIds = fd.getAll("store").map(String);
  }
  if (storeIds.length === 0) return { error: "Choose at least one store." };

  const { data: postId, error } = await supabase.rpc("create_post", {
    p_title: title,
    p_body: body,
    p_priority: priority,
    p_replies_shared: fd.get("replies") !== "private",
    p_store_ids: storeIds,
    p_assets: checked.assets,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect(`/feed/${postId}`);
}

export async function updatePost(postId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireRegionalManager();
  const title = text(fd, "title");
  const priority = readPriority(fd);
  if (!title) return { error: "The message needs a title." };
  if (!priority) return { error: "Choose a priority." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("posts")
    .update({ title, body: text(fd, "body"), priority, edited_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect(`/feed/${postId}`);
}

export async function deletePost(postId: string) {
  await requireRegionalManager();
  const supabase = await createClient();
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
  revalidatePath("/", "layout");
  redirect("/feed");
}

export async function replyToPost(postId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const viewer = await getViewer();
  const body = text(fd, "body");
  if (!body) return {};

  // A store manager always replies in their own store's conversation. The
  // regional manager replies to everyone (shared) or to one store (private).
  const storeId = viewer.role === "store_manager" ? viewer.storeId : text(fd, "store_id") || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("thread_messages")
    .insert({ post_id: postId, author_id: viewer.id, store_id: storeId, parent_id: text(fd, "parent_id") || null, body });
  if (error) return { error: "Couldn't send your reply. Please try again." };

  revalidatePath(`/feed/${postId}`);
  revalidatePath("/feed");
  return { ok: "sent" };
}

/** Records that a store manager opened a post. Idempotent. */
export async function markSeen(postId: string) {
  const viewer = await getViewer();
  if (viewer.role !== "store_manager") return;
  const supabase = await createClient();
  await supabase
    .from("post_reads")
    .upsert({ post_id: postId, user_id: viewer.id }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
  revalidatePath("/", "layout");
}

/**
 * Adds the viewer's emoji reaction, or removes it if already there.
 * `target` is "post" for the post itself, otherwise a thread message id.
 */
export async function toggleReaction(postId: string, target: string, emoji: string) {
  const viewer = await getViewer();
  if (!emoji || emoji.length > 16) return;

  const supabase = await createClient();
  const column = target === "post" ? "post_id" : "thread_message_id";
  const targetId = target === "post" ? postId : target;

  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq(column, targetId)
    .eq("user_id", viewer.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await supabase.from("reactions").delete().eq("id", existing.id);
  } else {
    await supabase.from("reactions").insert({ user_id: viewer.id, store_id: viewer.storeId, [column]: targetId, emoji });
  }
  revalidatePath(`/feed/${postId}`);
}

/**
 * Personal archive. Store managers can only archive what they've opened
 * (enforced by RLS); opening the post page records that, so it's always true there.
 */
export async function setArchived(postId: string, archived: boolean) {
  const viewer = await getViewer();
  const supabase = await createClient();
  if (archived && viewer.role === "store_manager") {
    // Archiving from the post page can beat the page's own mark-seen call.
    await supabase
      .from("post_reads")
      .upsert({ post_id: postId, user_id: viewer.id }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
  }
  if (archived) {
    const { error } = await supabase
      .from("post_archives")
      .upsert({ post_id: postId, user_id: viewer.id, archived_at: new Date().toISOString() });
    if (error) throw new Error("Only messages you've opened can be archived.");
  } else {
    await supabase.from("post_archives").delete().eq("post_id", postId).eq("user_id", viewer.id);
  }
  revalidatePath("/", "layout");
}
