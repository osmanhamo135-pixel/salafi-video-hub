# Ambient Generator — Technical Feasibility Spec (Concepts A–J)

## 0. Two measured findings that reshape this spec

Both were measured in this container against `dist/` and the app's real CSP string, not estimated.

### 0.1 `data:` and `blob:` image URLs are BLOCKED by the shipped CSP

`src-tauri/tauri.conf.json` declares `img-src 'self' asset: http://asset.localhost https://asset.localhost https://i.ytimg.com https://*.ytimg.com`. Serving `dist/` with that exact header and loading the app in Chromium:

| probe | result |
|---|---|
| `data:` URI as `<img src>` | **blocked** |
| `data:` URI as CSS `background-image` | **blocked** |
| `data:` URI as CSS `mask-image` | **blocked** |
| `blob:` URI as `<img src>` | **blocked** |
| canvas 2D + `toDataURL()` | works (no fetch, no CSP surface) |
| `getComputedStyle(root).getPropertyValue('--accent-gold-rgb')` | `236 195 102` |

Console: `Refused to load the image 'data:image/svg+xml;...' because it violates the following Content Security Policy directive: "img-src 'self' ..."`.

This has three consequences:

1. **No ambient concept may ship a `data:` URI.** Tier 1 "generated pattern as an inline SVG" is dead on arrival.
2. **Vite currently inlines the jadwal.** `dist/assets/index-*.css` contains `--jadwal-h: url("data:image/svg+xml,...")`, `--jadwal-v`, `--jadwal-c` — all three tiles inlined because they are under Vite's default `assetsInlineLimit` of 4096 bytes (`jadwal-corner.svg` is 315 B, the bands 2027 B). Plus one hand-written `background-image: url("data:image/svg+xml;utf8,...")` — the `.hero-girih` khatam at `src/index.css:1592`. Under the app's CSP all four are blocked, meaning **the jadwal band and khatam corners, and the hero girih, very likely do not render in the packaged Windows build**. Only the two hairline rules on `.quran-reading-frame::before/::after` survive, because those are `border`, not images. See risk R1 — this needs one screenshot from a real Windows build to confirm, and it is a pre-existing bug, not something this work introduces.
3. Any committed ambient SVG must be **forced to emit as a file**, via `build: { assetsInlineLimit: 0 }` in `vite.config.ts` or a `?url` import, and the harness should assert `dist/assets/*.css` contains zero `data:image/` occurrences.

Canvas 2D and CSS gradients have zero CSP surface. That is a strong argument for the zero-asset generative approach across the board.

### 0.2 `--accent-teal-rgb` is the differentiation the ambient layer needs, and it is free

The audit's headline finding is that `--hair-rgb: var(--accent-gold-rgb)` (`src/index.css:436`) and eight of ten themes resolve gold, with `blue` and `red` byte-identical at `226 197 122`. If `--ambient-ink-rgb` defaults to `--accent-gold-rgb`, the ambient layer will faithfully reproduce "one layout in ten hues".

`--accent-teal-rgb` is declared distinctly by **all ten** themes and has **zero effective usage**:

| theme | `--accent-teal-rgb` | | theme | `--accent-teal-rgb` |
|---|---|---|---|---|
| noor | `219 177 83` | | red | `229 84 92` |
| emerald | `34 197 94` | | onyx | `209 170 84` |
| pearl | `15 118 110` | | mushaf-gold | `216 184 122` |
| mushaf | `101 163 13` | | maktabah | `214 143 88` |
| blue | `59 130 246` | | samaa | `79 195 247` |

Its only CSS reference is `src/index.css:736`, inside `html[dir='rtl'] .app-sidebar …` — and `App.tsx:45` pins `root.dir = 'ltr'` unconditionally, so that rule never matches. `--accent-emerald-rgb` is likewise ten distinct values with one usage (`src/index.css:616`).

**Point `--ambient-ink-rgb` at `--accent-teal-rgb`.** Ten visibly different ambient layers, zero new tokens, zero per-theme component code. `blue` at `59 130 246` against `red` at `229 84 92` is the difference the gold seed cannot give.

---

## 1. Token contract (answers "how does the layer read theme colour without per-theme JS")

Five tokens, declared once in `:root`, overridden **only** in the four surface-profile blocks. No theme name ever appears in JS or in a component.

```css
:root {
  --ambient-ink-rgb:    var(--accent-teal-rgb);     /* motes, stars, ink, sweep */
  --ambient-ink2-rgb:   var(--accent-emerald-rgb);  /* secondary tint, depth band 2 */
  --ambient-ground-rgb: var(--bg-main-rgb);
  --ambient-alpha:      0.10;   /* scalar the concepts multiply into */
  --ambient-tier-max:   3;      /* themeDefault cap */
}
html[data-surface='light']      { --ambient-alpha: 0.055; --ambient-tier-max: 1; }
html[data-surface='pure-black'] { --ambient-alpha: 0.075; }
html[data-surface='warm']       { --ambient-alpha: 0.12; }
html[data-surface='cool']       { --ambient-alpha: 0.13; }
```

Reader, ~40 lines in `src/components/ambient/tokens.ts`:

```ts
const root = document.documentElement;
function num3(name: string): [number, number, number] {
  const raw = getComputedStyle(root).getPropertyValue(name).trim();
  const parts = raw.split(/\s+/).map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) return parts as [number,number,number];
  // Fallback: a token defined as var(--other) and never consumed by a real
  // property can come back unresolved in some engines. Resolve through one.
  const probe = document.createElement('span');
  probe.style.cssText = `color: rgb(var(${name}))`;
  root.appendChild(probe);
  const m = /(\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(probe).color)!;
  probe.remove();
  return [ +m[1], +m[2], +m[3] ];
}
```

Measured working under the real CSP: `--accent-gold-rgb → 236 195 102`, `--bg-main-rgb → 3 4 4`.

Theme changes: one `MutationObserver(root, { attributes: true, attributeFilter: ['data-theme','data-surface'] })` → re-snapshot tokens, rebuild the tinted sprites, **do not reset the simulation clock**. ~12 lines. Sprites are tinted at creation, so retinting is a sprite rebuild, not a per-frame cost.

Polarity: Pearl already declares its own `--sheen-rgb`/`--shade-rgb` pair (see the comment at `src/index.css:82-90`). The vignette in concept I uses `--shade-rgb`, so it darkens on light and lightens on dark with zero branches.

---

## 2. Concept-by-concept spec

### A. Gold dust motes drifting through a depth field — Noor Teal, **Tier 3** (confirmed)

**Technique.** Canvas 2D, three depth bands. The softness is *baked into a sprite at init*, never applied per frame.

- At init, build three offscreen sprite canvases (24 / 14 / 8 px) by filling each with `createRadialGradient` from `rgba(ink, 0.9)` at r=0 to `rgba(ink, 0)` at r=R. That gradient's alpha ramp **is** the blur. Cost: three fills, once.
- Particles: `N = clamp(round(area / 26000), 30, 90)` — 78 at 1080p, split 18/26/34 near→far.
- Per frame: `clearRect`, then `drawImage(sprite[band], x|0, y|0)` per particle. `globalCompositeOperation = 'lighter'` for additive glow.
- Motion: upward 2–6 px/s by band; horizontal drift `sin(t * w_i + phase_i)`; opacity twinkle from a second sine floored at 0.25 (never flicker). Wrap at edges.

**Blur alternative:** pre-blurred source (the sprite) + half-resolution backing store, CSS-upscaled. **No `filter: blur()` anywhere.**

**Budget.** Canvas at half resolution: 960×540×4 = **1.98 MB** backing store + ~1.98 MB compositor texture ≈ 4 MB. 78 tiny blits × 30 fps = ~2,340 blits/s of ≤24 px textures — comfortably under 1% CPU.

**Lines:** ~110 in `fields/motes.ts` (+ shared runtime).

**Measured-cost risk.** Low. The one branch needed: `'lighter'` blows out on a light ground. Guard by luma, not by theme name — `if (0.2126*r + 0.7152*g + 0.0722*b > 128) op = 'source-over'`. Pearl is locked Tier 1 so it never executes, but the guard is 2 lines and keeps the rule token-derived.

---

### B. Ink diffusion / slow noise flow over near-black — Mushaf Night, **Tier 3** (confirmed, but only under one construction)

**Reject the obvious reading.** Per-pixel value noise via `ImageData` at 1920×1080 is 2.07 M pixels × 4 B; `putImageData` at 30 fps is 249 MB/s of memcpy *plus* the noise math. That is 15–40% of a core and breaks the 3% budget outright. Do not build it.

**Technique — advected blob field.** 6–10 large soft radial-gradient blob sprites (256 px, built once), each following a slow Lissajous path with mutually irrational frequencies, drawn with `globalCompositeOperation = 'lighter'` at α 0.05–0.10 onto a **quarter-resolution** canvas (480×270). Overlap between the blobs produces the fold structure that reads as ink diffusing. CSS-upscaled 4×, it reads as continuous diffusion because there is no high-frequency detail to lose.

**Grain is required, not optional.** At quarter resolution with additive blending on a near-black ground, the failure mode is *banding*, not CPU. Fix with a static 128×128 seeded-hash noise tile built once at init and drawn via `createPattern(tile, 'repeat')` at α 0.02–0.03 — one `fillRect`, redrawn only on resize. It dithers the bands away.

**Blur alternative:** pre-blurred source (blob sprites) + quarter-res canvas + CSS upscale.

**Budget.** 480×270×4 = **0.49 MB**. 8 sprite blits/frame. Effectively free.

**Lines:** ~95 in `fields/inkflow.ts`, ~25 for the grain tile (shared with concept I).

**Measured-cost risk.** Low on CPU, moderate on *appearance*: the sim clock must be slow enough that the fold never reads as a lava lamp. Cap the fastest Lissajous period at ≥ 45 s.

---

### C. Starfield with slow parallax drift — Sakinah Blue, **demote Tier 3 → Tier 2**

**Manhaj note.** Stars are explicitly permitted. Constrain to unstructured points of light — no constellations, no zodiac figures, nothing that resolves into a form.

**Why it is not Tier 3.** The content is static; only the transform moves. Drawing 220 points per frame to animate a 1 px/8 s drift is pure waste. The correct construction is **static content + moving transform**, and once you have that, JS is unnecessary.

**Technique.** Three committed SVGs from `scripts/build-starfield-svg.py` (fixed seed, deterministic), each a seamless tile of 40 / 70 / 110 discs at r = 0.6 / 1.0 / 1.6, `fill="#000"`. Three absolutely positioned divs, each `background-image: url(...)` + `background-repeat: repeat`, coloured by `background: rgb(var(--ambient-ink-rgb) / …)` under a `mask-image` of the tile — same "opaque black geometry, colour from tokens underneath" contract the jadwal already uses (`src/index.css:868-905`). Each layer animates `transform: translate3d()` on a 200 s / 400 s / 800 s linear infinite loop.

Twinkle, if wanted, is a single layer-wide `opacity` oscillation on a 30 s cycle. Per-star opacity is a paint storm — forbidden.

**Blur alternative:** none needed; stars are points.

**Budget.** Zero JS. Three promoted layers is one too many — merge the two far layers into one tile so it is **two** promoted layers. Assets: ~6–20 KB each.

**Lines:** ~25 CSS + ~70 Python. **Zero runtime JS.**

**Measured-cost risk.** The delivery risk from §0.1: these SVGs are small and Vite will inline them into the CSS as `data:` URIs, where CSP blocks them. `assetsInlineLimit: 0` is mandatory.

---

### D. Single slow light sweep every 40 s over a depth gradient — Yaqut Red, **Tier 2** (confirmed)

**Technique.** One childless div, `inset: 0`, `width: 240%`:

```css
.ambient-sweep {
  background: linear-gradient(105deg,
    transparent 38%,
    rgb(var(--ambient-ink-rgb) / var(--ambient-alpha)) 50%,
    transparent 62%);
  will-change: transform;
  animation: ambient-sweep 40s linear infinite;
}
@keyframes ambient-sweep {
  from { transform: translate3d(-60%, 0, 0); }
  to   { transform: translate3d(20%, 0, 0); }
}
```

**Blur alternative:** the gradient's own 24%-wide stop spread *is* the soft edge. No blur.

**Budget.** One promoted full-viewport layer at DPR 1 = **7.91 MB**. Transform-only animation → zero paint after first raster, ~0% CPU (the compositor does this work for scrolling anyway).

**Lines:** ~14 CSS, 0 JS.

**Measured-cost risk.** `will-change: transform` permanently promotes a full-viewport layer for the app's lifetime. That is the whole reason for the **≤ 2 promoted ambient layers per theme** rule in §4. Second risk: at α 0.03 the sweep is invisible on Onyx and Pearl — that is exactly what `--ambient-alpha` in the surface-profile blocks exists to fix.

---

### E. One slow gold arc sweep on near-black — Onyx, **Tier 2** (confirmed)

**Technique.** A conic gradient masked to a hairline ring, rotated by transform:

```css
.ambient-arc {
  width: min(90vmin, 900px); aspect-ratio: 1;
  background: conic-gradient(from 0turn, transparent 0 72%,
    rgb(var(--ambient-ink-rgb) / calc(var(--ambient-alpha) * 1.4)) 80%,
    transparent 88% 100%);
  mask: radial-gradient(closest-side, transparent 78%, #000 79% 82%, transparent 83%);
  will-change: transform;
  animation: ambient-arc 60s linear infinite;
}
@keyframes ambient-arc { to { transform: rotate(360deg); } }
```

**The trap that must be written down.** Rotating the *element* rotates the layer's already-rastered texture — compositor-only, free. Animating the conic gradient's `from` angle (e.g. via an `@property`-registered custom property) makes Chromium **re-rasterise the full gradient every frame**. Animate `transform`, never the gradient angle.

**Blur alternative:** the mask's 1%-wide feather. No blur.

**Budget.** Sized to 900×900 rather than the viewport: **3.09 MB** instead of 7.91 MB. Deliberate.

**Lines:** ~18 CSS, 0 JS.

**Measured-cost risk.** Low. Onyx's profile forbids shadows, so the arc carries all its own contrast — hence the `× 1.4` on alpha, expressed through the token rather than a per-theme rule.

---

### F. Lamp glow breathing on a 20 s cycle — Maktabah, **Tier 2** (confirmed)

**Technique.**

```css
.ambient-lamp {
  background: radial-gradient(46% 38% at 30% 12%,
    rgb(var(--ambient-ink-rgb) / calc(var(--ambient-alpha) * 2)), transparent 72%);
  will-change: transform, opacity;
  animation: ambient-breathe 20s var(--ease-standard) infinite alternate;
}
@keyframes ambient-breathe {
  from { opacity: 0.74; transform: scale(1.000); }
  to   { opacity: 1.00; transform: scale(1.030); }
}
```

Both `opacity` and `transform` are compositor-animatable. The element must stay **childless** — opacity on a layer with descendants forces a group composite.

**Blur alternative:** the radial-gradient falloff. No blur.

**Budget.** One promoted layer, 7.91 MB. Zero paint after first raster.

**Lines:** ~16 CSS, 0 JS.

**Measured-cost risk.** Low on perf, real on perception: a 20 s alternate breathe is the single most likely thing to be read as "the screen is pulsing" during sustained reading. The Quran Tier 0/1 lock (§5) covers the mushaf; additionally cap peak-to-trough Δopacity at 0.12 under `html[data-surface='light']`.

---

### G. Very slow scale drift 1.00 → 1.04 over 90 s on a blurred ground — Emerald Majlis, **Tier 2** (confirmed, with the ground rebuilt)

This is the concept most exposed to the no-blur rule. Two-part answer.

**(a) The "blurred ground" is a gradient stack, not a blur.** Build it from 3–4 large radial gradients — that *is* the blur, at zero cost, and it is precisely what `.hero-ground` already does at `src/index.css:1433-1454`. Reuse that construction.

**(b) If genuinely photographic softness is later demanded**, the alternative is *blur small and scale up*: a ~40×24 px gradient element with `filter: blur(6px)` and `transform: scale(50)`. Chromium rasterises the blur at the element's own tiny size and the scale is a compositor transform. **But do not combine it with G's animated scale** — the two transforms compose and the raster-scale hint can force a re-raster at the composed scale, which is the exact failure the budget forbids. Recommendation: gradient stack only, no blur at all.

**Motion, with the re-raster trap handled.** Chromium re-rasterises a layer when an animated scale exceeds the scale it was rastered at. Fix by making the element 4% larger via `inset: -2%` and animating 1.00 → 1.04 *inside* that headroom, so the displayed size never exceeds the rastered size, and the edges never reveal.

```css
.ambient-drift {
  inset: -2%;
  background: /* the 4-stop radial stack */;
  will-change: transform;
  animation: ambient-drift 90s var(--ease-standard) infinite alternate;
}
@keyframes ambient-drift {
  from { transform: scale(1.00) translate3d(0, 0, 0); }
  to   { transform: scale(1.04) translate3d(-0.6%, 0.4%, 0); }
}
```

**Budget.** One promoted layer at 104% of viewport ≈ **8.6 MB**.

**Lines:** ~14 CSS, 0 JS.

**Measured-cost risk.** Medium — this is the concept most likely to show up as a re-raster spike in a trace. Verify with DevTools "Paint flashing" + the Rendering panel's layer borders before shipping; if the layer repaints, the `inset: -2%` headroom is wrong.

---

### H. Cloud field drifting slowly — Samaa, **Tier 2** (confirmed, but resize the layers)

**Manhaj.** Clouds are permitted. Plate B is disqualified as supplied (bird silhouette in the cloud field); **nothing may be traced, sampled, or derived from it**. This must be generated from scratch — which the gradient construction is, by definition.

**Technique.** Two layers, each a stack of 5–7 elliptical radial gradients at differing sizes/positions/alphas. Each layer is 200% wide with its gradient set duplicated at +100%, animated `translate3d(0) → translate3d(-50%)` — **the loop is then seamless by construction**, with no crossfade and no visible wrap. Periods 180 s and 300 s; the parallax between them is what makes it read as sky rather than as a moving gradient.

**Blur alternative:** gradient falloff. No blur.

**Budget — this is the one concept that breaks the budget as naively specified.** Two 200%-wide full-height layers: 3840×1080×4 = 15.82 MB each = **31.6 MB**, and that is before any other layer, at DPR 1. Fix: clouds live in the upper ~55% of the frame, so band each layer to 55% height → 3840×594×4 = **8.70 MB** each, **17.4 MB** total. Alternative: one layer at 200% and a second at 140%.

**Lines:** ~30 CSS (the gradient stack is the bulk), 0 JS.

**Measured-cost risk.** **High if unchecked** — this is the only concept that fails the 40 MB budget on its own. The banding risk also applies (large low-alpha gradients on a cool ground); reuse concept B's static grain tile at α 0.02 if it appears.

---

### I. Warm paper grain, static, soft vignette — Pearl Scholar, **Tier 1** (confirmed)

Two sublayers, both static, zero animation, zero rAF.

**Vignette.** A radial gradient in `--shade-rgb`, following the `.hero-ground` precedent (`src/index.css:1433`). Because Pearl declares its own `--shade-rgb` (per the comment at `src/index.css:82-90`), the vignette darkens on light and lightens on dark with **no branch**.

**Grain — and this is where §0.1 bites.** Three routes, ranked:

1. `data:` URI SVG `feTurbulence` — **blocked, measured.** Rejected.
2. Committed `src/assets/marks/grain-128.png`, ~2–4 KB, `background-repeat: repeat`. Viable **only** with `assetsInlineLimit: 0`, or Vite inlines it and CSP blocks it.
3. **Recommended:** canvas, painted exactly once. Build a 128×128 seeded-hash noise tile with `createImageData` (16,384 px of math, one time), then `ctx.fillStyle = ctx.createPattern(tile, 'repeat'); ctx.fillRect(0,0,w,h)` on the ambient canvas. Repaint only on a 200 ms-debounced `resize`. **No asset, no CSP surface, nothing to purge, and the grain tints from tokens.**

**Blur alternative:** none needed — nothing here is blurred or animated.

**Budget.** One static canvas at DPR 1 = **7.91 MB**, rastered once, never re-rastered, no rAF. Assets: **0 bytes**.

**Lines:** ~35 JS (shared with B's grain) + ~10 CSS.

**Measured-cost risk.** Low. One caveat: grain at α > 0.04 on a light ground reads as JPEG artefact rather than paper. Keep α ≤ 0.03 and let `--ambient-alpha` under `html[data-surface='light']` (0.055) scale it.

---

### J. Algorithmic girih tiling / rosette geometry as SVG

**Verdict: build-time Python → committed SVG, following `scripts/build-jadwal-svg.py` exactly. Not runtime canvas.**

Justification, concrete:

1. **Girih is not procedural-cheap.** A correct strapwork needs the five Islamic tiles (decagon, elongated hexagon, bowtie, rhombus, regular pentagon) laid on a substrate, the 72°/108° strapwork polylines derived from the tile-edge crossing points, and the over/under strand interleave resolved. That is 200–400 lines of geometry producing a result that is **byte-identical on every launch**. Shipping it as runtime JS pays those bytes in every bundle, forever, for zero variation.
2. **Determinism and reviewability.** `build-jadwal-svg.py` uses no RNG at all — its output is byte-stable, so a regenerated file produces a meaningful diff and cannot silently change the app's look. A runtime generator produces an artefact no reviewer ever sees.
3. **The pattern already exists and fits.** Same `OUT_DIR = src/assets/marks/`, same `SVG_OPEN` template, same `NOTICE.txt` beside it, same consumption contract — opaque black geometry consumed as `mask-image`, colour from tokens underneath, so *one file serves all ten themes*. The jadwal docstring already states the "no depiction of any animate being anywhere in these forms, only interlace and stars" guarantee; girih inherits it by construction.
4. **It fixes a bug class rather than repeating it.** The hero currently inlines a hand-written 8-point khatam as a `data:` URI at `src/index.css:1592` — blocked by CSP (§0.1). Moving girih to a committed, file-emitted asset is the correct shape.

**Counter-argument answered.** Runtime canvas would let the tiling adapt to viewport aspect. Not worth it: a tile is a tile, and `background-repeat: repeat` handles every viewport for free.

**Concrete deliverable.** `scripts/build-girih-svg.py` emitting:
- `src/assets/marks/girih-tile.svg` — a seamless 10-fold rosette tile whose edges match under `repeat`;
- optionally `girih-rosette.svg` — one large centred rosette for `HeroAmbient`.

~180 lines. **No HarfBuzz, no font dependency** — girih carries no text. HarfBuzz is required only for the Arabic-bearing marks (`build-basmala-svg.py`, `build-noor-svg.py`); say so in the docstring so nobody adds a font import to this script.

**Delivery constraint (mandatory).** `vite.config.ts` needs `build: { assetsInlineLimit: 0 }` — otherwise a small tile inlines and CSP kills it, exactly as with the jadwal. Add to the harness: assert `dist/assets/*.css` matches `/data:image\//` **zero** times.

---

## 3. The blur question, answered per concept

| # | Implies blur? | Specific alternative |
|---|---|---|
| A motes | yes (soft motes) | **Pre-blurred source** — radial-gradient sprite built once at init; + half-res canvas, CSS upscale |
| B ink | yes (diffusion) | **Pre-blurred source** — 256 px blob sprites; + quarter-res canvas, 4× CSS upscale; static grain to kill banding |
| C stars | no | n/a (points) |
| D sweep | yes (soft-edged beam) | **Radial/linear-gradient stack** — 24%-wide stop spread is the feather |
| E arc | yes (soft arc) | **CSS mask** — `radial-gradient` mask with a 1% feather band |
| F lamp | yes (glow) | **Radial-gradient stack** — the gradient falloff *is* the glow |
| G drift | yes ("blurred ground") | **Radial-gradient stack** (recommended). If ever genuinely needed: blur-small-and-scale at ~40×24 px with `scale(50)` — but never combined with G's own animated scale |
| H clouds | yes | **Radial-gradient stack**, 5–7 ellipses per layer |
| I grain | no (static) | Static vignette gradient; `filter: blur()` on a *static* element is permitted but unnecessary |
| J girih | no | n/a (line geometry) |

`filter: blur()` appears exactly once in the codebase today, at `html[data-theme='pearl'] .hero-scene` (`src/index.css:1556`) — 8 px on a large element, but **static**, so it does not violate the rule. Do not extend that pattern to anything animated.

---

## 4. Perf budget verdict

Backing-store / texture arithmetic (bytes = w × h × 4, MiB):

| layer | size | MiB |
|---|---|---|
| full viewport @ DPR 1 | 1920×1080 | **7.91** |
| full viewport @ DPR 1.5 (125% Windows scaling) | 2880×1620 | **17.80** |
| full viewport @ DPR 2 | 3840×2160 | **31.64** |
| half-res canvas | 960×540 | 1.98 |
| quarter-res canvas | 480×270 | 0.49 |
| cloud layer, 200% w, full h | 3840×1080 | 15.82 |
| cloud layer, 200% w, 55% h | 3840×594 | 8.70 |
| arc, sized | 900×900 | 3.09 |

**The binding constraint is GPU memory, not CPU.** Three rules keep every theme inside 40 MB:

1. **Pin the ambient canvas to DPR 1** (or 0.5) explicitly. The naive `canvas.width = rect.width * devicePixelRatio` puts a full-viewport canvas at 17.8 MB on a 125%-scaled display — the single most common Windows configuration — before its compositor texture. Ambient art has no legible edge; nobody can see the difference. **This one line is worth more than every other optimisation here.**
2. **At most two promoted ambient layers per theme.** `will-change: transform` promotion is permanent.
3. **Every Tier 3 canvas at half resolution or lower.** A at ½, B at ¼.

| budget item | verdict |
|---|---|
| idle CPU @ Tier 3 < 3% | **PASS** for A and B as specified (≤ 80 small blits at 30 fps). Fails only for the rejected per-pixel-`ImageData` reading of B. |
| GPU memory < 40 MB | **PASS** with the three rules. **FAILS** for concept H as naively specified (31.6 MB for clouds alone) — fixed by banding to 55% height. |
| zero input-latency contribution | **PASS** — rAF (never a timer), no layout reads inside `draw()`, single-subtraction early-out on skipped frames, ≤ 2 promoted layers. |
| ambient assets across all ten themes < 1.5 MB | **PASS by two orders of magnitude** — one `girih-tile.svg` (~2–4 KB) plus optionally two starfield tiles (~6–20 KB each). **< 80 KB total.** Everything else is gradients and code. |
| no `filter: blur()` on a large animated element | **PASS** — table in §3; zero uses. |

**Tier 3 membership shrinks to two:** A (motes) and B (ink). C moves to Tier 2. That is the right outcome — two canvas generators to write, test, trace and budget, not nine.

---

## 5. The 30 fps rAF throttle

Two patterns that look right and are wrong:

- `setTimeout(() => requestAnimationFrame(loop), 33)` — de-syncs from vsync, produces judder, and adds a timer wakeup that defeats the browser's own background throttling.
- Naive gate `if (now - last < 33) return rAF(loop)` — drifts, and on a 60 Hz panel frames only arrive every 16.7 ms, so it alternates 33/50 ms and beats between 30 and 20 fps.

Correct pattern (~45 lines with start/stop in `src/components/ambient/raf.ts`):

```ts
const FRAME_MS = 1000 / 30;
let acc = 0, last = 0, rafId = 0;

function loop(now: number) {
  rafId = requestAnimationFrame(loop);
  if (!last) { last = now; return; }
  const dt = Math.min(now - last, 100);  // clamp after a stall/minimise
  last = now;
  acc += dt;
  if (acc < FRAME_MS) return;            // cheapest possible early-out
  acc %= FRAME_MS;                       // carry remainder; no drift, no burst
  step(dt / 1000);                       // simulate in real seconds
  draw();
  frames++;                              // window.__AMBIENT_FRAMES__, see §7
}

export function start() { if (!rafId) rafId = requestAnimationFrame(loop); }
export function stop()  { cancelAnimationFrame(rafId); rafId = 0; last = 0; acc = 0; }
```

Three details that matter:

- `acc %= FRAME_MS`, not `acc -= FRAME_MS` — a long stall otherwise queues a burst of catch-up frames.
- `dt` clamped at 100 ms — a minimised window otherwise teleports every mote across the screen on restore.
- `last = 0` on stop — the next `start()` then sees a fresh baseline instead of a multi-second `dt`.
- The simulation is **time-based**, so this delivers exactly 30 fps on 60 Hz and 120 Hz, and 25 fps on a 50 Hz panel while looking identical.

---

## 6. Mount point — where a route change cannot remount it

**Exact element: `<div className="app-container flex-col">` at `src/App.tsx:61`. `<AmbientLayer />` goes in as its FIRST child, before `<TitleBar />` (line 62).**

Reasoning from the actual tree:

- Route swaps happen strictly inside `<Routes>` at `src/App.tsx:65-75`. Everything above it is stable for the app's lifetime: `App` is rendered once under `MemoryRouter` and only **re-renders** (never remounts) when `useLocation()` at line 23 changes.
- `AppShell` (`src/components/layout/AppShell.tsx:10`) and `<main className="app-ground">` (line 12) are also stable today, so either would work *right now*. Reject both anyway:
  - `main.app-ground` sets `overflow: hidden` and carries its own three-radial-gradient background (`src/index.css:1939-1945`) — an ambient layer inside it is clipped to the content column and sits behind a competing gradient stack.
  - `AppShell` takes `children`, so anyone who later adds a `key` to `<AppShell>` or wraps `<Routes>` in a transition remounts it. `.app-container` sits above both.
- The brief says "z-index 0 behind everything", which includes the sidebar and the custom title bar. `.app-container` is the only node that satisfies that.

CSS:

```css
.ambient-layer { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
.app-container > *:not(.ambient-layer) { position: relative; z-index: 1; }
```

`fixed`, not `absolute`, so it does not participate in the flex column.

**Position in the tree is necessary but not sufficient.** Also enforce:

- `export const AmbientLayer = React.memo(function AmbientLayer() { … })`, no props — a parent re-render costs nothing.
- No `key` on `<AmbientLayer />`, `<AppShell>`, or `<Routes>`.
- **It must not call `useLocation()`** — that subscribes it to route changes and re-runs its effect dependency arrays.
- Canvas ref and rAF id live in `useRef`. The effect that starts the loop has `[]` deps. Theme is re-read through the `MutationObserver`, never through a React dependency — a *theme* change may rebuild sprites, but a *route* change must never touch the loop.
- Pausing on route `/watch` is fine; **restarting** — resetting the clock or reseeding particles — is what is forbidden. On resume set `last = 0` (so `dt` is not a giant catch-up) but do **not** reseed.

**Regression test** (add to the harness): stamp `canvas.dataset.mountId` once at mount; click through all eight sidebar links; assert `dataset.mountId` is unchanged and `window.__AMBIENT_FRAMES__` never decreased.

---

## 7. The Quran Tier 0/1 test — "verified by test, not by eye"

New file `scripts/harness/ambient.mjs`, run as `npm run build && node scripts/harness/ambient.mjs`, exiting non-zero on failure. Plain Node + Playwright, matching the existing style of `shoot.mjs` / `probe.mjs` — no test runner needs adding to devDependencies. It needs no Rust, so it runs in this Linux container where `cargo test` cannot (gdk-3.0 missing).

**Critical setup detail.** `shoot.mjs:86` and `probe.mjs:48` both create contexts with `reducedMotion: 'reduce'`. That is correct for screenshots and **fatal** for this test — it would mask every failure, since `prefers-reduced-motion` already forces Tier 0 globally (`src/index.css:2352`). The ambient test **must** create its contexts with `reducedMotion: 'no-preference'` or it proves nothing.

Three assertions, weakest to strongest:

**1 — Contract.** `AmbientLayer` writes its resolved tier to `document.documentElement.dataset.ambientTier` (`'0'|'1'|'2'|'3'`) on every resolve. Navigate to `/quran` in each of the ten themes; assert the value is `'0'` or `'1'`. Ten navigations, one `page.getAttribute` each. Cheap, and it is the primary assertion.

**2 — Behavioural** (catches a lying contract). Expose `window.__AMBIENT_FRAMES__`, incremented only inside `draw()`. On `/quran`, sample, wait 1500 ms, sample again; assert the delta is **0** in all ten themes. Catches the case where the attribute says `1` but a canvas loop is still running.

**3 — Pixel** (catches CSS animation no counter can see). Screenshot the `.quran-reading-frame` bounding box twice, 1200 ms apart; assert the two PNG buffers are **byte-identical**. Clip to the frame so a caret or a scrollbar elsewhere cannot flake it. Wait **1000 ms after navigation** before the first shot — `.quran-jadwal` carries a 620 ms `jadwal-in` entry animation (`src/index.css:905`).

**4 — The reciprocal, and it is not optional.** On `/` (Dashboard) with a Tier-2 theme and `reducedMotion: 'no-preference'`, assert the two screenshots **differ**. A suite that only asserts "no motion on /quran" passes trivially when the ambient layer is entirely broken.

**5 — Delivery guard.** Assert `dist/assets/*.css` contains zero `data:image/` occurrences (§0.1).

The tier lock itself is enforced in code by route, not by theme: `if (pathname.startsWith('/quran')) tier = Math.min(tier, 1)` — but read the route from the AmbientLayer's *parent* signal (a store field written by `Quran.tsx` on mount/unmount, or a `useSyncExternalStore` on history), **not** by calling `useLocation()` inside AmbientLayer, per §6.

---

## 8. Battery — `navigator.getBattery()` in WebView2

**Facts.** Tauri v2 on Windows uses WebView2 (Chromium). Chromium desktop still implements `navigator.getBattery()` behind a secure context, and Tauri's Windows origin `http://tauri.localhost` is treated as potentially trustworthy, so it *is* a secure context. In practice the API is usually present. But it can be absent (embedder/policy), it can reject, and on a desktop with no battery it resolves with `charging: true, level: 1` — which is **correct**, not "unknown", and must not be misread.

**Layered answer:**

1. **Feature-detect and promise-guard.**
   ```ts
   const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
   if (typeof nav.getBattery === 'function') {
     nav.getBattery().then(bind, fallback);
   } else fallback();
   ```
   Attach `levelchange` and `chargingchange` listeners and recompute the tier on each. **Never poll.**

2. **Absent or rejected → do not downgrade.** Assume AC. Downgrading on an unknown signal punishes every desktop.

3. **The real fallback is a frame-budget governor, not another power API** (~20 lines, and the highest-value part of the whole system — it is the only mechanism that measures the actual device rather than guessing from a spec sheet):
   - Over a rolling 90-drawn-frame window, track the fraction of frames whose `dt` exceeded 1.6 × the target interval.
   - If that fraction > 0.25 for **two consecutive** windows → drop one tier and **latch**. Never oscillate. Recover only on explicit user action or a fresh mount.
   - This catches Windows battery saver, thermal throttling, an integrated GPU, and a merely busy machine — all at once, with no permission and no API.

4. **Battery saver specifically has no web API.** `prefers-reduced-motion` does not flip for it. The brief's "battery saver → Tier 0" is only honourable in Rust: a `#[cfg(target_os = "windows")]` command calling `GetSystemPowerStatus`, whose `SYSTEM_POWER_STATUS` gives `ACLineStatus`, `BatteryLifePercent`, and `SystemStatusFlag` — that last bit **is** the Windows battery-saver flag. Emit as a Tauri event on change, poll at 60 s. This needs a new `windows` crate dependency (`Win32_System_Power`) — there is none today — and falls under CLAUDE.md's "Windows-only paths compile in CI only", so it cannot be verified in this container. **Phase 2, not a launch requirement.** Until then, the governor detects battery-saver rAF throttling within ~6 seconds, which is good enough.

**Device capability generally**, for `tier = min(themeDefault, deviceCapability, userPreference)`:
- Static floor: `navigator.hardwareConcurrency < 4 || (navigator as any).deviceMemory <= 4` → cap at Tier 2. Both are present in WebView2.
- Do **not** use `WEBGL_debug_renderer_info` — deprecated, increasingly masked, and this system needs no WebGL at all.
- The governor in (3) is the authority; the static floor is just a fast first guess.

---

## 9. Pause wiring

| trigger | signal | note |
|---|---|---|
| window blur | `getCurrentWindow().onFocusChanged()` from `@tauri-apps/api/window` (already a dep, 2.10.1) | The DOM `blur` event on `window` is unreliable inside a webview; `document.hidden` fires only on minimise. Subscribe to all three. |
| video playback | `usePlayerStore.subscribe(s => s.status === 'playing')` (`src/store/playerStore.ts`, statuses at :218/:268/:333/:467/:477) | Subscribe **outside** React — the subscription writes a ref the loop reads, so AmbientLayer never re-renders. |
| `/watch` route | route signal | The YouTube iframe's playback state is invisible to the app; treat the whole route as playing. |
| Performance Mode | `settings.performanceMode` — **already exists** (`src/types/index.ts:82`, toggle at `src/pages/Settings.tsx:613`) | Its current copy is "Pause background jobs while a video is playing"; the ambient layer is such a job. |
| reduced motion | `matchMedia('(prefers-reduced-motion: reduce)')` | Forces Tier 0 globally; the CSS at `src/index.css:2352` already collapses every animation. |
| battery < 20% | §8 | |

The user preference "Background motion — Off / Subtle / Full" (default Subtle) needs a new `Settings` field. `Settings` is a Rust-backed struct (`src-tauri/src/db/settings.rs`), so it needs a migration; `performanceMode: boolean` is the precedent. See open question 4.

---

## 10. File and line-count inventory

| file | lines | notes |
|---|---|---|
| `src/components/ambient/AmbientLayer.tsx` | ~150 | mount, tier resolve, pause wiring, MutationObserver |
| `src/components/ambient/useAmbientTier.ts` | ~90 | `min(theme, device, user)` + frame-budget governor |
| `src/components/ambient/tokens.ts` | ~40 | token snapshot reader with the `var()` fallback |
| `src/components/ambient/raf.ts` | ~45 | 30 fps throttle, start/stop |
| `src/components/ambient/sprites.ts` | ~55 | radial-gradient sprite factory, seeded PRNG, grain tile |
| `src/components/ambient/fields/motes.ts` | ~110 | concept A |
| `src/components/ambient/fields/inkflow.ts` | ~95 | concept B |
| `src/index.css` (`@layer components`) | ~180 CSS | concepts C, D, E, F, G, H + Tier 0/1 grounds + the 5 tokens |
| `scripts/build-girih-svg.py` | ~180 | concept J |
| `scripts/build-starfield-svg.py` | ~70 | concept C tiles |
| `scripts/harness/ambient.mjs` | ~140 | §7 test |
| `vite.config.ts` | +1 | `build: { assetsInlineLimit: 0 }` |

**~975 lines TS/JS + ~180 CSS + ~250 Python.** Two canvas generators, six CSS concepts, two build scripts, one test.


## Risks

- **The shipped CSP blocks `data:` image URLs (measured), and Vite inlines `jadwal-band-h.svg`, `jadwal-band-v.svg` and `jadwal-corner.svg` into `dist/assets/index-*.css` as `data:` URIs. The jadwal band and khatam corners — and the `.hero-girih` khatam at src/index.css:1592 — are therefore likely invisible in the packaged Windows 1.21.0 build. Any ambient asset shipped the same way inherits the bug.**
  - Mitigation: Set `build: { assetsInlineLimit: 0 }` in vite.config.ts so every SVG emits as a real file loaded from 'self'. Add a harness assertion that `dist/assets/*.css` contains zero `data:image/` matches. Separately, get one screenshot of the Quran route from a real Windows build to confirm the pre-existing jadwal bug before it is attributed to this work.
- **`--hair-rgb: var(--accent-gold-rgb)` and 8 of 10 themes resolving gold means an ambient layer defaulting to `--accent-gold-rgb` would faithfully reproduce the audit's headline defect — ten identical ambient fields in one hue, with `blue` and `red` byte-identical.**
  - Mitigation: Point `--ambient-ink-rgb` at `--accent-teal-rgb`, which is declared as ten distinct values and has zero effective usage (its only reference, src/index.css:736, is inside an `html[dir='rtl']` rule that never matches because App.tsx:45 pins dir to ltr). Zero new tokens, zero per-theme component code.
- **Concept H (Samaa clouds) as specified needs two 200%-wide full-height promoted layers: 3840x1080x4 = 15.82 MiB each, 31.6 MiB total, which fails the 40 MB GPU budget before any other layer exists.**
  - Mitigation: Band each cloud layer to the upper ~55% of the frame (3840x594x4 = 8.70 MiB each, 17.4 MiB total), or use one layer at 200% width and a second at 140%. Enforce the general rule of at most two promoted ambient layers per theme.
- **A naive `canvas.width = rect.width * devicePixelRatio` puts a full-viewport ambient canvas at 17.80 MiB on a 125%-scaled Windows display — the most common configuration — and 31.64 MiB at 200%, consuming the whole GPU budget on one layer.**
  - Mitigation: Pin the ambient canvas backing store to DPR 1 or lower explicitly (concept A at half resolution = 1.98 MiB, concept B at quarter = 0.49 MiB) and CSS-upscale. Ambient art has no legible edge; the difference is not visible.
- **The obvious reading of concept B — per-pixel value noise via ImageData — is 2.07M pixels x 4 bytes at 30 fps = 249 MB/s of putImageData plus the noise math, 15-40% of a core. It would silently blow the 3% idle-CPU budget and only show up in a trace.**
  - Mitigation: Specify the advected blob-field construction instead (6-10 pre-built 256px radial-gradient sprites on a quarter-resolution canvas with additive blending), and write the rejection of per-pixel ImageData into the module docstring so it is not reintroduced.
- **Concept E is one custom-property change away from a paint storm: animating a conic gradient's `from` angle re-rasterises the full gradient every frame, whereas rotating the element is free. The two look identical in source.**
  - Mitigation: Comment the rule at the CSS site (`animate transform, never the gradient angle stop`) alongside the existing load-bearing-invariant comments, and verify with DevTools paint flashing before shipping.
- **Concept G's animated scale can exceed the layer's rastered scale and force a per-frame re-raster of a full-viewport layer — the exact failure the budget forbids, and invisible without a trace.**
  - Mitigation: Give the element `inset: -2%` so it is rastered 4% larger than displayed and the animation runs inside that headroom. Verify with the Rendering panel's layer borders and paint flashing; if the layer repaints, the headroom is wrong.
- **The existing harness contexts pass `reducedMotion: 'reduce'` (shoot.mjs:86, probe.mjs:48). An ambient test copied from them would force Tier 0 globally via the rule at src/index.css:2352 and pass unconditionally, proving nothing.**
  - Mitigation: The ambient test must create contexts with `reducedMotion: 'no-preference'`, and must include the reciprocal assertion — that a Tier-2 theme on `/` DOES produce two differing screenshots — so a fully broken ambient layer cannot pass the suite.
- **Windows battery saver has no web API and does not flip prefers-reduced-motion, so the brief's 'pause under battery saver' rule cannot be honoured from JS alone; navigator.getBattery() may also be absent or reject in some WebView2 configurations.**
  - Mitigation: Treat an absent or rejecting getBattery as 'assume AC, do not downgrade', and rely on the rolling frame-budget governor (fraction of drawn frames exceeding 1.6x target over a 90-frame window, latched, two consecutive windows) which detects battery-saver rAF throttling within ~6 seconds. Escalate to a Rust GetSystemPowerStatus command in phase 2 only if measurement shows the governor is insufficient; that needs a new `windows` crate dep and is CI-only per CLAUDE.md.
- **Mounting AmbientLayer at the correct tree position is necessary but not sufficient — a later `useLocation()` call inside it, a `key` added to `<AppShell>` or `<Routes>`, or a route transition wrapper would silently reintroduce the remount-on-navigation defect the brief forbids.**
  - Mitigation: Mount as the first child of `.app-container` at src/App.tsx:61 (above AppShell, above main.app-ground with its overflow:hidden), wrap in React.memo with no props, forbid useLocation inside it, and add the harness assertion that `canvas.dataset.mountId` is unchanged and `window.__AMBIENT_FRAMES__` never resets after clicking through all eight sidebar routes.
- **Concept F's 20s alternate breathe is the most likely element to be perceived as the screen pulsing during sustained reading, and concept B's Lissajous folds can read as a lava lamp if the periods are too short — both are perception failures no perf test catches.**
  - Mitigation: Quran route forces Tier 0/1 in all themes (tested per §7); additionally cap concept F's peak-to-trough opacity delta at 0.12 under `html[data-surface='light']` and cap concept B's fastest Lissajous period at 45s.
- **Quarter- and half-resolution canvases with additive blending on near-black grounds band visibly. Banding is an appearance defect that passes every perf and pixel-identity test.**
  - Mitigation: The static seeded 128x128 grain tile (drawn once via createPattern, alpha 0.02-0.03) is a required component of concept B, not an optional polish step, because it dithers the bands. Reuse it for concept H if banding appears there.

## Open questions

- Is the jadwal actually invisible in the shipped 1.21.0 Windows build? The CSP block was measured in Chromium with the app's exact csp string as a response header, not in WebView2 with whatever CSP Tauri injects at runtime. One screenshot of /quran from a real Windows build settles it. If it is broken, that is a separate bug fix that should be filed and landed independently of the ambient work.
- Should `--ambient-ink-rgb` alias the already-declared-but-unused `--accent-teal-rgb` (zero new tokens, ten distinct values today), or should each theme block declare an explicit `--ambient-ink-rgb` seed? The alias is free; the explicit seed is ~10 lines and more honest about intent, and it decouples ambient from a token that might later acquire a real use.
- Should the ambient layer sit behind the sidebar and the custom TitleBar, or only behind the content column? The spec assumes behind everything (mount at `.app-container`, per the brief's 'z-index 0 behind everything'), which means it shows through the sidebar's translucency and under TitleBar.tsx's custom frame. Confirm that is wanted before committing to the mount point.
- 'Background motion — Off / Subtle / Full' needs a new field on the Rust-backed `Settings` struct (src-tauri/src/db/settings.rs) plus a schema migration. `performanceMode: boolean` is the precedent. Is a Settings schema change in scope for this phase, or should the preference live in localStorage until the next migration window?
- Tier 3 is specified as 'opt-in, dark themes only'. Does opt-in mean it is reached only at the 'Full' setting, or does it need its own separate toggle? The spec assumes Tier 3 requires Full, so the default Subtle never runs a canvas — which also means the default install has zero rAF cost.
- Concept H (Samaa clouds): nothing may be traced, sampled or derived from Plate B because of the bird silhouette. How much of that plate's specific look is actually required from a from-scratch gradient construction, versus 'a cool sky-toned field with parallax'? The answer changes how many gradient stops the layer needs and therefore its raster cost.
- Concept C is recommended as a demotion from Tier 3 to Tier 2 (static tiles + transform, zero JS). Confirm that is acceptable — it means Sakinah Blue never runs a canvas, and the starfield cannot twinkle per-star, only as a whole-layer opacity oscillation.
