/**
 * Targeted measurements for the Phase 0 audit.
 *
 *  1. The Quran right pane — how much of it is empty, in px and as a share.
 *  2. Dashboard hero — what share of the first viewport it occupies.
 *  3. Theme differentiation — the resolved value of every seed token in all
 *     ten themes, so "ten themes or one theme in ten hues" is answered with
 *     numbers rather than an impression.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, resolve } from 'node:path';
import { fixtures } from './fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const dist = join(repo, 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

const server = createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  const file = join(dist, url === '/' ? 'index.html' : url);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(await readFile(join(dist, 'index.html')));
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const THEMES = ['noor', 'emerald', 'pearl', 'mushaf', 'blue', 'red', 'onyx', 'mushaf-gold', 'maktabah', 'samaa'];
const SEEDS = [
  '--bg-main-rgb', '--bg-sidebar-rgb', '--bg-panel-rgb', '--bg-card-rgb', '--bg-card-hover-rgb',
  '--border-subtle-rgb', '--accent-gold-rgb', '--accent-teal-rgb', '--accent-emerald-rgb',
  '--text-main-rgb', '--text-soft-rgb', '--text-muted-rgb', '--text-faint-rgb',
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const out = { quranVoid: {}, dashboardHero: {}, themes: {} };

async function open(theme, w = 1920, h = 1080) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  await ctx.addInitScript({ content: `window.__HARNESS_FIXTURES__ = ${JSON.stringify(fixtures)};` });
  await ctx.addInitScript({ content: `window.__HARNESS_SETTINGS__ = ${JSON.stringify({ theme, language: 'en' })};` });
  await ctx.addInitScript({ path: join(here, 'stub-tauri.js') });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('nav a');
  return { ctx, page };
}

// ── 1. Quran right pane ────────────────────────────────────────────────────
{
  const { ctx, page } = await open('noor');
  await page.click('nav a[href="/quran"]');
  await page.waitForTimeout(900);
  out.quranVoid = await page.evaluate(() => {
    // Anchor on the placeholder copy the empty reading pane renders, then walk
    // up to the pane that actually owns the column. Geometry heuristics get
    // fooled by the full-width licence note in the footer.
    const label = [...document.querySelectorAll('*')].find(
      (el) => !el.children.length && /select a surah/i.test(el.textContent || ''),
    );
    if (!label) return { error: 'placeholder not found' };

    let pane = label;
    while (pane.parentElement && pane.getBoundingClientRect().width < 500) pane = pane.parentElement;
    const pr = pane.getBoundingClientRect();

    const ink = [...pane.querySelectorAll('*')]
      .filter((el) => !el.children.length)
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 3 && r.height > 3);
    const inkArea = ink.reduce((a, r) => a + r.width * r.height, 0);

    const list = document.querySelector('input[type="search"], input[placeholder*="urah" i]');
    const listPane = list ? list.closest('div[class]')?.parentElement?.getBoundingClientRect() : null;

    return {
      paneWidth: Math.round(pr.width),
      paneHeight: Math.round(pr.height),
      paneArea: Math.round(pr.width * pr.height),
      inkArea: Math.round(inkArea),
      inkElements: ink.length,
      emptyShare: +(1 - inkArea / (pr.width * pr.height)).toFixed(4),
      surahListWidth: listPane ? Math.round(listPane.width) : null,
    };
  });
  await ctx.close();
}

// ── 2. Dashboard hero share of first viewport ──────────────────────────────
for (const [w, h] of [[1280, 800], [1920, 1080]]) {
  const { ctx, page } = await open('noor', w, h);
  await page.waitForTimeout(900);
  out.dashboardHero[`${w}x${h}`] = await page.evaluate(() => {
    const main = document.querySelector('main');
    const mr = main.getBoundingClientRect();
    const hero = document.querySelector('.hero');
    const hr = hero?.getBoundingClientRect();
    // Where does the first genuinely useful item start?
    const heading = [...main.querySelectorAll('h2, h3')]
      .map((el) => ({ t: el.textContent.trim(), y: Math.round(el.getBoundingClientRect().top) }))
      .filter((x) => x.y > (hr?.bottom ?? 0));
    return {
      frameHeight: Math.round(mr.height),
      heroHeight: hr ? Math.round(hr.height) : null,
      heroShareOfFrame: hr ? +(hr.height / mr.height).toFixed(3) : null,
      firstContentHeadingBelowHero: heading[0] ?? null,
      contentBelowFold: heading[0] ? heading[0].y > mr.bottom : null,
    };
  });
  await ctx.close();
}

// ── 3. Theme token differentiation ─────────────────────────────────────────
for (const theme of THEMES) {
  const { ctx, page } = await open(theme, 1280, 800);
  await page.waitForTimeout(300);
  out.themes[theme] = await page.evaluate((seeds) => {
    const cs = getComputedStyle(document.documentElement);
    const vals = {};
    for (const s of seeds) vals[s] = cs.getPropertyValue(s).trim();
    return vals;
  }, SEEDS);
  await ctx.close();
}

await mkdir(join(repo, 'design-audit'), { recursive: true });
await writeFile(join(repo, 'design-audit/probe.json'), JSON.stringify(out, null, 2));

console.log('QURAN RIGHT PANE');
console.log(' ', JSON.stringify(out.quranVoid));
console.log('\nDASHBOARD HERO');
for (const [k, v] of Object.entries(out.dashboardHero)) console.log(' ', k, JSON.stringify(v));
console.log('\nTHEME SEEDS');
for (const [t, v] of Object.entries(out.themes)) {
  console.log(`  ${t.padEnd(12)} bg=${v['--bg-main-rgb'].padEnd(11)} card=${v['--bg-card-rgb'].padEnd(11)} accent=${v['--accent-gold-rgb'].padEnd(13)} text=${v['--text-main-rgb']}`);
}

await browser.close();
server.close();
