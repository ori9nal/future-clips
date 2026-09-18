// Screenshot sequences of the product, for walkthrough videos and design rounds.
//
//   node tools/capture.mjs login                 request a magic link (the PKCE cookie stays in the profile)
//   node tools/capture.mjs callback <url>        finish sign-in with the localhost callback URL
//   node tools/capture.mjs tour <outdir> <light|dark>            every product screen, one theme
//   node tools/capture.mjs clipper <outdir> <brand> "<ask>"      a clipper making a set
//   node tools/capture.mjs agency <outdir>                        the Refer and earn page
//   node tools/capture.mjs admin <outdir>                         onboarding a brief (one Claude call)
//   node tools/capture.mjs site <outdir>                          the marketing site on :3323
//
// Headless system Chromium via playwright-core; the profile lives in
// output/_capture/profile (gitignored under output/).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const [cmd, ...rest] = process.argv.slice(2);
const APP = process.env.CAPTURE_APP ?? 'http://localhost:3000';
const SITE = process.env.CAPTURE_SITE ?? 'http://127.0.0.1:3323';
const PROFILE = path.resolve('output/_capture/profile');
const HIDE = 'nextjs-portal{display:none!important} .toast{transition:none!important}';

const ctx = await chromium.launchPersistentContext(PROFILE, {
  executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium', headless: true,
  viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
});
const page = ctx.pages()[0] ?? await ctx.newPage();
let n = 0, outdir = '';
const shot = async (name, ms = 350) => { await page.waitForTimeout(ms); await page.addStyleTag({ content: HIDE }).catch(() => {}); const f = path.join(outdir, `${String(++n).padStart(2, '0')}-${name}.png`); await page.screenshot({ path: f }); console.log('  ', path.basename(f)); };
const go = async (url, wait = 'networkidle') => { await page.goto(url, { waitUntil: wait, timeout: 90000 }); await page.waitForTimeout(600); };
const nav = async (label) => { await page.locator('.side .nav button, .side .nav a', { hasText: label }).first().click(); await page.waitForTimeout(500); };
const out = (d) => { outdir = path.resolve(d); fs.mkdirSync(outdir, { recursive: true }); };
const type = async (sel, text, delay = 4) => { const l = page.locator(sel); await l.click(); await l.pressSequentially(text, { delay }); };

try {
  if (cmd === 'login') {
    await go(`${APP}/login`); await page.waitForTimeout(2000);
    await type('input[type=email]', process.env.CAPTURE_EMAIL ?? 'earnfromwhop07@gmail.com', 20);
    await page.waitForSelector('button[type=submit]:not([disabled])', { timeout: 10000 });
    await page.click('button[type=submit]');
    await page.waitForSelector('text=Check your inbox', { timeout: 20000 });
    console.log('link requested');
  } else if (cmd === 'callback') {
    await go(rest[0]); await page.waitForSelector('.app, .fc-login', { timeout: 60000 });
    console.log('signed in:', page.url());
  } else if (cmd === 'tour') {
    const [dir, theme] = rest; out(dir);
    await page.addInitScript((t) => { try { localStorage.setItem('fc.theme', t); } catch {} }, theme);
    await go(`${APP}/app`); await page.waitForSelector('.app .composer'); await shot('create-empty', 900);
    await page.click('.campaignBtn'); await shot('create-picker');
    await page.locator('.pop.list .mi', { hasText: 'FUEL' }).first().click();
    await type('#ask', '5 high protein meals I prep every sunday, ranked by how fast they are'); await shot('create-ready');
    const prio = page.locator('.seg button', { hasText: 'Priority' }); if (await prio.isEnabled()) await prio.click();
    const hd = page.locator('.control .sw'); if (await hd.isEnabled()) await hd.click(); await shot('create-priority-hd');
    await nav('Library'); await page.waitForSelector('.tile img'); await page.waitForTimeout(800); await shot('library');
    await page.locator('.tile:not(.gen)').first().click(); await page.waitForTimeout(500); await shot('drawer');
    await page.locator('.drawer .btn', { hasText: 'Close' }).click();
    await nav('Campaigns'); await shot('campaigns');
    await nav('Insights'); await shot('insights');
    const refer = page.locator('.side .nav button', { hasText: 'Refer' }); if (await refer.count()) { await refer.click(); await page.waitForTimeout(400); await shot('refer'); }
    await nav('Settings'); await shot('settings-account');
    await page.locator('.tabs button', { hasText: 'Plan' }).click(); await shot('settings-plan');
    await page.locator('.tabs button', { hasText: 'Defaults' }).click(); await shot('settings-defaults');
    await go(`${APP}/admin`); await shot('admin');
    await go(`${APP}/admin/invites`); await shot('admin-invites');
    await go(`${APP}/admin/partners`); await shot('admin-partners');
    await go(`${APP}/login`); await shot('login');
    await page.setViewportSize({ width: 390, height: 844 }); await go(`${APP}/app`); await page.waitForSelector('.app .composer'); await shot('mobile-create');
    await page.click('.burger'); await page.waitForTimeout(400); await shot('mobile-menu');
    await page.setViewportSize({ width: 1440, height: 900 });
  } else if (cmd === 'preview') {
    // the design preview (no session): node tools/capture.mjs preview <outdir> <light|dark> [plan]
    const [dir, theme, plan = 'grind'] = rest; out(dir);
    await page.addInitScript((t) => { try { localStorage.setItem('fc.theme', t); } catch {} }, theme);
    const P = `${APP}/design-preview?view=clipper&plan=${plan}`;
    await go(P); await page.waitForSelector('.app .composer'); await shot('create-empty', 900);
    await page.click('.campaignBtn'); await shot('create-picker');
    await page.locator('.pop.list .mi', { hasText: 'FUEL' }).first().click(); await page.waitForTimeout(300); await shot('create-campaign-angles');
    await page.locator('.angles button').first().click(); await shot('create-ready');
    const prio = page.locator('.seg button', { hasText: 'Priority' }); if (await prio.isEnabled()) await prio.click();
    const hd = page.locator('.control .sw'); if (await hd.isEnabled()) await hd.click(); await shot('create-priority-hd');
    await nav('Library'); await page.waitForSelector('.tile img'); await page.waitForTimeout(800); await shot('library');
    await page.locator('.tile:not(.gen)').first().click(); await page.waitForTimeout(500); await shot('drawer');
    await page.locator('.drawer .btn', { hasText: 'Close' }).click();
    await nav('Campaigns'); await shot('campaigns');
    await nav('Insights'); await shot('insights');
    await nav('Refer'); await page.waitForTimeout(400); await shot('refer');
    await nav('Settings'); await shot('settings-account');
    await page.locator('.tabs button', { hasText: 'Plan' }).click(); await shot('settings-plan');
    await page.locator('.tabs button', { hasText: 'Defaults' }).click(); await shot('settings-defaults');
    await go(`${APP}/design-preview?view=partner`); await page.waitForSelector('.app .linkbox'); await shot('partner-overview', 800);
    await nav('Referrals'); await shot('partner-referrals');
    await nav('Payouts'); await shot('partner-payouts');
    await go(`${APP}/login`); await shot('login');
    await page.setViewportSize({ width: 390, height: 844 }); await go(P); await page.waitForSelector('.app .composer'); await shot('mobile-create');
    await page.click('.burger'); await page.waitForTimeout(400); await shot('mobile-menu');
    await page.locator('.side .nav button', { hasText: 'Library' }).click(); await page.waitForTimeout(600); await shot('mobile-library');
    await page.setViewportSize({ width: 1440, height: 900 });
  } else if (cmd === 'clipper') {
    const [dir, brand, ask] = rest; out(dir);
    await go(`${APP}/app`); await page.waitForSelector('.app .composer'); await shot('dashboard', 900);
    await page.click('.campaignBtn'); await shot('pick-a-campaign');
    await page.locator('.pop.list .mi', { hasText: brand }).first().click(); await shot('campaign-picked');
    await type('#ask', ask, 8); await shot('typed-the-ask');
    const prio = page.locator('.seg button', { hasText: 'Priority' }); if (await prio.isEnabled()) { await prio.click(); await shot('priority'); }
    const hd = page.locator('.control .sw'); if (await hd.isEnabled()) { await hd.click(); await shot('hd-on'); }
    await page.locator('.composer .btn.primary').click(); await page.waitForTimeout(2500); await shot('generating', 200);
    await page.waitForTimeout(1500);
    const cancel = page.locator('.set .actions button', { hasText: 'Cancel' }).first(); if (await cancel.count()) { await cancel.click(); await page.waitForTimeout(1500); }
    await nav('Library'); await page.waitForSelector('.tile img'); await page.waitForTimeout(1000);
    await page.evaluate(() => { const v = document.querySelector('.view'); const r = [...document.querySelectorAll('.set')].find((x) => x.querySelector('.tile img')); if (v && r) v.scrollTop = r.offsetTop - 24; }); await shot('library');
    await page.locator('.tile:not(.gen)').first().click(); await page.waitForTimeout(600); await shot('slide-drawer');
    await page.locator('.drawer .btn', { hasText: 'Next' }).click(); await page.waitForTimeout(500); await shot('slide-drawer-next');
    await page.locator('.drawer .btn', { hasText: 'Close' }).click();
    await nav('Insights'); await shot('insights');
    await nav('Settings'); await page.locator('.tabs button', { hasText: 'Plan' }).click(); await shot('plan');
  } else if (cmd === 'agency') {
    out(rest[0]);
    await go(`${APP}/app`); await page.waitForSelector('.app .composer'); await shot('dashboard', 900);
    await nav('Refer'); await page.waitForTimeout(600); await shot('refer-and-earn');
    await page.locator('.linkbox .btn').click(); await shot('link-copied', 500);
    await page.evaluate(() => { const v = document.querySelector('.view'); const h = [...document.querySelectorAll('h2')].find((x) => /Referred accounts/.test(x.textContent)); if (v && h) v.scrollTop = h.closest('section').offsetTop - 24; }); await shot('referred-accounts');
    await page.evaluate(() => { const v = document.querySelector('.view'); const h = [...document.querySelectorAll('h2')].find((x) => /Commissions/.test(x.textContent)); if (v && h) v.scrollTop = h.closest('section').offsetTop - 24; }); await shot('commissions');
  } else if (cmd === 'admin') {
    out(rest[0]);
    await go(`${APP}/admin`); await shot('admin-home', 900);
    await go(`${APP}/admin/campaigns`); await page.waitForSelector('textarea'); await page.waitForTimeout(1500); await shot('briefs-empty');
    const brief = `GLOW Skin — creator campaign brief\nBrand: GLOW. Product: barrier repair moisturiser. Niche: skincare.\nPays $1.10 per 1k views. Budget $4,000. Min payout $10, max $350 per post. Review window 7 days.\nRules: every post must mention @glow.skin. Never say "cures acne", "dermatologist approved" or "clinically proven". 5 to 8 slides. Product shot on the last slide only.\nTips: "things I wish I knew about my skin barrier" angles perform; keep it lowercase and personal; ranked lists do well.`;
    await type('textarea', brief, 2); await shot('brief-pasted');
    await page.locator('button', { hasText: 'Extract rules' }).click();
    await page.waitForSelector('text=HARD RULES', { timeout: 120000 }); await page.waitForTimeout(800); await shot('rules-extracted');
    await page.mouse.wheel(0, 500); await shot('rules-detail');
    await page.locator('button', { hasText: 'Save as campaign' }).click(); await page.waitForTimeout(4000); await shot('saved');
    await go(`${APP}/admin`); await page.waitForSelector('table tbody tr', { timeout: 60000 }); await page.evaluate(() => { const r = [...document.querySelectorAll('table tbody tr')].find((x) => /GLOW/.test(x.textContent)); r && r.scrollIntoView({ block: 'center' }); }); await shot('brief-live');
    await go(`${APP}/app`); await page.waitForSelector('.app .composer'); await page.click('.campaignBtn'); await page.waitForTimeout(400); await page.evaluate(() => { const m = [...document.querySelectorAll('.pop.list .mi')].find((x) => /GLOW/.test(x.textContent)); m && m.scrollIntoView({ block: 'center' }); }); await shot('in-the-app');
  } else if (cmd === 'site') {
    out(rest[0]);
    await go(`${SITE}/?v=${Date.now()}`, 'load'); await page.waitForTimeout(1800); await shot('hero', 800);
    for (const [id, name] of [['#why', 'why-carousels'], ['#compare', 'the-difference'], ['#how', 'how-it-works'], ['#features', 'features'], ['#pricing', 'pricing-yearly']]) {
      await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'start' }), id); await page.waitForTimeout(1500); await shot(name);
    }
    await page.click('#lblM'); await shot('pricing-monthly');
    await page.evaluate(() => { document.querySelector('#faq')?.scrollIntoView({ block: 'start' }); document.querySelectorAll('#faq details')[0].open = true; }); await page.waitForTimeout(1200); await shot('faq');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(1200); await shot('footer');
    await page.setViewportSize({ width: 390, height: 844 }); await go(`${SITE}/?v=${Date.now()}`, 'load'); await page.waitForTimeout(1800); await shot('mobile-hero');
    await page.click('#burger'); await shot('mobile-menu');
  } else {
    console.error('unknown command'); process.exitCode = 1;
  }
} finally {
  await ctx.close();
}
