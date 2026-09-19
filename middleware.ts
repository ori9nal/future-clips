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
  /^\/api\/auth\//,
  /^\/api\/keepalive$/,
  /^\/api\/webhooks\//,
  // the poller. Vercel's cron sends an Authorization header and no cookie, so
  // a session check here stops it before its own bearer check ever runs — and
  // a bearer the middleware rejects is a worker that never wakes up. The route
  // authorises itself against CRON_SECRET in constant time and refuses
  // outright when that variable is unset.
  /^\/api\/cron\//,
  /^\/api\/health$/,
  // the five Trust and Legal pages: a policy behind a login is not published
  /^\/(terms|privacy|acceptable-use|refunds|accessibility)$/,
  // the design preview (dev only; the page itself 404s in production), and
  // the slide images it shows, which come through /api/file with no session
  /^\/design-preview$/,
  ...(process.env.NODE_ENV !== "production" && process.env.FC_DEMO_PREVIEW === "1" ? [/^\/api\/file\//] : []),
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
          const secure = (request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")).split(",")[0].trim() === "https";
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, { ...options, httpOnly: true, secure, sameSite: "lax", path: options.path ?? "/" }));
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

  // ?ref=CODE (the agency referral link) survives the magic-link round trip as
  // a cookie; /auth/callback claims it on first sign-in. Only the code's
  // alphabet is accepted, so nothing else from the query reaches the database.
  const ref = request.nextUrl.searchParams.get("ref");
  if (ref && /^[A-Za-z0-9]{4,16}$/.test(ref) && !request.cookies.get("fc_ref")) {
    response.cookies.set("fc_ref", ref.toUpperCase(), { maxAge: 30 * 86400, path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  }

  return response;
}

export const config = {
  // every API route, whatever its extension (a slide URL ends in .png and must
  // still be gated), then every page except Next's own assets and static files
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|ico|txt|woff2?)$).*)",
  ],
};
