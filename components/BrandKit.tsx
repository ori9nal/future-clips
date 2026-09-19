"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The workspace's own logo, avatar and handle — uploaded once, put on every
 * set that asks for it (`/api/assets`, migration 0020). The composer mounts
 * this; the engine signs the last slide with whatever is here.
 */
type Asset = { path: string; url: string | null } | null;
type Assets = { handle: string | null; logo: Asset; avatar: Asset };

const EMPTY: Assets = { handle: null, logo: null, avatar: null };

export function BrandKit({ canEdit = true, onChange }: { canEdit?: boolean; onChange?: (a: Assets) => void }) {
  const [assets, setAssets] = useState<Assets>(EMPTY);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const files = { logo: useRef<HTMLInputElement>(null), avatar: useRef<HTMLInputElement>(null) };

  const apply = useCallback((a: Assets) => { setAssets(a); setHandle(a.handle ?? ""); onChange?.(a); }, [onChange]);

  useEffect(() => {
    let alive = true;
    fetch("/api/assets")
      .then((r) => r.json())
      .then((j: { assets?: Assets }) => { if (alive && j.assets) apply(j.assets); })
      .catch(() => { /* the panel simply stays empty */ });
    return () => { alive = false; };
  }, [apply]);

  async function send(what: string, init: RequestInit) {
    setBusy(what); setError(null);
    try {
      const r = await fetch("/api/assets", init);
      const j = (await r.json()) as { assets?: Assets; error?: string };
      if (j.assets) apply(j.assets); else setError(j.error ?? "That did not save.");
    } catch {
      setError("Could not reach the server.");
    }
    setBusy(null);
  }

  const upload = (kind: "logo" | "avatar", file: File) => {
    const body = new FormData();
    body.append("kind", kind); body.append("file", file);
    return send(kind, { method: "POST", body });
  };
  const saveHandle = () => send("handle", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ handle }) });
  const clear = (kind: "logo" | "avatar" | "handle") => send(kind, { method: "DELETE" });

  const has = !!(assets.logo || assets.avatar || assets.handle);

  return (
    <div className="fc-brandkit">
      <button type="button" className="fc-brandkit-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="fc-brandkit-faces" aria-hidden="true">
          {assets.avatar?.url
            ? /* eslint-disable-next-line @next/next/no-img-element */ <img className="av" src={assets.avatar.url} alt="" />
            : <span className="av ph" />}
          {assets.logo?.url
            ? /* eslint-disable-next-line @next/next/no-img-element */ <img className="lg" src={assets.logo.url} alt="" />
            : <span className="lg ph" />}
        </span>
        <span className="fc-brandkit-say">
          {has
            ? <><b>Your brand is on.</b> {assets.handle ? `@${assets.handle}` : "No handle yet"}{assets.logo ? ", logo" : ""}{assets.avatar ? ", avatar" : ""}.</>
            : <><b>Add your logo or avatar.</b> It signs every carousel you make.</>}
        </span>
        <span className="fc-brandkit-more" aria-hidden="true">{open ? "Close" : has ? "Change" : "Add"}</span>
      </button>

      {open && (
        <div className="fc-brandkit-body">
          {!canEdit && <p className="fc-brandkit-note">Only the workspace owner can change this.</p>}
          <div className="fc-brandkit-row">
            {(["avatar", "logo"] as const).map((kind) => {
              const a = kind === "logo" ? assets.logo : assets.avatar;
              return (
                <div className="fc-brandkit-slot" key={kind}>
                  <span className="fc-brandkit-label">{kind === "avatar" ? "Avatar" : "Logo"}</span>
                  <div className={`fc-brandkit-drop${kind === "avatar" ? " round" : ""}`}>
                    {a?.url
                      ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={a.url} alt={`Your ${kind}`} />
                      : <span className="fc-brandkit-empty">PNG, JPEG or WebP<br />up to 2 MB</span>}
                  </div>
                  <input
                    ref={files[kind]} type="file" accept="image/png,image/jpeg,image/webp" hidden
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(kind, f); e.target.value = ""; }}
                  />
                  <div className="fc-brandkit-acts">
                    <button type="button" className="fc-btn" data-variant="ghost" data-size="sm" disabled={!canEdit || !!busy} onClick={() => files[kind].current?.click()}>
                      {busy === kind ? "Uploading…" : a ? "Replace" : "Upload"}
                    </button>
                    {a && <button type="button" className="fc-btn" data-variant="ghost" data-size="sm" disabled={!canEdit || !!busy} onClick={() => clear(kind)}>Remove</button>}
                  </div>
                </div>
              );
            })}

            <div className="fc-brandkit-slot wide">
              <span className="fc-brandkit-label">Handle</span>
              <div className="fc-brandkit-handle">
                <span aria-hidden="true">@</span>
                <input
                  value={handle} onChange={(e) => setHandle(e.target.value.replace(/^@+/, ""))}
                  placeholder="yourname" maxLength={40} disabled={!canEdit} aria-label="Your handle"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveHandle(); } }}
                />
              </div>
              <div className="fc-brandkit-acts">
                <button type="button" className="fc-btn" data-variant="ghost" data-size="sm" disabled={!canEdit || !!busy || handle === (assets.handle ?? "")} onClick={saveHandle}>
                  {busy === "handle" ? "Saving…" : "Save"}
                </button>
                {assets.handle && <button type="button" className="fc-btn" data-variant="ghost" data-size="sm" disabled={!canEdit || !!busy} onClick={() => clear("handle")}>Remove</button>}
              </div>
              <p className="fc-brandkit-note">The handle is printed on the deck. The avatar signs the last slide; the logo is used when there is no avatar.</p>
            </div>
          </div>
          {error && <p className="fc-err-line" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
