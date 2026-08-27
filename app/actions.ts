"use server";

import { createAnonClient } from "@/lib/supabase";

export type SignupState = {
  status: "idle" | "ok" | "error";
  message: string;
};

// Deliberately conservative: one @, a dot in the domain, no whitespace.
const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

export async function joinWaitlist(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (email.length < 6 || email.length > 254 || !EMAIL.test(email)) {
    return { status: "error", message: "That email doesn't look right." };
  }

  const rawRole = String(formData.get("role") ?? "clipper");
  const role = rawRole === "agency" ? "agency" : "clipper";

  // Attribution code for agency revenue share. Sanitised, never trusted raw.
  const rawCode = String(formData.get("agency_code") ?? "").trim();
  const agencyCode =
    rawCode.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || null;

  let rosterSize: number | null = null;
  if (role === "agency") {
    const parsed = Number.parseInt(String(formData.get("roster_size") ?? ""), 10);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100000) {
      rosterSize = parsed;
    }
  }

  try {
    const supabase = createAnonClient();
    const { error } = await supabase.from("signups").insert({
      email,
      role,
      agency_code: agencyCode,
      roster_size: rosterSize,
    });

    if (error) {
      // 23505 = unique violation. Already on the list is a win, not a failure.
      if (error.code === "23505") {
        return { status: "ok", message: "You're already on the list." };
      }
      console.error("signup insert failed", error.code, error.message);
      return {
        status: "error",
        message: "Couldn't save that. Try again in a second.",
      };
    }

    return {
      status: "ok",
      message:
        role === "agency"
          ? "You're in. We'll send partner terms to that address."
          : "You're in. 2 free carousels waiting at launch.",
    };
  } catch (err) {
    console.error("signup action threw", err);
    return {
      status: "error",
      message: "Couldn't save that. Try again in a second.",
    };
  }
}
