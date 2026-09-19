import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getViewer } from "@/lib/auth";
import { isDemoHost } from "@/lib/demo";

// The marketing site is www.thefutureclips.com (static, future-clips-site/).
// This host is the app: signed in goes to the product, otherwise to the door.
export const dynamic = "force-dynamic";

/**
 * A magic link whose redirect URL is not on Supabase's allow-list falls back
 * to the Site URL — this page — with the one-time `code` attached. Forward it
 * to the callback so sign-in still completes instead of dropping the code.
 */
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  if (q.code) redirect(`/auth/callback?code=${encodeURIComponent(q.code)}&next=${encodeURIComponent(q.next ?? "/app")}`);
  if (q.error_description || q.error) redirect(`/login?error=${encodeURIComponent(q.error_description ?? q.error ?? "That link did not work. Request a new one.")}`);
  const viewer = await getViewer();
  // the hidden demo host (D-045): nobody signs in by hand there
  if (!viewer && isDemoHost((await headers()).get("host"))) redirect("/api/auth/demo");
  redirect(viewer ? "/app" : "/login");
}
