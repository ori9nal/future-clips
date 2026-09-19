"use client";

/**
 * The product: Create · Library · Campaigns · Insights · Refer · Settings.
 *
 * Every number comes from the database: the campaigns are the live briefs,
 * the meter is the slides left this period, the sets are real rows polled
 * from /api/sets/:id and the tiles are their rendered slides. Nothing on
 * this surface is simulated.
 *
 * Design: one quiet system, light first, real dark theme on the same tokens
 * (app/dashboard.css). The photographs are the colour; lime is the one
 * action on each screen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CleanSeal } from "@/components/CleanSeal";
import { BrandKit } from "@/components/BrandKit";
import Link from "next/link";
import type { Account } from "@/lib/account";
import { planLabel, PLAN_LABELS } from "@/lib/plans";
import type { SetRow, Lane } from "@/lib/sets";
import type { AgencySummary, ReferredOrg, Commission } from "@/lib/referrals";

type Spec = {
  id: string; brand: string; product: string; niche: string;
  advertiser?: string; agency?: string;
  requirements?: { min_slides?: number; max_slides?: number; required_mention?: string; aspect?: string; must_show_app?: boolean };
  assets?: { palette?: string[]; logo?: string | null };
  content?: { style?: string };
  guidance?: { angles?: string[]; hook_style?: string; notes?: string[] };
  payout?: { rate_usd?: number; max_payout_usd?: number; budget_remaining_usd?: number; review_days?: number; platforms?: string[] };
  rules?: { banned_claims?: string[]; banned_topics?: string[]; tone?: string; disclosure?: string };
  client?: { agency?: { name?: string }; advertiser?: { name?: string }; closes?: string | null };
  deliverables?: { platforms?: string[]; due?: string | null; cta_url?: string | null; audience?: string | null };
  references?: { url?: string | null; note?: string | null }[];
};
type ViewerLite = { email: string; orgName: string; plan: string; billing: string; checkout: boolean; isPlatformOwner: boolean; engine: boolean; /** the demo workspace makes sets of exactly this many slides (D-045); the API forces it too */ demoSlides?: number; /** carousels this visitor has left today, and the daily allowance (R16); undefined when there is no limiter */ demoLeft?: number; demoPerVisitor?: number };
type Page = "create" | "library" | "campaigns" | "insights" | "partners" | "settings";
type Partners = { summary: AgencySummary; referred: ReferredOrg[]; commissions: Commission[] };
type SetView = SetRow & { label?: string; urls?: string[] };
type Theme = "light" | "dark";

const RMIN = 5, RMAX = 10;
/** The agency "Refer and earn" page stays off the clipper's surface until DECISIONS.md enables it. */
const REFER_ENABLED = process.env.NEXT_PUBLIC_FC_REFER === "1";
const PRESETS: [string, number, number][] = [["Short", 5, 6], ["Standard", 6, 8], ["Long", 8, 10]];
const TITLES: Record<Page, string> = { create: "Create", library: "Library", campaigns: "Campaigns", insights: "Insights", partners: "Refer and earn", settings: "Settings" };

const I = {
  create: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>,
  library: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="7" height="16" rx="1.5" /><rect x="14" y="4" width="7" height="16" rx="1.5" /></svg>,
  campaigns: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M4 12h16M4 17h10" /></svg>,
  insights: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6" /></svg>,
  partners: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" /><circle cx="17" cy="10" r="2.2" /><path d="M15.5 14.5c2.6.3 4.4 1.8 5 4.5" /></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.7a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.7a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" /></svg>,
  admin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z" /></svg>,
  menu: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>,
  chev: <svg viewBox="0 0 12 8" width="12" height="8"><path d="M1 1.5l5 5 5-5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>,
  down: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10l5 5 5-5M4 19h16" /></svg>,
};

const initial = (s: string) => (s.trim()[0] ?? "?").toUpperCase();
const swatch = (s: Spec) => s.assets?.palette?.[1] ?? s.assets?.palette?.[0] ?? "#C6F135";
const readable = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#151517";
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#151517" : "#FFFFFF";
};
const when = (iso: string) => {
  const d = new Date(iso); const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const STEP_ORDER = ["copy", "art:anchor", "art:frames", "render"];
const stepIndex = (stage: string | null, status: string) => {
  if (status === "done") return 4;
  if (status === "queued") return -1;
  const st = stage ?? "";
  const i = STEP_ORDER.findIndex((s) => st.startsWith(s));
  return i < 0 ? 0 : i;
};
/** The format in the clipper's words. A style id is a pipeline name and never reaches the screen. */
const styleWord = (s: string) => ({ native: "phone photos with captions", feed: "phone photos with captions", bedrock: "illustrated programme", mascot: "illustrated mascot", rail: "poster series", clinical: "clinical explainer", editorial: "editorial pages", document: "text pages", poster: "posters", pastel: "pastel pages" } as Record<string, string>)[s] ?? "slides";
/** API errors as sentences (PRODUCT.md finding 8). Unknown strings are never shown raw. */
const ERROR_SENTENCES: Record<string, string> = {
  "sign in required": "Your session has ended. Sign in again to keep going.",
  "pick a campaign": "Pick a campaign first.",
  "say what the set is about": "Say what the slideshow is about, a few words is enough.",
  "keep the ask under 400 characters": "Keep the idea under 400 characters.",
  "slides must be a count or range between 5 and 10": "Slides must be between 5 and 10.",
};
const sentence = (j: { error?: string; code?: string; detail?: string }, fallback: string) => {
  const e = String(j?.error ?? "");
  if (j?.code?.startsWith("FC_")) return j.detail ? `${e} ${j.detail}` : e;
  return ERROR_SENTENCES[e] ?? (e && /^[A-Z]/.test(e) && e.length > 20 ? e : fallback);
};
const usd = (n: number) => `$${n.toFixed(2)}`;
const pct = (r: number) => `${Math.round(r * 100)}%`;

export default function Dashboard({ viewer, specs, account: account0, sets: sets0, partners }: { viewer: ViewerLite; specs: Spec[]; account: Account; sets: SetRow[]; partners: Partners | null }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [menu, setMenu] = useState(false);
  const [page, setPage] = useState<Page>("create");
  const [account, setAccount] = useState(account0);
  const [sets, setSets] = useState<SetView[]>(sets0);
  /** sets that finished while this page was open: the metadata seal tells its story once, on those (Product, 2026-09-19) */
  const [justLanded, setJustLanded] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState<Spec | null>(null);
  const [ask, setAsk] = useState("");
  const [nMin, setNMin] = useState(6);
  const [nMax, setNMax] = useState(8);
  const [lane, setLane] = useState<Lane>("batch");
  const [hd, setHd] = useState(false);
  const [pop, setPop] = useState<"camp" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToastText] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ set: SetView; i: number } | null>(null);
  const [query, setQuery] = useState("");
  const [pickQ, setPickQ] = useState("");
  const [tab, setTab] = useState<"acct" | "plan" | "gen">("acct");
  // the plan the visitor chose on the site, carried through sign-in (lib/login.ts)
  const [want, setWant] = useState<"solo" | "grind" | "agency" | null>(null);
  const [engineGone, setEngineGone] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  const say = useCallback((m: string) => { setToastText(m); window.setTimeout(() => setToastText(null), 2800); }, []);

  // per-viewer conveniences live in the browser only
  useEffect(() => {
    try {
      const t = document.documentElement.dataset.theme; if (t === "light" || t === "dark") setTheme(t);
      const r = localStorage.getItem("fc.range"); if (r) { const [a, b] = r.split(",").map(Number); if (a >= RMIN && b <= RMAX && a <= b) { setNMin(a); setNMax(b); } }
      const c = localStorage.getItem("fc.campaign"); if (c) { const s = specs.find((x) => x.id === c); if (s) setActive(s); }
    } catch { /* private mode */ }
    // deep links: /app?page=settings&tab=plan
    const q = new URLSearchParams(window.location.search);
    const pg = q.get("page") as Page | null, tb = q.get("tab");
    if (pg && pg in TITLES) setPage(pg);
    if (tb === "acct" || tb === "plan" || tb === "gen") setTab(tb);
    // ?want= is the plan the visitor clicked on the site before signing in
    const w = q.get("want");
    if (w === "solo" || w === "grind" || w === "agency") setWant(w);
    if (q.get("checkout") === "done") window.setTimeout(() => say("Thanks. Your plan updates as soon as the payment is confirmed."), 400);
    // requirePlatformOwner() sends anyone else here; say so rather than
    // dropping them on the dashboard with an unexplained query string
    if (q.get("denied") === "admin") window.setTimeout(() => say("The admin area is for the Future Clips team."), 400);
    if (pg || tb || w || q.get("checkout") || q.get("denied")) window.history.replaceState(null, "", "/app");
  }, [specs, say]);
  const applyTheme = (t: Theme) => {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("fc.theme", t); } catch { /* ignore */ }
  };
  useEffect(() => { try { localStorage.setItem("fc.range", `${nMin},${nMax}`); } catch { /* ignore */ } }, [nMin, nMax]);
  useEffect(() => { try { if (active) localStorage.setItem("fc.campaign", active.id); } catch { /* ignore */ } }, [active]);
  // the campaign list closes on Escape and on any press outside it
  useEffect(() => {
    if (!pop) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPop(null); };
    const onDown = (e: PointerEvent) => { const t = e.target as Element | null; if (t && !t.closest(".pop, .campaignBtn")) setPop(null); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [pop]);

  const go = (p: Page) => { setPage(p); setPop(null); setMenu(false); if (viewRef.current) viewRef.current.scrollTop = 0; };

  // the demo (D-045): one length, priority, never HD — the API forces the same
  // The demo makes the selected brief's own minimum, not a constant: a set
  // under it cannot pass compliance (P-22). `viewer.demoSlides` is the
  // default the server would use when no campaign is chosen yet.
  const demoOn = (viewer.demoSlides ?? 0) > 0;
  const demoN = demoOn ? Math.max(viewer.demoSlides ?? 5, active?.requirements?.min_slides ?? 0) : 0;
  useEffect(() => {
    if (!demoN) return;
    setNMin(demoN); setNMax(demoN); setLane("priority"); setHd(false);
  }, [demoN]);
  const canPriority = account.cap.priority > 0 || !!demoN;
  const canHd = account.plan.hd_per_slide_usd != null;
  const hdIncluded = account.plan.hd_per_slide_usd === 0;
  const need = hd && hdIncluded ? 3 : 1;
  const left = lane === "priority" ? account.left.priority : account.left.batch;
  // a plan or a pack balance; there is no free tier (DECISIONS D-108)
  const paid = account.plan.slides_per_month > 0 || account.balance > 0;
  // the cheapest plan on sale, named from the database rather than from a
  // sentence that goes stale the day the allowances change (D-044)
  const cheapest = (account.sale ?? []).find((p) => p.slides_per_month > 0) ?? null;
  const renews = account.periodEnd ? new Date(account.periodEnd).toLocaleDateString(undefined, { month: "long", day: "numeric" }) : null;
  const label = planLabel(account.plan);

  // ── polling: any set that is not finished is asked about every few seconds ──
  const refreshAccount = useCallback(async () => {
    const r = await fetch("/api/me"); if (r.ok) { const j = await r.json(); setAccount(j.account); }
  }, []);
  useEffect(() => {
    const open = sets.filter((s) => s.status === "queued" || s.status === "rendering");
    if (!open.length) return;
    const every = open.some((s) => s.lane === "priority") ? 4000 : 20000;
    const t = window.setInterval(async () => {
      for (const s of open) {
        try {
          const r = await fetch(`/api/sets/${s.id}`); if (!r.ok) continue;
          const j = await r.json();
          setSets((prev) => prev.map((p) => (p.id === s.id ? { ...p, ...j.set, label: j.label, urls: j.slides } : p)));
          if (j.set.status === "done") { say(`${j.set.slides} slides are ready`); setJustLanded((p) => new Set(p).add(s.id)); refreshAccount(); }
          if (j.set.status === "failed") { say(`The set failed: ${j.set.error ?? "unknown error"}`); refreshAccount(); }
        } catch { /* next tick */ }
      }
    }, every);
    return () => window.clearInterval(t);
  }, [sets, say, refreshAccount]);
  // done sets from the server payload need their signed URLs once
  useEffect(() => {
    const need = sets.filter((s) => s.status === "done" && !s.urls);
    if (!need.length) return;
    (async () => {
      for (const s of need.slice(0, 12)) {
        try {
          const r = await fetch(`/api/sets/${s.id}`); if (!r.ok) continue;
          const j = await r.json();
          setSets((prev) => prev.map((p) => (p.id === s.id ? { ...p, label: j.label, urls: j.slides } : p)));
        } catch { /* leave it */ }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets.map((s) => s.id + s.status).join("|")]);

  const pickCamp = (s: Spec) => {
    setActive(s); setPop(null); setErr(null);
    const q = s.requirements ?? {};
    const lo = Math.max(RMIN, q.min_slides ?? RMIN), hi = Math.min(RMAX, q.max_slides ?? RMAX);
    setNMin((m) => Math.min(Math.max(m, lo), hi)); setNMax((m) => Math.max(Math.min(m, hi), lo));
    window.setTimeout(() => taRef.current?.focus(), 50);
  };

  async function run() {
    if (busy) return;
    if (!active) { say("Pick a campaign first"); setPop("camp"); return; }
    const topic = ask.trim();
    if (!topic) { say("Say what the slideshow is about"); taRef.current?.focus(); return; }
    if (!demoN && left < nMax * need) { setErr(`Not enough slides left: ${left} on the ${lane === "priority" ? "priority" : "monthly"} allowance, and this set needs up to ${nMax * need}${need > 1 ? " (HD uses 3 per slide)" : ""}.`); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/sets", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaign: active.id, ask: topic, style: active.content?.style ?? "native", slides: nMin === nMax ? nMin : { min: nMin, max: nMax }, lane, hd }) });
      const j = await r.json();
      if (!r.ok) { setErr(sentence(j, "Could not start the slideshow. Try again in a moment.")); return; }
      const row: SetView = {
        id: j.id, org_id: "", campaign_id: active.id, style: active.content?.style ?? "native", ask: topic, slides: null, slides_min: nMin, slides_max: nMax,
        reserved_slides: nMax, quality: hd ? "high" : "medium", lane, hd, status: "queued", stage: "copy:submit", caption: null, cost_usd: null,
        files_json: null, content_json: null, compliance_json: null, error: null, cancel_requested: false, created_at: new Date().toISOString(),
        started_at: null, finished_at: null, updated_at: new Date().toISOString(), label: j.started ? "Starting" : "In the queue",
      };
      setSets((prev) => [row, ...prev]);
      setAsk("");
      refreshAccount();
      const n = nMin === nMax ? `${nMin}` : `${nMin} to ${nMax}`;
      say(j.started ? "Making it now. A minute or two." : lane === "priority" ? `Kept: ${n} slides, starts as soon as rendering is switched on` : `Queued: ${n} slides, back within the day`);
    } catch (e: any) {
      setErr("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(s: SetView) {
    const r = await fetch(`/api/sets/${s.id}`, { method: "DELETE" });
    if (!r.ok) { say("Too late to cancel, it has already started."); return; }
    const j = await r.json().catch(() => ({}));
    if (j.released) {
      say("Cancelled. The slides are back on your balance.");
      setSets((prev) => prev.map((p) => (p.id === s.id ? { ...p, status: "failed", stage: "failed", error: "cancelled before it started", cancel_requested: true } : p)));
      refreshAccount();
    } else {
      say("Cancelled. The slides go back on the next tick.");
      setSets((prev) => prev.map((p) => (p.id === s.id ? { ...p, cancel_requested: true } : p)));
    }
  }

  /** Hosted checkout (Dodo). Until it is connected the buttons fall back to email. */
  async function buy(body: { plan?: string; yearly?: boolean; pack?: string }) {
    if (!viewer.checkout) { window.location.href = `mailto:team@thefutureclips.com?subject=${encodeURIComponent(body.plan ? `Upgrade to ${PLAN_LABELS[body.plan] ?? body.plan}` : `Slide pack ${body.pack}`)}`; return; }
    setBusy(true);
    try {
      const r = await fetch("/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { say(j.error ?? "Checkout is unavailable right now"); return; }
      window.location.href = j.url;
    } finally { setBusy(false); }
  }
  async function portal() {
    const r = await fetch("/api/billing/portal", { method: "POST" });
    const j = await r.json();
    if (!r.ok) { say(j.error ?? "The billing portal is unavailable"); return; }
    window.location.href = j.url;
  }

  const filteredSpecs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? specs.filter((s) => `${s.brand} ${s.product} ${s.niche}`.toLowerCase().includes(q)) : specs;
  }, [specs, query]);
  const specById = useMemo(() => Object.fromEntries(specs.map((s) => [s.id, s])), [specs]);
  const recent = sets.slice(0, 4);
  const madeThisPeriod = sets.filter((s) => s.status === "done" && s.created_at >= account.usage.period_start).length;
  const avg = (() => { const d = sets.filter((s) => s.status === "done" && s.slides != null); return d.length ? (d.reduce((a, s) => a + (s.slides ?? 0), 0) / d.length).toFixed(1) : "–"; })();
  // A demo set is exactly four slides — hook, two items, closer — so an ask that
  // promises five things cannot fit: the model writes the five it was asked for,
  // the judge rejects the count three times and the set fails having paid for
  // three copy attempts (~$0.17, measured 2026-09-19). The demo therefore offers
  // no counted angles and no counted example. R17 asks the engine to trim instead.
  const angles = demoN ? [] : (active?.guidance?.angles ?? []);
  const lo = Math.max(RMIN, active?.requirements?.min_slides ?? RMIN), hi = Math.min(RMAX, active?.requirements?.max_slides ?? RMAX);
  const rangeWord = nMin === nMax ? `${nMin} slides` : `${nMin} to ${nMax} slides`;
  const usedPct = account.cap.batch ? Math.min(100, Math.round((account.usage.slides_used / account.cap.batch) * 100)) : 0;

  const SetCard = ({ s, full }: { s: SetView; full: boolean }) => {
    const spec = specById[s.campaign_id];
    const open = s.status === "queued" || s.status === "rendering";
    const count = s.slides ?? s.slides_max;
    const idx = stepIndex(s.stage, s.status);
    const cancelled = /^cancelled/i.test(s.error ?? "");
    return (
      <article className="set">
        <div className="head">
          <div className="t">
            <h3 title={s.ask}>{s.ask}</h3>
            <p className="meta">{spec?.brand ?? s.campaign_id}, {count} slides, {s.lane === "priority" ? "priority" : "within the day"}{s.hd ? ", HD" : ""}, {when(s.created_at)}</p>
          </div>
          <div className="actions">
            {s.status === "done" && <span className="pill ok">Ready</span>}
            {s.status === "failed" && <span className={`pill ${cancelled ? "" : "danger"}`}>{cancelled ? "Cancelled" : "Failed"}</span>}
            {open && s.status === "queued" && !s.cancel_requested && <button className="btn quiet sm" onClick={() => cancel(s)}>Cancel</button>}
            {open && s.cancel_requested && <span className="pill">Cancelling</span>}
            {s.status === "done" && s.urls?.length ? (
              <>
                <a className="btn sm" href={`/api/sets/${s.id}/download`}>{I.down} Download all</a>
                <button className="btn sm" onClick={() => { if (spec) pickCamp(spec); setAsk(s.ask); go("create"); say("Loaded. Change what you like and make it again."); }}>Make another</button>
              </>
            ) : null}
          </div>
        </div>
        {open && (
          <div className="steps" aria-label="Progress">
            {["Writing", "First frame", "Drawing", "Composing"].map((name, i) => (
              <span key={name} className={i < idx ? "done" : i === idx ? "now" : ""}><i />{name}</span>
            ))}
          </div>
        )}
        {s.status === "failed" && !cancelled && <p className="err">{s.error}. The slides went back to your balance.</p>}
        {s.status === "done" && s.caption && <p className="caption"><span className="k">Caption</span><span>{s.caption}</span></p>}
        {s.status === "done" && <CleanSeal clean={(s.compliance_json as { clean?: React.ComponentProps<typeof CleanSeal>["clean"] } | null)?.clean} slides={s.slides ?? undefined} fresh={justLanded.has(s.id)} />}
        {(open || (s.status === "done" && s.urls?.length)) && (
          <div className="strip" data-ratio={({ native: "9:16", mascot: "9:16", bedrock: "4:5", clinical: "4:5", editorial: "4:5", document: "4:5", pastel: "4:5", poster: "4:5", rail: "4:5" } as Record<string, string>)[s.style] ?? "3:4"}>
            {s.status === "done" && s.urls?.length
              ? s.urls.slice(0, full ? undefined : 8).map((url, i) => (
                <button key={url} className="tile" onClick={() => setDrawer({ set: s, i })} aria-label={`Open slide ${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" loading="lazy" />
                  <span className="ix">{i + 1}</span>
                </button>
              ))
              : Array.from({ length: count }, (_, i) => <div key={i} className="tile gen"><span className="ix">{i + 1}</span></div>)}
          </div>
        )}
      </article>
    );
  };

  /**
   * What the chosen brief actually asks for. The picker only had brand,
   * niche and a slide range; a brief carries the money, the dates, the rules
   * and the posts it wants imitated, and a clipper writing to it should see
   * all of it without leaving the composer.
   */
  const Brief = ({ s }: { s: Spec }) => {
    const money = (v?: number) => (typeof v === "number" && v > 0 ? `$${v.toLocaleString("en-US")}` : null);
    const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null);
    const platforms = s.deliverables?.platforms?.length ? s.deliverables.platforms : s.payout?.platforms ?? [];
    const runBy = s.client?.agency?.name ?? s.agency;
    const facts: [string, string][] = [
      ["Pays", s.payout?.rate_usd ? `$${s.payout.rate_usd.toFixed(2)} per 1k views` : ""],
      ["Budget left", money(s.payout?.budget_remaining_usd) ?? ""],
      ["Closes", day(s.client?.closes) ?? ""],
      ["Due", day(s.deliverables?.due) ?? ""],
      ["Goes on", platforms.join(", ")],
      ["Must mention", s.requirements?.required_mention ?? ""],
      ["Disclosure", s.rules?.disclosure ?? ""],
      ["Reviewed in", s.payout?.review_days ? `${s.payout.review_days} days` : ""],
    ].filter(([, v]) => v) as [string, string][];
    const avoid = [...(s.rules?.banned_claims ?? []), ...(s.rules?.banned_topics ?? [])].slice(0, 6);
    const refs = (s.references ?? []).filter((r) => r.url || r.note);
    if (!facts.length && !avoid.length && !refs.length && !s.deliverables?.audience) return null;
    return (
      <details className="brief">
        <summary>
          <b>What this brief wants</b>
          {runBy ? <span>Run by {runBy}{s.client?.advertiser?.name ?? s.advertiser ? ` for ${s.client?.advertiser?.name ?? s.advertiser}` : ""}</span> : null}
        </summary>
        {facts.length > 0 && (
          <dl className="briefFacts">
            {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        )}
        {s.deliverables?.audience && <p className="briefLine"><span>Who it is for</span>{s.deliverables.audience}</p>}
        {s.rules?.tone && <p className="briefLine"><span>Tone</span>{s.rules.tone}</p>}
        {avoid.length > 0 && (
          <p className="briefLine"><span>Never say</span>{avoid.join(" · ")}</p>
        )}
        {refs.length > 0 && (
          <div className="briefRefs">
            <span>Posts to imitate</span>
            <ul>
              {refs.map((r, i) => (
                <li key={i}>
                  {r.url ? <a href={r.url} target="_blank" rel="noreferrer noopener">Reference {i + 1}</a> : <b>Reference {i + 1}</b>}
                  {r.note ? ` — ${r.note}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </details>
    );
  };

  const Empty = ({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) => (
    <div className="empty"><h3>{title}</h3><p>{body}</p>{action}</div>
  );

  return (
    <div className={`app${menu ? " menu" : ""}`}>
      <button className="sideScrim" aria-label="Close menu" onClick={() => setMenu(false)} />
      <aside className="side">
        <button className="ws" onClick={() => go("settings")} title="Workspace settings">
          <span className="mark">{initial(viewer.orgName)}</span>
          <span className="name">{viewer.orgName}</span>
          <span className="plan">{label}</span>
        </button>
        <nav className="nav" aria-label="Main">
          {(["create", "library", "campaigns", "insights"] as Page[]).map((id) => (
            <button key={id} className={page === id ? "on" : ""} onClick={() => go(id)}>{I[id]}{TITLES[id]}</button>
          ))}
          {partners && REFER_ENABLED && <button className={page === "partners" ? "on" : ""} onClick={() => go("partners")}>{I.partners}Refer and earn</button>}
        </nav>
        <div className="foot nav">
          {viewer.isPlatformOwner && <Link href="/admin">{I.admin}Admin</Link>}
          <button className={page === "settings" ? "on" : ""} onClick={() => go("settings")}>{I.settings}Settings</button>
          <div className="themeRow"><span>Dark theme</span><button className={`sw${theme === "dark" ? " on" : ""}`} role="switch" aria-checked={theme === "dark"} aria-label="Dark theme" onClick={() => applyTheme(theme === "dark" ? "light" : "dark")} /></div>
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <button className="btn quiet burger" onClick={() => setMenu(true)} aria-label="Menu">{I.menu}</button>
          <h1>{TITLES[page]}</h1>
          <span className="grow" />
          {demoN ? (
            // the demo does not spend the org's allowance and the visitor cannot move it,
            // so the header says what the demo gives instead of a meter (Product, 2026-09-19).
            // The three-a-day cap lives in the rate limiter; R16 asks for the live count.
            <div className="meter demo">
              <div className="row"><span>Demo</span><b className="num">{demoN} slides a carousel, up to 3 a day</b></div>
            </div>
          ) : paid ? (
            <div className="meter" title={account.cap.batch ? `${account.usage.slides_used} of ${account.cap.batch} used this period${account.balance ? `, plus ${account.balance} purchased` : ""}` : `${account.balance} purchased slides`}>
              <div className="row"><span>Slides left</span><b className="num">{account.left.batch}{account.cap.batch ? ` of ${account.cap.batch + account.balance}` : ""}{canPriority ? <span className="prio">, {account.left.priority} priority</span> : null}</b></div>
              <div className="bar"><i style={{ width: `${100 - usedPct}%` }} /></div>
            </div>
          ) : <button className="btn primary sm" onClick={() => { go("settings"); setTab("plan"); }}>Choose a plan</button>}
        </header>

        <div className="view" ref={viewRef}>
          <div className="page">
            {/* ══ CREATE ══ */}
            {page === "create" && (
              <>
                {!viewer.engine && paid && !engineGone && (
                  <div className="notice warn"><span>Rendering on this host is switched off. Anything you queue is kept and starts as soon as it is on.</span><button className="x" onClick={() => setEngineGone(true)} aria-label="Dismiss">×</button></div>
                )}
                {!paid && !demoN && (
                  <div className="notice"><span>Choose a plan to start making slideshows. {cheapest ? `${cheapest.label ?? PLAN_LABELS[cheapest.id] ?? cheapest.id} is $${cheapest.price_usd_month} a month for ${cheapest.slides_per_month} slides. ` : ""}Every plan opens all the campaigns and styles; Pro and Studio add priority delivery and HD.</span><button className="btn primary sm" onClick={() => { go("settings"); setTab("plan"); }}>Choose a plan</button></div>
                )}
                {paid && left === 0 && !demoN && (
                  <div className="notice warn"><span>You have 0 slides left on this allowance{renews ? `. It renews on ${renews}` : ""}. A pack tops it up now.</span><button className="btn sm" onClick={() => { go("settings"); setTab("plan"); }}>Add a pack</button></div>
                )}
                <section className="composer" aria-label="Make a slideshow">
                  <div className="field campaignSel">
                    <span className="label">Campaign</span>
                    <button className="campaignBtn" onClick={() => setPop(pop === "camp" ? null : "camp")} aria-haspopup="listbox" aria-expanded={pop === "camp"}>
                      <span className="mark" style={active ? { background: swatch(active), color: readable(swatch(active)) } : { background: "var(--hover)", color: "var(--text-3)" }}>{active ? initial(active.brand) : "?"}</span>
                      <span className="t"><b>{active ? active.brand : "Choose a campaign"}</b><small>{active ? `${active.product}, ${active.niche}` : "The brief the slideshow is written to"}</small></span>
                      <span className="chev">{I.chev}</span>
                    </button>
                    {pop === "camp" && (
                      <div className="pop list" role="listbox">
                        {specs.length > 8 && (
                          <div className="search pick"><input className="input" type="search" autoFocus placeholder="Search brand, product or niche" value={pickQ} onChange={(e) => setPickQ(e.target.value)} aria-label="Search campaigns" /></div>
                        )}
                        {specs.filter((s) => !pickQ.trim() || `${s.brand} ${s.product} ${s.niche}`.toLowerCase().includes(pickQ.trim().toLowerCase())).map((s) => (
                          <button key={s.id} className={`mi${active?.id === s.id ? " sel" : ""}`} role="option" aria-selected={active?.id === s.id} onClick={() => { pickCamp(s); setPickQ(""); }}>
                            <span className="mark" style={{ background: swatch(s), color: readable(swatch(s)) }}>{initial(s.brand)}</span>
                            <span><span>{s.brand}</span><small>{s.product}, {styleWord(s.content?.style ?? "native")}</small></span>
                          </button>
                        ))}
                        {!specs.length && <div className="mi">No live campaigns yet.</div>}
                        {specs.length > 0 && pickQ.trim() && !specs.some((s) => `${s.brand} ${s.product} ${s.niche}`.toLowerCase().includes(pickQ.trim().toLowerCase())) && <div className="mi">No campaign matches "{pickQ.trim()}".</div>}
                      </div>
                    )}
                  </div>
                  {active && <Brief s={active} />}
                  <div className="field">
                    <label className="label" htmlFor="ask">What should this slideshow be about?</label>
                    <textarea id="ask" className="textarea" ref={taRef} rows={3} value={ask} maxLength={400} disabled={!active}
                      placeholder={active ? (demoN ? `One angle, in your own words. For example: what changed my ${active.niche} this year` : angles.length ? "Pick an angle below, or write your own. Enter makes it, Shift+Enter is a new line." : `An angle, a list, a lesson. For example: the 5 ${active.niche} habits that finally stuck`) : "Choose a campaign first"}
                      onChange={(e) => setAsk(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); } }} />
                    {angles.length > 0 && (
                      <div className="angles" style={{ marginTop: 10 }}>
                        {angles.map((a) => <button key={a} className={ask === a ? "on" : ""} onClick={() => { setAsk(a); taRef.current?.focus(); }}>{a}</button>)}
                      </div>
                    )}
                  </div>
                  {!demoN && <BrandKit />}
                  <div className="controls">
                    <div className="control">
                      <span>Slides</span>
                      <div className="seg" role="radiogroup" aria-label="Slides">
                        {demoN
                          ? <button role="radio" aria-checked className="on" disabled>Demo · {demoN} slides</button>
                          : PRESETS.map(([l, a, b]) => {
                            const A = Math.max(lo, a), B = Math.min(hi, b);
                            return <button key={l} role="radio" aria-checked={A === nMin && B === nMax} className={A === nMin && B === nMax ? "on" : ""} disabled={A > B} onClick={() => { setNMin(A); setNMax(B); }}>{l}</button>;
                          })}
                      </div>
                      <span className="with">{demoN ? "The demo makes a short carousel from any campaign." : <>{rangeWord}{nMin !== nMax ? ", we pick the best fit" : ""}{active && (lo > RMIN || hi < RMAX) ? `. This brief allows ${lo} to ${hi}.` : ""}</>}</span>
                    </div>
                    <div className="control">
                      <span>Delivery</span>
                      <div className="seg" role="radiogroup" aria-label="Delivery">
                        <button role="radio" aria-checked={lane === "batch"} className={lane === "batch" ? "on" : ""} disabled={!!demoN} onClick={() => setLane("batch")}>Within the day</button>
                        <button role="radio" aria-checked={lane === "priority"} className={lane === "priority" ? "on" : ""} disabled={!canPriority} onClick={() => setLane("priority")}>Priority</button>
                      </div>
                      <span className="with">{demoN ? "A minute or two. The demo always renders now." : canPriority ? (lane === "priority" ? "A minute or two, from your priority allowance" : "Back within the day, from your monthly allowance") : "Priority delivery comes with Pro and Studio"}</span>
                    </div>
                    <div className="control">
                      <span>HD</span>
                      <div className="with"><button className={`sw${hd ? " on" : ""}`} role="switch" aria-checked={hd} aria-label="HD" disabled={!canHd} onClick={() => setHd(!hd)} /><span>{canHd ? (hdIncluded ? "Sharper frames, uses 3 slides each" : `Sharper frames, +$${account.plan.hd_per_slide_usd} a slide`) : "Comes with Pro and Studio"}</span></div>
                    </div>
                  </div>
                  <div className="foot">
                    <span className={`cost${!demoN && paid && left < nMax * need ? " bad" : ""}`}>{demoN
                      ? `A real carousel, ${demoN} slides, on us. Pick a plan for full-length ones.`
                      : !paid
                        ? "Needs a plan."
                        : left < nMax * need
                          ? `This needs up to ${nMax * need} ${lane === "priority" ? "priority " : ""}slides and you have ${left} left.`
                          : need > 1
                            ? `${rangeWord} at HD, up to ${nMax * need} of your ${left} ${lane === "priority" ? "priority " : ""}slides.`
                            : `Uses up to ${nMax} of your ${left} ${lane === "priority" ? "priority " : ""}slides.`}</span>
                    <button className="btn primary lg" disabled={!active || !paid || busy || !ask.trim()} onClick={run}>{busy ? "Starting" : demoN ? `Make my ${demoN} slides` : "Make the slideshow"}</button>
                  </div>
                  {err && <p className="err" role="alert">{err}</p>}
                </section>

                {recent.length > 0 && (
                  <section>
                    <header style={{ marginBottom: 12 }}><h2>Recent</h2><button className="btn quiet sm" onClick={() => go("library")}>Open the library</button></header>
                    <div className="setList">{recent.map((s) => <SetCard key={s.id} s={s} full={false} />)}</div>
                  </section>
                )}
              </>
            )}

            {/* ══ LIBRARY ══ */}
            {page === "library" && (
              <>
                <header><div><h1>Everything you have made</h1><p>Newest first. Open a slide to read it or download it on its own.</p></div><button className="btn primary" onClick={() => go("create")}>New slideshow</button></header>
                {sets.length ? <div className="setList">{sets.map((s) => <SetCard key={s.id} s={s} full />)}</div>
                  : <Empty title="Nothing here yet" body="Slideshows you make appear here, newest first." action={<button className="btn primary" onClick={() => go("create")}>Make your first one</button>} />}
              </>
            )}

            {/* ══ CAMPAIGNS ══ */}
            {page === "campaigns" && (
              <>
                <header><div><h1>Live campaigns</h1><p>Every brief you can write to. Pick one to start a slideshow.</p></div></header>
                <div className="search">{I.search}<input className="input" type="search" placeholder="Search by brand or niche" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
                <div className="cgrid">
                  {filteredSpecs.map((s) => (
                    <button key={s.id} className={`ccard${active?.id === s.id ? " on" : ""}`} onClick={() => { pickCamp(s); go("create"); }}>
                      <div className="ch"><span className="mark" style={{ background: swatch(s), color: readable(swatch(s)) }}>{initial(s.brand)}</span><span><b>{s.brand}</b><small>{s.product}</small></span></div>
                      <div className="tags">
                        <span className="pill">{s.niche}</span>
                        <span className="pill">{styleWord(s.content?.style ?? "native")}</span>
                        <span className="pill">{s.requirements?.min_slides ?? 5} to {s.requirements?.max_slides ?? 10} slides</span>
                        {s.payout?.rate_usd ? <span className="pill">${s.payout.rate_usd.toFixed(2)} per 1k</span> : null}
                        {s.client?.closes ? <span className="pill">closes {new Date(s.client.closes).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span> : null}
                      </div>
                    </button>
                  ))}
                </div>
                {!filteredSpecs.length && <Empty title="No campaign matches" body="Try another word, or clear the search." />}
              </>
            )}

            {/* ══ INSIGHTS ══ */}
            {page === "insights" && (
              <>
                <header><div><h1>This period</h1><p>Since {new Date(account.usage.period_start).toLocaleDateString(undefined, { month: "long", day: "numeric" })}. Real counts, nothing estimated.</p></div></header>
                <div className="stats">
                  <div className="stat"><span className="k">Slideshows made</span><span className="v">{madeThisPeriod}</span><span className="d">finished this period</span></div>
                  <div className="stat"><span className="k">Slides used</span><span className="v">{account.usage.slides_used}</span><span className="d">of {account.cap.batch} in the month</span></div>
                  {canPriority && <div className="stat"><span className="k">Priority used</span><span className="v">{account.usage.priority_slides_used}</span><span className="d">of {account.cap.priority}</span></div>}
                  <div className="stat"><span className="k">Slides per slideshow</span><span className="v">{avg}</span><span className="d">average of finished ones</span></div>
                  {canHd && <div className="stat"><span className="k">HD slides</span><span className="v">{account.usage.hd_slides_used}</span><span className="d">{hdIncluded ? "3 slides each" : `$${account.plan.hd_per_slide_usd} each`}</span></div>}
                </div>
                <section>
                  <header style={{ marginBottom: 12 }}><h2>Latest finished</h2></header>
                  {sets.some((s) => s.status === "done")
                    ? <div className="setList">{sets.filter((s) => s.status === "done").slice(0, 3).map((s) => <SetCard key={s.id} s={s} full={false} />)}</div>
                    : <Empty title="No finished slideshows yet" body="Numbers fill in as slideshows complete." />}
                </section>
              </>
            )}

            {/* ══ REFER AND EARN ══ */}
            {page === "partners" && partners && REFER_ENABLED && (() => {
              const P = partners.summary;
              const link = `https://www.thefutureclips.com/signup?ref=${P.code}`;
              const copy = async () => { try { await navigator.clipboard.writeText(link); say("Link copied"); } catch { say(link); } };
              return (
                <>
                  <header><div><h1>Bring your clippers, earn on every subscription</h1><p>{pct(P.rate)} of what your referred accounts pay, {pct(0.2)} to start and up to 30% as your roster grows. Settled monthly, paid by us.</p></div></header>
                  <div className="card"><div className="body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <span className="label">Your link</span>
                    <div className="linkbox"><code>{link}</code><button className="btn primary sm" onClick={copy}>Copy link</button></div>
                    <p className="hint">Anyone who signs up through it is credited to you. Your code is {P.code}.</p>
                  </div></div>
                  <div className="stats">
                    <div className="stat"><span className="k">Referred accounts</span><span className="v">{P.referred}</span><span className="d">{P.paying} on a paid plan</span></div>
                    <div className="stat"><span className="k">Your rate</span><span className="v">{pct(P.rate)}</span><span className="d">{P.next_tier ? `${pct(P.next_tier.rate)} from ${P.next_tier.min_referred} referred` : "top tier"}</span></div>
                    <div className="stat"><span className="k">Owed to you</span><span className="v">{usd(P.pending_usd)}</span><span className="d">settled at month end</span></div>
                    <div className="stat"><span className="k">Paid so far</span><span className="v">{usd(P.paid_usd)}</span><span className="d">all time</span></div>
                  </div>
                  {P.next_tier && (
                    <div className="card"><div className="body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><b>Next tier</b><span className="muted">{P.next_tier.min_referred - P.referred} more referred accounts unlock {pct(P.next_tier.rate)}</span></div>
                      <div className="progress"><i style={{ width: `${Math.min(100, Math.round((P.referred / P.next_tier.min_referred) * 100))}%` }} /></div>
                    </div></div>
                  )}
                  <section>
                    <header style={{ marginBottom: 12 }}><h2>Referred accounts</h2></header>
                    {partners.referred.length ? (
                      <div className="card"><table className="table">
                        <thead><tr><th>Workspace</th><th>Plan</th><th>Billing</th><th>Since</th></tr></thead>
                        <tbody>{partners.referred.map((r) => <tr key={r.id}><td>{r.name}</td><td>{PLAN_LABELS[r.plan] ?? r.plan}</td><td>{r.billing_status === "none" ? <span className="pill">Not paying yet</span> : r.billing_status === "active" ? <span className="pill ok">Active</span> : <span className="pill warn">{r.billing_status.replace("_", " ")}</span>}</td><td>{when(r.referred_at)}</td></tr>)}</tbody>
                      </table></div>
                    ) : <Empty title="No referrals yet" body="Share your link with your roster. Accounts that sign up through it appear here." />}
                  </section>
                  <section>
                    <header style={{ marginBottom: 12 }}><h2>Commissions</h2></header>
                    {partners.commissions.length ? (
                      <div className="card"><table className="table">
                        <thead><tr><th>Period</th><th className="n">Revenue</th><th className="n">Rate</th><th className="n">Commission</th><th>Status</th></tr></thead>
                        <tbody>{partners.commissions.map((c) => <tr key={c.id}><td>{new Date(c.period_start).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</td><td className="n">{usd(c.revenue_usd)}</td><td className="n">{pct(c.rate)}</td><td className="n"><b>{usd(c.commission_usd)}</b></td><td>{c.status === "paid" ? <span className="pill ok">Paid {c.paid_at ? new Date(c.paid_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}</span> : c.status === "pending" ? <span className="pill">Pending</span> : <span className="pill">Void</span>}</td></tr>)}</tbody>
                      </table></div>
                    ) : <p className="muted">Commissions appear here as your referred accounts pay each month. To set your payout details, email <a href="mailto:team@thefutureclips.com?subject=Partner%20payout%20details">team@thefutureclips.com</a>.</p>}
                  </section>
                </>
              );
            })()}

            {/* ══ SETTINGS ══ */}
            {page === "settings" && (
              <>
                <div className="tabs" role="tablist">
                  {([["acct", "Account"], ["plan", "Plan and slides"], ["gen", "Defaults"]] as ["acct" | "plan" | "gen", string][]).map(([id, l]) => (
                    <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{l}</button>
                  ))}
                </div>
                {tab === "acct" && (
                  <div className="card rows">
                    <div className="rowi"><div className="l"><b>Email</b><small>Where sign-in links and receipts go</small></div><div className="r">{viewer.email}</div></div>
                    <div className="rowi"><div className="l"><b>Workspace</b><small>Every slideshow and slide counts against this workspace</small></div><div className="r">{viewer.orgName}</div></div>
                    <div className="rowi"><div className="l"><b>Password</b><small>There is none. You sign in with an emailed link.</small></div></div>
                    <div className="rowi"><div className="l"><b>Sign out</b><small>On this device</small></div><div className="r"><form action="/auth/signout" method="post"><button className="btn sm" type="submit">Sign out</button></form></div></div>
                    <div className="rowi"><div className="l"><b>Delete account</b><small>Email us from this address. We confirm, then remove everything within the retention periods in the Privacy Policy.</small></div><div className="r"><a className="btn sm danger" href="mailto:team@thefutureclips.com?subject=Delete%20my%20account">Email us</a></div></div>
                  </div>
                )}
                {tab === "plan" && (
                  <div className="card rows">
                    <div className="rowi"><div className="l"><b>{label} plan</b><small>{account.plan.slides_per_month ? `${account.plan.slides_per_month} slides a month` : "No plan yet"}{account.plan.priority_slides_per_month ? `, ${account.plan.priority_slides_per_month} priority` : ""}{hdIncluded ? ", HD included" : ""}{account.periodEnd ? `, renews ${new Date(account.periodEnd).toLocaleDateString()}` : ""}</small></div>
                      <div className="r">
                        {(["solo", "grind", "agency"] as const).filter((p) => p !== account.plan.id).map((p) => (
                          <button key={p} className={`btn sm${want === p ? " go" : ""}`} disabled={busy} onClick={() => buy({ plan: p })}>{want === p ? "Continue to" : !paid ? "Choose" : ["solo", "grind", "agency"].indexOf(p) > ["solo", "grind", "agency"].indexOf(account.plan.id) ? "Upgrade to" : "Switch to"} {PLAN_LABELS[p]}</button>
                        ))}
                        <a className="btn quiet sm" href="https://www.thefutureclips.com/#pricing">Compare plans</a>
                      </div></div>
                    <div className="rowi"><div className="l"><b>Slides left</b><small>{account.cap.batch ? "This period's allowance, it resets on your billing date" : "Purchased slides, they never expire"}{account.cap.batch && account.balance ? `, plus ${account.balance} purchased slides that never expire` : ""}</small></div><div className="r"><span className="num" style={{ fontSize: 24, fontWeight: 600 }}>{account.left.batch}</span></div></div>
                    {canPriority && <div className="rowi"><div className="l"><b>Priority left</b><small>Made in minutes instead of within the day</small></div><div className="r"><span className="num" style={{ fontSize: 24, fontWeight: 600 }}>{account.left.priority}</span></div></div>}
                    <div className="rowi"><div className="l"><b>Slide packs</b><small>{paid ? "Extra slides on top of any plan. They never expire and are used after the month's allowance." : "Packs top up a plan. Choose a plan first."}{viewer.checkout ? "" : " Checkout is being connected, so the buttons email us for now."}</small></div>
                      <div className="r">{(account.packs.length ? account.packs : [{ id: "p100", slides: 100, price_usd: 8 }, { id: "p250", slides: 250, price_usd: 18 }, { id: "p600", slides: 600, price_usd: 40 }]).map((k) => <button key={k.id} className="btn sm" disabled={busy || !paid} onClick={() => buy({ pack: k.id })}>{k.slides} for ${k.price_usd}</button>)}</div></div>
                    <div className="rowi"><div className="l"><b>Billing</b><small>{viewer.billing === "none" ? "No subscription on file yet." : `Subscription ${viewer.billing.replace("_", " ")}. You keep access until the end of your billing period.`}</small></div><div className="r">{viewer.checkout && viewer.billing !== "none" ? <button className="btn sm" onClick={portal}>Manage billing</button> : <a className="btn sm" href="mailto:team@thefutureclips.com?subject=Subscription">Email us</a>}</div></div>
                  </div>
                )}
                {tab === "gen" && (
                  <div className="card rows">
                    <div className="rowi"><div className="l"><b>Slides per slideshow</b><small>Used for every new slideshow until you change it in the composer</small></div>
                      <div className="r"><select className="select" value={`${nMin},${nMax}`} onChange={(e) => { const [a, b] = e.target.value.split(",").map(Number); setNMin(a); setNMax(b); }}>
                        {PRESETS.map(([l, a, b]) => <option key={l} value={`${a},${b}`}>{l}, {a} to {b}</option>)}
                        {[5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={`${n},${n}`}>Exactly {n}</option>)}
                      </select></div></div>
                    <div className="rowi"><div className="l"><b>Priority delivery</b><small>{canPriority ? "Made in minutes, from the priority allowance" : "Comes with Pro and Studio"}</small></div><div className="r"><button className={`sw${lane === "priority" ? " on" : ""}`} role="switch" aria-checked={lane === "priority"} disabled={!canPriority} onClick={() => setLane(lane === "priority" ? "batch" : "priority")} aria-label="Priority delivery" /></div></div>
                    <div className="rowi"><div className="l"><b>HD</b><small>{canHd ? (hdIncluded ? "Sharper frames. An HD slide uses 3 slides of your allowance." : `Sharper frames, +$${account.plan.hd_per_slide_usd} a slide.`) : "Comes with Pro and Studio"}</small></div><div className="r"><button className={`sw${hd ? " on" : ""}`} role="switch" aria-checked={hd} disabled={!canHd} onClick={() => setHd(!hd)} aria-label="HD" /></div></div>
                    <div className="rowi"><div className="l"><b>Dark theme</b><small>Remembered on this device</small></div><div className="r"><button className={`sw${theme === "dark" ? " on" : ""}`} role="switch" aria-checked={theme === "dark"} onClick={() => applyTheme(theme === "dark" ? "light" : "dark")} aria-label="Dark theme" /></div></div>
                  </div>
                )}
              </>
            )}

            <footer className="legal">
              <Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/acceptable-use">Acceptable use</Link><Link href="/refunds">Refunds</Link><Link href="/accessibility">Accessibility</Link>
              <a href="mailto:team@thefutureclips.com">team@thefutureclips.com</a>
            </footer>
          </div>
        </div>
      </div>

      {/* slide drawer */}
      <button className={`scrim${drawer ? " open" : ""}`} onClick={() => setDrawer(null)} aria-label="Close" tabIndex={-1} />
      <aside className={`drawer${drawer ? " open" : ""}`} aria-hidden={!drawer}>
        {drawer && (() => {
          const { set, i } = drawer;
          const c = set.content_json;
          const slideText = c ? (i === 0 ? [...(c.hook?.lines ?? []), ...(c.hook?.sub ?? [])].join(" ") : i <= (c.ranked?.length ?? 0) ? [c.ranked[i - 1]?.name, ...(c.ranked[i - 1]?.lines ?? [])].filter(Boolean).join(". ") : [...(c.closer?.lines ?? []), c.closer?.cta].filter(Boolean).join(" ")) : null;
          const url = set.urls?.[i];
          const total = set.urls?.length ?? 0;
          return (
            <>
              <div className="dh"><h3>Slide {i + 1} of {total}</h3><button className="btn quiet sm" onClick={() => setDrawer(null)} aria-label="Close">Close</button></div>
              <div className="db">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div className="prev">{url && <img src={url} alt={`Slide ${i + 1}`} />}</div>
                {slideText && <><span className="label">Text on the slide</span><div className="txt">{slideText}</div></>}
                {i === 0 && set.caption && <><span className="label">Caption</span><div className="txt">{set.caption}</div></>}
                <div className="drow">
                  <button className="btn" disabled={i === 0} onClick={() => setDrawer({ set, i: i - 1 })}>Previous</button>
                  <button className="btn" disabled={i >= total - 1} onClick={() => setDrawer({ set, i: i + 1 })}>Next</button>
                  <span className="grow" style={{ flex: 1 }} />
                  {url && <a className="btn" href={url} download={`slide-${i + 1}.png`} target="_blank" rel="noreferrer">{I.down} Download</a>}
                </div>
              </div>
            </>
          );
        })()}
      </aside>

      <div className={`toast${toast ? " show" : ""}`} role="status">{toast ?? ""}</div>
    </div>
  );
}
