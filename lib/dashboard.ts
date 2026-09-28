import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PRIORITY_META, type Priority } from "@/lib/priority";

// Everything the regional manager's dashboard shows is derived from one pass
// over posts → recipients → reads/downloads/replies. At Hive's size (tens of
// stores, hundreds of posts) doing this in memory is simpler than SQL views.

type Row = {
  id: string;
  title: string;
  priority: Priority;
  created_at: string;
  post_targets: { store_id: string }[];
  post_reads: { seen_at: string; profiles: { store_id: string | null } | null }[];
  assets: {
    id: string;
    name: string;
    downloadable: boolean;
    kind: string;
    expires_at: string | null;
    asset_downloads: { store_id: string | null; downloaded_at: string }[];
  }[];
  thread_messages: { store_id: string | null; created_at: string; profiles: { role: string } | null }[];
};

export type Cell = {
  storeId: string;
  seenAt: string | null;
  filesDone: number;
  filesTotal: number;
  replied: boolean;
};

export type DashPost = {
  id: string;
  title: string;
  priority: Priority;
  createdAt: string;
  cells: Map<string, Cell>;
  openedCount: number;
  targetCount: number;
};

export type StoreRow = {
  id: string;
  name: string;
  managerName: string | null;
  received: number;
  opened: number;
  filesDone: number;
  filesTotal: number;
  waitingPriority: number;
  lastActive: string | null;
};

export type Attention =
  | { kind: "unopened"; postId: string; title: string; priority: Priority; createdAt: string; stores: string[] }
  | { kind: "expiring"; postId: string; title: string; assetName: string; expiresAt: string; stores: string[] };

export type Dashboard = {
  stores: StoreRow[];
  posts: DashPost[];
  attention: Attention[];
  kpis: { sent30: number; pairs: number; opened: number; files: number; filesDone: number };
};

const DAY = 86_400_000;

export async function getDashboard(now = Date.now()): Promise<Dashboard> {
  const supabase = await createClient();
  const [{ data: storeData, error: sErr }, { data, error }] = await Promise.all([
    supabase.from("stores").select("id, name, profiles!profiles_store_id_fkey(full_name, role)").order("name"),
    supabase
      .from("posts")
      .select(
        `id, title, priority, created_at,
         post_targets(store_id),
         post_reads(seen_at, profiles!post_reads_user_id_fkey(store_id)),
         assets(id, name, kind, downloadable, expires_at, asset_downloads(store_id, downloaded_at)),
         thread_messages!thread_messages_post_id_fkey(store_id, created_at, profiles!thread_messages_author_id_fkey(role))`,
      )
      .order("created_at", { ascending: false }),
  ]);
  if (sErr) throw sErr;
  if (error) throw error;

  const storeName = new Map(storeData.map((s) => [s.id, s.name]));
  const stores = new Map<string, StoreRow>(
    storeData.map((s) => {
      const manager = (s.profiles as { full_name: string; role: string }[]).find((p) => p.role === "store_manager");
      return [
        s.id,
        { id: s.id, name: s.name, managerName: manager?.full_name ?? null, received: 0, opened: 0, filesDone: 0, filesTotal: 0, waitingPriority: 0, lastActive: null },
      ];
    }),
  );
  const touch = (storeId: string, at: string) => {
    const s = stores.get(storeId);
    if (s && (!s.lastActive || Date.parse(at) > Date.parse(s.lastActive))) s.lastActive = at;
  };

  const posts: DashPost[] = [];
  const attention: Attention[] = [];
  const kpis = { sent30: 0, pairs: 0, opened: 0, files: 0, filesDone: 0 };

  for (const p of data as unknown as Row[]) {
    const recent = now - Date.parse(p.created_at) < 30 * DAY;
    if (recent) kpis.sent30++;

    const seen = new Map<string, string>();
    for (const r of p.post_reads) if (r.profiles?.store_id) seen.set(r.profiles.store_id, r.seen_at);
    const downloadable = p.assets.filter((a) => a.downloadable);

    const cells = new Map<string, Cell>();
    for (const { store_id } of p.post_targets) {
      const got = downloadable.filter((a) => a.asset_downloads.some((d) => d.store_id === store_id));
      const cell: Cell = {
        storeId: store_id,
        seenAt: seen.get(store_id) ?? null,
        filesDone: got.length,
        filesTotal: downloadable.length,
        replied: p.thread_messages.some((m) => m.store_id === store_id && m.profiles?.role === "store_manager"),
      };
      cells.set(store_id, cell);

      const s = stores.get(store_id);
      if (s) {
        s.received++;
        if (cell.seenAt) s.opened++;
        s.filesTotal += cell.filesTotal;
        s.filesDone += cell.filesDone;
        if (!cell.seenAt && PRIORITY_META[p.priority].rank <= 1) s.waitingPriority++;
      }
      if (recent) {
        kpis.pairs++;
        if (cell.seenAt) kpis.opened++;
        kpis.files += cell.filesTotal;
        kpis.filesDone += cell.filesDone;
      }
    }

    // Last activity per store: opens, downloads, replies.
    for (const [storeId, at] of seen) touch(storeId, at);
    for (const a of p.assets) for (const d of a.asset_downloads) if (d.store_id) touch(d.store_id, d.downloaded_at);
    for (const m of p.thread_messages) if (m.store_id && m.profiles?.role === "store_manager") touch(m.store_id, m.created_at);

    const unopened = [...cells.values()].filter((c) => !c.seenAt).map((c) => storeName.get(c.storeId) ?? "Store");
    if (unopened.length > 0 && PRIORITY_META[p.priority].rank <= 1) {
      attention.push({ kind: "unopened", postId: p.id, title: p.title, priority: p.priority, createdAt: p.created_at, stores: unopened });
    }

    // Links that stop working within 3 days while some stores still don't have them.
    for (const a of downloadable) {
      if (a.kind !== "link" || !a.expires_at) continue;
      const left = Date.parse(a.expires_at) - now;
      if (left < 0 || left > 3 * DAY) continue;
      const missing = [...cells.values()]
        .filter((c) => !a.asset_downloads.some((d) => d.store_id === c.storeId))
        .map((c) => storeName.get(c.storeId) ?? "Store");
      if (missing.length > 0) {
        attention.push({ kind: "expiring", postId: p.id, title: p.title, assetName: a.name, expiresAt: a.expires_at, stores: missing });
      }
    }

    posts.push({
      id: p.id,
      title: p.title,
      priority: p.priority,
      createdAt: p.created_at,
      cells,
      openedCount: [...cells.values()].filter((c) => c.seenAt).length,
      targetCount: cells.size,
    });
  }

  // Expiring links first (they have a deadline), then by priority, then oldest.
  attention.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "expiring" ? -1 : 1;
    if (a.kind === "expiring" && b.kind === "expiring") return Date.parse(a.expiresAt) - Date.parse(b.expiresAt);
    if (a.kind === "unopened" && b.kind === "unopened") {
      return PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank || Date.parse(a.createdAt) - Date.parse(b.createdAt);
    }
    return 0;
  });

  return { stores: [...stores.values()], posts, attention, kpis };
}

export type StoreHistoryItem = {
  postId: string;
  title: string;
  priority: Priority;
  createdAt: string;
  cell: Cell;
};

/** One store's view of every message sent to it, newest first. */
export function storeHistory(d: Dashboard, storeId: string): StoreHistoryItem[] {
  return d.posts.flatMap((p) => {
    const cell = p.cells.get(storeId);
    return cell ? [{ postId: p.id, title: p.title, priority: p.priority, createdAt: p.createdAt, cell }] : [];
  });
}
