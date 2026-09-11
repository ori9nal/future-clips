# engine/_attic — the superseded direction, kept for reference only

Nothing in here is on the current generate path (`tools/make-set.mjs`). It is the
"premium poster / template families" engine from August 2026 (dark plates,
split-tone grades, rim light, coloured accent words, JSON template families
f1–f6, a constellation-of-object-cutouts style, a stock-photo + matting sourcing
layer, and the 10-round automated gauntlet that scored it). The owner rejected
that direction on 2026-08-28 (see `docs/attic/`), and rejected stock imagery
outright on 2026-09-07 ("use ai please").

Why it is here and not deleted: `app/api/generate/route.ts` (not the engine's
surface) still dynamically imports `engine/index.mjs`; the studio UI never calls
that route. Move or delete the route, then delete this directory.

Contents: `index.mjs` + `cards/compose/concept/copy/layout/match/palette/
render-type/seed/subjects/validate` (template engine), `constellation/
render-constellation/objects*` (object-cutout style), `render-photo`,
`negative-space` + `screen-warp` (one-off design/atlas scripts), `budget.mjs`
(a hard-cap spend ledger that was never wired in), `source/` (Pexels/Unsplash
stock + @imgly matting), `templates/`, `gauntlet/`.
