---
name: slideshow-prompt-builder
description: Generation engine for an automated viral slideshow pipeline. Given a topic, niche, and style direction, produce a complete structured slideshow spec — per-slide image prompts, text overlays, caption, and hashtags — ready to pipe into a downstream image model. Handles any visual style (flat illustration, anime, semi-realistic, photoreal, 3D render, monochrome manga) and picks the slide structure and background treatment that fit the specific topic rather than forcing a fixed template. Covers hook construction, visual consistency across a set, character consistency strategy, and style-specific failure modes. Use for any request to generate slideshow content specs, slide prompt sets, or slideshow batches. Not for single standalone image prompts, video scripts, or caption-only requests.
---

# Slideshow Generation Engine

This runs as the reasoning stage of an automated pipeline. It receives a job spec, plans the slideshow, and emits structured output that a downstream image model renders slide by slide. There is no human in the loop mid-generation — every ambiguity must be resolved here, because nothing downstream can ask a clarifying question.

Two consequences drive everything below:

- **Never emit a placeholder or a "choose one" option.** Every field must be a concrete committed value.
- **Every slide prompt must be fully self-contained.** Image models have no memory across generations. Each slide is an independent sample, so the full subject description, full background spec, and full style declaration are repeated in every single prompt. Never write "same as previous slide."

## Input contract

| Field | Meaning | If missing |
|---|---|---|
| `topic` | The slideshow subject | Derive from `niche` using `references/topic-selection.md` |
| `niche` | Content vertical | Infer from topic |
| `style_profile` | Visual style to render in | Pick the profile that best fits the topic (see Style profiles) |
| `character_spec` | Locked description of the recurring subject | Generate one and freeze it for the whole job |
| `slide_count` | Target length | Choose based on how many real beats the topic has |
| `brand` | Watermark handle, primary hex, accent hex | Omit watermark; pick text colors that read against the chosen background |
| `promo_slide` | Whether to include a promo/CTA slide, and where | Omit it entirely — never insert a promo unprompted |

If `character_spec` is absent, generate one at the start and treat it as frozen. Do not let it drift or "improve" between slides.

## Output contract

Emit a single JSON object. No prose before or after it.

```json
{
  "topic": "string",
  "style_profile": "flat_illustration",
  "background_spec": "the locked background treatment, reused verbatim in every slide prompt",
  "character_spec": "the locked subject description, reused verbatim in every slide prompt",
  "slide_count": 10,
  "slides": [
    {
      "index": 1,
      "role": "hook",
      "pose_id": "short unique pose label, used for the pose-variety check",
      "image_prompt": "complete self-contained prompt, built per the assembly order below",
      "negative_prompt": "comma-separated exclusions",
      "text_overlay": {
        "lines": [
          { "text": "string", "weight": "black", "size": "xl", "color": "#HEX", "shadow": true }
        ],
        "block_position": "upper-center",
        "alignment": "center"
      }
    }
  ],
  "caption": "string",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}
```

**`text_overlay` is separate from `image_prompt` on purpose.** Image models render typography badly — misspellings, broken kerning, fonts drifting between slides in the same set. Composite text in code from this object instead. The `image_prompt` should reserve clean empty space where the text block will land (e.g. "upper 45% of the frame is open background with no subject or detail"). Only bake text into the image when the style profile explicitly says the model handles it acceptably.

## Structuring the set

There is no fixed template. Choose the structure that fits the specific topic, then execute it consistently. Only two positions are fixed:

- **Slide 1 is always the hook.** Nothing else earns attention if this doesn't stop the scroll.
- **The last slide is always a close** — a follow/save prompt with a conclusive feel.

Everything between is chosen from what the topic actually needs:

| Beat | Use when |
|---|---|
| Overview / map | The topic has distinct sub-parts worth previewing; creates a reason to keep swiping toward each one |
| Sequential steps | The content has genuine order (a progression, a routine, a build-up) |
| Item breakdown | Multiple parallel examples that don't depend on order |
| Wrong vs right | The content is a correctable mistake |
| Before / after | The payoff is a transformation |
| Summary / recap | The set covered enough items that a consolidated list adds real save-value |
| Promo / CTA | Only when `promo_slide` is supplied — placement comes from the job spec |

**Structural variety within a set matters.** Never run two structurally identical slides back to back — two wrong/right stacks in a row, or two identical grids, read as repetitive even with different content. Alternate the visual shape between adjacent slides.

Slide count follows content depth. Don't pad to hit a number, and don't compress out real depth to stay short.

## Choosing the visual direction

Two creative decisions get made once per slideshow and then locked across every slide: the **style profile** and the **background treatment**. Consistency within a set is what makes it read as one cohesive post — but *which* look to lock is a fresh choice each time, made to fit the topic and maximize scroll-stop.

### Background treatment

Pick whatever gives the strongest thumbnail for this topic and style. Options that work:

- **Flat saturated color** — maximum contrast with the subject, text reads instantly, strongest at thumbnail scale. Best default for illustrated styles.
- **Soft gradient / duotone** — more depth than flat while staying clean behind text.
- **Real environment** — a gym, a kitchen, a street. Necessary for photoreal; adds credibility and context.
- **Dramatic lighting on dark** — high contrast, premium feel, strong for aspirational or transformation topics.
- **Minimal studio backdrop** — seamless paper, soft shadow. Clean for product and physique focus.

What actually decides it:
- The subject must separate clearly from the background — if they share a value range, the thumbnail turns to mush.
- Text areas need a calm region. A busy background behind the headline kills the 1-second read.
- Match the topic's emotional register: bright saturated for energetic/beginner content, dark and moody for intensity or transformation.

Whatever gets chosen goes into `background_spec` and is repeated **verbatim** in every slide prompt. Lock exact hex values for flat and gradient treatments. For real environments, lock the specific location, wall color, flooring, equipment layout, and time of day — real spaces drift far more than flat colors do.

## Style profiles

The profile sets the first line of every prompt, the consistency strategy, and which failure modes to guard.

### `flat_illustration`
Flat cel-shaded vector-style, solid colors, bold clean linework. Most reliable profile across a long set — prose description alone holds consistency well.

### `anime_illustration`
Anime/manga character art, cel shading, expressive faces. Lock hair color and style, eye color and shape, and outfit piece by piece. Face style drifts more than flat illustration does — keep facial descriptors short and highly specific rather than long and interpretive.

### `monochrome_manga`
Black-and-white, screentone shading, crosshatching, high contrast. Do not apply flat-color background language here — demanding "one single flat color" fights the screentone aesthetic and washes the result out.

### `semi_realistic`
Stylized-realistic render, painterly or 3D, real proportions with artistic finish. Prose consistency starts failing around slide 5+. Lighting drifts hard — lock the setup (direction, temperature, intensity) in every prompt, not just the first.

### `photoreal`
Photographic realism. **Prompt shape changes**: lead with camera and lighting language ("85mm portrait, soft window light, shallow depth of field") rather than an illustration-style declaration. Never bake text into the image. Environment and wardrobe must be locked per slide, not just the subject.

### `product_focus`
No recurring human — equipment, food, supplements, objects. Sidesteps character consistency entirely. Worth defaulting to when a photoreal set would otherwise depend on a face the pipeline can't hold.

## Character consistency

The hardest technical problem in the pipeline and the most common cause of a set that looks broken.

- **Illustrated profiles**: verbatim repetition of `character_spec` in every prompt is sufficient. Keep it tight — 4–6 locked attributes beats a long paragraph, because long descriptions give the model more room to reinterpret.
- **`semi_realistic` and `photoreal`**: verbatim prose is **not** sufficient. One human face will not survive 10 slides from description alone — around slide 5 it becomes a different person. Realistic options:
  1. **Reference-image conditioning** (character reference / IP-adapter / img2img) from one fixed source image. The only approach that reliably holds a face.
  2. **Fixed seed plus identical character clause.** Helps, degrades once poses change substantially.
  3. **Frame around it** — back view, cropped at the neck, silhouette, hands-only, or switch to `product_focus`.

If the pipeline has no reference-conditioning capability, option 3 is the reliable path for photoreal. Do not emit a set that depends on face consistency the pipeline cannot deliver.

## Prompt assembly order

Order matters — image models weight earlier tokens more heavily, so style and subject anchor the composition before pose and props.

1. **Style declaration** — per profile, with aspect ratio and canvas (3:4 vertical, 1080x1350 unless specified).
2. **Background** — `background_spec` verbatim, stating explicitly what it must not contain.
3. **Watermark** — only if supplied; exact position, size, opacity.
4. **Subject** — `character_spec` verbatim, in full, every slide.
5. **Pose** — exact body angle, what each limb is doing, facial direction, emotion conveyed.
6. **Secondary elements** — props, equipment, comparison figures: position relative to subject, relative size, exact appearance.
7. **Reserved text space** — where the composited text block lands; that region stays clean.
8. **Lighting** — required for `semi_realistic` and `photoreal`.
9. **Closing guardrail** — "nothing else in the frame, no additional props, no background details."

## The hook slide

The scroll-stopper. If this fails, nothing downstream matters.

**Color alternation is the core technique.** Split the headline across 3–4 short lines, alternating primary and accent colors line by line. Never all one color — that alone is what makes a headline feel dynamic rather than flat.

- Line 1: primary color
- Line 2: primary (or accent if emphasis should land higher)
- Line 3 — **the hook word**, the actual claim or curiosity driver: accent color, largest size on the slide even if short
- Line 4 (optional): small supporting subtext, lighter weight, smaller, casual/lowercase-feeling, may end in one relevant emoji

**Size hierarchy:** hook word largest, supporting lines uniform with each other, subtext noticeably smaller and lighter. Loud headline, quiet aside.

**Weight:** headline at heaviest available (black/extra-bold). Subtext lighter.

**Shadow:** subtle soft dark grey drop shadow on headline lines only, never the subtext. Low contrast, softly offset, not a hard outline.

**Position:** upper 40–50% of canvas, centered. Subject occupies the lower half. Readable at thumbnail size before anyone taps in.

**Copy rules:**
- 3–5 words in the main claim. Short, absolute, confident beats long or hedged.
- No parentheticals or qualifying counts ("(All 8)") — they shrink an infinite-feeling promise into a finite one and slow the read.
- Definitive words ("every", "the complete", "zero", "the only") outperform vague phrasing.
- No jargon or insider terms requiring prior knowledge — anything needing explanation causes scroll-past, not curiosity.
- Direct second-person observation ("Why You've X", "You've Been Skipping X") creates a "wait, is that me?" reaction and performs well — but vary the sentence structure across consecutive jobs in the same niche to avoid pattern fatigue.
- Bar to clear: understandable in under 1 second with zero prior context.

**Pose:** communicates the emotional core of the topic — confidence, frustration, curiosity, aspiration — without needing text.

## Content slide craft

**4-item density rule.** When breaking a sub-topic into parallel examples, use a dense 2x2 grid of exactly 4. This was tested directly against a 2-item layout and the 4-item version significantly outperformed it in reach and save rate. Never fewer than 4 when the grid format applies — sparse layouts read as less complete and less save-worthy at identical content quality.

**Layout:** no boxes, borders, or panels. Items sit directly on the background with no separating edge. Generous even spacing so nothing overlaps.

**Every named item gets its own full illustration.** Never a text-only list of item names with one supporting image — text-only lists measurably underperform.

**Multi-panel prompts:** describe each panel's subject and pose completely independently. Never "same as panel 1 but doing X" — cross-panel references bleed elements between panels.

**Wrong/right format:** two versions of the subject stacked vertically on one slide — incorrect on top with a red X, correct on bottom with a green checkmark, thin horizontal divider between.

**Overview/map slides:** keep the pose simple and neutral — the color-coded highlights do the work, and a dramatic pose obscures them. Every region gets its own bright saturated hex, all clearly distinct from each other, and each highlight needs an explicit "confined to this region only, nowhere else" clause — bleeding is a real recurring failure without it. For every region, spell out the arrow, the bold label, and the small why-it-matters line **individually**. Writing "add labels for each region" as one blanket instruction is exactly what causes arrows to be skipped or pointed at the wrong area.

**Summary slides:** subject at ~35% width, list at ~60%. State explicitly that the head begins clearly below the title text with visible open space and the feet end with a small gap above the canvas bottom — constraining width alone without height and vertical position is the usual cause of an oversized-looking subject.

**Closing slides:** text stacked in one corner, subject in the opposite corner at 40–45% width, confident conclusive pose with direct gaze at the viewer. Add a faded echo — a duplicate of the subject at 15–25% opacity, slightly behind and offset — for depth. On transformation topics, make that echo the "before" version from the hook instead, bookending the arc.

**If a promo slide is supplied:** subject and featured item split roughly 40/60. Gaze directed **at the item**, not the viewer — that away-gaze is what separates "personal habit" from "staged ad." CTA phrasing stays casual and first-person ("this is what I use"), never an instructive command. Featured item at correct real-world proportions with a subtle drop shadow and explicitly "no glow, no colored lighting" — generators default to adding bloom on product mockups.

## Pose variety

Assign a distinct `pose_id` to every slide. The hook, any overview, any promo, and the closing must all differ — never reuse a stance (e.g. arms raised out to the sides) across more than one of them. Repeated poses read as lazy even when each slide looks fine alone. Verify no two match before emitting.

## Visual error prevention

### Universal

1. **Two-object / two-limb rule.** When a subject interacts with two objects, or limbs need independent description, never use one flowing sentence ("holding X in one hand and Y in the other"). Describe the left side in its own clause, then the right side separately. Add "both arms clearly separate, no merged limbs, no extra limbs" as a safeguard on any two-handed or asymmetric interaction.

2. **State symmetry explicitly.** For mirrored poses, write "BOTH" and describe each side individually even when identical — "BOTH hands grip the bar symmetrically", not "hands grip the bar."

3. **No mid-transition poses.** "Mid-rotation", "transitioning between X and Y", "the motion" all render unreliably. Specify a single frozen position in full detail.

4. **Object-to-body boundaries explicit.** When a prop touches or is gripped, state its exact position relative to the body and that it remains a separate distinct object, not merged with the limb. For looped objects, state that both ends hang separately without crossing.

5. **Lock the background verbatim across the set.** Whatever treatment was chosen, repeat it identically every slide. For flat and gradient treatments, state the exact hex plus "this precise shade only — not a lighter or darker variation, not an adjacent similar tone." Drift between slides is a real recurring problem without this.

6. **No clinical anatomy-checklist language.** "Exactly two arms, exactly five fingers" can trip content filters and produce uncanny results. Be fully explicit about what each limb does using natural descriptive language instead.

7. **Never invent technique or product names.** Any named technique or item must be real and correctly described. Fall back to a generic accurate description rather than a confident fabrication.

8. **Logical consistency check.** A pose must not contradict another fact on the same slide — "lifting their shirt" when the locked subject wears no shirt. The renderer cannot resolve contradictions sensibly.

9. **Populate `negative_prompt` every slide.** At minimum: extra limbs, merged hands, deformed hands, extra fingers, watermark text, signature, blurry, cropped subject, duplicate subject (except on a closing slide with an intentional echo).

### Photoreal-specific

10. **Lighting lock every slide.** Direction, quality, and temperature repeated verbatim — "soft diffused window light from camera left, neutral white balance." Lighting drift is the most visible photoreal inconsistency.

11. **Wardrobe lock.** Every garment by item, color, and fit, in every prompt. Clothing drifts faster than faces.

12. **Never bake text into the image.** Always composite.

## Caption and hashtags

- **Fresh every job.** Never template or reuse a caption from a previous slideshow.
- **One short punchy line**, 1–2 max, that either states the core value in a curiosity-driving way or poses a direct easy-to-answer engagement question ("comment which one is actually you"). Questions generate more comments than passive statements.
- **Keep it short.** Long captions push slide content up and cause cropping on display.
- **Exactly 5 hashtags:** 1–2 broad-reach, 3–4 specific to this exact sub-topic. No generic filler.

## Self-check before emitting

Any failure means fix and re-verify, not emit-with-a-caveat.

1. Every `image_prompt` contains `character_spec` and `background_spec` verbatim — no "same as above" anywhere.
2. All key slides have distinct `pose_id` values.
3. No two structurally identical slides sit back to back.
4. Every prompt ends with the closing guardrail line.
5. Every slide with text has a `text_overlay` object, and its `image_prompt` reserves clean space where that block lands.
6. Subject separates clearly from the chosen background at thumbnail scale.
7. Exactly 5 hashtags.
8. No placeholders, no bracketed TODOs, no "choose one" alternatives anywhere.

## Reference files

- **`references/topic-selection.md`** — read when `topic` is absent or needs validation. Strongest and weakest performing topic categories, and confidence calibration.
- **`references/performance-diagnostics.md`** — read when the job includes performance feedback on prior posts. Save rate benchmarks, view-graph shapes, and separating content problems from platform-side slowdowns.
