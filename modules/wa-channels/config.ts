import "server-only";

// All wa-channels settings come from WA_* env vars, read only on the server.

export function waEnabled() {
  return process.env.WA_CHANNELS_ENABLED === "true";
}

export const waConfig = {
  token: () => process.env.WA_API_TOKEN ?? "",
  base: () => (process.env.WA_API_BASE || "https://gate.whapi.cloud").replace(/\/+$/, ""),
  plan: (): "sandbox" | "premium" => (process.env.WA_PLAN === "premium" ? "premium" : "sandbox"),
  cronSecret: () => process.env.WA_CRON_SECRET ?? "",
  /**
   * Random gap between consecutive channel posts. WA_SEND_DELAY_SECONDS is
   * "min-max" (e.g. "10-20") or a single number. Whapi suggests 10–30 s for
   * channels, so 10–20 is the default.
   */
  sendGapSeconds: () => {
    const raw = process.env.WA_SEND_DELAY_SECONDS || "10-20";
    const [a, b] = raw.split("-").map((n) => Number.parseInt(n, 10));
    const min = Number.isFinite(a) ? Math.max(1, a) : 10;
    const max = Number.isFinite(b) ? Math.max(min, b) : min;
    return Math.round(min + Math.random() * (max - min));
  },
};

/** Whapi Sandbox limits (whapi.cloud/price), with the safety margins from the spec. */
export const SANDBOX = {
  requestsPerMonth: 1000,
  requestsWarnAt: 800,
  requestsBlockAt: 980,
  messagesPerDay: 150,
  messagesBlockAt: 145,
  // "Up to 5 active conversations per month" — each channel posted to counts as one.
  conversationsPerMonth: 5,
};

/** Media WhatsApp accepts for channel posts: images and MP4 video, 16 MB each. */
export const MEDIA = {
  maxBytes: 16 * 1024 * 1024,
  types: ["image/jpeg", "image/png", "video/mp4"],
  /** Items per post; each goes out as its own channel post. */
  maxItems: 10,
  /** WhatsApp caps captions on media at 1,024 characters; longer text goes as its own post. */
  captionMax: 1024,
  /** Pause between the items of one post on the same channel, to keep them in order. */
  itemGapMs: 2000,
};
