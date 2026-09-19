import { NextResponse, type NextRequest } from "next/server";
import { viewerForRequest } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/login";
import { allow, clientIp, TOO_MANY } from "@/lib/ratelimit";
import { checkImage, isKind, readOrgAssets, cleanHandle, uploadPath, KINDS, MAX_BYTES, type OrgAssets } from "@/lib/uploads";

export const maxDuration = 30;

/**
 * The workspace's own logo, avatar and handle — what goes on its slides.
 *
 * GET    → what is on file, with a signed URL for each so the dashboard can show it
 * POST   → multipart { kind: logo|avatar, file } or JSON { handle }
 * DELETE → ?kind=logo|avatar, or ?kind=handle to clear it
 *
 * The upload goes through the member's own client, so the storage policies
 * (migration 0020) decide: only an owner of that workspace may write under
 * its folder, and only its members may read.
 */
const SIGNED_FOR = 60 * 60;

async function withUrls(sb: Awaited<ReturnType<typeof createClient>>, assets: OrgAssets) {
  const paths = [assets.logo_path, assets.avatar_path].filter((p): p is string => !!p);
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data } = await sb.storage.from("uploads").createSignedUrls(paths, SIGNED_FOR);
    (data ?? []).forEach((d) => { if (d.path && d.signedUrl) urls[d.path] = d.signedUrl; });
  }
  return {
    handle: assets.handle ?? null,
    logo: assets.logo_path ? { path: assets.logo_path, url: urls[assets.logo_path] ?? null } : null,
    avatar: assets.avatar_path ? { path: assets.avatar_path, url: urls[assets.avatar_path] ?? null } : null,
  };
}

export async function GET() {
  const viewer = await viewerForRequest();
  if (!viewer) return NextResponse.json({ error: "sign in required", code: "AUTH" }, { status: 401 });
  const sb = await createClient();
  return NextResponse.json({ assets: await withUrls(sb, readOrgAssets((viewer.org as { assets?: unknown }).assets)) });
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "cross-site request", code: "FC_CROSS_SITE" }, { status: 403 });
  const viewer = await viewerForRequest();
  if (!viewer) return NextResponse.json({ error: "sign in required", code: "AUTH" }, { status: 401 });
  if (viewer.role !== "owner") return NextResponse.json({ error: "Only the workspace owner can change its brand.", code: "FC_NOT_OWNER" }, { status: 403 });
  if (!(await allow(`assets:user:${viewer.user.id}`, 20, 600))) return NextResponse.json({ error: TOO_MANY, code: "FC_RATE" }, { status: 429 });

  const sb = await createClient();
  const current = readOrgAssets((viewer.org as { assets?: unknown }).assets);
  const type = req.headers.get("content-type") ?? "";

  // just the handle
  if (type.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { handle?: unknown };
    const handle = cleanHandle(body.handle);
    if (body.handle && !handle) return NextResponse.json({ error: "A handle is letters, numbers, dots and underscores, up to 40.", code: "FC_BAD_HANDLE" }, { status: 400 });
    const next = { ...current, handle };
    const { error } = await sb.from("orgs").update({ assets: next }).eq("id", viewer.org.id);
    if (error) return NextResponse.json({ error: error.message, code: "FC_SAVE" }, { status: 400 });
    return NextResponse.json({ assets: await withUrls(sb, next) });
  }

  if (!type.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Send the image as multipart form data.", code: "FC_BAD_BODY" }, { status: 400 });
  }
  const form = await req.formData().catch(() => null);
  const kind = String(form?.get("kind") ?? "");
  const file = form?.get("file");
  if (!isKind(kind)) return NextResponse.json({ error: `kind must be one of ${KINDS.join(", ")}`, code: "FC_BAD_KIND" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "No file came through.", code: "FC_NO_FILE" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: `Keep it under ${MAX_BYTES / 1024 / 1024} MB.`, code: "FC_TOO_BIG" }, { status: 413 });

  const checked = checkImage(new Uint8Array(await file.arrayBuffer()));
  if (!checked.ok) return NextResponse.json({ error: checked.error, code: "FC_BAD_IMAGE" }, { status: 400 });

  const path = uploadPath(viewer.org.id, kind, checked.ext);
  const { error: up } = await sb.storage.from("uploads").upload(path, checked.bytes, { contentType: checked.type, upsert: true });
  if (up) return NextResponse.json({ error: up.message, code: "FC_UPLOAD" }, { status: 400 });

  const old = kind === "logo" ? current.logo_path : current.avatar_path;
  const next = { ...current, [kind === "logo" ? "logo_path" : "avatar_path"]: path };
  const { error } = await sb.from("orgs").update({ assets: next }).eq("id", viewer.org.id);
  if (error) return NextResponse.json({ error: error.message, code: "FC_SAVE" }, { status: 400 });
  // the replaced file is no longer referenced by the workspace; finished sets
  // keep their own copy of what they used, so removing it changes no history
  if (old && old !== path) await sb.storage.from("uploads").remove([old]);
  return NextResponse.json({ assets: await withUrls(sb, next) });
}

export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "cross-site request", code: "FC_CROSS_SITE" }, { status: 403 });
  const viewer = await viewerForRequest();
  if (!viewer) return NextResponse.json({ error: "sign in required", code: "AUTH" }, { status: 401 });
  if (viewer.role !== "owner") return NextResponse.json({ error: "Only the workspace owner can change its brand.", code: "FC_NOT_OWNER" }, { status: 403 });
  const kind = new URL(req.url).searchParams.get("kind") ?? "";
  const sb = await createClient();
  const current = readOrgAssets((viewer.org as { assets?: unknown }).assets);

  let next = current;
  if (kind === "handle") next = { ...current, handle: undefined };
  else if (isKind(kind)) {
    const path = kind === "logo" ? current.logo_path : current.avatar_path;
    if (path) await sb.storage.from("uploads").remove([path]);
    next = { ...current, [kind === "logo" ? "logo_path" : "avatar_path"]: undefined };
  } else {
    return NextResponse.json({ error: `kind must be one of ${KINDS.join(", ")}, handle`, code: "FC_BAD_KIND" }, { status: 400 });
  }
  const { error } = await sb.from("orgs").update({ assets: next }).eq("id", viewer.org.id);
  if (error) return NextResponse.json({ error: error.message, code: "FC_SAVE" }, { status: 400 });
  return NextResponse.json({ assets: await withUrls(sb, next) });
}
