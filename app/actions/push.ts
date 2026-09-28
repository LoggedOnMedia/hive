"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { pushConfigured, sendPushToUsers } from "@/lib/push";
import { getViewer } from "@/lib/viewer";

type SubscriptionJSON = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/**
 * Links this device's push subscription to the signed-in user. Called when
 * notifications are turned on, and on every visit, so a device someone else
 * used before is handed over to whoever is signed in now.
 */
export async function saveSubscription(sub: SubscriptionJSON, userAgent: string) {
  const viewer = await getViewer();
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "The browser didn't return a valid subscription." };

  // The secret key is needed to see a row owned by someone else. The endpoint
  // comes from this browser's own subscription, so only this device is touched.
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("push_subscriptions")
    .select("id, user_id")
    .eq("endpoint", sub.endpoint)
    .maybeSingle();

  if (existing?.user_id === viewer.id) return { ok: true };

  const row = { user_id: viewer.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent.slice(0, 300) };
  const { error } = existing
    ? await admin.from("push_subscriptions").update(row).eq("id", existing.id)
    : await (await createClient()).from("push_subscriptions").insert({ ...row, endpoint: sub.endpoint });
  return error ? { error: error.message } : { ok: true };
}

export async function removeSubscription(endpoint: string) {
  await getViewer();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true };
}

/** Sends a test notification to all of the viewer's devices. */
export async function sendTestPush() {
  const viewer = await getViewer();
  if (!pushConfigured()) return { error: "Notifications aren't set up on the server yet." };
  const { sent } = await sendPushToUsers([viewer.id], {
    title: "Hive notifications are on 🐝",
    body: "This is what new messages will look like.",
    url: "/settings",
    tag: "test",
  });
  return sent > 0 ? { ok: true } : { error: "No devices are registered for notifications yet." };
}
