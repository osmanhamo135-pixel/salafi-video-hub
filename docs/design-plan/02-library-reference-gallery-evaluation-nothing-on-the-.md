# Library & Reference-Gallery Evaluation — nothing on the owner's list gets installed

## Verdict table

Measured against the repo at `/home/user/salafi-video-hub` (v1.21.0). Baseline for the bundle-cost column: `dist/assets/index-CzLTyELt.js` is **533 KB raw / 149 KB gzip**, `index-pyV75xKX.css` is **93.6 KB raw / 18.3 KB gzip**, and all bundled fonts together are ~500 KB. Sizes below are `npm view <pkg> dist.unpackedSize`, queried live.

| # | Thing | Verdict | Licence | Weight (unpacked) | Killer reason |
|---|---|---|---|---|---|
| 1 | **KokonutUI** — liquid glass | **REJECT** | MIT | + shadcn/ui + Radix + CVA + tailwind-merge + Motion | Axis 5: already covered. The effect's differentiator (`backdrop-filter: url(#svg)`) does not work in Chromium, so you pay the whole dependency chain to land on `backdrop-filter: blur()` — which `src/index.css:1926-1931` already ships. |
| 2 | **React Bits** — shader gradient backgrounds | **STEAL-THE-IDEA** | MIT (runtime `ogl` is Unlicense, `three` is MIT) | `ogl` 423 KB / `three` 23.2 MB | Axis 2+3. A full-screen WebGL layer's backbuffer alone is ~17 MB at 1080p and ~66 MB at 4K — the brief's own <40 MB GPU budget fails on a 4K panel before a single shader runs. And the brief's Tier 3 is 2D canvas, not WebGL. |
| 3 | **Bklit** — designed charts + video export | **REJECT** | components MIT; **Studio (where video export lives) is proprietary** | Recharts 7.45 MB + immer + es-toolkit + reselect | Axis 5: **this app has no chart surface.** I checked. See "Bklit" section for the four scalars that exist. |
| 4 | **Limora** — on-brand AI images | **REJECT** | Hosted SaaS subscription; output terms are a third party's | n/a | Axis 1, unconditional. Diffusion output cannot be *audited* for constraint 1, and constraint 7 forbids AI Arabic outright. |
| 5 | **Anime.js** — scroll & SVG animation | **REJECT** | MIT | 2.13 MB (~17 KB gz runtime) | Axis 1+5. Its differentiator is SVG stroke/morph timelines. The only SVG in this app is `src/assets/marks/basmala.svg` and `noor.svg` — Qur'anic and calligraphic, which constraints 2/3/10 forbid animating. It buys the app one capability it is not permitted to use. |
| 6 | **Motion** — physics-based motion | **STEAL-THE-IDEA** | MIT (Motion+ paid) | `motion` 682 KB, `framer-motion` 4.79 MB | Axis 2+5. Single-engine target (Evergreen WebView2 = current Chromium) means `@starting-style` + `transition-behavior: allow-discrete` + `document.startViewTransition()` cover both things Motion would be used for, with zero bytes and no second motion vocabulary competing with `--dur-press/fast/normal/slow`. |
| 7 | **Rive** — interactive cursor animation | **REJECT** | runtimes MIT; **editor is a hosted SaaS**, `.riv` only authorable there | `@rive-app/canvas` **5.15 MB** unpacked (WASM) | Axis 1+2. Requires weakening `script-src 'self'` to `'wasm-unsafe-eval'` in `src-tauri/tauri.conf.json:28` for a *cursor decoration*. Also input-coupled motion vs. "zero contribution to input latency". |
| 8 | **Magic UI — Globe** | **REJECT** | MIT (`cobe` MIT, 19 KB) | 19 KB — the smallest thing here | Axis 1 passes (a globe is inanimate). It fails on **taste**: it is a lie about the product and a 2021 SaaS-landing-page cliché. Reasoning below. |
| 9 | **Magic UI — Animated Beam** | **STEAL-THE-IDEA** | MIT | ~40 lines | An SVG path between two refs with an animated `linearGradient` offset. Reimplementable trivially — but **there is no surface in this app that needs it.** Do not build it yet. |
| 10 | **motionsites.ai** | **STEAL-THE-IDEA** | Paid ($149/yr or $239 lifetime) | zero — it is a *prompt* library | It sells prompts and preview videos, not code. There is nothing to install and nothing to license. Not being able to buy it costs the project ~nothing. |
| 11 | **animated-backgrounds galleries** (shadcn.io/background et al.) | **STEAL-THE-IDEA** | mostly MIT copy-paste | zero if generated | ~14 of the ~100 concepts are both manhaj-safe and 20-60 lines. Enumerated below. |

**Nothing gets ADOPT or ADOPT-SCOPED.** The one library that *should* be adopted is not on the owner's list — see the appendix.

---

### Why the CSP decides three of these before taste does

`src-tauri/tauri.conf.json:28`:

```
default-src 'self'; ... script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'
```

Three consequences that no amount of design intent overrides:

1. **No `'wasm-unsafe-eval'`.** Chromium refuses to compile WebAssembly under `script-src 'self'` alone. Rive, and anything else WASM-backed, requires editing this line. That is a security-posture change to the shipped app.
2. **`connect-src 'self'`.** Every one of these libraries' CDN-hosted demo assets, remote `.riv` files, and font/texture fetches is dead on arrival. All assets must be bundled — which is correct for an offline app, and means "small library, big remote asset" is not an available trade.
3. **`worker-src` falls back to `default-src 'self'`,** so `blob:` workers are blocked. Any library that offloads to a generated worker fails silently in the packaged app but works in `vite dev`. That is the worst possible failure shape: it passes local testing and breaks in the installer.

Add to this: **the Tauri v2 updater ships whole installers, not deltas.** Every kilobyte added to the bundle is re-downloaded by every installed user on every release. Bundle cost here is not a first-paint number, it is a recurring bandwidth tax.

---

### Limora — plainly

**REJECT. Not scoped, not "for exploration only", not "for mood boards".**

1. **Constraint 1 is an audit requirement, not a taste requirement.** "No animate beings at any opacity, in any style, including abstracted, blurred, dot-matrix or particle renderings" is a claim you must be able to *make about a file*. A diffusion model gives you an image and no account of what is in it. A face at 4% opacity in a heavily blurred warm field is exactly the artefact that survives review — and the proof is in the owner's own materials: **Plate B already contains a bird silhouette in the cloud field.** That plate was human-selected and still shipped a violation into the reference set. An automated generator will do this at scale and without a paper trail.
2. **Constraint 7 forbids it explicitly for Arabic.** Limora's pitch is a brand kit — logo, colours, **fonts** — internalised by a model. Feed it Aref Ruqaa or the KFGQPC faces and it will emit letterform-*shaped* marks that are not shaped text. Applied to `نور`, that is fabricated Arabic. Applied anywhere near a Basmala, it is worse than a design defect.
3. **The repo already has the correct pipeline.** `scripts/build-basmala-svg.py`, `build-jadwal-svg.py`, `build-noor-svg.py` shape real fonts with HarfBuzz and emit real outlines. That is a reproducible, auditable, source-controlled route that a reviewer can re-run. Replacing it with a subscription API is a strict downgrade in every dimension including cost.
4. **Licence/axis 4.** Output rights, model-training terms and continued service availability all become third-party dependencies for bytes that ship *inside a signed binary* distributed to users.

**What replaces it:** the three plates are handled by (a) crop, (b) heavy pre-blur, (c) manual review at 100% and at 8x gain, and (d) re-encode to WebP. Plate B's ground is **regenerated from theme seeds** as a Tier 1 gradient field, not repaired — a bird you blurred is still a bird you blurred.

---

### Rive — WASM against a cursor

**REJECT.** Four independent disqualifications; any one is sufficient.

1. **CSP.** As above: `script-src 'self'` must become `script-src 'self' 'wasm-unsafe-eval'`. Weakening the content-security policy of a signed desktop app so a cursor can have a physics-y trail is not a trade worth discussing.
2. **The animation constraint.** The brief forbids animation on the hero, the Basmala and the reading surface, and the ambient contract adds "never animate/restart on route change" and "pause on window blur". A cursor animation is *global* — it lives above every route, including `/quran`. To honour the reading-surface rule you would have to suppress it exactly where the user spends the most continuous time, at which point it is a feature that exists on seven routes and mysteriously dies on the eighth. That reads as a bug, not as restraint.
3. **The perf budget contradicts it directly.** The contract says "zero contribution to input latency". A cursor-reactive animation is *definitionally* work on the `pointermove` path. You cannot satisfy both. Separately: `@rive-app/canvas` is **5.15 MB unpacked** of runtime and WASM variants, instantiated at startup, holding a persistent `requestAnimationFrame` loop and its own canvas — against a <3% idle CPU / <40 MB GPU budget that also has to accommodate the actual ambient layer.
4. **Subject matter and authoring.** Rive's canonical showcase is an interactive creature that follows the cursor — an animate being, constraint 1, in the most literal form available. And `.riv` is a binary format authorable only in Rive's hosted editor. For an offline app whose existing graphics are *generated from a checked-in Python script*, introducing an asset nobody can rebuild from source is a maintenance trap on top of everything else.

---

### React Bits — what a WebGL context actually costs in WebView2

**STEAL-THE-IDEA.** The look is achievable; the implementation is not appropriate.

**GPU memory, concretely.** A full-viewport WebGL drawing buffer is `width × height × 4` bytes, double-buffered, plus the compositor's own copy of the result:

| Panel | Backbuffer | ×2 (double-buffered) | + compositor copy |
|---|---|---|---|
| 1280×800 | 4.1 MB | 8.2 MB | ~12 MB |
| 1920×1080 | 8.3 MB | 16.6 MB | ~25 MB |
| 2560×1440 | 14.7 MB | 29.5 MB | ~44 MB |
| 3840×2160 | 33.2 MB | 66.4 MB | ~100 MB |

The brief's ceiling is **40 MB for the whole ambient layer**. A 4K panel blows it by 2.5× before a single shader instruction executes, and 4K laptops are ordinary now. Add the noise/gradient textures the Silk and LiquidChrome variants sample and it is worse. The fix — render at 0.5× and upscale — is available, but at that point you have a blurry gradient, which is what Tier 2 CSS gives you for free.

**Does it survive "pause on video playback"? No — and this is the important part.** Pausing the `rAF` loop stops the *fragment work*. It does **not** release the WebGL context, the backbuffer, or the texture set. Those stay resident for the entire session. So the rule protects CPU/GPU *time* and does nothing at all for the memory line of the budget. Any honest implementation must destroy and recreate the context, and context recreation is a visible flash plus a shader recompile.

**Worse, and specific to this app:** local video plays through a real `<video>` element (`src/components/player/VideoPlayer.tsx:56`), and Chromium promotes hardware-decoded video to a **zero-copy hardware overlay** when nothing composites over or under it in a conflicting way. Introducing a full-screen accelerated canvas in the same stacking context can demote the video out of the overlay path into an ordinary composited texture. The effect is measurable: higher power draw and shorter battery life during exactly the activity the app exists for. "Pause on video playback" does not prevent this, because the demotion is caused by the *presence* of the layer, not by its animation.

**Also fails axis 4/9 on the ground:** React Bits is copy-paste, not npm. Its components arrive carrying their own hex literals and their own colour props, so every one violates constraint 9 until rewritten against the 68-token system — at which point you have written it yourself anyway.

**What to steal:** the *slow-drifting coloured field*. Tier 2 = three or four `radial-gradient` blobs in theme seed colours on one absolutely positioned div, moved with `translate3d` on a 40-90s `@keyframes`. Compositor-only, no paint, no layout, no context, ~30 lines of CSS, 0 bytes of asset.

---

### Magic UI's globe — the taste answer

The rules answer is easy: a globe is an inanimate object, so constraint 1 does not touch it, and `cobe` is 19 KB, so axis 3 does not either. It is the cheapest thing in this entire evaluation.

**It is still wrong, for four reasons that have nothing to do with the rulebook.**

1. **It states something false about the product.** A rotating globe means *network, reach, distribution, users around the world*. This app is an **offline** library on one person's disk. There is no server, no account, no other user. Putting a globe on the dashboard is a stock gesture borrowed from products that have a fleet, and this product deliberately does not.
2. **It is the single most exhausted motif in contemporary UI.** Every Vercel-era landing page has one. An app whose visual argument is *manuscript culture, ruled pages, the mistara, real shaped Arabic* cannot open with the most generic possible SaaS artefact without conceding that its identity is decorative.
3. **It is animation at the hero.** The globe's whole appeal is that it spins. The brief already fixes the hero as static.
4. **The subtle one.** A globe has to be centred somewhere, and whatever it is centred on becomes the implied centre of the thing. This app's meaningful geography is the qiblah and the two ḥaramayn — a direction, not a rotating sphere. If the dashboard ever earns a geographic mark, that is what it should be, drawn as geometry from tokens. But it has not earned one, because nothing on the dashboard is about place.

**Verdict: REJECT.** Not on risk, on judgement.

---

### Anime.js vs Motion vs pure CSS, for *this* app

The premise matters: the repo already has four Fluent motion tiers (`--dur-press` 90ms, `--dur-fast` 140ms, `--dur-normal` 200ms, `--dur-slow` 300ms at `src/index.css:398-401`), a shared easing set, and **complete** `prefers-reduced-motion` coverage — 8 separate blocks, and `src/index.css:2350-2360` documents the deliberate choice to *collapse* animations rather than set `animation: none`. This is not a stub. It is a finished motion system.

So the question is narrow: what can neither CSS nor the platform do?

**Things CSS genuinely could not do, historically — and their status on this exact runtime:**

| Capability | Needs a library? | Status on Evergreen WebView2 |
|---|---|---|
| Exit animation on React unmount | Historically yes | **No** — `@starting-style` + `transition-behavior: allow-discrete` (Chromium 117+) |
| FLIP / shared-element morph (docked → expanded player) | Historically yes | **No** — `view-transition-name` + `document.startViewTransition()` (Chromium 111+) |
| Interruptible spring with drag velocity transfer | Yes | Yes — but the only candidate surface is the seek scrubber, which should be exact, not springy |
| Orchestrated stagger across N children | No | `--i` custom property + `animation-delay: calc(var(--i) * 40ms)` — 3 lines |
| SVG stroke/morph timelines | Yes (Anime.js's speciality) | **Forbidden here.** The only SVGs are the Basmala and the نور mark |

**This is a Windows-only app on Evergreen WebView2.** That is the rarest privilege in front-end work: you know the engine and it is current. Every browser-support argument for a motion library evaporates. There is no Safari to placate and no legacy Chromium floor.

**Anime.js: REJECT.** Its differentiator over CSS is the SVG timeline. This app's SVGs are `basmala.svg` and `noor.svg`. Constraint 2 forbids letter-by-letter animation and fade-in of Qur'anic text; constraint 10 forbids animating the Basmala at all; constraint 3 forbids restyling Qur'anic text. Anime.js sells the app precisely one thing and the manhaj forbids it. Everything else it does, `@keyframes` does.

**Motion: STEAL-THE-IDEA.** Two behaviours are worth having and both are ~40 lines:
- **`useAnimatePresence` replacement** — a `.is-exiting` class + `allow-discrete`, applied to `ReminderModal`, `ToastStack`, `CommandPalette`, `SheetSettings`. Durations read from `--dur-fast`/`--dur-normal`, so reduced-motion coverage is inherited rather than reimplemented.
- **`useViewTransition(name)`** — a hook wrapping `document.startViewTransition`, applied to `PlayerDocked` → `PlayerExpanded` and `PlaylistCard` → `PlaylistDetail`, feature-detected, and a no-op under `prefers-reduced-motion`.

The decisive argument against installing Motion is not weight (`motion` is only 682 KB unpacked and tree-shakes to ~18 KB gz with `LazyMotion`). It is that **it brings a second motion vocabulary.** Motion's `transition={{ type: 'spring', stiffness: 300 }}` knows nothing about `--dur-press`. Within three components you have two systems, two reduced-motion strategies, and per-component numbers — a direct re-run of the failure this codebase already fixed once, documented in `tailwind.config.js` where `rounded-sm = 6px` and `var(--r-sm) = 4px` had drifted apart.

**Hard boundary either way:** no library motion and no view transition may touch `src/pages/Quran.tsx`, `.quran-reading-surface`, `.quran-reading-viewport`, or `.quran-reading-frame`. `positionWordCue` measures against the surface's padding box; a `view-transition-name` promotes an element to its own layer and a transform on an ancestor changes what `getBoundingClientRect()` returns mid-transition. That desynchronises the word cue from the spoken word — a manhaj-relevant defect wearing a motion bug's clothes.

---

### Bklit — I checked the repo; there is no chart surface

Every quantity the app displays, exhaustively:

| Where | What | Current form |
|---|---|---|
| `src/pages/Dashboard.tsx:53-54` | `completionPercent` = completed/total | one number |
| `src/pages/Dashboard.tsx:57-58` | `thumbnailPercent` | one number |
| `src/pages/Downloads.tsx:273-298` | download `percent` | a `width: %` div |
| `src/pages/Settings.tsx:604-607` | thumbnail queue processed/total, ready/failed/skipped | four counters in a text line |
| `src/pages/Settings.tsx:695` | `videoCount` / `playlistCount` | two integers in a diagnostics row |
| `src/types/index.ts:92-94` | `totalVideos`, `totalDuration`, `completedVideos` | three scalars |

`grep -rniE "chart|graph|sparkline|histogram|recharts|d3"` across `src/` returns **zero** chart usage. There is no time series, no distribution, no category breakdown, no comparison — nothing with a second dimension. **These are seven scalars.** The correct form for them is already in the requested block inventory: `StatStrip` — a value, a label, a hairline rule. That is text and a 1px border, not a visualisation.

Bklit is MIT for the components and **proprietary for Studio, which is where the video export lives** — so the headline feature is both paid and a marketing-asset feature with no meaning inside an offline desktop app. And Recharts underneath is **7.45 MB unpacked** plus `immer`, `es-toolkit` and `reselect`, all of it re-downloaded by every user on every update, to render four progress bars that already exist.

**One more objection, on adab.** A charts library invites charts, and the charts a media library naturally grows are *hours watched this week*, *streak*, *completion rate*. That converts a study tool into a self-tracking tool and shifts the user's attention from the material to their own numbers. The app should tell you where you stopped, not how you are performing.

**Verdict: REJECT.** Axis 5, decisively.

---

### KokonutUI — already covered, and the effect does not work here anyway

**REJECT.**

1. **The signature effect degrades to nothing in this engine.** KokonutUI's Liquid Glass builds refraction from `feTurbulence` + `feDisplacementMap` + `feGaussianBlur` referenced as `backdrop-filter: url(#id)`. **Chromium does not support `url()` filter references in `backdrop-filter`** — verify in the harness before finalising, but the expected outcome is that WebView2 falls back to plain blur. You would install a shadcn/Radix/CVA/tailwind-merge/Motion dependency chain to arrive at `backdrop-filter: blur()`.
2. **Which the repo already has.** `src/index.css:1930-1931` is `backdrop-filter: blur(22px) saturate(1.35)`, and `RadioMiniPlayer.tsx:147,187` already carries the specular inset edge that sells glass: `0_1px_0_0_rgb(var(--text-main-rgb)/0.06)_inset` over a layered elevation shadow. The material system described in the Phase 0 audit — surface ladder, `--sheen`/`--shade`, three hairline weights — *is* the glass system. It just isn't turned up.
3. **Token collision.** KokonutUI ships shadcn's namespace (`--background`, `--foreground`, `--card`, `--primary`) against this app's 68 derived semantic tokens, and its components carry `bg-white/10` / `border-white/20` literals. Every pasted component violates constraint 9 on arrival. Given the audit already counts 24 `text-white`/`bg-black` occurrences to remove, importing more is moving backwards.
4. **`backdrop-filter` is not free over video.** It forces a per-frame readback of the backdrop. A large frosted panel sitting over a playing `<video>` copies the decoded frame every frame. Whatever glass survives should be small, static-backed, and never full-bleed over the player.

**What to steal:** nothing to install. The per-theme variance the owner wants from "liquid glass" belongs in the four **surface profiles** — `cool` (Samaa, Sakinah, Noor Teal) raises glass opacity and makes `backdrop-filter` more prominent; `light` (Pearl) drops shadow opacity to ~0 and leads with borders; `pure-black` (Onyx) removes shadows entirely. That is token work, not component work, and it is the only route that keeps constraint 9's "zero per-theme component code".

---

### The reference filter applied to the animated-backgrounds galleries

**First, a correction that saves money.** `motionsites.ai` returned HTTP 403 to automated fetch, but its own marketing is unambiguous: it sells **prompts and preview videos** — 159 animated background videos as of this month, $149/yr or $239 lifetime — to be pasted into Lovable/Cursor/Bolt/v0. **There is no library to install and no code to license.** The owner not being able to buy it costs the project essentially nothing: what is being sold is a naming and a mood, and both are reproducible from the concept name alone. The same concepts are enumerated free at `shadcn.io/background` and similar galleries. Generate, in every case below.

#### Disqualified outright

| Concept | Why |
|---|---|
| Fireflies, Swarm, Pollen-as-insects | Constraint 1. "Swarm" is a boids simulation — *bird*-oids. The algorithm is a flocking model. |
| Deep Sea, Underwater, Ocean-with-fauna | Constraint 1 by implication. The caustics alone are safe; the genre is not. |
| Constellation **drawn as named figures** | Constraint 1. Ursa Major rendered as a bear outline is a depiction. Dots joined by arbitrary proximity lines are not — see the permitted list. |
| Oscilloscope, Brainwaves, Resonance, Sonar, any waveform or bar-meter | **Constraint 8.** These read as equaliser/waveform decoration regardless of their data source. Note that `src/utils/reminderAudio.ts:86` already constructs an `AudioContext` — it must never be given an `AnalyserNode` for visual purposes. Worth an explicit comment at that site. |
| Matrix (falling glyph rain) | Glyphs used as decoration; a film reference; and one careless font fallback away from rendering Arabic as falling ornament. |
| Fireplace, Fire, Lightning, Supernova, Portal, Vortex, Tornado, Hyperspeed | Rule-legal, tonally wrong. Fire imagery in an Islamic study app carries an association nobody intends. The rest are loud. |
| Disco, Neon, Glitch, Hologram, Confetti, Fireworks, Retro Grid, Circuit, DNA | Rule-legal, off-subject. Nightclub, sci-fi, biology lab, and party motifs. |
| Life (Conway) | Squares on a grid — technically safe. Framing a decoration as organisms that breed and die is poor adab in this app. Skip. |

#### Manhaj-safe **and** zero image assets — generate these

Every row is CSS or 2D canvas, driven entirely by existing tokens (`--accent-gold-rgb`, `--hair-rgb`, the surface ladder), ships **0 bytes** of asset, and honours the `rgb(var(--x-rgb) / 0.16)` slash-syntax rule.

| # | Concept | Tier | Implementation | Lines |
|---|---|---|---|---|
| 1 | **Aurora / Mesh Gradient** | 2 | 3-4 `radial-gradient` blobs from theme seeds on one abs-positioned div; `translate3d` drift on 60-90s `@keyframes`; compositor-only | ~30 CSS |
| 2 | **Dot Pattern (mistara field)** | 1 | `background-image: radial-gradient(circle, rgb(var(--hair-rgb) / 0.06) 1px, transparent 1px); background-size: 24px 24px` | ~6 CSS |
| 3 | **Grid / ruled lines** | 1 | Two `repeating-linear-gradient`s at `--hair-faint`. This *is* the mistara `docs/DESIGN_SYSTEM.md:§3` already names | ~8 CSS |
| 4 | **Spotlight / key light** | 1 | One large static `radial-gradient` at a fixed origin. Also already called for: "one warm key light per screen" | ~6 CSS |
| 5 | **Grain / film grain** | 1 | Inline `feTurbulence` as a `data:` URI background. **Static**, so the expensive filter rasterises exactly once | ~8 CSS, <1 KB inline |
| 6 | **Beams / light shafts** | 2 | 2-3 skewed `linear-gradient` divs, slow `translateX`, no blur | ~20 CSS |
| 7 | **Ripple (concentric rings)** | 2 | `repeating-radial-gradient` with animated `background-position` | ~25 CSS |
| 8 | **Bokeh** | 2 | N `radial-gradient` circles — a radial-gradient *is* pre-blurred, so this obeys the "no `filter: blur()` on a large animated element" rule for free | ~20 CSS |
| 9 | **Topography / contours** | 1 | Canvas marching-squares over value noise, drawn once to a static layer | ~50 canvas |
| 10 | **Starfield** | 3 | N points with depth, per-frame alpha twinkle, 30fps cap, dark themes only. Celestial and Qur'anically resonant | ~40 canvas |
| 11 | **Dot-matrix wave** | 3 | Grid of dots, `r = f(sin(x·k + t))`. Named explicitly in the brief's Tier 3 | ~35 canvas |
| 12 | **Noise flow field** | 3 | Value noise + particle advection, capped particle count, 30fps | ~60 canvas |
| 13 | **Constellation (proximity lines)** | 3 | Drifting points, line drawn when `dist < r`. **No named figures** | ~50 canvas |
| 14 | **Hexagon / honeycomb tiling** | 1 | Inline `<pattern>`. See the note below — this one should be upgraded | ~25 SVG |

#### Manhaj-safe but **need** a pre-rendered still

Silk, Liquid Chrome, Mercury, Iridescence, Caustics, Watercolour, Smoke, Plasma, Fractal, Reaction-Diffusion, Marble, Paper. These are fragment shaders; there is no honest 40-line CSS version.

**Route:** render each **once, offline**, in a build script beside `scripts/build-*.py`, blur at source, and ship a small WebP as a **Tier 1 static**. This is exactly the brief's own "pre-blur the source, do not `filter: blur()` a live element" rule, and it is also how the three plates should be handled.

**Budget check.** Ceiling is 1.5 MB across ten themes = 150 KB/theme. A heavily blurred 1920×1080 field encodes to roughly 15-40 KB as WebP at q≈60 — blur is the ideal case for a lossy codec. Ten themes land around 250-400 KB, leaving 1.1 MB of headroom. For calibration, `dist/assets/app-icon-CElKQprs.png` is **378 KB on its own** and is a single icon; the entire ambient system can be made to cost about as much as that one file.

#### The concept the galleries do not have

None of these hundred effects is *this app's*. The one worth building has no entry in any gallery: **a girih / khatam strapwork field** — interlaced polygonal strapwork on an 8- or 10-fold rosette, generated as an SVG `<pattern>` and tinted with `rgb(var(--hair-rgb) / 0.05)`. It is:

- geometric, so constraint 1 is satisfied by construction, not by inspection;
- native to the subject rather than borrowed from landing pages;
- already half-built — `src/assets/marks/jadwal-band-h.svg`, `jadwal-band-v.svg` and `jadwal-corner.svg` exist, and `scripts/build-jadwal-svg.py` is the pipeline;
- under 4 KB as a tiling SVG, and static, so it is a Tier 1 that costs nothing per frame;
- the one background that would make the app look like nothing else.

Build this before building an aurora.

---

### Appendix — the library that *should* be adopted, which is not on the list

**`@tanstack/react-virtual` — ADOPT-SCOPED.** MIT, **56 KB unpacked** (~10 KB gz), headless, zero DOM opinions, zero styling, no colour, no motion. The Phase 0 audit records Radio at `scrollHeight` 6431 px across **175 unvirtualized rows**. That is a real, measured defect, and it is the only place in this evaluation where a dependency buys something the platform does not provide. Scope it to `src/pages/Radio.tsx` and, if `RailPoster`/`GridMedia` ever exceed ~200 items, to the library grid.

**Two zero-byte fixes worth folding in.** The `'Inter'` phantom appears in **two** places, not one: `src/index.css:613` and `tailwind.config.js` (`fontFamily.sans`). Do not bundle Inter to fix it. This is a Windows-only app — name **`Segoe UI Variable Text`** first with `system-ui` after it. It is present on every Windows 11 target, it is the correct face for a Windows desktop app, and it costs **0 KB** instead of ~30 KB of subset woff2. Then correct `docs/DESIGN_SYSTEM.md:46`, which currently claims Inter is "already bundled" — it is not, and that line is how the phantom survived.

---

### Verification

Nothing above should be taken on trust. The harness exists:

```
npm install --no-save playwright@1.49.1
npm run build && node scripts/harness/shoot.mjs --out design-audit/tmp
node scripts/harness/probe.mjs
```

Three claims specifically want a measurement before they are treated as settled:

1. **`backdrop-filter: url(#svgfilter)` in WebView2** — build a one-page spike with a `feTurbulence`/`feDisplacementMap` filter and confirm Chromium drops the reference. If it does not, KokonutUI's effect is reproducible in ~40 lines and the verdict stays REJECT for the *library* while the technique becomes available.
2. **WebGL backbuffer accounting** — `chrome://gpu` equivalent in WebView2, or a `WEBGL_debug_renderer_info` probe, on a 4K panel, to confirm the 66 MB figure rather than infer it.
3. **Video overlay demotion** — measure package power with and without a full-screen accelerated canvas behind a playing local file. This is the claim with the largest real-world consequence and the least direct evidence.


## Risks

- **The Chromium `backdrop-filter: url(#svg-filter)` claim is asserted from engine behaviour, not measured in WebView2 on this machine (the container has no Windows/WebView2). If Chromium in fact honours SVG filter references in backdrop-filter, the KokonutUI liquid-glass technique becomes reproducible and part of the axis-5 'already covered' argument weakens.**
  - Mitigation: Build a one-page spike with feTurbulence + feDisplacementMap referenced from backdrop-filter and run it through scripts/harness/shoot.mjs, then again in a real WebView2 window on the Windows CI target. The verdict for the library stays REJECT either way (token collision, dependency chain, constraint 9); only the availability of the technique changes.
- **WebGL GPU-memory figures are computed from backbuffer arithmetic (w x h x 4 x 2 + compositor copy), not measured. Chromium may compress, share, or lazily allocate, making the real number lower than 66MB at 4K.**
  - Mitigation: Probe with WEBGL_debug_renderer_info plus the WebView2 process's GPU memory counter on an actual 4K panel before treating the <40MB budget as definitively unreachable. Even at half the computed figure a 4K panel still exceeds the budget, so the conclusion is robust to a 2x error.
- **The 'full-screen accelerated canvas demotes hardware video out of the zero-copy overlay path' claim has the largest practical consequence (battery life during the app's core activity) and the least direct evidence here.**
  - Mitigation: Measure package power on the Windows CI target with and without a full-screen WebGL/canvas layer behind a playing local file. If demotion does not occur, Tier 3 canvas may be allowed to persist during playback instead of being force-paused; if it does, the pause-on-playback rule must be upgraded to destroy-on-playback.
- **Rive's exact WASM payload is inferred from @rive-app/canvas's 5.15MB unpacked size, which bundles several runtime variants; the single shipped .wasm is smaller.**
  - Mitigation: Immaterial to the verdict — the CSP 'wasm-unsafe-eval' requirement and the input-latency contradiction are each independently disqualifying regardless of payload size. No further measurement needed unless the verdict is challenged.
- **motionsites.ai and motionsite.ai both returned HTTP 403 to automated fetch, so the backgrounds gallery was evaluated against the standard concept taxonomy (gathered from shadcn.io/background and equivalents) rather than against the owner's actual paid gallery. A concept unique to that gallery could be missed.**
  - Mitigation: Ask the owner for the three named examples' preview stills (Neon Pulse, Crystal Wave, Cosmic Ripple) or a screenshot of the gallery index. The taxonomy covers ~100 concepts and the filter is rule-based, so a missed name is very likely to fall into an already-classified family.
- **Recommending @starting-style / transition-behavior: allow-discrete / document.startViewTransition() assumes Evergreen WebView2 at Chromium 117+. A user on a pinned or Fixed Version WebView2 runtime, or an unpatched Windows install, would get no exit animation at all.**
  - Mitigation: All three are progressive enhancements that degrade to an instant state change, not to a broken UI. Feature-detect startViewTransition and no-op. Confirm tauri.conf.json does not pin a Fixed Version WebView2 runtime before relying on this.
- **Applying a view-transition-name or any transform-bearing ancestor near the Quran reading pane desynchronises positionWordCue, because the cue is measured against .quran-reading-surface's padding box while word coordinates come from the border box.**
  - Mitigation: Make it a test, not a convention: assert in the harness that no element inside .quran-reading-frame carries view-transition-name, contain, or a non-none transform, and that .quran-reading-surface keeps overflow:visible and border:none. The same test should assert the ambient layer resolves to Tier 0/1 on /quran in all ten themes.
- **Plate B's bird silhouette proves a human reviewer already passed a constraint-1 violation. Any pre-blurred still derived from a photographic source carries the same audit risk, including the plates for Mushaf Gold and Maktabah.**
  - Mitigation: Do not repair Plate B — regenerate its ground from Samaa's seed tokens as a Tier 1 gradient field. For Plates A and C, review the source at 100% and again at 8x exposure gain before blurring, since blur hides a violation without removing it, and record the review in scripts/ alongside the generator.

## Open questions

- Does the owner want ANY photographic ground at all, or should all ten themes be generated from tokens? The three plates map to only three themes (Mushaf Gold, Samaa, Maktabah); the other seven have no reference, and a mixed system where three themes are photographic and seven are generated will look inconsistent regardless of how well each is executed.
- Is the girih/khatam strapwork field approved as the app's signature background before effort goes into gallery-derived concepts? It is the only recommendation here that is native to the subject rather than borrowed, and it changes the priority order of everything else.
- Should the Radio virtualization fix (@tanstack/react-virtual) ship in this design phase or be split into a separate performance PR? It is the only ADOPT in this evaluation and it is a correctness/performance fix, not a visual one.
- Confirm the Latin-font decision: name Segoe UI Variable Text and ship zero bytes (correct for a Windows-only app), or actually bundle Inter as docs/DESIGN_SYSTEM.md:46 has been falsely claiming? The two produce visibly different typography and the choice should be deliberate.
- Does the ambient layer need to survive at all on the four routes the audit found mostly empty (Watch 473px dead, Reminders 371px, Downloads 351px), or is filling those with real content the actual fix — with ambient reserved for Dashboard and Radio only? A background is a poor substitute for a route having something to say.
- Which of the ten themes get Tier 3 at all? The brief says 'dark themes only', which excludes Pearl, but that still leaves nine. Enabling canvas on nine themes multiplies the verification surface with no obvious gain over Tier 2.
- Should the AudioContext at src/utils/reminderAudio.ts:86 carry an explicit code comment forbidding an AnalyserNode for visual purposes? It is currently the one place in the codebase where a constraint-8 violation would be one line of code away and would look like a feature.
