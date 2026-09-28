import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/roles";

export type Viewer = {
  id: string;
  email: string;
  name: string;
  role: Role;
  storeId: string | null;
  storeName: string | null;
};

/**
 * The signed-in user's profile, or a redirect to /login. Cached per request so
 * layout and page share one lookup.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, store_id, stores(name)")
    .eq("id", auth.user.id)
    .maybeSingle();

  // Signed in but never provisioned — nothing in the app is meant for them.
  if (!profile) redirect("/login?error=no-profile");

  const store = profile.stores as unknown as { name: string } | null;
  return {
    id: auth.user.id,
    email: auth.user.email ?? "",
    name: profile.full_name,
    role: profile.role as Role,
    storeId: profile.store_id,
    storeName: store?.name ?? null,
  };
});

/** Page guard for regional-manager-only routes. */
export async function requireRegionalManager(): Promise<Viewer> {
  const viewer = await getViewer();
  if (viewer.role !== "regional_manager") redirect("/feed");
  return viewer;
}
