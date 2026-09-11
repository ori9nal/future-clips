// Measure the real per-carousel COGS. The $0.012 ceiling is a build
// requirement, so it gets measured rather than estimated: CPU-seconds are taken
// from process.cpuUsage() around each render, and bytes from the encoded output.
//
//   node tools/cost.mjs [--n 10] [--webp]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { renderCarousel, loadTemplates } from '../../engine/_attic/index.mjs';
import { cacheStats } from '../../engine/_attic/source/cache.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const N = Number(arg('--n', 10));
const OUT = 'output/cost';

// ---- price book. Every figure is a stated assumption, not a measurement. ----
export const PRICES = {
  // Long-running render worker, NOT serverless: the font cache and libvips need
  // warm processes (brief). Reference: a 4 dedicated-vCPU / 16GB cloud instance
  // at ~$26.50/mo. Charged by wall-clock whether busy or not, so the honest
  // per-second rate divides by realistic utilisation, not by 100%.
  workerMonthlyUsd: 26.50,
  workerVcpu: 4,
  utilisation: 0.60,        // a queue-backed worker at steady state
  // Object storage + egress for the delivered zip.
  storageUsdPerGbMonth: 0.021,
  egressUsdPerGb: 0.09,
  draftRetentionMonths: 0.25, // aggressive lifecycle expiry on drafts (brief)
};

// ---- sourcing, measured separately because it is CACHED, not per-carousel ----
// These are the numbers this machine actually produced (engine/source):
export const SOURCING = {
  matteCpuSec: 5.2,        // measured cold, @imgly ONNX, isolated worker
  matteCachedSec: 0.001,   // measured warm
  frameExtractCpuSec: 0.95,// measured: 13s clip -> 10 scene-cut candidates
  probeCpuSec: 0.05,       // measured per candidate at 256px
  stockBytesPerImage: 1.1e6,
  // A campaign's subject library is built once and reused. This is the whole
  // reason the ceiling holds: matting is 5.2s, but it is paid once per SUBJECT,
  // not once per carousel.
  subjectsPerCampaign: 60,
  carouselsServedPerCampaign: 1500,
  subjectsUsedPerCarousel: 6,
};

const secondsPerMonth = 30 * 24 * 3600;
export const usdPerCpuSecond =
  PRICES.workerMonthlyUsd / (secondsPerMonth * PRICES.workerVcpu * PRICES.utilisation);

const templates = loadTemplates();
fs.rmSync(OUT, { recursive: true, force: true });

const rows = [];
let warm = false;
for (let i = 0; i < N; i++) {
  const c0 = process.cpuUsage(), t0 = Date.now();
  const c = await renderCarousel({
    accountId: 'drift', campaignId: 'cost-run', postIndex: i, outDir: OUT, templates,
  });
  const cu = process.cpuUsage(c0), wall = Date.now() - t0;
  const cpuSec = (cu.user + cu.system) / 1e6;

  let pngBytes = 0, webpBytes = 0;
  for (const f of c.files) {
    pngBytes += fs.statSync(f).size;
    webpBytes += (await sharp(f).webp({ quality: 82, effort: 4 }).toBuffer()).length;
  }
  rows.push({
    id: c.id, family: c.familyName, slides: c.slides.length,
    cpuSec: +cpuSec.toFixed(3), wallSec: +(wall / 1000).toFixed(3),
    cpuPerSlide: +(cpuSec / c.slides.length).toFixed(3),
    pngBytes, webpBytes,
    // the first carousel pays the one-time font parse + libvips warm-up
    cold: !warm,
  });
  warm = true;
}

const warmRows = rows.filter((r) => !r.cold);
const sum = (a, k) => a.reduce((s, r) => s + r[k], 0);
const mean = (a, k) => sum(a, k) / a.length;

const cpuMean = mean(warmRows, 'cpuSec');
const slidesMean = mean(warmRows, 'slides');
const webpMean = mean(warmRows, 'webpBytes');
const pngMean = mean(warmRows, 'pngBytes');

const computeUsd = cpuMean * usdPerCpuSecond;
const storeGb = webpMean / 1e9;
const storageUsd = storeGb * PRICES.storageUsdPerGbMonth * PRICES.draftRetentionMonths;
const egressUsd = storeGb * PRICES.egressUsdPerGb;
const total = computeUsd + storageUsd + egressUsd;

// normalise to the brief's unit: an 8-slide carousel
const per8 = (total / slidesMean) * 8;

// ---- amortised sourcing cost -------------------------------------------------
// Build cost for one campaign's subject library, spread over the carousels it
// serves. Downloading and probing happen once per candidate; matting once per
// accepted subject; frame extraction once per source video.
const S = SOURCING;
const buildCpuSec =
  S.frameExtractCpuSec +
  S.subjectsPerCampaign * (S.probeCpuSec * 3) +   // ~3 candidates probed per keeper
  S.subjectsPerCampaign * S.matteCpuSec;
const buildEgressGb = (S.subjectsPerCampaign * 3 * S.stockBytesPerImage) / 1e9;
const buildUsd = buildCpuSec * usdPerCpuSecond + buildEgressGb * PRICES.egressUsdPerGb;
const sourcingPerCarousel =
  buildUsd / S.carouselsServedPerCampaign +
  // every carousel still pays cache READS for the subjects it composites
  S.subjectsUsedPerCarousel * S.matteCachedSec * usdPerCpuSecond;

const totalWithSourcing = total + sourcingPerCarousel;
const per8WithSourcing = (totalWithSourcing / slidesMean) * 8;

const report = {
  ranAt: new Date().toISOString(),
  n: N, warmSamples: warmRows.length,
  usdPerCpuSecond: +usdPerCpuSecond.toExponential(4),
  coldCpuSec: rows[0].cpuSec,
  warmCpuSecMean: +cpuMean.toFixed(3),
  cpuSecPerSlide: +(cpuMean / slidesMean).toFixed(3),
  slidesMean: +slidesMean.toFixed(2),
  pngBytesMean: Math.round(pngMean),
  webpBytesMean: Math.round(webpMean),
  webpSavingPct: +(100 * (1 - webpMean / pngMean)).toFixed(1),
  computeUsd: +computeUsd.toFixed(6),
  storageUsd: +storageUsd.toFixed(6),
  egressUsd: +egressUsd.toFixed(6),
  totalUsdPerCarousel: +total.toFixed(6),
  totalUsdPer8Slide: +per8.toFixed(6),

  sourcing: {
    note: 'cached; paid once per SUBJECT and once per campaign, not per carousel',
    libraryBuildCpuSec: +buildCpuSec.toFixed(1),
    libraryBuildUsd: +buildUsd.toFixed(4),
    servedCarousels: S.carouselsServedPerCampaign,
    perCarouselUsd: +sourcingPerCarousel.toFixed(8),
    ...S,
  },
  totalUsdPer8SlideWithSourcing: +per8WithSourcing.toFixed(6),

  ceilingUsd: 0.012,
  headroomPct: +(100 * (1 - per8WithSourcing / 0.012)).toFixed(1),
  pass: per8WithSourcing <= 0.012,
  cache: cacheStats(),
  prices: PRICES,
  rows,
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'COST.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  warmCpuSecMean: report.warmCpuSecMean, cpuSecPerSlide: report.cpuSecPerSlide,
  coldCpuSec: report.coldCpuSec, usdPerCpuSecond: report.usdPerCpuSecond,
  pngBytesMean: report.pngBytesMean, webpBytesMean: report.webpBytesMean,
  webpSavingPct: report.webpSavingPct,
  computeUsd: report.computeUsd, storageUsd: report.storageUsd, egressUsd: report.egressUsd,
  sourcingPerCarouselUsd: report.sourcing.perCarouselUsd,
}, null, 2));
console.log(`  render only          $${per8.toFixed(6)} / 8-slide carousel`);
console.log(`  + amortised sourcing $${per8WithSourcing.toFixed(6)} / 8-slide carousel`);
console.log(`==> ceiling $0.012 - ${report.pass ? 'PASS' : 'FAIL'}, headroom ${report.headroomPct}%`);
console.log(`    subject library: ${buildCpuSec.toFixed(0)} CPU-s = $${buildUsd.toFixed(4)} once, amortised over ${S.carouselsServedPerCampaign} carousels`);
