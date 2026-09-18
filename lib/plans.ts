/**
 * Plan names as the site sells them. Safe to import from client components.
 * The database carries `plans.label` from migration 0006; this is the fallback
 * for the internal ids (solo/grind/agency never changed).
 */
export const PLAN_LABELS: Record<string, string> = { free: "No plan", solo: "Clipper", grind: "Pro", agency: "Studio" };
export const planLabel = (p: { id: string; label?: string | null }) => p.label ?? PLAN_LABELS[p.id] ?? p.id;
