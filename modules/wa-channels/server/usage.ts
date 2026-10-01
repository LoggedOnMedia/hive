import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { SANDBOX, waConfig } from "../config";

// Usage is always logged; the Sandbox caps only apply when WA_PLAN=sandbox.

const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

export async function bumpUsage({ requests = 0, messages = 0 }: { requests?: number; messages?: number }) {
  await createAdminClient().rpc("wa_bump_usage", { p_requests: requests, p_messages: messages });
}

export type Usage = {
  plan: "sandbox" | "premium";
  requestsThisMonth: number;
  messagesToday: number;
  /** Distinct channels posted to this month (Sandbox "active conversations"). */
  channelsThisMonth: string[];
};

export async function getUsage(): Promise<Usage> {
  const admin = createAdminClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const [{ data: rows }, { data: sent }] = await Promise.all([
    admin.from("wa_usage").select("period, request_count, message_count").in("period", [monthKey(now), dayKey(now)]),
    admin.from("wa_post_targets").select("channel_id").eq("status", "sent").gte("sent_at", monthStart),
  ]);
  const month = rows?.find((r) => r.period === monthKey(now));
  const day = rows?.find((r) => r.period === dayKey(now));
  return {
    plan: waConfig.plan(),
    requestsThisMonth: month?.request_count ?? 0,
    messagesToday: day?.message_count ?? 0,
    channelsThisMonth: [...new Set((sent ?? []).map((s) => s.channel_id))],
  };
}

/**
 * Whether `count` more sends to `channelIds` fit inside the Sandbox caps.
 * Returns a message explaining the block, or null when allowed.
 */
export function sandboxBlock(u: Usage, count: number, channelIds: string[]): string | null {
  if (u.plan !== "sandbox") return null;
  if (u.requestsThisMonth + count > SANDBOX.requestsBlockAt) {
    return `Sandbox limit: ${u.requestsThisMonth} of ${SANDBOX.requestsPerMonth} API requests used this month — sending is blocked at ${SANDBOX.requestsBlockAt}. Upgrade the Whapi plan or wait for next month.`;
  }
  if (u.messagesToday + count > SANDBOX.messagesBlockAt) {
    return `Sandbox limit: ${u.messagesToday} of ${SANDBOX.messagesPerDay} messages sent today — sending is blocked at ${SANDBOX.messagesBlockAt}. Try again tomorrow (UTC).`;
  }
  const channels = new Set([...u.channelsThisMonth, ...channelIds]);
  if (channels.size > SANDBOX.conversationsPerMonth) {
    return `Sandbox limit: posting here would reach ${channels.size} channels this month, but the Sandbox allows ${SANDBOX.conversationsPerMonth} active conversations a month. Pick channels already posted to this month, or upgrade the Whapi plan.`;
  }
  return null;
}

export function sandboxWarning(u: Usage): string | null {
  if (u.plan !== "sandbox") return null;
  if (u.requestsThisMonth >= SANDBOX.requestsWarnAt) {
    return `${u.requestsThisMonth} of ${SANDBOX.requestsPerMonth} Sandbox API requests used this month — sending stops at ${SANDBOX.requestsBlockAt}.`;
  }
  return null;
}
