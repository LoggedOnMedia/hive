"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { pushConfigured, sendPushToUsers } from "@/lib/push";
import { getViewer } from "@/lib/viewer";

type SubscriptionJSON = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** Saves this device's push subscription for the signed-in user. */
export async function saveSubscription(sub: SubscriptionJSON, userAgent: string) {
  const viewer = await getViewer();
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "The browser didn't return a valid subscription." };

  const supabase = await createClient();
  // A device that was subscribed by someone else (shared phone) is handed over.
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: viewer.id,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: userAgent.slice(0, 300),
  });
  if (error) {
    // Another user's row for this endpoint can't be deleted under RLS; hand it over with the secret key.
    if (error.code === "23505") {
      const admin = createAdminClient();
      await admin
        .from("push_subscriptions")
        .update({ user_id: viewer.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
        .eq("endpoint", sub.endpoint);
      return { ok: true };
    }
    return { error: error.message };
  }
  return { ok: true };
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
