import { viewerForRequest } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSet } from "@/lib/sets";
import { zipStore } from "@/lib/zip";

export const maxDuration = 60;

/**
 * Every slide of a finished set plus its caption, as one zip. The files are
 * read through the member's own client, so the storage policy decides.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await viewerForRequest();
  if (!viewer) return Response.json({ error: "sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  const sb = await createClient();
  const set = await getSet(sb, id);
  if (!set) return Response.json({ error: "not found" }, { status: 404 });
  if (set.status !== "done" || !set.files_json?.length) return Response.json({ error: "not finished" }, { status: 409 });

  const files: { name: string; data: Uint8Array }[] = [];
  for (const p of set.files_json) {
    const { data, error } = await sb.storage.from("sets").download(p);
    if (error || !data) return Response.json({ error: `could not read ${p}` }, { status: 502 });
    files.push({ name: p.split("/").pop()!, data: new Uint8Array(await data.arrayBuffer()) });
  }
  const c = set.content_json ?? {};
  const post = [`${set.caption ?? ""}`, "", (c.hashtags ?? []).map((h: string) => (h.startsWith("#") ? h : `#${h}`)).join(" "), "", c.bio ? `bio: ${c.bio}` : ""].join("\n").trim() + "\n";
  files.push({ name: "post.txt", data: new TextEncoder().encode(post) });

  const slug = `${set.campaign_id}-${set.ask}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return new Response(zipStore(files) as any, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${slug || "set"}.zip"`,
      "cache-control": "private, no-store",
    },
  });
}
