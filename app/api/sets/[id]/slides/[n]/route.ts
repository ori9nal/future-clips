import { viewerForRequest } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSet } from "@/lib/sets";
import { adminClient, hasServiceRole } from "@/lib/supabase/admin";
import { isDemo, DEMO_REASON } from "@/lib/demo";
import { engineAvailable, ENGINE_MISSING } from "@/lib/engine";
import { allow } from "@/lib/ratelimit";
import { cleanEdits, copyForCheck, drawSlide, readSlideParts, textAfter, type Block, type SlideLayout } from "@/lib/slideEdit";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const maxDuration = 60;

/**
 * Move or rewrite the words on one slide.
 *
 * The photograph is the image model's and the type is ours — drawn as vector
 * text over the picture, never generated into it. So this costs nothing at a
 * provider: the renderer kept the SVG that drew the words and the picture it
 * drew them over (migration 0027), and redrawing is a fifth of a second of
 * rasterising. The slide goes back to the same path, so every link holds.
 *
 * Body: { edits: { "<blockId>": { lines?: string[], dx?: number, dy?: number } } }
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string; n: string }> }) {
  const viewer = await viewerForRequest();
  if (!viewer) return Response.json({ error: "sign in required", code: "AUTH" }, { status: 401 });
  const { id, n: nStr } = await ctx.params;
  const n = Number(nStr);
  if (!Number.isInteger(n) || n < 1 || n > 20) return Response.json({ error: "no such slide", code: "FC_BAD_SLIDE" }, { status: 400 });
  if (id.startsWith("demo-")) return Response.json({ error: DEMO_REASON, code: "FC_DEMO" }, { status: 403 });
  if (!engineAvailable()) return Response.json({ error: ENGINE_MISSING, code: "FC_NO_ENGINE" }, { status: 503 });
  if (!hasServiceRole()) return Response.json({ error: "this host cannot save slides", code: "FC_NO_WRITER" }, { status: 503 });
  // redrawing is cheap but not free, and a drag that fires on every pixel would
  // be a request per pixel. The editor saves on release; this catches the rest.
  if (!(await allow(`slide:edit:${viewer.user.id}`, 60, 300))) {
    return Response.json({ error: "Too many edits in a short time. Wait a moment and save again.", code: "FC_RATE" }, { status: 429 });
  }

  // RLS scopes this read to the member's own workspace, which is the whole
  // authorisation check; the write below is the service role's because it
  // has to put a file into Storage.
  const sb = await createClient();
  const set = await getSet(sb, id);
  if (!set) return Response.json({ error: "not found", code: "FC_NOT_FOUND" }, { status: 404 });
  if (set.status !== "done") return Response.json({ error: "this slideshow is not finished yet", code: "FC_NOT_DONE" }, { status: 409 });
  // the shared demo workspace: your own slides, not another visitor's
  if (isDemo(viewer) && set.user_id && set.user_id !== viewer.user.id) {
    return Response.json({ error: "Somebody else made this one. Make your own and edit that.", code: "FC_NOT_YOURS" }, { status: 403 });
  }
  const layout = (set.layout_json ?? null) as SlideLayout[] | null;
  const slide = layout?.find((l) => l.slide === n);
  if (!slide) {
    return Response.json({
      error: "This slideshow was made before slides could be edited. Make another and it will be editable.",
      code: "FC_NO_LAYOUT",
    }, { status: 409 });
  }

  let body: { edits?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "invalid JSON body", code: "FC_BAD_BODY" }, { status: 400 }); }
  const edits = cleanEdits(body?.edits, slide.blocks, slide.canvas);
  if (!edits) return Response.json({ error: "nothing changed", code: "FC_NO_CHANGE" }, { status: 400 });

  // The brief's rules still apply to words a customer types. The copy the
  // model wrote was checked before it was ever drawn; an edit is checked the
  // same way, against the whole set, so a banned claim cannot be typed in
  // after the fact.
  const verdict = await checkEdit(sb, set.campaign_id, set.content_json, n, textAfter(slide.blocks, edits));
  if (verdict && !verdict.pass) {
    return Response.json({ error: verdict.failures[0] ?? "the brief does not allow that", code: "FC_COMPLIANCE", failures: verdict.failures }, { status: 422 });
  }

  const prefix = `${set.org_id}/${set.id}`;
  const admin = adminClient();
  const parts = await readSlideParts(admin, prefix, n, slide.art);
  if (!parts) {
    return Response.json({ error: "The editable copy of this slide is no longer stored. Make another.", code: "FC_NO_PARTS" }, { status: 409 });
  }

  let png: Buffer, blocks: Block[];
  try {
    ({ png, blocks } = await drawSlide({ body: parts.body, art: parts.art, edits, canvas: slide.canvas }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "the slide could not be drawn", code: "FC_RENDER" }, { status: 500 });
  }

  const key = `${prefix}/slide-${n}.png`;
  // no-store on an edited slide: it keeps its path so that links hold, and a
  // cache keyed on that path would otherwise go on serving the old one
  const up = await admin.storage.from("sets").upload(key, png, { contentType: "image/png", upsert: true, cacheControl: "0" });
  if (up.error) return Response.json({ error: `the slide could not be saved: ${up.error.message}`, code: "FC_STORE" }, { status: 502 });

  // `layout_json` stays the baseline: the blocks as the renderer first drew
  // them, matching `slide-N.svg`, which this route never rewrites. Edits are
  // the difference from that, so they can be re-applied, shown as an overlay
  // in the right place, and undone. Folding them in would make the next save
  // move the block twice.
  const nextEdits = { ...((set.edits_json ?? {}) as Record<string, unknown>), [String(n)]: edits };
  const editedAt = Date.now();
  await admin.from("sets").update({ edits_json: nextEdits, edited_at: new Date(editedAt).toISOString() }).eq("id", set.id);

  const { data: signed } = await sb.storage.from("sets").createSignedUrls([key], 60 * 60);
  const url = signed?.[0]?.signedUrl;
  return Response.json({
    slide: n, blocks, warnings: verdict?.warnings ?? [],
    url: url ? `${url}${url.includes("?") ? "&" : "?"}v=${editedAt}` : null,
  });
}

/**
 * The brief's own check, run over the set as the edit leaves it.
 *
 * The copy the model wrote is the subject, with this slide's words replaced —
 * so the checker still knows which slide is the hook and which shows the app,
 * and an edit is held to exactly the rules the original was.
 *
 * Null when the set predates a checkable brief or the checker cannot read it:
 * the copy it was written from already passed, and a brief we cannot parse is
 * not the customer's problem.
 */
async function checkEdit(
  sb: Awaited<ReturnType<typeof createClient>>,
  campaignId: string,
  content: unknown,
  n: number,
  editedText: string,
): Promise<{ pass: boolean; failures: string[]; warnings: string[] } | null> {
  const copy = copyForCheck(content, n, editedText);
  if (!copy) return null;
  const { data: camp } = await sb.from("campaigns").select("data, kind").eq("id", campaignId).maybeSingle();
  if (!camp || camp.kind !== "spec") return null;
  try {
    const url = pathToFileURL(path.join(process.cwd(), "engine", "compliance.mjs")).href;
    const compliance: { check: (spec: unknown, copy: unknown) => { pass: boolean; failures: string[]; warnings: string[] } } =
      await import(/* webpackIgnore: true */ url);
    const v = compliance.check(camp.data, copy);
    // Only what this edit could have caused. A set can be live while failing
    // some other rule — a shorter set than the brief wants, say — and that is
    // not a reason to refuse a customer moving a line on slide 3.
    const before = compliance.check(camp.data, copyForCheck(content, n, null)!);
    const already = new Set(before.failures);
    const failures = v.failures.filter((f) => !already.has(f));
    return { pass: failures.length === 0, failures, warnings: v.warnings };
  } catch {
    return null;
  }
}
