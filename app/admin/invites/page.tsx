import { requirePlatformOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasServiceRole, adminClient } from "@/lib/supabase/admin";
import AppShell from "@/components/AppShell";
import { addInvite, removeInvite, setSignupMode } from "../actions";

export const dynamic = "force-dynamic";

type Invite = { email: string; org_id: string | null; role: string; note: string | null; created_at: string };

/**
 * Who can get in. In `invite` mode the database refuses to create an account
 * for any email that is not listed here (trigger on auth.users), so this list
 * IS the access control while the product is private. `open` lets anyone
 * sign up; the list then only grants extra memberships (e.g. platform owner).
 */
export default async function InvitesPage() {
  const viewer = await requirePlatformOwner();
  const sb = await createClient();
  // The account list needs the service role: RLS only shows an admin the
  // workspaces they are in, not every customer's. Without the key on this
  // host the section shows what RLS allows and says so.
  const wide = hasServiceRole();
  const [{ data: setting }, { data: invites }, { data: members }] = await Promise.all([
    sb.from("app_settings").select("value").eq("key", "signup").single(),
    sb.from("allowed_emails").select("email, org_id, role, note, created_at").order("created_at", { ascending: false }),
    (wide ? adminClient() : sb).from("members").select("user_id, role, org:orgs(name, is_platform)"),
  ]);
  const emails = new Map<string, string>();
  if (wide) {
    const { data } = await adminClient().auth.admin.listUsers({ perPage: 1000 });
    data?.users.forEach((u) => emails.set(u.id, u.email ?? ""));
  }
  const mode = (setting?.value as any)?.mode ?? "invite";
  const platformOrgId = viewer.memberships.find((m) => m.org.is_platform)?.org.id;
  const { data: demoOrgId } = await sb.rpc("fc_demo_org_id");

  return (
    <AppShell active="admin" viewer={viewer}>
      <header className="fc-head">
        <p className="fc-eyebrow">Admin · access</p>
        <h1>Who can sign in.</h1>
        <p className="fc-sub">
          Sign-up is <b>{mode === "invite" ? "invite-only" : "open"}</b>. In invite mode the database refuses to create an
          account for any email not on this list — the app cannot be reached without one.
        </p>
      </header>

      <section className="fc-card">
        <h2>Sign-up mode <span className="fc-tag" data-ok={mode === "invite" ? "1" : "0"}>{mode}</span></h2>
        <form action={setSignupMode} className="fc-form" style={{ gridAutoFlow: "column", justifyContent: "start" }}>
          <button type="submit" name="mode" value="invite" className="fc-btn" data-variant={mode === "invite" ? undefined : "ghost"}>Invite only</button>
          <button type="submit" name="mode" value="open" className="fc-btn" data-variant={mode === "open" ? undefined : "ghost"}>Open sign-up</button>
        </form>
        <p className="fc-note" style={{ marginTop: 12 }}>Switch to open when you launch. Everything else (plans, quotas, billing) stays as it is.</p>
      </section>

      <section className="fc-card">
        <h2>Invite someone</h2>
        <form action={addInvite} className="fc-form">
          <div className="fc-row">
            <label><span>Email</span><input name="email" type="email" required placeholder="name@company.com" /></label>
            <label>
              <span>Access</span>
              <select name="scope" defaultValue="customer">
                <option value="customer">Customer — their own workspace, free plan</option>
                <option value="platform_owner">Platform owner — sees /admin (team only)</option>
                <option value="demo">Demo — the shared demo workspace: Clipper plan, example results and campaigns, nothing generated</option>
              </select>
            </label>
          </div>
          <label><span>Note <em>(optional)</em></span><input name="note" placeholder="beta tester, agency X…" /></label>
          <button type="submit" className="fc-btn">Add to the list</button>
        </form>
      </section>

      <section className="fc-card">
        <h2>Invite list <span className="fc-tag">{invites?.length ?? 0}</span></h2>
        <table className="fc-table">
          <thead><tr><th>Email</th><th>Access</th><th>Note</th><th>Added</th><th></th></tr></thead>
          <tbody>
            {(invites as Invite[] | null)?.map((i) => (
              <tr key={i.email}>
                <td><b>{i.email}</b></td>
                <td>{i.org_id === platformOrgId ? `platform ${i.role}` : i.org_id && i.org_id === demoOrgId ? "demo" : i.org_id ? `org ${i.role}` : "customer"}</td>
                <td>{i.note ?? "—"}</td>
                <td>{new Date(i.created_at).toLocaleDateString()}</td>
                <td>
                  {i.email.toLowerCase() !== viewer.user.email.toLowerCase() && (
                    <form action={removeInvite.bind(null, i.email)}>
                      <button type="submit" className="fc-link">remove</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="fc-note" style={{ marginTop: 12 }}>
          Removing an email stops a <em>new</em> account being created for it. Someone who already signed in keeps their
          account; remove them from their workspace to cut access.
        </p>
      </section>

      <section className="fc-card">
        <h2>Signed-in accounts <span className="fc-tag">{members?.length ?? 0} memberships</span></h2>
        {!wide && <p className="fc-note">Showing only the workspaces you belong to — the full account list needs SUPABASE_SERVICE_ROLE_KEY on this host.</p>}
        <table className="fc-table">
          <thead><tr><th>User</th><th>Workspace</th><th>Role</th></tr></thead>
          <tbody>
            {(members as any[] | null)?.map((m) => (
              <tr key={`${m.user_id}-${m.org?.name}`}>
                <td>{emails.get(m.user_id) ?? <code>{String(m.user_id).slice(0, 8)}…</code>}</td>
                <td>{m.org?.name}{m.org?.is_platform ? " (platform)" : ""}</td>
                <td>{m.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
