"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type Campaign, emptyCampaign, slugify } from "@/lib/campaigns";
import { getCampaign, saveCampaign, deleteCampaign } from "@/lib/db/campaigns";

/**
 * Admin mutations. Each one re-checks that the caller is a platform owner
 * (the page did too, but a server action is a URL) and then writes through
 * the caller's own Supabase client, so RLS is the second lock: a user who
 * is not a platform owner cannot write a platform campaign even if this
 * check were somehow skipped.
 */

const list = (v: FormDataEntryValue | null) =>
  String(v ?? "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean);

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
  await requirePlatformOwner();
  const sb = await createClient();
  const name = String(fd.get("name") || "").trim();
  if (!name) throw new Error("campaign needs a name");
  const c = fromForm(fd, emptyCampaign());
  if (!c.id) throw new Error("could not derive an id from the name");
  if (await getCampaign(sb, c.id)) throw new Error(`campaign "${c.id}" already exists`);
  await saveCampaign(sb, c);
  revalidatePath("/admin");
  redirect(`/admin/campaigns/${c.id}`);
}

export async function updateCampaign(id: string, fd: FormData) {
  await requirePlatformOwner();
  const sb = await createClient();
  const base = await getCampaign(sb, id);
  if (!base) throw new Error(`no campaign "${id}"`);
  await saveCampaign(sb, fromForm(fd, base));
  revalidatePath(`/admin/campaigns/${id}`);
  revalidatePath("/admin");
}

export async function removeCampaign(id: string) {
  await requirePlatformOwner();
  const sb = await createClient();
  await deleteCampaign(sb, id);
  revalidatePath("/admin");
  redirect("/admin");
}

/**
 * Logo upload → the public `assets` bucket (brand/<id>/logo.<ext>). Storage
 * policy: platform owners only. The public URL goes on the campaign record.
 */
export async function uploadLogo(id: string, fd: FormData) {
  await requirePlatformOwner();
  const file = fd.get("logo") as File | null;
  if (!file || !file.size) return;
  const sb = await createClient();
  const c = await getCampaign(sb, id);
  if (!c) throw new Error(`no campaign "${id}"`);

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  if (!["png", "jpg", "jpeg", "webp", "svg"].includes(ext)) {
    throw new Error(`unsupported logo format ".${ext}" — use png, jpg, webp or svg`);
  }
  if (file.size > 2 * 1024 * 1024) throw new Error("logo is over 2 MB");
  const key = `brand/${id}/logo.${ext}`;
  const { error } = await sb.storage.from("assets").upload(key, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type || `image/${ext === "svg" ? "svg+xml" : ext}`,
    upsert: true,
  });
  if (error) throw new Error(`upload failed: ${error.message}`);
  const { data } = sb.storage.from("assets").getPublicUrl(key);
  await saveCampaign(sb, { ...c, brand: { ...c.brand, logo: data.publicUrl } });
  revalidatePath(`/admin/campaigns/${id}`);
}

/* ── invites: who may sign in while the product is invite-only ─────────── */

export async function addInvite(fd: FormData) {
  const viewer = await requirePlatformOwner();
  const sb = await createClient();
  const email = String(fd.get("email") || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) throw new Error("that is not an email address");
  const scope = String(fd.get("scope") || "customer");
  const platform = viewer.memberships.find((m) => m.org.is_platform)?.org;
  const row: any = { email, note: String(fd.get("note") || "").trim() || null, invited_by: viewer.user.id };
  if (scope === "platform_owner" && platform) { row.org_id = platform.id; row.role = "owner"; }
  const { error } = await sb.from("allowed_emails").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/invites");
}

export async function removeInvite(email: string) {
  await requirePlatformOwner();
  const sb = await createClient();
  const { error } = await sb.from("allowed_emails").delete().eq("email", email);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/invites");
}

export async function setSignupMode(fd: FormData) {
  await requirePlatformOwner();
  const sb = await createClient();
  const mode = String(fd.get("mode")) === "open" ? "open" : "invite";
  const { error } = await sb.from("app_settings").update({ value: { mode }, updated_at: new Date().toISOString() }).eq("key", "signup");
  if (error) throw new Error(error.message);
  revalidatePath("/admin/invites");
}
