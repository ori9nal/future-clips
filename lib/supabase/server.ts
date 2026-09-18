/**
 * Supabase, server side, as the signed-in user.
 *
 * Every read the app does on a user's behalf goes through this client, which
 * means RLS is the authorisation layer — a page cannot show a row the
 * policies would not hand to that user. The publishable key is a browser
 * key by design; the session cookie is what identifies the caller.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Session cookies are httpOnly: no browser Supabase client exists in the app
 * (sign-in and every read go through the server), so script never needs
 * them and a script injection cannot take them. `secure` follows the
 * request's scheme so a production build still works over plain http on a
 * laptop. Adding a browser client later means loosening this on purpose.
 */
export function hardenCookie(options: CookieOptions, secure: boolean): CookieOptions {
  return { ...options, httpOnly: true, secure, sameSite: "lax", path: options.path ?? "/" };
}

export async function createClient() {
  const [store, h] = await Promise.all([cookies(), headers()]);
  const secure = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() === "https";
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(list: { name: string; value: string; options: CookieOptions }[]) {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, hardenCookie(options, secure)));
        } catch {
          // Server Components cannot set cookies; the middleware refreshes
          // the session on the next request, so this is safe to ignore.
        }
      },
    },
  });
}
