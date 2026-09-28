// Shared between client and server: the shape of an attachment on its way
// into create_post, and small display helpers.

export type AssetInput =
  | {
      kind: "file";
      name: string;
      storage_path: string;
      mime_type: string;
      size_bytes: number;
      downloadable: boolean;
    }
  | {
      kind: "link";
      name: string;
      url: string;
      expires_at: string | null;
      downloadable: true;
    };

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function formatBytes(n: number | null | undefined) {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export type FileKind = "pdf" | "image" | "link" | "other";

export function fileKind(kind: "file" | "link", mime: string | null): FileKind {
  if (kind === "link") return "link";
  if (mime === "application/pdf") return "pdf";
  if (mime?.startsWith("image/")) return "image";
  return "other";
}

/** Validates attachments arriving from the compose form. Returns an error message or null. */
export function validateAssets(assets: unknown): { assets: AssetInput[] } | { error: string } {
  if (!Array.isArray(assets)) return { error: "Attachments couldn't be read." };
  const out: AssetInput[] = [];
  for (const a of assets) {
    const name = typeof a?.name === "string" ? a.name.trim() : "";
    if (!name) return { error: "Every attachment needs a name." };
    if (a.kind === "file") {
      if (typeof a.storage_path !== "string" || !a.storage_path.startsWith("uploads/")) {
        return { error: `"${name}" didn't finish uploading.` };
      }
      out.push({
        kind: "file",
        name,
        storage_path: a.storage_path,
        mime_type: String(a.mime_type ?? ""),
        size_bytes: Number(a.size_bytes) || 0,
        downloadable: a.downloadable !== false,
      });
    } else if (a.kind === "link") {
      let url: URL;
      try {
        url = new URL(String(a.url));
      } catch {
        return { error: `"${name}": that isn't a valid link.` };
      }
      if (url.protocol !== "https:" && url.protocol !== "http:") return { error: `"${name}": links must start with https://` };
      const expires = a.expires_at ? new Date(a.expires_at) : null;
      if (expires && Number.isNaN(expires.getTime())) return { error: `"${name}": the expiry date isn't valid.` };
      out.push({ kind: "link", name, url: url.toString(), expires_at: expires?.toISOString() ?? null, downloadable: true });
    } else {
      return { error: "Unknown attachment type." };
    }
  }
  return { assets: out };
}

/** Caption for an attachment card: size for files, expiry for links. */
export function assetCaption(a: { kind: "file" | "link"; sizeBytes: number | null; expiresAt: string | null; expired: boolean }, now = Date.now()) {
  if (a.kind === "file") return formatBytes(a.sizeBytes) || "File";
  if (!a.expiresAt) return "No expiry";
  const date = new Date(a.expiresAt).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short" });
  if (a.expired) return `Link expired ${date}`;
  // Count calendar days in SA time, so "tomorrow" means tomorrow, not "within 24 hours".
  const day = (t: number) => Date.parse(new Date(t).toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" }));
  const days = Math.round((day(Date.parse(a.expiresAt)) - day(now)) / 86_400_000);
  if (days <= 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  if (days <= 3) return `Expires in ${days} days`;
  return `Expires ${date}`;
}

export function expiringSoon(a: { expiresAt: string | null; expired: boolean }, now = Date.now()) {
  return !!a.expiresAt && !a.expired && Date.parse(a.expiresAt) - now < 3 * 86_400_000;
}
