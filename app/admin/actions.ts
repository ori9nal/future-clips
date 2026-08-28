"use server";

import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type Campaign,
  emptyCampaign,
  getCampaign,
  saveCampaign,
  deleteCampaign,
  slugify,
} from "@/lib/campaigns";

const list = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

/** Build a campaign from the admin form. */
function fromForm(fd: FormData, base: Campaign): Campaign {
  const name = String(fd.get("name") || "").trim();
  const handle = String(fd.get("handle") || "").trim();
  const accents: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    const m = k.match(/^accent_name_(\d+)$/);
    if (!m) continue;
    const label = String(v).trim();
    const hex = String(fd.get(`accent_hex_${m[1]}`) || "").trim();
    if (label && /^#[0-9a-fA-F]{6}$/.test(hex)) accents[label] = hex.toUpperCase();
  }

  return {
    ...base,
    id: base.id || slugify(name),
    name,
    niche: String(fd.get("niche") || "fitness").trim(),
    agency: String(fd.get("agency_code") || "").trim()
      ? {
          code: String(fd.get("agency_code")).trim().toUpperCase(),
          name: String(fd.get("agency_name") || "").trim(),
          contact: String(fd.get("agency_contact") || "").trim(),
        }
      : null,
    brand: {
      ...base.brand,
      name: String(fd.get("brand_name") || "").trim() || name,
      handle,
      wordmark: String(fd.get("wordmark") || "").trim(),
      colors: {
        ink: String(fd.get("ink") || "#111111"),
        paper: String(fd.get("paper") || "#FFFFFF"),
        // No accent declared means a deliberately monochrome kit, which is what
        // the top-performing reference format uses. Fall back to ink rather than
        // inventing a colour the agency never supplied.
        accents: Object.keys(accents).length ? accents : { mono: String(fd.get("ink") || "#111111") },
      },
    },
    rules: {
      required_mention: handle,
      min_slides: Number(fd.get("min_slides") || 6),
      max_slides: Number(fd.get("max_slides") || 11),
      canvas: String(fd.get("canvas") || "1080x1440"),
      banned_phrases: list(fd.get("banned_phrases")),
      banned_claims: list(fd.get("banned_claims")),
      cta_required_on_last: fd.get("cta_required_on_last") === "on",
      zero_gen_mode: fd.get("zero_gen_mode") === "on",
    },
    source: {
      ...base.source,
      video: String(fd.get("source_video") || "").trim() || null,
      libraries: [{ niche: String(fd.get("niche") || "fitness").trim(), kind: "people" }],
    },
  };
}

export async function createCampaign(fd: FormData) {
  const name = String(fd.get("name") || "").trim();
  if (!name) throw new Error("campaign needs a name");
  const c = fromForm(fd, emptyCampaign());
  if (!c.id) throw new Error("could not derive an id from the name");
  if (getCampaign(c.id)) throw new Error(`campaign "${c.id}" already exists`);
  saveCampaign(c);
  revalidatePath("/admin");
  redirect(`/admin/campaigns/${c.id}`);
}

export async function updateCampaign(id: string, fd: FormData) {
  const base = getCampaign(id);
  if (!base) throw new Error(`no campaign "${id}"`);
  saveCampaign(fromForm(fd, base));
  revalidatePath(`/admin/campaigns/${id}`);
  revalidatePath("/admin");
}

export async function removeCampaign(id: string) {
  deleteCampaign(id);
  revalidatePath("/admin");
  redirect("/admin");
}

/**
 * Logo upload. Written under public/ so the admin UI and any future rendered
 * furniture can both reference it by URL.
 */
export async function uploadLogo(id: string, fd: FormData) {
  const file = fd.get("logo") as File | null;
  if (!file || !file.size) return;
  const c = getCampaign(id);
  if (!c) throw new Error(`no campaign "${id}"`);

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  if (!["png", "jpg", "jpeg", "webp", "svg"].includes(ext)) {
    throw new Error(`unsupported logo format ".${ext}" — use png, jpg, webp or svg`);
  }
  const dir = path.join(process.cwd(), "public", "brand", id);
  fs.mkdirSync(dir, { recursive: true });
  const rel = `/brand/${id}/logo.${ext}`;
  fs.writeFileSync(path.join(dir, `logo.${ext}`), Buffer.from(await file.arrayBuffer()));

  saveCampaign({ ...c, brand: { ...c.brand, logo: rel } });
  revalidatePath(`/admin/campaigns/${id}`);
}

/**
 * Source visuals. Each upload is matted and added to the campaign's niche
 * library, so it becomes available to the renderer exactly like a stock cutout.
 *
 * Matting is ~5s of CPU per image and runs inline here because an admin
 * onboarding a campaign is a deliberate, low-frequency action. When this moves
 * behind the pg-boss queue the call site does not change — only the await does.
 */
export async function uploadVisuals(id: string, fd: FormData) {
  const c = getCampaign(id);
  if (!c) throw new Error(`no campaign "${id}"`);
  const files = fd.getAll("visuals").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return;

  const { ingestUpload } = await import("@/lib/ingest");
  const added: string[] = [];
  const rejected: string[] = [];
  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    const r = await ingestUpload(buf, { niche: c.niche, kind: "people", label: f.name });
    if (r.ok) added.push(r.id!);
    else rejected.push(`${f.name}: ${r.reason}`);
  }

  saveCampaign({
    ...c,
    source: { ...c.source, uploads: [...(c.source.uploads || []), ...added] },
  });
  revalidatePath(`/admin/campaigns/${id}`);
  if (rejected.length) {
    // Surfaced rather than swallowed: a silently dropped upload looks like a bug
    // to whoever onboarded the campaign.
    throw new Error(`rejected ${rejected.length} of ${files.length}: ${rejected.join(" · ")}`);
  }
}
