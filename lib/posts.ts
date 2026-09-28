import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PRIORITY_META, type Priority } from "@/lib/priority";
import { shortTime } from "@/lib/time";
import type { Viewer } from "@/lib/viewer";

export type FeedItem = {
  id: string;
  title: string;
  body: string;
  priority: Priority;
  createdAt: string;
  edited: boolean;
  replies: number;
  /** Store manager: has this viewer opened it. */
  seen: boolean;
  /** Regional manager: how many recipient stores have opened it. */
  seenCount: number;
  targetCount: number;
  /** In this viewer's archive (and no replies since archiving). */
  archived: boolean;
};

export type FeedFilter = "all" | "unread" | "urgent" | "archived";

type FeedRow = {
  id: string;
  title: string;
  body: string;
  priority: Priority;
  created_at: string;
  edited_at: string | null;
  post_targets: { store_id: string }[];
  post_reads: { user_id: string }[];
  thread_messages: { created_at: string }[];
  post_archives: { archived_at: string }[];
};

/** Archived only if nothing new has been said since — a new reply brings it back. */
function isArchived(archives: { archived_at: string }[], replies: { created_at: string }[]) {
  const archivedAt = archives[0]?.archived_at;
  if (!archivedAt) return false;
  const at = Date.parse(archivedAt);
  return replies.every((r) => Date.parse(r.created_at) <= at);
}

/**
 * Priority first, then newest. RLS scopes the rows: a store manager only gets
 * posts sent to their store, their own read receipt, and replies they may see.
 */
export async function listFeed(viewer: Viewer, filter: FeedFilter = "all"): Promise<FeedItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, title, body, priority, created_at, edited_at, post_targets(store_id), post_reads(user_id), thread_messages!thread_messages_post_id_fkey(created_at), post_archives(archived_at)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  const items = (data as FeedRow[])
    .map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      priority: p.priority,
      createdAt: p.created_at,
      edited: p.edited_at !== null,
      replies: p.thread_messages.length,
      seen: p.post_reads.some((r) => r.user_id === viewer.id),
      seenCount: p.post_reads.length,
      targetCount: p.post_targets.length,
      archived: isArchived(p.post_archives, p.thread_messages),
    }))
    // Stable sort keeps newest-first within each priority.
    .sort((a, b) => PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank);

  const isRM = viewer.role === "regional_manager";
  if (filter === "archived") return items.filter((i) => i.archived);
  const live = items.filter((i) => !i.archived);
  if (filter === "urgent") return live.filter((i) => i.priority === "urgent");
  if (filter === "unread") return live.filter((i) => (isRM ? i.seenCount < i.targetCount : !i.seen));
  return live;
}

export async function countUnread(viewer: Viewer) {
  const items = await listFeed(viewer, "unread");
  return items.length;
}

export type PostRecipient = { storeId: string; storeName: string; seenAt: string | null };

export type PostDetail = {
  id: string;
  title: string;
  body: string;
  priority: Priority;
  repliesShared: boolean;
  createdAt: string;
  editedAt: string | null;
  authorName: string;
  recipients: PostRecipient[];
  seenByMe: boolean;
  archivedByMe: boolean;
};

export async function getPost(id: string, viewer: Viewer): Promise<PostDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, title, body, priority, replies_shared, created_at, edited_at, profiles!posts_author_id_fkey(full_name), post_targets(store_id, stores(name)), post_reads(user_id, seen_at, profiles!post_reads_user_id_fkey(store_id)), post_archives(archived_at), thread_messages!thread_messages_post_id_fkey(created_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error?.code === "22P02") return null;
  if (error) throw error;
  if (!data) return null;

  const reads = data.post_reads as unknown as { user_id: string; seen_at: string; profiles: { store_id: string | null } }[];
  const seenByStore = new Map(reads.map((r) => [r.profiles?.store_id, r.seen_at]));
  const targets = data.post_targets as unknown as { store_id: string; stores: { name: string } | null }[];

  return {
    id: data.id,
    title: data.title,
    body: data.body,
    priority: data.priority as Priority,
    repliesShared: data.replies_shared,
    createdAt: data.created_at,
    editedAt: data.edited_at,
    authorName: (data.profiles as unknown as { full_name: string } | null)?.full_name ?? "Regional Manager",
    recipients: targets
      .map((t) => ({ storeId: t.store_id, storeName: t.stores?.name ?? "Store", seenAt: seenByStore.get(t.store_id) ?? null }))
      .sort((a, b) => a.storeName.localeCompare(b.storeName)),
    seenByMe: reads.some((r) => r.user_id === viewer.id),
    archivedByMe: isArchived(
      data.post_archives as { archived_at: string }[],
      data.thread_messages as { created_at: string }[],
    ),
  };
}

export type ThreadMessage = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorIsRM: boolean;
  storeId: string | null;
  storeName: string | null;
  parentId: string | null;
  timeLabel: string;
};

export async function getThread(postId: string): Promise<ThreadMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("thread_messages")
    .select("id, body, created_at, author_id, store_id, parent_id, profiles!thread_messages_author_id_fkey(full_name, role), stores!thread_messages_store_id_fkey(name)")
    .eq("post_id", postId)
    .order("created_at");
  if (error) throw error;

  return data.map((m) => {
    const author = m.profiles as unknown as { full_name: string; role: string } | null;
    const store = m.stores as unknown as { name: string } | null;
    return {
      id: m.id,
      body: m.body,
      createdAt: m.created_at,
      authorId: m.author_id,
      authorName: author?.full_name ?? "Unknown",
      authorIsRM: author?.role === "regional_manager",
      storeId: m.store_id,
      storeName: store?.name ?? null,
      parentId: m.parent_id,
      timeLabel: shortTime(m.created_at),
    };
  });
}

export type ReactionSummary = { emoji: string; count: number; mine: boolean; names: string[] };
/** Keyed by "post" for the post itself, or by thread message id. */
export type ReactionMap = Record<string, ReactionSummary[]>;

type ReactionRow = {
  emoji: string;
  user_id: string;
  post_id: string | null;
  thread_message_id: string | null;
  profiles: { full_name: string; role: string } | null;
  stores: { name: string } | null;
};

/** Reactions on a post and on its replies, grouped by target then emoji. RLS filters visibility. */
export async function getReactions(postId: string, messageIds: string[], viewer: Viewer): Promise<ReactionMap> {
  const supabase = await createClient();
  const select =
    "emoji, user_id, post_id, thread_message_id, created_at, profiles!reactions_user_id_fkey(full_name, role), stores!reactions_store_id_fkey(name)";
  const filter =
    messageIds.length > 0 ? `post_id.eq.${postId},thread_message_id.in.(${messageIds.join(",")})` : `post_id.eq.${postId}`;
  const { data, error } = await supabase.from("reactions").select(select).or(filter).order("created_at");
  if (error) throw error;

  const map: ReactionMap = {};
  for (const r of data as unknown as ReactionRow[]) {
    const key = r.post_id ? "post" : r.thread_message_id!;
    const list = (map[key] ??= []);
    let entry = list.find((e) => e.emoji === r.emoji);
    if (!entry) list.push((entry = { emoji: r.emoji, count: 0, mine: false, names: [] }));
    entry.count++;
    if (r.user_id === viewer.id) entry.mine = true;
    entry.names.push(r.profiles?.role === "regional_manager" ? r.profiles.full_name : (r.stores?.name ?? r.profiles?.full_name ?? "Someone"));
  }
  return map;
}
