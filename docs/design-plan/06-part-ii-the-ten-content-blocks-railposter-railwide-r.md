# Part II — The Ten Content Blocks: RailPoster, RailWide, RailStation, GridMedia, SplitPane, ListGrouped, ListCompact, StatStrip, ChipRow, SectionHeader

## 0. Where this lands

### 0.1 New files

```
src/components/blocks/
  index.ts                    barrel — the only import path pages use
  SectionHeader.tsx
  ChipRow.tsx
  StatStrip.tsx
  ListCompact.tsx
  ListGrouped.tsx
  GridMedia.tsx
  SplitPane.tsx
  rails/Rail.tsx              shared shell: scroller, mask fades, paging, roving focus
  rails/RailPoster.tsx
  rails/RailWide.tsx
  rails/RailStation.tsx
  internal/MediaFrame.tsx     the ONLY place an aspect ratio is declared
  internal/Skeleton.tsx
  internal/OverflowMenu.tsx   generalised from src/components/playlist/PlaylistMenu.tsx
  internal/MetaLine.tsx       the no-filesystem-path enforcement point
  types.ts                    MediaCardModel, OverflowAction, RowDensity, MediaRatio
src/hooks/
  useRailScroll.ts
  useRovingIndex.ts
  useScrollParent.ts
  useVirtualRows.ts
  usePersistentNumber.ts
  useElementSize.ts
src/utils/alphaBucket.ts
```

CSS additions all go in `src/index.css` inside the existing `@layer components`. No component declares a colour.

### 0.2 One dependency

`@tanstack/react-virtual@3.14.8` — MIT, **56,556 bytes unpacked**, headless, zero styling, zero colour, zero motion. It is the single virtualization engine for `GridMedia`, `ListCompact` and `ListGrouped`. Nothing else is added. Pin the exact resolved version in `package-lock.json`; it is a runtime dependency, not a devDependency.

It is **forbidden inside `.quran-reading-surface`.** Windowing the ayah flow would unmount the element `positionWordCue` measures and would clip words mid-line. `SurahReader`'s verse list stays fully rendered.

### 0.3 New tokens (append to the `:root` block in `src/index.css`, after `--ring-focus`)

```css
/* ── Block metrics ──────────────────────────────────────────────────
   Every number a content block needs, in one place. Nothing below is a
   colour; colour continues to come from the ladder above. */
--scroll-gutter: 8px;        /* MUST equal ::-webkit-scrollbar width (index.css:693) */

--rail-gap: var(--s4);       /* 16px */
--rail-pad: 5px;             /* clears --ring-focus (4px) at the rail's start edge */
--rail-edge: 2.5rem;         /* mask fade width */
--rail-poster-w: 11.25rem;   /* 180px card → 2:3 = 270px */
--rail-wide-w: 19rem;        /* 304px card → 16:9 media = 171px */
--rail-station-w: 15rem;     /* 240px */

--grid-gap: 1.25rem;         /* == the gap-5 that ships today */
--grid-gap-tight: 0.75rem;

--row-pad-block: 0.875rem;   /* .rule-row's current hardcoded 0.875rem, tokenised */
--group-head-h: 34px;
--alpha-index-w: 1.5rem;

--split-gutter: 1.25rem;
--split-handle: 9px;
```

### 0.4 New i18n keys

`t()` is `(key: TranslationKey) => string` with **no interpolation** (`src/i18n.ts:1157`). No block may build a display string by concatenation; counts and foreign-script runs are always separate `<bdi>` elements. Add to both `dictionaries.en` and `dictionaries.ar`:

| key | en | ar |
|---|---|---|
| `showInFolder` | Show in folder | إظهار في المجلد |
| `scrollBack` | Scroll back | تمرير للخلف |
| `scrollForward` | Scroll forward | تمرير للأمام |
| `showAll` | Show all | عرض الكل |
| `showFewer` | Show fewer | عرض أقل |
| `jumpToLetter` | Jump to letter | الانتقال إلى حرف |
| `resizePanes` | Resize panels | تغيير حجم اللوحات |
| `collapsePanel` | Collapse panel | طيّ اللوحة |
| `expandPanel` | Expand panel | توسيع اللوحة |
| `nothingToShow` | Nothing to show yet | لا يوجد شيء لعرضه بعد |

---

## 1. Shared foundations

### 1.1 The card-face metadata rule

**No block renders a filesystem path on a card face, row face, or poster.** This is enforced by the type, not by review.

`src/components/blocks/types.ts`:

```ts
import type { LucideIcon } from 'lucide-react';
import type { TranslationKey } from '@/i18n';

export type MediaRatio = '16/9' | '2/3' | '1/1';
export type RowDensity = 'comfortable' | 'compact' | 'dense';

/** The normalised view model every rail and media grid consumes. One shape for
 *  a Playlist, a Video, a WatchHistoryItem and a download — so a card never
 *  reaches into a domain object and never invents its own metadata line. */
export interface MediaCardModel {
  id: string;
  title: string;
  /** Second line: speaker, channel, reciter. NEVER a path. */
  subtitle?: string | null;
  /** Third line, already formatted and localised. NEVER a path.
   *  Rendered as <bdi> runs separated by a middot element. */
  meta?: readonly string[];
  categoryLabel?: string | null;
  /** Rendered in .media-badge over the frame's bottom-inline-end corner. */
  badge?: string | null;
  /** Absolute local path, run through convertFileSrc by MediaFrame. */
  thumbnailPath?: string | null;
  /** Remote https URL (Watch results/history). Mutually exclusive with the above. */
  thumbnailUrl?: string | null;
  progressPercent?: number;
  complete?: boolean;
  /** Absolute path, consumed ONLY by the overflow menu's "Show in folder".
   *  Never rendered, never placed in title=. */
  revealPath?: string | null;
}

export interface OverflowAction {
  id: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onSelect: () => void;
}
```

`src/components/blocks/internal/MetaLine.tsx` runs a dev-only guard and is the only component allowed to render `MediaCardModel.meta`:

```ts
const LOOKS_LIKE_PATH = /^[a-zA-Z]:[\\/]|^\\\\|^\/(?:home|Users|mnt|media)\//;

if (import.meta.env.DEV) {
  for (const part of meta) {
    if (LOOKS_LIKE_PATH.test(part)) {
      throw new Error(
        `MetaLine: "${part}" is a filesystem path. Paths belong in the overflow ` +
        `menu as "Show in folder" (MediaCardModel.revealPath), never on a card face.`,
      );
    }
  }
}
```

**Sites to strip and where the path goes instead.** Every one of these renders `playlist.folderPath` in a truncated `<span>` on a face today:

| File:line | Today | After |
|---|---|---|
| `src/components/playlist/PlaylistCard.tsx:337-338` | list-variant meta line | removed; `revealPath` → overflow menu |
| `src/components/playlist/PlaylistCard.tsx:435-438` | wide-variant `FolderClosed` + path | removed |
| `src/components/playlist/PlaylistCard.tsx:532-535` | poster-variant bottom `border-t` line | removed — the card gains 26px back |
| `src/components/playlist/SearchResults.tsx:92-93` | `PlaylistSearchRow` meta line | removed |
| `src/components/playlist/PlaylistDetail.tsx:150-152` | detail header caption | moves to the detail header's `OverflowMenu` |

`title={playlist.folderPath}` on the wrapper goes with it — a tooltip is still a card face.

`OverflowMenu` gains one action, appended after `Open` and before `Rescan`, wired to the command that already exists at `src-tauri/src/commands/file_ops.rs:41`:

```ts
{ id: 'reveal', labelKey: 'showInFolder', icon: FolderOpen,
  disabled: !model.revealPath,
  onSelect: () => void invoke('open_file_location', { filePath: model.revealPath! }) }
```

`open_file_location` is Windows-only in effect (`#[cfg(target_os = "windows")]` branch spawns `explorer /select,…`); it compiles on all three targets, so no CI change.

`ContinueWatching.tsx:72` and `RecentlyAdded.tsx:70` extract a folder **basename** for a group title. That is a name, not a path — it stays.

### 1.2 `MediaFrame` — the one place a ratio is declared

Aspect ratios vary today (`aspect-video` on posters, `h-[58px] w-[104px]` on rows, `w-56` on Watch cards, `h-28 w-44` on the empty state) and the grid looks broken because of it. After this, **no component outside `MediaFrame` may write an aspect utility or a media width/height.**

```ts
export interface MediaFrameProps {
  ratio: MediaRatio;
  /** Absolute local path — passed through convertFileSrc. */
  path?: string | null;
  /** Remote https URL. If both are set, `path` wins. */
  url?: string | null;
  /** Seed for the generated geometric fallback (PlaylistArt). */
  seed: string;
  /** Accessible name for the frame; the <img> itself carries alt="". */
  label: string;
  progressPercent?: number;
  complete?: boolean;
  badge?: string | null;
  /** Hover/focus affordance, e.g. the play medallion. */
  overlay?: React.ReactNode;
  loading?: 'lazy' | 'eager';
  className?: string;
}
```

Behaviour:
- Renders `<div className={`media-frame ratio-${k}`}>` where `k` is `16x9 | 2x3 | 1x1`.
- Image: `absolute inset-0 h-full w-full object-cover`, `alt=""`, `decoding="async"`, `draggable={false}`, `loading` from the prop. On `onError` it falls back to `<PlaylistArt seed name />` — reuse the existing export from `src/components/playlist/PlaylistCard.tsx:92`, which already fills `absolute inset-0` and is therefore ratio-agnostic.
- Progress rail: `absolute inset-x-0 bottom-0 h-[3px] bg-background/70` with the fill `bg-success-green` when `complete`, else `bg-accent-gold`. This retires the ten rival meter treatments listed in the recon for anything sitting over media.
- Badge: `.media-badge` at `absolute bottom-1.5 end-1.5` — the existing class, which is already `--shade`/`--sheen`-derived and is the only surface allowed to carry its own darkness.

**A note that decides the poster composition.** The app's own ornament is geometric and generated. A user's video thumbnail is *their* content, extracted from *their* lecture file — it is shown at the size the task needs and is never enlarged for decoration. That is why `RailPoster` is a 2:3 **card** containing a 16:9 **media band**, and not a 16:9 frame cropped to 2:3: cropping would both destroy the frame and blow up user content to a decorative scale for no informational gain.

```css
.media-frame {
  position: relative;
  display: block;
  inline-size: 100%;
  overflow: hidden;
  border-radius: var(--r-sm);
  background: var(--fill-well);
  box-shadow:
    inset 0 1px 3px rgb(var(--shade-rgb) / 0.5),
    inset 0 -1px 0 rgb(var(--sheen-rgb) / 0.045);
  contain: paint;
}
.ratio-16x9 { aspect-ratio: 16 / 9; }
.ratio-2x3  { aspect-ratio: 2 / 3; }
.ratio-1x1  { aspect-ratio: 1 / 1; }
```

`contain: paint` is safe here and **must never be applied to `.quran-reading-viewport`, `.quran-reading-frame` or `.quran-reading-surface`** — see §6.4.

### 1.3 `Skeleton`

Skeleton fill is `bg-panel-hover` in three files and `bg-elevated-panel` in two, and the spinner is `Loader2` in four places and a hand-rolled `border-2 … animate-spin` div in `Reminders.tsx:196`. One primitive:

```ts
export interface SkeletonProps {
  /** Tailwind sizing utilities only — no colour. */
  className?: string;
  shape?: 'block' | 'line' | 'pill' | 'circle';   // default 'block'
}
```

Renders `<span aria-hidden="true" className={`skeleton skeleton-${shape} ${className}`} />`.

```css
.skeleton { background: var(--fill-well); border-radius: var(--r-sm); display: block; }
.skeleton-line   { block-size: 0.75rem; border-radius: 9999px; }
.skeleton-pill   { border-radius: 9999px; }
.skeleton-circle { border-radius: 9999px; aspect-ratio: 1; }
@media (prefers-reduced-motion: no-preference) {
  .skeleton { animation: skeleton-pulse 1.6s var(--ease-standard) infinite; }
}
@keyframes skeleton-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.55 } }
```

Every block's `loading` branch renders its own shape from `Skeleton` — never a spinner in a void. A skeleton container carries `aria-busy="true"` and `aria-hidden` on the shapes.

### 1.4 The virtualization contract

One hook, `src/hooks/useVirtualRows.ts`, wraps `useVirtualizer` so no page touches the library directly.

```ts
export interface VirtualRowsOptions {
  count: number;
  /** Rows below this render in full. Default 60. */
  threshold?: number;
  estimateSize: (index: number) => number;
  overscan?: number;                                  // default 8
  /** Explicit scroller. Omit to resolve the nearest scrollable ancestor. */
  scrollElementRef?: React.RefObject<HTMLElement>;
  containerRef: React.RefObject<HTMLElement>;
  horizontal?: boolean;                               // default false
}
export interface VirtualRows {
  enabled: boolean;
  totalSize: number;
  items: { index: number; start: number; size: number; key: React.Key }[];
  measureElement: (el: HTMLElement | null) => void;
  scrollToIndex: (index: number, align?: 'auto' | 'start' | 'center') => void;
  scrollOffset: number;
}
```

Rules:
- **Threshold is 60 everywhere.** Under 60, `enabled` is false and the caller maps normally — no absolute positioning, no measurement, no behaviour change on small collections. `GridMedia` counts *cards*; `ListCompact` counts *rows*; `ListGrouped` counts *flattened rows including group headers*.
- The default scroller is resolved by `useScrollParent(containerRef)`, which walks `parentElement` until `getComputedStyle(el).overflowY` is `auto` or `scroll`. On seven of eight routes that is `.page-container`. Resolved in `useLayoutEffect` on mount and re-resolved when `containerRef.current` changes identity.
- Because the scroller is an ancestor with padding (`.page-container` is `p-6`), the virtualizer needs a scroll margin. Compute it in `useLayoutEffect` and on every `ResizeObserver` tick of the scroller:
  ```ts
  scrollMargin =
    containerRef.current.getBoundingClientRect().top
    - scrollEl.getBoundingClientRect().top
    + scrollEl.scrollTop;
  ```
- `measureElement` is always wired. `estimateSize` only has to be close.
- **Focus rescue.** A focused row that scrolls out is unmounted and focus falls to `<body>`. Every virtualized scroller carries `tabIndex={-1}` and an `onBlur` handler: if `event.relatedTarget === null` and the scroller still contains `document.activeElement === document.body`, call `scroller.focus({ preventScroll: true })`.
- **ARIA.** The scroller is `role="list"` with `aria-label`; each virtual row is `role="listitem"` with `aria-setsize={count}` and `aria-posinset={index + 1}`. ARIA 1.2 sanctions exactly this for partially-rendered lists. Group headers are `listitem`s containing an `<h3>`, so heading navigation still works.

### 1.5 RTL scroll arithmetic

Windows-only on Evergreen WebView2 (current Chromium), so the standards behaviour is guaranteed: in `direction: rtl`, `scrollLeft` runs from `-(scrollWidth - clientWidth)` at the inline end to `0` at the inline start. `src/hooks/useRailScroll.ts` is the only place this appears:

```ts
const max = el.scrollWidth - el.clientWidth;              // always >= 0
const sign = dir === 'rtl' ? -1 : 1;
const atStart = sign * el.scrollLeft <= 1;
const atEnd   = sign * el.scrollLeft >= max - 1;
const pageBy  = (pages: number) =>
  el.scrollBy({ left: sign * pages * pageAmount, behavior: reduced ? 'auto' : 'smooth' });
```

`pageAmount = Math.max(1, Math.floor(el.clientWidth / itemPitch)) * itemPitch` where `itemPitch = itemWidthPx + railGapPx`.

`reduced` comes from `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, read live (not cached) so an OS change mid-session is honoured.

No block ever writes `border-left/right`, `margin-left/right`, `left`, `right`, `text-align: left/right`, or `padding-left/right`. Logical properties only, or Tailwind's `s`/`e` utilities.

### 1.6 The keyboard model

Two patterns, applied uniformly.

**Rails (horizontal, cards with two controls each).** A rail costs the tab order **two** stops plus its two paging buttons:
- The card's *primary* control and its *overflow menu* button share the card's roving `tabIndex`: `0` on the active card, `-1` on every other card.
- `ArrowRight`/`ArrowLeft` map through `dir` to inline-next/inline-prev, move the roving index by 1, focus the new primary, and `scrollIntoView({ block: 'nearest', inline: 'nearest', behavior })`.
- `Home`/`End` → index 0 / last. `PageDown`/`PageUp` → ± one visible page.
- The two paging buttons are **always mounted** and toggle `disabled` from `atStart`/`atEnd`. Mounting and unmounting them would move focus; a disabled button is skipped by `Tab` and is not an `aria-hidden`-on-focusable violation.
- The wheel is **not** hijacked. A vertical wheel over a rail scrolls the page, as the user expects; the paging buttons and arrow keys are the horizontal affordance.

**Lists and grids (vertical).** Roving `tabIndex` over rows/cards; `ArrowDown`/`ArrowUp` ±1, `Home`/`End`, `PageDown`/`PageUp` ± `Math.floor(clientHeight / rowHeight)`. `GridMedia` additionally maps `ArrowRight`/`ArrowLeft` through `dir` to ±1 and `ArrowDown`/`ArrowUp` to ±`columns`.

When virtualized, moving focus is two steps because the target row may not be mounted:
```ts
virtual.scrollToIndex(next, 'auto');
requestAnimationFrame(() => {
  containerRef.current
    ?.querySelector<HTMLElement>(`[data-row-index="${next}"] [data-row-primary]`)
    ?.focus();
});
```

`useRovingIndex` is shared: `{ activeIndex, setActiveIndex, getItemProps(index) }` where `getItemProps` yields `tabIndex`, `data-row-index` and the `onKeyDown` handler.

### 1.7 Overlay scrollbars

`overflow: overlay` is gone from Chromium and hiding the scrollbar removes the affordance. `.overlay-scroll` reserves a gutter that matches the existing global scrollbar width, reclaims it with a negative logical margin so the pane's hairlines still run edge to edge, and keeps the thumb transparent until the pane is pointed at or focused:

```css
/* The scrollbar sits in reserved space rather than shrinking the content
   column, so a list does not reflow the instant it becomes scrollable — and
   the ruled hairlines still reach the pane's real edge.
   --scroll-gutter MUST track ::-webkit-scrollbar's width. */
.overlay-scroll {
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  margin-inline-end: calc(-1 * var(--scroll-gutter));
  padding-inline-end: var(--scroll-gutter);
}
.overlay-scroll::-webkit-scrollbar-thumb { background: transparent; }
.overlay-scroll:hover::-webkit-scrollbar-thumb,
.overlay-scroll:focus-within::-webkit-scrollbar-thumb {
  background: rgb(var(--hair-rgb) / 0.22);
}
.overlay-scroll:hover::-webkit-scrollbar-thumb:hover {
  background: rgb(var(--hair-rgb) / 0.40);
}
```

Slash syntax throughout — `rgba(var(--hair-rgb), 0.22)` is invalid and silently drops the declaration.

### 1.8 `.rule-row` density

Density is eight ad-hoc `py-*` overrides of one base today. Tokenise the base and add two modifiers; the eight call sites drop their utility.

```css
.rule-row { padding: var(--row-pad-block) 0.125rem; }   /* replaces 0.875rem 0.125rem */
.rule-row-compact { --row-pad-block: 0.5rem; }
.rule-row-dense   { --row-pad-block: 0.375rem; }
```

Migrate: `Quran.tsx:373` `py-2.5` → `compact`; `Quran.tsx:984,1082,1500` `py-2` → `dense`; `Quran.tsx:1436` `py-2.5` → `compact`; `ReminderCard.tsx:33` `py-3.5` → default; `QueueRow.tsx:25` `py-2` → `dense`; `Settings.tsx:736` `py-2.5` → `compact`.

---

## 2. `SectionHeader`

**One component replacing eight header treatments, two eyebrow idioms and three title scales — 13 header shapes across 8 routes.**

```ts
export type SectionHeaderSize = 'page' | 'section' | 'sub';
export type SectionHeaderRule = 'gradient' | 'flat' | 'none';

export interface SectionHeaderProps {
  title: React.ReactNode;
  /** Small tracked label above the title. Latin-only casing — see below. */
  eyebrow?: string;
  /** Leading glyph, sized 14px and painted text-muted-text. */
  icon?: LucideIcon;
  /** Rendered as a plain tabular <bdi>. Never a filled pill. */
  count?: number;
  /** One quiet sentence under the title. `page` and `section` only. */
  description?: string;
  /** Trailing slot: a .quiet-action, a Skeleton, a ChipRow, a count+action pair. */
  action?: React.ReactNode;
  size?: SectionHeaderSize;      // default 'section'
  rule?: SectionHeaderRule;      // default 'gradient' ('none' when size='page')
  /** Overrides the level derived from `size`. Use to keep one h1 per route. */
  as?: 'h1' | 'h2' | 'h3';
  /** Pins the header to the top of the nearest scroll context. */
  sticky?: boolean;              // default false
  id?: string;
  className?: string;
}
```

**Size → type.** All three read from the existing scale; none invents a size.

| size | element | class | colour | default rule |
|---|---|---|---|---|
| `page` | `h1` | `text-3xl font-semibold` (`--fs-2xl`, 37px) | `text-text-primary` | `none` |
| `section` | `h2` | `text-sm font-semibold` (`--fs-sm`, 13.5px) | `text-text-primary` | `gradient` |
| `sub` | `h3` | `.section-eyebrow` (`--fs-cap`, 11.5px) | `text-muted-text` | `gradient` |

This retires Library's one-off `text-[2.5rem] tracking-[-0.025em]` (`Library.tsx:378`) and Dashboard's `text-4xl/[3.25rem]` (`Dashboard.tsx:114`) — three page-title scales become one.

**Casing lives in CSS, not in a hook.** `useEyebrowClass` (`ContinueWatching.tsx:22-28`) branches on language in JS to avoid tracking Arabic; `Quran.tsx:239,1397` carry a `tracking-wide` that `html[data-language='ar']` silently zeroes, so those two headers render at a different width per language. Both problems die here:

```css
.section-eyebrow {
  font-size: var(--fs-cap);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: rgb(var(--text-muted-rgb));
}
/* Arabic has no case, and the global rule already zeroes tracking. Reassert
   the weight so the two languages do not render at different colours of grey. */
html[data-language='ar'] .section-eyebrow {
  text-transform: none;
  font-weight: 500;
}
```

`useEyebrowClass` is deleted. Its five call sites take `<SectionHeader size="sub">`.

**Rule.** `gradient` applies the existing `.rule-head` (the pen-drawn hairline that fades 0.30 → 0.05 across the width and already flips for RTL at `index.css:1766`). `flat` applies `border-b border-border pb-2.5` and exists only as an escape hatch for headers inside a `.surface-*` panel where the gradient would read as a smudge; the four `SectionRule` call sites migrate to `gradient`, not `flat`. `SectionRule` (`PlaylistGrid.tsx:99-116`) is deleted and re-exported as a deprecated alias for exactly one release.

**Count.** Always `<span className="shrink-0 text-[11px] tabular-nums text-text-faint"><bdi>{count}</bdi></span>`. `QueuePanel.tsx:92`'s filled `primary-blue` pill goes — that is one of the two remaining renders of a dead accent seed.

**Sticky.** `sticky` sets `position: sticky; inset-block-start: 0; z-index: 2` and paints an opaque backstop so rows do not show through:
```css
.section-header-sticky {
  position: sticky;
  inset-block-start: 0;
  z-index: 2;
  background: var(--bg-main);
  padding-block-start: var(--s2);
}
```
Never use `sticky` on a header that is a descendant of `.quran-reading-viewport`.

**Empty / loading.** `SectionHeader` has neither. It is a label; when its section is loading, the caller passes a `<Skeleton shape="line" className="w-10" />` as `action`, which is what `Library.tsx:562-566` already does with a spinner.

**Keyboard.** Nothing focusable except whatever the caller puts in `action`. The heading participates in heading navigation; `sticky` does not remove it from the flow so the rota is unaffected.

**RTL.** Entirely from `.rule-head`'s existing `[dir='rtl']` rule plus logical padding. The icon sits inline-start via `flex` order, not a margin.

**18 migrations.** A: `PlaylistGrid.tsx:75`, `SearchResults.tsx:41,52`, `Library.tsx:563,587,626` → `sub`. B: `Radio.tsx:206`, `PlaylistDetail.tsx:200`, `Quran.tsx:1472` → `section`. C: `Watch.tsx:120,408`, `Downloads.tsx:273` → `section` + `icon` (and `Downloads.tsx:273`'s `<span>` becomes a real heading, gaining the landmark it lacks). D: `Quran.tsx:239,1397` → `section`. E: `Settings.tsx:463,505` → `section` + `description`. F: `ContinueWatching.tsx:93,131`, `RecentlyAdded.tsx:92`, `Dashboard.tsx:141,171,287` → `sub`. G: all eight `Settings.tsx` `<Section>` heads (`Settings.tsx:756`) → `sub`. H: `QueuePanel.tsx:83-97` → `section` + `icon` + `count`.

---

## 3. `RailPoster` — 2:3, playlists and series

```ts
export interface RailPosterProps {
  items: readonly MediaCardModel[];
  /** Opens the detail view. Bound to the title. */
  onOpen: (id: string) => void;
  /** Resume/play. Bound to the media frame and the play medallion. */
  onPrimary: (id: string) => void;
  /** Per-item overflow actions. "Show in folder" is appended automatically
   *  whenever the model carries revealPath. */
  actions?: (item: MediaCardModel) => readonly OverflowAction[];
  /** Rendered above the scroller. Pass a <SectionHeader/>. */
  header?: React.ReactNode;
  ariaLabel: string;
  loading?: boolean;
  skeletonCount?: number;        // default 6
  empty?: React.ReactNode;
  /** A rail is a shortlist. Above this, use GridMedia. Default 24. */
  maxItems?: number;
  className?: string;
}
```

**Locked geometry.** Card `inline-size: var(--rail-poster-w)` (180px), `aspect-ratio: 2 / 3` (270px). Media band is `<MediaFrame ratio="16/9">` at the card's full width (180×101). Body fills the remainder: 2-line clamped title (`text-[13px] leading-snug font-medium`), one `MetaLine`, then a `ProgressMeter` pushed to the bottom with `mt-auto`. Card material is `surface-2 surface-lift rounded-lg` — the existing ladder, not a hand-rolled border-plus-fill.

**Every card is the same height, always.** The card's own `aspect-ratio: 2/3` guarantees it; body content that would overflow is clamped, never allowed to grow the card. This is the fix for "aspect ratios vary and the grid looks broken".

**Scroll & snap.**
```css
.rail-scroller {
  display: flex;
  gap: var(--rail-gap);
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-inline: contain;
  scroll-snap-type: inline proximity;
  scroll-padding-inline-start: var(--rail-pad);
  padding-inline: var(--rail-pad);
  padding-block-end: var(--s2);          /* room for the lift's shadow */
  -webkit-mask-image: linear-gradient(
    to right,
    transparent 0, black var(--fade-left),
    black calc(100% - var(--fade-right)), transparent 100%);
          mask-image: linear-gradient(
    to right,
    transparent 0, black var(--fade-left),
    black calc(100% - var(--fade-right)), transparent 100%);
  --fade-left: 0px;
  --fade-right: 0px;
}
.rail-item { flex: 0 0 auto; scroll-snap-align: start; }
@media (prefers-reduced-motion: no-preference) {
  .rail-scroller { scroll-behavior: smooth; }
}
```
`proximity`, not `mandatory`: mandatory fights a trackpad flick and can trap the last partial card against the end.

**Edge fades.** A painted gradient would have to match `.page-container`'s two radial glows and would read as a band. A `mask-image` reveals whatever is behind, so it needs no colour at all and costs no token. `useRailScroll` writes `--fade-left` / `--fade-right` as physical px on the scroller — physical names because `mask-image` has no logical direction — mapping `atStart`/`atEnd` through `dir`:

```ts
const startVar = dir === 'rtl' ? '--fade-right' : '--fade-left';
const endVar   = dir === 'rtl' ? '--fade-left'  : '--fade-right';
el.style.setProperty(startVar, atStart ? '0px' : 'var(--rail-edge)');
el.style.setProperty(endVar,   atEnd   ? '0px' : 'var(--rail-edge)');
```
Recomputed on `scroll` (passive, rAF-coalesced), on `ResizeObserver` of the scroller, and whenever `items.length` changes. Because the start fade is `0px` while `atStart`, a focus ring on the first card is never clipped by the mask.

The mask promotes the scroller to its own layer. That is why `maxItems` is 24 — and why `GridMedia` gets no mask.

**Virtualization.** None. A rail capped at 24 cards is 24 DOM subtrees. Above `maxItems` the rail slices and, in `DEV`, `console.warn`s naming `GridMedia` as the correct block.

**Empty.** Default: a single `.rule-head`-less strip — `<p className="py-6 text-sm text-muted-text">{t('nothingToShow')}</p>`. Callers pass a designed `empty`; `ContinueWatching.tsx:103-114`'s medallion-plus-action block is the reference and moves here verbatim.

**Loading.** `skeletonCount` cards, each the exact locked geometry: `<div className="rail-item aspect-[2/3] w-[--rail-poster-w] rounded-lg">` containing a `ratio-16x9` `Skeleton`, two `shape="line"` bars at `w-4/5` and `w-1/2`, and a `shape="pill"` at `h-1 w-full`. The rail does not change height when data lands.

**Keyboard & RTL.** Per §1.5 and §1.6.

**Call sites.** Library's showcase row (`PlaylistGrid.tsx:78-84`, `SHOWCASE_MAX = 3`) becomes a `RailPoster` — the "small library strands cards in the top-left" problem is a rail problem, not a grid-track problem. Dashboard's `ContinueWatching` rest-group column (`ContinueWatching.tsx:124-130`) becomes one too, which removes the third hand-rolled split pane.

---

## 4. `RailWide` — 16:9, videos and lessons

Same props as `RailPoster` (`RailWideProps` is structurally identical; both consume `RailProps<MediaCardModel>` from `rails/Rail.tsx`), differing only in card composition:

```ts
export interface RailWideProps extends Omit<RailPosterProps, never> {
  /** Show the subtitle line (channel/speaker). Default true. */
  showSubtitle?: boolean;
}
```

**Locked geometry.** Card `inline-size: var(--rail-wide-w)` (304px). Media is `<MediaFrame ratio="16/9">` (304×171). Body is a **fixed** `block-size: 4.75rem` (76px) holding a 2-line clamped title and one subtitle line — fixed, not `auto`, so a one-line title and a two-line title produce identical cards. Total card height is therefore always 247px + 1px border.

Everything else — scroller, mask fades, snap, paging, roving focus, RTL, skeletons — is inherited from `rails/Rail.tsx` unchanged.

**Call sites.** `WatchHistoryRow` (`Watch.tsx:400-424`) is the app's only horizontal rail today: `flex gap-3 overflow-x-auto pb-2` with no buttons, no snap, no fade, no keyboard, no RTL handling. It becomes `<RailWide>` and its `HistoryCard` collapses into `MediaCardModel` — including `Watch.tsx:508`'s `bg-black/60 text-white` remove button, which becomes an `OverflowAction`, retiring two of the 24 `text-white`/`bg-black` occurrences.

`Downloads.tsx`'s completed-downloads list and `RecentlyAdded.tsx:150`'s hand-rolled `border-b … hover:bg-accent-gold/[0.04]` row also take `RailWide` or `ListCompact` depending on route density — see §13.

---

## 5. `RailStation` — compact, radio

A rail is a **shortlist**: favourites and recently tuned. The 175-station catalogue is `ListGrouped`'s job (§8). This is the split that fixes the 6431px page.

```ts
import type { RadioStation } from '@/store/radioStore';

export interface RailStationProps {
  stations: readonly RadioStation[];
  currentId?: string | null;
  playing?: boolean;
  favorites: readonly string[];
  onPlay: (station: RadioStation) => void;
  /** Toggle the station that is already current. */
  onTogglePlay: () => void;
  onToggleFavorite: (id: string) => void;
  header?: React.ReactNode;
  ariaLabel: string;
  loading?: boolean;
  skeletonCount?: number;        // default 5
  empty?: React.ReactNode;
  maxItems?: number;             // default 20
  className?: string;
}
```

**Locked geometry.** No media, therefore **no aspect ratio**: a station has no artwork and cannot have any. Card is `inline-size: var(--rail-station-w)` (240px), `block-size: 4.5rem` (72px) — fixed, not derived. Contents: the existing station mark (its own initial in a hairline ring, or `SignalBars` while live) at 40px, the name on one truncated line, the favourite `icon-btn`. The mark logic and the `SignalBars` component move from `Radio.tsx:19-45` into `rails/RailStation.tsx` unchanged — including the code-point iteration that stops a non-BMP initial rendering as half a surrogate pair.

**Card material.** `surface-2 rounded-lg` with `rule-row-active`'s treatment for the current station: `background: var(--wash-hover)` and the 2px inset accent marker, which already flips for RTL at `index.css:1152-1158`.

`SignalBars` is a **broadcast level meter driven by connection state, never by audio**. It has three bars at fixed heights with staggered `animation-delay` and is not connected to an `AnalyserNode`. `src/utils/reminderAudio.ts:86` constructs an `AudioContext`; a comment must be added at that site stating it must never be given an `AnalyserNode` for visual purposes.

**Virtualization.** None; capped at 20.

**Empty.** Favourites rail with zero favourites renders nothing at all (`return null`) — an empty favourites shelf is noise, not information.

**Loading.** `skeletonCount` cards at the exact 240×72, each a `shape="circle" className="h-10 w-10"` plus a `shape="line" className="w-2/3"`.

**Keyboard.** Roving over the play control; the favourite `icon-btn` shares the card's roving `tabIndex`, so `Tab` from a focused card reaches its star and then leaves the rail. `Space`/`Enter` on the play control calls `onPlay` or `onTogglePlay`.

**RTL.** Inherited. The `<p>` uses `<bdi>` rather than `dir="auto"` — the existing comment at `Radio.tsx:236-241` documents why: `dir="auto"` flips the whole block and right-aligns Arabic names inside their flex cell, rendering a mixed list ragged.

---

## 6. `GridMedia` — responsive, locked aspect, virtualized past 60

Four incompatible grids ship today: `auto-fill minmax(17.5rem,1fr)` (`PlaylistGrid.tsx:11`), `sm:2 xl:3 3xl:4` (`Watch.tsx:130`), `sm:2 2xl:3` (`Quran.tsx:1487`), `lg:2` (`Radio.tsx:220`). One track system replaces all four.

```ts
export interface GridMediaProps<T> {
  items: readonly T[];
  getKey: (item: T, index: number) => string;
  renderCard: (item: T, index: number) => React.ReactNode;
  /** LOCKED for every card in the grid. Default '16/9'. */
  ratio?: MediaRatio;
  /** Track floor in px. Defaults per ratio: 16/9 → 280, 2/3 → 180, 1/1 → 208. */
  minColumnWidth?: number;
  gap?: 'normal' | 'tight';        // default 'normal'
  maxColumns?: number;             // default 6
  /** Cards below this render in full. Default 60. */
  virtualizeAfter?: number;
  /** Body height in px added to the derived media height when estimating a
   *  row. Defaults per ratio; measureElement corrects it. */
  cardBodyHeight?: number;
  scrollElementRef?: React.RefObject<HTMLElement>;
  loading?: boolean;
  skeletonCount?: number;          // default = minColumns * 2
  empty?: React.ReactNode;
  ariaLabel: string;
  className?: string;
}
```

**Tracks.** `grid-template-columns: repeat(auto-fill, minmax(min(100%, ${minColumnWidth}px), 1fr))` capped by `maxColumns` — `min(100%, …)` keeps a single card from overflowing a narrow pane, which is why `PlaylistGrid`'s existing floor already carries it. Gap is `var(--grid-gap)` / `var(--grid-gap-tight)`. No breakpoint utilities anywhere; the track floor is the only knob.

**Locked aspect.** `ratio` is passed down to every `MediaFrame` the card renders. `renderCard` receives no ratio argument and must not declare one — dev-mode assertion: if a rendered card's `.media-frame` computed `aspect-ratio` does not match the grid's, warn once naming the offending key.

**Virtualization strategy — rows, not cards.**
1. `useElementSize(containerRef)` gives `width` via `ResizeObserver`.
2. `columns = clamp(1, Math.floor((width + gap) / (minColumnWidth + gap)), maxColumns)`.
3. `rowCount = Math.ceil(items.length / columns)`.
4. `colWidth = (width - gap * (columns - 1)) / columns`; `mediaHeight = colWidth / ratioValue` where `ratioValue` is `16/9`, `2/3` or `1`.
5. `estimateSize = () => mediaHeight + cardBodyHeight + gap` — derived from measured width, not a magic constant, so it stays correct through a window resize.
6. `useVirtualRows({ count: rowCount, threshold: virtualizeAfter, estimateSize, containerRef, scrollElementRef })`.
7. Virtual rows render as `<div role="listitem" style={{ position:'absolute', insetInlineStart:0, insetInlineEnd:0, transform:`translateY(${start - scrollMargin}px)` }}>` containing a nested grid of that row's `columns` cards. `insetInlineStart/End`, not `left/right`.
8. Container gets `height: totalSize` and `position: relative`.

Below the threshold, the container is a plain CSS grid with no absolute positioning at all.

**Empty.** Default is the `nothingToShow` strip. Callers pass designed states: `LibraryEmptyState` (`PlaylistGrid.tsx:122-140`, the best in the app) and `Watch.tsx:206-241`'s `WatchPlaceholder`. **Four surfaces that have no empty branch at all today gain one by construction** because `GridMedia`/`ListCompact` always render the branch: the Quran surah index (`Quran.tsx:279`), the Quran reciter list (`Quran.tsx:1425`), Downloads, and Diagnostics-before-first-run.

**Loading.** `skeletonCount` cards in the real tracks, each `<Skeleton>` in the locked ratio. The grid does not reflow when data lands.

**Keyboard.** Roving over cards; `ArrowRight`/`ArrowLeft` map through `dir`; `ArrowDown`/`ArrowUp` move by `columns`; `Home`/`End` first/last; `PageDown`/`PageUp` by `columns * visibleRows`.

**RTL.** CSS Grid auto-flows in the inline direction, so `html[dir='rtl']` reverses the grid with no code. The only RTL work is mapping the arrow keys and using logical inset properties on the virtual rows.

**Call sites.** `PlaylistGrid.tsx:80-86` (`ratio="2/3"` once posters exist, `"16/9"` today), `Watch.tsx:130` (`ratio="16/9"`, `minColumnWidth={280}`), `Quran.tsx:1487` (the reciter's surah list is not media — it goes to `ListGrouped`, not here), `Downloads.tsx`.

---

## 7. `SplitPane` — resizable, persisted, and safe for the mushaf

Four hand-rolled splits ship with four gutter widths and three divider idioms: `Quran.tsx:227` and `:1393` (`320px_minmax(0,1fr)` + `xl:border-e xl:pe-5`), `Downloads.tsx:148` (`minmax(0,1fr)_340px`), `Dashboard.tsx:225` (`minmax(0,1fr)_320px`), `ContinueWatching.tsx:124` (`minmax(0,1fr)_minmax(0,300px)` + `xl:border-s xl:ps-12`).

```ts
export interface SplitPaneProps {
  /** Persistence key suffix → localStorage['salafi-hub.split.<id>']. */
  id: string;
  start: React.ReactNode;
  end: React.ReactNode;
  startLabel: string;
  endLabel: string;
  /** Start pane's inline size as a fraction of the container. Clamped to
   *  [minStartPx, maxStartPx] in px at every render. Default 0.26. */
  defaultFraction?: number;
  minStartPx?: number;             // default 260
  maxStartPx?: number;             // default 520
  collapsibleStart?: boolean;      // default true
  /** true → block-size: 100%, both panes get their own scroll context. */
  fill?: boolean;                  // default false
  /** Below this breakpoint the panes stack and the handle is not rendered. */
  stackBelow?: 'lg' | 'xl' | 'never';   // default 'xl'
  divider?: 'rule' | 'none';       // default 'rule'
  /** Fired 120ms after a drag settles and after any programmatic change.
   *  Consumers that measure DOM rects subscribe here. */
  onResizeEnd?: () => void;
  className?: string;
}
```

**Layout.** A three-track grid, never a flexbox with transforms:
```css
.split-pane {
  display: grid;
  grid-template-columns: var(--split-start) var(--split-handle) minmax(0, 1fr);
  column-gap: var(--split-gutter);
  min-inline-size: 0;
}
.split-pane[data-fill='true'] { block-size: 100%; min-block-size: 0; }
.split-pane > * { min-inline-size: 0; min-block-size: 0; }
.split-pane[data-fill='true'] > .split-start,
.split-pane[data-fill='true'] > .split-end {
  display: flex; flex-direction: column; overflow: hidden;
}
```
`--split-start` is written as a px value on the element's `style` by the resize logic. **Resizing changes a grid track. It never applies a `transform` to a pane, and no pane may carry `will-change: transform`.** See §7.4.

**Handle.**
```css
.split-handle {
  cursor: col-resize;
  position: relative;
  background: none;
  border: 0;
  padding: 0;
  touch-action: none;
}
.split-handle::before {                 /* the visible rule */
  content: '';
  position: absolute;
  inset-block: 0;
  inset-inline-start: calc(50% - 0.5px);
  inline-size: 1px;
  background: var(--hair);
  transition: background var(--dur-fast) var(--ease-out);
}
.split-handle:hover::before,
.split-handle[data-dragging='true']::before { background: var(--hair-strong); }
.split-handle:focus-visible { outline: none; box-shadow: var(--ring-focus); }
@media (prefers-reduced-motion: reduce) { .split-handle::before { transition: none; } }
```
`divider="none"` suppresses `::before` but keeps the hit area. The handle is 9px wide with a 1px rule — a 1px drag target is a defect.

**Persistence.** `usePersistentNumber` reads and writes `localStorage['salafi-hub.split.<id>']` holding `{"f":0.26,"c":false}` (fraction, collapsed). Written on `pointerup` and on collapse toggle, never on every `pointermove`. Reads are wrapped in `try/catch` — a corrupt value falls back to `defaultFraction` and the key is deleted.

**This key is layout-only and is deliberately NOT riwayah-tagged.** It stores a number and a boolean; it carries no text, no numbering, no font and no timing. Any consumer tempted to keep riwayah-dependent state alongside it must use its own key, tagged, per the riwayah rule.

**Collapse.** `collapsibleStart` puts a `.quiet-action` in the start pane's header slot labelled `t('collapsePanel')` / `t('expandPanel')`. Collapsed sets `--split-start: 0px` and `visibility: hidden` on `.split-start` (kept mounted, so its scroll position and any focus-restore target survive). Double-clicking the handle toggles collapse. `Escape` while dragging aborts and restores the pre-drag fraction.

**Keyboard.** The handle is a real `<button role="separator">` with `aria-orientation="vertical"`, `aria-valuenow={Math.round(fraction*100)}`, `aria-valuemin`, `aria-valuemax`, `aria-label={t('resizePanes')}`, and `aria-controls` pointing at the start pane's `id`. `ArrowRight`/`ArrowLeft` map through `dir` to ±16px (±64px with `Shift`); `Home` → `minStartPx`; `End` → `maxStartPx`; `Enter`/`Space` toggles collapse.

**RTL.** The grid's first track is the inline-start pane, so `html[dir='rtl']` puts it on the right with no code. Drag arithmetic must be signed:
```ts
const rect = containerRef.current.getBoundingClientRect();
const raw = dir === 'rtl' ? rect.right - event.clientX : event.clientX - rect.left;
const startPx = Math.min(Math.max(raw, minStartPx), Math.min(maxStartPx, rect.width * 0.6));
```

**Stacking.** Below `stackBelow`, `grid-template-columns: minmax(0,1fr)`, handle `display: none`, `--split-start` ignored, `end` first in visual order via `order` when the caller marks the end pane primary. Media query written once in CSS keyed off `data-stack-below`, never as a Tailwind breakpoint at a call site.

**Empty / loading.** `SplitPane` has neither — it is a layout container. Each pane's content owns its own states.

### 7.1 The Quran page under `SplitPane fill`

The requirement is that the left pane fills the viewport height with its own scroll context and overlay scrollbars. Today both Quran panes are `max-h-[70vh]` inside a page that itself scrolls (`.page-container` is `overflow-y-auto p-6`), so at 1080p the panes stop 30vh short and the page scrolls behind them.

Add one modifier and use it on `/quran` only:

```css
/* The page no longer scrolls; its panes do. Used by /quran, where the reading
   surface must fill the window and hold its own scroll position. */
.page-container-fixed {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.page-container-fixed > .content-max-width {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-block-size: 0;
  /* .content-max-width ships pb-10; under fixed mode that is 40px of dead band
     nothing can scroll to. */
  padding-block-end: 0;
}
```

`src/pages/Quran.tsx:84` becomes `<div className="page-container page-container-fixed">`. The masthead (`:86-95`), the tab rule (`:97-100`), the error strip (`:102-107`) and the attribution line (`:110-112`) all take `shrink-0`. `<ReadTab/>` / `<ListenTab/>` take `flex-1 min-h-0`.

`ReadTab`'s `grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]` (`Quran.tsx:234`) becomes:

```tsx
<SplitPane
  id="quran-read"
  fill
  stackBelow="xl"
  startLabel={t('quranSurahs')}
  endLabel={t('quranTitle')}
  minStartPx={260}
  maxStartPx={420}
  onResizeEnd={handleReaderResize}
  start={/* SectionHeader + search + resume row (shrink-0), then the index */}
  end={/* loading | ReaderPlaceholder | SurahReader */}
/>
```

The surah index's scroller (`Quran.tsx:288`) becomes `className="rule-list min-h-0 flex-1 overlay-scroll"`. The `max-h-[70vh]` and `xl:border-e xl:pe-5` on the `<aside>` are deleted — the border is now the handle's, at one width, for all four splits.

`ListenTab`'s identical grid (`Quran.tsx:1393`) takes `id="quran-listen"` with the same shape. Its reciter list (`Quran.tsx:1415`) and its surah scroller (`Quran.tsx:1484`) both take `.overlay-scroll`; `Quran.tsx:1484`'s `pe-1` goes, since `.overlay-scroll` now owns the gutter.

`Quran.tsx:1487`'s `grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3` of 114 surah rows becomes `ListGrouped` with `index="none"` in a single column — the three-column grid was producing dangling hairlines wherever the count is not a multiple of three, which is the same defect the Radio comment at `Radio.tsx:213-215` describes.

### 7.2 The reading frame under fill

```css
/* Under a filling split the frame is a flex column so the viewport can take
   the remaining height. The jadwal is absolutely positioned against the frame
   and is unaffected; the frame keeps position:relative, isolation:isolate and
   overflow:hidden, so the mask and the two pseudo-element rules still frame
   the visible page. */
.quran-reading-frame--fill {
  display: flex;
  flex-direction: column;
  block-size: 100%;
  min-block-size: 0;
}
.quran-reading-frame--fill > .quran-reading-viewport {
  max-height: none;
  min-height: 0;
  flex: 1 1 auto;
}
```

`.quran-reading-viewport` also gains `.overlay-scroll`. It already has `overscroll-behavior: contain`; the class re-declares it identically, which is harmless.

### 7.3 Re-seating the word cue after a layout change

`positionWordCue` (`Quran.tsx:458`) is a module-level pure function; the live word element is already held in `activeWordElementRef` inside `useWordSync`. Resizing the split — or the window, which is a bug today — changes the reading column's width and reflows the ayah, leaving the cue on the wrong word.

Add one additive effect inside `useWordSync`. It touches no timing data, no clock scale, no audio matching:

```ts
// Reflowing the reading column moves every word. The cue is positioned from
// measured rects, so it has to be re-seated whenever the surface's box changes
// — a split-pane drag, a window resize, a font-size change.
useEffect(() => {
  if (surahId === null) return;
  const cue = document.getElementById(`quran-cue-${surahId}`);
  const surface = cue?.offsetParent as HTMLElement | null;
  if (!cue || !surface) return;
  const observer = new ResizeObserver(() => {
    const word = activeWordElementRef.current;
    if (word) positionWordCue(cue, word);
  });
  observer.observe(surface);
  return () => observer.disconnect();
}, [surahId]);
```

`SplitPane`'s `onResizeEnd` is belt-and-braces for the same thing and is what `handleReaderResize` calls; either alone is sufficient, both together are idempotent.

### 7.4 What SplitPane must never do to the mushaf

Non-negotiable, and each is checkable by a test rather than by eye:

1. **`.quran-reading-surface` gains nothing.** No `overflow` (it must stay `visible`), no `border` (it must stay `none`), no `contain`, no `content-visibility`, no `transform`, no `will-change`, no change to `position: relative`. `positionWordCue` measures the cue against this element's padding box while the word's coordinates come from the border box; a border shifts the cue off the spoken word, and making it a scroll container leaves the cue `scrollTop` pixels out.
2. **No pane may be animated with `transform`.** A transform on an ancestor changes what `getBoundingClientRect()` returns for every descendant mid-animation, which desynchronises the cue from the spoken word — a manhaj-relevant defect wearing a motion bug's clothes. The resize writes a grid track. That is the whole mechanism.
3. **No `contain: paint|layout|strict` and no `content-visibility: auto`** on `.quran-reading-viewport` or `.quran-reading-frame`. Both are tempting for a 36,000px surah and both change rect reporting or skip layout of off-screen content.
4. **No virtualization inside `.quran-reading-surface`**, and no `view-transition-name` on it or on any ancestor.
5. **No `position: sticky` descendant of `.quran-reading-viewport`.** `SectionHeader sticky` is forbidden there.

---

## 8. `ListGrouped` — grouped, sticky headers, alpha index

Radio ships 175 unvirtualized rows at 6431px of scroll height. Reminders groups by enabled-then-time with no headers. `ContinueWatching.tsx:62-80` and `RecentlyAdded.tsx:64-80` both compute groups and then throw them away, collapsing each to `items[0]` plus a `+N` counter.

```ts
export interface ListGroup<T> {
  key: string;
  label: string;
  items: readonly T[];
}

export interface ListGroupedProps<T> {
  groups: readonly ListGroup<T>[];
  getKey: (item: T) => string;
  renderRow: (item: T, state: { active: boolean; index: number }) => React.ReactNode;
  density?: RowDensity;               // default 'comfortable'
  /** Estimated px height of one item row. Corrected by measureElement. */
  estimatedRowHeight?: number;        // default 56 / 44 / 38 by density
  stickyHeaders?: boolean;            // default true
  index?: 'none' | 'alpha';           // default 'none'
  /** Bucket letter for a group. Default alphaBucket(group.label). */
  indexBucket?: (group: ListGroup<T>) => string;
  /** Counted across ALL flattened rows including headers. Default 60. */
  virtualizeAfter?: number;
  activeKey?: string | null;
  onActivate?: (item: T, groupKey: string) => void;
  /** 'fill' gives the list its own 100%-height scroll context. */
  height?: 'auto' | 'fill';           // default 'auto'
  scrollElementRef?: React.RefObject<HTMLElement>;
  loading?: boolean;
  skeletonRows?: number;              // default 8
  empty?: React.ReactNode;
  ariaLabel: string;
  className?: string;
}
```

**Flattening.** `rows: Array<{ kind:'header'; groupKey; label; count } | { kind:'item'; groupKey; item }>`. `estimateSize(i)` returns `parseFloat(--group-head-h)` for headers and `estimatedRowHeight` for items; `measureElement` corrects both.

**Sticky headers with virtualization.** `position: sticky` cannot work on absolutely-positioned virtual rows, so the pinned header is a separate element with the standard push:

```tsx
<div className="list-grouped-shell">        {/* position: relative */}
  {stickyHeaders && pinned && (
    <div className="list-grouped-pinned" style={{ transform: `translateY(${pushY}px)` }}>
      <SectionHeader size="sub" title={pinned.label} count={pinned.count} rule="gradient" />
    </div>
  )}
  <div ref={scrollerRef} role="list" aria-label={ariaLabel} className="overlay-scroll …">
    {/* virtual container, height = totalSize */}
  </div>
</div>
```

```ts
const headH = 34;                                       // == --group-head-h
const pinnedIdx = lastIndexWhere(rows, r => r.kind === 'header' && start(r) <= offset);
const nextIdx   = firstHeaderIndexAfter(pinnedIdx);
const pushY = nextIdx === -1 ? 0 : Math.min(0, start(nextIdx) - offset - headH);
```

The next group's header pushes the pinned one up as it arrives, which is the behaviour a reader expects. The `transform` here is on the pinned header inside `ListGrouped` — nowhere near the Quran reading surface.

```css
.list-grouped-shell { position: relative; min-block-size: 0; }
.list-grouped-pinned {
  position: absolute;
  inset-block-start: 0;
  inset-inline: 0;
  z-index: 2;
  block-size: var(--group-head-h);
  background: var(--bg-main);
  pointer-events: none;
}
```

**Alpha index.** `src/utils/alphaBucket.ts`:

```ts
const ARABIC_FOLD: Record<string, string> = {
  'آ': 'ا', 'أ': 'ا', 'إ': 'ا', 'ٱ': 'ا',
  'ة': 'ه', 'ى': 'ي', 'ؤ': 'و', 'ئ': 'ي',
};

/** The bucket letter for a label, in the label's own script.
 *  Harakat are stripped; hamza forms and ta marbuta fold to their base letter. */
export const alphaBucket = (label: string): string => {
  const stripped = label.normalize('NFD').replace(/\p{Mn}/gu, '').trim();
  for (const ch of stripped) {
    if (/\p{Nd}/u.test(ch)) return '#';
    if (/\p{Script=Arabic}/u.test(ch)) return ARABIC_FOLD[ch] ?? ch;
    if (/\p{Script=Latin}/u.test(ch)) return ch.toLocaleUpperCase('en');
  }
  return '#';
};

export const ARABIC_ORDER = [...'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'];
export const LATIN_ORDER  = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
/** Buckets present in the data, ordered by the reading language first. */
export const bucketOrder = (present: Set<string>, language: 'en' | 'ar') => {
  const primary = language === 'ar' ? ARABIC_ORDER : LATIN_ORDER;
  const secondary = language === 'ar' ? LATIN_ORDER : ARABIC_ORDER;
  return ['#', ...primary, ...secondary].filter(b => present.has(b));
};
```

The index rail is `role="listbox"` at `inset-inline-end`, `inline-size: var(--alpha-index-w)`, one 11.5px `tabular-nums` letter per bucket in `text-text-faint`, the bucket containing the current scroll offset in `text-accent-gold`. Only buckets present in the data are rendered — never a dead A–Z ladder. Selecting one calls `virtual.scrollToIndex(headerIndexOf(bucket), 'start')`. Buckets that are not letters (the favourites group) render their `indexBucket` return value; Radio returns `'★'` and the rail renders a `Star` glyph for it.

Index keyboard: roving `tabIndex`, `ArrowDown`/`ArrowUp` move and scroll live, `Enter`/`Space` commit, `Escape` returns focus to the list. Type-ahead on the **list**: a single printable character jumps to that bucket, reset after 500ms.

**Virtualization.** Threshold 60 flattened rows. Radio's 175 stations plus ~20 headers is 195 rows — virtualized, ~15 in the DOM. `estimatedRowHeight={68}` for Radio (a 40px ring inside `0.875rem` block padding).

**Empty.** Per group: a group with zero items is not rendered. Whole-list empty: the `empty` node, or the default strip. Radio's `Radio.tsx:212` bare `<p>` is replaced by a designed `EmptyState`.

**Loading.** `skeletonRows` rows plus one header skeleton, at the real `estimatedRowHeight`. Retires Radio's `Radio.tsx:173-178` spinner.

**RTL.** Index rail at `inset-inline-end`; `.rule-row-active`'s inset marker already flips (`index.css:1152-1158`); the pinned header uses `inset-inline: 0`.

**Call sites.** Radio's full catalogue (`Radio.tsx:200-227`), the Quran reciter surah list (`Quran.tsx:1487`, `index="none"`), Reminders grouped by repeat schedule, and the two Dashboard groupers, which finally show their groups instead of discarding them.

---

## 9. `ListCompact` — dense rows

```ts
export interface ListCompactProps<T> {
  items: readonly T[];
  getKey: (item: T, index: number) => string;
  renderRow: (item: T, state: { active: boolean; index: number }) => React.ReactNode;
  density?: RowDensity;               // default 'compact'
  estimatedRowHeight?: number;        // default 56 / 44 / 38 by density
  activeKey?: string | null;
  onActivate?: (item: T, index: number) => void;
  virtualizeAfter?: number;           // default 60
  scrollElementRef?: React.RefObject<HTMLElement>;
  height?: 'auto' | 'fill';           // default 'auto'
  loading?: boolean;
  skeletonRows?: number;              // default 6
  empty?: React.ReactNode;
  ariaLabel: string;
  className?: string;
}
```

The container is `.rule-list` (`index.css:1130`), which already suppresses the last row's border. Each row is `.rule-row` plus the density modifier from §1.8, and `.rule-row-active` when `getKey(item) === activeKey`. `renderRow` supplies the row's inside only; the block owns the row shell, the density, the active state and the focus ring (`.rule-row:focus-visible` already resolves to `--ring-focus` at `index.css:1379-1386`).

**Media inside a row** goes through `<MediaFrame ratio="16/9" className="w-[104px]">` — one size for every row thumbnail, retiring the 112×63 / 104×58 / 96×54 / `w-56` spread.

**Virtualization.** Threshold 60. When enabled, `.rule-list` gets `position: relative; height: totalSize` and rows are absolutely positioned with `insetInlineStart: 0; insetInlineEnd: 0; transform: translateY(...)`. The last-child border suppression stops working under absolute positioning, so under virtualization the block sets `data-virtual="true"` and CSS handles it:
```css
.rule-list[data-virtual='true'] > .rule-row[data-last='true'] { border-bottom: 0; }
```

**Empty.** Default strip; callers pass designed states. This is where `PlaylistDetail.tsx:288-298`'s two bare `<p>`s and `Settings.tsx:511`'s bare `<p>` are replaced.

**Loading.** `skeletonRows` rows at the real density, each with a `ratio-16x9 w-[104px]` `Skeleton` when the caller's rows carry media (`hasMedia` inferred from the first rendered row is fragile — pass it as part of `skeletonRows`' shape by having the caller supply a `skeleton?: React.ReactNode`; default is a media-less two-line row).

**Keyboard.** Roving over rows per §1.6. `Enter`/`Space` calls `onActivate`.

**RTL.** Inherited from `.rule-row`'s existing `[dir='rtl']` hover, active and marker rules.

**Call sites.** Dashboard In Progress (`Dashboard.tsx:320`), `QueuePanel`/`QueueRow`, `SearchResults`' two `.rule-list`s, `PlaylistDetail.tsx:200`'s video list, `RecentlyAdded.tsx:150`, `ContinueWatching.tsx:283` — six of the seven rival list-row treatments collapse into this one. (The seventh, `Sidebar.tsx:97-104`, is nav chrome and stays.)

---

## 10. `StatStrip` — Library's four counts

Six rival treatments today: `Dashboard.tsx:196-217`, `Dashboard.tsx:146-190`, `Library.tsx:404-420`, `PlaylistDetail.tsx:174-185`, `Reminders.tsx:279-295`, `Settings.tsx:735-746`. Value/label order is already inconsistent — Library puts `<dd>` before `<dt>`, Dashboard puts the label first.

```ts
export interface Stat {
  id: string;
  label: string;
  /** Pre-formatted and localised by the caller (toLocaleString, formatDuration). */
  value: string;
  hint?: string;
  tone?: 'default' | 'warning' | 'danger' | 'success';   // default 'default'
  icon?: LucideIcon;
  /** 0–100. Draws a hairline meter under the value. */
  meterPercent?: number;
  onSelect?: () => void;
}

export interface StatStripProps {
  stats: readonly Stat[];
  /** Defaults to clamp(stats.length, 2, 4). */
  columns?: 2 | 3 | 4;
  emphasis?: 'display' | 'quiet';   // default 'display'
  rule?: 'band' | 'none';           // default 'band'
  loading?: boolean;
  ariaLabel: string;
  className?: string;
}
```

**Order is fixed: value first, label as a caption.** The markup stays valid `<dl>` (`<dt>` before `<dd>`, which is also the order a screen reader should hear) and the visual order is flipped in CSS, so the eye lands on the number and assistive tech hears the label first:

```css
.stat-cell { display: flex; flex-direction: column-reverse; }
```

Value: `text-xl font-semibold tabular-nums tracking-[-0.01em] text-text-primary` in `display`, `text-sm font-medium` in `quiet`. Label: `.section-eyebrow` at `text-[11px]`, `text-muted-text`. Both wrapped in `<bdi>`. `tone` recolours the **value only** (`text-warning-orange` / `text-danger-red` / `text-success-green`); the label never changes colour, so a warning does not repaint the whole cell.

**Band.** `rule="band"` is `border-y border-border` on the `<dl>`, with each cell after the first carrying `sm:border-s sm:border-border` and `first:ps-0` — the existing Library treatment, logical properties already correct. `rule="none"` drops both.

**Meter.** `meterPercent` draws a `h-px` rail with a `bg-accent-gold` fill and a track of `rgb(var(--text-muted-rgb) / 0.18)` — one of the ten meter treatments, chosen as the canonical caption-scale one. `MediaFrame` owns the over-media meter; this owns the in-text one; `ProgressMeter` in `PlaylistCard.tsx:186` owns the card one. Three, down from ten, each with a distinct job.

**Interactive cells.** `onSelect` makes the cell a `<button>` with `.rule-row`'s hover wash and the shared focus ring. This is how the recovery functions escape `/settings`: Reminders' broken-targets metric (`Reminders.tsx:186`, which today has no action at all despite `remove_orphaned_entries` being exactly the fix) becomes a `Stat` with `tone="warning"` and an `onSelect`.

**Empty.** A `Stat` with no data passes `value: '—'`. The strip never renders a zero-length list; if `stats` is empty it returns `null`.

**Loading.** `columns` cells each holding a `shape="line" className="h-5 w-16"` over a `shape="line" className="h-2 w-12"`. Same band, same height, no reflow.

**Keyboard.** Non-interactive cells are not focusable. Interactive cells are ordinary tab stops in reading order.

**RTL.** Logical borders only; `tabular-nums` keeps columns aligned in both languages; `<bdi>` on every value and label.

**Call site — Library.** `Library.tsx:358-362` builds `[playlists, videos, watchTime, completed]` and `Library.tsx:417-436` renders the `<dl>`. It becomes:
```tsx
<StatStrip ariaLabel={t('library')} stats={[
  { id: 'playlists', label: t('playlists'),  value: librarySummary.playlists.toLocaleString() },
  { id: 'videos',    label: t('videosLower'),value: librarySummary.videos.toLocaleString() },
  { id: 'time',      label: t('watchTime'),  value: formatDuration(librarySummary.seconds, language) },
  { id: 'done',      label: t('completed'),  value: librarySummary.completed.toLocaleString() },
]} />
```
`formatDuration` already handles the U+2067 RLI wrapping that `1س 0د` needed.

---

## 11. `ChipRow` — category filters with overflow

Eight chip treatments ship: `PlaylistCard.tsx:227` (`Chip`), `.premium-pill` on five pages, `Library.tsx:637-645`, `Watch.tsx:190-196`, `Hero.tsx:114-121`, `Sidebar.tsx:69-71`, `.media-badge`, and `QueuePanel.tsx:92` — the last painted in `primary-blue`, a dead accent.

```ts
export interface ChipModel {
  id: string;
  label: string;
  count?: number;
  icon?: LucideIcon;
  disabled?: boolean;
}

export interface ChipRowProps {
  chips: readonly ChipModel[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  mode?: 'single' | 'multi';        // default 'single'
  /** 'wrap' flows to multiple lines; 'scroll' is a one-line rail with mask
   *  fades; 'collapse' shows `collapseAfter` then a "Show all" disclosure. */
  overflow?: 'wrap' | 'scroll' | 'collapse';   // default 'wrap'
  collapseAfter?: number;           // default 8
  size?: 'sm' | 'md';               // default 'md'
  onClear?: () => void;
  clearLabel?: string;
  loading?: boolean;
  skeletonCount?: number;           // default 6
  empty?: React.ReactNode;
  ariaLabel: string;
  className?: string;
}
```

**Chip material.** One class, three states, no per-theme code:

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 9999px;
  padding: 0.375rem 0.875rem;
  font-size: var(--fs-cap);
  color: rgb(var(--text-muted-rgb));
  border: 1px solid transparent;
  background: transparent padding-box, var(--edge-1) border-box;
  transition: color var(--dur-fast) var(--ease-out),
              background var(--dur-fast) var(--ease-out);
}
.chip:hover:not(:disabled) {
  color: rgb(var(--text-main-rgb));
  background: var(--wash-hover) padding-box, var(--edge-2) border-box;
}
[dir='rtl'] .chip:hover:not(:disabled) { background: var(--wash-hover-rtl) padding-box, var(--edge-2) border-box; }
.chip[aria-pressed='true'] {
  color: rgb(var(--text-main-rgb));
  background: linear-gradient(177deg,
    rgb(var(--accent-gold-rgb) / 0.13),
    rgb(var(--accent-gold-rgb) / 0.05)) padding-box,
    var(--edge-accent) border-box;
  box-shadow: inset 0 1px 0 rgb(var(--sheen-rgb) / 0.05);
}
.chip:focus-visible { outline: none; box-shadow: var(--ring-focus); }
.chip:disabled { opacity: 0.5; cursor: not-allowed; }
.chip-sm { padding: 0.25rem 0.625rem; }
@media (prefers-reduced-motion: reduce) { .chip { transition: none; } }
```

That is `.premium-pill`'s own material at pill radius, so a selected chip and a page eyebrow are visibly the same object family. `.premium-pill` stays for eyebrows; `Chip` in `PlaylistCard.tsx:227` (the over-media duration/category pill) is replaced by `.media-badge`, which is the correct surface for something sitting over an unknown ground.

**Count.** `<span className="tabular-nums text-text-faint"><bdi>{count}</bdi></span>` — never concatenated into the label.

**Overflow — `scroll`.** Reuses `rails/Rail.tsx`'s scroller, mask fades and paging arithmetic verbatim, with `itemWidth` unknown, so `pageAmount = clientWidth * 0.8`.

**Overflow — `collapse`.** Renders `collapseAfter` chips plus a trailing `.quiet-action` reading `{t('showAll')} <bdi>{hidden}</bdi>`, toggling to `{t('showFewer')}`. The disclosure carries `aria-expanded` and `aria-controls` on the chip container. A **selected** chip is always visible: selected chips sort ahead of the collapse boundary so the current filter is never hidden behind a disclosure.

**Empty.** `chips.length === 0` returns `null` unless `empty` is given. Library's category rail (`Library.tsx:629-648`) is already conditional on `showCategoryRail`.

**Loading.** `skeletonCount` `shape="pill" className="h-7 w-20"` skeletons.

**Keyboard.** `role="group"` with `aria-label`; roving `tabIndex` across chips; `ArrowRight`/`ArrowLeft` mapped through `dir`; `ArrowDown`/`ArrowUp` also move by one in `wrap` mode (a wrapped row is visually two-dimensional but logically linear — document this rather than implement geometric navigation); `Home`/`End`; `Enter`/`Space` toggles. In `single` mode each chip is `aria-pressed` and selecting one deselects the rest; in `multi` mode chips are independent. `onClear` renders a trailing `.quiet-action` that is a normal tab stop after the roving group.

**RTL.** Wrap direction and arrow mapping both follow `dir`; no physical margins.

**Call sites.** `Library.tsx:629-648` category rail (`mode="single"`, `overflow="collapse"`, `collapseAfter={8}` — the taxonomy has 17 entries), `Watch.tsx`'s `SearchSuggestions` (`Watch.tsx:475-497`, `mode="single"`, `overflow="wrap"`), `PlaylistDetail`'s filters, `Quran`'s riwayah selector (`mode="single"`, exactly two chips, **and the two must never be simultaneously selectable** — `single` mode guarantees it).

---

## 12. Verification

Everything below is checked by rendering, through the harness already at `scripts/harness/`, across 5 themes × 2 languages. Add to `scripts/harness/probe.mjs`:

1. **No path on a face.** For every card/row in `/library`, `/watch`, `/downloads`: assert no rendered `textContent` and no `title` attribute matches `/^[a-zA-Z]:[\\/]|^\\\\/`. The one permitted region is `#settings-imported-folders`.
2. **Aspect is locked.** Collect every `.media-frame` in a grid or rail and assert `getBoundingClientRect().width / height` is within 0.5% of the declared ratio, and that all frames within one `GridMedia` agree.
3. **Radio is virtualized.** `/radio` scroller `scrollHeight` under 3000px at 1280×800 with the 175-station fixture, and the count of rendered `.rule-row` elements under 40.
4. **The Quran left pane fills.** At 1920×1080, `/quran`: the surah index's scroller `clientHeight` is within 8px of `window.innerHeight` minus the masthead, tabs and attribution; `.page-container` on that route has `scrollHeight === clientHeight`.
5. **The invariants hold.** Assert `getComputedStyle('.quran-reading-surface').overflow === 'visible'`, `.borderStyle === 'none'`, `.transform === 'none'`, `.contain === 'none'`; and that `.quran-reading-viewport` has no `content-visibility` other than `visible`.
6. **The cue tracks a resize.** Drive the `#quran-read` split handle from 320px to 420px, then assert the `.quran-word-cue`'s bounding box still intersects the `.quran-word-active` element's box by ≥80% of the cue's area.
7. **Rails fade only where there is content.** With the rail scrolled to 0, assert `--fade-left` (LTR) / `--fade-right` (RTL) computes to `0px`; after `pageBy(1)`, assert it is non-zero.
8. **RTL rails scroll the right way.** In `ar`, click the forward paging button and assert `scrollLeft` **decreased**.
9. **Split position persists.** Set a fraction, reload the harness page, assert the grid's first track matches within 1px.
10. **One header shape.** Assert the set of distinct computed `(fontSize, fontWeight, textTransform, letterSpacing, color)` tuples across all `h2`/`h3` section headings on all eight routes has cardinality ≤ 2 (one for `section`, one for `sub`).
11. **`text-white` / `bg-black` count is 0** in `src/components/blocks/`, and `rgba(` count is 0 in every file the blocks add.

`npx tsc --noEmit` and `npm run build` must pass. `cargo test` (13 tests) cannot run in a Linux container (gdk-3.0 missing) and is unaffected — no Rust changes are proposed; `open_file_location` already exists and is already registered.

---

## 13. Migration map

| Existing site | Block | Note |
|---|---|---|
| `PlaylistGrid.tsx:99-116` `SectionRule` | `SectionHeader size="sub"` | delete after one release |
| `ContinueWatching.tsx:22-28` `useEyebrowClass` | `.section-eyebrow` | delete the hook |
| `Settings.tsx:749-761` `Section` | `SectionHeader size="sub"` | 8 sites |
| `QueuePanel.tsx:83-97` | `SectionHeader size="section"` | kills a `primary-blue` pill |
| `Watch.tsx:400-424` `WatchHistoryRow` | `RailWide` | first real rail |
| `PlaylistGrid.tsx:78-84` showcase (`SHOWCASE_MAX`) | `RailPoster` | delete `SHOWCASE_MAX` |
| `ContinueWatching.tsx:124-130` rest column | `RailPoster` | removes a hand-rolled split |
| `Radio.tsx:200-227` `StationSection` | `RailStation` (favourites) + `ListGrouped` (catalogue) | fixes 6431px |
| `PlaylistGrid.tsx:11` / `Watch.tsx:130` / `Radio.tsx:220` | `GridMedia` | one track system |
| `Quran.tsx:1487` 3-col surah grid | `ListGrouped index="none"` | fixes dangling hairlines |
| `Quran.tsx:227,1393` · `Downloads.tsx:148` · `Dashboard.tsx:225` · `ContinueWatching.tsx:124` | `SplitPane` | 4 gutters → 1 |
| `Dashboard.tsx:320` · `QueueRow` · `SearchResults` · `PlaylistDetail.tsx:200` · `RecentlyAdded.tsx:150` · `ContinueWatching.tsx:283` | `ListCompact` | 6 row treatments → 1 |
| `Library.tsx:404-420` · `Dashboard.tsx:196-217` · `PlaylistDetail.tsx:174-185` · `Reminders.tsx:279-295` · `Settings.tsx:735-746` | `StatStrip` | 6 → 1 |
| `Library.tsx:637-645` · `Watch.tsx:475-497` · `PlaylistCard.tsx:227` | `ChipRow` / `.media-badge` | 8 chip shapes → 2 |
| `PlaylistCard.tsx:337,435,532` · `SearchResults.tsx:92` · `PlaylistDetail.tsx:150` | `OverflowMenu` "Show in folder" | 5 path renders → 0 |

Sequencing: `SectionHeader` → `ChipRow` → `StatStrip` (no new infrastructure, 40+ call sites, immediately visible) → `MediaFrame` + `ListCompact` → `ListGrouped` + the virtualization hook (fixes Radio) → `GridMedia` → the three rails → `SplitPane` last, because the Quran fill-height change is the one with a load-bearing invariant behind it and it wants the harness assertions from §12 already in place.


## Risks

- **The Quran fill-height change is the highest-risk item in the set. Making `/quran` a non-scrolling page (`.page-container-fixed`) and letting `SplitPane fill` size the reading frame changes the box that `positionWordCue` measures. If any implementer reaches for the obvious optimisations — `contain: paint` on `.quran-reading-viewport`, `content-visibility: auto` on the long ayah flow, a `transform`-driven resize animation, or a `view-transition-name` on the pane — the word cue silently desynchronises from the spoken word. It will look like a motion bug and it is a manhaj defect.**
  - Mitigation: §7.4 lists the five forbidden operations explicitly, and §12 items 5 and 6 turn them into harness assertions: computed `overflow`/`border-style`/`transform`/`contain` on `.quran-reading-surface`, and a drag-then-measure test that the cue still covers ≥80% of the active word after the split moves from 320px to 420px. Ship SplitPane last, after those assertions are already green on the unmodified page, so a regression is attributable to one commit.
- **`RailPoster` is specified as a 2:3 card containing a 16:9 media band, because no 2:3 source art exists and cropping a 16:9 video frame to 2:3 discards two-thirds of the frame. If the owner reads "2:3 poster" as "the image is 2:3", the delivered rail will not match the expectation.**
  - Mitigation: The composition and its reasoning are stated in §1.2 and §3. If a true 2:3 poster is wanted, the route is a build script beside `scripts/build-jadwal-svg.py` that generates poster-proportioned geometry per playlist seed — `PlaylistArt` already fills any box and is manhaj-safe by construction — not a crop of user video frames. Resolve before RailPoster is built; it changes only `MediaFrame`'s ratio argument, not the props contract.
- **`@tanstack/react-virtual` is the only new dependency and it is load-bearing for three blocks. If it is later removed or its API shifts, three blocks break at once.**
  - Mitigation: Every page imports through `src/hooks/useVirtualRows.ts`; no page imports the library. The hook's `VirtualRows` return type is the whole contract and a hand-written windowing implementation behind the same interface is roughly 120 lines. Threshold 60 also means small collections never enter the code path at all, so a failure is confined to Radio's catalogue and libraries past 60 items.
- **The `mask-image` edge fade promotes each rail scroller to its own compositor layer. Several rails on one route, plus the Part II ambient layer's Tier 2/3 work, could jointly exceed the ambient system's 40MB GPU ceiling on a 4K panel.**
  - Mitigation: `maxItems` defaults to 24 per rail with a dev warning above it, `GridMedia` gets no mask at all, and the mask is a two-stop linear gradient with no blur and no animation. If measurement shows pressure, the fallback is to drive `--fade-left`/`--fade-right` to `0px` whenever the ambient layer reports Tier 3 — one line in `useRailScroll`, no layout change.
- **Deleting the folder path from five card faces removes the only way a user currently distinguishes two playlists with the same folder name, and "Show in folder" is buried one click deeper in an overflow menu.**
  - Mitigation: The path moves to `OverflowMenu` as a first-class action rather than being deleted, and `revealPath` is carried on every `MediaCardModel` so it is available everywhere a card appears — today it is on four surfaces out of the seven that show cards. If same-name collisions prove real in the fixture library, the disambiguator should be the parent folder's basename in `MediaCardModel.subtitle`, which is a name and not a path, not a return of the truncated `C:\Users\…` string.
- **`ListGrouped`'s alpha index assumes station and reciter names begin with a letter in a script the bucket function recognises. Real radio catalogues contain names beginning with digits, Latin/Arabic mixes, and leading definite articles ("Al-", "الـ"), which will scatter half the catalogue into `#` or bunch it under A and ا.**
  - Mitigation: `alphaBucket` strips harakat via NFD and folds hamza forms and ta marbuta, and `bucketOrder` renders only buckets present in the data so a scattered index is visible immediately rather than showing a dead A–Z ladder. Leading-article folding is deliberately not included — it is a judgement call about the catalogue and should be added as an opt-in `indexBucket` override on the Radio call site after looking at the real 175-station fixture, not baked into the shared utility.

## Open questions

- RailPoster's 2:3 frame: accept the 16:9-media-band-inside-a-2:3-card composition specified here, or commission a `scripts/build-poster-art.py` that emits true 2:3 geometric posters from the playlist seed (the PlaylistArt mark family already exists and is aspect-agnostic)? This is the only decision in the spec that changes a visible outcome rather than an implementation detail.
- Should `/quran` be the only route that becomes non-scrolling (`.page-container-fixed`), or should `/library`, `/radio` and `/downloads` follow so that their filter toolbars and stat strips stay pinned while the content scrolls? The recon measures 473px of dead space on Watch and 371px on Reminders, which a fill-height layout would absorb — but it is a per-route change with its own scroll-restoration consequences and is out of scope here.
- Radio's catalogue currently renders in two columns (`Radio.tsx:220`). The spec moves it to a single virtualized column at `max-w-3xl` because grouped sticky headers and an alpha index only work in one column. Confirm that a single column of 175 stations is acceptable, or the alpha index has to be dropped in favour of a two-column masonry with no grouping.
- `SplitPane`'s persisted key `salafi-hub.split.<id>` is deliberately not riwayah-tagged, since it stores only a fraction and a collapsed flag. Confirm this reading of the riwayah rule — the alternative is to tag it anyway, which costs nothing but means switching riwayah resets the reader's pane width.
- `useKeyboardShortcuts.ts:22` returns early unless `isPlayerOpen`, so there is no global key handler for the blocks' Home/End/PageUp/PageDown to coexist with. Should the ten blocks own their key handling locally (as specified), or wait for the CommandPalette block to establish a global keymap that arbitrates? Local handling is specified because it is self-contained, but it will need auditing when CommandPalette lands.
