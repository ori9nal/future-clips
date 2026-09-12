"use client";

/**
 * The product: Create · Campaigns · Library · Insights · Settings.
 *
 * Built on the owner's app-dashboard design, with every number coming from
 * the database: the campaigns are the live briefs, the credits pill is the
 * slides left this period, the runs are real sets polled from /api/sets/:id
 * and the tiles are signed URLs of rendered PNGs. There is no simulated
 * generation anywhere on this surface.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Account } from "@/lib/account";
import type { SetRow, Lane } from "@/lib/sets";

type Spec = {
  id: string; brand: string; product: string; niche: string;
  requirements?: { min_slides?: number; max_slides?: number; required_mention?: string };
  assets?: { palette?: string[] };
  content?: { style?: string };
  guidance?: { angles?: string[]; hook_style?: string };
};
type ViewerLite = { email: string; orgName: string; plan: string; isPlatformOwner: boolean; engine: boolean };
type Page = "create" | "campaigns" | "library" | "insights" | "settings";
type SetView = SetRow & { label?: string; urls?: string[] };

const PLAN_LABEL: Record<string, string> = { free: "Free", solo: "Solo", grind: "Grind", agency: "Agency" };
const RMIN = 5, RMAX = 10;
const PRESETS: [string, number, number][] = [["Short", 5, 6], ["Standard", 6, 8], ["Long", 8, 10]];

const Icon = {
  create: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L4.5 13.5H11l-1 8.5L18.5 10.5H12z" /></svg>,
  campaigns: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7h-9M20 12h-9M20 17h-9M4 7h.01M4 12h.01M4 17h.01" /></svg>,
  library: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></svg>,
  insights: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l5-5 4 4 8-8" /><path d="M17 8h4v4" /></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
  admin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" /></svg>,
  sun: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" /><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>,
  moon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>,
  bolt: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4.5 13.5H11l-1 8.5L18.5 10.5H12z" /></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13" /><path d="M12 5l7 7-7 7" /></svg>,
  down: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>,
  chevron: <svg className="cv" viewBox="0 0 12 8"><path d="M1 2l5 5 5-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>,
  burger: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>,
  grid: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></svg>,
};

const initial = (s: string) => (s.trim()[0] ?? "?").toUpperCase();
const swatch = (s: Spec) => s.assets?.palette?.[1] ?? s.assets?.palette?.[0] ?? "#D8FF47";
const readable = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#08080A";
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#08080A" : "#F0F0F3";
};
const when = (iso: string) => {
  const d = new Date(iso); const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return d.toLocaleDateString();
};
const stageIndex = (stage: string | null) => {
  const order = ["copy:submit", "copy:wait", "art:anchor:submit", "art:anchor:wait", "art:frames:submit", "art:frames:wait", "render", "done"];
  const i = order.indexOf(stage ?? "");
  return i < 0 ? 0 : i;
};
const styleWord = (s: string) => ({ native: "phone post", feed: "photo feed", bedrock: "figure", mascot: "mascot" } as Record<string, string>)[s] ?? s;

export default function Dashboard({ viewer, specs, account: account0, sets: sets0 }: { viewer: ViewerLite; specs: Spec[]; account: Account; sets: SetRow[] }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [wide, setWide] = useState(false);
  const [page, setPage] = useState<Page>("create");
  const [account, setAccount] = useState(account0);
  const [sets, setSets] = useState<SetView[]>(sets0);
  const [active, setActive] = useState<Spec | null>(null);
  const [ask, setAsk] = useState("");
  const [nMin, setNMin] = useState(6);
  const [nMax, setNMax] = useState(8);
  const [lane, setLane] = useState<Lane>("batch");
  const [hd, setHd] = useState(false);
  const [pop, setPop] = useState<"camp" | "slides" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToastText] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ set: SetView; i: number } | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"acct" | "plan" | "gen">("acct");
  const [bannerGone, setBannerGone] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  // per-viewer conveniences (theme, defaults) live in the browser only
  useEffect(() => {
    try {
      const t = localStorage.getItem("fc.theme"); if (t === "light" || t === "dark") setTheme(t);
      const r = localStorage.getItem("fc.range"); if (r) { const [a, b] = r.split(",").map(Number); if (a >= RMIN && b <= RMAX && a <= b) { setNMin(a); setNMax(b); } }
      const w = localStorage.getItem("fc.wide"); if (w === "1" && window.innerWidth > 860) setWide(true);
      const c = localStorage.getItem("fc.campaign"); if (c) { const s = specs.find((x) => x.id === c); if (s) setActive(s); }
    } catch { /* private mode */ }
  }, [specs]);
  useEffect(() => { try { localStorage.setItem("fc.theme", theme); } catch { /* ignore */ } }, [theme]);
  useEffect(() => { try { localStorage.setItem("fc.range", `${nMin},${nMax}`); } catch { /* ignore */ } }, [nMin, nMax]);
  useEffect(() => { try { if (active) localStorage.setItem("fc.campaign", active.id); } catch { /* ignore */ } }, [active]);

  const say = useCallback((m: string) => { setToastText(m); window.setTimeout(() => setToastText(null), 2800); }, []);
  const go = (p: Page) => { setPage(p); setPop(null); if (viewRef.current) viewRef.current.scrollTop = 0; if (window.innerWidth <= 860) setWide(false); };

  const canPriority = account.cap.priority > 0;
  const canHd = account.plan.hd_per_slide_usd != null;
  const left = lane === "priority" ? account.left.priority : account.left.batch;
  const paid = account.plan.slides_per_month > 0;

  // ── polling: any set that is not finished is asked about every few seconds ──
  const refreshAccount = useCallback(async () => {
    const r = await fetch("/api/me"); if (r.ok) { const j = await r.json(); setAccount(j.account); }
  }, []);
  useEffect(() => {
    const open = sets.filter((s) => s.status === "queued" || s.status === "rendering");
    if (!open.length) return;
    const t = window.setInterval(async () => {
      for (const s of open) {
        try {
          const r = await fetch(`/api/sets/${s.id}`); if (!r.ok) continue;
          const j = await r.json();
          setSets((prev) => prev.map((p) => (p.id === s.id ? { ...p, ...j.set, label: j.label, urls: j.slides } : p)));
          if (j.set.status === "done") { say(`<b>${j.set.slides} slides</b> ready`); refreshAccount(); }
          if (j.set.status === "failed") { say(`Set failed: ${j.set.error ?? "unknown"}`); refreshAccount(); }
        } catch { /* next tick */ }
      }
    }, s0(open) );
    return () => window.clearInterval(t);
    function s0(open: SetView[]) { return open.some((s) => s.lane === "priority") ? 4000 : 20000; }
  }, [sets, say, refreshAccount]);

  // done sets rendered from the server payload need their signed URLs once
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
    // the brief's own range clamps the picker
    const lo = Math.max(RMIN, q.min_slides ?? RMIN), hi = Math.min(RMAX, q.max_slides ?? RMAX);
    setNMin((m) => Math.min(Math.max(m, lo), hi)); setNMax((m) => Math.max(Math.min(m, hi), lo));
    window.setTimeout(() => taRef.current?.focus(), 50);
  };

  async function run() {
    if (busy) return;
    if (!active) { say("Pick a campaign first"); setPop("camp"); return; }
    const topic = ask.trim();
    if (!topic) { say("Choose an angle or type one"); taRef.current?.focus(); return; }
    if (left < nMax) { setErr(`Not enough slides left — ${left} on the ${lane === "priority" ? "priority" : "included"} allowance, this set needs up to ${nMax}.`); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/sets", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaign: active.id, ask: topic, style: active.content?.style ?? "native", slides: nMin === nMax ? nMin : { min: nMin, max: nMax }, lane, hd }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.detail ? `${j.error} ${j.detail}` : j.error); return; }
      const row: SetView = {
        id: j.id, org_id: "", campaign_id: active.id, style: active.content?.style ?? "native", ask: topic, slides: null, slides_min: nMin, slides_max: nMax,
        reserved_slides: nMax, quality: hd ? "high" : "medium", lane, hd, status: "queued", stage: "copy:submit", caption: null, cost_usd: null,
        files_json: null, content_json: null, compliance_json: null, error: null, cancel_requested: false, created_at: new Date().toISOString(),
        started_at: null, finished_at: null, updated_at: new Date().toISOString(), label: lane === "priority" ? "Starting" : "In the queue",
      };
      setSets((prev) => [row, ...prev]);
      setAsk("");
      refreshAccount();
      say(lane === "priority" ? "Rendering now — a minute or two" : `Queued — <b>${nMin === nMax ? nMin : `${nMin}–${nMax}`} slides</b>, back within the day`);
    } catch (e: any) {
      setErr(e?.message ?? "could not start");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(s: SetView) {
    const r = await fetch(`/api/sets/${s.id}`, { method: "DELETE" });
    if (r.ok) { say("Cancelled — the slides go back on the next tick"); setSets((prev) => prev.map((p) => (p.id === s.id ? { ...p, cancel_requested: true } : p))); }
    else say("Too late to cancel — it has started");
  }

  const filteredSpecs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? specs.filter((s) => `${s.brand} ${s.product} ${s.niche}`.toLowerCase().includes(q)) : specs;
  }, [specs, query]);
  const specById = useMemo(() => Object.fromEntries(specs.map((s) => [s.id, s])), [specs]);
  const recent = sets.slice(0, 6);
  const madeThisPeriod = sets.filter((s) => s.status === "done" && s.created_at >= account.usage.period_start).length;
  const avg = (() => { const d = sets.filter((s) => s.status === "done" && s.slides != null); return d.length ? (d.reduce((a, s) => a + (s.slides ?? 0), 0) / d.length).toFixed(1) : "–"; })();
  const angles = active?.guidance?.angles ?? [];
  const lo = Math.max(RMIN, active?.requirements?.min_slides ?? RMIN), hi = Math.min(RMAX, active?.requirements?.max_slides ?? RMAX);
  const span = RMAX - RMIN;

  const Run = ({ s, full }: { s: SetView; full: boolean }) => {
    const spec = specById[s.campaign_id];
    const open = s.status === "queued" || s.status === "rendering";
    const count = s.slides ?? s.slides_max;
    return (
      <div className="run">
        {open && (
          <div className="strip">
            <span className="spin" />
            <span className="lb"><b>{s.label ?? (s.lane === "priority" ? "Starting" : "In the queue")}</b> · {s.lane === "priority" ? "priority" : "included"} · {s.slides_min === s.slides_max ? s.slides_min : `${s.slides_min}–${s.slides_max}`} slides</span>
            <span className="sp" />
            <span className="bar"><i style={{ width: `${Math.round((stageIndex(s.stage) / 7) * 100)}%` }} /></span>
            {s.status === "queued" && !s.cancel_requested && (s.stage === "copy:submit" || !s.stage) && <button className="gh" onClick={() => cancel(s)}>Cancel</button>}
            {s.cancel_requested && <span className="mt">cancelling</span>}
          </div>
        )}
        {s.status === "failed" && (
          /^cancelled/i.test(s.error ?? "")
            ? <div className="strip"><span className="lb"><b>Cancelled</b> · the slides went back to your balance</span></div>
            : <div className="strip failed"><span className="lb"><b>Failed</b> · {s.error ?? "unknown"} · the slides went back to your balance</span></div>
        )}
        <div className="rh">
          <h3 title={s.ask}>{s.ask}</h3>
          <span className="mt">{spec?.brand ?? s.campaign_id} · {count} slides · {when(s.created_at)}</span>
          <span className="sp" />
          {s.status === "done" && s.urls?.length ? (
            <>
              <a className="gh" href={`/api/sets/${s.id}/download`}>{Icon.down} Download all</a>
              <button className="gh" onClick={() => { if (spec) pickCamp(spec); setAsk(s.ask); go("create"); say("Loaded — tweak and generate again"); }}>Remix</button>
            </>
          ) : null}
        </div>
        {s.status === "done" && s.caption && (
          <div className="caption"><span className="mono" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", paddingTop: 3 }}>Caption</span><b>{s.caption}</b></div>
        )}
        <div className="grid">
          {s.status === "done" && s.urls?.length
            ? s.urls.slice(0, full ? undefined : 10).map((url, i) => (
              <button key={url} className="tile" style={{ animationDelay: `${i * 45}ms` }} onClick={() => setDrawer({ set: s, i })}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Slide ${i + 1}`} loading="lazy" />
                <span className="ix">{String(i + 1).padStart(2, "0")}</span>
                <span className="tg2">{i === 0 ? "hook" : i === s.urls!.length - 1 ? "closer" : `body ${i}`}</span>
              </button>
            ))
            : open
              ? Array.from({ length: count }, (_, i) => <div key={i} className="tile gen" style={{ animationDelay: `${i * 45}ms` }}><span className="ix">{String(i + 1).padStart(2, "0")}</span></div>)
              : null}
        </div>
      </div>
    );
  };

  const Empty = ({ title, sub }: { title: string; sub: string }) => (
    <div className="none">{Icon.grid}<h4>{title}</h4><p>{sub}</p></div>
  );

  return (
    <div className={`fd${wide ? " wide" : ""}`} data-theme={theme}>
      {wide && <button className="side-scrim" aria-label="Close menu" onClick={() => setWide(false)} style={{ display: "none" }} />}
      <aside className="side">
        <button className="slogo" onClick={() => go("create")} aria-label="Home">
          <svg viewBox="0 0 92 64"><rect x="0" y="21" width="55" height="39" rx="7" fill="var(--logo-1)" /><rect x="14" y="12" width="55" height="39" rx="7" fill="var(--logo-2)" /><rect x="31" y="2" width="55" height="39" rx="7" fill="var(--logo-3)" /></svg>
          <span className="nm">futureclips</span>
        </button>
        {([["create", "Create"], ["campaigns", "Campaigns"], ["library", "Library"], ["insights", "Insights"]] as [Page, string][]).map(([id, label]) => (
          <button key={id} className={`nav${page === id ? " on" : ""}`} onClick={() => go(id)}>{Icon[id]}<em>{label}</em></button>
        ))}
        {viewer.isPlatformOwner && <Link className="nav" href="/admin">{Icon.admin}<em>Admin</em></Link>}
        <div className="gap" />
        <button className="nav" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? Icon.moon : Icon.sun}<em>Theme</em></button>
        <button className={`nav${page === "settings" ? " on" : ""}`} onClick={() => go("settings")}>{Icon.settings}<em>Settings</em></button>
        <div className="sdiv" />
        <button className="acct" onClick={() => go("settings")}>
          <span className="av">{initial(viewer.email)}</span>
          <span className="who"><b>{viewer.orgName}</b><small>{PLAN_LABEL[viewer.plan] ?? viewer.plan} plan</small></span>
        </button>
      </aside>

      <div className="main">
        <header className="top">
          <button className="burger" onClick={() => setWide(!wide)} aria-label="Menu">{Icon.burger}</button>
          <span className="sp" />
          <span className="cred" title="Slides left this period (included allowance)">{Icon.bolt}<b>{account.left.batch}</b>{canPriority && <span> · <b>{account.left.priority}</b> priority</span>}</span>
          {paid
            ? <Link className="upg" href="/app/usage">Usage</Link>
            : <a className="upg" href="https://www.thefutureclips.com/#pricing">Upgrade</a>}
        </header>

        <div className="view" ref={viewRef} onClick={() => pop && setPop(null)}>
          <div className="vinner">
            {/* ══ CREATE ══ */}
            {page === "create" && (
              <>
                {!bannerGone && (paid ? (
                  <div className="banner">
                    <span className="ic">⚡</span>
                    <span>You're on <b>{PLAN_LABEL[account.plan.id] ?? account.plan.id}</b> — <b>{account.left.batch}</b> of {account.cap.batch} slides left{canPriority ? <>, <b>{account.left.priority}</b> of {account.cap.priority} priority</> : null}{account.periodEnd ? <> · renews {new Date(account.periodEnd).toLocaleDateString()}</> : <> · resets on the 1st</>}.</span>
                    <span className="sp" />
                    <button onClick={() => setBannerGone(true)} aria-label="Dismiss">×</button>
                  </div>
                ) : (
                  <div className="banner">
                    <span className="ic">🎁</span>
                    <span>You're on the <b>Free</b> plan: one ready-made slideshow per live campaign. Generating your own starts on Solo.</span>
                    <span className="sp" />
                    <a className="btn" href="https://www.thefutureclips.com/#pricing">See plans</a>
                  </div>
                ))}

                <div className="hero">
                  <div className="ghosttype">futureclips</div>
                  <h1>What are we posting today?</h1>
                  <p>Pick a campaign, choose an angle, and get a post-ready slideshow.<span className="kbd">↵</span><span style={{ fontSize: 11.5, color: "var(--txt-3)" }}> to generate</span></p>

                  <div className="box" onClick={(e) => e.stopPropagation()}>
                    <div className="camprow">
                      <button className="campsel" onClick={() => setPop(pop === "camp" ? null : "camp")} aria-haspopup="listbox" aria-expanded={pop === "camp"}>
                        <span className="lg" style={active ? { background: swatch(active), color: readable(swatch(active)) } : undefined}>{active ? initial(active.brand) : "?"}</span>
                        <span className="t"><b>{active ? active.brand : "Select a campaign"}</b><small>{active ? `${active.product} · ${active.niche}` : "Required to generate"}</small></span>
                        {Icon.chevron}
                      </button>
                      {pop === "camp" && (
                        <div className="pop list" style={{ top: 48, left: 0, right: 0 }} role="listbox">
                          {specs.map((s) => (
                            <button key={s.id} className={`mi${active?.id === s.id ? " sel" : ""}`} role="option" aria-selected={active?.id === s.id} onClick={() => pickCamp(s)}>
                              <span className="lg" style={{ background: swatch(s), color: readable(swatch(s)) }}>{initial(s.brand)}</span>
                              <span><span>{s.brand}</span><small>{s.product} · {styleWord(s.content?.style ?? "native")}</small></span>
                            </button>
                          ))}
                          {!specs.length && <div className="mi">No live campaigns yet.</div>}
                        </div>
                      )}
                    </div>
                    <div className="tinput">
                      <textarea ref={taRef} rows={1} value={ask} placeholder={active ? (angles.length ? "Choose an angle below, or type your own" : `What should the ${active.brand} set be about?`) : "Pick a campaign to start"}
                        onChange={(e) => { setAsk(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); } }} maxLength={400} />
                      <button className="go" disabled={!active || !paid || busy} onClick={run} aria-label="Generate">{Icon.arrow}</button>
                    </div>
                    <div className="boxfoot">
                      <span style={{ position: "relative" }}>
                        <button className="mini" onClick={() => setPop(pop === "slides" ? null : "slides")}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="12" height="16" rx="2" /><path d="M18 7v10" /><path d="M21 9v6" /></svg>
                          <b>{nMin === nMax ? nMin : `${nMin}–${nMax}`}</b> slides
                        </button>
                        {pop === "slides" && (
                          <div className="pop slidepop" style={{ top: 34, left: 0 }}>
                            <div className="sh"><span className="sv">{nMin === nMax ? nMin : `${nMin} – ${nMax}`}</span><span className="su">slides</span><span className="sp" /><span className="car">{nMin === nMax ? "fixed count" : "we pick the best fit"}</span></div>
                            <div className="dual">
                              <div className="track" />
                              <div className="fillbar" style={{ left: `calc(${((nMin - RMIN) / span) * 100}% - 9px)`, width: `calc(${((nMax - nMin) / span) * 100}% + 18px)` }} />
                              <input type="range" min={RMIN} max={RMAX} step={1} value={nMin} onChange={(e) => setNMin(Math.max(lo, Math.min(+e.target.value, nMax)))} aria-label="Minimum slides" />
                              <input type="range" min={RMIN} max={RMAX} step={1} value={nMax} onChange={(e) => setNMax(Math.min(hi, Math.max(+e.target.value, nMin)))} aria-label="Maximum slides" />
                            </div>
                            <div className="ticks">{[5, 6, 7, 8, 9, 10].map((v) => <span key={v} className={v >= nMin && v <= nMax ? "in" : ""}>{v}</span>)}</div>
                            <div className="presets">{PRESETS.map(([l, a, b]) => <button key={l} className={`pst${a === nMin && b === nMax ? " on" : ""}`} onClick={() => { setNMin(Math.max(lo, a)); setNMax(Math.min(hi, b)); }}>{l}</button>)}</div>
                            <p className="note">{nMin === nMax ? `Uses exactly ${nMin} slides.` : `${nMin}–${nMax} depending on the topic. You're only charged for what's made.`}{active && (lo > RMIN || hi < RMAX) ? ` This brief allows ${lo}–${hi}.` : ""}</p>
                          </div>
                        )}
                      </span>
                      {canPriority && (
                        <button className={`mini${lane === "priority" ? " on" : ""}`} onClick={() => setLane(lane === "priority" ? "batch" : "priority")} title="Priority renders in a minute or two and counts against the priority allowance">
                          <b>{lane === "priority" ? "Priority" : "Included"}</b>{lane === "priority" ? " · minutes" : " · within the day"}
                        </button>
                      )}
                      {canHd && <button className={`mini${hd ? " on" : ""}`} onClick={() => setHd(!hd)} title={`HD export: +$${account.plan.hd_per_slide_usd}/slide`}><b>HD</b>{hd ? " on" : " off"}</button>}
                      <span className="sp" />
                      <span className={`cost${left < nMax ? " bad" : ""}`}>{paid ? (nMin === nMax ? `${left - nMin} left after this` : `${left - nMax}–${left - nMin} left after this`) : "needs a paid plan"}</span>
                    </div>
                    {err && <p className="err" role="alert">{err}</p>}
                  </div>

                  {angles.length > 0 && (
                    <div className="achips">
                      {angles.map((a) => <button key={a} className={`achip${ask === a ? " on" : ""}`} onClick={() => { setAsk(a); taRef.current?.focus(); }}><i>proven</i>{a}</button>)}
                    </div>
                  )}
                </div>

                {!viewer.engine && paid && (
                  <div className="banner warn" style={{ marginTop: 30 }}><span className="ic">⏳</span><span>Rendering on this host is not switched on yet — sets you queue are kept and start as soon as it is.</span></div>
                )}

                {recent.length > 0 && <p className="sec">Recent <span className="sp" /><button className="link" onClick={() => go("library")}>All in Library →</button></p>}
                {recent.map((s) => <Run key={s.id} s={s} full={false} />)}
              </>
            )}

            {/* ══ CAMPAIGNS ══ */}
            {page === "campaigns" && (
              <>
                <p className="sec">Live campaigns</p>
                <div className="csearch">{Icon.search}<input type="text" placeholder="Search campaigns…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
                <div className="cards">
                  {filteredSpecs.map((s) => (
                    <button key={s.id} className={`card${active?.id === s.id ? " on" : ""}`} onClick={() => { pickCamp(s); go("create"); }}>
                      <div className="ch"><span className="lg" style={{ background: swatch(s), color: readable(swatch(s)) }}>{initial(s.brand)}</span><span><span className="cn">{s.brand}</span><span className="ct">{s.product}</span></span></div>
                      <div className="tags">
                        <span className="tg">{s.niche}</span>
                        <span className="tg">{styleWord(s.content?.style ?? "native")}</span>
                        <span className="tg">{s.requirements?.min_slides ?? 5}–{s.requirements?.max_slides ?? 10} slides</span>
                        {s.guidance?.angles?.length ? <span className="tg">{s.guidance.angles.length} angles</span> : null}
                      </div>
                    </button>
                  ))}
                  {!filteredSpecs.length && <Empty title="No campaigns match" sub="Try another word." />}
                </div>
              </>
            )}

            {/* ══ LIBRARY ══ */}
            {page === "library" && (
              <>
                <p className="sec">Your sets <span className="sp" /><button className="link" onClick={() => go("create")}>New set →</button></p>
                {sets.length ? sets.map((s) => <Run key={s.id} s={s} full />) : <Empty title="Nothing here yet" sub="Sets you generate appear here, newest first." />}
              </>
            )}

            {/* ══ INSIGHTS ══ */}
            {page === "insights" && (
              <>
                <p className="sec">This period</p>
                <div className="stats">
                  <div className="stat"><div className="k">Sets made</div><div className="v">{madeThisPeriod}</div><div className="d">since {account.usage.period_start}</div></div>
                  <div className="stat"><div className="k">Slides used</div><div className="v">{account.usage.slides_used}</div><div className="d">of {account.cap.batch} included</div></div>
                  {canPriority && <div className="stat"><div className="k">Priority used</div><div className="v">{account.usage.priority_slides_used}</div><div className="d">of {account.cap.priority}</div></div>}
                  <div className="stat"><div className="k">Slides per set</div><div className="v">{avg}</div><div className="d">average, finished sets</div></div>
                  {canHd && <div className="stat"><div className="k">HD slides</div><div className="v">{account.usage.hd_slides_used}</div><div className="d">${account.plan.hd_per_slide_usd} each</div></div>}
                </div>
                <p className="sec">Latest finished</p>
                <div className="cards">
                  {sets.filter((s) => s.status === "done").slice(0, 6).map((s) => {
                    const spec = specById[s.campaign_id];
                    return (
                      <button key={s.id} className="card" onClick={() => go("library")}>
                        <div className="ch"><span className="lg" style={spec ? { background: swatch(spec), color: readable(swatch(spec)) } : undefined}>{initial(spec?.brand ?? s.campaign_id)}</span><span><span className="cn">{s.ask}</span><span className="ct">{spec?.brand ?? s.campaign_id} · {when(s.created_at)}</span></span></div>
                        <div className="tags"><span className="tg">{s.slides} slides</span><span className="tg">{s.lane === "priority" ? "priority" : "included"}</span>{s.hd && <span className="tg">HD</span>}</div>
                      </button>
                    );
                  })}
                  {!sets.some((s) => s.status === "done") && <Empty title="No finished sets yet" sub="Numbers fill in as sets complete." />}
                </div>
              </>
            )}

            {/* ══ SETTINGS ══ */}
            {page === "settings" && (
              <>
                <p className="sec">Settings</p>
                <div className="stabs">
                  {([["acct", "Account"], ["plan", "Plan & slides"], ["gen", "Generation"]] as ["acct" | "plan" | "gen", string][]).map(([id, l]) => (
                    <button key={id} className={`stab${tab === id ? " on" : ""}`} onClick={() => setTab(id)}>{l}</button>
                  ))}
                </div>
                {tab === "acct" && (
                  <>
                    <div className="field"><span className="fl"><b>Email</b><small>Where the sign-in link and receipts go</small></span><span className="mono" style={{ color: "var(--txt)" }}>{viewer.email}</span></div>
                    <div className="field"><span className="fl"><b>Workspace</b><small>Every set and every slide counts against this workspace</small></span><span style={{ color: "var(--txt)" }}>{viewer.orgName}</span></div>
                    <div className="field"><span className="fl"><b>Password</b><small>There isn't one — sign-in is by emailed link.</small></span></div>
                    <div className="field"><span className="fl"><b>Sign out</b><small>On this device</small></span><form action="/auth/signout" method="post"><button className="gh" type="submit">Sign out</button></form></div>
                    <div className="field"><span className="fl"><b>Delete account</b><small>Email team@thefutureclips.com from this address; we confirm and remove everything within the retention periods in the Privacy Policy.</small></span><a className="gh" href="mailto:team@thefutureclips.com?subject=Delete%20my%20account">Email us</a></div>
                  </>
                )}
                {tab === "plan" && (
                  <>
                    <div className="field"><span className="fl"><b>Current plan</b><small>{PLAN_LABEL[account.plan.id] ?? account.plan.id} — {account.plan.slides_per_month} slides a month{account.plan.priority_slides_per_month ? ` + ${account.plan.priority_slides_per_month} priority` : ""}{account.periodEnd ? `, renews ${new Date(account.periodEnd).toLocaleDateString()}` : ""}</small></span><a className="gh" href="https://www.thefutureclips.com/#pricing">Plans</a></div>
                    <div className="field"><span className="fl"><b>Slides remaining</b><small>Included allowance this period. Doesn't roll over.</small></span><b className="big">{account.left.batch}</b></div>
                    {canPriority && <div className="field"><span className="fl"><b>Priority remaining</b><small>Rendered in minutes instead of within the day</small></span><b className="big">{account.left.priority}</b></div>}
                    <div className="field"><span className="fl"><b>Extra slides</b><small>{account.plan.extra_slide_usd != null ? `$${account.plan.extra_slide_usd.toFixed(2)} per slide · $${(account.plan.extra_priority_slide_usd ?? 0).toFixed(2)} per priority slide. Checkout is being connected — email us to top up meanwhile.` : "Available on paid plans."}</small></span><a className="gh" href="mailto:team@thefutureclips.com?subject=Extra%20slides">Email us</a></div>
                    <div className="field"><span className="fl"><b>Cancel subscription</b><small>You keep access until the end of your billing period. Until checkout is live, cancel by email.</small></span><a className="gh" href="mailto:team@thefutureclips.com?subject=Cancel%20subscription">Email us</a></div>
                    <div className="field"><span className="fl"><b>Usage detail</b><small>The counters the quota reads, by period</small></span><Link className="gh" href="/app/usage">Open</Link></div>
                  </>
                )}
                {tab === "gen" && (
                  <>
                    <div className="field"><span className="fl"><b>Default slide range</b><small>Used on every new set until you change it in the box</small></span>
                      <select value={`${nMin},${nMax}`} onChange={(e) => { const [a, b] = e.target.value.split(",").map(Number); setNMin(a); setNMax(b); }}>
                        {PRESETS.map(([l, a, b]) => <option key={l} value={`${a},${b}`}>{l} · {a}–{b}</option>)}
                        {[5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={`${n},${n}`}>Exactly {n}</option>)}
                      </select></div>
                    <div className="field"><span className="fl"><b>Lane</b><small>{canPriority ? "Priority renders in minutes and draws on the priority allowance." : "Priority rendering is on Grind and Agency."}</small></span>
                      <button className={`sw${lane === "priority" ? " on" : ""}`} disabled={!canPriority} onClick={() => setLane(lane === "priority" ? "batch" : "priority")} aria-label="Priority lane" /></div>
                    <div className="field"><span className="fl"><b>HD export</b><small>{canHd ? `Higher-detail frames, +$${account.plan.hd_per_slide_usd}/slide, same slide count.` : "HD export is on Grind and Agency."}</small></span>
                      <button className={`sw${hd ? " on" : ""}`} disabled={!canHd} onClick={() => setHd(!hd)} aria-label="HD" /></div>
                    <div className="field"><span className="fl"><b>Theme</b><small>Dark or light, remembered on this device</small></span>
                      <button className={`sw${theme === "light" ? " on" : ""}`} onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Light theme" /></div>
                  </>
                )}
              </>
            )}

            <div className="legal-strip">
              <span>Trust and Legal</span>
              <Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/acceptable-use">Acceptable use</Link><Link href="/refunds">Refunds</Link><Link href="/accessibility">Accessibility</Link>
              <a href="mailto:team@thefutureclips.com">team@thefutureclips.com</a>
            </div>
          </div>
        </div>
      </div>

      {/* drawer */}
      <button className={`scrim${drawer ? " open" : ""}`} onClick={() => setDrawer(null)} aria-label="Close" tabIndex={-1} />
      <aside className={`drawer${drawer ? " open" : ""}`} aria-hidden={!drawer}>
        {drawer && (() => {
          const { set, i } = drawer;
          const c = set.content_json;
          const slideText = c ? (i === 0 ? [...(c.hook?.lines ?? []), ...(c.hook?.sub ?? [])].join(" ") : i <= (c.ranked?.length ?? 0) ? [c.ranked[i - 1]?.name, ...(c.ranked[i - 1]?.lines ?? [])].filter(Boolean).join(" · ") : [...(c.closer?.lines ?? []), c.closer?.cta].filter(Boolean).join(" ")) : null;
          const url = set.urls?.[i];
          return (
            <>
              <div className="dh"><b>Slide {String(i + 1).padStart(2, "0")} of {set.urls?.length ?? "?"}</b><span className="sp" /><button className="x" onClick={() => setDrawer(null)} aria-label="Close">×</button></div>
              <div className="db">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div className="prev">{url && <img src={url} alt={`Slide ${i + 1}`} />}</div>
                {slideText && <><p className="fl2">Slide text</p><div className="txt">{slideText}</div></>}
                {i === 0 && set.caption && <><p className="fl2">Caption</p><div className="txt">{set.caption}</div></>}
                <div className="drow">
                  <button className="gh" disabled={i === 0} onClick={() => setDrawer({ set, i: i - 1 })}>← Prev</button>
                  <button className="gh" disabled={!set.urls || i >= set.urls.length - 1} onClick={() => setDrawer({ set, i: i + 1 })}>Next →</button>
                </div>
                {url && <a className="gh" style={{ justifyContent: "center", height: 36, width: "100%" }} href={url} download={`slide-${i + 1}.png`} target="_blank" rel="noreferrer">{Icon.down} Download this slide</a>}
              </div>
            </>
          );
        })()}
      </aside>

      <div className={`toast${toast ? " show" : ""}`} role="status" dangerouslySetInnerHTML={{ __html: toast ?? "" }} />
    </div>
  );
}
