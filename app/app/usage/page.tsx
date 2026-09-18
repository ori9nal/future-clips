import { redirect } from "next/navigation";

/** The counters live in the dashboard (Settings → Plan & slides); this path is kept for old links. */
export default function UsagePage() {
  redirect("/app?page=settings&tab=plan");
}
