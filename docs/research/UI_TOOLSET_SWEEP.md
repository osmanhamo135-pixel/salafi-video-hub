# Recommendation

## 1. The short answer

On everything the component galleries actually sell — glass, glow rims, elevation, motion tokens, ambient depth — this app is at or ahead of the state of the art, and the honest recommendation for that whole category is to install nothing. Where it is genuinely behind is in three places nobody markets: platform features that shipped to Chromium between 2023 and 2026 and would let you *delete* code, a texture layer that does not exist, and a bundle where two dependencies account for ~55% of the gzipped JS to deliver one hover lift, one modal entry, and one 28-point sparkline. And there is one live bug: three of the app's hand-authored ornaments — including the jadwal, which the CSS comment calls "the app's signature element" — are almost certainly not rendering in the packaged build at all.

---

## 2. Adopt now — ranked

### 1. Stop Vite inlining the ornament SVGs into `data:` URIs (~20 min)

Measured, not inferred:

- `dist/assets/index-DgaK3G7N.css` contains **5 `data:image/svg+xml`** occurrences, and `dist/assets/` contains **zero emitted `.svg` files**.
- `vite.config.ts` sets no `build.assetsInlineLimit`, so Vite 5.4.21's 4096-byte default inlines `jadwal-band-h.svg` (2027 B), `jadwal-band-v.svg` (2027 B), `jadwal-corner.svg` (315 B) and `noor.svg` (1427 B).
- `src-tauri/tauri.conf.json:28` sets `img-src 'self' asset: …` with **no `data:`**. `background-image` and `mask-image` are img-src-governed; a probe against this exact CSP string in Chromium refused data: `background-image`, data: `mask-image` and data: PNG alike, each raising a `securitypolicyviolation`.

So in a packaged build: `.quran-jadwal` / `.jadwal` (index.css:940, eight mask layers, the mushaf reading pane and the Dashboard featured card), `.thumbnail-plate::after` (index.css:2614, the noor mark on every poster plate), and `.hero-girih` (index.css:1747, a hand-written `data:` URI in the source, not an asset import) all fail.

The reason this could survive unnoticed is structural, and it is worth fixing separately: `tauri dev` serves assets as real URLs and never inlines, and `dist/index.html` carries **no CSP meta** — Tauri injects the policy at serve time — so `scripts/harness/shoot.mjs` renders the entire 10-theme × 2-language sweep with **no policy in force**. Neither documented verification path exercises the shipping configuration.

Fix: `build: { assetsInlineLimit: 0 }` in `vite.config.ts`; extract `.hero-girih` to `src/assets/marks/girih.svg`; add a guard to `scripts/harness/guards.mjs` asserting the built CSS contains no `data:image`. **Confirm in a packaged build before anything else on this list.** If I am wrong about mask-image, the two `background-image` cases are unambiguous regardless.

### 2. Delete `recharts` — hand-roll the area chart (−101 KB gzip, −9.6 MB `node_modules`)

`recharts@3.10.1` costs +354 KB raw / **+101 KB gzip** for one 28-point sparkline **with both axes hidden**. That is 84× a hand-rolled equivalent (+1,201 B gzip). Its size is structural, not incidental: v3 rewrote onto Redux and hard-depends on `@reduxjs/toolkit`, `react-redux`, `immer`, `reselect`, `es-toolkit`, `victory-vendor`, `decimal.js-light`.

Curve equivalence is verified, not asserted: a faithful port of d3's Steffen-style `curveMonotoneX` tangent — `(sign(s0)+sign(s1))·min(|s0|,|s1|,0.5|p|)` with one-sided endpoints — is **bit-identical to d3-shape** across 7 shapes including all-zeros (the empty-library state), single-point-early/late and 2-point, at d3-path's 3-decimal rounding. ~25 lines, unit-testable against d3-shape in CI.

It also fixes a rendering bug you have today. `StudyCharts.tsx:193` puts `filter="url(#study-glow)"` on `<Area>`; recharts propagates it to **both** `.recharts-area-area` and `.recharts-area-curve`, so the gradient fill is blurred and feMerge'd with itself. Pixel-diffing filter-on-both vs filter-on-stroke-only changed **51.66% of pixels, max channel delta 85/255** — the fill is materially denser than its declared 0.34 stop and bleeds below the baseline through the `y=-40% height=200%` filter region. The comment at line 156 does not describe what renders. While you are in there, collapse the `feGaussianBlur`+`feMerge` to one `feDropShadow`: it decouples glow colour from the source graphic, and `flood-color: rgb(var(--token))` resolves live per theme.

Keep the CSS-grid heatmap exactly as it is — it is the half of this feature built without a library, and the half with no bundle cost and no bug.

### 3. Delete `framer-motion` (−41 KB gzip measured, −5.9 MB `node_modules`)

I measured this rather than guessing: an esbuild production bundle of exactly what `Spring.tsx` imports (`MotionConfig` + `motion.div` + `useReducedMotion`) against an identical React baseline is **+125,899 B raw / +41,190 B gzip**. Treat that as the upper bound; rollup may shave a little.

What it buys: `LiftCard` used in **one** place (`LessonRail.tsx:56`, `whileHover={{y:-3, scale:1.006}}`) and `RiseIn` used in **one** place (`ReminderModal.tsx:45`, opacity 0→1 plus 8px). That is it — `grep` finds framer-motion imported in exactly one file, and no `layoutId`, no `AnimatePresence`, no `variants`, no `whileInView` anywhere in `src/`.

The file's own docblock says "CSS owns every hover and press," and then makes these two the exception. The stated justification is interruptibility — but CSS transitions *are* interruptible; they retarget from the current computed value. What they lack is velocity preservation through a reversal, and on a 3px lift at scale 1.006 that is sub-pixel. `RiseIn` is a keyframe, or `@starting-style` + `transition-behavior: allow-discrete` natively. `MotionConfig reducedMotion="user"` is already duplicated by the `prefers-reduced-motion` block at index.css:3025.

2 + 3 together take the bundle from **907 KB / 259 KB gzip to roughly 450 KB / 120 KB gzip**. More than half, and both are deletions.

*(For the record: `framer-motion@12.42.2` is already installed, so the "upgrade to Motion 12" item is done. Nothing to do there.)*

### 4. Make the ambient tier route-aware (2 lines)

`AmbientLayer.tsx:112` computes `tier` from theme, reduced-motion, performance mode and the motion setting — with **no route awareness**. The docblock at line 27 cites a `resolveTier` function that does not exist. The Qur'an clamp is CSS-only: `index.css:2234` hides `.ambient-canvas` with `display: none` on `html[data-route='quran']`. rAF is per-*document*, so on `/quran` with the noor, mushaf or blue theme at motion `full`, the loop keeps running and drawing into a hidden canvas — concurrent with `positionWordCue` measurement. Read `document.documentElement.dataset.route` (already published by `App.tsx:53`) and clamp to `≤ 1` on `quran`. This honours the perf budget by not doing the work, rather than relocating it.

### 5. Fill the tier-1 seat: an inline SVG `<pattern>` ornament + a bundled grain tile

`data-tier` appears **once** in 3,036 lines of `index.css`, only to kill the aurora at tier 0, and `AmbientLayer` gates on `tier >= 2` / `>= 3`. So `pearl` and `mushaf-gold`, both pinned to tier 1 in `THEME_TIER`, currently render **identically to tier 0**. The seat is built and empty — and tier 0/1 is where reduced-motion, Performance Mode and the mushaf route all live.

Two pieces, both ~40 lines and 0 npm bytes:

- **Geometric ornament**: an inline `<svg><pattern>` with `stroke="rgb(var(--accent-gold-rgb) / 0.06)"`. Verified it recolours from a bare `style.setProperty` with no JS — DPI-correct, tiles at any size, ten themes with zero per-theme code. Set fills via *attributes*, not Tailwind classes, to sidestep the marks-purge invariant.
- **Grain**: one deterministic 128px 8-bit grayscale PNG from a build script in the spirit of `scripts/build-*.py`. Real measured sizes: 64px = 4,228 B, 128px = **16,585 B**, 256px = 65,880 B (noise is incompressible — the "8–20 KB at 256px" figure everyone quotes is 3× optimistic). Grayscale carries no colour, so it modulates whatever is beneath it: ten themes, *zero* per-theme code, not merely zero per-theme component code.

Never above the mushaf; grain over ayah body is restyling Qur'anic text. `.quran-reading-frame` is opaque, so an ambient ground layer sits behind it safely. No animation, no `mix-blend-mode` on a viewport-sized fixed layer. And pitch it as tactility, not a banding fix — Skia already dithers gradients and the first screenshot comparison will say so.

### 6. `prefers-reduced-transparency` (scoped)

17 `backdrop-filter` sites, 13 `prefers-reduced-motion` blocks, **zero** handling of the transparency half of the same contract — which is a first-class Windows setting (Personalisation → Colours → Transparency effects) that your only users can toggle.

The work is smaller than it sounds and retires a latent defect: `index.css:2549` already contains `@supports not (backdrop-filter: blur(1px)) { .glass { background: rgb(var(--bg-card-rgb)) } }`, plus the same dead pattern at :804 (`.quran-toolbar`) and :2588 (`.sidebar-glass`). WebView2 always supports backdrop-filter, so those have never once executed — and they are broken: on Pearl, `--sheen-rgb: 255 255 255` over an opaque `--bg-card-rgb: 255 255 255` composites to delta **0**. The rim vanishes. Repair the dormant fallback (invert the rim to `--shade-rgb` when the fill goes opaque, as Pearl already does elsewhere), cover all three glass families plus `.glass-hover:hover` at :2535, and give it a second, reachable trigger.

Fence it: reduced transparency is not reduced motion. A user who turned off frosted panels did not ask for the aurora to stop, and `.glow-edge` is a border treatment, not translucency.

**Harness trap, confirmed empirically:** Playwright's `page.emulateMedia({ reducedTransparency: 'reduce' })` **silently no-ops** on this Chromium — it throws nothing and `matchMedia` still reports `no-preference`. A sweep written the obvious way passes while verifying nothing. Use a CDP `Emulation.setEmulatedMedia` with `features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }]`.

### 7. Element-scoped view transitions, poster → player only (0 bytes)

`Element.startViewTransition()` (Chrome/Edge 147, April 2026) is the one thing here that genuinely beats hand-rolled FLIP: it snapshots on the compositor with no React in the loop, keeps the rest of the page live and interactive, and `::view-transition-new` is a *live* representation, so a `<video>` keeps decoding through the morph. Styling is entirely `::view-transition-group/old/new` + `view-transition-class`, so ten themes recolour with zero per-theme component code — better theming than any JS shared-element API.

Hard boundaries: **never** the document-scoped form (`document.startViewTransition` cross-fades the *root* snapshot, which on `/` means fading the Basmala in and out — `view-transition-name: none` does **not** exempt an element from the root snapshot, only from separate capture). Deny-list `.quran-reading-surface`, `.quran-reading-frame`, `.quran-jadwal`, the Basmala and the noor mark, and never put `view-transition-name` on or above `.quran-reading-surface` — it establishes a stacking context and containment, exactly the class of change that shifts the box `positionWordCue` measures against. Assign the name only to the one activated card and clear it on `transition.finished`. Re-declare the glass recipe on `::view-transition-group` (a snapshot has no backdrop to sample, so `.glass` goes flat mid-morph). Real feature-detect fallback — 147 has only ~3 releases of headroom against 150 stable, and an enterprise-pinned WebView2 can lag.

### 8. Optional: `simplex-noise` for the `ink` field (+583 B gzip)

Measured, tree-shaken, `createNoise2D` only: **965 B minified / 583 B gzip** — 0.22% of budget, not the 3 KB claimed. Zero deps, MIT, 18 KB of readable source, 100% auditable. It fixes a real comment-vs-behaviour mismatch: `THEME_FIELD` names three fields but `field === 'stars'` is the only branch in the generator, so `ink` and `motes` are byte-identical code paths while the comments promise "gold dust motes" and "ink diffusion." **Seed it** — `createNoise2D` defaults to `Math.random`, which would make the ambient nondeterministic per run and inject churn into the Playwright sweep. Apply to `ink` only; stars do not swirl. Hold 320×200 / 30fps / N=54 — noise must improve the look at the same budget, not justify a bigger one.

---

## 3. Steal, do not install

- **Houdini paint worklet (the effect, not the mechanism).** Generated, resolution-independent geometric ornament that reads `--accent-gold-rgb` itself. An inline `<svg><pattern>` gets you the same thing, verified recolouring from a bare token write, with no `vite.config` change, no silent-blank failure mode, no main-thread repaint (a full-bleed worklet measured **624 ms vs 100 ms baseline** across a 20-step resize storm, and a **49.8 ms** median frame on theme switch — window-drag resize is direct input), and no permanent WebKit foreclosure. Revisit `paint()` only for the one thing inline SVG cannot do: ornament in a `mask-image` or `border-image` slot where no DOM element can go — and then tiled via `background-size`, never full-bleed.
- **Paper Shaders' film grain.** The one thing that library has that `AmbientLayer` lacks. A bundled 128px PNG gets it in under 40 lines, without an 819 KB package, a WebGL context, or its `data:image/png;base64` texture that your CSP refuses outright.
- **Route arrival, if you skip item 7.** A keyed wrapper (`key={location.pathname}`) inside the `<main>` at `AppShell.tsx:24` plus a `.route-enter` keyframe — opacity 0→1 and 6px translateY over ~180 ms on the existing easing token, with `html[data-route='quran'] .route-enter { animation: none }`. Opt-in by selector, so the Basmala and the mushaf are out of scope by construction. ~25 lines, no capture, no frozen input, no router migration.
- **BorderBeam's travelling rim, if you ever want an indeterminate-progress signal.** Not `offset-path`: measured in your Chromium, `offset-distance` is **not composited** in Blink — it forces ~60 style recalcs/sec and **89.3 ms of main-thread task time per 3 s**, the same cost class as animating `width`, and `will-change` does not help. Instead put `rotate: 360deg` keyframes on the *existing* `.glow-edge::after` conic behind an opt-in `[data-busy]`: **0 style recalcs, 5.3 ms/3 s** — 1/17th the cost, inherits all ten themes, no new element, no `round` value to keep in sync with `--r-lg`, and no RTL rule (a sweep has no reading direction; `offset-path: rect()` is pinned to physical top-left/clockwise). Only for the genuinely indeterminate jobs (`rescan_all`, `repair_database`, `regenerate_thumbnails`) — downloads and updates are determinate and already have real percentage bars, and swapping one for a looping rim is an information downgrade.
- **`feDropShadow` over `feGaussianBlur` + `feMerge`.** One primitive instead of three, and `flood-color` accepts `rgb(var(--token))` and resolves to the live theme colour — so the glow decouples from the source graphic. Verified.
- **css-doodle as an explorer.** You already have the better version: `scripts/build-jadwal-svg.py` and `build-noor-svg.py` generate the guilloche and the eight-pointed khatam parametrically, so the *mathematics* is the source — diffable, re-runnable at any resolution, with the manhaj audit written into the file. Do not add a second exploration model.

---

## 4. Rejected, and why it will keep coming up

**Anything holding a WebGL/WebGPU context** — Paper Shaders, React Bits, vanta, three, ogl, and WebGPU itself. *Constraint 5.* A full-screen backbuffer is ~17 MB at 1080p and ~66 MB at 4K — over the 40 MB ambient budget before a shader runs — and pausing rAF stops fragment work but **does not release the context, backbuffer or texture set**, so your entire pause-on-blur / pause-on-video discipline buys back nothing on the memory line. Paper Shaders fails twice more: its shared noise texture is a `data:image/png;base64` (your `img-src` has no `data:`), and its colour parser accepts only comma-separated `rgb(r,g,b)` — your `--accent-gold-rgb: 236 195 102` is space-separated by design and falls through to `console.error("Unsupported color format")`. WebGPU additionally needs `additionalBrowserArgs`, which *replaces* Tauri's default `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection` rather than adding to it. Record this once: the rendering ceiling here is a deliberate budget, not a missing API.

**AI image generation** (Limora and successors) — *Constraint 1.* Not "probably fine at low opacity": diffusion output cannot be **audited**. This is the line that separates it from the grain PNG, which is auditable by reading ~30 lines of generator rather than 16 KB of pixels.

**Rive** — *Constraint 6.* `'wasm-unsafe-eval'` plus 5.15 MB of WASM for a cursor decoration.

**`oklab` / `oklch` gradient interpolation** — I expected to adopt this and it does not survive contact. There is **no two-hue gradient in the app**: every accent gradient across `--edge-*`, `--wash-*`, `.ambient-wash`, `.hero-aurora`, `.hero-scene`, `.rule-head` is one hue at descending alpha or one hue to `transparent`. Alpha stops interpolate premultiplied per CSS Color 4, so ~40 of them are literal no-ops. And the `color-mix` half is a silent regression: on real tokens `--fill-2` goes from a +11 step over `--bg-card` to +9 (−18%), `--fill-1` from +8 to +6 (−25%), Pearl's `--fill-well` five points deeper. These are neutral-into-neutral mixes with no hue path to fix — the elevation ladder just flattens on nine dark themes. Repairing it means retuning `--fill-*` per theme, which is precisely the per-theme hand-tuning *constraint 4* exists to forbid. (Separately and unrelated: `ProgressBar.tsx:63` uses `from-primary-blue to-accent-blue` — hardcoded Tailwind palette names, a live constraint-4 violation worth fixing on its own.)

**OffscreenCanvas + Worker for the ambient field** — *Constraints 4 and 5, both against it.* I replicated the exact draw loop: **0.037 ms/frame** (54 motes) and **0.064 ms/frame** (90 stars) — 0.11–0.19% of one core at the 30fps cap, three orders of magnitude below the long-task threshold. And a worker has no `getComputedStyle`, so `AmbientLayer.tsx:138` — the single line that makes ten themes work with zero per-theme JS — becomes an async postMessage hop that can race the CSS variable flip and paint the previous theme's accent. It is also not "30 lines": a second `transferControlToOffscreen` throws `InvalidStateError`, as does `getContext('2d')` or setting `.width` after transfer, and the effect's deps are `[tier, theme, awake]` under `React.StrictMode`. Item 4 above solves the real waste it half-detected.

**CSS 3D layered parallax** — *Mechanism, then constraint 5.* For co-planar layers under a static camera, perspective is a pure linear factor: `translateZ(-2px)` at `perspective:1px` with `scale(3)` and `translateX(N)` projects to exactly `N/3` — identical to animating `translateX(N/3)` in 2D. The aurora already varies amplitude, period and direction per layer, which is the only thing translateZ would contribute. And in the one place depth is tempting, `.hero-clip`'s `overflow: hidden` and `.hero-aurora`'s centre-clearing mask are precisely what keep moving colour off the Basmala — both of which flatten a 3D context. Buying depth means removing the constraint-2 guard.

**Progressive blur on the rails** — *Constraint 5, on a false premise.* The rails do not clip: `.rail-fade` (index.css:2410) already ships a 3.5rem themed ramp with `data-hidden` driven by a scroll-extent sync, RTL overrides and a reduced-motion branch. Adding it would put ~8 independent `backdrop-filter` readbacks per rail × 5 rails = ~40 readback+blur passes per frame, over a *permanently animating* ambient layer — a readback treadmill at idle, forever, landing hardest on scroll frames.

**Document-scoped view transitions** — *Constraint 2.* The root snapshot cross-fade fades the Basmala on `/` and the mushaf out of `/quran`. Also architecturally blocked: `main.tsx` mounts `MemoryRouter`, and `react-router-dom` short-circuits `viewTransition` to a no-op outside `RouterProvider` — and `createMemoryRouter` never passes `window`, so it would skip `startViewTransition` even after migrating.

**`sibling-index()` stagger** — Nothing to stagger (`grep` for `staggerChildren`/`variants=` returns zero), it cannot replace a hover spring, and time-valued `animation-delay` is **ignored** on a progress-based timeline, so it does not compose with `view()` the way it is always demoed. The hue-wheel demo everyone copies would violate constraint 4 outright.

**`background-clip: border-area`** — Needs Chrome 150; your harness is pinned to Chromium 141 at `/opt/pw-browsers/chromium`, so the mandatory sweep would render the `@supports` fallback every run and ship the new branch visually unverified. Its central argument is also inverted: the masks it targets are on `::before`/`::after`, which have no subtree, so the jadwal footgun it cites does not apply. And `background` is a shorthand written at four cascade sites on `.glass`, resetting `background-clip` at each — including on hover.

**css-doodle** — Its one distinguishing safety claim ("it cannot draw a figure") is false: `src/generator/css.js:627` implements `case 'content':`, emoji are its own idiomatic examples, and `parse-svg.js` has no element whitelist. It also opens a `webgl2` context and pipes through `toDataURL()`, and fetches Google Fonts over the network.

**`@number-flow/react`** — Throws on `ar-OM` / `fa-IR`; the maintainer states RTL is unsupported. Half your UI.

**`swapy`** — GPL-3.0. **GSAP** — 6.3 MB and a non-MIT licence for something you would only use where you already have a spring. **`@formkit/auto-animate`** — genuinely good, 7 KB, and still not worth it while Motion is installed; it only becomes an argument *after* item 3.

**Windows Acrylic** — *Constraint 1.* Acrylic is a live blurred rendering of arbitrary screen content behind the window, and your rule disqualifies blurred-photo renderings by name. There is nothing to audit. Mica is the defensible case — an opaque wallpaper-derived tint, closer to a colour sample — but it is still derived from a user's wallpaper, and that is a fiqh judgement rather than a technical one. Every "use platform materials" recommendation you will receive omits this.

---

## 5. Where we are already ahead

Stated plainly, because the galleries are optimising for a different problem.

- **The transform-only aurora is the correct answer, not a compromise.** The technique being written up everywhere for 2026 is `@property`-registered custom properties animated inside gradient definitions. I measured that class of animation: **180 style recalcs and 124.8 ms of main-thread task time per 3 seconds**, versus **0 recalcs / 5.3 ms** for a composited transform. Do not "modernise" the aurora to `@property` — that is a regression dressed as an upgrade.
- **The tier system is better engineered than anything on offer.** `min(themeDefault, capability, userPreference)`, reduced-motion forcing tier 0 globally, pause on window blur, pause on video playback. **No gallery component pauses on blur.** That is the entire difference between a website background and a desktop app background, and it is already done. tsparticles (1.07 MB) has no equivalent and is strictly worse.
- **320×200 upscaled at 30fps is at parity with the best 2026 copy-paste field.** shadcn.io's "Silk" — one of the most-copied background components this year — is a 192×108 offscreen canvas driven by phase-offset sines through a five-stop palette. Yours is the same design at higher resolution with tokens instead of a hardcoded palette. There is nothing to buy.
- **`.glass`'s specular rim is the same `mask-composite: exclude` mechanism Magic UI's BorderBeam uses**, executed with better taste. `.glow-edge` is the gallery "glowing border" with the two correct edits already made: theme accent instead of neon, hover-responsive instead of self-pulsing.
- **The elevation tokens (index.css:608–624) beat the layered-shadow literature.** Three layers — inset sheen, tight key shadow, wide ambient — theme-tinted through `--shade-rgb`/`--sheen-rgb`, with a pressed state that moves the highlight to the bottom edge and collapses the ambient occlusion. The search results on this topic are almost entirely box-shadow generators with nothing to teach. Zero `transition: all` in 3,036 lines.
- **The rail fades are more correct than the thing that would replace them.** `data-hidden` from a scroll-extent sync (with `Math.abs(scrollLeft)` because Chromium reports RTL negative), plus RTL overrides and a reduced-motion branch. Galleries ship a permanent gradient cut and call it done.
- **The chart's gradient and glow are already state of the art.** A vertical `linearGradient` to transparent plus a duplicated blurred stroke *is* what the best dataviz on the web does. No library sells a better version because there is nothing to sell — recharts is providing neither; you hand-wrote both. And the CSS-grid heatmap is the half of that feature with no library, no bundle cost and no bug.
- **`scripts/build-*.py` is a capability the galleries structurally cannot match.** Parametric HarfBuzz-shaped ornament means the *mathematics* is the source, so the manhaj audit happens at source level and re-runs at any resolution. Nothing in this space has an equivalent.

**Why the comparison keeps misleading:** a landing page is seen once, for eight seconds, on an idle machine, with nothing else running, and its job is to be memorable. This app runs for hours, next to a live video decoder, on one known engine, offline, for one user who is *reading*. On a landing page a WebGL backbuffer is free because nothing else wants the GPU, ambient motion is the point rather than a distraction, and no one is present long enough for idle CPU to matter. Every architectural decision the galleries make is correct for their problem and wrong for yours. The features you would actually gain from — element-scoped view transitions, `prefers-reduced-transparency`, Chromium-only CSS — are ones a marketing site *cannot* use, because it has to support Safari and Firefox. One consequence worth writing into `CLAUDE.md`: **"not Baseline" is noise in this codebase.** WebView2 Evergreen was Chromium 150 as of 2026-07-24; almost everything worth having here is flagged non-Baseline only because Safari and Firefox lag, and every future compatibility check will otherwise read that as a red light on features you can simply use.

---

## 6. The one thing

Fix the `data:` URI inlining, and add the guard.

It is the only item on this list that is a *bug* rather than a preference, it is roughly twenty minutes, and it restores the app's signature element on the two surfaces the design comment says carry the app's purpose. Everything else here is an improvement to something that works; this is something that does not. And the guard matters as much as the fix: the reason it survived is that neither documented verification path — `tauri dev`, which never inlines, nor the Playwright sweep, which serves `dist` with **no CSP in force** — exercises the configuration you actually ship. That gap will produce this bug again, in a different place, and next time it may not be something you can see.

Then delete recharts. It halves the bundle and fixes the filter bug in the same edit, and it is the clearest case on this list of a dependency that was simply the wrong call for the chart being drawn — which is a judgement about fit, not about recharts.
