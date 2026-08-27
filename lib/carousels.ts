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
 * Files live in /public/carousels/<id>.jpg
 */
export const SHOTS: Shot[] = [
  { id: "finance-rules", niche: "Finance",          w: 640, h: 800, alt: "Finance carousel cover: five financial rules you should know by 30" },
  { id: "golden-six",    niche: "Longevity",        w: 640, h: 800, alt: "Longevity carousel cover: the six golden exercises" },
  { id: "running",       niche: "Running",          w: 640, h: 800, alt: "Running carousel cover: side effects of running nobody warned you about" },
  { id: "hit-muscle",    niche: "Calisthenics",     w: 640, h: 849, alt: "Calisthenics carousel cover: hit every muscle with zero equipment" },
  { id: "lazy-habits",   niche: "Athletics",        w: 640, h: 853, alt: "Athletics carousel cover: lazy habits that make athletes unstoppable" },
  { id: "ufc",           niche: "Combat sports",    w: 640, h: 800, alt: "Combat sports carousel cover: ten changes I would make to the UFC" },
  { id: "photoshoot",    niche: "Brand / DTC",      w: 640, h: 853, alt: "Brand carousel cover: what fitness brands spend per product photoshoot" },
  { id: "info-power",    niche: "Mindset",          w: 640, h: 800, alt: "Mindset carousel cover: information is power, so build yours" },
  { id: "premium",       niche: "Design",           w: 640, h: 800, alt: "Design carousel cover: make your carousels look premium" },
  { id: "bad-vs-viral",  niche: "Design",           w: 640, h: 853, alt: "Design carousel cover: bad versus viral Instagram carousels" },
  { id: "same-carousel", niche: "Marketing",        w: 640, h: 793, alt: "Marketing carousel cover: most brands post the same carousel" },
  { id: "teach",         niche: "Education",        w: 640, h: 800, alt: "Education carousel cover: carousels are the best way to teach" },
  { id: "fonts",         niche: "Design",           w: 640, h: 800, alt: "Design carousel cover: eight fonts for eight different feelings" },
  { id: "not-ugly",      niche: "Self-improvement", w: 640, h: 800, alt: "Self-improvement carousel cover: habits that quietly affect your looks" },
  { id: "running-3",     w: 640, h: 800, alt: "Interior slide from a running carousel" },
  { id: "lazy-4",        w: 640, h: 853, alt: "Interior slide from an athletics carousel" },
  { id: "photoshoot-6",  w: 640, h: 852, alt: "Interior slide from a brand carousel" },
  { id: "golden-2",      w: 640, h: 800, alt: "Interior slide from a longevity carousel" },
  { id: "finance-2",     w: 640, h: 800, alt: "Interior slide from a finance carousel" },
  { id: "muscle-4",      w: 640, h: 800, alt: "Interior slide from a calisthenics carousel" },
];

export const byId = (id: string): Shot =>
  SHOTS.find((s) => s.id === id) ?? SHOTS[0];

export const src = (s: Shot) => `/carousels/${s.id}.jpg`;

/** Sets the hero reel cycles through — one column per set. */
export const REEL_SETS: string[][] = [
  ["running", "running-3", "lazy-habits"],
  ["finance-rules", "finance-2", "info-power"],
  ["hit-muscle", "muscle-4", "golden-six"],
  ["not-ugly", "premium", "fonts"],
  ["photoshoot", "same-carousel", "ufc"],
];

export const CAMPAIGNS = [
  { cover: "finance-rules", dot: "info-power", name: "Finance & investing", rate: "$1,100" },
  { cover: "running",       dot: "hit-muscle", name: "Fitness & running",   rate: "$950" },
  { cover: "premium",       dot: "fonts",      name: "Creator & design",    rate: "$1,400" },
];
