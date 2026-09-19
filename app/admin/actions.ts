"use server";

import { revalidatePath } from "next/cache";
import type { Spec } from "@/lib/specs";
import { redirect } from "next/navigation";
import { requirePlatformOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type Campaign, emptyCampaign, slugify } from "@/lib/campaigns";
import { getCampaign, saveCampaign, deleteCampaign, getSpec, saveSpec } from "@/lib/db/campaigns";

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
  if (scope === "demo") {
    // the shared demo workspace (0013): a member, never an owner
    const { data: demoOrg, error: de } = await sb.rpc("fc_demo_org_id");
    if (de || !demoOrg) throw new Error("the demo workspace does not exist yet (migration 0013)");
    row.org_id = demoOrg; row.role = "member";
  }
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

/* ── the agency referral programme (migration 0005) ─────────────────────── */

/** Settle a commission row: the money went out by bank/PayPal, mark it paid. RLS: platform owner. */
export async function markCommissionPaid(id: number) {
  await requirePlatformOwner();
  const sb = await createClient();
  const { error } = await sb.from("commissions").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id).eq("status", "pending");
  if (error) throw new Error(error.message);
  revalidatePath("/admin/partners");
}

export async function voidCommission(id: number) {
  await requirePlatformOwner();
  const sb = await createClient();
  const { error } = await sb.from("commissions").update({ status: "void" }).eq("id", id).eq("status", "pending");
  if (error) throw new Error(error.message);
  revalidatePath("/admin/partners");
}

/** The tier table: min referred accounts → rate. The ceiling is 30% (a CHECK in the database). */
export async function saveTier(fd: FormData) {
  await requirePlatformOwner();
  const sb = await createClient();
  const min = Number(fd.get("min_referred")), rate = Number(fd.get("rate")) / 100;
  if (!Number.isInteger(min) || min < 0) throw new Error("min referred must be a whole number");
  if (!(rate > 0 && rate <= 0.30)) throw new Error("rate must be between 1% and 30%");
  const { error } = await sb.from("referral_tiers").upsert({ min_referred: min, rate });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/partners");
}

export async function removeTier(min: number) {
  await requirePlatformOwner();
  if (min === 0) throw new Error("the base tier stays");
  const sb = await createClient();
  const { error } = await sb.from("referral_tiers").delete().eq("min_referred", min);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/partners");
}

/**
 * Record a referred account's revenue for a period by hand — what the billing
 * webhook will do in phase 5. fc_record_commission is service-role only, so
 * this needs the key on the host; the page says so when it is missing.
 */
export async function recordCommission(fd: FormData) {
  await requirePlatformOwner();
  const { hasServiceRole, adminClient } = await import("@/lib/supabase/admin");
  if (!hasServiceRole()) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set on this host");
  const referred = String(fd.get("referred_org_id") || "").trim();
  const period = String(fd.get("period_start") || "").trim();
  const revenue = Number(fd.get("revenue_usd"));
  if (!/^[0-9a-f-]{36}$/.test(referred)) throw new Error("pick a referred workspace");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) throw new Error("period must be a date");
  if (!(revenue >= 0)) throw new Error("revenue must be a number");
  const { error } = await adminClient().rpc("fc_record_commission", { p_referred: referred, p_period: period, p_revenue: revenue, p_note: String(fd.get("note") || "").trim() || "recorded by hand" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/partners");
}

/* ── briefs (engine specs): pause / resume / remove ──────────────────────── */

/** A paused brief disappears from every customer's picker; sets already made stay. */
export async function setBriefStatus(id: string, status: "live" | "paused") {
  await requirePlatformOwner();
  const sb = await createClient();
  const { error } = await sb.from("campaigns").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("kind", "spec");
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/app");
}

/** Remove a brief for good. Refused while sets reference it (they keep the id for their history). */
export async function removeBrief(id: string) {
  await requirePlatformOwner();
  const sb = await createClient();
  const { count } = await sb.from("sets").select("id", { count: "exact", head: true }).eq("campaign_id", id);
  if (count) throw new Error(`${count} set(s) were made against "${id}" — pause it instead of deleting`);
  const { error } = await sb.from("campaigns").delete().eq("id", id).eq("kind", "spec");
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/app");
}

/* ── briefs: everything a campaign carries, edited in one form ─────────── */

const num = (v: FormDataEntryValue | null) => { const n = Number(String(v ?? "").trim()); return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null; };
const str = (v: FormDataEntryValue | null, max = 400) => { const t = String(v ?? "").trim(); return t ? t.slice(0, max) : null; };

/**
 * Save a brief. The form carries every field the brief has; anything left
 * blank is cleared rather than quietly kept, so the page is the truth. The
 * authored `content` block (hook, ranked, closer) is never touched here —
 * copy is generated per set, and a brief that still has authored copy keeps it.
 */
export async function saveBrief(id: string, fd: FormData) {
  await requirePlatformOwner();
  const sb = await createClient();
  const current = await getSpec(sb, id);
  if (!current) throw new Error(`no brief "${id}"`);

  const refs: NonNullable<Spec["references"]> = [];
  for (let i = 0; i < 8; i++) {
    const url = str(fd.get(`ref_url_${i}`), 500);
    const path = str(fd.get(`ref_path_${i}`), 500);
    const note = str(fd.get(`ref_note_${i}`), 300);
    if (url || path || note) refs.push({ url, path, note, kind: (str(fd.get(`ref_kind_${i}`)) as "post" | undefined) ?? "post" });
  }

  const next: Spec = {
    ...current,
    brand: str(fd.get("brand"), 80) ?? current.brand,
    wordmark: str(fd.get("wordmark"), 80) ?? undefined,
    handle: str(fd.get("handle"), 60) ?? undefined,
    product: str(fd.get("product"), 400) ?? current.product,
    niche: str(fd.get("niche"), 60) ?? current.niche,
    advertiser: str(fd.get("advertiser"), 120) ?? undefined,
    agency: str(fd.get("agency"), 120) ?? undefined,
    payout: {
      ...current.payout,
      rate_usd: num(fd.get("rate_usd")) ?? current.payout?.rate_usd ?? 0,
      min_payout_usd: num(fd.get("min_payout_usd")) ?? current.payout?.min_payout_usd ?? 0,
      max_payout_usd: num(fd.get("max_payout_usd")) ?? current.payout?.max_payout_usd ?? 0,
      budget_total_usd: num(fd.get("budget_total_usd")) ?? current.payout?.budget_total_usd ?? 0,
      budget_remaining_usd: num(fd.get("budget_remaining_usd")) ?? current.payout?.budget_remaining_usd ?? 0,
      review_days: num(fd.get("review_days")) ?? current.payout?.review_days ?? 0,
      platforms: list(fd.get("platforms")).length ? list(fd.get("platforms")) : (current.payout?.platforms ?? []),
    },
    requirements: {
      ...current.requirements,
      min_slides: num(fd.get("min_slides")) ?? current.requirements.min_slides,
      max_slides: num(fd.get("max_slides")) ?? current.requirements.max_slides,
      aspect: str(fd.get("aspect"), 12) ?? current.requirements.aspect,
      required_mention: str(fd.get("required_mention"), 60) ?? "",
      must_show_app: fd.get("must_show_app") === "on",
    },
    rules: {
      ...current.rules,
      banned_claims: list(fd.get("banned_claims")),
      banned_topics: list(fd.get("banned_topics")),
      tone: str(fd.get("tone"), 600) ?? undefined,
      disclosure: str(fd.get("disclosure"), 200) ?? undefined,
      required_phrase: str(fd.get("required_phrase"), 120),
      never_bare: str(fd.get("never_bare"), 120),
      no_exclamation: fd.get("no_exclamation") === "on",
    },
    guidance: {
      hook_style: str(fd.get("hook_style"), 600) ?? undefined,
      angles: list(fd.get("angles")),
      notes: list(fd.get("notes")),
    },
    client: {
      agency: {
        name: str(fd.get("agency"), 120) ?? undefined,
        contact: str(fd.get("agency_contact"), 160) ?? undefined,
        code: str(fd.get("agency_code"), 40) ?? undefined,
        commission_pct: num(fd.get("agency_commission_pct")) ?? undefined,
      },
      advertiser: {
        name: str(fd.get("advertiser"), 120) ?? undefined,
        contact: str(fd.get("advertiser_contact"), 160) ?? undefined,
        site: str(fd.get("advertiser_site"), 300) ?? undefined,
      },
      opens: str(fd.get("opens"), 40),
      closes: str(fd.get("closes"), 40),
      source: { name: str(fd.get("source_name"), 200) ?? undefined, url: str(fd.get("source_url"), 500) ?? undefined },
    },
    deliverables: {
      sets_wanted: num(fd.get("sets_wanted")),
      due: str(fd.get("due"), 40),
      platforms: list(fd.get("platforms")),
      cta_url: str(fd.get("cta_url"), 500),
      tracking_url: str(fd.get("tracking_url"), 500),
      audience: str(fd.get("audience"), 400),
    },
    references: refs,
    app_store: {
      title: str(fd.get("app_title"), 60) ?? undefined,
      subtitle: str(fd.get("app_subtitle"), 80) ?? undefined,
      developer: str(fd.get("app_developer"), 80) ?? undefined,
      rating: num(fd.get("app_rating")),
      ratings: str(fd.get("app_ratings"), 20),
      age: str(fd.get("app_age"), 10),
      category: str(fd.get("app_category"), 40),
      theme: (str(fd.get("app_theme"), 10) as "light" | "dark" | null) ?? null,
    },
    assets: {
      ...current.assets,
      palette: list(fd.get("palette")).length ? list(fd.get("palette")) : current.assets.palette,
      look: str(fd.get("look"), 40),
    },
  };

  await saveSpec(sb, next);
  revalidatePath(`/admin/briefs/${id}`);
  revalidatePath("/admin");
}

/** A picture the brief needs: the brand's logo, the app icon, or a reference to imitate. */
export async function uploadBriefAsset(id: string, fd: FormData) {
  await requirePlatformOwner();
  const slot = String(fd.get("slot") || "");
  const file = fd.get("file") as File | null;
  if (!file || !file.size) return;
  if (!/^(logo|app_icon|app_screen|ref_[0-7])$/.test(slot)) throw new Error(`unknown slot "${slot}"`);
  if (file.size > 4 * 1024 * 1024) throw new Error("keep it under 4 MB");
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  if (!["png", "jpg", "jpeg", "webp"].includes(ext)) throw new Error(`use png, jpg or webp, not ".${ext}"`);

  const sb = await createClient();
  const current = await getSpec(sb, id);
  if (!current) throw new Error(`no brief "${id}"`);
  const key = `brief/${id}/${slot}.${ext}`;
  const { error } = await sb.storage.from("assets").upload(key, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type || `image/${ext}`, upsert: true,
  });
  if (error) throw new Error(`upload failed: ${error.message}`);
  const { data } = sb.storage.from("assets").getPublicUrl(key);

  const next: Spec = { ...current };
  if (slot === "logo") next.assets = { ...next.assets, logo: data.publicUrl };
  else if (slot === "app_icon") next.assets = { ...next.assets, app_icon: data.publicUrl };
  else if (slot === "app_screen") next.assets = { ...next.assets, app_screen: data.publicUrl };
  else {
    const i = Number(slot.slice(4));
    const refs = [...(next.references ?? [])];
    while (refs.length <= i) refs.push({});
    refs[i] = { ...refs[i], path: data.publicUrl };
    next.references = refs;
  }
  await saveSpec(sb, next);
  revalidatePath(`/admin/briefs/${id}`);
}
