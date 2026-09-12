import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * The auth gate. Every route needs a signed-in user except the handful
 * listed in PUBLIC. API routes get a 401 JSON body; pages get sent to
 * /login with a `next` so the magic link lands them back where they were.
 *
 * The session cookie is refreshed here on every request (the @supabase/ssr
 * pattern), which is what keeps a Server Component's read of the user
 * current without it being able to write cookies itself.
 */
const PUBLIC = [
  /^\/$/,
  /^\/login(\/|$)/,
  /^\/auth\//,
  /^\/api\/keepalive$/,
  /^\/api\/webhooks\//,
  /^\/api\/health$/,
  // the five Trust and Legal pages: a policy behind a login is not published
  /^\/(terms|privacy|acceptable-use|refunds|accessibility)$/,
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC.some((rx) => rx.test(pathname));

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(list: { name: string; value: string; options: CookieOptions }[]) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser() validates the JWT against Supabase; getSession() would trust
  // the cookie as-is, which is exactly what a forged cookie wants.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "sign in required" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/app" ? `?next=${encodeURIComponent(pathname + request.nextUrl.search)}` : "";
    return NextResponse.redirect(url);
  }

  // Signed-in users have no business on the login page.
  if (user && /^\/login(\/|$)/.test(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // everything except Next's own assets and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|ico|txt|woff2?)$).*)"],
};
