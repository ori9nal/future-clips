"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { joinWaitlist, type SignupState } from "@/app/actions";

const REF_KEY = "fc_agency_code";

// Lives here, not in actions.ts — a "use server" module may only export
// async functions, so a plain object export there fails at runtime.
const INITIAL_STATE: SignupState = { status: "idle", message: "" };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-ac" disabled={pending}>
      {pending ? "Sending…" : "Get 2 free"}
    </button>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(joinWaitlist, INITIAL_STATE);
  const [role, setRole] = useState<"clipper" | "agency">("clipper");
  const [agencyCode, setAgencyCode] = useState("");

  /**
   * Revenue-share attribution. `?ref=` wins and is persisted, so the code
   * survives the visitor browsing the page before they actually sign up.
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
    <form action={action} style={{ marginTop: 26 }}>
      <input type="hidden" name="agency_code" value={agencyCode} readOnly />
      <input type="hidden" name="role" value={role} readOnly />

      <div className="roles" role="group" aria-label="I am a">
        {(["clipper", "agency"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            aria-pressed={role === r}
          >
            {r === "clipper" ? "Clipper" : "Agency"}
          </button>
        ))}
      </div>

      <div className="form-row">
        <label htmlFor="email" className="sr">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@email.com"
          autoComplete="email"
          required
        />
        <Submit />
      </div>

      {role === "agency" && (
        <div className="roster">
          <label htmlFor="roster_size" className="sr">
            Roster size
          </label>
          <input
            id="roster_size"
            name="roster_size"
            type="number"
            min={0}
            max={100000}
            inputMode="numeric"
            placeholder="Roster size (optional)"
          />
        </div>
      )}

      <p className="msg" role="status" aria-live="polite">
        {state.message ? (
          <span className={done ? "msg-ok" : "msg-err"}>{state.message}</span>
        ) : (
          "Founding price locked when you join."
        )}
      </p>

      {agencyCode && <p className="ref">Referred by {agencyCode}</p>}
    </form>
  );
}
