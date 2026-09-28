import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkTheLogAuth } from "@/lib/the-log";

/** GET: every Hive store, with the Log client it's linked to (if any). */
export async function GET(request: NextRequest) {
  const denied = checkTheLogAuth(request);
  if (denied) return denied;

  const { data, error } = await createAdminClient()
    .from("stores")
    .select("id, name, location, the_log_client_id")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stores: data });
}
