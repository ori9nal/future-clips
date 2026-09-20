import "server-only";

/**
 * Campaigns, from the database.
 *
 * `campaigns.data` is the JSON that used to live in campaigns/*.json, and the
 * two shapes that shared that folder are still two shapes: `kind` is
 * 'campaign' (brand kit as an object — lib/campaigns.ts) or 'spec' (brand as
 * a string, engine content — lib/specs.ts). Each loader returns only its own
 * kind, exactly as the file loaders did, so the admin form can never
 * overwrite a spec's brief. The files under campaigns/ are now the seed and
 * the CLI's fixtures; the app reads here.
 *
 * Every call goes through the caller's Supabase client, so RLS decides what
 * is visible: platform campaigns (org_id null) to everyone signed in, an
 * org's own to its members.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Campaign } from "@/lib/campaigns";
import type { Spec } from "@/lib/specs";

export type CampaignRow = {
  id: string;
  org_id: string | null;
  kind: "campaign" | "spec";
  data: any;
  status: "live" | "paused" | "closed";
  art_mode: "ai" | "photos";
  photo_dir_available: boolean;
  updated_at: string;
};

const COLS = "id, org_id, kind, data, status, art_mode, photo_dir_available, sample, updated_at";

export async function listSpecs(sb: SupabaseClient, { liveOnly = false } = {}): Promise<(Spec & { org_id: string | null; status: string })[]> {
  let q = sb.from("campaigns").select(COLS).eq("kind", "spec");
  if (liveOnly) q = q.eq("status", "live");
  const { data, error } = await q;
  if (error) throw error;
  return (data as CampaignRow[])
    .map((r) => ({ ...(r.data as Spec), id: r.id, org_id: r.org_id, status: r.status, sample: (r as unknown as { sample?: unknown }).sample ?? null }))
    .sort((a, b) => String(a.brand).localeCompare(String(b.brand)));
}

export async function getSpec(sb: SupabaseClient, id: string): Promise<Spec | null> {
  const { data } = await sb.from("campaigns").select(COLS).eq("id", id).eq("kind", "spec").maybeSingle();
  return data ? { ...((data as CampaignRow).data as Spec), id } : null;
}

export async function getCampaignRow(sb: SupabaseClient, id: string): Promise<CampaignRow | null> {
  const { data } = await sb.from("campaigns").select(COLS).eq("id", id).maybeSingle();
  return (data as CampaignRow) ?? null;
}

export async function listCampaigns(sb: SupabaseClient): Promise<Campaign[]> {
  const { data, error } = await sb.from("campaigns").select(COLS).eq("kind", "campaign").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as CampaignRow[]).map((r) => ({ ...(r.data as Campaign), id: r.id, updatedAt: r.updated_at }));
}

export async function getCampaign(sb: SupabaseClient, id: string): Promise<Campaign | null> {
  const { data } = await sb.from("campaigns").select(COLS).eq("id", id).eq("kind", "campaign").maybeSingle();
  return data ? { ...((data as CampaignRow).data as Campaign), id } : null;
}

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);

/**
 * Upsert a spec. A new brief is a platform campaign (org_id null), which every
 * customer sees; an existing one keeps whichever workspace holds it. The
 * demo's briefs live in the demo workspace (0029), and an admin editing one
 * must not hand it back to everyone by saving it. RLS: platform owners only.
 */
export async function saveSpec(sb: SupabaseClient, spec: Spec, o: { status?: "live" | "paused" } = {}): Promise<Spec> {
  const id = slug(spec.id);
  if (!id) throw new Error("campaign id is required");
  const { data: existing } = await sb.from("campaigns").select("org_id, status").eq("id", id).maybeSingle();
  // a new brief starts paused when asked to — read through, then "Go live" —
  // and an existing one keeps its status unless told otherwise
  const status = o.status ?? existing?.status ?? "live";
  const row = { id, org_id: existing?.org_id ?? null, kind: "spec", status, data: { ...spec, id, status }, updated_at: new Date().toISOString() };
  const { error } = await sb.from("campaigns").upsert(row, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return { ...spec, id };
}

/** Upsert a brand-kit campaign as a platform campaign. RLS: platform owners only. */
export async function saveCampaign(sb: SupabaseClient, c: Campaign): Promise<Campaign> {
  const id = slug(c.id || c.name);
  if (!id) throw new Error("campaign needs an id");
  const next = { ...c, id, updatedAt: new Date().toISOString() };
  const { error } = await sb.from("campaigns").upsert(
    { id, org_id: null, kind: "campaign", data: next, updated_at: next.updatedAt },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
  return next;
}

export async function deleteCampaign(sb: SupabaseClient, id: string) {
  const { error } = await sb.from("campaigns").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
