import "server-only";

/**
 * Supabase as the service role — bypasses RLS.
 *
 * Used ONLY where the app acts on its own authority after it has already
 * decided the caller may do the thing: the quota gate, the worker, Storage
 * writes, the billing webhook. Never imported from a client component and
 * never exposed through NEXT_PUBLIC_*; `server-only` makes a bundling mistake
 * a build error rather than a leak.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function hasServiceRole(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function adminClient(): SupabaseClient {
  if (cached) return cached;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set on this host. Set it in the Vercel project's environment (server only) — see RUNBOOK.md.",
    );
  }
  cached = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
