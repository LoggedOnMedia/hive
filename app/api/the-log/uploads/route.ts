import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { MAX_UPLOAD_BYTES } from "@/lib/assets";
import { createAdminClient } from "@/lib/supabase/admin";
import { bad, checkTheLogAuth } from "@/lib/the-log";

const safeName = (name: string) => name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-120) || "file";

/**
 * POST { files: [{ name, size, type }] } → one-time upload URLs, so the
 * designer's browser uploads straight into Hive's storage (files never pass
 * through Vercel, which caps request bodies at ~4.5 MB).
 */
export async function POST(request: NextRequest) {
  const denied = checkTheLogAuth(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const files = Array.isArray(body?.files) ? body.files : null;
  if (!files || files.length === 0 || files.length > 20) return bad("Send between 1 and 20 files");

  for (const f of files) {
    if (typeof f?.name !== "string" || !f.name.trim()) return bad("Every file needs a name");
    if (typeof f.size !== "number" || f.size <= 0) return bad(`"${f.name}" is empty`);
    if (f.size > MAX_UPLOAD_BYTES) return bad(`"${f.name}" is over 50 MB — add it as a SwissTransfer link instead`);
  }

  const storage = createAdminClient().storage.from("assets");
  const uploads = [];
  for (const f of files) {
    const path = `uploads/the-log-${randomUUID()}/${safeName(f.name)}`;
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: error?.message ?? "Couldn't prepare the upload" }, { status: 500 });
    uploads.push({ name: f.name, path, upload_url: data.signedUrl });
  }
  return NextResponse.json({ uploads });
}
