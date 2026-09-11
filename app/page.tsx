import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";

// The marketing site is www.thefutureclips.com (static, future-clips-site/).
// This host is the app: signed in goes to the product, otherwise to the door.
export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await getViewer();
  redirect(viewer ? "/app" : "/login");
}
