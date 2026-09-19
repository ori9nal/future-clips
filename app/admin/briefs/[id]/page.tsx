import { notFound } from "next/navigation";
import { requirePlatformOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSpec } from "@/lib/db/campaigns";
import BriefForm from "../BriefForm";
import type { Spec } from "@/lib/specs";
import "../../../studio/studio.css";
import "../../new/admin.css";

export const dynamic = "force-dynamic";

/** Edit one brief. The page loads it; BriefForm draws it. */
export default async function BriefEditor({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformOwner();
  const { id } = await params;
  const sb = await createClient();
  const spec = (await getSpec(sb, id)) as Spec | null;
  if (!spec) notFound();
  return <BriefForm spec={spec} />;
}
