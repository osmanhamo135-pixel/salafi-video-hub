# Block Inventory Reconciliation — 25 Requested Blocks vs. What Ships

## Part II — Block Inventory Reconciliation

Every path below is real and was read. Line numbers are from the working tree at the time of the audit. Nothing was edited.

### The 25 requested blocks

| # | Block | Status | Real file path(s) | What is missing | LOC to finish |
|---|---|---|---|---|---|
| 1 | **HeroContinue** | PARTIAL | `src/components/dashboard/ContinueWatching.tsx:159-267` (`FeatureCard`); `src/components/playlist/PlaylistCard.tsx:365-461` (`variant="wide" featured`) | Two rival implementations of "resume the thing you were on", neither is a hero — both are cards inside a section. No single canonical resume source (Dashboard reads `get_continue_watching`, Library recomputes from `playlists`). No radio/reciter resume. No hero-scale variant. | ~180 |
| 2 | **HeroMushaf** | MISSING | nearest: `src/components/home/Hero.tsx:64-125` (Basmala, Dashboard-only); `src/pages/Quran.tsx:86-95` | `/quran` opens on a `premium-pill` + `text-3xl` h1 + one grey sentence — the mushaf route has no hero at all. Needs a Tier 0/1-locked hero carrying riwayah, last-read, and reciter, with the Basmala rule (complete, static, full size) enforced. | ~140 |
| 3 | **HeroAmbient** | PARTIAL (CSS only) | `src/components/home/Hero.tsx:53-60` (`hero-ground`/`hero-scene`/`hero-band-near|mid|far`/`hero-girih`/`hero-arch`/`hero-scrim`); rules in `src/index.css` | Exists as one hard-coded Dashboard-only stack, not a component. No `<AmbientLayer/>`, no tier enum, no `min(themeDefault, deviceCapability, userPreference)`, no battery/blur/route-change/video-playback pause, no Tier 0/1 lock over the mushaf, no per-theme ground. | ~260 + tests |
| 4 | **HeroCompact** | MISSING | the shape it would replace: `src/pages/Watch.tsx:52-59`, `src/pages/Radio.tsx:83-95`, `src/pages/Downloads.tsx:136-146`, `src/pages/Quran.tsx:87-95`, `src/pages/Library.tsx:374-380`, `src/pages/Reminders.tsx:171-177`, `src/pages/Settings.tsx:412-415` | Seven copies of "pill + h1 + subtitle", three different h1 treatments (see §SectionHeader). No component; no eyebrow/action/metric slots. | ~90 |
| 5 | **RailPoster** | PARTIAL | `src/pages/Watch.tsx:400-424` (`WatchHistoryRow`) — the app's only horizontal rail | It is `flex gap-3 overflow-x-auto pb-2` and nothing else: no scroll buttons, no snap, no edge fade, no keyboard paging, no RTL scroll handling, no virtualization, no generic item slot. | ~150 |
| 6 | **RailWide** | MISSING | — | Nothing in the app scrolls wide/landscape cards horizontally. | ~110 |
| 7 | **RailStation** | MISSING | `src/pages/Radio.tsx:200-227` is a 2-column grid of `.rule-row`s, not a rail | Radio's 175 rows (`scrollHeight 6431px`, unvirtualized) need a virtualized station surface; a rail would also fix the dangling-hairline problem the code comments describe at `Radio.tsx:213-215`. | ~120 |
| 8 | **GridMedia** | PARTIAL | 4 incompatible grids: `src/components/playlist/PlaylistGrid.tsx:11` (`auto-fill minmax(17.5rem,1fr)`), `src/pages/Watch.tsx:130` (`sm:2 xl:3 3xl:4`), `src/pages/Quran.tsx:1487` (`sm:2 2xl:3`), `src/pages/Radio.tsx:220` (`lg:2`) | One track system, one gap scale, one showcase/threshold rule (`SHOWCASE_MAX = 3` at `PlaylistGrid.tsx:15` is Library-only). | ~90 |
| 9 | **SplitPane** | PARTIAL | `src/pages/Quran.tsx:227` and `:1393` (`320px_minmax(0,1fr)`), `src/pages/Downloads.tsx:148` (`minmax(0,1fr)_340px`), `src/pages/Dashboard.tsx:225` (`minmax(0,1fr)_320px`), `src/components/dashboard/ContinueWatching.tsx:124` (`minmax(0,1fr)_minmax(0,300px)`) | Four hand-rolled splits, four gutter widths, three different divider idioms (`xl:border-e xl:pe-5`, `xl:border-s xl:ps-6`, `xl:border-s xl:ps-12`). No collapse, no resize, no shared breakpoint. | ~80 |
| 10 | **ListGrouped** | PARTIAL | real headers: `src/pages/Radio.tsx:200-227` (`StationSection`), `src/components/playlist/SearchResults.tsx:38-60`. Grouping logic without headers: `ContinueWatching.tsx:62-80`, `RecentlyAdded.tsx:64-80` | The two Dashboard groupers compute groups then throw them away — each group collapses to `items[0]` plus a `+N` counter (`ContinueWatching.tsx:198-204`, `RecentlyAdded.tsx:180-185`). No shared component; no sticky group header; no collapse. | ~120 |
| 11 | **ListCompact** | PARTIAL | `.rule-row` in `src/index.css:1784` (fixed `padding: 0.875rem 0.125rem`), with density forced per call site: `Quran.tsx:373` `py-2.5`, `:984` `py-2`, `:1082` `py-2`, `:1436` `py-2.5`, `:1500` `py-2`, `ReminderCard.tsx:33` `py-3.5`, `QueueRow.tsx:25` `py-2`, `Settings.tsx:736` `py-2.5` | Density is eight ad-hoc overrides of one base. Needs `density="comfortable|compact"` on the primitive and the eight sites migrated. | ~60 |
| 12 | **StatStrip** | PARTIAL | six rival treatments — `Dashboard.tsx:196-217` (caption row, `border-t`/`border-s`), `Dashboard.tsx:146-190` (display figure + meter), `Library.tsx:404-420` (`<dl>` on `border-y`), `PlaylistDetail.tsx:174-185` (3-col `border-y`), `Reminders.tsx:279-295` (`ReminderMetric`, icon + `.rule-row`), `Settings.tsx:735-746` (`DiagRow`) | One component with `variant` and `emphasis`; six migrations. Value/label order is already inconsistent (Library puts `<dd>` before `<dt>`; Dashboard puts label first). | ~110 |
| 13 | **ChipRow** | PARTIAL | eight chip treatments — `PlaylistCard.tsx:391-397` (`Chip`), `.premium-pill` (`index.css:2010`, 5 pages), `Library.tsx:637-645`, `Watch.tsx:190-196`, `Hero.tsx:114-121`, `Sidebar.tsx:69-71`, `.media-badge` (`index.css:2299`), `QueuePanel.tsx:92` | One chip primitive with `tone`/`size`/`pressed`; overflow handling; keyboard roving. `QueuePanel.tsx:92` uses `primary-blue` — a dead accent. | ~90 |
| 14 | **SectionHeader** | PARTIAL | `SectionRule` (`PlaylistGrid.tsx:99-116`), `.rule-head` (`index.css:1751-1777`), `useEyebrowClass` (`ContinueWatching.tsx:22-28`), `Section` (`Settings.tsx:749-761`) | **Eight distinct treatments ship, not four** — full list below. One component with `size`, `count`, `action`, `rule` props; 18 call sites to migrate. | ~120 |
| 15 | **EmptyState** | PARTIAL | good: `PlaylistGrid.tsx:122-140`, `Watch.tsx:206-241`, `ContinueWatching.tsx:103-114`, `Reminders.tsx:203-219`. Bare strings: `PlaylistDetail.tsx:288-298`, `Radio.tsx:212`, `Settings.tsx:511`, `QueuePanel.tsx:143-153` | Four routes have designed states, four have bare `<p>`s, and four list surfaces have **no** empty branch at all (Quran surah index `Quran.tsx:279`, Quran reciter list `Quran.tsx:1425`, Downloads has no empty state, Diagnostics has no "not run yet"). | ~140 |
| 16 | **ErrorState** | PARTIAL | real: `Radio.tsx:181-196` (retry wired), `Settings.tsx:362-378` (retry wired), `VideoPlayer.tsx:308-345` (per-video, actions wired). Inline strips: `Library.tsx:521-536`, `Watch.tsx:96-110`, `Reminders.tsx:181-186`, `Downloads.tsx:299-301`, `Quran.tsx:100-105` | 3 of the 7 named conditions surface at all; 0 of the 4 recovery fns are reachable outside `/settings`. Detection does not exist for 3 conditions. See §Error conditions. | ~320 incl. detection |
| 17 | **LoadingState** | PARTIAL | 6 bespoke skeletons — `Dashboard.tsx:257-273` (`GlanceSkeleton`), `Dashboard.tsx:290-299`, `ContinueWatching.tsx:322-347` (`FeatureSkeleton`), `RecentlyAdded.tsx:100-110`, `PlaylistGrid.tsx:145-163` (`PlaylistGridSkeleton`), `PlaylistDetail.tsx:268-281`. 5 bare spinners — `Reminders.tsx:194-198`, `Quran.tsx:299-303`, `Quran.tsx:1427-1431`, `Settings.tsx:353-358`, `Radio.tsx:173-178` | No shared component; skeleton fill is `bg-panel-hover` in three files and `bg-elevated-panel` in two; spinner is `Loader2` in four places and a hand-rolled `border-2 ... animate-spin` div in `Reminders.tsx:196`. | ~150 |
| 18 | **FirstRun** | MISSING | — | No onboarding anywhere. First launch lands on `/` with three simultaneous empty states (`ContinueWatching`, `RecentlyAdded`, `TodaysRemindersPanel`) and the import CTA is below the 416px hero. `LibraryEmptyState` — the one good first-contact screen — only exists on `/library`. | ~200 |
| 19 | **TitleBar** | EXISTS (thin) | `src/components/layout/TitleBar.tsx:1-50` | Drag region + three window buttons, correct. Missing: maximize/restore icon swap, window-blur dim, per-surface-profile treatment (Onyx must lose the border, Pearl must gain one), and `hover:text-white` at `:45` is a hardcoded colour. | ~40 |
| 20 | **SidebarNav** | EXISTS | `src/components/layout/Sidebar.tsx:1-139` | Grouped nav with inset active marker and RTL flip — good. Missing: collapse-to-rail, now-playing footer slot (the mini-player floats instead), badge/count slots, keyboard nav. Note `isPlayerOpen` collapses it to `w-0` (`:52-54`), which is why there is no "browse while watching". | ~120 |
| 21 | **PlayerDocked** | PARTIAL | `src/components/radio/RadioMiniPlayer.tsx:1-328`; `src/store/radioStore.ts` | Audio only. See §RadioMiniPlayer. Missing: video, layout reservation, token-derived colours, position/duration in the store, media-session, keyboard. | ~260 |
| 22 | **PlayerExpanded** | PARTIAL | `src/pages/PlayerPage.tsx`, `player/PlayerHeader.tsx`, `player/VideoPlayer.tsx`, `player/ProgressBar.tsx`, `player/PlayerControls.tsx`, `player/QueuePanel.tsx`, `player/QueueRow.tsx` | Full and capable, but it is a **route**, not an expandable surface: `App.tsx:52-58` navigates to `/player`, `PlayerPage.tsx:54-64` tears down on unmount. No dock↔expand transition, no shared element. Header/queue still use `primary-blue` (`PlayerHeader.tsx:41,45`, `QueuePanel.tsx:86,92,145,151`). | ~180 |
| 23 | **CommandPalette** | MISSING | `src/hooks/useKeyboardShortcuts.ts:1-89` is player-only and gated on `isPlayerOpen` | No global key handler, no Ctrl/Cmd-K, no command registry. Every action in the app is reachable only by pointing at it. | ~280 |
| 24 | **ToastStack** | PARTIAL | `src/pages/Settings.tsx:135-146` (state), `:417-430` (render) | Single slot, Settings-local, fixed 3s, no queue, no dismiss, no stack, not portalled — it renders inline and pushes the page. Everywhere else uses an inline `border-s-2` status strip (`QuickActions.tsx:112-126`, `Library.tsx:521-536`, `Library.tsx:660-680`). | ~140 |
| 25 | **SheetSettings** | MISSING | `src/pages/Settings.tsx` is a full route (918 LOC, 8 `Section`s) | No sheet/drawer primitive anywhere. The only overlay idiom is `ReminderModal.tsx:33-68`, which is a centred dialog with a `bg-black/60` scrim. Theme and language — the two settings most likely to be changed mid-task — require leaving the current route. | ~220 |

---

### SectionHeader: how many treatments actually ship

The brief says "at least four variants in the wild." **Eight distinct section-header treatments ship**, across 18 call sites, plus two page-eyebrow idioms on top of that.

**A. `SectionRule` component** — `src/components/playlist/PlaylistGrid.tsx:99-116`
```
<div className="flex items-baseline justify-between gap-4 border-b border-border pb-2.5">
  <h2 className="flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-text">
```
4 call sites: `PlaylistGrid.tsx:75`, `SearchResults.tsx:41`, `SearchResults.tsx:52`, `Library.tsx:563 / :587 / :626`. Uses a **flat** `border-b border-border`, not the `.rule-head` gradient.

**B. `.rule-head` + `text-sm font-semibold text-text-primary`** — 3 sites
- `src/pages/Radio.tsx:206` — `<h2 className="text-sm font-semibold text-text-primary">{title}</h2>`
- `src/components/playlist/PlaylistDetail.tsx:200` — `<h3 className="text-sm font-semibold text-text-primary">{t('videosInPlaylist')}</h3>`
- `src/pages/Quran.tsx:1472` — `<span className="min-w-0 truncate text-sm font-semibold text-text-primary">`

**C. `.rule-head` + `text-xs font-semibold text-text-primary`** — 3 sites
- `src/pages/Watch.tsx:120` — `<h2 className="flex min-w-0 items-center gap-2 text-xs font-semibold text-text-primary">` (icon + the query string as the heading)
- `src/pages/Watch.tsx:408` — `<h2 className="flex items-center gap-2 text-xs font-semibold text-text-primary">` (icon + label + a destructive text action)
- `src/pages/Downloads.tsx:273` — `<span className="text-xs font-semibold text-text-primary">{t('progress')}</span>` (a `<span>`, not a heading — no landmark)

**D. `.rule-head` + `text-xs font-semibold tracking-wide`** — 2 sites
- `src/pages/Quran.tsx:239` — `<span className="text-xs font-semibold tracking-wide text-text-primary" dir="auto">`
- `src/pages/Quran.tsx:1397` — same
`tracking-wide` here is dead weight in Arabic: `html[data-language='ar']` zeroes letter-spacing globally, so these two headers silently render at a different width from B/C depending on language.

**E. `.rule-head` + `text-sm text-text-primary`, no weight** — 2 sites
- `src/pages/Settings.tsx:463` — `<h3 className="text-sm text-text-primary">{t('appTheme')}</h3>` (trailing slot holds a *description*, not a count)
- `src/pages/Settings.tsx:505` — `<h3 className="text-sm text-text-primary">{t('importedFolders')}</h3>`

**F. `useEyebrowClass` + hand-rolled `border-b border-border pb-3`** — `src/components/dashboard/ContinueWatching.tsx:22-28`
```
language === 'ar'
  ? 'text-[11px] font-medium text-muted-text'
  : 'text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-text'
```
5 sites: `ContinueWatching.tsx:93`, `ContinueWatching.tsx:131` (**no rule at all**), `RecentlyAdded.tsx:92`, `Dashboard.tsx:141`, `Dashboard.tsx:171` (**no rule**), `Dashboard.tsx:287`. Visually identical to A but a different implementation and a different rule.

**G. Settings `Section` heading** — `src/pages/Settings.tsx:756`
```
<h2 className="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase text-muted-text">
```
8 sites (every `<Section>`). Uppercase with **no tracking** — the only uppercase header in the app that isn't tracked.

**H. QueuePanel header** — `src/components/player/QueuePanel.tsx:83-97`
```
<div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
  <ListMusic className="h-4 w-4 text-primary-blue" />
  <span className="text-sm font-semibold text-text-primary">{t('queue')}</span>
  <span className="rounded-full border border-primary-blue/15 bg-primary-blue/10 px-2 py-0.5 text-xs text-primary-blue">
```
The only header whose count is a filled pill, and the only one painted in `primary-blue`.

**On top of that, two page-eyebrow idioms and three page-title scales:**
- `.premium-pill` — `Watch.tsx:53`, `Radio.tsx:84`, `Library.tsx:375`, `Quran.tsx:88`, `Downloads.tsx:137`
- Dashboard's dash-and-accent eyebrow — `Dashboard.tsx:104-115` (`h-px w-8 bg-accent-gold/50` + accent-gold uppercase)
- h1: `text-3xl ... tracking-normal` on six routes; `text-[2.5rem] ... tracking-[-0.025em]` on Library (`:378`); `text-4xl/[3.25rem] tracking-[-0.02em]` on Dashboard (`:114`, via `titleType`)

**Verdict: 8 section-header treatments + 2 eyebrow idioms + 3 title scales = 13 header shapes for 8 routes.** Two rule mechanisms are in play — the `.rule-head` gradient hairline (`index.css:1751-1777`, fades from `0.30` to `0.05` across the width) and a flat `border-b border-border`. A and F look the same and are the same design intent, built twice.

---

### Empty states, route by route

| Route | State | Verdict |
|---|---|---|
| **/** Dashboard | `ContinueWatching.tsx:103-114` — `.premium-card`, 64px medallion ring + `PlayCircle`, headline, body, **"Open library" button wired to `navigate('/library')`** | **Genuine, with action** |
| | `RecentlyAdded.tsx:112-122` — 56px ring + `FolderPlus`, headline, body | Genuine, **no action** |
| | `Dashboard.tsx:305-316` (`TodaysRemindersPanel`) — 48px ring + `BellOff`, headline, body ("create reminders in the tab") | Genuine, **no action** — tells the user in prose to navigate |
| **/quran** | `ReaderPlaceholder` `Quran.tsx:307-325` — nested double-square frame + `BookOpen` + one line + `gold-thread` | Designed, **one string, no action** |
| | ListenTab no-reciter `Quran.tsx:1538-1554` — same frame, `recitersError ?? t('quranNoReciters')` | **Conflates error and empty**, no retry |
| | Surah index filtered to zero — `Quran.tsx:279` `{filtered.map(...)}` | **No branch. Blank scroller.** |
| | Reciter list filtered to zero — `Quran.tsx:1425` `{filteredReciters.map(...)}` | **No branch. Blank scroller.** |
| **/library** | `LibraryEmptyState` `PlaylistGrid.tsx:122-140` — `PlaylistArt` geometry at poster scale, headline, body, **primary "Import folder"** | **Best in the app** |
| | filter no-match `Library.tsx:610-627` — `SearchX`, headline, body, **"Clear" button** | Genuine, with action |
| | search no-results `SearchResults.tsx:29-36` — `SearchX`, headline, body | Genuine, no action |
| | playlist has no videos `PlaylistDetail.tsx:288-292` — `<p className="text-sm">` + `<p className="text-xs">` | **Bare string** |
| | video filter no-match `PlaylistDetail.tsx:293-298` — same two `<p>`s | **Bare string** |
| **/watch** | `WatchPlaceholder` `Watch.tsx:206-241` — double frame, promise, `gold-thread`, **six wired category suggestions**, ad-free note | **Genuine, best-in-class** |
| | no-results `Watch.tsx:150` — `<WatchPlaceholder icon={Youtube} title={t('watchNoResults')} />` | **Degenerate**: title only, no hint, no suggestions, no action |
| **/radio** | `Radio.tsx:212` — `<p className="py-10 text-center text-sm text-muted-text">{emptyLabel}</p>` | **Bare string** |
| **/reminders** | `Reminders.tsx:203-219` — bare `Clock` icon (no ring/frame), headline, body, **"Create reminder"** | Genuine with action, but a **fourth** icon idiom (no medallion, no frame, no geometry) |
| **/downloads** | none | **No empty state exists.** Falls back to a status string in the aside: `Downloads.tsx:74-79` → `t('readyForNextDownload')` / `t('noDownloadYet')` |
| **/settings** | `Settings.tsx:511` — `<p className="py-4 text-sm text-muted-text">{t('noFoldersImported')}</p>` | **Bare string** |
| | Diagnostics before first run — `Settings.tsx:689` `{diagnostics && (...)}` | **No branch.** Section renders as a lone button |

Also `/player` (not one of the eight): `PlayerPage.tsx:76-104` — `.premium-surface` panel, `icon-medallion` with an inline SVG play triangle in `text-primary-blue/55`, two wired buttons. Genuine, but painted in the dead accent.

**Tally: 5 genuine-with-action, 4 genuine-without-action, 5 bare strings, 4 with no branch at all.** Four different empty-state icon idioms are in use: geometric `PlaylistArt`, nested double-square frame (`Watch`/`Quran`), circular medallion ring (`Dashboard`), and a naked lucide glyph (`Reminders`, `QueuePanel`).

---

### RadioMiniPlayer vs PlayerDocked

`src/components/radio/RadioMiniPlayer.tsx` (328 LOC), `src/store/radioStore.ts` (206), `src/store/playerStore.ts` (615).

**What it already is.** Mounted once at `App.tsx:79`, outside `<Routes>`, so it survives navigation — cross-route persistence is real for everything it handles. It owns the app's single `<audio>` element and publishes it via `audioElementHolder` (`radioStore.ts:23`), which the Qur'an word-sync engine reads every frame. It has two presentations (collapsed pill `:143-175`, expanded panel `:177-325`) with the choice persisted to `localStorage['salafi-hub.player-collapsed']` (`:48,:54`). It has volume, loop, a 15/30/60/90 sleep timer, buffering state, a seek bar that appears only when `seekable` (`:50,:302`), and genuinely careful error handling (`:63-91`, `:118-131` — the comments there document two real bugs it fixes).

**What it does *not* do.**

1. **No video.** Video lives entirely in `playerStore` + `VideoPlayer`, which only exist while `/player` is mounted; `PlayerPage.tsx:54-64` calls `leavePlayerView()` on unmount and `Sidebar.tsx:52-54` collapses the nav to `w-0` while that route is open. Navigating away stops the video. There is no dock for video and no path to one without splitting `playerStore`'s element ownership.
2. **It *does* carry reciter audio — as a fake radio station.** `Quran.tsx:1500-1510` calls `playStation({ id: 'quran-${reciter.id}-${surah.id}', name: '${surah.transliteration} · ${reciter.name}', url })`. `RadioStation` is `{id, name, url}` (`radioStore.ts:4-8`), so surah and reciter are concatenated into one string with a `·` and cannot be separated for display. `Radio.tsx:73-76` has to filter `current` against the station catalogue specifically so the Radio page doesn't announce a surah as a live station — the comment there says so. A real `PlayerDocked` needs a typed source (`radio | reciter | video`) with structured metadata.
3. **No queue.** `radioStore` has no queue, no next/previous, no history. `playerStore` has `queueVideoIds`, `next`, `previous`, `repeatMode`, `playbackRate`, `autoplay` (`playerStore.ts:11,38-49`) — none of it reachable from the dock.
4. **Position and duration are component-local React state** (`:45-46`), not store state. Nothing else in the app can read the playhead. Any second surface (a Quran-page scrubber, a taskbar thumbnail, a media-session handler) would need this lifted.
5. **No layout reservation.** `fixed bottom-5 end-5 z-40` (`:147,:187`) — it floats over whatever is underneath, including the last row of every list and the Qur'an reading pane. No page reserves space for it.
6. **Wrong colours.** `bg-primary-blue text-white` on the play button (`:151`, `:192`) and `text-primary-blue` on the station icon and "Playing now" (`:208`, `:229`) — `primary-blue`/`accent-blue` is one of the four accent seeds the app renders ~once. Plus hardcoded shadow literals `[box-shadow:...rgb(0_0_0/0.6)...]` at `:147` and `:187`, which are `rgb()` literals in component code.
7. **No keyboard.** `useKeyboardShortcuts` returns early unless `isPlayerOpen` (`useKeyboardShortcuts.ts:22`), which is the *video* player's flag. The dock has no shortcuts at all.
8. **No OS integration** — no `navigator.mediaSession`, no SMTC on Windows.

**Distance to `PlayerDocked`:** the persistence, the audio-element lifecycle and the error handling are done and should be preserved verbatim. What is needed is a source-typed store slice above both `radioStore` and `playerStore`, position/duration lifted into it, layout reservation, and token-derived colour. Video docking is a separate, larger job.

---

### The seven named error conditions

| # | Condition | Surfaces to the user? | Where | Recovery wired? |
|---|---|---|---|---|
| 1 | **Imported folder missing / drive disconnected** | **No** | Folder paths are listed at `Settings.tsx:514-532` with no existence check. The only related surface is per-video: `VideoPlayer.tsx:294` (`diagnostics.issue === 'file-missing'`) → error panel at `:308-345`. A whole disconnected drive is silent until you click a video. | No detection exists |
| 2 | **Radio stream offline / timed out** | **Yes, twice** | Catalogue failure: `Radio.tsx:181-196` — `AlertTriangle` + message + **Retry** calling `loadStations`. Per-stream: `radioStore.ts:161` `markPlaybackError` → `RadioMiniPlayer.tsx:211-219` shows `t('radioStreamProblem')` and the play button becomes `RefreshCw` → `retry` (`:150`, `:191`, store `:150-159`). | **Yes** — the only fully wired pair in the app |
| 3 | **ffmpeg not found** | **Yes, but only in Settings** | `ffmpegBadge` `Settings.tsx:391-398` (danger-red "missing"); help line `:557-559`; conditional **Install ffmpeg** button `:596-598`; `DiagRow` `:697-701`. Not surfaced on `/library` (where thumbnails silently don't generate) or `/downloads` (where merging fails). | Yes, in Settings only |
| 4 | **Thumbnail generation failed** | **Barely** | A bare word in a video row's metadata line: `PlaylistDetail.tsx:359` `{(video.thumbnailStatus === 'failed' \|\| 'fallback') && <span>{t('fallbackThumbnail')}</span>}`. Aggregate counts as captions at `Dashboard.tsx:76-81` and `Settings.tsx:602-609`. No error block, no cause, no action at the point of failure. | Partially — `regenerate_missing_thumbnails` at `Settings.tsx:258` and `Library.tsx:245` (via `PlaylistMenu`) |
| 5 | **Database needs repair / orphaned entries** | **No** | Nothing detects it. Nothing announces it. The closest signal is Reminders' `brokenReminders` (`Reminders.tsx:132-135`) → a metric tile `:186` and a warning line `:239-248` — **with no action attached**, even though `remove_orphaned_entries` is exactly the fix. | No detection; recovery buried |
| 6 | **No network (radio down, library fine)** | **No** | `grep` for `navigator.onLine` / `'offline'` listeners returns **zero hits** in `src/`. `diagnostics.internetOk` exists (`Settings.tsx:707-711`) but only after manually pressing **Run diagnostics**. Radio and Watch each fail with their own raw backend message; nothing tells the user the library is unaffected. | No |
| 7 | **Update check failed** | **Partially** | `UpdateManager.tsx:36-40`: the card shows for `phase === 'error'` **only if `Boolean(update)`** — a failed *check* with no update object renders nothing at all. Settings shows a caption: `Settings.tsx:166-167` (`updateError ?? t('updateCheckFailed')`) rendered at `:669-676`. | Retry exists at `UpdateManager.tsx:118-123` and `Settings.tsx:678-684` |

**Where the four recovery functions are reachable from:**

| Function | Call site | Reachable from |
|---|---|---|
| `rescan_all` | `Settings.tsx:187` (`handleRescanAll`) | **One place**: `Settings.tsx:536` `<ActionButton>` in the "Library" `ActionBar`. Styled `.quiet-action` — plain text, no border, no fill. |
| `repair_database` | `Settings.tsx:201` | **One place**: `Settings.tsx:537`, behind `confirm(t('repairDatabaseConfirm'))` at `:198`. |
| `remove_orphaned_entries` | `Settings.tsx:214` | **One place**: `Settings.tsx:538`, `danger` variant, behind `confirm()` at `:211`. |
| `get_diagnostics` | `Settings.tsx:117` | **One place**: `Settings.tsx:721-727`, "Run diagnostics" in the last section of a 918-line page. |

All four sit in the same `ActionBar` idiom (`Settings.tsx:782-784`) — a flex row of `.quiet-action` text buttons — three of them stacked side by side on one line at `:535-539`. Adjacent commands: `rescan_playlist` (`Library.tsx:230`, reachable from `PlaylistMenu`), `regenerate_missing_thumbnails` (`Library.tsx:245` + `Settings.tsx:258`), `clear_thumbnail_cache` (`Settings.tsx:228`), `install_ffmpeg_helper` (`Settings.tsx:241`, `:255`).

**Net: 2 of 7 conditions have both detection and a wired recovery at the point of failure. 3 have no detection at all. 0 of the 4 recovery functions are reachable outside `/settings`.**

---

### Quantifying the inconsistency

**Card / panel treatments — 11 distinct**

| Treatment | Sites |
|---|---|
| `.premium-card .premium-card-hover rounded-lg` | `ContinueWatching.tsx:173`, `Watch.tsx:440`, `Watch.tsx:507` |
| `.premium-card rounded-lg` (no hover) | `ContinueWatching.tsx:104`, `ContinueWatching.tsx:324`, `Downloads.tsx:391` |
| `.surface-2 .surface-lift rounded-xl` poster | `PlaylistCard.tsx:475` |
| `.surface-2 .surface-lift rounded-xl` wide | `PlaylistCard.tsx:371` |
| `.premium-surface rounded-lg` | `Watch.tsx:320`, `PlayerPage.tsx:78`, `VideoPlayer.tsx:313`, `ReminderAlarm.tsx:216` |
| `.premium-surface rounded-xl` + inline `background` override | `ReminderModal.tsx:45-47` |
| hand-rolled `rounded-xl border border-border bg-panel/40` | `PlaylistGrid.tsx:126`, `PlaylistGrid.tsx:150`, `Library.tsx:611`, `SearchResults.tsx:30` |
| hand-rolled `rounded-lg border border-border bg-panel/95 shadow-2xl backdrop-blur` | `UpdateManager.tsx:56` |
| hand-rolled `rounded-xl border-border/70 bg-panel/85 backdrop-blur-xl [box-shadow:…]` | `RadioMiniPlayer.tsx:187` |
| hand-rolled `rounded-full border-border/70 bg-panel/80 backdrop-blur-xl [box-shadow:…]` | `RadioMiniPlayer.tsx:147` |
| inner `rounded-md border border-border bg-background` | `ReminderAlarm.tsx:239`, `UpdateManager.tsx:91`, `UpdateManager.tsx:100` |

Four radii (`full`/`md`/`lg`/`xl`), three border tokens (`border`, `border/70`, tinted), three elevation mechanisms (`.surface-lift`, `shadow-2xl`, hand-written `[box-shadow:…]` with `rgb(0 0 0 / …)` literals).

**List-row treatments — 7 distinct**
1. `.rule-row` (`index.css:1784`) — 20 call sites across 12 files
2. `RecentlyAdded.tsx:150` — hand-rolled `border-b border-border py-4 … hover:bg-accent-gold/[0.04]`, 112×63 thumb
3. `ContinueWatching.tsx:283` (`QueueRow`) — hand-rolled `border-b border-border py-4`, no thumb, hairline meter
4. `Dashboard.tsx:320` — hand-rolled `border-b border-border py-4 last:border-b-0`, time + title
5. `Dashboard.tsx:198-216` — divider-cell metric row (`border-t`/`sm:border-s`)
6. `Library.tsx:404-420` — `<dl>` band (`border-y` + `sm:border-s`)
7. `Sidebar.tsx:97-104` — `px-3 py-2.5` + `shadow-[inset_3px_0_0_…]`, no bottom rule

**Progress-meter treatments — 10 distinct**
`ProgressMeter` (`PlaylistCard.tsx:362-375`, rounded-full h-1/h-1.5, track `bg-accent-gold/[0.14]`) · Dashboard `Meter` (`Dashboard.tsx:243-269`, h-[3px]/h-px, track `rgb(var(--text-muted-rgb) / 0.18)`) · `ContinueWatching.tsx:224-233` (h-[3px], same track token, different component) · `ContinueWatching.tsx:305-311` (h-px) · poster overlay `h-[3px] bg-background/70` (`PlaylistCard.tsx:481`, `PlaylistDetail.tsx:329`, `SearchResults.tsx:130`) · `h-1 bg-background/70` (`PlaylistDetail.tsx:159`) · `h-1 bg-black/50` (`Watch.tsx:466`) · `h-1 bg-accent-gold/15` (`Downloads.tsx:295-301`) · `h-2 bg-background` + `bg-primary-blue` (`UpdateManager.tsx:105-108`) · `h-0.5 bg-background/70` + `bg-muted-text` (`QueueRow.tsx:56-58`).

**Thumbnail placeholder systems — 2, mutually incompatible**
`LocalThumbnail` → `.thumbnail-fallback` + `.icon-medallion` (`LocalThumbnail.tsx:33-40`) vs `PlaylistPoster` → `PlaylistArt` generated geometry (`PlaylistCard.tsx:257-321`). The medallion is so unwanted that both Dashboard components define `const QUIET_FALLBACK = 'thumbnail-fallback thumbnail-fallback-quiet'` purely to suppress it (`ContinueWatching.tsx:16`, `RecentlyAdded.tsx:15`) — with an identical explanatory comment copy-pasted into both files. Thumb sizes in use: 112×63, 104×58, 96×54, `w-56`, `aspect-video`.

**Toggle switch — the same 20-line component written 3 times**
`Settings.tsx:52-79`, `Downloads.tsx:453-472`, `ReminderCard.tsx:34-59`. All three are `h-5 w-9 rounded-full border` with a `h-3 w-3` knob, `translate-x-4 rtl:-translate-x-4`, and the same `border-accent-gold/40 bg-accent-gold/20` on-state. None imports the others.

**Chip treatments — 8** (listed in row 13 above).
**Stat treatments — 6** (row 12). **Section headers — 8** (§SectionHeader). **Skeletons — 6, spinners — 5** (row 17). **Split panes — 4** (row 9). **Media grids — 4** (row 8).

**Headline number for the brief: 25 requested blocks → 3 EXISTS, 15 PARTIAL, 7 MISSING; and the PARTIALs are partial because the same idea ships between 2 and 11 times in different clothes.** The material system underneath (`index.css` surface ladder, `.rule-row`/`.rule-head`, four motion tiers) is sound — the failure is that roughly half the app's surfaces bypass it and hand-roll the same shape one more time.


## Risks

- **Unifying SectionHeader collapses two different rule mechanisms — the `.rule-head` gradient hairline (index.css:1751-1777, fading 0.30→0.05 across the width) and the flat `border-b border-border` used by SectionRule and the Dashboard eyebrow. Picking one changes the look of 18 call sites at once, in all ten themes.**
  - Mitigation: Ship `<SectionHeader rule="gradient|flat|none">` with `gradient` as the default, migrate call sites in three batches (Library/search first, Quran second, Settings/Downloads last), and screenshot-diff each batch across 5 themes × 2 languages with the existing scripts/harness before merging the next.
- **The `--hair-rgb: var(--accent-gold-rgb)` binding means the .rule-head gradient is invisible on any theme whose accent resolves close to the surface. Since 8 of 10 themes resolve gold and 'blue'/'red' are byte-identical, a header unification will look correct in testing and wrong the moment the accent seeds are actually differentiated in Part I.**
  - Mitigation: Sequence the header work AFTER the accent-seed fix, or drive the header rule from a dedicated `--rule-rgb` token seeded independently of `--accent-gold-rgb`, and add a contrast assertion to the harness probe for the header hairline against `--bg-main` in all ten themes.
- **Lifting position/duration out of RadioMiniPlayer's local state (lines 45-46) into a store touches the same element whose clock the Qur'an word-sync engine polls every animation frame via `audioElementHolder` (radioStore.ts:23). A store write per timeupdate would put React reconciliation in the sync path.**
  - Mitigation: Keep `audioElementHolder` as the sync engine's read path untouched. Publish position to the store on a throttled interval (250ms) for display only, and add an explicit comment at the holder declaring it the authoritative low-latency path. Never let the sync tracker read store state.
- **Docking video means the <video> element must outlive the /player route, but PlayerPage.tsx:54-64 currently tears down on unmount and Sidebar.tsx:52-54 assumes /player is exclusive. Hoisting it changes fullscreen handling, keyboard scope, and the thumbnail-generation pause logic in useAppEvents.ts:29-32 that keys off `isPlayerBusy()`.**
  - Mitigation: Treat video docking as a separate phase after PlayerDocked ships for audio. When it lands, hoist the element to App level behind a portal, keep `isPlayerOpen` as the expanded-view flag only, and add a regression test that thumbnail generation still pauses while a docked video plays.
- **Detection for the three unsurfaced error conditions (missing folder, DB needs repair, no network) does not exist anywhere in the frontend or, as far as the frontend can see, the backend. Writing ErrorState variants without detection produces seven components that can never render.**
  - Mitigation: Split the ErrorState work: ship the component with its seven variants driven by an explicit `condition` prop and a Storybook-equivalent harness route first; wire detection second, one condition per PR, starting with the two that need no new Rust (navigator.onLine for #6, an existsSync sweep over settings.importedFolders during rescan for #1).
- **AmbientLayer must be forced to Tier 0/1 over the Qur'an reading pane, but the pane's invariant is that `.quran-reading-surface` keeps `overflow: visible` and `border: none` because positionWordCue measures the cue against its padding box while word coords come from the border box. An ambient layer inserted as a sibling or wrapper can silently reintroduce a border or a scroll container.**
  - Mitigation: Mount AmbientLayer only at the app root at z-index 0, never inside a route subtree, and add a test that asserts getComputedStyle('.quran-reading-surface').overflow === 'visible' and borderWidth === '0px' with the ambient layer mounted in all ten themes at every tier.
- **Extracting the toggle switch, chip, and progress meter into single primitives touches ReminderCard, Downloads, and Settings simultaneously — all three of which carry RTL-specific fixes (`translate-x-4 rtl:-translate-x-4`, logical `start-[3px]` inset) documented in comments as bug fixes. A naive extraction can drop one.**
  - Mitigation: Extract by moving one existing implementation verbatim (Settings.tsx:52-79, the most commented) and deleting the other two, rather than writing a fresh one. Verify with the Arabic harness pass (design-audit/before-ar) that the knob travels toward the reading end in RTL for all three former call sites.

## Open questions

- The brief lists RailStation as a needed block, but Radio's real problem measured in Phase 0 is a 6431px unvirtualized list of 175 rows. Is RailStation meant to be a horizontal rail (which would not fix virtualization) or a virtualized vertical station surface? QueuePanel.tsx:8-9,74-83 already contains a working fixed-height virtualizer (ROW_HEIGHT=76, OVERSCAN_ROWS=6) that could be generalized — should that be the basis, or should a windowing library be introduced?
- PlayerDocked for video requires hoisting the <video> element above the router, which is a behavioural change (video keeps playing while you browse) not just a visual one. Is that in scope for Part II, or should PlayerDocked ship audio-only (radio + reciter) first with video docking deferred?
- The Qur'an reciter audio currently travels through radioStore as a synthetic station whose surah and reciter are concatenated into one `name` string (Quran.tsx:1500-1510, RadioStation is {id,name,url} at radioStore.ts:4-8). Splitting that into typed metadata touches the store the Qur'an sync engine depends on. Constraint 11 says do not touch the Quran data layer, word timings, or audio matching — does the station-shape change count as touching it, or is the store above that line?
- Five of the eight routes currently have zero surface reserved for a docked player (it floats at `fixed bottom-5 end-5 z-40`). Reserving layout space changes every page's usable height and will move the Phase 0 dead-space measurements. Should the dead-space targets (Watch 473px, Reminders 371px, Downloads 351px) be re-measured with the dock reserved, or is the dock expected to stay floating?
- There is no global toast host, and the only existing toast renders inline inside Settings and pushes the page (Settings.tsx:417-430). Should ToastStack replace the eight inline `border-s-2` status strips (QuickActions.tsx:112-126, Library.tsx:521-536, Library.tsx:660-680, Watch.tsx:96-110, Reminders.tsx:181-186, Downloads.tsx:299-301, Quran.tsx:100-105, Settings.tsx:432-437), or coexist with them — some of those are persistent results, not transient notifications, and would be wrong as toasts.
- FirstRun has no backing state: nothing in settingsStore, appStore, or the Rust settings record marks a launch as first. Is adding a persisted `hasCompletedFirstRun` flag acceptable, and if so does it belong in the SQLite settings row (which the backup export/import at Settings.tsx:271-301 would then carry) or in localStorage?
- The four surface profiles (light / pure-black / warm / cool) are specified as encoding per-theme variance without per-theme CSS. Should the profile be a data attribute stamped on <html> alongside data-theme (so components can key off `[data-profile='pure-black']`), or should each of the ten themes simply declare profile-derived values among its existing 22-25 seed vars? The latter keeps the zero-per-theme-component-code rule cleanly but duplicates the profile's values ten times.
- Twelve of the 25 blocks are grouped as visual-only, but ErrorState, CommandPalette, FirstRun, PlayerDocked and SheetSettings all require new behaviour and new state. Should Part II be split into a pure-presentation phase (blocks 4-17, 19-20) that can ship and be screenshot-verified independently, and a behavioural phase (18, 21-25) gated behind it?
