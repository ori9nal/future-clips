import "server-only";

/**
 * Sets: what a member asked for and what came back.
 *
 * Creating one is a single database call — fc_reserve_set — which checks the
 * membership, the plan, the allowance, the spend cap, and reserves the slides
 * in the same transaction. The app never decides any of that; it asks and
 * relays the answer. The FC_* names the function raises map to sentences here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type Lane = "batch" | "priority";

export type SetRow = {
  id: string;
  org_id: string;
  campaign_id: string;
  style: string;
  ask: string;
  slides: number | null;
  slides_min: number;
  slides_max: number;
  reserved_slides: number;
  quality: "medium" | "high";
  lane: Lane;
  hd: boolean;
  status: "queued" | "rendering" | "done" | "failed";
  stage: string | null;
  caption: string | null;
  cost_usd: number | null;
  files_json: string[] | null;
  content_json: any;
  compliance_json: any;
  error: string | null;
  cancel_requested: boolean;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
};

export const SET_COLS =
  "id, org_id, campaign_id, style, ask, slides, slides_min, slides_max, reserved_slides, quality, lane, hd, status, stage, caption, cost_usd, files_json, content_json, compliance_json, error, cancel_requested, created_at, started_at, finished_at, updated_at";

/** The gate's refusals, as the sentence the member sees. */
const REASONS: Record<string, string> = {
  FC_NOT_MEMBER: "You are not a member of that workspace.",
  FC_BAD_LANE: "Unknown lane.",
  FC_BAD_RANGE: "Slide range must be between 5 and 10.",
  FC_NO_CAMPAIGN: "That campaign is not live.",
  FC_NO_PLAN: "This workspace has no plan yet. Choose a plan to start generating.",
  FC_NO_HD: "HD export comes with Pro and Studio.",
  FC_QUOTA: "Not enough slides left this period.",
  FC_SPEND_CAP: "This workspace has reached its spend cap for the period. Email team@thefutureclips.com to raise it.",
  FC_DEMO: "This is the demo workspace: everything here was made with The Future Clips. Pick a plan to make your own.",
};

export class ReserveError extends Error {
  code: string;
  detail: string | null;
  constructor(code: string, detail: string | null) {
    super(REASONS[code] ?? code);
    this.code = code;
    this.detail = detail;
  }
}

export type ReserveInput = {
  orgId: string;
  campaignId: string;
  ask: string;
  style: string;
  min: number;
  max: number;
  lane: Lane;
  hd?: boolean;
  creatorId?: string | null;
  look?: string | null;
};

/** Reserve and create. Throws ReserveError with the gate's reason. */
export async function reserveSet(sb: SupabaseClient, i: ReserveInput): Promise<string> {
  const { data, error } = await sb.rpc("fc_reserve_set", {
    p_org: i.orgId,
    p_campaign: i.campaignId,
    p_ask: i.ask,
    p_style: i.style,
    p_min: i.min,
    p_max: i.max,
    p_lane: i.lane,
    p_hd: !!i.hd,
    p_creator: i.creatorId ?? null,
    p_look: i.look ?? null,
  });
  if (error) {
    const code = /FC_[A-Z_]+/.exec(error.message)?.[0] ?? "FC_UNKNOWN";
    throw new ReserveError(code, (error as any).details ?? error.hint ?? (code === "FC_UNKNOWN" ? error.message : null));
  }
  return data as string;
}

export async function listSets(sb: SupabaseClient, orgId: string, { limit = 50 } = {}): Promise<SetRow[]> {
  const { data, error } = await sb.from("sets").select(SET_COLS).eq("org_id", orgId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as SetRow[];
}

export async function getSet(sb: SupabaseClient, id: string): Promise<SetRow | null> {
  const { data } = await sb.from("sets").select(SET_COLS).eq("id", id).maybeSingle();
  return (data as SetRow) ?? null;
}

/** Ask the worker to release a set that has not started. RLS limits this to the member's own queued rows. */
export async function cancelSet(sb: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await sb.from("sets").update({ cancel_requested: true }).eq("id", id).eq("status", "queued").select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** A member-facing status word from the engine stage. */
export function stageLabel(s: Pick<SetRow, "status" | "stage" | "lane">): string {
  if (s.status === "done") return "Ready";
  if (s.status === "failed") return "Failed";
  // fc_reserve_set seeds stage = 'copy:submit'; the worker flips status to 'rendering' before it does anything
  if (s.status === "queued") return s.lane === "priority" ? "Starting" : "In the queue";
  const st = s.stage ?? "";
  if (st.startsWith("copy")) return "Writing the slides";
  if (st.startsWith("art:anchor")) return "Drawing the first frame";
  if (st.startsWith("art:frames")) return "Drawing the frames";
  if (st === "render") return "Composing";
  return s.lane === "priority" ? "Starting" : "In the queue";
}

/** The pricing-table words for a lane. */
export const LANE_LABEL: Record<Lane, string> = { batch: "Included", priority: "Priority" };
