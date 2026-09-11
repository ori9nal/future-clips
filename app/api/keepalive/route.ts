import { NextResponse, type NextRequest } from "next/server";
import { hasServiceRole, adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Keeps the Supabase free-tier project awake.
 *
 * Free projects pause after seven days without API activity; when paused the
 * hostname stops resolving and the app, auth and the signup form all die.
 * Vercel Cron calls this on the schedule in vercel.json (daily on Hobby,
 * which is the most Hobby allows and enough to never reach seven idle days;
 * every six hours once the team is on Pro). Any request through the API
 * gateway counts as activity, so the anon read below is enough on its own;
 * with the service role present it also stamps app_settings.keepalive so
 * the last touch is visible in the database.
 *
 * Public route (the middleware exempts it). When CRON_SECRET is set, Vercel
 * sends it as a bearer token and anything else is refused.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const at = new Date().toISOString();

  // an API request under RLS: returns [] for anon, but the gateway saw it
  const r = await fetch(`${base}/rest/v1/plans?select=id&limit=1`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
    cache: "no-store",
  });

  let stamped = false;
  if (hasServiceRole()) {
    const { error } = await adminClient()
      .from("app_settings")
      .update({ value: { at }, updated_at: at })
      .eq("key", "keepalive");
    stamped = !error;
  }
  return NextResponse.json({ ok: r.ok, status: r.status, at, stamped });
}
