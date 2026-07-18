import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabasePublishableKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)?.trim() ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

let browserClient: SupabaseClient | null = null;

/**
 * Returns the browser client only when both public Supabase values are present.
 * Project data is never written to localStorage. Without these central values the
 * application remains read-only and blocks login and operational mutations.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;

  browserClient ??= createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
    global: {
      headers: { "x-client-info": "codeco-supervisie-web/0.1.0" },
    },
  });

  return browserClient;
}
