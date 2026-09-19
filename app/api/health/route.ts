import { NextResponse } from "next/server";
import { engineLoads } from "@/lib/engine";
import { hasServiceRole } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Health, for monitors and for the owner after a deploy: is the database
 * reachable, is the engine on this host, which server secrets are present.
 * Booleans only, never a value. 200 when everything a rendering host needs is
 * there, 503 otherwise, so an uptime check can alert on a half-configured host.
 * Public (the middleware lists it).
 */
export async function GET() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let db = false;
  let dbStatus = 0;
  if (base && key) {
    try {
      // an anon read under RLS: no rows come back, but the gateway and Postgres answered
      const r = await fetch(`${base}/rest/v1/plans?select=id&limit=1`, { headers: { apikey: key, authorization: `Bearer ${key}` }, cache: "no-store" });
      db = r.ok;
      dbStatus = r.status;
    } catch {
      db = false;
    }
  }
  // not "are the files there" but "does the renderer import" — the first
  // question answered yes for weeks while every render failed
  const loads = await engineLoads();
  const ready = {
    db,
    engine: loads === true,
    supabase: !!(base && key),
    serviceRole: hasServiceRole(),
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    cronSecret: !!process.env.CRON_SECRET,
    dodo: !!process.env.DODO_API_KEY && !!process.env.DODO_WEBHOOK_SECRET,
  };
  const ok = ready.db && ready.engine && ready.serviceRole && ready.anthropic && ready.openai && ready.cronSecret;
  return NextResponse.json(
    {
      ok,
      ready,
      dbStatus,
      engineError: loads === true ? null : loads,
      host: process.env.VERCEL ? "vercel" : "local",
      commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || null,
      at: new Date().toISOString(),
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
