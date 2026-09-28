import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushPayload = {
  title: string;
  body: string;
  /** Page to open when tapped. */
  url: string;
  /** Notifications with the same tag replace each other (e.g. one per message). */
  tag?: string;
  /** Keeps the notification on screen until dismissed (desktop/Android). */
  urgent?: boolean;
};

let configured: boolean | null = null;

function configure() {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:eugene@loggedonmedia.com";
  configured = Boolean(publicKey && privateKey);
  if (configured) webpush.setVapidDetails(subject, publicKey!, privateKey!);
  else console.warn("[push] VAPID keys not set — notifications are off. Run `npm run setup:push`.");
  return configured;
}

export const pushConfigured = () => configure();

/**
 * Sends to every device of the given users. Uses the secret key because a
 * sender can't read other people's subscriptions. Dead subscriptions (the
 * browser uninstalled, permission revoked) are removed.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (userIds.length === 0 || !configure()) return { sent: 0, removed: 0 };
  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", [...new Set(userIds)]);
  if (error) {
    console.error("[push] couldn't load subscriptions", error.message);
    return { sent: 0, removed: 0 };
  }

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  const delivered: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          TTL: payload.urgent ? 60 * 60 * 24 : 60 * 60 * 6,
          urgency: payload.urgent ? "high" : "normal",
        });
        delivered.push(s.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
        else console.error("[push] send failed", status, (e as Error).message);
      }
    }),
  );

  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead);
  if (delivered.length) {
    await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).in("id", delivered);
  }
  return { sent: delivered.length, removed: dead.length };
}

/** Store managers of the given stores. */
async function managersOf(storeIds: string[]) {
  if (storeIds.length === 0) return [];
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id")
    .eq("role", "store_manager")
    .in("store_id", storeIds);
  return (data ?? []).map((p) => p.id);
}

async function regionalManagers() {
  const { data } = await createAdminClient().from("profiles").select("id").eq("role", "regional_manager");
  return (data ?? []).map((p) => p.id);
}

const clip = (s: string, n = 140) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/** New message → the store managers it was sent to. Low priority stays silent (feed only). */
export async function notifyNewPost(postId: string) {
  const admin = createAdminClient();
  const { data: post } = await admin
    .from("posts")
    .select("title, body, priority, sender_name, post_targets(store_id)")
    .eq("id", postId)
    .single();
  if (!post || post.priority === "low") return;

  const urgent = post.priority === "urgent";
  const from = post.sender_name ?? "Regional Manager";
  await sendPushToUsers(await managersOf((post.post_targets as { store_id: string }[]).map((t) => t.store_id)), {
    title: `${urgent ? "🔴 Urgent: " : ""}${post.title}`,
    body: clip(post.body ? `${from}: ${post.body}` : `New message from ${from}`),
    url: `/feed/${postId}`,
    tag: `post-${postId}`,
    urgent,
  });
}

/**
 * New reply. A store's reply goes to the regional manager and — on shared
 * threads — the other stores' managers. The regional manager's reply goes to
 * everyone on a shared thread, or just the one store on a private one.
 */
export async function notifyReply(postId: string, authorId: string, authorStoreId: string | null, body: string) {
  const admin = createAdminClient();
  const [{ data: post }, { data: author }] = await Promise.all([
    admin.from("posts").select("title, replies_shared, post_targets(store_id)").eq("id", postId).single(),
    admin.from("profiles").select("full_name, role, stores!profiles_store_id_fkey(name)").eq("id", authorId).single(),
  ]);
  if (!post || !author) return;

  const targets = (post.post_targets as { store_id: string }[]).map((t) => t.store_id);
  const isRM = author.role === "regional_manager";
  const who = isRM ? author.full_name : ((author.stores as unknown as { name: string } | null)?.name ?? author.full_name);

  let recipients: string[];
  if (isRM) {
    recipients = await managersOf(post.replies_shared ? targets : authorStoreId ? [authorStoreId] : []);
  } else {
    const others = post.replies_shared ? await managersOf(targets.filter((s) => s !== authorStoreId)) : [];
    recipients = [...(await regionalManagers()), ...others];
  }

  await sendPushToUsers(
    recipients.filter((id) => id !== authorId),
    { title: `${who} replied`, body: clip(`${post.title}: ${body}`), url: `/feed/${postId}`, tag: `reply-${postId}` },
  );
}
