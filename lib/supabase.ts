import { createClient } from "@supabase/supabase-js";

/**
 * Anon-key client, used from the Server Action only.
 *
 * RLS on `signups` grants anon INSERT and nothing else — no SELECT, UPDATE or
 * DELETE policy exists — so this key carries no read capability and there is
 * no service-role secret anywhere in the app.
 */
export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
