import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Every attachment open goes through here: check the viewer may see it (RLS),
 * log the download for store managers, then send them on — to a short-lived
 * signed URL for uploaded files, or to the external link.
 *
 * `?view=1` opens a file inline instead of downloading it (not logged).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/a/[id]">) {
  const { id } = await ctx.params;
  const view = request.nextUrl.searchParams.get("view") === "1";
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: asset } = await supabase
    .from("assets")
    .select("id, post_id, kind, name, storage_path, url, expires_at, downloadable")
    .eq("id", id)
    .maybeSingle();
  if (!asset) return new NextResponse("Not found", { status: 404 });

  const back = new URL(`/feed/${asset.post_id}`, request.url);
  if (asset.kind === "link" && asset.expires_at && Date.parse(asset.expires_at) < Date.now()) {
    back.searchParams.set("expired", asset.id);
    return NextResponse.redirect(back);
  }
  if (!asset.downloadable && !view) return NextResponse.redirect(back);

  if (!view) {
    const { data: profile } = await supabase.from("profiles").select("role, store_id").eq("id", auth.user.id).single();
    if (profile?.role === "store_manager") {
      await supabase
        .from("asset_downloads")
        .insert({ asset_id: asset.id, user_id: auth.user.id, store_id: profile.store_id });
    }
  }

  if (asset.kind === "link") return NextResponse.redirect(asset.url!);

  // Access was checked above through RLS; the secret key only signs the URL.
  const { data: signed, error } = await createAdminClient()
    .storage.from("assets")
    .createSignedUrl(asset.storage_path!, 60, view ? undefined : { download: asset.name });
  if (error || !signed) return new NextResponse("File unavailable", { status: 502 });
  return NextResponse.redirect(signed.signedUrl);
}
