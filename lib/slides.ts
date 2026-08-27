export type Slide = {
  kicker: string;
  headline: string;
  body: string;
};

/**
 * The eight slides the hero deck builds. Real campaign-carousel copy —
 * this is what the product actually outputs, not filler.
 */
export const HERO_SLIDES: Slide[] = [
  {
    kicker: "01 · HOOK",
    headline: "$0.39 CPM.",
    body: "That's what clippers actually clear. Not the $1.25 on the campaign page.",
  },
  {
    kicker: "02 · PROBLEM",
    headline: "25 minutes an edit.",
    body: "Cut, caption, export, reupload. Then do it twenty-nine more times.",
  },
  {
    kicker: "03 · CEILING",
    headline: "12 posts a week.",
    body: "That's the cap for one person editing video by hand. Every week.",
  },
  {
    kicker: "04 · SHIFT",
    headline: "Carousels pay the same.",
    body: "Same campaign. Same verified views. Same rate card.",
  },
  {
    kicker: "05 · SPEED",
    headline: "2 minutes a post.",
    body: "Pick the campaign. Drop the assets. Ship it.",
  },
  {
    kicker: "06 · VOLUME",
    headline: "30 posts today.",
    body: "Not a projection. That's one afternoon at carousel speed.",
  },
  {
    kicker: "07 · EDGE",
    headline: "2.9x the comments.",
    body: "Carousels out-engage video on the metric campaigns actually count.",
  },
  {
    kicker: "08 · CLOSE",
    headline: "Go take the budget.",
    body: "Brands are running campaigns nobody can supply. Fill them.",
  },
];

export const SLIDE_COUNT = HERO_SLIDES.length;
export const STEP_MS = 200;
export const HOLD_MS = 2000;
