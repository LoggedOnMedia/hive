import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bad, checkTheLogAuth } from "@/lib/the-log";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST { client_id, store_id | null }: links a Log client to a Hive store
 * (or unlinks it). A client links to at most one store and vice versa.
 */
export async function POST(request: NextRequest) {
  const denied = checkTheLogAuth(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const clientId = typeof body?.client_id === "string" ? body.client_id.trim() : "";
  const storeId = body?.store_id ?? null;
  if (!clientId || clientId.length > 100) return bad("client_id is required");
  if (storeId !== null && (typeof storeId !== "string" || !UUID.test(storeId))) return bad("store_id must be a store id or null");

  const admin = createAdminClient();
  // Clear this client from whichever store had it.
  const { error: clearError } = await admin.from("stores").update({ the_log_client_id: null }).eq("the_log_client_id", clientId);
  if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 });

  if (storeId) {
    const { data, error } = await admin
      .from("stores")
      .update({ the_log_client_id: clientId })
      .eq("id", storeId)
      .select("id, name")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return bad("That Hive store doesn't exist", 404);
    return NextResponse.json({ linked: data });
  }
  return NextResponse.json({ linked: null });
}
