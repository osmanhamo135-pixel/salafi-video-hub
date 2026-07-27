# Part II — The Four Hero Blocks: HeroContinue, HeroMushaf, HeroAmbient, HeroCompact

## 0. Scope, files created, files deleted

### New files

| Path | Contents |
|---|---|
| `src/components/hero/types.ts` | `HeroAction`, `HeroPhase`, `HeroContinueLesson`, `MushafResume`, `HeroAmbientLine`, `HeroCompactMetric` |
| `src/components/hero/HeroContinue.tsx` | Dashboard hero |
| `src/components/hero/HeroMushaf.tsx` | `/quran` hero |
| `src/components/hero/HeroAmbient.tsx` | First-run hero |
| `src/components/hero/HeroCompact.tsx` | 180px band for `/library`, `/watch`, `/radio`, `/downloads`, `/reminders`, `/settings` |
| `src/components/hero/HeroSkeleton.tsx` | One skeleton, `shape` prop, zero-CLS |
| `src/components/hero/HeroActionButton.tsx` | The only button any hero renders |
| `src/components/marks/BasmalaPlate.tsx` | The Basmala, two sizes, no other call sites permitted |
| `src/components/marks/NoorMark.tsx` | The نور mark, `HeroAmbient` only |
| `src/hooks/useEyebrowClass.ts` | Moved verbatim out of `ContinueWatching.tsx:19-24` — one definition, imported by all four heroes |

### Deleted

- `src/components/home/Hero.tsx` (whole file).
- `src/index.css`: `.hero`, `.hero-ground`, `.hero-scene`, `.hero-band`, `.hero-band-near|mid|far`, `html[data-theme='pearl'] .hero-scene`, `.hero-girih`, `.hero-scrim`, `.hero-inner`, `.hero-purpose`, `.hero-fade`, `.hero-wordmark`, and the `@media (prefers-reduced-motion) { .hero-scene { filter: blur(7px) } }` block at `index.css:1585`.
- `src/pages/Dashboard.tsx:99-133` — the whole `<header>` masthead (eyebrow + `titleType` h1 + subtitle + thread). Its content is now the hero's. `titleType` (`:87-89`) goes with it.
- `src/components/dashboard/ContinueWatching.tsx:158-279` — `FeatureCard`. Its job is the hero's. `QueueRow` (`:283-320`) survives and becomes the section under the hero.
- `src/pages/Quran.tsx:86-95` — the `premium-pill` + h1 + subtitle block.
- The `premium-pill` + h1 + subtitle blocks at `Watch.tsx:52-59`, `Library.tsx:374-380`, `Downloads.tsx:136-146`, `Reminders.tsx:171-177`, `Radio.tsx:83-95`, `Settings.tsx:412-415`.

### Kept, and why — do not rename

`.hero-basmala`, `.hero-mark`, `.hero-wordmark-latin`, `.hero-arch`, and the SVG group classes `.basmala-stroke`, `.basmala-harakat`, `.mark-stroke`, `.mark-ijam`. Three global selectors name them by class and would silently stop applying if renamed:

- `index.css:597` — `html[data-language='ar'] *:not(.hero-wordmark-latin)` zeroes letter-spacing; the Latin wordmark is its only exception.
- `index.css:638-639` — `html[data-language='ar'] .hero-basmala, .hero-mark { line-height: inherit }` stops `--lh-arabic` inflating the SVG boxes.
- `tailwind.config.js` `content` includes `./src/assets/marks/*.svg` so the four fill classes survive purge.

---

## 1. Shared foundation

### 1.1 New tokens — add to the `:root` block in `src/index.css` (after `--ring-focus`)

```css
/* ── Heroes ──────────────────────────────────────────────────────────
   One seed for every hero's interactive colour. Today it resolves to the
   same accent everything else does; when the ten themes are pulled apart,
   this is the ONE declaration a theme overrides to move all four heroes. */
--hero-accent-rgb: var(--accent-gold-rgb);

--hero-continue-h: clamp(13rem, 30vh, 18.5rem);   /* 208 … 296 */
--hero-mushaf-h:   clamp(8.25rem, 17vh, 10.5rem); /* 132 … 168 */
--hero-compact-h:  11.25rem;                       /* 180, fixed */
--hero-pad-block:  20px;
--hero-pad-inline: var(--s6);                      /* 36 */
--hero-plate-inset: 20px;

/* The Basmala at signature scale. Ratio is fixed by the mark's own viewBox
   (11476 × 1682 = 6.823:1) so height is never authored, only derived. */
--basmala-mark-w: clamp(13rem, 17vw, 19.5rem);     /* 208 … 312 */
--basmala-ratio: 6.823;

--jadwal-corner: 14px;
--skeleton-fill: rgb(var(--text-muted-rgb) / 0.12);
```

```css
@media (max-height: 720px) {
  :root {
    --hero-continue-h: 13rem;
    --hero-compact-h: 9.25rem;   /* 148 */
    --hero-pad-block: 14px;
  }
}
```

Every colour in every hero is `rgb(var(--hero-accent-rgb) / 0.NN)` or an existing semantic token. Slash syntax only — `rgba(var(--x-rgb), 0.16)` is invalid and drops the declaration silently.

### 1.2 `src/components/hero/types.ts`

```ts
import type { LucideIcon } from 'lucide-react';
import type { TranslationKey } from '@/i18n';
import type { QuranBookmark, QuranRiwayah, SurahMeta } from '@/store/quranStore';

/**
 * A hero action. Heroes never build their own buttons and never hold their own
 * copy — one shape, three ranks, label always an i18n key.
 */
export interface HeroAction {
  labelKey: TranslationKey;
  /**
   * A short value shown after the label. MUST arrive already bidi-isolated —
   * `formatDuration` and `formatBytes` do this. Never concatenated into the
   * label, because "12m left" and "١٢د متبقٍ" reorder differently.
   */
  trailing?: string;
  icon?: LucideIcon;
  onSelect: () => void;
  rank: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
  busy?: boolean;
  /** Stable selector for the Playwright harness. Required. */
  testId: string;
}

export type HeroPhase = 'loading' | 'ready' | 'empty';
```

### 1.3 `HeroActionButton`

The only control a hero renders. `rank: 'primary'` → `.btn-primary`; `'secondary'` → `.btn-secondary`; `'quiet'` → `.quiet-action`. Focus is `--ring-focus` inherited from `index.css:2126-2129`; no hero declares its own ring. `busy` swaps the icon for `<Loader2 className="h-4 w-4 motion-safe:animate-spin" />` and sets `aria-busy`. `trailing` renders as `<span dir="ltr" className="tabular-nums opacity-60">`.

**No hero contains a nested interactive element and no hero's container is itself a button.** The current `FeatureCard` makes the whole card one `<button>` with a `<span>` wearing button clothes (`ContinueWatching.tsx:264-274`) precisely because it could not nest. Heroes have real buttons instead, so the pattern is unnecessary.

### 1.4 `HeroSkeleton` and the one skeleton fill

```ts
export interface HeroSkeletonProps {
  shape: 'continue' | 'mushaf' | 'compact';
}
```

Add once to `index.css`:

```css
.skeleton {
  background: var(--skeleton-fill);
  border-radius: var(--r-sm);
}
```

`HeroSkeleton` renders a box of **exactly** the hero's final height (`var(--hero-continue-h)` etc.), so the swap from `loading` to `ready`/`empty` produces zero layout shift. This is asserted, not assumed (§11). It replaces `bg-panel-hover` in `Dashboard.tsx:266-272`, `ContinueWatching.tsx:326-338`, `RecentlyAdded.tsx:100-110` and `bg-elevated-panel` in the other two — one fill, one class.

### 1.5 Heroes never render an error

If a hero's data source rejects, the hero renders its `empty` phase and calls `onError`. The route owns `ErrorState`. Rationale: an error surface inside a fixed-height band either clips the message or breaks the height budget, and the seven named error conditions need recovery actions the hero has no business owning.

---

## 2. The jadwal law

The jadwal is the app's signature. It is currently one instance — `.quran-reading-frame` — and its scarcity is what makes it read as a signature rather than as a border style. The rule below is enforceable by a single harness assertion.

### 2.1 Where it MAY appear

| Site | Form | Class |
|---|---|---|
| `.quran-reading-frame` (`Quran.tsx:1218`) | Full 8-layer mask: 4 bands + 4 khatam corners, plus the two hairline rules on `::before` / `::after` | `.quran-jadwal` — **unchanged, do not touch** |
| `HeroAmbient`'s Basmala plate | Full 8-layer, same tiles, at `inset: 1.25rem` | `.jadwal-frame` |
| `HeroContinue`'s art plate | **Corners only** — 4 khatam, no bands, no rules | `.jadwal-mount` |

`.jadwal-mount` is new:

```css
/* The mount: four khatam and nothing between them.
   The full band around a photographic still turns the mushaf's frame into a
   picture-frame motif and spends the signature on a video thumbnail. Corners
   alone read as a mount and leave the band to the page it belongs to.
   Same tiles, same mask-not-picture construction, so it re-colours per theme
   with no per-theme asset. */
.jadwal-mount {
  --jadwal-c: url('./assets/marks/jadwal-corner.svg');
  position: absolute;
  inset: 6px;
  z-index: 1;
  pointer-events: none;
  background: rgb(var(--mushaf-gold-rgb) / 0.34);
  -webkit-mask-image: var(--jadwal-c), var(--jadwal-c), var(--jadwal-c), var(--jadwal-c);
  mask-image: var(--jadwal-c), var(--jadwal-c), var(--jadwal-c), var(--jadwal-c);
  -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
  -webkit-mask-position: top left, top right, bottom right, bottom left;
  mask-position: top left, top right, bottom right, bottom left;
  -webkit-mask-size: var(--jadwal-corner) var(--jadwal-corner);
  mask-size: var(--jadwal-corner) var(--jadwal-corner);
}
```

No `animation` on `.jadwal-mount`. The `jadwal-in` keyframe stays exclusive to `.quran-jadwal`, and must be added to a `prefers-reduced-motion` block (it is currently the only animation in the file with no reduced-motion coverage):

```css
@media (prefers-reduced-motion: reduce) {
  .quran-jadwal { animation: none; }
}
```

### 2.2 Where it MAY NOT appear — exhaustive

1. **At most one jadwal per rendered frame.** `.quran-jadwal`, `.jadwal-frame` and `.jadwal-mount` are mutually exclusive on screen. HeroAmbient only renders on first run, when no mushaf page exists; HeroContinue only renders on `/`, which has no mushaf page.
2. Never on `HeroMushaf` or `HeroCompact`. HeroMushaf sits directly above the real jadwal — two frames in one viewport makes the mushaf's frame ordinary.
3. Never on a list row, card, chip, button, toast, sheet, modal, tooltip, empty state, error state, badge or skeleton.
4. Never around a video thumbnail other than HeroContinue's single art plate. Never on `RailPoster`/`GridMedia` items, `LocalThumbnail`, `PlaylistPoster`.
5. Never around a live video or audio surface — `VideoPlayer`, `PlayerPage`, `PlayerDocked`, `PlayerExpanded`, `RadioMiniPlayer`. A frame that is static around moving content reads as chrome; a frame that responds reads as decoration, and both are wrong.
6. Never nested inside another jadwal.
7. Never on an element that scrolls its own content. The frame is a page margin, not a content border — that is why `.quran-jadwal` is a sibling of `.quran-reading-viewport` and not a child (`Quran.tsx:1221-1223`).
8. Never on the Basmala's `mark` size. At 32-46px tall the corners land inside the letterforms' optical field and read as clipping.
9. Never given `border-radius`. It is square by construction; rounding it turns it back into a card with a doubled border.
10. Never recoloured off `--hero-accent-rgb`. It takes `--mushaf-gold-rgb`, which is deliberately theme-fixed at `224 190 116` (`index.css:82`) with Pearl's bronze `158 118 40` (`:155`) the only override — the print-mushaf convention, so the frame never turns cyan in Samaa.

### 2.3 The mihrab arch

`.hero-arch` (`index.css:1604-1618`) survives with its comment intact — "used exactly once in the whole application" — and that one use becomes `HeroAmbient`. It is forbidden on HeroContinue, HeroMushaf, HeroCompact and everywhere else.

---

## 3. The Basmala relocation

`src/components/marks/BasmalaPlate.tsx`:

```ts
export interface BasmalaPlateProps {
  /**
   * 'plate' — HeroAmbient. The subject of the screen. Full width of its column,
   *           the نور mark under it, nothing overlapping.
   * 'mark'  — Dashboard, top-aligned, in a band of its own. Smaller, still
   *           complete, still the only thing on its line.
   */
  size: 'plate' | 'mark';
  /** Accessible label. Defaults to BASMALA_TEXT + t('heroBasmalaMeaning'). */
  label?: string;
}
```

Implementation: the same `basmalaSvg` raw import and `role="img"` + `aria-label` pattern as `Hero.tsx:70-75`. The inline `<svg>` keeps `aria-hidden="true" focusable="false"` (already in the file), so assistive tech reads the label and never the paths.

### Rules encoded in the component, not left to call sites

- **Complete and unclipped.** `overflow: visible` on the `svg`; the `viewBox` is `23 -1029 11476 1682` with `preserveAspectRatio="xMidYMid meet"`, so no width can crop it. No ancestor of `.hero-basmala` may set `overflow: hidden`, `clip-path`, `mask`, `text-overflow` or a fixed `height`.
- **Full size for its position, never a fragment.** Height is derived from `--basmala-ratio`, never authored.
- **Static.** No `transition`, no `animation`, no `transform` on `.hero-basmala` or any ancestor. Not covered by `page-enter` — `.page-container`'s fade is on the container, which is correct (opacity on an ancestor is not an animation of the glyph), but no per-element fade, no stagger, no `--i` delay, no `view-transition-name`.
- **Never behind a control.** The band is `position: relative; z-index: 0` and contains nothing else. No hero action, no chip, no scrim, no gradient overlaps its box. Asserted in §11.
- **No glow on the glyph.** `filter`, `text-shadow`, `drop-shadow`, `box-shadow` are forbidden on `.hero-basmala` and on the `svg`. Warm light lives in the ground layer behind it, exactly as `Hero.tsx:22-25` already documents.
- **Colour.** `.basmala-stroke { fill: rgb(var(--text-main-rgb)) }`, `.basmala-harakat { fill: rgb(var(--hero-accent-rgb)) }` at full opacity. This is the only change to the existing rules at `index.css:1691-1699` — the harakat move from `--accent-gold-rgb` to the hero seed.

### The `mark` band on the Dashboard

```html
<div class="basmala-band">
  <div class="hero-basmala hero-basmala-mark" role="img" aria-label="…">…</div>
</div>
```

```css
.basmala-band {
  position: relative;
  z-index: 0;
  display: flex;
  justify-content: center;
  margin-bottom: 18px;
}
.hero-basmala-mark {
  width: var(--basmala-mark-w);
  margin: 0;
}
```

Measured band height: 32px + 18px = **50px** at 1280×800; 46px + 18px = **64px** at 1920×1080.

---

## 4. HeroContinue — Dashboard default

### 4.1 Props

```ts
export interface HeroContinueLesson {
  videoId: string;
  playlistId: string | null;
  /** Raw user data. Always rendered inside <bdi>. */
  title: string;
  /** Video.speaker (types/index.ts:24). Never invented; null renders no slot. */
  speaker: string | null;
  /** Playlist name, else the folder leaf. Same derivation as ContinueWatching.tsx:72. */
  collection: string | null;
  thumbnailPath: string | null;
  progressSeconds: number;
  durationSeconds: number;
  /** Items in the same collection minus this one. Renders as "+N", never a list. */
  siblingCount: number;
}

export interface HeroContinueProps {
  phase: HeroPhase;
  /** Non-null iff phase === 'ready'. */
  lesson: HeroContinueLesson | null;
  onResume: (lesson: HeroContinueLesson) => void;
  /** Present in every phase, every state. The mushaf is always one click away. */
  onOpenMushaf: () => void;
  /** empty phase primary. Wire to the same importFolder path QuickActions.tsx:21 uses. */
  onImportFolder: () => void;
  importing?: boolean;
  onError?: (error: unknown) => void;
  className?: string;
}
```

### 4.2 DOM

```html
<section class="hero-lesson" aria-labelledby="hero-lesson-title">
  <div class="hero-lesson-art">              <!-- decorative; not a control -->
    <img|LocalThumbnail class="hero-lesson-img" />
    <span class="hero-lesson-wash" aria-hidden="true"></span>
    <span class="jadwal-mount" aria-hidden="true"></span>
  </div>

  <div class="hero-lesson-body">
    <p class="{eyebrow}">{t('heroContinueEyebrow')}</p>
    <h1 id="hero-lesson-title" class="hero-lesson-title"><bdi>{title}</bdi></h1>
    <p class="hero-lesson-meta">
      <bdi>{speaker}</bdi><span aria-hidden="true"> · </span>
      <bdi>{collection}</bdi>{siblingCount > 0 && <span class="text-text-faint"> · <bdi class="tabular-nums">+{n}</bdi></span>}
    </p>
    <div class="hero-lesson-meter" role="presentation">
      <div style="width:{percent}%"></div>
    </div>
    <p class="hero-lesson-figures">
      <span class="tabular-nums"><bdi>{round(percent)}%</bdi></span>
      <span dir="ltr" class="tabular-nums text-text-faint">{formatTime(progress)} / {formatTime(duration)}</span>
    </p>
    <div class="hero-lesson-actions">
      <HeroActionButton rank="primary"   labelKey="heroResume"      trailing={formatDuration(remaining, language)} testId="hero-continue-resume" />
      <HeroActionButton rank="secondary" labelKey="heroOpenMushaf"  testId="hero-continue-mushaf" />
    </div>
  </div>
</section>
```

`h1` here is the page's only `<h1>` — the deleted masthead had it. `<bdi>` is mandatory on `title`, `speaker`, `collection`: all three are user data and all three can be Arabic.

### 4.3 Layout and tokens

```css
.hero-lesson {
  display: grid;
  grid-template-columns:
    calc((var(--hero-continue-h) - 2 * var(--hero-plate-inset)) * 16 / 9)
    minmax(0, 1fr);
  gap: var(--s6);
  height: var(--hero-continue-h);
  padding: var(--hero-plate-inset);
  border: 1px solid transparent;
  background: var(--fill-2) padding-box, var(--edge-2) border-box;
  box-shadow: var(--elev-2);
  border-radius: var(--r-lg);
  overflow: hidden;
}

/* Below a ~720px content column the art cannot be shown without starving the
   title. It is DROPPED, never stacked — stacking doubles the band height and
   breaks the budget at the 900×600 minimum window. */
@media (max-width: 1023px) {
  .hero-lesson { grid-template-columns: minmax(0, 1fr); }
  .hero-lesson-art { display: none; }
}

.hero-lesson-art {
  position: relative;
  height: 100%;
  border-radius: var(--r-md);
  overflow: hidden;
  background: var(--fill-well);
}
.hero-lesson-img { width: 100%; height: 100%; object-fit: cover; }
.hero-lesson-wash {
  position: absolute; inset: 0; pointer-events: none;
  background:
    linear-gradient(200deg, rgb(var(--hero-accent-rgb) / 0.07), transparent 58%),
    linear-gradient(to bottom, transparent 52%, rgb(var(--bg-main-rgb) / 0.42));
}
.hero-lesson-body { display: flex; flex-direction: column; justify-content: center; min-width: 0; }
.hero-lesson-title { font-size: var(--fs-xl); line-height: 1.28; font-weight: 600;
  color: rgb(var(--text-main-rgb));
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.hero-lesson-meter { height: 3px; border-radius: 999px; background: rgb(var(--text-muted-rgb) / 0.18); }
.hero-lesson-meter > div { height: 100%; border-radius: 999px; background: rgb(var(--hero-accent-rgb)); }
```

The meter's `transition: width` from `ContinueWatching.tsx:248` is **dropped**. A hero's progress rail animating from 0 on every mount reads as a loading bar.

The art column width is derived, never authored: at `--hero-continue-h: 240px` the track is `(240−40)×16/9 = 355.6px`; at `296px`, `455.1px`. Exactly 16:9, no letterbox, no magic number.

### 4.4 Empty state (`phase === 'empty'`)

Same `.hero-lesson` box, **same height** — no reflow between phases.

- Art plate: the `<img>` is replaced by generated geometry — the same construction `PlaylistArt` (`PlaylistCard.tsx:257-321`) uses, seeded from a constant. Not `LocalThumbnail`'s `.icon-medallion`: both Dashboard components already define `QUIET_FALLBACK` purely to suppress it (`ContinueWatching.tsx:15`, `RecentlyAdded.tsx:15`), which is the codebase telling you the medallion is unwanted. `.jadwal-mount` stays.
- Eyebrow: `t('heroFirstLessonEyebrow')`. Title: `t('heroNoLessonTitle')`. Meta line, meter and figures row: not rendered; the freed 38px goes to symmetric padding via `justify-content: center`.
- Actions: primary `heroImportFolder` → `onImportFolder` (with `busy={importing}`), secondary `heroOpenMushaf`.

### 4.5 Loading state

`<HeroSkeleton shape="continue" />`: one `.skeleton` block at the art track's exact width, then in the body column three `.skeleton` bars at 96px/70%/40% width and the real line heights (17/70/21), plus a 3px bar and two 43px-tall pill blocks. Height is `var(--hero-continue-h)`. CLS = 0.

### 4.6 What mounts it

`Dashboard.tsx` becomes: `<BasmalaPlate size="mark" />` → `<HeroContinue />` → `<ContinueWatching />` (now the `QueueRow` rail only, no `FeatureCard`) → the glance section → `RecentlyAdded` + reminders. `QuickActions` is absorbed: its import primary becomes the hero's empty-phase action, its two `.quiet-action`s move into the glance section's `SectionHeader` action slot.

**One canonical resume source.** The Dashboard reads `get_continue_watching` (limit 20); Library recomputes from `playlists`. HeroContinue takes the first item of `get_continue_watching` and nothing else, and Library's recomputation is left alone (it is a different question: which playlist, not which lesson).

---

## 5. HeroMushaf — the `/quran` landing

### 5.1 Props, with the Hafs-only guarantee made unrepresentable

```ts
/**
 * A resume instruction. The Warsh arm has NO timing field — not `null`, not
 * optional, absent. Recitation timing data is Hafs-only, so a Warsh resume
 * that carries a timing read cannot be constructed, cannot be passed, and
 * cannot be forgotten in a code review.
 */
export type MushafResume =
  | { riwayah: 'hafs'; surahId: number; ayahId: number; timingReadId: string | null }
  | { riwayah: 'warsh'; surahId: number; ayahId: number };

export interface HeroMushafProps {
  phase: HeroPhase;
  riwayah: QuranRiwayah;
  /**
   * Already riwayah-scoped by the store: `setRiwayah` re-reads it from
   * lastReadKey(riwayah) (quranStore.ts:217). The hero MUST NOT copy it into
   * local state, and every memo over it MUST include `riwayah` in its deps —
   * otherwise a Hafs ayah number survives a switch to Warsh, where the Madani
   * numbering makes it a different ayah.
   */
  lastRead: QuranBookmark | null;
  /** Resolved from `surahs` for the ACTIVE riwayah. null while the index loads. */
  lastReadSurah: SurahMeta | null;
  /** Hafs only. MUST be null when riwayah === 'warsh'. */
  timingRead: { id: string; name: string; nameAr?: string } | null;
  onResume: (resume: MushafResume) => void;
  onOpenFatihah: () => void;
  onChangeRiwayah: (next: QuranRiwayah) => void;
  className?: string;
}
```

### 5.2 The Warsh guard, concretely

```ts
// HeroMushaf.tsx
const resume = (): MushafResume =>
  riwayah === 'warsh'
    ? { riwayah: 'warsh', surahId: lastRead!.surahId, ayahId: lastRead!.verseId }
    : { riwayah: 'hafs',  surahId: lastRead!.surahId, ayahId: lastRead!.verseId,
        timingReadId: timingRead?.id ?? null };
```

Plus, in dev, one assertion at the top of render:

```ts
if (import.meta.env.DEV && riwayah === 'warsh' && timingRead !== null) {
  throw new Error('HeroMushaf: timingRead supplied under Warsh — timing data is Hafs-only.');
}
```

**HeroMushaf never calls `loadSyncedAudio`, `selectTimingRead`, `playStation` or `togglePlay`.** It hands a `MushafResume` up; `Quran.tsx` decides. This is the whole mechanism by which the hero cannot point word-sync at a Warsh ayah: it has no access to the sync engine.

The reciter/timing chip renders **only** when `riwayah === 'hafs' && timingRead`. Under Warsh that slot renders static text `t('quranWarshNoTiming')` in `text-text-faint` — not a control, no `onClick`, no `tabIndex`.

### 5.3 DOM

```html
<section class="hero-mushaf" aria-labelledby="hero-mushaf-title" data-ambient-ceiling="1">
  <div class="hero-mushaf-lead">
    <p class="{eyebrow}">{t('quranPill')}</p>
    <h1 id="hero-mushaf-title" class="hero-mushaf-title">{t('quranTitle')}</h1>
    <p class="hero-mushaf-last">
      <!-- ready + lastRead -->
      {t('quranContinue')} <span class="hero-mushaf-ref">
        <bdi>{language === 'ar' ? surah.name : surah.transliteration}</bdi>
        <span dir="ltr" class="tabular-nums">{t('quranAyah')} {lastRead.verseId}</span>
      </span>
      <!-- ready, no lastRead -->
      {t('heroMushafStartAtFatihah')}
    </p>
  </div>

  <div class="hero-mushaf-side">
    <span class="hero-mushaf-badge">{t(riwayah === 'warsh' ? 'quranRiwayahWarsh' : 'quranRiwayahHafs')}</span>
    {riwayah === 'hafs' && timingRead
      ? <span class="hero-mushaf-read"><bdi>{language==='ar' ? timingRead.nameAr ?? timingRead.name : timingRead.name}</bdi></span>
      : <span class="hero-mushaf-read hero-mushaf-read-off">{t('quranWarshNoTiming')}</span>}
    <div class="hero-mushaf-actions">
      <HeroActionButton rank="primary" labelKey={lastRead ? 'heroResume' : 'heroOpenFatihah'} testId="hero-mushaf-resume" />
      <div class="segmented" role="group" aria-label={t('quranRiwayah')}>
        <button aria-pressed={riwayah==='hafs'}  onClick={() => onChangeRiwayah('hafs')}>{t('quranRiwayahHafs')}</button>
        <button aria-pressed={riwayah==='warsh'} onClick={() => onChangeRiwayah('warsh')}>{t('quranRiwayahWarsh')}</button>
      </div>
    </div>
  </div>
</section>
```

`.segmented` is the existing primitive (`index.css:1165-1203`), identical to the toolbar's own riwayah control at `Quran.tsx:1100-1107`. Both readings stay legible at all times — which riwayah is on screen is a correctness question, never a hidden setting.

### 5.4 Static ground — the lock

```css
.hero-mushaf {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--s6);
  align-items: center;
  height: var(--hero-mushaf-h);
  padding: var(--hero-pad-block) var(--hero-pad-inline);
  border-radius: var(--r-lg);
  /* Tier 1 by construction: two stops from the theme's own ground, plus one
     static key light. No transform, no opacity keyframe, no canvas, no
     backdrop-filter. It cannot animate because there is nothing to animate. */
  background:
    radial-gradient(78% 120% at 18% -20%, rgb(var(--mushaf-gold-rgb) / 0.055), transparent 66%),
    linear-gradient(177deg, rgb(var(--bg-card-rgb)), rgb(var(--bg-panel-rgb)));
  border-bottom: 1px solid rgb(var(--mushaf-gold-rgb) / 0.22);
}
.hero-mushaf-badge {
  font-size: var(--fs-cap);
  padding: 2px 10px;
  border: 1px solid rgb(var(--mushaf-gold-rgb) / 0.38);
  border-radius: 999px;
  color: rgb(var(--mushaf-gold-rgb));
}
```

`data-ambient-ceiling="1"` on the section, and the same attribute on `/quran`'s route root. `<AmbientLayer/>`'s tier resolution becomes `min(themeDefault, deviceCapability, userPreference, routeCeiling)` where `routeCeiling` is read from the nearest `[data-ambient-ceiling]` ancestor. `/quran` publishes `0` on the reading pane's own container and `1` on the route; every other route publishes nothing. This is the interface between this spec and the ambient spec — neither needs to know the other's internals.

**No animation may touch `.quran-reading-surface`, `.quran-reading-viewport`, `.quran-reading-frame` or any ancestor of them.** No `view-transition-name`, no `transform` on an ancestor, no `will-change`. `positionWordCue` (`Quran.tsx:458-473`) derives the cue's transform from `getBoundingClientRect()` deltas; a transform on an ancestor changes what those return mid-frame and desynchronises the cue from the spoken word.

### 5.5 The 37px the hero costs the reading pane

At 1280×800 the route chrome above the mushaf becomes `24 (page pad) + 136 (hero) + 20 + 41 (tabs) + 20 = 241px` in a 764px frame. `.quran-reading-viewport`'s `max-height: 70vh` = 560px, so the frame would overflow by 37px. Change one line at `index.css:835`:

```css
.quran-reading-viewport {
  /* 22rem is the route chrome above the page: hero + tabs + page padding. */
  max-height: min(70vh, calc(100vh - 22rem));
  min-height: 19rem;
  overflow-y: auto;
  overscroll-behavior: contain;
}
```

This is safe and is **not** one of the load-bearing invariants. Those are: `.quran-reading-surface` keeps `overflow: visible` and `border: none`, and the scroller stays one level up at `.quran-reading-viewport` so both rects move together. Changing the scroller's *max-height* does not move the scroller. Do not change `overflow`, `border` or the element the scroller lives on.

### 5.6 Empty / loading

- `phase === 'ready'`, `lastRead === null`: badge and actions unchanged; the last-read line becomes `t('heroMushafStartAtFatihah')` and the primary becomes `heroOpenFatihah` → `onOpenFatihah()` → `openSurah(1)`.
- `lastRead` present but `lastReadSurah === null` (index still loading for this riwayah): render the last-read line as a 21px `.skeleton` bar, keep the primary **disabled**. Never render a surah number without its name, and never resume into a surah the active riwayah's index has not confirmed.
- `phase === 'loading'`: `<HeroSkeleton shape="mushaf" />` at `var(--hero-mushaf-h)`.

---

## 6. HeroAmbient — first run only

### 6.1 Props

```ts
/**
 * The one line. If it is ever a narration rather than product copy it must
 * carry its source — book and number — so the type makes the source
 * non-optional on that arm.
 */
export type HeroAmbientLine =
  | { kind: 'plain'; textKey: TranslationKey }
  | { kind: 'narration'; textKey: TranslationKey; sourceKey: TranslationKey };

export interface HeroAmbientProps {
  line: HeroAmbientLine;
  /** Exactly one. First run offers one thing to do. */
  action: HeroAction;
  /**
   * Ground fidelity ceiling. HeroAmbient accepts 0 or 1 and nothing else —
   * the screen whose subject is the Basmala does not get a moving background.
   */
  ground?: 0 | 1;
}
```

Ships as `{ kind: 'plain', textKey: 'heroAmbientLine' }`. The `narration` arm exists so that adding one later cannot skip the attribution.

### 6.2 First-run detection and mounting

`Dashboard.tsx`:

```ts
const settings = useSettingsStore((s) => s.settings);
const stats = useAppStore((s) => s.stats);
const firstRun =
  settings !== null && settings.importedFolders.length === 0 && (stats?.totalVideos ?? 0) === 0;
```

When `firstRun`, `Dashboard` renders `<HeroAmbient/>` **alone** — no `BasmalaPlate size="mark"`, no `HeroContinue`, no `ContinueWatching`, no glance section, no `RecentlyAdded`, no reminders panel. Today first launch lands on three simultaneous empty states with the import CTA below a 416px hero. This replaces all of it with one screen.

It is not dismissible. Completing the action (importing a folder) makes `firstRun` false and the Dashboard renders normally on the next state tick. There is no "skip", no localStorage flag, no second visit.

### 6.3 DOM

```html
<section class="hero-ambient">
  <div class="hero-ambient-ground" aria-hidden="true"></div>
  <div class="hero-arch" aria-hidden="true"></div>
  <div class="hero-ambient-inner">
    <div class="jadwal-frame" aria-hidden="true"></div>
    <BasmalaPlate size="plate" />
    <NoorMark />
    <h1 class="hero-wordmark">{language === 'ar' ? 'سلفي هَب' : <span class="hero-wordmark-latin">Salafi Hub</span>}</h1>
    <p class="hero-ambient-line">{t(line.textKey)}</p>
    {line.kind === 'narration' && <p class="hero-ambient-source">{t(line.sourceKey)}</p>}
    <HeroActionButton rank="primary" {...action} />
  </div>
</section>
```

```css
.hero-ambient {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 100%;
  isolation: isolate;
  border-radius: var(--r-lg);
  overflow: hidden;
}
.hero-ambient-ground {
  position: absolute; inset: 0; z-index: 0;
  background:
    radial-gradient(118% 96% at 42% 30%, transparent 26%,
      rgb(var(--bg-main-rgb) / 0.55) 72%, rgb(var(--bg-main-rgb) / 0.92) 100%),
    radial-gradient(58% 46% at 34% 20%, rgb(var(--hero-accent-rgb) / 0.24), transparent 74%),
    linear-gradient(168deg, rgb(var(--bg-card-hover-rgb)) 0%,
      rgb(var(--bg-card-rgb)) 34%, rgb(var(--bg-main-rgb)) 82%);
}
.hero-ambient-inner {
  position: relative; z-index: 3;
  max-width: 46rem; padding: var(--s7) var(--s6);
  text-align: center;
}
.hero-ambient-line { margin: 0 auto var(--s5); max-width: 42ch;
  font-size: var(--fs-base); color: rgb(var(--text-muted-rgb)); }
.hero-ambient-source { margin: calc(var(--s4) * -1) auto var(--s5);
  font-size: var(--fs-cap); color: rgb(var(--text-faint-rgb)); }
```

The ground keeps `.hero-ground`'s construction (procedural, generated, no bundled photograph, no depiction by construction) minus the three `.hero-scene` bands and `.hero-girih` — those cost three extra masked layers to produce depth that the arch and the vignette already carry, and they are the layers the audit found reading as pattern rather than depth.

`.jadwal-frame` is inset `1.25rem` inside `.hero-ambient-inner` and does not overlap the Basmala's box: `.hero-ambient-inner` has `padding: var(--s7) var(--s6)` = 56px/36px, and the frame sits at 20px, so there is 36px of clearance vertically and 16px horizontally between the frame's inner rule and the mark. Assert it (§11).

### 6.4 No empty, no loading

HeroAmbient **is** the app's empty state. It has no `phase`. It renders only when `settings !== null`, so there is no flash of it during settings load — before that the Dashboard renders `<HeroSkeleton shape="continue" />`.

---

## 7. HeroCompact — the 180px band

### 7.1 Props

```ts
export interface HeroCompactMetric {
  labelKey: TranslationKey;
  /** Pre-formatted AND bidi-isolated by the caller (formatBytes/formatDuration). */
  value: string;
}

export interface HeroCompactProps {
  eyebrowKey: TranslationKey;
  eyebrowIcon?: LucideIcon;
  titleKey: TranslationKey;
  /** Optional one-line subtitle. Omit rather than pad. */
  subtitleKey?: TranslationKey;
  /** At most one. A second action belongs in the route body, not the band. */
  action?: HeroAction;
  /** At most three. A caption row on a hairline — never tiles, never a chart. */
  metrics?: HeroCompactMetric[];
  /** A trailing control (a checkbox, a filter). Never artwork, never an image. */
  aside?: React.ReactNode;
  className?: string;
}
```

`metrics.length > 3` throws in DEV. There is no `artwork` prop and no `children`; the band carries no image by contract.

### 7.2 DOM and the 180px

```html
<header class="hero-compact">
  <div class="hero-compact-lead">
    <p class="{eyebrow}">{icon}{t(eyebrowKey)}</p>
    <h1 class="hero-compact-title">{t(titleKey)}</h1>
    {subtitleKey && <p class="hero-compact-sub">{t(subtitleKey)}</p>}
  </div>
  <div class="hero-compact-side">{action && <HeroActionButton …/>}{aside}</div>
  {metrics && <dl class="hero-compact-metrics">…</dl>}
</header>
```

```css
.hero-compact {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: 1fr auto;
  align-items: end;
  column-gap: var(--s6);
  min-height: var(--hero-compact-h);
  padding-block: var(--s5) 0;
}
.hero-compact-title { font-size: var(--fs-2xl); line-height: 1.14;
  letter-spacing: var(--tr-2xl); font-weight: 600; color: rgb(var(--text-main-rgb)); }
.hero-compact-metrics {
  grid-column: 1 / -1;
  display: flex; margin-top: var(--s5);
  border-top: 1px solid rgb(var(--hair-rgb) / 0.13);
  padding-top: var(--s3);
}
.hero-compact-metrics > div { flex: 1 1 0; min-width: 0; }
.hero-compact-metrics > div + div { border-inline-start: 1px solid rgb(var(--hair-rgb) / 0.13); padding-inline-start: var(--s5); }
```

Vertical accounting at 1280×800 (`--hero-compact-h: 180px`): 24 pad-top + 17 eyebrow + 12 + 43 title + 10 + 24 subtitle + 20 + 1 rule + 12 + 17 metrics = **180**. The `1fr` lead row absorbs the difference when `subtitleKey` or `metrics` is omitted, so the band is 180 regardless of which optional slots are filled — that is the whole point of a fixed band.

`--tr-2xl` is zeroed under `html[data-language='ar']` by the global rule at `index.css:597`; the title is 3px shorter in Arabic and the band does not move.

### 7.3 Six call sites

| Route | eyebrowKey | titleKey | action | metrics |
|---|---|---|---|---|
| `/library` | `localOnlyIslamicLibrary` | `library` | `importFolder` | the existing 4-stat `<dl>` from `Library.tsx:404-420` |
| `/watch` | `watchAdFreePill` | `watchTitle` | — (the search field is the page) | — |
| `/radio` | existing pill key | `radioTitle` | — | station count |
| `/downloads` | existing pill key | `downloadsTitle` | — | queue / done |
| `/reminders` | `navReminders` | `remindersTitle` | `createReminder` | the 3 `ReminderMetric`s from `Reminders.tsx:279-295` |
| `/settings` | existing pill key | `settings` | — | — |

The `aside` slot takes Library's `scanSubfoldersRecursively` checkbox (`Library.tsx:400-411`).

**No empty state.** HeroCompact carries no data of its own; `metrics` simply renders nothing when undefined and the band height is unchanged. **No loading state** for the band itself; if a `metric.value` is not yet known the caller passes a `metrics` array of `undefined` and the row is absent — never a skeleton inside a 180px band, which would flicker on every route entry.

---

## 8. The ten themes — zero per-theme component code

### 8.1 Surface profiles, wired once

In `App.tsx`, beside `root.dataset.theme` (`:47`):

```ts
const SURFACE_PROFILE: Record<AppTheme, 'light' | 'pure-black' | 'warm' | 'cool'> = {
  pearl: 'light',
  onyx: 'pure-black',
  maktabah: 'warm', 'mushaf-gold': 'warm', emerald: 'warm', mushaf: 'warm', red: 'warm',
  samaa: 'cool', blue: 'cool', noor: 'cool',
};
root.dataset.surface = SURFACE_PROFILE[theme];
```

Four blocks in `index.css` retune existing tokens. No hero component reads the theme or the profile.

```css
html[data-surface='light'] {
  --elev-1: 0 0 0 1px rgb(var(--hair-rgb) / 0.20);
  --elev-2: 0 0 0 1px rgb(var(--hair-rgb) / 0.26);
  --elev-3: 0 0 0 1px rgb(var(--hair-rgb) / 0.34);
}
html[data-surface='pure-black'] {
  --elev-1: none; --elev-2: none; --elev-3: none;
  --hair-faint: rgb(var(--hair-rgb) / 0.05);
  --hair: rgb(var(--hair-rgb) / 0.10);
}
html[data-surface='warm'] { --r-md: 8px; --r-lg: 12px; --r-xl: 16px; }
html[data-surface='cool'] { /* glass opacity + backdrop prominence live here */ }
```

### 8.2 Behaviour table

| Theme | Profile | HeroContinue | HeroMushaf | HeroAmbient | HeroCompact |
|---|---|---|---|---|---|
| noor | cool | `--fill-2` + `--edge-2`; elevation as ladder | gold badge on `--mushaf-gold-rgb 224 190 116` | full ground + arch | flat, hairline metrics |
| emerald | warm | radii +1 step (`--r-lg` 12px) | " | " | " |
| pearl | light | **shadows → 1px rings**; the plate's `--fill-well` is the only value step available; `--sheen-rgb: 255 255 255` already inverts the highlight | badge takes Pearl's bronze `158 118 40` (`index.css:155`) | ground vignette held very low — anything heavier reads as dirt on paper | metric rules carry the hierarchy |
| mushaf | warm | radii +1 | " | " | " |
| blue | cool | — | " | " | " |
| red | warm | radii +1 | " | " | " |
| onyx | pure-black | **no `box-shadow` at all**; the border is the entire edge; hairlines drop to 0.10/0.05 | " | ground's linear stop collapses to near-flat by construction (`--bg-card` ≈ `--bg-main`) | " |
| mushaf-gold | warm | radii +1 | " | " | " |
| maktabah | warm | radii +1 | " | " | " |
| samaa | cool | — | badge stays warm gold, not cyan — that is the point of `--mushaf-gold-rgb` being theme-fixed | " | " |

### 8.3 The accent problem, addressed in scope

`--hair-rgb: var(--accent-gold-rgb)`; eight of ten themes resolve gold, and `blue` and `red` resolve the byte-identical `226 197 122`. This spec does not fix that — it makes it fixable. Every hero's interactive colour goes through `--hero-accent-rgb`, declared once. A later phase differentiates by adding one line per theme:

```css
html[data-theme='blue'] { --hero-accent-rgb: var(--accent-blue-rgb); }
```

No hero component changes. Today `--hero-accent-rgb` resolves to `--accent-gold-rgb`, so behaviour is byte-identical to current and the change is purely structural.

---

## 9. RTL

**The app's layout direction is pinned to `ltr` at the root.** `App.tsx:44-46` sets `root.dir = 'ltr'` unconditionally with a comment: switching to Arabic translates the text but never moves sidebars, buttons or alignment. Heroes must therefore be built so that:

1. **No hero uses a physical side.** `ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`/`border-s`/`border-e`/`inset-inline-*` only. No `pl-`, `pr-`, `left`, `right`, `text-left`, `border-l`. This costs nothing today and makes lifting the pin a one-line change.
2. **No hero branches on `language` for a directional decision.** `Dashboard.tsx:126-132` currently picks `270deg` vs `90deg` for its thread from `language === 'ar'` — the wrong signal, because direction is pinned. Heroes express directional gradients as one declaration plus a `[dir='rtl']` override in CSS, exactly as `.rule-row:hover` / `[dir='rtl'] .rule-row:hover` (`index.css:1796-1804`) already do.
3. **Every user-data string is in `<bdi>`.** `title`, `speaker`, `collection`, `surah.name`, `surah.transliteration`, `timingRead.name` — all can be Arabic and all sit next to Latin numerals.
4. **Composed strings are never concatenated into one text node.** `"12m left"` and `"١٢د متبقٍ"` reorder differently. `formatDuration` already wraps in U+2067 (RLI) for Arabic and U+2066 (LRI) for Latin — `HeroAction.trailing` must be its output, never a template literal. Getting the isolate backwards is what shipped `1س 0د` as `1د0 س`.
5. **Time pairs stay in one LTR run.** `{formatTime(a)} / {formatTime(b)}` goes in a single `<span dir="ltr">`. Two `<bdi>`s either side of a neutral slash swap places and report the wrong time — the fix already documented at `ContinueWatching.tsx:256-258`.
6. **No hero uses `letter-spacing` for hierarchy.** `html[data-language='ar'] *:not(.hero-wordmark-latin)` zeroes it globally. All four heroes take the eyebrow from the single `useEyebrowClass()` hook, which is Latin-tracked and Arabic-untracked, and never re-derive it inline.
7. **Arabic leading.** `h1`, `h2`, `h3`, `p` get `--lh-arabic` (1.85) under `html[data-language='ar']` (`index.css:625-632`). Every hero's height budget in §11 is verified at both languages; `.hero-lesson-title`'s `-webkit-line-clamp: 2` holds it regardless, and `.hero-compact`'s `1fr` lead row absorbs the difference.
8. **The Basmala and the نور mark are exempt from Arabic leading** by the existing rule at `index.css:638-639`. Do not remove it; the SVG boxes would gain 85% of their height.

---

## 10. Keyboard and assistive tech

| | Tab stops (in order) | Notes |
|---|---|---|
| **HeroContinue** ready | Resume → Open the Mushaf | The art plate is a `<div>`, not focusable, `aria-hidden` on its wash and mount. The section is *not* a button. |
| **HeroContinue** empty | Import folder → Open the Mushaf | Same count, same order — tab order does not change with phase. |
| **HeroContinue** loading | none | The skeleton has `aria-hidden="true"`; the section carries `aria-busy="true"`. |
| **HeroMushaf** | Resume → riwayah group (**one** stop) | The `.segmented` group is a roving-tabindex composite: the pressed button has `tabIndex={0}`, the other `-1`; `ArrowLeft`/`ArrowRight`/`Home`/`End` move focus **and** activate (it is a two-option toggle, so follow-focus is correct). `aria-pressed` on both, never `aria-selected`. |
| **HeroAmbient** | the single action | On mount, `if (document.activeElement === document.body) ref.current?.focus({ preventScroll: true })`. Guarded so it never steals focus from a user who already tabbed. |
| **HeroCompact** | action (if present) → `aside` contents | |

Shared:

- `:focus-visible` is `box-shadow: var(--ring-focus)` — the existing two-tone Windows ring (`index.css:583-585`). No hero declares a ring of its own.
- Exactly one `<h1>` per route, and it is the hero's.
- Landmarks: `HeroCompact` is `<header>`; `HeroContinue`/`HeroMushaf`/`HeroAmbient` are `<section aria-labelledby>` pointing at their `h1`.
- The Basmala is `role="img"` + `aria-label` on the wrapper, with `aria-hidden="true" focusable="false"` on the inline `<svg>` — the paths are never read out.
- The progress meter is `role="presentation"`; the figures beneath it are the accessible value. A `role="progressbar"` on a resume rail announces "loading" to a screen reader, which is wrong.
- No hero traps focus, opens a dialog, or handles `Escape`.
- No hero registers a global key handler. Ctrl-K belongs to `CommandPalette`.

---

## 11. Measured height budget and acceptance tests

Frame heights are the `<main>` client height: window height − 36px `TitleBar` (`h-9`). Confirmed by `design-audit/probe.json`: 764 at 1280×800, 1044 at 1920×1080.

### 11.1 Budget

| Block | 1280×800 (frame 764) | share | 1920×1080 (frame 1044) | share | 900×600 (frame 564) | share |
|---|---|---|---|---|---|---|
| Basmala band (`mark`) | 50px | 6.5% | 64px | 6.1% | 46px | 8.2% |
| **HeroContinue** | **240px** | **31.4%** | **296px** | **28.4%** | **208px** | **36.9%** |
| **HeroMushaf** | **136px** | **17.8%** | **168px** | **16.1%** | **132px** | **23.4%** |
| **HeroCompact** | **180px** | **23.6%** | **180px** | **17.2%** | **148px** | **26.2%** |
| **HeroAmbient** | 716px | 93.7% | 996px | 95.4% | 516px | 91.5% |

`--hero-continue-h: clamp(13rem, 30vh, 18.5rem)` → 30vh of 800 = 240; of 1080 = 324, clamped to 296; of 600 = 180, clamped up to 208.
`--hero-mushaf-h: clamp(8.25rem, 17vh, 10.5rem)` → 136 / 168 (17vh of 1080 = 183.6, clamped) / 132.
`--hero-compact-h`: 180 fixed, 148 under `@media (max-height: 720px)`.

Art track width, derived: `(240−40)×16/9 = 355.6px`; `(296−40)×16/9 = 455.1px`. Exactly 16:9.

### 11.2 Dashboard — where the first section heading lands

| | before | after |
|---|---|---|
| 1280×800 | 674px (`probe.json`) | **346px** = 24 pad + 50 basmala + 240 hero + 32 gap |
| 1920×1080 | 802px | **420px** = 24 + 64 + 296 + 36 |
| hero share of frame | 0.545 / 0.521 | **0.314 / 0.284** |

And the first *useful* pixel — a lesson title with a resume button attached — moves from y=674 to y=74.

### 11.3 Harness assertions

Add `scripts/harness/assert-heroes.mjs`, run over all 10 themes × 2 languages × 2 viewports (40 combinations), reusing `stub-tauri.js` + `fixtures.mjs`:

```
npm run build && node scripts/harness/assert-heroes.mjs
```

1. `heroShareOfFrame('/') <= 0.34` and `firstContentHeadingBelowHero.y <= 380` (1280×800) / `<= 460` (1920×1080).
2. `document.querySelectorAll('.quran-jadwal, .jadwal-frame, .jadwal-mount').length <= 1` on every route.
3. `.jadwal-mount` never appears on `/quran`, `/library`, `/watch`, `/radio`, `/reminders`, `/downloads`, `/settings`.
4. `.hero-basmala` box intersects no element with a non-`none` `pointer-events` and no `[role="button"]`, `button`, `a`, `input` — the "never behind a control" rule, as geometry.
5. `.hero-basmala` and its ancestors: computed `overflow` ∈ {visible}, `clip-path` = none, `mask-image` = none, `filter` = none, `text-shadow` = none, `animation-name` = none, `transition-property` excludes `transform` and `opacity`.
6. `getComputedStyle('.quran-reading-frame').animationName === 'none'` under `reducedMotion: 'reduce'`.
7. `/quran` route root and `.hero-mushaf` both carry `data-ambient-ceiling` ≤ 1; no descendant of `.quran-reading-frame` has a `transform` other than `none`.
8. CLS: measure each hero's `getBoundingClientRect().height` in the `loading` phase and again in `ready`; assert equal within 1px.
9. Grep gate (CI, not Playwright): zero occurrences of `text-white`, `bg-black`, `#`-hex, `rgba(` and `rgb(0 0 0` inside `src/components/hero/**` and `src/components/marks/**`.
10. Grep gate: zero occurrences of `pl-`, `pr-`, `text-left`, `text-right`, `border-l`, `border-r` in `src/components/hero/**`.
11. HeroMushaf under Warsh: assert `[data-testid="hero-mushaf-read"]` has no `onclick`, `tabindex` or `role`, and that the resume payload logged by the stub contains no `timingReadId` key.

`cargo test` is unaffected — no Rust changes. `npx tsc --noEmit` and `npm run build` gate as usual.

---

## 12. i18n keys to add

Add to **both** `dictionaries.en` and `dictionaries.ar` in `src/i18n.ts` (`TranslationKey = keyof typeof dictionaries.en`, `i18n.ts:1058`).

| Key | en | ar |
|---|---|---|
| `heroContinueEyebrow` | `Where you left off` | `حيث توقّفت` |
| `heroFirstLessonEyebrow` | `Your library` | `مكتبتك` |
| `heroResume` | `Continue` | `متابعة` |
| `heroOpenMushaf` | `Open the Mushaf` | `افتح المصحف` |
| `heroNoLessonTitle` | `Nothing in progress yet` | `لا يوجد درس قيد المتابعة` |
| `heroImportFolder` | `Import a folder` | `استيراد مجلد` |
| `heroMushafStartAtFatihah` | `Start at Al-Fatihah` | `ابدأ بالفاتحة` |
| `heroOpenFatihah` | `Open Al-Fatihah` | `افتح الفاتحة` |
| `quranWarshNoTiming` | `Word sync is available in Hafs only` | `تتبّع الكلمات متاح برواية حفص فقط` |
| `heroAmbientLine` | `An offline library: your lessons, the Mushaf in two riwayat, and reminders — all on this device.` | `مكتبة تعمل دون اتصال: دروسك، والمصحف بروايتين، والتذكيرات — كلّها على هذا الجهاز.` |

Reused unchanged: `heroBasmalaMeaning`, `heroMarkLabel`, `quranPill`, `quranTitle`, `quranContinue`, `quranAyah`, `quranRiwayah`, `quranRiwayahHafs`, `quranRiwayahWarsh`, `library`, `localOnlyIslamicLibrary`, `importFolder`, `watchTitle`, `watchAdFreePill`, `remindersTitle`, `createReminder`, `scanSubfoldersRecursively`.

Removed with `Hero.tsx`: `heroPurpose`, `heroOpenMushaf` (re-added above with the same name), `heroRadio`, `heroContinue`, `premiumLibraryCommand`, `dashboardSubtitle`.

---

## 13. Order of work

1. Tokens + `.skeleton` + `.jadwal-mount` + `useEyebrowClass` extraction + `types.ts` + `HeroActionButton`. No visual change; `tsc` and `build` green.
2. `BasmalaPlate` + `NoorMark`, still mounted by the old `Hero.tsx`. Marks render identically — verify with the harness before touching anything else.
3. `HeroCompact` + six route migrations. Lowest risk, deletes six copies of the same block, and proves the band's height holds in ten themes and two languages.
4. `HeroContinue` + Dashboard rewire + delete `Hero.tsx`, `.hero*` CSS, `FeatureCard`, the masthead.
5. `HeroMushaf` + the `.quran-reading-viewport` max-height line. Re-run word-sync by hand against a Hafs surah with a timing read, then switch to Warsh mid-session and confirm the sync UI is gone and no timing request fires.
6. `HeroAmbient` + `firstRun`. Test by clearing `importedFolders` in the stub fixtures.
7. `assert-heroes.mjs`, then the full 5-theme × 2-language sweep.

No step touches the Quran data layer, word timings, audio matching, the updater keys, or the version in the five files.

## Risks

- **HeroMushaf sits directly above the mushaf reading pane, and any transform, `will-change`, `view-transition-name` or containing-block change introduced on it or on a shared ancestor desynchronises the word cue. `positionWordCue` (src/pages/Quran.tsx:458-473) derives the cue's transform from the delta between `word.getBoundingClientRect()` and its `offsetParent`'s; a transformed ancestor changes what both return mid-frame. This is a manhaj-relevant defect wearing a motion bug's clothes — the cue points at a word that is not being recited.**
  - Mitigation: HeroMushaf declares no transform, no `will-change`, no `view-transition-name`, and is a sibling of the reading column, not an ancestor. Harness assertion 7 walks every descendant of `.quran-reading-frame` and every ancestor up to `.page-container` asserting `transform === 'none'`. The rule is stated as a hard boundary in §5.4 so a later motion phase cannot reach into `/quran` by accident.
- **The `.quran-reading-viewport { max-height }` change is one line away from the documented load-bearing invariant. A future editor reading `max-height: min(70vh, calc(100vh - 22rem))` may conclude the scroller is fair game and move `overflow-y` onto `.quran-reading-surface`, which leaves the cue `scrollTop` pixels out.**
  - Mitigation: The changed declaration carries a comment naming the 22rem as route chrome and restating that the scroller must stay on `.quran-reading-viewport`. The existing invariant comments on `.quran-reading-surface` (`overflow: visible`, `border: none`) are untouched and remain the index entry in CLAUDE.md.
- **`--hero-accent-rgb` defaulting to `var(--accent-gold-rgb)` means the four heroes ship looking identical in eight of the ten themes — and byte-identical in Sakinah Blue and Yaqut Red, which both resolve `226 197 122`. A reviewer sweeping ten themes may read the hero work as having failed to differentiate.**
  - Mitigation: State the null result explicitly in the phase writeup: this spec makes differentiation a one-line-per-theme change and deliberately does not perform it, so the hero work and the accent work can be reviewed separately. The 5-theme sweep is checked for structural correctness (elevation on Onyx, rings on Pearl, radii on warm), not for hue variety.
- **HeroContinue at the 900×600 minimum window occupies 36.9% of the frame — above the 34% target — because the text stack has an irreducible minimum of ~209px.**
  - Mitigation: The `@media (max-height: 720px)` block collapses the meter into the figures row and drops padding from 20px to 14px, and the art column is dropped entirely below 1024px viewport width rather than stacked. 36.9% at the minimum supported window is accepted and recorded in the budget table rather than hidden; the assertion threshold is set at the two shipping viewports.
- **Deleting `.hero-wordmark`, `.hero-purpose` and `.hero-fade` while keeping `.hero-basmala`, `.hero-mark`, `.hero-wordmark-latin` and `.hero-arch` leaves a partially-dead namespace. A later cleanup pass may delete the survivors, silently breaking three global selectors (`index.css:597`, `:638-639`) that name them by class — the Basmala would gain 85% line-height and the Latin wordmark would gain Arabic letter-spacing zeroing.**
  - Mitigation: §0 lists the four survivors with the exact line numbers of the selectors that depend on them, and the comment at each surviving rule names its dependant. Assertion 5 covers the Basmala's computed style, so the regression fails the harness rather than reaching a release.
- **`get_continue_watching` returns videos ordered by the backend; HeroContinue takes item[0] as *the* lesson. If the ordering is not last-played-first, the hero resumes the wrong thing — which is worse than the current card, because a hero is a stronger claim.**
  - Mitigation: Verify `src/db/video.rs::get_continue_watching`'s ORDER BY before step 4, and pin it with a Rust test if it is not already covered. Note that `src/db/video.rs` uses the `VIDEO_COLUMNS` const and never `SELECT *` — column order in the file does not match the struct and a test asserts this, so any query edit must go through the const.

## Open questions

- The Basmala's small `mark` position is specified on the Dashboard, above HeroContinue, in a band of its own. The alternative reading of the brief puts it on `/quran` instead, where it is contextually the subject — but `/quran` already renders the U+FDFD ligature per surah inside the reading surface (Quran.tsx:1243-1254), so that would be two Basmalas on one route. Confirm the Dashboard placement is what was meant.
- HeroAmbient is specified as non-dismissible: completing the import ends first run, and there is no skip. A user who wants to explore the Mushaf before importing any video has no path off the screen. Should the single action be `Import a folder`, or should it be a choice of two (`Import a folder` / `Open the Mushaf`) — which would make it the only screen in the app with two heroes' worth of decisions?
- HeroCompact carries `metrics` on `/library` and `/reminders` today. Those two routes' existing metric bands (`Library.tsx:404-420`, `Reminders.tsx:279-295`) are also candidates for the `StatStrip` block. Confirm whether metrics live inside the 180px band (this spec) or immediately below it as a separate `StatStrip` — the band height changes from 180 to 148 if they move out.
- `--hero-continue-h` uses `vh`, which in a Tauri window tracks the window, not the `<main>` frame — the 36px TitleBar means 30vh of an 800px window is 31.4% of the 764px frame, not 30%. The numbers in §11 account for this. Confirm the intent is a share of the window (simple, no JS) rather than a share of the frame (exact, needs a ResizeObserver or a CSS variable written from JS).
- Assertion 11 checks that no Warsh resume payload carries a timing read. That requires the stub to log `onResume` payloads. Confirm it is acceptable to add a `window.__HARNESS_EVENTS__` sink to `scripts/harness/stub-tauri.js` for this, or whether the guarantee should rest on the discriminated union plus the DEV throw alone.
