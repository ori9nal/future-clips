# Product

Product owns this file. Engineering seeded it on 2026-09-18 with the settled facts; everything under "To specify" is Product's to write and keep current.

## Customer

The individual clipper: a creator paid per 1,000 views in brand clipping campaigns on TikTok and Instagram, posting daily, working alone. Agencies, teams, brands and partners come later and nothing is designed for them now (D-001).

## The core flow (settled, D-007)

1. Sign in with an emailed link (invite-only while in private beta).
2. Pick a live campaign (a brief the platform admin ingested).
3. Give a short idea, or pick one the product offers.
4. Choose the number of slides (5 to 10).
5. Choose the lane: priority (minutes) or within the day (batch).
6. Optionally add instructions: use my logo, use my avatar, include my handle, a small creative note.
7. Generate.
8. Get the finished carousel: slides, caption, bio, hashtags, as a zip.

The clipper never sees the pipeline.

## Plans (settled, D-003; the site is the reference)

Clipper $16, 200 slides. Pro $32, 500 slides, priority and HD. Studio $79, 1,500 slides. Packs of 100 for $8, 250 for $18, 600 for $40 that never expire. No free tier (D-002): an account without a plan sees a choose-a-plan state and cannot generate. Note: the live site presents $16/$32/$79 under a yearly toggle and shows $20/$39/$99 monthly; the owner's decision on that is open (D-013).

## Pipeline as the product experiences it

Claude writes and directs, OpenAI draws, the engine composes (D-004). A priority set takes about two and a half minutes and costs about $0.40 to make; a batch set comes back within the day at roughly half that. Progress stages the UI can show: writing the slides, drawing the first frame, drawing the frames, composing.

## To specify (Product)

- Screens and states: sign-in, first landing with no sets, campaign picker, composer, generating (each stage), cancel, failure, success, library, drawer, download, no-plan state, out-of-slides state, mobile, dark theme.
- The instructions feature: fields (logo upload, avatar upload, handle, free text), where each appears on the slides per style, what the composer shows, what happens when a style cannot use one. Engineering adds `sets.instructions` and the upload route once this is written (see `docs/ROADMAP.md`).
- The choose-a-plan state and its wording, and the wording of every `FC_*` refusal (`lib/sets.ts REASONS`).
- Whether an in-product idea helper earns its place, its behaviour and its cost.
- Findings from using the app (numbered, with screenshots) and what changed as a result.
- Out of scope for now: referrals, partners, teams, brand kits per client, multi-account tracking, trend analysis, bulk generation (all listed on the site's Studio column; none are built).
