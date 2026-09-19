import { runWorker } from "@/lib/worker";

export const maxDuration = 300;
export const dynamic = "force-dynamic";
import { bearerMatches } from "@/lib/secrets";

/**
 * The poller. Vercel's cron calls it with `Authorization: Bearer $CRON_SECRET`
 * (so does anything else allowed to nudge the worker, e.g. pg_cron on the
 * Hobby plan where Vercel crons are daily). Each call advances every open
 * set one tick: batch sets whose provider batch has ended are collected and
 * moved on; priority sets that lost their host are finished.
 */
function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // no secret, no worker: never run an unauthenticated poller
  const auth = req.headers.get("authorization") ?? "";
  return bearerMatches(auth, secret);
}

export async function GET(req: Request) {
  if (!authorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });
  const t0 = Date.now();
  const r = await runWorker({ budgetMs: 240_000 });
  return Response.json({ ...r, ms: Date.now() - t0 });
}

export const POST = GET;
