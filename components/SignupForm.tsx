"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { joinWaitlist, type SignupState } from "@/app/actions";
import { Label } from "@/components/type";

const REF_KEY = "cc_agency_code";

// Lives here, not in actions.ts — a "use server" module may only export
// async functions, so a plain object export there fails at runtime.
const INITIAL_STATE: SignupState = { status: "idle", message: "" };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 bg-acid px-5 py-3 text-bg transition-opacity hover:opacity-85 disabled:opacity-50"
    >
      <Label>{pending ? "Sending…" : "Get 2 free →"}</Label>
    </button>
  );
}

export function SignupForm({
  defaultRole = "clipper",
}: {
  defaultRole?: "clipper" | "agency";
}) {
  const [state, action] = useActionState(joinWaitlist, INITIAL_STATE);
  const [role, setRole] = useState<"clipper" | "agency">(defaultRole);
  const [agencyCode, setAgencyCode] = useState("");

  /**
   * Revenue-share attribution. `?ref=` wins and is persisted, so the code
   * survives the visitor wandering the page before they actually sign up.
   * Read from `window.location` rather than `useSearchParams` so the page
   * stays statically rendered.
   */
  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("ref");
      const clean = (fromUrl ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);

      if (clean) {
        window.localStorage.setItem(REF_KEY, clean);
        setAgencyCode(clean);
        setRole("agency");
        return;
      }
      setAgencyCode(window.localStorage.getItem(REF_KEY) ?? "");
    } catch {
      // Private mode / storage disabled — attribution is best-effort.
    }
  }, []);

  const done = state.status === "ok";

  return (
    <div>
      <form action={action} className="max-w-[560px]">
        <input type="hidden" name="agency_code" value={agencyCode} readOnly />
        <input type="hidden" name="role" value={role} readOnly />

        {/* Role selector */}
        <div
          className="flex border border-line"
          role="group"
          aria-label="I am a"
        >
          {(["clipper", "agency"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              aria-pressed={role === r}
              className={`flex-1 border-r border-line px-4 py-2.5 text-center transition-colors last:border-r-0 ${
                role === r
                  ? "bg-acid text-bg"
                  : "bg-transparent text-muted hover:text-fg"
              }`}
            >
              <Label>I&rsquo;m a {r}</Label>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@email.com"
              className="w-full border border-line bg-surface px-4 py-3 font-mono text-[14px] text-fg placeholder:text-muted focus:border-acid focus:outline-none"
            />
          </div>
          <Submit />
        </div>

        {role === "agency" && (
          <div className="mt-3">
            <label
              htmlFor="roster_size"
              className="mb-2 block text-muted"
            >
              <Label>Roster size</Label>
            </label>
            <input
              id="roster_size"
              name="roster_size"
              type="number"
              min={0}
              max={100000}
              inputMode="numeric"
              placeholder="24"
              className="w-full max-w-[200px] border border-line bg-surface px-4 py-3 font-mono text-[14px] text-fg tabular-nums placeholder:text-muted focus:border-acid focus:outline-none"
            />
          </div>
        )}
      </form>

      <p
        role="status"
        aria-live="polite"
        className="mt-3 min-h-[18px] font-mono text-[12px] tracking-[0.04em]"
      >
        {state.message ? (
          <span className={done ? "text-acid" : "text-red"}>
            {state.message}
          </span>
        ) : (
          <span className="text-muted">
            No card. 2 free carousels. Then $20/mo.
          </span>
        )}
      </p>

      {agencyCode && (
        <p className="mt-1.5 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
          Referred by {agencyCode}
        </p>
      )}
    </div>
  );
}
