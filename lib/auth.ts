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

export type Plan = "free" | "solo" | "grind" | "agency";

export type Org = {
  id: string;
  name: string;
  plan: Plan;
  seat_limit: number;
  is_platform: boolean;
  billing_status: string;
  current_period_end: string | null;
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
    .select("role, org:orgs(id, name, plan, seat_limit, is_platform, billing_status, current_period_end)")
    .order("created_at", { ascending: true });

  const memberships: Membership[] = (rows ?? [])
    .filter((r: any) => r.org)
    .map((r: any) => ({ role: r.role, org: r.org as Org }));

  if (!memberships.length) return null; // the bootstrap trigger did not run — treat as signed out

  const isPlatformOwner = memberships.some((m) => m.org.is_platform && m.role === "owner");
  // A platform admin also has a personal org to try the product as a customer;
  // that personal org is what the customer surface acts for.
  const primary = memberships.find((m) => !m.org.is_platform) ?? memberships[0];

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

/** For /admin: a platform owner or a 404-shaped redirect (no hint that /admin exists). */
export async function requirePlatformOwner(): Promise<Viewer> {
  const v = await requireViewer();
  if (!v.isPlatformOwner) redirect("/app?denied=admin");
  return v;
}

/** For route handlers: null means respond 401/403 yourself. */
export async function viewerForRequest(): Promise<Viewer | null> {
  return getViewer();
}
