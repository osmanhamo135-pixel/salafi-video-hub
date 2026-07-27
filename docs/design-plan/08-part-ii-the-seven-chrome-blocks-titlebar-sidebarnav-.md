# Part II — The Seven Chrome Blocks: TitleBar, SidebarNav, PlayerDocked, PlayerExpanded, CommandPalette, ToastStack, SheetSettings

## 0. Shell contract (read this first — every block below depends on it)

### 0.1 Stacking order

The app has six ad-hoc z-values today (`z-10`, `z-20`, `z-30`, `z-40`, `z-50`, `z-[9999]` at `src/components/playlist/PlaylistMenu.tsx:90`). Replace with one scale declared in the shared `:root` block of `src/index.css` (beside `--r-sm`/`--dur-press`, around line 392):

```css
--z-ground: 0;    /* AmbientLayer (Part II ambient contract) */
--z-raise: 10;    /* in-card overlays: progress veils, hover scrims */
--z-sticky: 20;   /* .quran-toolbar (Quran.tsx:918) */
--z-stage: 25;    /* MediaStage video layer */
--z-dock: 30;     /* PlayerDocked — in flow, but its own stacking context */
--z-menu: 40;     /* PlaylistMenu, Quran toolbar menus */
--z-overlay: 50;  /* CommandPalette, SheetSettings, ReminderModal, ReminderAlarm */
--z-toast: 60;    /* ToastStack */
--z-titlebar: 80; /* TitleBar — above everything, always draggable */
```

Expose as Tailwind `zIndex` keys in `tailwind.config.js` (`ground`, `raise`, `sticky`, `stage`, `dock`, `menu`, `overlay`, `toast`, `titlebar`). No component may write a numeric z again.

### 0.2 Layout skeleton

`src/App.tsx` becomes a three-row column; `src/components/layout/AppShell.tsx` stops being the outermost box:

```
<div class="app-container flex-col">        <!-- existing -->
  <TitleBar />                              <!-- row 1: 36px, z-titlebar -->
  <div id="app-shell" class="min-h-0 flex-1">
    <AppShell>  <SidebarNav /> <main class="app-ground"> {routes} </main> </AppShell>
  </div>
  <PlayerDocked />                          <!-- row 3: var(--dock-h), full width -->
  <MediaAudio />  <MediaStage />            <!-- no layout box -->
  <div id="overlay-root" />                 <!-- sibling of #app-shell, see 0.3 -->
  <ToastStack /> <ReminderAlarm /> <UpdateManager />
</div>
```

The dock spans full width **below** the sidebar, not beside it. This is what buys the seek bar its width and what removes the `fixed bottom-5 end-5` float that currently sits over the last row of every list and over `.quran-reading-viewport`.

`--dock-h` lives on `:root` and is written by `PlayerDocked` only:

```css
--dock-h: 0px;          /* no lane, no suspended lane */
--dock-h-bar: 64px;     /* normal */
--dock-h-strip: 44px;   /* collapsed */
```

### 0.3 Overlay root

`#overlay-root` is positioned `absolute; inset: 0;` **inside the row that holds `#app-shell`** — not inside `.app-container`. Consequence: a modal scrim covers the content and the dock but never the TitleBar, so the user can always drag, minimise, maximise and close the window while a dialog is open. This is Windows behaviour and it fixes a real trap in `ReminderAlarm.tsx:215` (`fixed inset-0 z-50`) which today makes the window unclosable while the alarm is up.

### 0.4 Focus primitive

New file `src/hooks/useFocusTrap.ts`. Used by CommandPalette, SheetSettings, PlayerExpanded-fullscreen; retrofit `ReminderModal.tsx` and `ReminderAlarm.tsx`.

```ts
export interface FocusTrapOptions {
  active: boolean;
  containerRef: React.RefObject<HTMLElement>;
  /** Focused on activate. Falls back to the first tabbable node. */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Focused on deactivate. Falls back to the element focused before activation. */
  returnFocusRef?: React.RefObject<HTMLElement>;
  /** Applies `inert` to #app-shell and PlayerDocked while active. Default true. */
  inertBackground?: boolean;
  onEscape?: () => void;
}
export function useFocusTrap(options: FocusTrapOptions): void;
```

Uses the `inert` attribute (WebView2 is Evergreen Chromium; `inert` is supported) rather than `aria-hidden`, because `inert` also removes pointer targets. Never applies `inert` to `#overlay-root` or `TitleBar`.

### 0.5 Global keymap

`src/hooks/useKeyboardShortcuts.ts` returns early unless `isPlayerOpen` (`:22`), so nothing outside `/player` has a key. Replace with `src/hooks/useGlobalKeymap.ts`, mounted once in `App.tsx`.

```ts
export type KeyScope = 'base' | 'dock' | 'stage' | 'overlay';

export interface KeyBinding {
  /** Normalised: 'Ctrl+K', 'Shift+/', 'Space', 'ArrowRight'. Ctrl means Ctrl on Windows. */
  combo: string;
  scope: KeyScope;
  /** Higher scope wins. 'overlay' swallows everything not listed in it. */
  run: (event: KeyboardEvent) => void;
  /** Default true. Set false for bindings that must not steal from the platform. */
  preventDefault?: boolean;
}
export function useGlobalKeymap(bindings: KeyBinding[], scope: KeyScope): void;
```

Two guards the current implementation is missing and that are mandatory:

1. **Typing guard.** Ignore when `event.target` matches `input, textarea, select, [contenteditable=""], [contenteditable="true"]`. The existing check (`useKeyboardShortcuts.ts:25`) covers `INPUT|TEXTAREA|SELECT` and must additionally cover `contenteditable`.
2. **Space guard.** `Space` is only bound when the active element is `document.body` or lives inside `PlayerDocked`'s transport group. If a `<button>` has focus, Space belongs to that button. The current global `case ' '` would both activate a focused button and toggle playback.

`Escape` never bubbles past the topmost `overlay`-scope consumer.

---

## 1. TitleBar

### 1.1 What the audit got wrong, precisely

`src-tauri/tauri.conf.json` already sets `decorations: false`, `windowEffects` is `null`, and `src/components/layout/TitleBar.tsx` (50 LOC) already draws a themed 36px drag strip with three window buttons wired to `getCurrentWindow().minimize/toggleMaximize/close`. **There is no native-chrome problem and nothing to build from scratch.** Double-click-to-maximise already works — it is built into `data-tauri-drag-region`, as the file comment at `:10` says.

Six concrete defects remain. This is the whole scope of the block.

| # | Defect | Site | Fix |
|---|---|---|---|
| 1 | `hover:text-white` — a hardcoded colour, one of the 24 the audit counts | `TitleBar.tsx:42` | `hover:text-on-danger` (new token, §1.2) |
| 2 | Maximise icon never swaps to restore | `TitleBar.tsx:37` (`<Square>` always) | Subscribe to `appWindow.onResized` + `isMaximized()`; render `Square` / `Copy` |
| 3 | `tabIndex={-1}` on all three buttons — window controls are keyboard-unreachable | `:27, :35, :46` | Remove. Add `aria-label` from `TranslationKey`s `windowMinimize` / `windowMaximize` / `windowRestore` / `windowClose` |
| 4 | No blur dim — the frame looks focused when the window is not | — | `useWindowFocus()` → `data-window-blurred` on `<header>`; drops glyph colour to `text-text-faint` and the bottom hairline to `border-faint` |
| 5 | No surface-profile variance | — | §1.3 |
| 6 | Sits below overlays; a modal makes the window unclosable | `App.tsx:62` order | `z-titlebar`, and `#overlay-root` scoped below it (§0.3) |

`TitleBar` does **not** gain a title, an icon, or a menu. The comment at `:18` is right: the sidebar carries the brand, and the app name must not appear twice.

### 1.2 Tokens

New token pair, declared once in the shared block of `src/index.css` beside `--danger-rgb` (line 76):

```css
--danger-rgb: 239 68 68;
/* On-colour for a danger fill. Safe as a single value ONLY because
   --danger-rgb is theme-invariant: all ten themes inherit this line and
   none overrides it. If a theme ever declares its own --danger-rgb it MUST
   declare --text-on-danger-rgb with it. */
--text-on-danger-rgb: 255 255 255;
```

`tailwind.config.js` colours: `'on-danger': 'rgb(var(--text-on-danger-rgb) / <alpha-value>)'`.

Everything else is existing tokens: `bg-sidebar`, `border-b border-border`, `text-muted-text` → `hover:text-text-primary`, `hover:bg-panel-hover`, `hover:bg-danger-red hover:text-on-danger` on close only, `--dur-press` for the hover colour transition, `--ring-focus` for `:focus-visible`.

### 1.3 Surface profiles

Per-profile treatment via one attribute selector each, in `index.css` — no per-theme component code:

```css
:root[data-surface-profile='pure-black']   .app-titlebar { border-bottom-color: transparent; }
:root[data-surface-profile='light']        .app-titlebar { border-bottom-color: var(--hair-strong); }
```

`data-surface-profile` is written in `App.tsx`'s theme effect from a single map (`noor|blue|samaa → cool`, `maktabah|mushaf-gold|emerald → warm`, `onyx → pure-black`, `pearl → light`, `mushaf|red → cool`).

### 1.4 Props

```ts
export interface TitleBarProps {
  /** Left/start slot, before the drag region. Reserved for the future
   *  breadcrumb; unused at ship. Never the app name. */
  lead?: React.ReactNode;
  /** Extra controls immediately before the window buttons (e.g. a "pin on
   *  top" toggle). Rendered outside the drag region. */
  actions?: React.ReactNode;
}
```

### 1.5 Keyboard, focus, RTL

- **Keyboard.** The three buttons join the normal tab order, after the sidebar and content (they are last in DOM order because the drag region precedes them, which is also correct for a title bar). No shortcut is registered — `Alt+F4` and `Win+Arrow` belong to the OS and must reach it, so `useGlobalKeymap` never calls `preventDefault` on `Alt`- or `Meta`-modified events.
- **Focus.** `:focus-visible` uses `--ring-focus`, inset by 2px so the ring is not clipped by the 36px row. Never `inert`ed.
- **RTL.** *Exception to the app's logical-property rule.* Window buttons stay at the **physical right** in both languages — `margin-left: auto`, not `ms-auto`. On Windows the top-right 3×46px region is the snap-layouts hover zone and the OS close affordance; mirroring it is a bug, not localisation. The drag region uses `flex-1` so it fills whatever is left. The `lead` slot uses logical `ps-*`.

---

## 2. SidebarNav

### 2.1 What changes

`src/components/layout/Sidebar.tsx` is good — grouped nav, inset 3px active marker with an explicit `rtl:` counterpart (`:104`), gradient ground, brand block. Four changes:

1. **Kill the `w-0` collapse.** `Sidebar.tsx:47,52-54` sets `w-0 opacity-0` on `/player`. That is the reason there is no "browse while watching". With `PlayerDocked` + `MediaStage`, `/player` is an expanded view the user leaves at will, so the nav must stay. Replace with the 64px rail (below), and let `PlayerExpanded` request `collapsed` rather than annihilation.
2. **Collapse to a 64px icon rail**, persisted to `localStorage['salafi-hub.sidebar-collapsed.v1']`.
3. **Glass.** Permitted here — persistent chrome, static backdrop, never over the reading surface or a playing video. `.app-sidebar` gains `background: rgb(var(--bg-sidebar-rgb) / 0.72); backdrop-filter: blur(20px) saturate(1.2)` **only** under `:root[data-surface-profile='cool']`; `warm` gets `/0.82` + `blur(14px)`; `light` and `pure-black` get full opacity and no filter (Pearl because translucency over a light ground reads as dirt; Onyx because there is nothing behind it to see). One rule per profile, zero per-theme code.
4. **Badge and count slots** on nav items (Downloads: active count; Reminders: today's count).

### 2.2 Props

```ts
export interface SidebarNavItem {
  path: string;
  labelKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
  /** Rendered as a count chip at the row's end. Hidden at 0 and when null. */
  badge?: number | null;
  /** Tone of the badge. 'quiet' = border only; 'active' = accent-gold wash. */
  badgeTone?: 'quiet' | 'active';
}

export interface SidebarNavGroup {
  labelKey: TranslationKey | null;
  items: SidebarNavItem[];
}

export interface SidebarNavProps {
  groups?: SidebarNavGroup[];        // defaults to the module-level navGroups
  collapsed?: boolean;               // controlled; omit for internal + persisted
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Forces the rail regardless of user preference. PlayerExpanded passes true. */
  forceCollapsed?: boolean;
}
```

### 2.3 Rail specification

| | Expanded | Rail |
|---|---|---|
| Width | `240px` | `64px` |
| Brand | 56px mark + name + stage chip + tagline | 40px mark only, centred |
| Group label | `text-[10px] uppercase tracking-[0.14em] text-text-faint` | replaced by a `border-t border-border-faint` 1px rule with `mt-3 pt-3` |
| Item | icon + label | icon centred; label in a delayed tooltip (400ms) |
| Active marker | `shadow-[inset_3px_0_0_rgb(var(--accent-gold-rgb))]` | unchanged — the marker is what makes the rail legible |
| Footer | `Sparkles` + two lines | omitted |

Width transition: `width var(--dur-normal) var(--ease-standard)`; labels use `opacity` + `visibility` with `transition-behavior: allow-discrete`, never `display` toggling mid-transition. Under `prefers-reduced-motion` the global collapse rule in `index.css:2350` already reduces this to a 0.01ms step — no extra work.

### 2.4 Keyboard & focus

| Key | Scope | Action |
|---|---|---|
| `Ctrl+B` | base | toggle rail |
| `Alt+1`…`Alt+8` | base | jump to the Nth nav item in DOM order |
| `ArrowDown`/`ArrowUp` | inside `<nav>` | roving focus across items, wrapping, skipping group labels |
| `Home`/`End` | inside `<nav>` | first / last item |

`<nav>` carries `aria-label={t('navigation')}`. Roving tabindex: exactly one item has `tabIndex={0}` — the active route's, or the first item if the route is `/player`. `NavLink` already emits `aria-current="page"`. In the rail, each item gets `aria-label={t(labelKey)}` because the visible label is gone; the tooltip is `aria-hidden`.

When `forceCollapsed` flips, focus must not be lost: if the focused element is inside the sidebar, keep it focused (only the label disappears, the button survives).

### 2.5 RTL

`html.dir` is pinned to `'ltr'` (`App.tsx:45`) and stays pinned — the shell does not mirror when the UI language is Arabic. So:

- Arabic **content** in nav labels renders RTL inside the row via `dir="auto"` on the `<span>`. The row itself keeps `gap-3` with the icon at the start.
- Every physical property already has a logical form or an `rtl:` counterpart (`border-e`, `ps-*`, `rtl:shadow-[inset_-3px_0_0_...]`) — keep them, they are the safety net if the pin is ever lifted, and `index.css:2327-2340` already ships the `[dir='rtl']` shadow flip for `.app-sidebar`.
- Badge counts: `<bdi>` around the number. Do not wrap in `dir="ltr"` — a bare integer needs no isolate, and forcing LTR on it inside an Arabic label creates the exact class of bug `formatDuration` had.

---

## 3. The playback substrate — how one dock arbitrates three sources

**This is the hardest problem in the set. Read §3.1 before writing any dock code.**

### 3.1 What must not break

`src/store/radioStore.ts:23` publishes `audioElementHolder`, a bare ref to the app's single `<audio>` element. `src/pages/Quran.tsx:526` reads `audioElementHolder.current.currentTime` **every animation frame** inside `useWordSync`'s `tick`, and switches the spoken-word class directly on the DOM without touching React state. The cue is positioned by `positionWordCue` (`Quran.tsx:458`) from the delta between the word's `getBoundingClientRect()` and `.quran-reading-surface`'s.

The sync engine's only signal that "the element is playing *my* surah" is string equality on the station id:

```ts
// Quran.tsx:715-718
const syncStationId = surah && read ? `quran-sync-${read.id}-${surah.id}` : null;
const syncActive = !warshMode && Boolean(syncStationId && currentStation?.id === syncStationId);
```

Six invariants follow. Each must be enforced by a test, not by care.

- **INV-1.** `audioElementHolder.current` is assigned in exactly one place and only ever an `HTMLAudioElement`. The video lane never writes it. If it ever held the `<video>`, a lecture's clock could drive the cue across the mushaf.
- **INV-2.** `radioStore.current.id` **is** the sync contract. Every audio-lane change is expressed through `radioStore.play/suspend/stop`. The arbiter introduces no parallel "what is playing" flag that `Quran.tsx` would have to consult, and never mutates `current` to a `quran-sync-*` id for anything but that exact synced surah.
- **INV-3.** `suspend()` keeps `current` and clears `playing`. Therefore `syncActive` can be true while paused. `Quran.tsx:1176` must change from `syncActive && synced` to `syncPlaying && synced` (`syncPlaying` already exists at `:894`), or the badge reads "Following exact words" over silence.
- **INV-4.** The dock reads position at ≤4 Hz from `timeupdate`. It never opens a `requestAnimationFrame` loop and never reads `currentTime` in one. The word-sync `tick` stays the only per-frame reader of the media clock.
- **INV-5.** The dock is in normal flow and is never `position: fixed` over `.quran-reading-viewport`. Its height is `--dock-h-bar` / `--dock-h-strip` — fixed tokens. Content (a long station name, an error line) never changes it; overflow truncates.
- **INV-6.** Any write to `--dock-h` is followed by `window.dispatchEvent(new Event('salafi:layout-reflow'))`. `useWordSync` adds a listener that calls `positionWordCue(cue, activeWordElementRef.current)` on the next frame. This is the **only** sanctioned coupling between chrome and the reading surface. (Without it, collapsing the dock mid-recitation leaves the cue up to ~500ms stale — `Quran.tsx:584` only re-anchors every 30 frames.)

Also unchanged: `.quran-reading-surface` keeps `overflow: visible` and `border: none`; no chrome adds a border, a transform, a `contain`, or a `view-transition-name` to any ancestor of it.

### 3.2 The arbiter — `src/store/mediaStore.ts` (new)

It arbitrates ownership and holds structured identity. It does **not** duplicate playback state — `playing`, `volume`, `error` and the clock stay in the store that owns the element.

```ts
export type MediaLane = 'video' | 'radio' | 'reciter';

export interface VideoIdentity {
  lane: 'video';
  videoId: string;
  title: string;
  playlistId: string | null;
  playlistName: string | null;
  thumbnailPath: string | null;
}

export interface RadioIdentity {
  lane: 'radio';
  stationId: string;          // === radioStore.current.id
  stationName: string;
}

export interface ReciterIdentity {
  lane: 'reciter';
  stationId: string;          // 'quran-<reciterId>-<surahId>' | 'quran-sync-<readId>-<surahId>'
  surahId: number;
  surahTransliteration: string;
  surahNameArabic: string;
  reciterName: string;
  /** Literal. Recitation audio and every timing file are Hafs. Making this a
   *  literal type makes "dock a Warsh recitation" unrepresentable. */
  riwayah: 'hafs';
  /** True only for a 'quran-sync-*' id. Gates every ayah readout. */
  synced: boolean;
}

export type MediaIdentity = VideoIdentity | RadioIdentity | ReciterIdentity;

export interface SuspendedLane {
  identity: MediaIdentity;
  /** null for a live stream — nothing to resume to. */
  resumeAtSec: number | null;
}

interface MediaState {
  lane: MediaLane | null;
  identity: MediaIdentity | null;
  /** At most one. Always the lane that was playing at the moment of the claim. */
  suspended: SuspendedLane | null;
  collapsed: boolean;
  /** Target rect for MediaStage, written by whoever owns the video frame. */
  stageTargetId: string | null;

  claim: (identity: MediaIdentity) => void;
  release: (lane: MediaLane) => void;
  /** Explicit only. Never called automatically — see §3.4. */
  resumeSuspended: () => void;
  dismiss: () => void;              // clears lane AND suspended; the dock's X
  setCollapsed: (collapsed: boolean) => void;
  setStageTarget: (elementId: string | null) => void;
}

/** Non-reactive clock mirror. Written by MediaAudio / MediaStage on
 *  'timeupdate' and 'durationchange'. Read by anything that needs the
 *  playhead without a subscription. NEVER read per animation frame. */
export const mediaClock: {
  lane: MediaLane | null;
  positionSec: number;
  durationSec: number;
  seekable: boolean;
} = { lane: null, positionSec: 0, durationSec: 0, seekable: false };
```

### 3.3 Arbitration matrix

`claim(next)` where `prev = get().lane`:

| prev → next | Element action | `suspended` after | Rationale |
|---|---|---|---|
| `null` → any | start the lane | unchanged | — |
| `radio` → `video` | `radioStore.suspend()`, then `playerStore.playVideo()` | `{radio, resumeAtSec: null}` | Two audio streams is never right. A live stream has no resume point. |
| `reciter` → `video` | `radioStore.suspend()`, then video | `{reciter, resumeAtSec: mediaClock.positionSec}` | Recitation is seekable; record where it was left. |
| `video` → `radio` | `playerStore.suspend()`, then `radioStore.play(station)` | `{video, resumeAtSec: playerStore.currentTime}` | `playerStore.onPause` already writes progress to SQLite. |
| `video` → `reciter` | as above, then `radioStore.play(surahStation)` | `{video, resumeAtSec}` | — |
| `radio` → `reciter` | `radioStore.play(surahStation)` — **same element, no suspend** | `{radio, resumeAtSec: null}` | One `<audio>`; replacing `current` is already the correct stop. |
| `reciter` → `radio` | `radioStore.play(station)` | `{reciter, resumeAtSec}` | `syncActive` goes false by id inequality; the existing `useWordSync` cleanup (`Quran.tsx:593-598`) hides the cue. **No change needed in Quran.tsx.** |
| `X` → `X` | re-target within the lane | unchanged | Switching surah or station is not a claim. |

Two new store actions are required. Both are additive; nothing existing changes semantics.

```ts
// radioStore.ts — keeps `current` (so INV-2 holds) and clears `playing`.
suspend: () => { const { current } = get(); if (!current) return; set({ playing: false }); },

// playerStore.ts — deterministic, unlike togglePlay(). VideoPlayer.tsx:175-183
// already mirrors status → element.pause(), and onPause saves progress.
suspend: () => { if (get().status === 'playing') set({ status: 'paused' }); },
```

### 3.4 Resume policy — never automatic

When the owning lane ends or is released, `mediaStore` sets `lane = null` but **keeps `suspended`**. The dock stays mounted and renders the suspended identity in a paused state with a play control. It does not auto-resume, in any direction, ever:

- resuming a live stream forty minutes later plays something unrelated to what was interrupted;
- resuming recitation unattended, after the user has navigated away from the mushaf, starts Qur'an audio into an empty room — poor adab and a support ticket;
- auto-resuming recitation while `/quran` is mounted would re-arm `syncActive` and start gliding the cue over a surah the user is no longer reading.

Pressing play on the suspended lane calls `resumeSuspended()`, which re-`claim`s and, when `resumeAtSec !== null`, seeks after `loadedmetadata`.

### 3.5 The transport adapter

One hook, so no component ever branches on lane:

```ts
export interface MediaTransport {
  lane: MediaLane | null;
  identity: MediaIdentity | null;
  state: 'idle' | 'buffering' | 'playing' | 'paused' | 'error';
  /** 'stream' = network/live failure (retryable). 'file' = local file problem. */
  errorKind: 'stream' | 'file' | null;
  seekable: boolean;
  positionSec: number;   // throttled to ≤4 Hz
  durationSec: number;
  volume: number;        // 0..1, normalised across lanes
  toggle: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  retry: () => void;
  stop: () => void;
  /** Present only when the lane has a queue (video). */
  next?: () => void;
  previous?: () => void;
}
export function useMediaTransport(): MediaTransport;
```

Volume mapping: `radio|reciter` ↔ `radioStore.volume / 100`; `video` ↔ `playerStore.volume`. **Volume is not unified into one persisted key.** `salafi-hub.radio-volume.v1` stays per-lane — a live stream and a lecture have genuinely different comfortable levels, and merging them makes every lane switch a surprise.

### 3.6 Element ownership

Two components, both mounted once in `App.tsx`, both outside `<Routes>`, neither ever unmounted by navigation.

**`src/components/player/MediaAudio.tsx`** — the `<audio>` element and *nothing else*. Move `RadioMiniPlayer.tsx:57-140` across **verbatim**: the `key={`${current.id}-${current.url}`}`, the ref callback writing `audioElementHolder.current`, the `audio.error → audio.load()` retry (`:80`), the `AbortError` filter (`:83`), the `preload="none"` + `if (!playing) return` guard in `onError` (`:126-131`), the position/duration reset on station change (`:96-99`). Those five comments document five real bugs; none of them may be re-derived. The only additions are the `mediaClock` writes.

Splitting the element out of the dock is structural: the dock may collapse, hide, or be `inert`ed without any chance of unmounting the element. `RadioMiniPlayer.tsx` is then deleted.

**`src/components/player/MediaStage.tsx`** — the single `<video>`, moved out of `VideoPlayer.tsx:358-378`, into a `position: fixed` layer at `z-stage`. It is never re-parented (a React portal move detaches the node and interrupts playback). Instead its geometry tracks a placeholder:

- `mediaStore.stageTargetId` names a DOM id; `PlayerExpanded` renders `<div id="media-stage-target" class="aspect-video">` and sets it on mount, clears on unmount.
- A `ResizeObserver` on the target plus a `window.resize` listener writes `left/top/width/height` **directly to `layer.style`** — no React state, no re-render.
- `stageTargetId === null` (docked or audio lane) → the layer gets `display: none`. A hidden `<video>` keeps playing audio and Chromium skips the video decode, which is a battery win while listening. The dock shows `LocalThumbnail` instead.

All of `VideoPlayer.tsx`'s diagnostics, error classification and the `file-missing` panel stay where they are and read the element through a ref exported by `MediaStage`.

### 3.7 Consequential edits

| File | Line | Change |
|---|---|---|
| `src/pages/Quran.tsx` | 1176 | `syncActive && synced` → `syncPlaying && synced` (INV-3) |
| `src/pages/Quran.tsx` | 1494-1498, 840-844 | `playStation({...})` → `useMediaStore.claim({lane:'reciter', ...})`; the `·`-concatenated `name` field dies. `radioStore.play` is still what the arbiter calls underneath, with `name` retained for `Radio.tsx`'s catalogue lookup. |
| `src/pages/Radio.tsx` | 78 | `onAir` filter against the catalogue can stay, but is now redundant — `mediaStore.lane === 'radio'` is the honest test. Keep the filter; delete the workaround comment. |
| `src/store/playerStore.ts` | 564-583 | `leavePlayerView` no longer sets `status: 'paused'`. It saves progress and returns. Video survives navigation; the dock keeps it. |
| `src/App.tsx` | 50-58 | The auto-`navigate('/player')` on `playerOpenRequestId` change stays, but only when the user started playback from a "watch now" affordance. `playVideo(id, { expand: false })` docks without navigating. |
| `src/components/layout/Sidebar.tsx` | 47, 52-54 | Delete the `w-0` collapse. |

---

## 4. PlayerDocked

### 4.1 Shape

64px tall, full width, in flow. Grid:

```
[ art 40×40 ] [ identity (min-w-0, flex-1) ] [ transport ] [ seek ] [ volume ] [ lane extras ] [ expand ] [ close ]
```

At `< 900px` the seek row moves under the identity column and the dock stays 64px by shrinking the art to 32px. It never grows. Collapsed (`--dock-h-strip`, 44px): art, identity, play/pause, expand, close only.

Material: **`.surface-2`, opaque. No `backdrop-filter`, ever.** The dock is in flow with nothing behind it, so glass buys nothing; and over a playing `<video>` a backdrop filter forces a per-frame readback of the decoded frame. Glass in this app is for genuinely floating surfaces: `.surface-3` (CommandPalette, SheetSettings, PlaylistMenu) and the sidebar.

The dock draws its top edge with `border-t border-border` and `box-shadow: 0 -8px 20px -14px rgb(var(--shade-rgb) / 0.95)` — the mirror of `.app-sidebar`'s inline-end edge (`index.css:2327`). Under `data-surface-profile='pure-black'` the shadow is removed and only the hairline remains.

### 4.2 Props

`PlayerDocked` takes no props — it reads `useMediaTransport()`. The pieces are exported for `PlayerExpanded` to reuse:

```ts
export interface MediaIdentityBlockProps {
  identity: MediaIdentity;
  size: 'dock' | 'expanded';
  /** Dock: a single truncated line + one caption. Expanded: three lines. */
  className?: string;
}

export interface TransportGroupProps {
  transport: MediaTransport;
  /** 'compact' = play/pause only. 'full' = prev / back10 / play / fwd10 / next. */
  density: 'compact' | 'full';
  /** Video lane only; hidden for radio and reciter. */
  showQueueControls?: boolean;
}

export interface SeekBarProps {
  positionSec: number;
  durationSec: number;
  seekable: boolean;
  onSeek: (seconds: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
  /** 'inline' = 4px track between two time labels (dock).
   *  'full'   = 6px track, labels below (expanded). */
  variant: 'inline' | 'full';
  ariaLabel: string;
}

export interface VolumeControlProps {
  volume: number;                       // 0..1
  onChange: (volume: number) => void;
  muted: boolean;
  onToggleMute: () => void;
  /** Collapses to an icon that reveals the slider on hover/focus below 1100px. */
  compact?: boolean;
}
```

### 4.3 Per-lane rendering

| Slot | `video` | `radio` | `reciter` |
|---|---|---|---|
| Art | `LocalThumbnail` 40×40, `object-cover`, `rounded-sm` | `RadioTower` in `.icon-medallion` 40×40 | `BookOpen` in `.icon-medallion` 40×40 |
| Line 1 | `title`, `dir="auto"`, truncate | `stationName`, `dir="auto"`, truncate | `<bdi>{surahTransliteration}</bdi>` + `·` + `<bdi>{surahNameArabic}</bdi>` — two `<bdi>`s, **not** a concatenated string |
| Line 2 | `playlistName` or `—` | status | `<bdi>{reciterName}</bdi>` |
| Status dot | — | `bg-success-green` when playing | `bg-accent-gold` when playing |
| Seek | always | only when `seekable` | always |
| Extras | speed, repeat (from `playerStore`) | sleep timer, loop (from `radioStore`) | sleep timer, repeat surah |

**No music, no visualisation.** The status dot is a static 6px `rounded-full`. It does not pulse, does not scale, is not driven by any audio value, and there is no waveform, no meter, no equaliser, no spectrum, anywhere in either player block. Delete `animate-pulse` from the live dot at `RadioMiniPlayer.tsx:224` when the code moves — motion in persistent chrome earns nothing and is one step from reading as audio-reactive. `src/utils/reminderAudio.ts:86` constructs an `AudioContext`; add a comment there that it must never be given an `AnalyserNode` for visual purposes.

### 4.4 Tokens

| Element | Token |
|---|---|
| Ground | `.surface-2` (`--fill-2` / `--edge-2` / `--elev-2`) |
| Top edge | `border-border` (= `rgb(var(--hair-rgb) / 0.13)`) |
| Title | `text-text-primary`, `text-sm font-medium` |
| Caption | `text-muted-text`, `text-xs` |
| Play button | 36px circle, `bg-accent-gold text-background` — the same on-accent idiom `.btn-primary` already uses (`index.css:2028`, `text-background` over an `--accent-gold-rgb` fill). Do **not** invent an on-accent token: the accent varies from `175 123 45` (Pearl) to `79 195 247` (Samaa), so no single on-colour is safe, and `text-background` is the shipped answer. |
| Secondary controls | `.icon-btn` |
| Seek / volume | `.range-quiet` — already solves the RTL fill inversion (`index.css:1296-1320`) |
| Time labels | `text-[10px] tabular-nums text-muted-text` |
| Error line | `text-warning-orange` for `stream`, `text-danger-red` for `file` |
| Motion | `--dur-fast` for control state, `--dur-normal` for collapse. **No transition on `--dock-h` while a lane is playing** — see INV-6. |

Every `primary-blue` in the moved code dies: `RadioMiniPlayer.tsx:151, 192, 208, 229` → `accent-gold`. Both hand-written `[box-shadow:…rgb(0 0 0 / 0.6)…]` literals (`:147, :187`) go — the dock uses `--elev-2` and the tokenised top-edge shadow. Both `text-white` occurrences go.

### 4.5 Keyboard

Registered at scope `dock`; active whenever `lane !== null`, suppressed when an `overlay`-scope consumer is mounted.

| Key | Action | Note |
|---|---|---|
| `Space` | toggle | Only when focus is on `body` or inside the dock (§0.5) |
| `Ctrl+ArrowRight` / `Ctrl+ArrowLeft` | ±10s | Plain arrows are left to the focused control |
| `Ctrl+ArrowUp` / `Ctrl+ArrowDown` | volume ±5% | |
| `Ctrl+M` | mute | |
| `Ctrl+Shift+ArrowRight/Left` | next / previous | video lane only |
| `Ctrl+Shift+P` | expand ↔ dock | |
| `Ctrl+Shift+.` | collapse ↔ bar | |

Inside the transport group, `ArrowLeft`/`ArrowRight` move roving focus between buttons (RTL-aware: in a mirrored layout `ArrowRight` moves toward the visual start). The seek `<input type="range">` keeps native arrow behaviour: ±1s, `PageUp`/`PageDown` ±30s, `Home`/`End` to the ends — all suppressed when `!seekable`, where the input is `disabled` rather than hidden so the layout does not shift.

### 4.6 Focus

The dock is a `<section aria-label={t('nowPlaying')}>` in the tab order **after** `<main>` and **before** the TitleBar buttons. It is `inert`ed by `useFocusTrap` while an overlay is open.

Focus survives lane changes: the dock keys its subtree on nothing (only the art `<img>` keys on `thumbnailPath`), so switching from radio to video does not remount the play button. If a control disappears (`next` on a lane change to radio), focus moves to the play button, not to `body`.

Appearance/disappearance never steals focus — the dock mounting must not call `.focus()`.

### 4.7 RTL

- Layout order is source order; the row uses `gap-*` and logical `ps-*`/`pe-*`. Under a mirrored dir the whole row flips and the transport lands at the reading end, which is correct.
- Seek fill: `.range-quiet` already inverts under `[dir='rtl']`. Do not add `dir="ltr"` to the input.
- Time labels: `<span dir="ltr" class="tabular-nums">{formatTime(sec)}</span>`. A clock is LTR-ordered in every locale, and `formatTime` returns no unit, so no isolate is needed. Do **not** wrap `formatDuration` output — it already carries U+2067/U+2066 + U+2069 (`src/utils/formatTime.ts:26`) and double-wrapping reverses it.
- Surah line: two separate `<bdi>` elements around the transliteration and the Arabic name, with a plain `·` between them. Never build the string with `+` — that is the `RadioStation.name` bug (`Quran.tsx:1496`) that made surah and reciter inseparable.
- Skip icons (`SkipBack`/`SkipForward`) get `rtl:-scale-x-100`. A "forward" chevron pointing at the reading start is wrong.

---

## 5. PlayerExpanded

### 5.1 Shape

Stays the `/player` route (`src/pages/PlayerPage.tsx` → renamed `PlayerExpanded.tsx`). Not a modal: it is a destination with a queue, and it needs the full frame.

Three lane branches share one chrome:

- **video** — `<div id="media-stage-target" class="aspect-video">` (`MediaStage` fills it), `ProgressBar`, `PlayerControls`, `QueuePanel`. Essentially today's layout, minus the `<video>` element which now lives in `MediaStage`.
- **reciter** — surah cartouche (transliteration + Arabic name in the surah-name treatment, **never the mushaf face**, never ayah text), reciter name, `SeekBar variant="full"`, repeat controls, and a **"Open in the mushaf"** action that navigates to `/quran` and calls `openSurah`. It renders no Qur'anic text: an ayah body would be decoration on a now-playing screen, which constraint 2 forbids. The ayah *number* may appear only when `identity.synced === true`, as `<bdi dir="ltr">{surahId}:{ayah}</bdi>`.
- **radio** — station name, a static `radioLive` indicator, sleep timer, favourite toggle, and the sibling stations from the same catalogue group as a `ListCompact`.

`SidebarNav` receives `forceCollapsed` — the rail, not `w-0`. The user can still navigate.

### 5.2 Props

```ts
export interface PlayerExpandedProps {
  /** Route usage passes nothing. Exported for the harness and for tests that
   *  need to render a lane without a router. */
  laneOverride?: MediaLane;
}
```

### 5.3 Dock ↔ expanded transition

Feature-detected, zero-dependency:

```ts
const run = (mutate: () => void) => {
  if (prefersReducedMotion() || !document.startViewTransition) return mutate();
  document.startViewTransition(mutate);
};
```

`view-transition-name: media-art` on the dock art slot and on the expanded art/stage. **Hard boundary:** no `view-transition-name` and no view transition may be applied to `src/pages/Quran.tsx`, `.quran-reading-surface`, `.quran-reading-viewport` or `.quran-reading-frame`. A view-transition name promotes an element to its own layer and a transform on an ancestor changes what `getBoundingClientRect()` returns mid-transition — that desynchronises the word cue from the spoken word.

### 5.4 Keyboard, focus, RTL

Scope `stage`. Inherits every `dock` binding without the `Ctrl` prefix, because there is no ambiguity here: `Space`, `ArrowLeft`/`ArrowRight` (±10s), `ArrowUp`/`ArrowDown` (volume), `M`, `N`, `P`, `R`, `F`, `Escape`. This is the existing `useKeyboardShortcuts` table (`:29-83`) re-registered at the right scope — but `Escape` no longer hard-navigates to `/library` (`:80-81`); it collapses to the dock and returns to the previous route, keeping playback.

Fullscreen (`F`) applies `useFocusTrap` to the stage container with `inertBackground: true`.

RTL: mirror `SkipBack`/`SkipForward` and the `ArrowLeft/Right` seek mapping. The queue panel is `border-s` on the inline-end side.

---

## 6. CommandPalette

### 6.1 Corpora and where each comes from

| Group | Count | Source | Cost |
|---|---|---|---|
| Surahs | 114 | `useQuranStore.surahs` (`get_quran_surahs { riwayah }`) | local, in memory |
| Stations | 175 | `useRadioStore.stations` (`get_radio_stations { language }`) | local once loaded; may be absent or errored |
| Videos | ~163 | `invoke('search_videos', { query })` — SQLite `LIKE` over `title, file_name, category, speaker` (`src-tauri/src/db/video.rs:185-197`) | remote, debounced |
| Playlists | 10 | `useAppStore.playlists` | local |
| Jump | 8 | static route registry | local |
| Actions | ~10 | static registry incl. the four recovery fns | local |
| Settings | ~14 | static registry of settings toggles | local |

### 6.2 Ranking

`src/components/command/rank.ts`, pure and unit-testable.

```ts
export type MatchKind = 'exact' | 'prefix' | 'wordPrefix' | 'substring' | 'none';

export interface Rankable {
  /** Weighted match fields, highest weight first. */
  fields: Array<{ value: string; weight: number }>;
  /** ms epoch; drives the recency bonus. */
  lastUsedAt?: number | null;
}

export const MATCH_SCORE: Record<Exclude<MatchKind, 'none'>, number> =
  { exact: 1, prefix: 0.8, wordPrefix: 0.65, substring: 0.4 };

/** score = max over fields of (weight × MATCH_SCORE[kind]) + recencyBonus.
 *  recencyBonus = 0.15 if lastUsedAt within 7 days, 0.07 within 30, else 0.
 *  Ties break by field index, then by the corpus's natural order (surah id,
 *  station index, playlist name) — never by object identity, so ordering is
 *  stable across renders. */
export function score(query: string, item: Rankable): number;
```

Field weights: primary name `1.0`; secondary (`translation`, `speaker`, `playlistName`, `moshafName`) `0.6`; path/id `0.3`.

**No fuzzy subsequence matching.** With 462 items and Arabic in the corpus, subsequence matching produces results nobody can explain. Substring is the floor.

### 6.3 Arabic normalisation

Match keys only — never the rendered string.

```ts
/** Strips tashkīl (U+064B–U+0652, U+0670), tatweel (U+0640), and folds
 *  أ إ آ ٱ → ا, ى → ي, ؤ → و, ئ → ي. Applied to BOTH the query and the
 *  index key. The displayed value is always the untouched source string. */
export function normaliseArabic(input: string): string;
```

Latin side: `toLowerCase()` and NFD-strip combining marks so `du'ā'` matches `dua`.

### 6.4 Result ordering — fixed groups, one promoted row

The video corpus arrives 100-300ms after the local ones. If the list re-ranked on arrival, rows would jump under the cursor. Rule:

1. Group order is **fixed and never re-sorted**: `Top result` → `Jump` → `Surahs` → `Library` (playlists then videos) → `Stations` → `Actions` → `Settings`.
2. `Top result` holds exactly one row: the single highest-scoring item **from the local corpora only**, decided on the first frame. A late remote result never displaces it — it lands in `Library`.
3. Within a group, remote results only ever **append**.
4. Each group shows 5 rows plus a `+N more` row that expands in place. Expanding past 200 rows switches that group to `@tanstack/react-virtual` (the one dependency the library evaluation recommends adopting, already scoped for `Radio.tsx`); below 200 no virtualization.

Loading and failure are per-group, never blocking: an unloaded `Stations` group renders one skeleton row; `useRadioStore.loadError` renders one row — *"Stations unavailable — Retry"* — wired to `loadStations`. The palette itself always opens in one frame.

### 6.5 The riwayah rule

Hafs and Warsh differ in verse numbering, so a palette result must never carry a riwayah of its own.

1. **The palette never switches riwayah.** There is no "Open in Warsh" result. `useQuranStore.riwayah` is the single source; a surah result calls `openSurah(id)` under whatever is active and navigates to `/quran`.
2. **The surah index is keyed by riwayah and rebuilt on change**, never merged. Cache key: `` `surah-index:${riwayah}` ``. Total-verse counts differ, so a merged index would produce out-of-range ayah results.
3. **Ayah references (`2:255`, `٢:٢٥٥`) are only offered when the index is trustworthy** — i.e. `useQuranStore.surahsRiwayah === useQuranStore.riwayah` **and** `ayah <= surah.totalVerses` for that riwayah. If the list is stale, the ayah result is **suppressed**, never guessed. The row is labelled with the active riwayah: *"Al-Baqarah 255 — Hafs"*.
4. **Recitation results.** `Listen to <surah> — <reciter>` builds `quran-<reciterId>-<surahId>` and claims `{lane:'reciter', synced:false}` — legal in both riwayat, because the audio is a Hafs recitation being listened to, not a text being tracked.
5. **`Follow the words` results are Hafs-only.** They build `quran-sync-<readId>-<surahId>` and set `synced: true`. When `riwayah === 'warsh'` these rows are **not rendered at all** — not disabled, not greyed. Timing data is Hafs-only; offering it against a Warsh reading and then refusing is worse than not offering it. This mirrors the existing gate at `Quran.tsx:718` (`!warshMode && …`).
6. **Persisted recents.** `localStorage['salafi-hub.palette-recent.v1']` stores surah entries as `{ kind:'surah', surahId, riwayah }` and **filters on read** to the active riwayah. A recents list that surfaced a Warsh position while Hafs is active would be exactly the "mixed in a cache key" failure the manhaj forbids.

### 6.6 Props

```ts
export type CommandGroupId =
  | 'top' | 'jump' | 'surahs' | 'library' | 'stations' | 'actions' | 'settings';

export interface CommandItem {
  id: string;                       // stable; used for recents and for keys
  group: CommandGroupId;
  /** Rendered verbatim. Arabic values are wrapped in <bdi> by the row. */
  title: string;
  subtitle?: string;
  /** Right-aligned meta: verse count, duration, station language. */
  meta?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Match fields with weights. See §6.2. */
  fields: Array<{ value: string; weight: number }>;
  lastUsedAt?: number | null;
  /** Destructive actions (Repair database, Remove orphaned entries) require a
   *  confirm step rendered inside the palette, never window.confirm(). */
  destructive?: boolean;
  keywords?: string[];
  run: () => void | Promise<void>;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefills the query. Used by "Search library" affordances. */
  initialQuery?: string;
  /** Restricts the palette to one group. Used by future in-context pickers. */
  scopeToGroup?: CommandGroupId;
}

export interface CommandRegistry {
  /** Static items: routes, actions, settings toggles. */
  staticItems: (t: Translate, nav: NavigateFunction) => CommandItem[];
  /** Local corpora, recomputed when their stores change. */
  localItems: (t: Translate) => CommandItem[];
  /** Debounced remote search. Returns items for the 'library' group only. */
  searchRemote: (query: string, signal: AbortSignal) => Promise<CommandItem[]>;
}
```

The four recovery functions — `rescan_all`, `repair_database`, `remove_orphaned_entries`, `get_diagnostics` — enter `staticItems` in the `actions` group. That is what makes them reachable outside `/settings` for the first time; today each has exactly one call site, all four in the same `ActionBar` at `Settings.tsx:535-539`. `repair_database` and `remove_orphaned_entries` set `destructive: true` and render an inline two-step confirm — `window.confirm` (`Settings.tsx:198, 211`) is a native modal that escapes the focus trap and is unthemeable.

### 6.7 Tokens

Portal to `#overlay-root`. Scrim `bg-[rgb(var(--shade-rgb)/0.55)] backdrop-blur-sm` — matching `ReminderModal.tsx:41`'s intent but token-derived instead of `bg-black/60`. Panel: `.surface-3` (the ladder's overlay level — it is the one place `backdrop-filter: blur(22px) saturate(1.35)` is already declared, `index.css:1921-1931`), `rounded-lg` (`--r-lg`), `max-w-[640px]`, `max-h-[min(60vh,520px)]`.

Input row: `.field-quiet`, `text-base`, no border, a `Search` glyph in `text-text-faint`, a `border-b border-border` under the row. Rows: `.rule-row` at `density="compact"`; selected row uses `.rule-row-active` (accent wash + inset marker) — **not** a filled block. Group headers: the `SectionHeader` primitive at `size="eyebrow"` with `.rule-head`. Kbd hints: `border border-border-faint text-[10px] text-text-faint`.

### 6.8 Keyboard

| Key | Action |
|---|---|
| `Ctrl+K` / `Ctrl+P` | open (scope `base`; suppressed while another overlay is open) |
| `Escape` | close, restore focus, **preserve the query** for the next open within 60s |
| `ArrowDown` / `ArrowUp` | move selection across group boundaries; wraps |
| `Home` / `End` | first / last row |
| `PageDown` / `PageUp` | ±8 rows |
| `Enter` | run selected |
| `Ctrl+Enter` | run in the background — no navigation, no close (for `actions`) |
| `Tab` | move to the group's `+N more` control when one exists; otherwise cycles inside the trap |
| `Backspace` on empty input | clear `scopeToGroup` if set, else close |

The input keeps focus for the whole session; `ArrowDown` never moves DOM focus off it. Selection is expressed with `aria-activedescendant` on `role="combobox"`, rows are `role="option"` inside `role="listbox"`. Rows are never `<button>` — a focusable row would fight `aria-activedescendant`.

### 6.9 Focus & RTL

- `useFocusTrap({ active: open, initialFocusRef: inputRef, inertBackground: true })`. On close, focus returns to whatever had it — including a dock control, so `Ctrl+K` mid-listening is non-destructive.
- Opening does not pause playback and does not claim any lane.
- Input: `dir="auto"` so an Arabic query renders RTL as it is typed. Never `dir="ltr"`.
- Rows: `<bdi>` on every title and subtitle. Ayah references `<bdi dir="ltr">2:255</bdi>`. Counts `<bdi>`, no isolate.
- Kbd hints sit at the row's logical `end` (`ms-auto` → `ms-auto` is already logical; use it, not `ml-auto`).
- `html[data-language='ar']` zeroes letter-spacing globally, so the group headers must not depend on `tracking-[0.16em]` to be distinguishable — they carry weight and colour as well. This is the bug already latent at `Quran.tsx:239, 1397`.

---

## 7. ToastStack

### 7.1 What it replaces

Today: one Settings-local slot (`Settings.tsx:135-146` state, `:417-430` render), fixed 3s, no queue, no dismiss, **not portalled** — it renders inline and pushes the page down. Everywhere else uses an inline `border-s-2` status strip (`QuickActions.tsx:112-126`, `Library.tsx:521-536, 660-680`).

### 7.2 Store

```ts
export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  tone: ToastTone;
  /** Resolved string. Callers pass t('…') or a backend message. */
  message: string;
  /** Optional second line: counts, a file name. Truncated to two lines. */
  detail?: string;
  /** One action maximum. More than one is a dialog, not a toast. */
  action?: { labelKey: TranslationKey; run: () => void };
  /** Collapses repeats: a second toast with the same key replaces the first
   *  and resets its timer instead of stacking. */
  dedupeKey?: string;
  /** ms. Defaults: success 4000, info 5000, error 0 (sticky). */
  durationMs?: number;
  createdAt: number;
}

interface ToastState {
  toasts: Toast[];          // visible, max 3
  queued: Toast[];          // overflow, promoted on dismiss
  push: (toast: Omit<Toast, 'id' | 'createdAt'>) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  /** Pauses every timer. Called on hover, on focus-within, and on window blur. */
  setPaused: (paused: boolean) => void;
}
export const useToastStore: UseBoundStore<StoreApi<ToastState>>;
```

**Errors never auto-dismiss** (`durationMs: 0`). A failure the user did not see is a failure that becomes a support ticket.

### 7.3 Wiring — the three named cases plus the real event sources

| Toast | Trigger | Content |
|---|---|---|
| Import complete | `listen('import_finished')` — `useAppEvents.ts:61`; payload is `ImportResult { imported_count, skipped_count, failed_count, playlist_id, errors }` | success when `failed_count === 0`, else error. Detail = the three counts. Action = *"Open playlist"* when `playlist_id` is non-null. `dedupeKey: 'import'`. |
| Download finished | `useDownloadStore` transition to `stage === 'finished'` (`downloadStore.ts:159`) | success; detail = file title. Action = *"Reveal in folder"* (compiles on Windows only). `dedupeKey: 'download:<id>'`. |
| Rescan done | `handleRescanAll` (`Settings.tsx:187`) and the palette's `actions` entry | success; detail = playlists refreshed. `dedupeKey: 'rescan'`. |
| Thumbnails done | `listen('thumbnail_batch_finished')` (`useAppEvents.ts:77`) | info; suppressed when `generated_count === 0 && failed_count === 0`. |
| Orphans removed | `remove_orphaned_entries` returns a count (`Settings.tsx:214`) | success; detail = the count. |
| Any action failure | every `catch` currently calling `showToast(getErrorMessage(error), 'error')` | error, sticky, action = *"Run diagnostics"*. |

`Settings.tsx`'s local `toast` state, `toastTimerRef`, `showToast` and the render block are deleted; `showToast` becomes `useToastStore.getState().push`.

### 7.4 Props & placement

```ts
export interface ToastStackProps {
  /** Default 'bottom-end'. 'top-end' when the dock is expanded to full screen. */
  placement?: 'bottom-end' | 'top-end';
  /** Default 3. */
  maxVisible?: number;
}
```

Portalled to `#overlay-root` at `z-toast`, `position: absolute`, offset `inset-inline-end: 20px; bottom: calc(var(--dock-h) + 12px)`. It rides above the dock without ever overlapping it, and it never pushes layout.

Width `min(380px, calc(100vw - 40px))`. Newest at the bottom of the stack (nearest the dock), older ones sliding up — a fixed 8px gap, no stacking/scaling effect.

### 7.5 Tokens

`.surface-3` + `rounded-lg`. Tone is carried by a 2px inline-start edge and the glyph, never by a filled background: `border-s-2 border-success-green` / `border-danger-red` / `border-border-strong` with `CheckCircle` / `AlertCircle` / `Info` in the matching colour. Body `text-sm text-text-primary`, detail `text-xs text-muted-text`. Action is a `.quiet-action`. Dismiss is an `.icon-btn` at 24px.

Enter/exit via `@starting-style` + `transition-behavior: allow-discrete` on `opacity` and `translate` — no library, and the global `prefers-reduced-motion` block (`index.css:2350-2360`) already collapses it to a step.

### 7.6 Keyboard, focus, RTL

- **Focus is never stolen.** A toast appearing must not move focus; it interrupts nothing.
- `F6` (Windows' pane-cycling key) moves focus into the newest toast; `Escape` dismisses the focused toast and returns focus to where it was; `Tab` cycles within the stack, then leaves.
- Timers pause on `mouseenter`, on `focus-within`, and on window blur (a toast that expired while the user was in another app was never seen).
- `role="status" aria-live="polite"` for success/info; `role="alert" aria-live="assertive"` for error. The container is `aria-relevant="additions"` so dismissals are not announced.
- RTL: anchored with `inset-inline-end`; the tone edge is `border-s-2` (logical). Messages `dir="auto"`; backend error strings are frequently a Windows path, so they get `dir="ltr"` **and** `break-all` — `Settings.tsx:429` already does this and it is right.

---

## 8. SheetSettings

### 8.1 Purpose and scope

Theme and language are the two settings most likely to be changed mid-task, and both currently require abandoning the route for a 918-line page. `SheetSettings` is a quick-settings drawer, not a second Settings: everything in it is instant, reversible and has no confirm step.

Contents, in order:

1. **Theme** — all ten, as a 5×2 swatch grid. Swatch colours come from the theme list already in `src/i18n.ts` (30 of the app's 31 hex literals live there; the sheet reuses that list rather than adding a 31st).
2. **Language** — the existing `.segmented` two-button control.
3. **Background motion** — `Off / Subtle / Full`, default `Subtle`. The Part II ambient contract's user-preference input; feeds `tier = min(themeDefault, deviceCapability, userPreference)`.
4. **Performance mode** — `settings.performanceMode`.
5. **Reminder volume** — `.range-quiet`.
6. Footer: *"All settings"* → `navigate('/settings')`, closing the sheet.

Nothing destructive. No folder management, no ffmpeg, no diagnostics, no backup.

### 8.2 Props

```ts
export interface SheetSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Scrolls to and flashes a section on open. */
  initialSection?: 'theme' | 'language' | 'motion' | 'performance' | 'sound';
}

/** Generic primitive — SheetSettings is its first consumer. */
export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'inline-end' is the only value at ship; the prop exists so the primitive
   *  is not silently side-specific. */
  side?: 'inline-end';
  widthPx?: number;                 // default 380
  titleKey: TranslationKey;
  /** Default true. False for non-blocking sheets (none at ship). */
  modal?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}
```

### 8.3 Optimistic theme application

`useSettingsStore.updateSettings` round-trips to the backend (`invoke('update_settings')`, up to 12s timeout) and only then sets store state. A theme picker with that latency is unusable. So:

```ts
const applyTheme = (theme: AppTheme) => {
  const previous = document.documentElement.dataset.theme as AppTheme;
  document.documentElement.dataset.theme = theme;          // instant
  document.documentElement.dataset.surfaceProfile = profileOf(theme);
  updateSettings({ theme }).catch((error) => {
    document.documentElement.dataset.theme = previous;      // revert
    document.documentElement.dataset.surfaceProfile = profileOf(previous);
    useToastStore.getState().push({ tone: 'error', message: getErrorMessage(error) });
  });
};
```

`App.tsx`'s theme effect (`:36-48`) re-asserts the same value when the store settles, so there is no flicker. The same pattern applies to `language` (which also writes `root.lang` and `root.dataset.language`).

### 8.4 Tokens

`.surface-3` panel, `rounded-s-xl` (logical — rounded on the edge facing the content, square against the window edge), full height minus the TitleBar and the dock: `height: calc(100% - var(--dock-h))`. Scrim as in §6.7. Header uses the `SectionHeader` primitive at `size="sheet"`. Rows use `.rule-row` at `density="comfortable"`.

Theme swatches: 40×28, `rounded-sm`, three vertical bands drawn from that theme's `--bg-main` / `--bg-card` / `--accent-gold`. Selected = `border-strong` plus a 3px inset marker matching `.rule-row-active` — never a check overlay, which would put a glyph over the colour being judged.

Slide in on `translate` (compositor only) over `--dur-normal` with `--ease-standard`; exit via `allow-discrete`.

### 8.5 Keyboard & focus

| Key | Action |
|---|---|
| `Ctrl+,` | open (Windows convention) |
| `Escape` | close, restore focus |
| `Tab` / `Shift+Tab` | cycle inside the trap |
| Arrow keys inside the theme grid | 2D roving focus (5 columns × 2 rows), wrapping at edges |
| `Enter` / `Space` on a swatch | apply |

`role="dialog" aria-modal="true" aria-labelledby` on the header. `useFocusTrap({ active: open, initialFocusRef: firstControlRef, inertBackground: true })` — background includes `PlayerDocked`, so a sheet cannot be scrubbed behind. Initial focus goes to the **current theme's swatch**, not the close button, so `Enter` is a no-op rather than a change.

Because the sheet does not `inert` the TitleBar, the window stays draggable and closable while it is open.

### 8.6 RTL

- Anchored with `inset-inline-end: 0`, enters on `translateX(100%)` in LTR and `translateX(-100%)` under `[dir='rtl']` — express as `translate: var(--sheet-offset) 0` with the sign flipped by a `[dir='rtl']` rule, so one keyframe serves both.
- Theme-grid arrow navigation is **visual**, not logical: under a mirrored layout `ArrowRight` moves to the visually right cell, which is the previous index. Map through `dir`.
- Setting labels `dir="auto"`; the reminder-volume percentage `<bdi>{value}%</bdi>` — a number followed by a sign in an Arabic run needs the isolate, and `%` is exactly the case `formatDuration`'s comment describes.

---

## 9. Cross-cutting deletions

Chrome work is only finished when these are gone:

| What | Where | Replacement |
|---|---|---|
| `primary-blue` / `accent-blue` (a seed the app renders ~once) | `PlayerHeader.tsx:41,45`; `QueuePanel.tsx:86,92,145,151`; `RadioMiniPlayer.tsx:151,192,208,229`; `PlayerPage.tsx:80`; `UpdateManager.tsx:107` | `accent-gold` |
| `text-white` / `bg-black` in chrome | `TitleBar.tsx:42`; `RadioMiniPlayer.tsx:151,192`; `PlayerPage.tsx:114`; `VideoPlayer.tsx` overlays | `text-on-danger`, `text-background`, `bg-[rgb(var(--shade-rgb))]` |
| Hand-written `[box-shadow:…rgb(0 0 0/0.6)…]` | `RadioMiniPlayer.tsx:147,187` | `--elev-2` / `--elev-3` |
| `z-[9999]`, `z-50`, `z-40`, `z-30`, `z-20` | 11 sites | the `--z-*` scale (§0.1) |
| `window.confirm` | `Settings.tsx:174,198,211,225` | inline two-step confirm inside the palette / sheet |
| `'Inter'` (named, never bundled) | `src/index.css:613`, `tailwind.config.js:45` | `['Segoe UI Variable Text', 'system-ui', 'sans-serif']` — 0 KB, correct for a Windows-only target. Also correct `docs/DESIGN_SYSTEM.md:46`, which claims Inter is bundled. |

---

## 10. Verification

`npx tsc --noEmit` and `npm run build` gate everything. `cd src-tauri && cargo test` cannot run in this container (gdk-3.0 missing) and no Rust changes are proposed. Then, via `scripts/harness/`:

**Automated, must fail the build:**

1. `audioElementHolder.current instanceof HTMLAudioElement || === null` asserted after every lane claim in the matrix (INV-1).
2. Sync-contract test: drive `claim()` through all eight matrix transitions; assert `radioStore.current?.id` equals the expected `quran-sync-*` id **iff** the reciter lane is active and synced, and that `syncActive` is false in every other state (INV-2, INV-3).
3. Dock geometry: assert `PlayerDocked` has `getComputedStyle(el).position !== 'fixed'` and that `.quran-reading-viewport`'s `getBoundingClientRect()` is unchanged by a dock **collapse** only after the `salafi:layout-reflow` handler runs (INV-5, INV-6).
4. Cue-anchor test: with recitation playing on `/quran`, collapse the dock and assert the cue's transform matches `positionWordCue`'s expected output within 1px on the next frame.
5. Riwayah test: set `riwayah='warsh'`, open the palette, assert zero results whose id matches `/^quran-sync-/` and that `localStorage['salafi-hub.palette-recent.v1']` yields no Hafs-tagged surah rows.
6. Token lint: `grep` the seven chrome files for `#[0-9a-f]{3,6}`, `rgba(`, `text-white`, `bg-black`, `primary-blue`, `z-[0-9]` — zero hits.
7. `backdrop-filter` audit: assert it appears on `.surface-3`, `.app-sidebar` (cool/warm profiles) and the two scrims only — never on `PlayerDocked`, never on any ancestor of `.quran-reading-surface`.
8. Animation audit: assert no element inside `PlayerDocked` or `PlayerExpanded` carries `animate-*`, and that no `AnalyserNode` is constructed anywhere in `src/`.

**Manual sweep, 10 themes × 2 languages** (the audit records several bugs that appeared in exactly one theme or one direction): dock at each lane, palette open with an Arabic query, sheet open with the theme grid focused, toast stack at 3 + 2 queued, title bar focused and blurred. Special attention to `pearl` (the only light theme — shadow opacity ~0, border-led) and `onyx` (no shadows at all).


## Risks

- **Docking video requires moving the <video> element out of VideoPlayer.tsx into a permanently-mounted fixed layer whose geometry tracks a placeholder. If the geometry sync drifts (ResizeObserver timing, fullscreen transitions, DPI change on monitor switch), the video visibly detaches from its frame — a class of bug that only appears on multi-monitor Windows machines and never in the Linux harness.**
  - Mitigation: Write geometry directly to layer.style from the ResizeObserver callback (never React state), subscribe to both ResizeObserver and window.resize, and re-measure on 'fullscreenchange' and on visualViewport 'resize'. Ship behind a hard fallback: if MediaStage cannot resolve its target for two consecutive frames it sets display:none and PlayerExpanded renders the classic in-tree <video> exactly as today. Add a harness check that asserts the layer rect equals the target rect within 1px after a synthetic resize.
- **Hiding the <video> with display:none while docked relies on Chromium keeping audio alive and skipping video decode. This is the documented behaviour, but a codec- or GPU-specific regression would silently stop audio when the user collapses to the dock — the exact opposite of what the dock is for.**
  - Mitigation: Feature-test at first dock: after setting display:none, assert !video.paused and that video.currentTime advances across two timeupdate events; if it does not, fall back to a 1x1px opacity-0 layer positioned behind the dock (which keeps the element rendered) and record the fallback in diagnostics. Never assume; the check costs ~200ms once per session.
- **suspend() keeps radioStore.current set, so syncActive stays true while a video plays. Any future code that reads syncActive without also reading `playing` will believe recitation is being tracked when it is not — and the failure mode is a cue gliding across the mushaf under the wrong clock, which is manhaj-relevant, not cosmetic.**
  - Mitigation: Fix Quran.tsx:1176 to use the existing syncPlaying (:894), and add a derived selector `useSyncTracking()` in quranStore that returns syncActive && playing, then forbid raw syncActive outside that selector with a lint rule. Cover with harness assertion #2, which drives all eight matrix transitions.
- **Removing the Sidebar's w-0 collapse on /player and adding a full-width dock changes the height of every route's content area. The Quran reading viewport shrinks by 64px whenever playback starts, and positionWordCue only re-anchors every 30 frames (Quran.tsx:584), so a cue can sit up to ~500ms stale.**
  - Mitigation: The 'salafi:layout-reflow' event (INV-6) forces an immediate re-anchor on every --dock-h write. Additionally the dock's height is a fixed token and never content-dependent, so the only height changes are mount, unmount and user-initiated collapse — all discrete, all followed by the event. Verified by harness check #4.
- **Optimistic theme application writes document.documentElement.dataset.theme before the backend confirms. If update_settings fails after the ten-theme grid has been clicked several times, the revert restores only the immediately-previous value, and the store and the DOM can disagree.**
  - Mitigation: Serialise theme writes through a single in-flight promise keyed by a monotonic request id (the same supersession pattern radioStore.loadStations and quranStore.openSurah already use). Only the newest request may write the DOM; a superseded failure reverts nothing and raises no toast.
- **CommandPalette's static registry exposes repair_database and remove_orphaned_entries globally for the first time. These are currently protected by window.confirm; an inline confirm inside a palette that closes on Escape and runs on Enter is materially easier to trigger by accident.**
  - Mitigation: Destructive items require a second, explicitly different key: the first Enter swaps the row into a confirm state whose only affirmative action is a focused button reached by Tab, never by a second Enter on the row. The row also never appears in the 'Top result' group and is excluded from recents.
- **The seven blocks touch App.tsx, AppShell.tsx, Sidebar.tsx, PlayerPage.tsx, Quran.tsx, Radio.tsx, Settings.tsx, playerStore.ts and radioStore.ts, and delete RadioMiniPlayer.tsx. That is one merge conflict surface for every other Part II workstream, and CLAUDE.md warns that a squash-merge rewrites main so any predating branch conflicts.**
  - Mitigation: Land in four independently shippable PRs in this order: (1) shell contract — z-scale, overlay root, useFocusTrap, useGlobalKeymap, TitleBar; (2) mediaStore + MediaAudio + PlayerDocked, with MediaStage stubbed and video still route-only; (3) MediaStage + PlayerExpanded + SidebarNav rail; (4) CommandPalette + ToastStack + SheetSettings. Each rebases from origin/main and cherry-picks rather than merging.

## Open questions

- Should PlayerDocked appear on the Dashboard's first run, before anything has ever played? The spec keeps the dock mounted whenever `suspended` is non-null, which means it persists across sessions if that state is ever persisted. Currently it is not persisted — confirm the dock should start absent on every launch rather than restoring the last-played identity in a paused state.
- The video lane's `next`/`previous` come from playerStore's queue, which is hydrated from a playlist. Radio and reciter have no queue at all. Should the dock show disabled skip buttons on audio lanes (stable layout, dead controls) or hide them (shifting transport width between lanes)? The spec currently hides them; a stable-width transport group may be worth the two dead buttons.
- `Quran.tsx:1494` currently plays reciter audio through a station id of `quran-<reciterId>-<surahId>`, which is not a sync id, so it never arms the tracker. Should the Listen tab automatically prefer the synced variant when the active riwayah is Hafs and a timing read exists for that surah — or does Listen deliberately stay unsynced so the user chooses tracking explicitly on the Read tab? This changes what CommandPalette's default recitation action does.
- The four surface profiles are derived from the theme name in a hardcoded map. `mushaf` (Mushaf Night) and `red` (Yaqut Red) are not named in the brief's profile list; the spec assigns both to `cool`. `red` has a warm ground (`--bg-main-rgb: 14 5 6`) and arguably belongs to `warm`. Confirm the assignment before the radii offset in the `warm` profile ships.
- Does the ToastStack replace the inline `border-s-2` status strips at `QuickActions.tsx:112-126` and `Library.tsx:521-536, 660-680`, or do those stay as in-context feedback? Converting them removes three treatments but also removes feedback that is anchored to the control that produced it, which is generally better for long-running library operations.
- `Ctrl+P` is proposed as a secondary CommandPalette opener, but on Windows `Ctrl+P` is universally Print. Confirm it should be dropped in favour of `Ctrl+K` alone, or replaced with `Ctrl+Shift+P` (VS Code's command-only palette).
