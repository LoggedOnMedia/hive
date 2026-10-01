import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { waConfig } from "../config";
import { getUsage, sandboxBlock } from "./usage";
import { postToChannel } from "./whapi";

// Background sender. Called every minute by the Supabase cron ping
// (/api/wa/tick) and straight after "Post now". Sends one channel at a time
// with a random gap between sends; the database hands out targets and
// reserves send slots (wa_claim_next), so overlapping runs can't double-send.

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

export type TickResult = { sent: number; failed: number; stopped?: string };

export async function runTick(budgetMs = 45_000): Promise<TickResult> {
  const admin = createAdminClient();
  const started = Date.now();
  const result: TickResult = { sent: 0, failed: 0 };

  // Sends that were claimed but never finished get marked failed (not resent).
  if ((await admin.rpc("wa_fail_stale_sends")).data) await refreshOpenPosts();

  while (Date.now() - started < budgetMs) {
    const { data, error } = await admin.rpc("wa_claim_next", { p_gap_seconds: waConfig.sendGapSeconds() });
    if (error) return { ...result, stopped: error.message };
    const claim = (data as Claim[] | null)?.[0];
    if (!claim) break; // nothing due, or paused / backing off

    if (!claim.target_id) {
      const wait = (claim.wait_seconds ?? 5) * 1000;
      // Leave ~15 s of budget for the send itself; otherwise the next run picks it up.
      if (Date.now() - started + wait > budgetMs - 15_000) break;
      await sleep(wait);
      continue;
    }

    const usage = await getUsage();
    const blocked = sandboxBlock(usage, 1, [claim.channel_id!]);
    if (blocked) {
      // Put it back; it goes out when the quota allows (or the plan is upgraded).
      await admin.from("wa_post_targets").update({ status: "pending", claimed_at: null, error: blocked }).eq("id", claim.target_id);
      return { ...result, stopped: blocked };
    }

    let imageUrl: string | null = null;
    if (claim.media_path) {
      const { data: signed } = await admin.storage.from("wa-media").createSignedUrl(claim.media_path, 60 * 15);
      imageUrl = signed?.signedUrl ?? null;
      if (!imageUrl) {
        await finish(claim, { status: "failed", error: "The image is missing from storage" });
        result.failed++;
        continue;
      }
    }

    const sent = await postToChannel(claim.whapi_channel_id!, claim.caption ?? "", imageUrl);
    // The gap to the next send counts from when this one finished, not when it was claimed,
    // so a slow request can't squeeze the next post closer than the configured gap.
    await admin.rpc("wa_mark_sent");
    if (sent.ok) {
      await finish(claim, { status: "sent", whapi_message_id: sent.messageId, sent_at: new Date().toISOString(), error: null });
      result.sent++;
      continue;
    }

    if (sent.kind === "unauthorized") {
      // Session dropped or token invalid: stop everything until someone re-scans.
      await admin.from("wa_post_targets").update({ status: "pending", claimed_at: null }).eq("id", claim.target_id);
      await admin
        .from("wa_state")
        .update({ paused: true, paused_reason: "WhatsApp disconnected — re-scan the QR code in the Whapi dashboard, then press Resume." })
        .eq("id", 1);
      return { ...result, stopped: "unauthorized" };
    }
    if (sent.kind === "rate_limited") {
      // WhatsApp back-pressure: back off for 10 minutes and try this one again then.
      await admin.from("wa_post_targets").update({ status: "pending", claimed_at: null }).eq("id", claim.target_id);
      await admin
        .from("wa_state")
        .update({ backoff_until: new Date(Date.now() + 10 * 60_000).toISOString() })
        .eq("id", 1);
      return { ...result, stopped: "rate_limited" };
    }
    // 4xx or a network failure that already had its one retry.
    await finish(claim, { status: "failed", error: sent.error });
    result.failed++;
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
