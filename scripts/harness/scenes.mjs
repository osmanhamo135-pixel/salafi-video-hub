/**
 * Scene contact sheet — the only honest way to review a painted background.
 *
 *   node scripts/harness/scenes.mjs [--out DIR] [--sections dashboard,library]
 *
 * Renders the ambient canvas ALONE, at its native 768x448, for every theme and
 * a set of sections, and writes one PNG per cell plus an index.html grid.
 *
 * It reads the canvas rather than screenshotting the page deliberately: a page
 * screenshot shows the scene through the UI, at whatever alpha the chrome
 * leaves, which is exactly how a weak scene passes review. This shows the
 * paint itself.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, resolve } from 'node:path';
import { fixtures } from './fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const dist = join(repo, 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.png': 'image/png' };

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i === -1 ? d : argv[i + 1];
};
const outDir = resolve(repo, arg('out', 'design-audit/scenes'));
const sections = arg('sections', 'dashboard,library,radio,settings').split(',').filter(Boolean);

const THEMES = ['noor', 'emerald', 'pearl', 'mushaf', 'blue', 'red', 'onyx', 'mushaf-gold', 'maktabah', 'samaa'];
const ROUTE = { dashboard: '/', library: '/library', watch: '/watch', radio: '/radio', reminders: '/reminders', downloads: '/downloads', settings: '/settings' };

if (!existsSync(dist)) {
  console.error('dist/ missing — run `npm run build` first.');
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
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(await readFile(join(dist, 'index.html')));
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

await mkdir(outDir, { recursive: true });
const cells = [];
const empties = [];

for (const theme of THEMES) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, reducedMotion: 'no-preference' });
  await ctx.addInitScript({ content: `window.__HARNESS_FIXTURES__ = ${JSON.stringify(fixtures)};` });
  await ctx.addInitScript({ content: `window.__HARNESS_SETTINGS__ = ${JSON.stringify({ theme, language: 'en' })};` });
  // Full motion, so the sheet shows the scene at its intended strength.
  await ctx.addInitScript({ content: `try { localStorage.setItem('salafi-hub.background-motion', 'full'); } catch (e) {}` });
  await ctx.addInitScript({ path: join(here, 'stub-tauri.js') });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('nav a', { timeout: 15_000 });
  for (let i = 0; i < 5; i += 1) {
    const quiet = await page.evaluate(() => {
      const o = document.querySelector('div.fixed.inset-0.z-50');
      if (!o) return true;
      o.querySelector('button')?.click();
      return false;
    });
    if (quiet) break;
    await page.waitForTimeout(250);
  }

  for (const section of sections) {
    const path = ROUTE[section];
    if (!path) continue;
    await page.click(`nav a[href="${path}"]`);
    // Long enough for a drifting scene to have moved somewhere interesting.
    await page.waitForTimeout(2600);
    const data = await page.evaluate(() => {
      const c = document.querySelector('.ambient-canvas');
      if (!c) return null;
      const g = c.getContext('2d');
      const px = g.getImageData(0, 0, c.width, c.height).data;
      let painted = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i] > 6) painted += 1;
      return { url: c.toDataURL('image/png'), painted, total: (px.length / 4) | 0 };
    });
    const name = `${theme}-${section}.png`;
    if (!data) {
      empties.push(`${theme}/${section}: no canvas (tier < 3 for this theme)`);
      continue;
    }
    const coverage = data.painted / data.total;
    if (coverage < 0.02) empties.push(`${theme}/${section}: ${(coverage * 100).toFixed(1)}% painted`);
    await writeFile(join(outDir, name), Buffer.from(data.url.split(',')[1], 'base64'));
    cells.push({ theme, section, name, coverage });
  }
  await ctx.close();
}

await browser.close();
server.close();

const html = `<body style="background:#0b1220;color:#ccd;font:13px system-ui;padding:16px">
<h1 style="font-size:15px">Scene contact sheet — ${cells.length} cells</h1>
<div style="display:grid;grid-template-columns:repeat(${sections.length},1fr);gap:10px">
${cells.map((c) => `<figure style="margin:0"><img src="${c.name}" style="width:100%;display:block;background:#000"/><figcaption>${c.theme} · ${c.section} · ${(c.coverage * 100).toFixed(0)}%</figcaption></figure>`).join('\n')}
</div></body>`;
await writeFile(join(outDir, 'index.html'), html);

console.log(`Wrote ${cells.length} scene cells to ${outDir}`);
if (empties.length) {
  console.log('\nThin or missing:');
  for (const e of empties) console.log('  - ' + e);
}
