# The Rebuild — master plan

Status: **approved direction, phased execution**. This is the single document a
session opens to know what to build next. It supersedes the phase lists in the
pasted briefs; it is synthesized from the measured Phase 0 audit, the ten
design specs and 281 auditor findings in `docs/design-plan/`, the toolset
research in `docs/research/`, and everything learned shipping 1.22.0 → 1.24.0.

Rule zero, learned the hard way three times this cycle: **a phase is finished
when its work is in the released binary and verified there** — not when it is
merged, and not when a screenshot of the dev server looks right. The jadwal
did not render in any packaged build for a full release cycle because every
verification path exercised a configuration that never ships.

---

## What is already done (do not redo)

| Shipped | Version |
|---|---|
| Working hero (featured lesson card, jadwal-framed) | 1.22.0 |
| Ambient layer with tier discipline; glass sidebar | 1.22.0 |
| Plex Sans/Serif actually bundled (Inter never was) | 1.22.0 |
| Window-controls hotfix + 10-theme guard suite | 1.22.1 |
| Recharts glow chart, streak heatmap, poster rails | 1.23.0 |
| Watch rails, glass Quran toolbar, modal springs | 1.23.1 |
| CSP/data-URI fix — jadwal renders at all | 1.23.2 |
| Visible per-theme fields, 3D tilt, scroll reveals | 1.24.0 |

Also standing: the Playwright harness (`scripts/harness/`), `npm run sweep`,
`npm run guards` (now including the build-artefact CSP guard), and the
research verdicts (`docs/research/CANDIDATES.md` — 15 ADOPT-SCOPED, 10 STEAL,
15 REJECT).

---

## Phase R1 — Ten real themes (the seed contract)

The single highest-leverage visual change left. Today 8 of 10 themes resolve
gold; `blue` and `red` are byte-identical in accent. The seed contract is
fully specified in `docs/design-plan/04-seed-contract*.md` with WCAG-measured
values.

- Collapse each theme block to 8–10 seeds; derive the other ~60 tokens in one
  place (`color-mix()` where supported, slash-alpha elsewhere).
- Apply the corrected accents: Sakinah Blue `#5E9DF7`, Yaqut Red `#E75E70`,
  Mushaf Night `#9BC94A`, Onyx gold at 0.34 chroma, Pearl teal `#0E6F68`.
  Mushaf-gold ayah medallions stay warm gold in every theme (print
  convention — never follows the accent).
- Encode the four surface profiles (cool / warm / light / pure-black) as a
  `data-profile` attribute, not per-theme CSS.
- Kill the 72 hand-written rgba literals inside theme blocks.
- Acceptance: adding an eleventh theme is a ≤15-line diff; contrast script
  passes 4.5:1 body / 3:1 large on all ten; sweep shows ten visibly distinct
  apps.

## Phase R2 — The chrome rebuild

- **PlayerDocked**: one persistent bottom bar arbitrating the three audio
  sources (video / radio / reciter). The hard rule from the chrome spec: the
  word-sync engine reads the audio clock from the single global `<audio>`
  element every frame without touching React state — the dock must reuse that
  element, never own a second one. Radio's mini player becomes a view of the
  dock, not a sibling.
- **CommandPalette** (Ctrl+K): surahs, stations, videos, playlists, settings.
  Riwayah rule: a surah result opens in the *active* riwayah; timing data
  never attaches to Warsh. Group by domain, rank by recency then prefix.
- **SidebarNav collapse** to a 64px icon rail, persisted.
- Replace the 9 native `<select>`s with a listbox built on `.rule-list` — the
  Quran ToolbarPanel already demonstrates the pattern.

## Phase R3 — Route completion

- **Quran**: resizable split (persisted), left pane fills viewport with its
  own scroll context, position readout (surah · ayah · juz · hizb), first-run
  empty state framed by the jadwal with "Start at al-Fatihah". The
  load-bearing invariant stands: `.quran-reading-surface` never becomes the
  scroll container.
- **Radio**: virtualize the 175 rows (6431px unvirtualized today — the one
  place a dependency is justified: `@tanstack/react-virtual`, ~15KB). Pinned
  favourites, alpha index, live result count.
- **Reminders**: group Today / Upcoming / Paused; next-due carries the weight.
- **Downloads**: max-width the form (~720px), real queue rows with
  cancel/retry/open.
- **Settings**: section nav; **ThemePreview gallery** — real miniature renders
  per theme (the current three 12px swatches in `i18n.ts` are the last
  hardcoded hexes in the app); Advanced group collapsed.

## Phase R4 — State blocks and first run

All specified with copy in both languages in `docs/design-plan/07-*`:

- `EmptyState` / `LoadingState` / `ErrorState` primitives; the seven named
  error conditions each get a wired recovery action (the Rust commands —
  rescan_all, repair_database, remove_orphaned_entries — already exist).
- **FirstRun**: the import-a-folder moment. The most important screen in the
  app currently does not exist; a fresh install lands on three empty states.
- The 11 loading treatments collapse to one skeleton system (two fill tokens
  and two spinner implementations ship today).

## Phase R5 — Texture, depth and the last polish tier

From the research sweep (`docs/research/UI_TOOLSET_SWEEP.md`), in order:

1. **Tier-1 grain + ornament**: a bundled 128px grayscale PNG (16.5KB,
   generated by a build script — NOT a data: URI, the CSP forbids it) plus an
   inline SVG `<pattern>` khatam ornament. This fills the tier-1 seat that
   Pearl and Mushaf-gold currently render identically to tier 0, and it is
   where reduced-motion users live.
2. **OffscreenCanvas**: move the ambient field off the main thread — makes
   "zero input-latency contribution" structural instead of aspirational.
   Same-origin worker file via `new URL(..., import.meta.url)` passes CSP.
3. **oklab gradient interpolation** on the washes and auroras (`in oklab`
   keyword — grey-free colour ramps, zero JS).
4. **`prefers-reduced-transparency`**: 17 backdrop-filter sites, zero handling
   of the Windows setting today; also repairs the dead `@supports` fallbacks
   whose Pearl rim composites to delta-zero.
5. **Delete framer-motion** (−41KB gzip measured): `LiftCard` is superseded by
   Tilt; `RiseIn` is `@starting-style` + `transition-behavior` natively.
6. **Reconsider recharts** (−101KB gzip): the monotone-curve port is verified
   bit-identical to d3; owner chose recharts knowingly, so this is a proposal,
   not a task. The known bug either way: the glow filter is applied to fill
   AND stroke (`StudyCharts.tsx` `filter` on `<Area>`), densifying the fill —
   fix by targeting the curve only, and collapse the filter to `feDropShadow`
   with `flood-color: rgb(var(--token))`.

## Phase R6 — Per-theme photographic grounds

The three owner plates map to Mushaf Gold (blurred volumes), Maktabah
(bookshelf wall — clean), Samaa (clouds — **contains a bird silhouette; crop
below the horizon or regenerate before any asset derives from it**). Pipeline
per Part II §5: blur 40–80px, 1280px wide, AVIF+WebP, <120KB each, licence
recorded in ASSETS.md. Total ambient assets stay under 1.5MB.

---

## Standing rejections (do not re-litigate)

WebGL/three/ogl (GPU budget: full-screen backbuffer ~66MB at 4K, app plays
video); Rive (CSP `wasm-unsafe-eval` for a cursor toy); Limora / any AI
imagery (unauditable against the animate-beings rule); tsparticles (1.07MB
for what 40 lines already do, no pause discipline); gsap (6.3MB, non-MIT, no
need); vanta (abandoned, ships a BIRDS preset); `element()` (never shipped in
Chromium); CSS `random()` (Safari-only as of July 2026); @property-animated
gradients for the aurora (full main-thread repaint per frame — the shipped
transform drift is the better engineering).

## Invariants carried forward

Everything in `CLAUDE.md` §Manhaj and §Load-bearing, plus three added by this
cycle: no `data:` URIs in built CSS (guarded); the title bar keeps a stacking
position above the ambient layer (guarded); ambient work stops — not hides —
on the Quran route (in the tier resolver).

## Release discipline

Five-file version bump; squash-merge; restart the branch from origin/main
after every merge (three conflicts and one duplicate PR this cycle came from
skipping it); dispatch release.yml; **verify latest.json before declaring
done**; and once per cycle, extract the packaged .exe's resources or run the
harness against a build with the real CSP injected, because dev mode and the
sweep both lie about shipping configuration.
