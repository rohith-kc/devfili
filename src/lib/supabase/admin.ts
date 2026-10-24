import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Service-role Supabase client for server-only code: the research cache,
 * live-run rate limiting, and public-by-id guide reads. Never import this
 * from client components. Returns null when Supabase isn't configured yet,
 * so callers can degrade gracefully instead of throwing. */
export function getAdminClient(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return client;
}
