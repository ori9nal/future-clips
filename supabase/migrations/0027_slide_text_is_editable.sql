-- 0027: the words on a slide are an element, so let people move and rewrite them.
--
-- The image model draws the photograph and nothing else; the type is a <text>
-- element our own renderer wrote. Until now that was an implementation detail.
-- It is now a feature: `registry.render` keeps, per slide, the SVG that drew
-- the words (a kilobyte, with the picture split out to its own file) and the
-- blocks it can see in it. A customer moves a block or retypes it, and the
-- slide is drawn again in about a fifth of a second with no model call and no
-- money spent.
--
--   layout_json  [{ slide, canvas:{w,h}, art, blocks:[{ id, lines, box, … }] }]
--   edits_json   { "1": { "b0": { lines:[…], dx, dy } }, … } — what the
--                customer changed, kept so it can be shown and undone
--   edited_at    when a slide was last redrawn from an edit
--
-- The blocks are what the renderer found in the finished slide, not something
-- the styles declare, so all ten styles gained this at once and none of them
-- had to learn a placement protocol.
alter table public.sets add column if not exists layout_json jsonb;
alter table public.sets add column if not exists edits_json jsonb;
alter table public.sets add column if not exists edited_at timestamptz;

comment on column public.sets.layout_json is 'per-slide text blocks and canvas, written by the renderer';
comment on column public.sets.edits_json is 'the customer''s text and position changes, by slide then block id';
