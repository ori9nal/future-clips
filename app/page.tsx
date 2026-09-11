import { redirect } from "next/navigation";

// The marketing site is static and lives in /future-clips-site (see
// HANDOFF-SITE.md). This Next.js app is the local studio; its root just
// forwards to it.
export default function Home() {
  redirect("/studio");
}
