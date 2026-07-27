/**
 * Screenshot every route in a real browser against the stubbed Tauri host.
 *
 * Usage:
 *   node scripts/harness/shoot.mjs --out design-audit/before
 *   node scripts/harness/shoot.mjs --out design-audit/x --themes noor,pearl --langs en,ar
 *
 * The app mounts under MemoryRouter, so routes are reached by clicking the
 * sidebar rather than by URL. Full-page shots are taken as well as viewport
 * shots: the dead-band question the brief asks ("how much of this route is
 * empty at 1080p") can only be answered by comparing the two.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, resolve } from 'node:path';
import { fixtures } from './fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const dist = join(repo, 'dist');

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

const outDir = resolve(repo, arg('out', 'design-audit/before'));
const themes = arg('themes', 'noor').split(',').filter(Boolean);
const langs = arg('langs', 'en').split(',').filter(Boolean);
const viewports = [
  { w: 1280, h: 800 },
  { w: 1920, h: 1080 },
];

const ROUTES = [
  { path: '/', name: 'dashboard' },
  { path: '/quran', name: 'quran' },
  { path: '/library', name: 'library' },
  { path: '/watch', name: 'watch' },
  { path: '/radio', name: 'radio' },
  { path: '/reminders', name: 'reminders' },
  { path: '/downloads', name: 'downloads' },
  { path: '/settings', name: 'settings' },
];

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon',
};

if (!existsSync(dist)) {
  console.error('dist/ is missing — run `npm run build` first.');
  process.exit(1);
}

const server = createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  const file = join(dist, url === '/' ? 'index.html' : url);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    // SPA fallback
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(await readFile(join(dist, 'index.html')));
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const report = [];

for (const theme of themes) {
  for (const lang of langs) {
    for (const vp of viewports) {
      const ctx = await browser.newContext({
        viewport: { width: vp.w, height: vp.h },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce', // screenshots must not race an animation
      });
      await ctx.addInitScript({ content: `window.__HARNESS_FIXTURES__ = ${JSON.stringify(fixtures)};` });
      await ctx.addInitScript({ content: `window.__HARNESS_SETTINGS__ = ${JSON.stringify({ theme, language: lang })};` });
      await ctx.addInitScript({ path: join(here, 'stub-tauri.js') });

      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

      await page.goto(base, { waitUntil: 'networkidle' });
      await page.waitForSelector('nav a', { timeout: 15_000 });

      for (const route of ROUTES) {
        await page.click(`nav a[href="${route.path}"]`);
        await page.waitForTimeout(700); // let stores settle
        await page.evaluate(() => document.fonts.ready);

        const variant = themes.length > 1 || langs.length > 1 ? `${theme}-${lang}-` : '';
        const stem = `${variant}${route.name}-${vp.w}x${vp.h}`;
        const dir = join(outDir, `${vp.w}x${vp.h}`);
        await mkdir(dir, { recursive: true });

        await page.screenshot({ path: join(dir, `${stem}.png`) });
        await page.screenshot({ path: join(dir, `${stem}-full.png`), fullPage: true });

        // Measure what the eye is being asked to judge: how tall the document
        // is versus the viewport, and the largest vertical gap in the page.
        const metrics = await page.evaluate(() => {
          const main = document.querySelector('main');
          // The scroller is whichever descendant actually overflows; `main`
          // itself is a fixed-height flex child and always reports client
          // height, which is why a naive scrollHeight reads identical on
          // every route.
          const scroller = [main, ...(main?.querySelectorAll('*') ?? [])]
            .filter(Boolean)
            .find((el) => el.scrollHeight > el.clientHeight + 4) || main;

          // Leaf text/media nodes only: containers span the gaps we're hunting.
          const leaves = [...(main?.querySelectorAll('*') ?? [])].filter((el) => {
            if (el.children.length > 0) return false;
            const r = el.getBoundingClientRect();
            if (r.width < 4 || r.height < 4) return false;
            const s = getComputedStyle(el);
            return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
          });

          const mainRect = main?.getBoundingClientRect() ?? { top: 0, bottom: 0, height: 0 };
          const rects = leaves.map((el) => el.getBoundingClientRect());
          const contentBottom = rects.length ? Math.max(...rects.map((r) => r.bottom)) : mainRect.top;

          // Largest vertical band containing no leaf content.
          const sorted = [...rects].sort((a, b) => a.top - b.top);
          let gap = 0;
          let gapAt = 0;
          let cursor = mainRect.top;
          for (const r of sorted) {
            if (r.top - cursor > gap) { gap = r.top - cursor; gapAt = Math.round(cursor); }
            cursor = Math.max(cursor, r.bottom);
          }

          return {
            scrollHeight: Math.round(scroller?.scrollHeight ?? 0),
            clientHeight: Math.round(scroller?.clientHeight ?? 0),
            viewportHeight: window.innerHeight,
            // Empty band below the last real content, inside the visible frame.
            trailingDeadSpace: Math.max(0, Math.round(mainRect.bottom - contentBottom)),
            largestGap: Math.round(gap),
            largestGapAtY: gapAt,
          };
        });

        report.push({ theme, lang, route: route.name, viewport: `${vp.w}x${vp.h}`, ...metrics });
        process.stdout.write(
          `  ${stem.padEnd(34)} scroll=${String(metrics.scrollHeight).padStart(5)}/${metrics.clientHeight}` +
          `  gap=${String(metrics.largestGap).padStart(4)}px@y${metrics.largestGapAtY}` +
          `  tail=${metrics.trailingDeadSpace}px\n`,
        );
      }

      if (errors.length) {
        console.warn(`  ! ${theme}/${lang}/${vp.w}: ${errors.length} console error(s)`);
        console.warn('    ' + [...new Set(errors)].slice(0, 5).join('\n    '));
      }
      await ctx.close();
    }
  }
}

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'metrics.json'), JSON.stringify(report, null, 2));
console.log(`\nWrote ${report.length} measurements to ${join(outDir, 'metrics.json')}`);

await browser.close();
server.close();
