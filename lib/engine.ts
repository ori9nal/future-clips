import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Is the render engine present on this host?
 *
 * The engine (engine/*.mjs, fonts, campaign assets) ships with the full
 * deploy. The auth-gated app can go up without it, and until phase 3 moves
 * rendering onto Storage there is nothing for it to do on a host anyway.
 * Anything that would dynamically import engine/ checks this first and
 * answers 503 with a plain reason instead of throwing at import time.
 *
 * A file check, not an env flag: the truth is whether the files are there.
 */
export const ENGINE_ROOT = path.join(process.cwd(), "engine");

export function engineAvailable(): boolean {
  return fs.existsSync(path.join(ENGINE_ROOT, "styles", "registry.mjs"));
}

export const ENGINE_MISSING = "the render engine is not deployed on this host yet";

/** 503 body for the routes that need the engine. */
export function engineUnavailable() {
  return Response.json({ error: ENGINE_MISSING }, { status: 503 });
}
