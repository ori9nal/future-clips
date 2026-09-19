# PRODUCT.md — what the clipper gets, screen by screen

Owner: Product. Kept current with what the app actually does; findings at the bottom are re-checked every session. Companions: docs/QUALITY.md (the output), docs/DECISIONS.md, docs/ROADMAP.md.

## 1. What it is, for whom

A clipper (a creator paid per 1,000 views in brand clipping campaigns) signs in, picks a live campaign, types a short idea or taps one of the brief's angles, chooses 5–10 slides and a lane, optionally adds instructions, and gets a finished carousel back: PNG slides plus caption, bio and hashtags, as a zip. They never see the pipeline. Plans: Clipper $16 / 200 slides, Pro $32 / 500 with priority and HD, Studio $79 / 1,500; packs 100/$8, 250/$18, 600/$40. There is no free tier. Agencies, teams and brands are out of scope.

## 2. The core flow — screens and states

### 2.1 Sign in (`/login`)
- One field, one button: "Email me a sign-in link". Copy: "We email you a link. No password. Access is by invite while we are in private beta."
- States: **sent** ("Check your inbox … It works once and expires in an hour", with "try again"); **not invited** ("That email is not on the invite list. Ask whoever runs your workspace to add it."); **rate-limited** ("Too many sign-in emails in the last hour…"); **used or expired link** (the callback's `?error=` shown on the form).
- Both themes follow the system; the card is centred on a laptop and full-width on a phone.

### 2.2 Create (`/app`, the composer)
Inputs, in order: campaign → idea → slides → delivery → HD → Make.
- **Campaign**: a list with the brand mark, brand and product; searchable by brand, product or niche once there are more than eight (there are 21 live); one line under each says what the format is in plain words ("phone photos with captions", "illustrated programme"), never a style id.
- **Idea**: a textarea, 3–400 characters, disabled until a campaign is chosen ("Choose a campaign first"). The brief's angles appear as chips under it; tapping one fills the field. Enter makes the slideshow; Shift+Enter is a new line. Empty idea → "Say what the slideshow is about" toast and focus. Nonsense is accepted here and judged by the compliance loop (a failed set returns the slides).
- **Slides**: Short 5–6 · Standard 6–8 · Long 8–10, clamped to the brief's range with the clamp stated ("This brief allows 5 to 8"). Exact counts live in Settings → Defaults ("Exactly 7"); the composer shows the resulting words ("8 slides").
- **Delivery**: Within the day (batch, from the monthly allowance) or Priority (a minute or two, from the priority allowance; Clipper sees it disabled with "Priority comes with Pro and Studio").
- **HD**: off by default; on Pro/Studio "Sharper frames, uses 3 slides each"; on Clipper disabled with "Comes with Pro and Studio".
- **Cost line**: "Uses up to 8 of your 476 slides" / with HD "8 slides at HD, 24 of your 42 priority slides" / when short "This needs up to 24 slides and you have 12 left" (red).
- **Make the slideshow**: disabled until campaign + idea + enough slides; "Starting" while the request is out.
- **After Make**: the set appears at the top of Recent with the four steps (Writing · First frame · Drawing · Composing) and a toast: priority "Making it now. A minute or two."; batch "Queued: 6 to 8 slides, back within the day".
- **Cancel** is offered while queued; the toast says whether the slides came back now or on the next tick.
- **Failure**: the card shows the reason and "The slides went back to your balance."
- **Success**: "8 slides are ready" toast; the card gets Ready, Download all, Make another, the caption and the tiles.
- **Errors from the API** are shown as sentences mapped from the error code, never the raw string (finding 8).

### 2.3 Recent and Library
- Create shows the four most recent sets as compact cards (a single row of small tiles); the Library shows every set with the full tile grid, newest first.
- A tile opens the **drawer**: the slide, "Text on the slide", the caption on slide 1, Previous / Next, Download (single PNG), Close; Escape closes it.
- **Download all** is a zip of the PNGs plus post.txt (caption, bio, hashtags).
- **Make another** loads the same campaign and idea back into the composer.
- Empty Library: "Nothing here yet — Slideshows you make appear here, newest first" with "Make your first one".

### 2.4 Insights and Settings
- Insights: slideshows made this period, slides used of the allowance, priority used, average slides per slideshow, HD slides; "Latest finished" below. Real counts, nothing estimated.
- Settings → Account (email, workspace, sign out, delete by email), Plan and slides (plan, allowance, priority left, packs, billing), Defaults (slides per slideshow incl. exact counts, priority, HD, dark theme).

### 2.5 The no-plan state (D-002)
An account with no plan (and no pack balance) sees, on every page:
- the header meter replaced by **"No plan yet · Choose a plan"** (button to Settings → Plan);
- on Create, above the composer: **"Choose a plan to start making slideshows. Clipper is $16 a month for 200 slides; Pro adds priority delivery and HD."** with one button, **"Choose a plan"**; the composer stays visible but Make is disabled and the cost line reads "Needs a plan";
- Settings → Plan lists Clipper / Pro / Studio with "Choose" buttons (checkout when connected, email until then) and the packs greyed with "Packs top up a plan".
No sentence anywhere says "free".

### 2.6 Out of slides
Meter at 0 turns the bar empty; the cost line says "You have 0 slides left this period. Add a pack or wait for {renew date}." with "Add a pack" → Settings → Plan.

### 2.7 The single-image post (P-12)
A second thing a clipper can make, next to the slideshow: **one image plus the description**. The composer gets a format choice above Slides: **Slideshow** (5–10 slides) or **Single image**. With Single image the slides control disappears, the cost line reads "Uses 1 slide", and the result card shows one tile, the hook, and the description in full with a copy button. The zip carries `image.png` and `post.txt`.

What the engine makes (from the Poky reference, QUALITY.md §3.7): a 9:16 selfie-style frame in the campaign's family with the hook on it in two lines (white or the campaign accent with a white outline) at the top third; a description of 500–700 words in the campaign's language with the hook line, N numbered items (✅) each with a one-line personal reason and three 👉 bullets, the app named two or three times with its full name and where to get it, a save line, a question to the comments, and 3–5 hashtags. The same description can be reused with a different image: "Make another" keeps the description and draws a new frame ($0.04).

Engineering needs: `sets.format` (`slideshow` | `single`), `slides = 1` allowed by the gate for that format, and the download route's zip naming (R12).

## 3. Instructions on a set (P-05, request R3)

The composer gets a fourth block, **Instructions** (collapsed by default, "Add your logo, avatar or handle"):

| Field | Input | Where it lands, per kept style |
|---|---|---|
| Handle | text, `@name`, ≤ 30 chars, remembered as a workspace default | feed / native: a small outlined caption at the bottom centre of the closer, 0.9 of body size ("@name" as the reference posts sign off); bedrock: replaces "FOLLOW FOR MORE"'s sub-line; rail: the header strip's right cell |
| Logo | png/jpg/webp ≤ 2 MB, remembered | feed / native: the app-icon device (rounded square + white pill) on the app slide when the campaign has no icon of its own; rail: the top-left header cell; bedrock: the small mark top-left |
| Avatar | png/jpg/webp ≤ 2 MB, remembered | feed "days" mode: **the anchor identity** — the person across the set is drawn from the avatar (art.mjs takes the avatar as the anchor's reference); bedrock/rail: unused |
| Note | free text ≤ 200 chars, per set | appended to the clipper's ask as "Also: …" in the copy request; never to the image prompts (they are cache keys) |

Rendering rules: the handle never covers the hook; the logo never replaces a campaign-mandated app icon; an avatar that is not a face is rejected with "Use a photo where your face is visible". The preview of each is shown in the composer block (tiny) so the clipper knows it is on.

## 4. The idea helper — decided: not now (P-06)
The brief's angles give three ready asks per campaign for $0. A helper would need an endpoint and cost about a cent a call. Revisit if Insights shows empty-ask abandonment. What Create does instead: the placeholder suggests the shape ("An angle, a list, a lesson. For example: the 5 nutrition habits that finally stuck"), and the hook patterns from QUALITY.md §4 seed the angles the admin writes into a brief.

## 5. Out of scope
Agencies, teams, seats, referrals ("Refer and earn" stays hidden unless DECISIONS enables it), brand kits per client, own-creator locking, multi-account tracking, trend analysis, bulk generation (the site's Studio column lists these; none are built), editing text in the drawer (Later), the marketing site. Settled facts (D-001 to D-010) are in docs/DECISIONS.md; the site presents $16/$32/$79 under a yearly toggle and the owner's call on that is D-013.

## 6. Findings (2026-09-18) — mode: **preview** = `/design-preview?view=clipper` on fixture data, **real** = the running app with a session

Screenshots: `output/gauntlet/2026-09-18/app/`. No finding below is from the real signed-in app; R1 (dev sign-in) is what unblocks that.

| # | Screen · action | Expected | Seen | Mode | Owner / fix |
|---|---|---|---|---|---|
| 1 | /login cold open | brand mark, one clear action | The brand mark is an empty lime pill next to "The futureclips" — reads as a missing image. Otherwise clear. | real (page), no session | product: draw the mark |
| 2 | /login, uninvited email, Enter | "not on the invite list" | No visible state change within 5 s in the in-app browser; the console shows a blocked request (`ERR_BLOCKED_BY_CLIENT`), so the pane may be blocking Supabase. Not validated. | real, blocked | retest with Playwright / real Chrome next session |
| 3 | Create → campaign picker | find one of 21 quickly | A plain list, no search; the sub-line leaks style ids ("photo feed", "phone post", "pastel"). | preview | product (this session: search + plain words) |
| 4 | Create → idea | obvious what to type | Placeholder before choosing: "Choose a campaign first"; after: "Pick an angle below, or write your own" and the chips. Good. Enter submits, which a clipper may not expect while typing a second line. | preview | keep; note Shift+Enter in the placeholder |
| 5 | Slides presets | exact counts too | Only Short/Standard/Long; "Long" on a 5–8 brief becomes "8 slides. This brief allows 5 to 8." Exact counts only in Settings. | preview | product: add "Exactly N" to the composer (Next) |
| 6 | Priority + HD on | the cost in one honest line | "Uses up to 24 of your 42 slides." — the 3× for HD and the switch to the priority allowance are not said. | preview | product (this session) |
| 7 | Make on Clipper with HD/priority | disabled with a reason | Disabled controls carry "Comes with Pro and Studio" — good. | preview | keep |
| 8 | Make the slideshow (preview has no session) | a sentence | The raw API string "sign in required" in red. Every non-FC error is shown raw. | preview | product: map codes to sentences (this session); R8 for codes |
| 9 | Create → Recent | a glance at recent sets | Each recent set is a 3-column wall of full-size tiles; four sets = a very long page before the Library. | preview | P-07 (owner); product proposes a strip |
| 10 | Library → tile → drawer | slide, text, caption, prev/next, download | Works: "Slide 2 of 8", text on the slide, caption on slide 1, Previous/Next, Download, Escape closes. | preview | keep. Verify on the real app that Download saves rather than opens (cross-origin `download` attribute). |
| 11 | Insights | numbers match what I did | Tiles render; in preview the fixture usage (24 used) and the demo sets (4 × 7.8) do not reconcile, which is an artefact of fixtures, not a bug. Needs the real app. | preview | verify after R1 |
| 12 | Settings → Plan | honest plan state | "Pro plan · 500 slides a month, 50 priority, HD included", Switch/Upgrade/Compare, packs, "Checkout is being connected, so the buttons email us for now", Billing "Email us". Clear. | preview | keep |
| 13 | plan=free (no plan) | the choose-a-plan state | Meter shows a bare "5" and a full bar; composer says "This needs up to 8 slides and you have 5 left." with no route to a plan; with a 0 balance the copy says "Your free slideshow is used. Posting every day starts on Clipper." | preview | product (this session): §2.5 state, free words removed; R7 for the DB path |
| 14 | Mobile 375 px, Create | nothing clipped | The header meter text clips at the right edge ("42 priorit"); the composer itself stacks well. | preview | product (this session) |
| 15 | Mobile 375 px, light theme, set card | readable buttons | "Download all" and "Make another" render as black pills on the light theme; "Make another" text is unreadable. | preview | product: check `.btn` under the mobile query (this session) |
| 16 | Keyboard, Tab through the composer | a visible focus ring | Seven Tabs from the top of Create show no focus ring on any control; `:focus-visible` exists in CSS but the segmented buttons, chips and switches do not show it at the size drawn. | preview | product (this session): stronger ring |
| 17 | Sidebar | clipper-only navigation | "Refer and earn" appears whenever referral data exists — agency-facing. | preview | product: hidden unless DECISIONS enables it |
| 18 | Batch set waiting | a step | Any queued row shows "In the queue" with no step lit for as long as the provider batch takes. | code + audit bug 15 | R5 |
| 19 | Set finished while open | drawer text | "Text on the slide" is empty for a set that finished during the session. | code + audit bug 14 | R4 |
| 20 | Real generation from the app on this machine | a rendered set | Not possible: no `SUPABASE_SERVICE_ROLE_KEY` locally (OWNER-ACTIONS E). Sets were made through `tools/lane.mjs` and shown in the preview. | blocked | R2 |
