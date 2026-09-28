import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./env";

/** Browser client acting as the signed-in user. Used for direct file uploads. */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabasePublishableKey());
}
