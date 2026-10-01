import "server-only";
import { waConfig } from "../config";
import { bumpUsage } from "./usage";

// The ONLY file that talks to the WhatsApp provider. Switching to WAHA,
// Evolution API, Wassenger etc. means rewriting this file and nothing else.
// Docs: https://whapi.readme.io — channels are "newsletters" with ids like
// 120363171744447809@newsletter.

export type ProviderChannel = { id: string; name: string; role: string };

export type SendResult =
  | { ok: true; messageId: string | null }
  | { ok: false; kind: "unauthorized" | "rate_limited" | "client" | "network"; status?: number; error: string };

class WhapiError extends Error {
  constructor(
    public kind: "unauthorized" | "rate_limited" | "client" | "network",
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

async function call(path: string, init: RequestInit = {}, attempt = 1): Promise<unknown> {
  let res: Response;
  try {
    // Every request counts against the Sandbox monthly quota, success or not.
    await bumpUsage({ requests: 1 });
    res = await fetch(`${waConfig.base()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${waConfig.token()}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init.headers,
      },
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
  } catch (e) {
    // Network failure: retry once, never more.
    if (attempt === 1) return call(path, init, 2);
    throw new WhapiError("network", (e as Error).message || "Network error");
  }

  const body = await res.json().catch(() => ({}));
  if (res.ok) return body;

  const message =
    (body as { error?: { message?: string } })?.error?.message ??
    (body as { message?: string })?.message ??
    `WhatsApp provider answered ${res.status}`;
  if (res.status === 401) throw new WhapiError("unauthorized", message, 401);
  if (res.status === 429) throw new WhapiError("rate_limited", message, 429);
  // 5xx is the provider's side: treat like a network blip (one retry). 4xx is ours: no retry.
  if (res.status >= 500) {
    if (attempt === 1) return call(path, init, 2);
    throw new WhapiError("network", message, res.status);
  }
  throw new WhapiError("client", message, res.status);
}

/** Channels the linked number owns or administers (only those can be posted to). */
export async function listAdminChannels(): Promise<ProviderChannel[]> {
  const data = (await call("/newsletters?count=500")) as {
    newsletters?: { id: string; name?: string; role?: string }[];
  };
  return (data.newsletters ?? [])
    .filter((n) => n.role === "owner" || n.role === "admin")
    .map((n) => ({ id: n.id, name: n.name || n.id, role: n.role ?? "" }));
}

/**
 * Posts to one channel. `imageUrl` is a short-lived HTTPS URL the provider
 * downloads the image from; without it, a text post is sent.
 */
export async function postToChannel(channelId: string, caption: string, imageUrl?: string | null): Promise<SendResult> {
  try {
    const data = (await call(imageUrl ? "/messages/image" : "/messages/text", {
      method: "POST",
      body: JSON.stringify(
        imageUrl ? { to: channelId, media: imageUrl, caption: caption || undefined } : { to: channelId, body: caption },
      ),
    })) as { message?: { id?: string }; id?: string };
    await bumpUsage({ messages: 1 });
    return { ok: true, messageId: data.message?.id ?? data.id ?? null };
  } catch (e) {
    if (e instanceof WhapiError) return { ok: false, kind: e.kind, status: e.status, error: e.message };
    return { ok: false, kind: "network", error: (e as Error).message };
  }
}

export { WhapiError };
