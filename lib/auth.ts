import "server-only";

/**
 * Who is asking, and what are they allowed to do.
 *
 * Roles come from the database, never from a header or a cookie value:
 * `members` says which orgs a user is in and whether they own them, and the
 * one org flagged `is_platform` is the company itself — its owners are the
 * platform admins who see /admin. The middleware has already guaranteed a
 * session on every non-public route, so these helpers only decide *which*
 * user and *which* org a request is about.
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminUnlocked } from "@/lib/adminGate";

export type Plan = "free" | "solo" | "grind" | "agency";

export type Org = {
  id: string;
  name: string;
  plan: Plan;
  seat_limit: number;
  is_platform: boolean;
  billing_status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  /** 0006: purchased and welcome slides, carried across periods (absent before the migration) */
  slide_balance?: number;
  /** 0005 */
  referral_code?: string;
  /** 0008: an affiliate-only workspace — refers, never generates */
  is_partner?: boolean;
  /** 0013: the shared demo workspace — example results, never generates */
  is_demo?: boolean;
};

export type Membership = { org: Org; role: "owner" | "member" };

export type Viewer = {
  user: { id: string; email: string };
  memberships: Membership[];
  /** the org the UI is acting for: the user's first non-platform org */
  org: Org;
  role: "owner" | "member";
  isPlatformOwner: boolean;
};

export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data: rows } = await supabase
    .from("members")
    .select("role, org:orgs(*)")
    .order("created_at", { ascending: true });

  const memberships: Membership[] = (rows ?? [])
    .filter((r: any) => r.org)
    .map((r: any) => ({ role: r.role, org: r.org as Org }));

  if (!memberships.length) return null; // the bootstrap trigger did not run — treat as signed out

  const isPlatformOwner = memberships.some((m) => m.org.is_platform && m.role === "owner");
  // A platform admin also has a personal org to try the product as a customer;
  // that personal org is what the customer surface acts for.
  // A prospect invited into the demo workspace also owns an empty personal
  // org (the bootstrap trigger); the demo is what they came to see, until
  // a workspace of their own has a plan.
  const primary =
    memberships.find((m) => !m.org.is_platform && !m.org.is_demo && m.org.plan !== "free") ??
    memberships.find((m) => m.org.is_demo) ??
    memberships.find((m) => !m.org.is_platform) ?? memberships[0];

  return {
    user: { id: user.id, email: user.email },
    memberships,
    org: primary.org,
    role: primary.role,
    isPlatformOwner,
  };
}

/** For pages: a viewer or a redirect to /login. */
export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/login");
  return v;
}

/**
 * For /admin: a platform owner who has entered a code.
 *
 * Two factors. The first is the membership, which rests entirely on a mailbox;
 * the second is a six-digit code from an authenticator, which does not
 * (lib/adminGate.ts, migration 0025). Unlike the passphrase-and-trusted-device
 * gate it replaced, this one asks every time — an unlock lasts hours.
 */
export async function requirePlatformOwner(): Promise<Viewer> {
  const v = await requirePlatformOwnerOnly();
  const sb = await createClient();
  // a code from an authenticator, every time — the unlock it buys lasts hours,
  // not months, and nothing about it depends on the mailbox (migration 0025)
  if (!(await adminUnlocked(sb))) redirect("/admin/unlock");
  return v;
}

/**
 * The owner check WITHOUT the device check — for the enrolment page itself,
 * which an owner has to reach from a device that is not trusted yet.
 */
export async function requirePlatformOwnerOnly(): Promise<Viewer> {
  const v = await requireViewer();
  if (!v.isPlatformOwner) redirect("/app?denied=admin");
  return v;
}

/** For route handlers: null means respond 401/403 yourself. */
export async function viewerForRequest(): Promise<Viewer | null> {
  return getViewer();
}
