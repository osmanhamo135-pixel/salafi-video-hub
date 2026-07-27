/**
 * Regression guards. Assertions about things that have actually broken, so
 * they cannot break again silently.
 *
 *   node scripts/harness/guards.mjs
 *
 * Exits non-zero on failure. Each guard names the incident that produced it.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, resolve } from 'node:path';
import { fixtures } from './fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const dist = join(repo, 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.png': 'image/png' };

if (!existsSync(dist)) {
  console.error('dist/ missing — run `npm run build` first.');
  process.exit(1);
}

const failures = [];

/* ── Guard 0 — runs before a browser is even launched ───────────────────────
   The CSP is `img-src 'self' asset: ... ytimg.com` with no `data:` source, and
   background-image and mask-image are both img-src-governed. Vite's default
   4096-byte assetsInlineLimit inlined four ornament SVGs — including both
   jadwal bands and the corner khatam — as data: URIs, so the app's signature
   frame was a blocked request in every packaged build.

   Nothing else catches this: `tauri dev` serves real URLs and never inlines,
   and dist/index.html has no CSP meta because Tauri injects the policy at
   serve time, so the Playwright sweep below renders with no policy in force.
   This is a build-artefact assertion, not a rendering one, deliberately. */
{
  const { readdirSync } = await import('node:fs');
  const assets = join(dist, 'assets');
  const cssFiles = readdirSync(assets).filter((f) => f.endsWith('.css'));
  for (const f of cssFiles) {
    const css = await readFile(join(assets, f), 'utf8');
    const hits = css.match(/data:image/g) || [];
    if (hits.length) {
      failures.push(
        `csp-no-data-uri[${f}]: ${hits.length} data:image URI(s) in built CSS — ` +
          `img-src has no data: source, so these are blocked at runtime. ` +
          `Check build.assetsInlineLimit in vite.config.ts.`,
      );
    }
  }
}

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
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

const THEMES = ['noor', 'emerald', 'pearl', 'mushaf', 'blue', 'red', 'onyx', 'mushaf-gold', 'maktabah', 'samaa'];

async function open(theme, language = 'en') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' });
  await ctx.addInitScript({ content: `window.__HARNESS_FIXTURES__ = ${JSON.stringify(fixtures)};` });
  await ctx.addInitScript({ content: `window.__HARNESS_SETTINGS__ = ${JSON.stringify({ theme, language })};` });
  await ctx.addInitScript({ path: join(here, 'stub-tauri.js') });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('nav a', { timeout: 15_000 });
  await page.waitForTimeout(400);
  // A fixture reminder comes due whenever the harness's real wall-clock
  // crosses one of the fixture times (e.g. 17:15), and the alarm modal then
  // intercepts every click below — guard 3 flaked exactly this way at 17:19.
  // The alarm is correct app behaviour, just not what these guards assert
  // on; dismiss until quiet. The first button in the dialog is its X.
  for (let i = 0; i < 5; i += 1) {
    const quiet = await page.evaluate(() => {
      const overlay = document.querySelector('div.fixed.inset-0.z-50');
      if (!overlay) return true;
      const btn = overlay.querySelector('button');
      if (btn) btn.click();
      return false;
    });
    if (quiet) break;
    await page.waitForTimeout(250);
  }
  return { ctx, page };
}

const check = (name, ok, detail) => {
  if (!ok) failures.push(`${name}: ${detail}`);
  return ok;
};

/* ── Guard 1 ────────────────────────────────────────────────────────────────
   v1.22.0 shipped AmbientLayer as position:fixed inset:0 z-index:0. That put
   it in the positioned paint layer, above the non-positioned title bar, and
   its wash is opaque — so minimise/maximise/close were painted over and the
   window could not be closed. Every theme, because the wash is theme-coloured
   and one theme passing proves nothing about the others. */
for (const theme of THEMES) {
  const { ctx, page } = await open(theme);
  const r = await page.evaluate(() =>
    ['Minimize', 'Maximize', 'Close'].map((label) => {
      const el = document.querySelector(`[aria-label="${label}"]`);
      if (!el) return { label, found: false, clickable: false };
      const b = el.getBoundingClientRect();
      const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return { label, found: true, clickable: el === hit || el.contains(hit) };
    }),
  );
  const bad = r.filter((x) => !x.found || !x.clickable);
  check(`window-controls[${theme}]`, bad.length === 0, JSON.stringify(bad));
  await ctx.close();
}

/* ── Guard 2 ────────────────────────────────────────────────────────────────
   Qur'anic text is never clipped. No ancestor of .hero-basmala may crop its
   border box — the hero band was shrunk twice and .hero carried overflow:hidden
   through both changes. Checked as geometry, not as a computed-style equality,
   because .page-container legitimately scrolls. */
{
  const { ctx, page } = await open('noor');
  const r = await page.evaluate(() => {
    const el = document.querySelector('.hero-basmala');
    if (!el) return { ok: false, why: '.hero-basmala not found' };
    const b = el.getBoundingClientRect();
    if (b.width < 10 || b.height < 10) return { ok: false, why: `degenerate box ${b.width}x${b.height}` };
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflow === 'visible' && !s.clipPath.includes('inset')) continue;
      const pb = p.getBoundingClientRect();
      if (b.left < pb.left - 1 || b.right > pb.right + 1 || b.top < pb.top - 1 || b.bottom > pb.bottom + 1) {
        return { ok: false, why: `cropped by ${p.className || p.tagName}` };
      }
    }
    return { ok: true };
  });
  check('basmala-never-clipped', r.ok, r.why || '');
  await ctx.close();
}

/* ── Guard 3 ────────────────────────────────────────────────────────────────
   No ambient motion behind mushaf text, in any theme, at any tier. The rule is
   asserted in two independent places (a display:none on the route, and an
   opaque plane on the reading frame); this checks the outcome, not either
   mechanism, so replacing one of them cannot quietly drop the guarantee. */
for (const theme of THEMES) {
  const { ctx, page } = await open(theme);
  await page.click('nav a[href="/quran"]');
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const moving = [...document.querySelectorAll('.ambient-sweep, .ambient-canvas')]
      .filter((el) => getComputedStyle(el).display !== 'none');
    // CSS keyframes count as motion too — the scene plates and the girih
    // lattice animate at tier >= 2 and must be clamped still on /quran.
    const layer = document.querySelector('.ambient-layer');
    const running = layer
      ? document.getAnimations().filter((a) => {
          const el = a.effect && 'target' in a.effect ? a.effect.target : null;
          return el instanceof Element && layer.contains(el) && a.playState === 'running';
        }).length
      : 0;
    const frame = document.querySelector('.quran-reading-frame');
    const bg = frame ? getComputedStyle(frame).backgroundColor : null;
    const alpha = bg && bg.startsWith('rgba') ? parseFloat(bg.split(',')[3]) : 1;
    return { movingCount: moving.length + running, frameFound: !!frame, frameOpaque: !!bg && alpha >= 0.999 };
  });
  check(`quran-no-ambient-motion[${theme}]`, r.movingCount === 0, `${r.movingCount} animated layer(s) live on /quran`);
  if (r.frameFound) {
    check(`quran-frame-opaque[${theme}]`, r.frameOpaque, 'reading frame is not a sealed plane');
  }
  await ctx.close();
}

await browser.close();
server.close();

if (failures.length) {
  console.error(`\n${failures.length} guard failure(s):`);
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`All guards passed (${THEMES.length} themes).`);
