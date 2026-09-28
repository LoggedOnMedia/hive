import { after, NextResponse, type NextRequest } from "next/server";
import { validateAssets } from "@/lib/assets";
import { PRIORITIES, type Priority } from "@/lib/priority";
import { notifyNewPost } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { THE_LOG_SENDER, bad, checkTheLogAuth } from "@/lib/the-log";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * POST: sends a job's artwork straight to stores, as "Logged On Media".
 * {
 *   job_ref, sent_by, title, body?, priority, replies_shared?, store_ids[],
 *   assets[]: { kind: "file", name, storage_path, mime_type, size_bytes, downloadable? }
 *           | { kind: "link", name, url, expires_at? }
 * }
 * Files must already be uploaded via /api/the-log/uploads.
 */
export async function POST(request: NextRequest) {
  const denied = checkTheLogAuth(request);
  if (denied) return denied;

  const b = await request.json().catch(() => null);
  if (!b) return bad("Body must be JSON");

  const jobRef = str(b.job_ref, 100);
  const title = str(b.title, 120);
  const sentBy = str(b.sent_by, 120) || null;
  const priority = b.priority as Priority;
  const storeIds: string[] = Array.isArray(b.store_ids) ? b.store_ids.filter((s: unknown) => typeof s === "string" && UUID.test(s)) : [];
  if (!jobRef) return bad("job_ref is required");
  if (!title) return bad("title is required");
  if (!PRIORITIES.includes(priority)) return bad("priority must be urgent, high, normal or low");
  if (storeIds.length === 0) return bad("Choose at least one store");

  const checked = validateAssets(b.assets ?? []);
  if ("error" in checked) return bad(checked.error);

  const admin = createAdminClient();

  // Every file must really be in storage — a failed upload shouldn't become a broken attachment.
  for (const a of checked.assets) {
    if (a.kind !== "file") continue;
    const dir = a.storage_path.slice(0, a.storage_path.lastIndexOf("/"));
    const file = a.storage_path.slice(a.storage_path.lastIndexOf("/") + 1);
    const { data } = await admin.storage.from("assets").list(dir, { search: file });
    if (!data?.some((o) => o.name === file)) return bad(`"${a.name}" didn't finish uploading`);
  }

  const { data: stores } = await admin.from("stores").select("id").in("id", storeIds);
  if ((stores ?? []).length !== new Set(storeIds).size) return bad("One or more stores don't exist in Hive");

  // Messages from The Log are owned by the regional manager's account (he sees
  // and manages them like his own) but show Logged On Media as the sender.
  const { data: rm } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "regional_manager")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!rm) return bad("Hive has no regional manager account yet", 409);

  const { data: postId, error } = await admin.rpc("create_external_post", {
    p_author_id: rm.id,
    p_title: title,
    p_body: str(b.body, 5000),
    p_priority: priority,
    p_replies_shared: b.replies_shared !== false,
    p_store_ids: [...new Set(storeIds)],
    p_assets: checked.assets,
    p_source: "the_log",
    p_source_ref: jobRef,
    p_sender_name: THE_LOG_SENDER,
    p_source_actor: sentBy,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  after(() => notifyNewPost(postId as string));
  return NextResponse.json({ post_id: postId, url: new URL(`/feed/${postId}`, request.url).toString() }, { status: 201 });
}

/**
 * GET ?job_ref=… : everything sent to Hive for a job, with delivery status —
 * how many stores opened it and how many downloaded all its files.
 */
export async function GET(request: NextRequest) {
  const denied = checkTheLogAuth(request);
  if (denied) return denied;

  const jobRef = request.nextUrl.searchParams.get("job_ref")?.trim();
  if (!jobRef) return bad("job_ref is required");

  const { data, error } = await createAdminClient()
    .from("posts")
    .select(
      `id, title, priority, created_at, source_actor,
       post_targets(store_id, stores(name)),
       post_reads(profiles!post_reads_user_id_fkey(store_id)),
       assets(id, downloadable, asset_downloads(store_id))`,
    )
    .eq("source", "the_log")
    .eq("source_ref", jobRef)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sends = data.map((p) => {
    const targets = p.post_targets as unknown as { store_id: string; stores: { name: string } | null }[];
    const opened = new Set(
      (p.post_reads as unknown as { profiles: { store_id: string | null } | null }[]).flatMap((r) =>
        r.profiles?.store_id ? [r.profiles.store_id] : [],
      ),
    );
    const files = (p.assets as { downloadable: boolean; asset_downloads: { store_id: string | null }[] }[]).filter(
      (a) => a.downloadable,
    );
    const downloadedAll = targets.filter(
      (t) => files.length > 0 && files.every((a) => a.asset_downloads.some((d) => d.store_id === t.store_id)),
    );
    return {
      id: p.id,
      title: p.title,
      priority: p.priority,
      sent_at: p.created_at,
      sent_by: p.source_actor,
      url: new URL(`/feed/${p.id}`, request.url).toString(),
      stores: targets.map((t) => ({
        name: t.stores?.name ?? "Store",
        opened: opened.has(t.store_id),
        downloaded: downloadedAll.some((d) => d.store_id === t.store_id),
      })),
      opened: targets.filter((t) => opened.has(t.store_id)).length,
      downloaded: files.length > 0 ? downloadedAll.length : null,
      total: targets.length,
    };
  });
  return NextResponse.json({ sends });
}
