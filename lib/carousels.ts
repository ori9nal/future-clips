export type Shot = {
  id: string;
  niche?: string;
  w: number;
  h: number;
  alt: string;
};

/**
 * Example carousels from creators in each niche, used with permission.
 * These show the format Future Clips builds — they are not our output,
 * and the page says so plainly in the status section and the FAQ.
 * Files live in /public/carousels/<id>.webp
 */
export const SHOTS: Shot[] = [
  { id: "finance-rules", niche: "Finance", w: 500, h: 625, alt: "Finance carousel cover: five financial rules you should know by 30" },
  { id: "golden-six", niche: "Longevity", w: 500, h: 625, alt: "Longevity carousel cover: the six golden exercises" },
  { id: "running", niche: "Running", w: 500, h: 625, alt: "Running carousel cover: side effects of running nobody warned you about" },
  { id: "hit-muscle", niche: "Calisthenics", w: 500, h: 663, alt: "Calisthenics carousel cover: hit every muscle with zero equipment" },
  { id: "lazy-habits", niche: "Athletics", w: 500, h: 667, alt: "Athletics carousel cover: lazy habits that make athletes unstoppable" },
  { id: "ufc", niche: "Combat sports", w: 500, h: 625, alt: "Combat sports carousel cover: ten changes I would make to the UFC" },
  { id: "photoshoot", niche: "Brand / DTC", w: 500, h: 667, alt: "Brand carousel cover: what fitness brands spend per product photoshoot" },
  { id: "info-power", niche: "Mindset", w: 500, h: 625, alt: "Mindset carousel cover: information is power, so build yours" },
  { id: "premium", niche: "Design", w: 500, h: 625, alt: "Design carousel cover: make your carousels look premium" },
  { id: "bad-vs-viral", niche: "Design", w: 500, h: 667, alt: "Design carousel cover: bad versus viral Instagram carousels" },
  { id: "same-carousel", niche: "Marketing", w: 500, h: 620, alt: "Marketing carousel cover: most brands post the same carousel" },
  { id: "teach", niche: "Education", w: 500, h: 625, alt: "Education carousel cover: carousels are the best way to teach" },
  { id: "fonts", niche: "Design", w: 500, h: 625, alt: "Design carousel cover: eight fonts for eight different feelings" },
  { id: "not-ugly", niche: "Self-improvement", w: 500, h: 625, alt: "Self-improvement carousel cover: habits that quietly affect your looks" },
  { id: "running-3", niche: "Running", w: 500, h: 625, alt: "Interior slide from a running carousel" },
];

export const byId = (id: string): Shot =>
  SHOTS.find((s) => s.id === id) ?? SHOTS[0];

export const src = (s: Shot) => `/carousels/${s.id}.webp`;

/** Sets the hero reel cycles through — one column per set. */
export const REEL_SETS: string[][] = [
  ["running", "running-3", "lazy-habits"],
  ["finance-rules", "info-power", "teach"],
  ["hit-muscle", "golden-six", "ufc"],
  ["not-ugly", "premium", "fonts"],
  ["photoshoot", "same-carousel", "bad-vs-viral"],
];

export const CAMPAIGNS = [
  { cover: "finance-rules", dot: "info-power", name: "Finance & investing", rate: "$1,100" },
  { cover: "running",       dot: "hit-muscle", name: "Fitness & running",   rate: "$950" },
  { cover: "premium",       dot: "fonts",      name: "Creator & design",    rate: "$1,400" },
];
