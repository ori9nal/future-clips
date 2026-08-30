import { listSpecs, saveSpec, type Spec } from "@/lib/specs";

export async function GET() {
  return Response.json({ campaigns: listSpecs() });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  try {
    const saved = saveSpec(body as Spec);
    return Response.json({ campaign: saved });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "could not save" }, { status: 400 });
  }
}
