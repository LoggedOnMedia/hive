import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEDIA, waConfig } from "../config";
import { buildParts, type MediaItem } from "./parts";
import { getUsage, sandboxBlock } from "./usage";
import { postToChannel } from "./whapi";

// Background sender. Called every minute by the Supabase cron ping
// (/api/wa/tick) and straight after "Post now". Sends one channel at a time
// with a random gap between channels; the database hands out targets and
// reserves send slots (wa_claim_next), so overlapping runs can't double-send.
//
// A post can be several parts (images/videos, caption on the last). Each
// channel gets its parts in order, 2 s apart; progress is saved after every
// part (parts_sent) so a retry carries on instead of re-sending.

type Claim = {
  target_id: string | null;
  post_id: string | null;
  channel_id: string | null;
  whapi_channel_id: string | null;
  caption: string | null;
  media_path: string | null;
  media_mime: string | null;
  wait_seconds: number | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Rough time one part takes (request + in-channel gap), for budgeting. */
const PART_MS = 6_000;

export type TickResult = { sent: number; failed: number; stopped?: string };

export async function runTick(budgetMs = 100_000): Promise<TickResult> {
  const admin = createAdminClient();
  const started = Date.now();
  const result: TickResult = { sent: 0, failed: 0 };
  const left = () => budgetMs - (Date.now() - started);

  // Sends that were claimed but never finished get marked failed (not resent).
  if ((await admin.rpc("wa_fail_stale_sends")).data) await refreshOpenPosts();

  while (left() > 0) {
    const { data, error } = await admin.rpc("wa_claim_next", { p_gap_seconds: waConfig.sendGapSeconds() });
    if (error) return { ...result, stopped: error.message };
    const claim = (data as Claim[] | null)?.[0];
    if (!claim) break; // nothing due, or paused / backing off

    if (!claim.target_id) {
      const wait = (claim.wait_seconds ?? 5) * 1000;
      // Leave room for at least one send after waiting; otherwise the next run picks it up.
      if (wait > left() - 15_000) break;
      await sleep(wait);
      continue;
    }

    const release = (patch: Record<string, unknown> = {}) =>
      admin.from("wa_post_targets").update({ status: "pending", claimed_at: null, ...patch }).eq("id", claim.target_id!);

    const [{ data: media }, { data: target }] = await Promise.all([
      admin.from("wa_post_media").select("path, mime").eq("post_id", claim.post_id!).order("sort_order"),
      admin.from("wa_post_targets").select("parts_sent").eq("id", claim.target_id).single(),
    ]);
    const items: MediaItem[] = media?.length
      ? media
      : claim.media_path
        ? [{ path: claim.media_path, mime: claim.media_mime ?? "image/jpeg" }] // legacy single-image posts
        : [];
    const parts = buildParts(claim.caption ?? "", items);
    const from = target?.parts_sent ?? 0;
    const remaining = parts.slice(from);

    if (remaining.length === 0) {
      await finish(claim, { status: "sent", sent_at: new Date().toISOString(), error: null });
      result.sent++;
      continue;
    }
    // Not enough time left in this run to finish this channel: hand it to the next run.
    if (remaining.length * PART_MS + 5_000 > left()) {
      await release();
      break;
    }

    const usage = await getUsage();
    const blocked = sandboxBlock(usage, remaining.length, [claim.channel_id!]);
    if (blocked) {
      // Put it back; it goes out when the quota allows (or the plan is upgraded).
      await release({ error: blocked });
      return { ...result, stopped: blocked };
    }

    let outcome: "sent" | "failed" | "stop" = "sent";
    let stopReason: string | undefined;
    let lastMessageId: string | null = null;

    for (let i = from; i < parts.length; i++) {
      const part = parts[i];
      if (i > from) await sleep(MEDIA.itemGapMs);
      const label = parts.length > 1 ? `Part ${i + 1} of ${parts.length}: ` : "";

      let media = null;
      if (part.path) {
        const { data: signed } = await admin.storage.from("wa-media").createSignedUrl(part.path, 60 * 15);
        if (!signed?.signedUrl) {
          await admin.from("wa_post_targets").update({ status: "failed", error: `${label}the file is missing from storage` }).eq("id", claim.target_id);
          outcome = "failed";
          break;
        }
        media = { url: signed.signedUrl, kind: part.kind as "image" | "video" };
      }

      const sent = await postToChannel(claim.whapi_channel_id!, part.caption, media);
      if (sent.ok) {
        lastMessageId = sent.messageId;
        await admin.from("wa_post_targets").update({ parts_sent: i + 1, whapi_message_id: sent.messageId }).eq("id", claim.target_id);
        continue;
      }

      if (sent.kind === "unauthorized") {
        // Session dropped or token invalid: stop everything until someone re-scans.
        await release();
        await admin
          .from("wa_state")
          .update({ paused: true, paused_reason: "WhatsApp disconnected — re-scan the QR code in the Whapi dashboard, then press Resume." })
          .eq("id", 1);
        outcome = "stop";
        stopReason = "unauthorized";
        break;
      }
      if (sent.kind === "rate_limited") {
        // WhatsApp back-pressure: back off for 10 minutes and carry on from this part then.
        await release();
        await admin
          .from("wa_state")
          .update({ backoff_until: new Date(Date.now() + 10 * 60_000).toISOString() })
          .eq("id", 1);
        outcome = "stop";
        stopReason = "rate_limited";
        break;
      }
      // 4xx, or a network failure that already had its one retry.
      await admin.from("wa_post_targets").update({ status: "failed", error: label + sent.error }).eq("id", claim.target_id);
      outcome = "failed";
      break;
    }

    // The gap to the next channel counts from when this one finished (database clock).
    await admin.rpc("wa_mark_sent");

    if (outcome === "sent") {
      await finish(claim, { status: "sent", sent_at: new Date().toISOString(), error: null, whapi_message_id: lastMessageId });
      result.sent++;
    } else if (outcome === "failed") {
      await admin.rpc("wa_refresh_post_status", { p_post_id: claim.post_id! });
      result.failed++;
    } else {
      return { ...result, stopped: stopReason };
    }
  }
  return result;
}

async function finish(claim: Claim, patch: Record<string, unknown>) {
  const admin = createAdminClient();
  await admin.from("wa_post_targets").update(patch).eq("id", claim.target_id!);
  await admin.rpc("wa_refresh_post_status", { p_post_id: claim.post_id! });
}

async function refreshOpenPosts() {
  const admin = createAdminClient();
  const { data } = await admin.from("wa_posts").select("id").eq("status", "sending");
  for (const p of data ?? []) await admin.rpc("wa_refresh_post_status", { p_post_id: p.id });
}
