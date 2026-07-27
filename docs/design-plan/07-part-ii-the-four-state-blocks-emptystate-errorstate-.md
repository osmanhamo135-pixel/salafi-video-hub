# Part II — The Four State Blocks: EmptyState, ErrorState, LoadingState, FirstRun

## 0. Where this lands on disk

New directory `src/components/state/` — nothing else in the app owns a state surface after this lands.

| File | Contents |
|---|---|
| `src/components/state/types.ts` | Every type in this spec. No JSX. |
| `src/components/state/plateMarks.tsx` | `PLATE_MARKS` — the seven geometric marks. Single source; `PlaylistCard.tsx` imports from here and deletes its local `MARKS` array (`PlaylistCard.tsx:59-84`). |
| `src/components/state/Plate.tsx` | `<Plate>` — the one icon/plate idiom. Replaces four. |
| `src/components/state/EmptyState.tsx` | `<EmptyState>` + `EMPTY_REGISTRY`. |
| `src/components/state/ErrorState.tsx` | `<ErrorState>` + `ERROR_REGISTRY`. |
| `src/components/state/LoadingState.tsx` | `<LoadingState>`, `<Skeleton>`, `<InlineSpinner>`. |
| `src/components/state/FirstRun.tsx` | `<FirstRun>` + `useFirstRun()`. |
| `src/components/state/recoveryActions.ts` | `RECOVERY_ACTIONS` — the registry that makes `rescan_all` / `repair_database` / `remove_orphaned_entries` / `get_diagnostics` reachable from anywhere. |
| `src/store/healthStore.ts` | Detection for the three conditions that currently have none. |
| `src/hooks/useHealthMonitor.ts` | Mounts the detectors once, in `App.tsx`. |
| `src/utils/bidi.ts` | `RLI` / `PDI` / `rli()` / `lri()`. |
| `scripts/check-manhaj.mjs` | Lints the icon denylist, hex/`rgba()` literals, `text-white`/`bg-black`, and hand-written `tracking-*` inside `src/components/state/`. |

Two additive backend changes only, both in existing files. Nothing in `src/db/video.rs` moves; `VIDEO_COLUMNS` is untouched.

---

## 1. Prerequisites that must land first

### 1.1 `t()` gains interpolation (additive, non-breaking)

`useI18n().t` is `(key: TranslationKey) => string` today (`src/i18n.ts:1156`). Every string in this spec that carries a path, a count or a query needs a variable. Extend it:

```ts
// src/i18n.ts
export type TVars = Record<string, string | number>;

const ARABIC = /[؀-ۿ]/;

/** Substitutes {name} placeholders, isolating each value by its OWN direction. */
export const interpolate = (template: string, vars: TVars | undefined): string => {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    if (!(name in vars)) return whole;
    const raw = String(vars[name]);
    // Digits, paths, versions and Latin identifiers are LTR runs inside an
    // Arabic sentence and must be isolated, or the bidi algorithm drags the
    // sentence's trailing punctuation into them.
    return ARABIC.test(raw) ? rli(raw) : lri(raw);
  });
};

export const getTranslation = (
  language: AppLanguage | undefined,
  key: TranslationKey,
  vars?: TVars,
) => interpolate((language === 'ar' ? dictionaries.ar : dictionaries.en)[key] ?? dictionaries.en[key], vars);
```

and in `useI18n`: `const t = useCallback((key: TranslationKey, vars?: TVars) => getTranslation(language, key, vars), [language]);`

All ~600 existing call sites keep compiling — `vars` is optional.

### 1.2 `src/utils/bidi.ts` — and why RLI, not LRI

`App.tsx:44` pins `root.dir = 'ltr'` in **both** languages, deliberately. Every Arabic string therefore renders inside an LTR paragraph. An Arabic sentence ending in `.` or containing `(3)` will have its neutral characters resolved to the paragraph direction and jump to the wrong end. The fix is to give the string its own RTL paragraph — that is U+2067 RIGHT-TO-LEFT ISOLATE. U+2066 (LRI) forces the Arabic run into LTR order and reproduces exactly the `formatDuration` bug documented at `src/utils/formatTime.ts:23-26` (`1س 0د` → `1د0 س`).

```ts
// src/utils/bidi.ts
export const LRI = '⁦';
export const RLI = '⁧';
export const PDI = '⁩';
/** Isolate an RTL run. Use for any Arabic string rendered under dir="ltr". */
export const rli = (s: string) => `${RLI}${s}${PDI}`;
/** Isolate an LTR run — a path, a version, a count, "ffmpeg". */
export const lri = (s: string) => `${LRI}${s}${PDI}`;
```

**Rules for the four blocks:**
1. Every text node in a state block renders inside `<bdi dir="auto">`. Non-negotiable — an untranslated backend string can be either direction.
2. Literal Latin tokens *inside* an Arabic dictionary string (`ffmpeg`, `SQLite`, `YouTube`) are **not** hand-wrapped. The whole Arabic string is RLI-wrapped by `interpolate`/`<bdi dir="auto">`, which establishes an RTL paragraph in which the bidi algorithm places the Latin run correctly on its own.
3. **No `tracking-*` class, no `letter-spacing`, anywhere in `src/components/state/`.** `html[data-language='ar'] *` zeroes it with `!important` (`index.css:589-591`), so a tracked class does not merely fail in Arabic — it makes the English and Arabic renders different widths for no gain. Sizing comes only from the `fontSize` scale in `tailwind.config.js`, which already carries the correct per-step tracking. `scripts/check-manhaj.mjs` fails the build on `tracking-` in this directory.

### 1.3 Two token repairs (token work only — zero per-theme component code)

`--danger-rgb: 239 68 68` and `--warning-rgb: 214 181 109` are declared **once**, in `:root` (`index.css:74-75`), and overridden by no theme. Two consequences that only bite once errors exist:

- `--warning-rgb` is a warm gold that is byte-adjacent to `--accent-gold-rgb` on 8 of 10 themes. A warning and a normal accent are the same colour. **Fix:** set `--warning-rgb: 217 148 44;` in `:root` — a true amber, deliberately theme-independent, exactly the pattern `--mushaf-gold-rgb` already uses and justifies at `index.css:76-78`.
- Both fail contrast on Pearl, the one light theme. **Fix:** add to the `html[data-theme='pearl']` block only: `--danger-rgb: 185 28 28;` and `--warning-rgb: 161 98 7;`

Total: three declarations. No component knows.

### 1.4 `detectFfmpeg()` must run at app start

`ffmpegStatus` is only populated by `Settings.tsx:151`. Anything outside `/settings` reading it sees `null`. Add `detectFfmpeg()` to the mount effect in `App.tsx:31-33`, beside `loadSettings()`.

### 1.5 One new backend command (additive)

Orphan detection currently does not exist, and `remove_orphaned_entries` mutates, so it cannot be a probe. Add to `src-tauri/src/commands/settings.rs`, directly above `remove_orphaned_entries`:

```rust
/// Read-only counterpart to `remove_orphaned_entries`: how many rows point at
/// a file that is gone. Detection must never mutate, or the health check and
/// the recovery become the same button.
#[tauri::command]
pub fn count_orphaned_entries(db: State<'_, DbState>) -> Result<usize, String> {
    let videos = crate::db::video::get_all_videos(&db).map_err(|e| e.to_string())?;
    Ok(videos
        .iter()
        .filter(|v| !std::path::Path::new(&v.file_path).exists())
        .count())
}
```

Register in `src-tauri/src/lib.rs` immediately after `commands::settings::remove_orphaned_entries,` (line 98). It goes through `db::video::get_all_videos`, which already uses `VIDEO_COLUMNS`.

---

## 2. `<Plate>` — the one plate idiom

Four idioms ship today: generated `PlaylistArt` geometry (`PlaylistGrid.tsx:128`), the nested double-square frame (`Watch.tsx:213-220`, `Quran.tsx:326-333`), the circular medallion ring (`ContinueWatching.tsx:105`, `Dashboard.tsx:305`), and a naked lucide glyph (`Reminders.tsx:204`, `QueuePanel.tsx:145`). One replaces all four.

**Manhaj:** every mark is stroked polygon/circle/line geometry generated in code — no bundled artwork, no raster, no AI output, nothing derived from the three reference plates. No Qur'anic text appears in any plate, at any size, at any opacity. `src/assets/marks/basmala.svg` and `noor.svg` are **forbidden** in all four blocks: on a screen carrying buttons they would function as decoration for the buttons, which constraints 2 and 10 disallow. The Basmala stays where it is the subject — `Hero.tsx:64-125`.

```ts
// src/components/state/types.ts
import type { LucideIcon } from 'lucide-react';

export type PlateMarkId =
  | 'khatam8'      // 8-point khatam star + inner square + circle  (PlaylistCard MARKS[0])
  | 'interlace'    // two interlaced squares + circle               (MARKS[1])
  | 'rosette12'    // 12-point rosette, two concentric circles      (MARKS[2])
  | 'hexLattice'   // two offset hexagons + circle                  (MARKS[3])
  | 'mistara'      // NEW: five ruled lines — the ruled page. Anything list-shaped.
  | 'jadwalEmpty'  // NEW: nested rectangles only, no centre mark. The reading pane.
  | 'girihBreak';  // NEW: interlaced strapwork with ONE strand opened. Errors only.

export type PlateSize = 'sm' | 'md' | 'lg';
export type PlateTone = 'accent' | 'quiet' | 'warning' | 'danger';

export interface PlateProps {
  mark: PlateMarkId;
  /** sm = 48px frame / 38px inner / 18px icon (in-card)
   *  md = 64px frame / 52px inner / 24px icon — the exact existing metric at Watch.tsx:215-219
   *  lg = 112x176 landscape plate — the exact existing metric at PlaylistGrid.tsx:127 */
  size?: PlateSize;          // default 'md'
  tone?: PlateTone;          // default 'accent'
  /** Optional lucide glyph centred inside the mark. Must not appear in ANIMATE_ICON_DENYLIST. */
  icon?: LucideIcon;
  frame?: 'jadwal' | 'none'; // default 'jadwal' — the nested double square
  className?: string;
}
```

Tone → classes, all token-derived (no literal survives `check-manhaj.mjs`):

| tone | outer frame | inner frame | mark + icon |
|---|---|---|---|
| `accent` | `border-accent-gold/25` | `border-accent-gold/15` | `text-accent-gold/70` |
| `quiet` | `border-border` | `border-border-faint` | `text-text-faint` |
| `warning` | `border-warning-orange/30` | `border-warning-orange/15` | `text-warning-orange` |
| `danger` | `border-danger-red/30` | `border-danger-red/15` | `text-danger-red` |

Square corners on the frame, deliberately — the reasoning already written at `PlaylistCard.tsx:124-125` ("a rounded double border is a web card") applies verbatim.

**`girihBreak` geometry** (new, `plateMarks.tsx`): the `interlace` construction with the outer square's top-right strand drawn as two segments with a 14-unit gap at the crossing. It is a broken join, not an alarm triangle, and it gives errors a visual language that is native to the app instead of borrowed from a browser dialog. `viewBox="0 0 100 100"`, `stroke="currentColor"`, `strokeWidth={1.2}`, no fill.

**`ANIMATE_ICON_DENYLIST`** — exported from `plateMarks.tsx`, enforced by `scripts/check-manhaj.mjs` against every `lucide-react` import across `src/`:

```
Bird, Cat, Dog, Fish, FishSymbol, Bug, BugOff, Rabbit, Squirrel, Snail, Turtle,
Worm, Rat, Shell, PawPrint, Feather, Egg, EggFried, Origami, Panda, Squirrel,
User, Users, UserCircle, UserRound, UsersRound, Contact, ContactRound, Baby,
PersonStanding, Accessibility, Footprints, Hand, HandMetal, Grab, Pointer,
Eye, EyeOff, Ear, EarOff, Brain, Bone, Skull, Ghost, Angry, Annoyed, Frown,
Laugh, Meh, Smile, SmilePlus, Speech, Venus, Mars, Baby, Drama, VenetianMask
```

Icons in use today (`BookOpen`, `FolderPlus`, `Clock`, `BellOff`, `AlertTriangle`, `SearchX`, `PlayCircle`, `Youtube`, `RefreshCw`, `Wifi`, `WifiOff`, `HardDriveIcon`, `Database`, `Image`, `Download`) are all objects or abstractions and all pass.

---

## 3. `<EmptyState>`

**Contract.** Plate + headline + exactly one line of direction + exactly one action. The headline names what belongs here. The direction line is an *instruction*, never a shrug ("Nothing here"), never an apology ("Sorry, we couldn't…"), never a diagnosis. The action is a verb that does the thing.

Copy never arrives as a prop. It arrives from `EMPTY_REGISTRY`, so no call site can ship a bare `<p>` — which is how five of the current fourteen empty surfaces went wrong.

```ts
export type EmptyVariant =
  | 'dashContinue' | 'dashRecent' | 'dashReminders'
  | 'quranReader' | 'quranSurahFilter' | 'quranReciterFilter'
  | 'libraryNoPlaylists' | 'libraryFilterNoMatch' | 'librarySearchNoResults'
  | 'libraryPlaylistNoVideos' | 'libraryVideoFilterNoMatch'
  | 'watchIdle' | 'watchNoResults'
  | 'radioCatalogueEmpty' | 'radioFilterNoMatch'
  | 'remindersNone'
  | 'downloadsNone' | 'downloadsNoHistory'
  | 'settingsNoFolders' | 'settingsDiagnosticsNotRun'
  | 'playerQueueEmpty' | 'playerNoVideo';

export interface StateAction {
  id: string;
  labelKey: TranslationKey;
  icon?: LucideIcon;
  run: () => void | Promise<void>;
  emphasis?: 'primary' | 'secondary' | 'quiet';   // default 'primary'
  confirmKey?: TranslationKey;
  disabled?: boolean;
}

export interface EmptyStateProps {
  variant: EmptyVariant;
  /** Values for {query} / {count} placeholders in the registry copy. */
  vars?: TVars;
  /** The registry names the action; the call site supplies the wiring. */
  action?: StateAction | null;
  secondaryAction?: StateAction | null;
  /** route = full-height centred (min-h 19rem, py-16); section = py-16 inside a
   *  panel; inline = py-10, no plate frame, sm plate. */
  density?: 'route' | 'section' | 'inline';       // default 'section'
  /** Extra slot below the action — used ONLY by watchIdle for SearchSuggestions. */
  children?: React.ReactNode;
  /** Required when action === null. Names the visible control that makes an
   *  action redundant. Emitted as data-no-action-reason and asserted by the harness. */
  noActionReason?: string;
  className?: string;
}

export interface EmptyEntry {
  mark: PlateMarkId;
  icon?: LucideIcon;
  tone?: PlateTone;              // default 'accent'
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  actionLabelKey: TranslationKey | null;
}
export const EMPTY_REGISTRY: Record<EmptyVariant, EmptyEntry>;
```

Rendered markup carries `data-state-block="empty" data-variant={variant}` on the root so the harness can find and count them.

### 3.1 Per-route empty states — all 8 routes, with exact copy

`en` / `ar` are the literal dictionary values. New keys use the flat camelCase convention already in `src/i18n.ts`.

#### `/` Dashboard

| Variant | Plate | Copy | Action → wiring |
|---|---|---|---|
| **`dashContinue`**<br>replaces `ContinueWatching.tsx:103-114` | `rosette12` + `PlayCircle` | **`emptyContinueTitle`**<br>en `Nothing in progress yet`<br>ar `لا يوجد شيء قيد المتابعة بعد`<br>**`emptyContinueBody`**<br>en `Open a lesson from your library and it waits for you here at the exact second you stopped.`<br>ar `افتح درسًا من مكتبتك وسينتظرك هنا عند الثانية التي توقفت عندها بالضبط.` | `openLibrary` → `navigate('/library')`<br>**`emptyContinueAction`** en `Open library` / ar `افتح المكتبة` |
| **`dashRecent`**<br>replaces `RecentlyAdded.tsx:112-122` (currently **no action**) | `khatam8` + `FolderPlus` | **`emptyRecentTitle`** en `Newly imported lessons appear here` / ar `تظهر هنا الدروس المستوردة حديثًا`<br>**`emptyRecentBody`** en `Import a folder of videos and the newest additions are listed here first.` / ar `استورد مجلد مقاطع وستُدرج أحدث الإضافات هنا أولًا.` | `importFolder` → `RECOVERY_ACTIONS.importFolder`<br>reuses existing key `importFolder` |
| **`dashReminders`**<br>replaces `Dashboard.tsx:305-316` (currently tells the user in prose to navigate) | `mistara` + `BellOff` | **`emptyTodayRemindersTitle`** en `No reminders for today` / ar `لا توجد تذكيرات لليوم`<br>**`emptyTodayRemindersBody`** en `Set a time for a lesson and it is listed here on the day it is due.` / ar `حدّد وقتًا لدرس وسيُدرَج هنا في يوم موعده.` | `createReminder` → `navigate('/reminders')` + `openCreateModal`<br>existing key `createReminder` |

#### `/quran`

| Variant | Plate | Copy | Action |
|---|---|---|---|
| **`quranReader`**<br>replaces `ReaderPlaceholder` `Quran.tsx:307-325` (one string, no action) | `jadwalEmpty`, `frame="jadwal"`, no icon | **`emptyQuranReaderTitle`** en `Choose a surah to begin` / ar `اختر سورة للبدء`<br>**`emptyQuranReaderBody`** en `Pick a surah from the index and it opens at the ayah you last read.` / ar `اختر سورة من الفهرس وتُفتح عند الآية التي وقفت عندها.` | `openSurah(1)` → `void openSurah(1)`<br>**`emptyQuranReaderAction`** en `Open Al-Fatihah` / ar `افتح الفاتحة` |
| **`quranSurahFilter`**<br>**NEW — `Quran.tsx:279` has no branch, the scroller just goes blank** | `hexLattice` + `SearchX`, `density="inline"`, `tone="quiet"` | **`emptySurahFilterTitle`** en `No surah matches "{query}"` / ar `لا توجد سورة تطابق «{query}»`<br>**`emptySurahFilterBody`** en `Try part of the Arabic name, the transliteration, or the surah number.` / ar `جرّب جزءًا من الاسم العربي أو نقحرته أو رقم السورة.` | `clearSearch` → `setSurahQuery('')`<br>**`clearSearch`** en `Clear search` / ar `مسح البحث` |
| **`quranReciterFilter`**<br>**NEW — `Quran.tsx:1425` has no branch** | `hexLattice` + `SearchX`, `density="inline"`, `tone="quiet"` | **`emptyReciterFilterTitle`** en `No reciter matches "{query}"` / ar `لا يوجد قارئ يطابق «{query}»`<br>**`emptyReciterFilterBody`** en `Try part of the reciter's name, or clear the search to see all reciters.` / ar `جرّب جزءًا من اسم القارئ أو امسح البحث لعرض جميع القرّاء.` | `clearSearch` → `setReciterQuery('')` |

`Quran.tsx:1538-1554` (ListenTab, `recitersError ?? t('quranNoReciters')`) is **not** an empty state. It conflates a network failure with emptiness. It becomes `<ErrorState variant="networkOffline" vars={{ scope: 'reciters' }} />` — see §4.

**Reading-pane guard.** `quranReader` renders inside `.quran-reading-surface`'s section. It must not introduce a border, must not become a scroll container, and must not set `overflow` — `positionWordCue` measures the cue against that element's padding box while word coordinates come from the border box. The plate is a child `<span>`, not a wrapper; the existing `ReaderPlaceholder` shape at `Quran.tsx:326-333` is already correct in this respect and `<Plate>` reproduces it exactly.

#### `/library`

| Variant | Plate | Copy | Action |
|---|---|---|---|
| **`libraryNoPlaylists`**<br>replaces `LibraryEmptyState` `PlaylistGrid.tsx:122-140` — the best state in the app; port, don't redesign | `khatam8`, `size="lg"`, `frame="jadwal"` (the 112×176 plate) | existing keys `noVideosYet` / `importFolderHint`, kept verbatim | existing `importFolder` → `handleImportFolder` (`Library.tsx:161`) |
| **`libraryFilterNoMatch`**<br>replaces `Library.tsx:610-627` | `hexLattice` + `SearchX`, `tone="quiet"` | **`emptyPlaylistFilterTitle`** en `No playlist matches these filters` / ar `لا تطابق أي قائمة هذه المرشّحات`<br>**`emptyPlaylistFilterBody`** en `Try another category, or clear the filters to see all {count} playlists.` / ar `جرّب تصنيفًا آخر، أو امسح المرشّحات لعرض جميع القوائم ({count}).` | `clearFilters` → existing handler<br>**`clearFilters`** en `Clear filters` / ar `مسح المرشّحات` |
| **`librarySearchNoResults`**<br>replaces `SearchResults.tsx:29-36` (**no action** today) | `hexLattice` + `SearchX`, `tone="quiet"` | **`emptyLibrarySearchTitle`** en `Nothing found for "{query}"` / ar `لا توجد نتائج لـ«{query}»`<br>**`emptyLibrarySearchBody`** en `Search covers titles, speakers and folder names. Try a shorter word.` / ar `يشمل البحث العناوين وأسماء المشايخ وأسماء المجلدات. جرّب كلمة أقصر.` | `clearSearch` |
| **`libraryPlaylistNoVideos`**<br>replaces the bare `<p>` at `PlaylistDetail.tsx:288-292` | `mistara`, `density="section"` | **`emptyPlaylistVideosTitle`** en `This playlist has no videos` / ar `لا توجد فيديوهات في قائمة التشغيل هذه`<br>**`emptyPlaylistVideosBody`** en `The folder was empty when it was last scanned. Rescan it if you have added files since.` / ar `كان المجلد فارغًا عند آخر فحص. أعد الفحص إن أضفت ملفات بعد ذلك.` | `rescanPlaylist` → `invoke('rescan_playlist', { id })` (already wired at `Library.tsx:230`)<br>existing key `rescanPlaylist` |
| **`libraryVideoFilterNoMatch`**<br>replaces the bare `<p>` at `PlaylistDetail.tsx:293-298` | `hexLattice` + `SearchX`, `density="inline"`, `tone="quiet"` | **`emptyVideoFilterTitle`** en `No video matches "{query}"` / ar `لا يوجد فيديو يطابق «{query}»`<br>**`emptyVideoFilterBody`** en `Try a different word, or clear the search to see all {count} videos.` / ar `جرّب كلمة أخرى، أو امسح البحث لعرض جميع الفيديوهات ({count}).` | `clearSearch` |

#### `/watch`

| Variant | Plate | Copy | Action |
|---|---|---|---|
| **`watchIdle`**<br>replaces `WatchPlaceholder` `Watch.tsx:206-241` — port intact, including the six wired category chips and the ad-free note | `khatam8` + `Youtube` | existing `watchEmptyTitle` / `watchEmptyHint` | `focusSearch`; `children` = `<SearchSuggestions>` (unchanged); the ad-free note moves to `secondaryAction === null` + a caption slot |
| **`watchNoResults`**<br>replaces `Watch.tsx:150` — today title-only, no hint, no suggestions, no action | `hexLattice` + `SearchX`, `tone="quiet"` | **`emptyWatchResultsTitle`** en `No videos matched "{query}"` / ar `لا توجد مقاطع تطابق «{query}»`<br>**`emptyWatchResultsBody`** en `Try the scholar's name on its own, a shorter phrase — or paste a video link.` / ar `جرّب اسم الشيخ وحده أو عبارة أقصر، أو الصق رابط فيديو.` | `clearSearch`; `children` = `<SearchSuggestions>` |

The existing string `watchNoResults` (`i18n.ts:28` / `:553`) is retired — it is a sentence doing the job of a title and a body at once.

#### `/radio`

| Variant | Plate | Copy | Action |
|---|---|---|---|
| **`radioFilterNoMatch`**<br>replaces the bare `<p>` at `Radio.tsx:212` | `hexLattice` + `SearchX`, `density="inline"`, `tone="quiet"` | **`emptyRadioFilterTitle`** en `No station matches "{query}"` / ar `لا توجد محطة تطابق «{query}»`<br>**`emptyRadioFilterBody`** en `Try part of the station name, or clear the search.` / ar `جرّب جزءًا من اسم المحطة أو امسح البحث.` | `clearSearch` → `setQuery('')` |
| **`radioCatalogueEmpty`**<br>**NEW** — `get_radio_stations` can return `stations: []` with no error at all | `rosette12` + `RadioTower` | **`emptyRadioCatalogueTitle`** en `No stations available` / ar `لا توجد محطات متاحة`<br>**`emptyRadioCatalogueBody`** en `The station list came back empty. Reload it, or check your connection.` / ar `عادت قائمة المحطات فارغة. أعد تحميلها أو تحقق من اتصالك.` | `reloadRadioCatalogue` → `invoke('get_radio_stations', { language })` via `loadStations` |

#### `/reminders`

| Variant | Plate | Copy | Action |
|---|---|---|---|
| **`remindersNone`**<br>replaces `Reminders.tsx:203-219` — copy already good, plate is a naked `Clock` (the fourth idiom) | `rosette12` + `Clock` | existing `noRemindersYet` / `noRemindersDescription` | existing `createReminder` → `handleCreate` |

#### `/downloads` — **no empty state exists today**

| Variant | Plate | Copy | Action |
|---|---|---|---|
| **`downloadsNone`**<br>**NEW**, main column | `khatam8` + `Download` | **`emptyDownloadsTitle`** en `Nothing downloaded yet` / ar `لم يُنزَّل شيء بعد`<br>**`emptyDownloadsBody`** en `Paste a lecture link above and it is saved into your library when it finishes.` / ar `الصق رابط محاضرة في الأعلى وسيُحفظ في مكتبتك عند اكتمال التنزيل.` | `openWatch` → `navigate('/watch')`<br>**`emptyDownloadsAction`** en `Find a lecture` / ar `ابحث عن محاضرة` |
| **`downloadsNoHistory`**<br>**NEW**, replaces the status string at `Downloads.tsx:74-79` | `mistara`, `density="inline"`, `tone="quiet"` | **`emptyDownloadHistoryTitle`** en `No downloads this session` / ar `لا توجد تنزيلات في هذه الجلسة`<br>**`emptyDownloadHistoryBody`** en `Finished downloads are listed here with their file location.` / ar `تُدرَج التنزيلات المكتملة هنا مع مواقع ملفاتها.` | `action={null}`, `noActionReason="downloads.urlField"` |

#### `/settings`

| Variant | Plate | Copy | Action |
|---|---|---|---|
| **`settingsNoFolders`**<br>replaces the bare `<p>` at `Settings.tsx:511` | `khatam8` + `FolderPlus`, `density="inline"` | **`emptyImportedFoldersTitle`** en `No folders imported` / ar `لم يُستورد أي مجلد`<br>**`emptyImportedFoldersBody`** en `Point the app at a folder of videos; everything inside it is scanned and kept in sync.` / ar `وجّه التطبيق إلى مجلد مقاطع؛ يُفحص كل ما بداخله ويبقى متزامنًا.` | `importFolder` |
| **`settingsDiagnosticsNotRun`**<br>**NEW — `Settings.tsx:689` has no branch; the section renders as a lone button** | `mistara`, `density="inline"`, `tone="quiet"` | **`emptyDiagnosticsTitle`** en `Diagnostics have not been run` / ar `لم يُشغَّل التشخيص بعد`<br>**`emptyDiagnosticsBody`** en `One pass reports the app version, ffmpeg, database size and connectivity.` / ar `تُبلغ تمريرة واحدة عن إصدار التطبيق وffmpeg وحجم قاعدة البيانات والاتصال.` | `runDiagnostics` → `invoke('get_diagnostics')` |

#### `/player` (not one of the eight, but it carries the dead accent)

| Variant | Plate | Copy | Action |
|---|---|---|---|
| **`playerNoVideo`**<br>replaces `PlayerPage.tsx:76-104` (`text-primary-blue/55`) | `khatam8` + `PlayCircle`, `tone="accent"` | existing `selectVideoToPlay` as body; **`emptyPlayerTitle`** en `Nothing loaded` / ar `لم يُحمَّل شيء` | `openLibrary` |
| **`playerQueueEmpty`**<br>replaces `QueuePanel.tsx:143-153` | `mistara`, `density="inline"`, `tone="quiet"` | **`emptyQueueTitle`** en `The queue is empty` / ar `قائمة التشغيل فارغة`<br>**`emptyQueueBody`** en `Open a playlist and the remaining lessons queue up here in order.` / ar `افتح قائمة تشغيل وستُصفّ الدروس المتبقية هنا بالترتيب.` | `openLibrary` |

**Tally after this lands:** 22 empty surfaces, 20 with a wired action, 2 with a declared `noActionReason`. Zero bare strings, zero unbranched lists, one plate idiom.

---

## 4. `<ErrorState>` — all seven named conditions

**Contract.** Three parts, in this order: **what broke** (title), **why** (cause, in plain language, naming what still works), **what to do** (a wired button that invokes a real command). The raw backend string is never the title and never the cause — it is `detail`, rendered in a collapsed `<bdi dir="auto">` under a "Details" disclosure.

```ts
export type ErrorVariant =
  | 'folderMissing'
  | 'radioOffline'
  | 'ffmpegMissing'
  | 'thumbnailsFailed'
  | 'databaseRepair'
  | 'networkOffline'
  | 'updateCheckFailed';

export interface ErrorStateProps {
  variant: ErrorVariant;
  /** block = replaces the content region (plate md, centred).
   *  strip = a border-s-2 bar above content that still works (no plate, icon only). */
  density?: 'block' | 'strip';                 // default 'block'
  /** Selects the sub-case key set AND fills {path}/{count}/{version}/{detail}. */
  vars?: TVars;
  /** Raw backend message. Rendered collapsed, never as the cause. */
  detail?: string | null;
  /** Overrides ERROR_REGISTRY[variant].actions. Order is render order. */
  actions?: RecoveryActionId[];
  onResult?: (result: RecoveryResult) => void;
  /** strip only. Omit to make the strip non-dismissible. */
  onDismiss?: () => void;
  className?: string;
}

export interface ErrorEntry {
  mark: PlateMarkId;                 // always 'girihBreak'
  icon: LucideIcon;
  tone: Extract<PlateTone, 'warning' | 'danger'>;
  /** Sub-cases keyed by vars.scope; 'default' is required. */
  scopes: Record<string, { titleKey: TranslationKey; causeKey: TranslationKey }>;
  actions: RecoveryActionId[];
}
export const ERROR_REGISTRY: Record<ErrorVariant, ErrorEntry>;
```

Root carries `data-state-block="error" data-variant data-scope data-tone`.

### 4.1 The recovery registry

This is the mechanism that makes the four recovery functions reachable outside `/settings`. Today all four sit in one `ActionBar` of `.quiet-action` text buttons at `Settings.tsx:535-539` and `:721-727`.

```ts
// src/components/state/recoveryActions.ts
export type RecoveryActionId =
  | 'rescanAll' | 'repairDatabase' | 'removeOrphanedEntries' | 'runDiagnostics'
  | 'installFfmpeg' | 'setFfmpegPath' | 'regenerateThumbnails' | 'clearThumbnailCache'
  | 'retryRadioStream' | 'reloadRadioCatalogue'
  | 'checkForUpdates' | 'exportBackup' | 'openAppDataFolder'
  | 'importFolder' | 'importVideo' | 'removeImportedFolder' | 'openFolderLocation';

export interface RecoveryContext {
  t: (key: TranslationKey, vars?: TVars) => string;
  language: AppLanguage;
  navigate: NavigateFunction;
  /** Set for folderMissing / openFolderLocation / removeImportedFolder. */
  folderPath?: string;
}

export interface RecoveryResult {
  ok: boolean;
  message: string;                       // already localised, already isolated
  tone: 'success' | 'error' | 'warning';
}

export interface RecoveryAction {
  id: RecoveryActionId;
  labelKey: TranslationKey;
  icon: LucideIcon;
  emphasis: 'primary' | 'secondary' | 'quiet';
  /** confirm() gate. Mirrors Settings.tsx:198 and :211. */
  confirmKey?: TranslationKey;
  destructive?: boolean;
  run: (ctx: RecoveryContext) => Promise<RecoveryResult>;
}

export const RECOVERY_ACTIONS: Record<RecoveryActionId, RecoveryAction>;
```

Exact command per action:

| id | Tauri command / call | Confirm | Post-step |
|---|---|---|---|
| `rescanAll` | `invoke('rescan_all')` | — | `useAppStore.refreshPlaylists()`; `healthStore.checkFolders()` |
| `repairDatabase` | `invoke('repair_database')` | `repairDatabaseConfirm` | `healthStore.checkDatabase()` |
| `removeOrphanedEntries` | `invoke<number>('remove_orphaned_entries')` | `removeOrphansConfirm` | `refreshPlaylists()`; `healthStore.checkDatabase()`; message = `errOrphansRemoved` with `{count}` |
| `runDiagnostics` | `invoke<DiagnosticsReport>('get_diagnostics')` | — | writes `internetOk` / `updateEndpointOk` / `ffmpegStatus` into `healthStore` — this is the authoritative network probe |
| `installFfmpeg` | `invoke('install_ffmpeg_helper')` | — | `settingsStore.detectFfmpeg()` |
| `setFfmpegPath` | `pickVideoFile`-style `open()` then `invoke('set_ffmpeg_path', { path })` | — | `detectFfmpeg()` |
| `regenerateThumbnails` | `invoke<ThumbnailBatchResult>('regenerate_missing_thumbnails')` | — | `refreshPlaylists()`; message = generated/skipped/failed |
| `clearThumbnailCache` | `invoke('clear_thumbnail_cache')` | `clearThumbnailCacheConfirm` | `refreshPlaylists()` |
| `retryRadioStream` | `useRadioStore.getState().retry()` | — | — (the store comment at `radioStore.ts:150-159` explains why re-setting identity is what reloads the failed element; do not replace it) |
| `reloadRadioCatalogue` | `invoke<RadioCatalog>('get_radio_stations', { language })` via `radioStore.loadStations` | — | — |
| `checkForUpdates` | `useUpdateStore.getState().checkForUpdates({ manual: true })` | — | — |
| `exportBackup` | `settingsStore.exportBackup()` → `invoke('export_backup')` | — | message = the returned path, `lri()`-wrapped |
| `openAppDataFolder` | `invoke('open_app_data_folder')` | — | — |
| `importFolder` | `pickFolder(t('dialogSelectFolder'))` → `useAppStore.importFolder(path, includeSubfolders)` | — | `refreshPlaylists()` |
| `importVideo` | `pickVideoFile(t('dialogSelectVideo'))` → `importSingleVideo(path)` | — | `refreshPlaylists()` |
| `removeImportedFolder` | `settingsStore.removeImportedFolder(ctx.folderPath!)` → `invoke('remove_imported_folder')` | `removeFolderConfirm` | `refreshPlaylists()`; `healthStore.checkFolders()` |
| `openFolderLocation` | `invoke('open_file_location', { filePath: ctx.folderPath })` | — | Windows-only path; compiles in CI only |

`<RecoveryButton>` renders one entry: `.btn-primary` for `primary`, `.btn-secondary` for `secondary`, `.quiet-action` for `quiet`, `.quiet-action .quiet-action-danger` when `destructive`. It owns its own busy state and sets `aria-busy`, rendering `<InlineSpinner>` *inside the button* — the one place a spinner is permitted.

### 4.2 The seven variants

---

**E1 · `folderMissing` — imported folder missing / drive disconnected**
*Detection today: none. A whole disconnected drive is silent until you click a video (`VideoPlayer.tsx:294`).*

- **Detection (new):** `healthStore.checkFolders()` — for each `settings.importedFolders` entry, `invoke<boolean>('check_file_exists', { filePath: folder })`. `check_file_exists` uses `Path::exists()`, which is true for directories, so **no Rust change is needed**. Runs on: app mount, `window` `focus`, and the `import_finished` event (add to `useAppEvents.ts:60`).
- **tone** `danger` · **icon** `HardDrive` · **mark** `girihBreak`

| | en | ar |
|---|---|---|
| **`errFolderMissingTitle`** | `A folder in your library is not reachable` | `أحد مجلدات مكتبتك غير متاح` |
| **`errFolderMissingCause`** | `{path} did not respond. The drive may be disconnected, or the folder was moved or renamed. Its videos are still listed but will not play until it is back.` | `تعذّر الوصول إلى {path}. قد يكون القرص مفصولًا أو أن المجلد نُقل أو أُعيدت تسميته. فيديوهاته ما زالت مدرجة لكنها لن تعمل حتى يعود.` |

- **actions:** `['rescanAll', 'removeOrphanedEntries', 'removeImportedFolder']` — primary / secondary / quiet-destructive
- **must become reachable from:**
  - `/library` — `density="block"` above the grid, replacing the inline strip at `Library.tsx:521-536`
  - `/` Dashboard — `density="strip"` at the top of the page container
  - `/settings` — per-row, in the imported-folder list at `Settings.tsx:514-532`: an unreachable folder gets `tone="danger"` on the row plus a `removeImportedFolder` / `openFolderLocation` pair

---

**E2 · `radioOffline` — radio stream offline or timed out**
*The only fully wired pair in the app today (`Radio.tsx:181-196`, `radioStore.ts:150-161`, `RadioMiniPlayer.tsx:211-219`). Port it; do not rebuild it.*

- **Detection (exists):** `radioStore.playbackError` for the stream; `Radio.tsx` `loadError` for the catalogue. **New third sub-case:** `get_radio_stations` deliberately serves the last cached catalogue when the network fails and returns `from_cache: true` (`src-tauri/src/commands/radio.rs`). That case currently renders as a silent success. Surface it.
- **tone** `warning` · **icon** `RadioTower` · three scopes

| scope | | en | ar |
|---|---|---|---|
| `stream` | **`errRadioStreamTitle`** | `This station is not responding` | `هذه المحطة لا تستجيب` |
| | **`errRadioStreamCause`** | `The stream did not start. The station may be down, or the connection dropped. Other stations may still work.` | `لم يبدأ البث. قد تكون المحطة متوقفة أو انقطع الاتصال. قد تعمل محطات أخرى.` |
| `catalogue` | **`errRadioCatalogueTitle`** | `The station list could not be loaded` | `تعذّر تحميل قائمة المحطات` |
| | **`errRadioCatalogueCause`** | `The catalogue is fetched over the network. Your library, the mushaf and your reminders are unaffected.` | `تُجلب قائمة المحطات عبر الشبكة. أما مكتبتك والمصحف والتذكيرات فلا تتأثر.` |
| `catalogueStale` | **`errRadioStaleTitle`** | `Showing the saved station list` | `يتم عرض قائمة المحطات المحفوظة` |
| | **`errRadioStaleCause`** | `The list could not be refreshed, so the last saved copy is being shown. Some stations may have changed.` | `تعذّر تحديث القائمة، لذا تُعرض آخر نسخة محفوظة. قد تكون بعض المحطات تغيّرت.` |

- **actions:** `stream` → `['retryRadioStream', 'reloadRadioCatalogue']`; `catalogue` → `['reloadRadioCatalogue', 'runDiagnostics']`; `catalogueStale` → `['reloadRadioCatalogue']`
- **must become reachable from:** `/radio` (`block`, replaces `Radio.tsx:181-196`); `/radio` (`strip`, `scope="catalogueStale"`, above the search field); `RadioMiniPlayer.tsx:211-219` (`strip`, `scope="stream"` — keep the existing `RefreshCw` play-button behaviour at `:150`/`:191`, which is a second, correct affordance)

---

**E3 · `ffmpegMissing` — ffmpeg not found**
*Today: visible only inside `/settings` (`:391-398`, `:557-559`, `:596-598`, `:697-701`). On `/library` thumbnails silently fail; on `/downloads` merging fails.*

- **Detection (exists, but not loaded app-wide):** `settingsStore.ffmpegStatus?.status === 'missing'`. Requires §1.4.
- **tone** `warning` · **icon** `Wrench` · **mark** `girihBreak`

| | en | ar |
|---|---|---|
| **`errFfmpegMissingTitle`** | `ffmpeg is not installed` | `ffmpeg غير مثبَّت` |
| **`errFfmpegMissingCause`** | `Thumbnails, video details and merging of downloaded files all need ffmpeg. Playing videos you have already imported is not affected.` | `تحتاج الصور المصغّرة وتفاصيل الفيديو ودمج الملفات المنزَّلة إلى ffmpeg. أما تشغيل الفيديوهات التي استوردتها فلا يتأثر.` |

The Latin token `ffmpeg` inside the Arabic string is **not** hand-wrapped — the whole string is RLI-isolated and rendered in `<bdi dir="auto">`, and bidi places it correctly. Wrapping it in LRI as well produces a double isolate and a stray space.

- **actions:** `['installFfmpeg', 'setFfmpegPath']`
- **must become reachable from:** `/settings` (`block`, replacing the scattered badge + help line + conditional button); `/library` (`strip`, shown when `ffmpegStatus === 'missing'` **and** any playlist has `thumbnailStatus !== 'ready'`); `/downloads` (`strip`, above the URL field, because a merge will fail); `/` Dashboard (`strip`, only if the thumbnail completion figure at `Dashboard.tsx:57-58` is below 100%)

---

**E4 · `thumbnailsFailed` — thumbnail generation failed**
*Today: one bare word in a metadata line (`PlaylistDetail.tsx:359`) plus two aggregate captions. No error block, no cause, no action at the point of failure.*

- **Detection (exists):** `useAppStore.thumbnailFailedCount > 0`, maintained by the `thumbnail_batch_finished` listener at `useAppEvents.ts:73-76`.
- **Precedence:** if `ffmpegStatus === 'missing'`, render **E3 instead**. Never show "regenerate" as the fix when the tool is absent.
- **tone** `warning` · **icon** `ImageOff`

| | en | ar |
|---|---|---|
| **`errThumbsFailedTitle`** | `{count} thumbnails could not be generated` | `تعذّر إنشاء {count} صورة مصغّرة` |
| **`errThumbsFailedCause`** | `ffmpeg could not read those files. They usually still play — only the still image is missing.` | `لم يتمكن ffmpeg من قراءة تلك الملفات. غالبًا ما تعمل عند التشغيل، والصورة الثابتة وحدها هي المفقودة.` |

- **actions:** `['regenerateThumbnails', 'clearThumbnailCache']`
- **must become reachable from:** `/library` (`strip`, above the grid); `/settings` (`block`, replacing the counter line at `:602-609`); `PlaylistDetail` (`strip`, scoped to the open playlist, replacing the bare word at `:359`)

---

**E5 · `databaseRepair` — database needs repair / orphaned entries**
*Today: nothing detects it, nothing announces it. The nearest signal is `Reminders.tsx:132-135` `brokenReminders`, which renders a warning at `:239-248` with **no action attached** — even though `remove_orphaned_entries` is precisely the fix.*

- **Detection (new):** `healthStore.checkDatabase()` runs both probes on app mount and after `import_finished`:
  - `invoke<number>('count_orphaned_entries')` → `scope: 'orphans'`, `vars.count`
  - `invoke<string>('repair_database')` — this is a read-only `PRAGMA integrity_check` (`settings.rs:250-262`); a rejected promise means corruption → `scope: 'integrity'`, `detail` = the SQLite message
  - `integrity` outranks `orphans` when both fire.
- **tone** `orphans` → `warning`; `integrity` → `danger` · **icon** `Database`

| scope | | en | ar |
|---|---|---|---|
| `orphans` | **`errOrphansTitle`** | `{count} entries point at files that are gone` | `{count} مدخلًا تشير إلى ملفات غير موجودة` |
| | **`errOrphansCause`** | `Videos were deleted or moved outside the app, so the library still lists them. Removing the entries does not delete anything on disk.` | `حُذفت فيديوهات أو نُقلت خارج التطبيق، فبقيت مدرجة في المكتبة. إزالة المدخلات لا تحذف أي ملف من القرص.` |
| `integrity` | **`errIntegrityTitle`** | `The library database failed its integrity check` | `فشل فحص سلامة قاعدة بيانات المكتبة` |
| | **`errIntegrityCause`** | `Export a backup before doing anything else, then run the check again. Your video files are not affected — only the index of them.` | `صدِّر نسخة احتياطية قبل أي إجراء آخر، ثم أعد الفحص. ملفات الفيديو نفسها لا تتأثر، وإنما فهرسها فقط.` |

- **actions:** `orphans` → `['removeOrphanedEntries', 'repairDatabase', 'rescanAll']`; `integrity` → `['exportBackup', 'repairDatabase', 'openAppDataFolder']`
- **must become reachable from:** `/settings` (`block`, replacing the loose `ActionBar` at `:535-539`); `/library` (`strip`, `scope="orphans"`); `/reminders` (`strip`, `scope="orphans"`, replacing the action-less warning at `:239-248` — this is the single highest-value relocation in this section, because the user is looking straight at the symptom); `/` Dashboard (`strip`, `scope="integrity"` only — an integrity failure is worth interrupting for, an orphan count is not)

---

**E6 · `networkOffline` — no network (radio unavailable, library still works)**
*`grep` for `navigator.onLine` and `'offline'` returns **zero hits** in `src/`. `diagnostics.internetOk` exists but only after a manual button press.*

- **Detection (new), three-tier so it is never a guess:**
  1. `navigator.onLine === false` → offline, immediately, confidence `certain`.
  2. `navigator.onLine === true` but a network-dependent command rejected (`get_radio_stations`, `youtube_search`, `get_quran_reciters`, `check()` from the updater) → confidence `suspected`. WebView2 reports `onLine: true` behind a captive portal, so this tier must not claim certainty.
  3. `runDiagnostics` → `internetOk` is the authoritative answer and clears or confirms tier 2.
  Listeners: `window.addEventListener('online' | 'offline')`, registered in `useHealthMonitor`, removed on unmount.
- **tone** `warning` · **icon** `WifiOff` · scopes select which features are named

| scope | | en | ar |
|---|---|---|---|
| `default` | **`errOfflineTitle`** | `No internet connection` | `لا يوجد اتصال بالإنترنت` |
| | **`errOfflineCause`** | `Radio, Watch, downloads and the reciter list need a connection. Your imported library, the mushaf and your reminders all work offline.` | `تحتاج الإذاعة والمشاهدة والتنزيلات وقائمة القرّاء إلى اتصال. أما مكتبتك المستوردة والمصحف والتذكيرات فتعمل دون اتصال.` |
| `reciters` | **`errOfflineRecitersTitle`** | `The reciter list needs a connection` | `تحتاج قائمة القرّاء إلى اتصال` |
| | **`errOfflineRecitersCause`** | `Reading the mushaf works offline in both riwayat. Only the recitation audio is fetched over the network.` | `قراءة المصحف تعمل دون اتصال في كلتا الروايتين. الصوت وحده هو ما يُجلب عبر الشبكة.` |
| `suspected` | **`errOfflineSuspectedTitle`** | `The connection is not responding` | `الاتصال لا يستجيب` |
| | **`errOfflineSuspectedCause`** | `Windows reports a connection but the request did not complete. Run diagnostics to confirm.` | `يفيد ويندوز بوجود اتصال لكن الطلب لم يكتمل. شغّل التشخيص للتأكد.` |

- **actions:** `['runDiagnostics', 'reloadRadioCatalogue']` for `default`/`suspected`; `['runDiagnostics']` for `reciters`
- **must become reachable from:** `/radio` (`block`); `/watch` (`block`, replacing the inline strip at `Watch.tsx:96-110`); `/quran` Listen tab (`block`, `scope="reciters"`, replacing the error/empty conflation at `Quran.tsx:1538-1554` and the strip at `:100-105`); `/downloads` (`strip`, replacing `:299-301`); `/settings` update row (`strip`)
- **Copy rule specific to this variant:** every scope's cause must state what *still works*. That is the whole point of the condition and the reason it is named separately in the brief.

---

**E7 · `updateCheckFailed` — update check failed**
*Bug: `UpdateManager.tsx:36-40` renders the card only when `phase === 'error'` **and** `Boolean(update)`. A failed check with no update object renders nothing at all.*

- **Fix + detection:** change the guard to `phase === 'error'` alone; `update` is only needed for the version label.
- **tone** `warning` · **icon** `RefreshCw`

| | en | ar |
|---|---|---|
| **`errUpdateCheckTitle`** | `Update check failed` | `فشل التحقق من التحديثات` |
| **`errUpdateCheckCause`** | `The update server could not be reached. The app keeps working on the installed version, {version}.` | `تعذّر الوصول إلى خادم التحديثات. يواصل التطبيق العمل بالإصدار المثبَّت {version}.` |

- **actions:** `['checkForUpdates', 'runDiagnostics']` — `runDiagnostics` is the right secondary because `get_diagnostics` returns `updateEndpointOk` separately from `internetOk`, which distinguishes "no network" from "the release endpoint is down".
- **must become reachable from:** `UpdateManager.tsx` (`strip`, global); `/settings` (`block`, replacing the caption at `:669-676`)
- **Out of scope, explicitly:** nothing here touches the updater keys, the pubkey, `latest.json`, or the signing config. This variant reads `updateStore.phase` and calls `checkForUpdates`; that is all.

### 4.3 `healthStore`

```ts
// src/store/healthStore.ts
export type HealthConditionId = ErrorVariant;

export interface HealthCondition {
  id: HealthConditionId;
  scope: string;                    // selects the ERROR_REGISTRY key set
  vars: TVars;                      // {path} | {count} | {version}
  detail: string | null;            // raw backend message
  detectedAt: number;
  confidence: 'certain' | 'suspected';
}

interface HealthState {
  conditions: Partial<Record<HealthConditionId, HealthCondition>>;
  checking: boolean;
  lastCheckedAt: number | null;
  checkFolders: () => Promise<void>;      // check_file_exists per imported folder
  checkDatabase: () => Promise<void>;     // count_orphaned_entries + repair_database
  checkNetwork: () => Promise<void>;      // navigator.onLine, then get_diagnostics
  refreshAll: () => Promise<void>;
  note: (c: HealthCondition) => void;     // called by any command's catch block
  clear: (id: HealthConditionId) => void;
}
```

`useHealthMonitor()` is mounted once in `App.tsx`, beside `useAppEvents()`. It calls `refreshAll()` on mount, on `window` `focus` (debounced 5s), and on the `import_finished` event. It **never** polls on a timer — a background probe that runs while a lesson is playing is exactly what `useAppEvents.ts:29-32`'s `isPlayerBusy()` guard exists to prevent, and `checkFolders` on a spun-down external drive can block for seconds. Reuse that guard: skip `checkFolders` and `checkDatabase` while `isPlayerBusy()`.

---

## 5. `<LoadingState>`

**Contract.** A skeleton has the shape of the thing that is coming. A spinner is permitted in exactly two places: inside a button the user just pressed, and in the `PlayerDocked` buffering indicator. **Never a spinner in a card slot, never a spinner where a list will be, never a centred spinner in a page void.**

Six bespoke skeletons and five bare spinners ship today. All eleven migrate.

```ts
export type LoadingVariant =
  | 'heroContinue'   // ContinueWatching.tsx:322-347
  | 'gridMedia'      // PlaylistGrid.tsx:145-163
  | 'railPoster'     // Watch.tsx:400-424 rail
  | 'listCompact'    // .rule-row lists
  | 'listGrouped'    // Dashboard.tsx:290-299 schedule
  | 'statStrip'      // Dashboard.tsx:257-273 GlanceSkeleton
  | 'splitPane'      // Quran / Downloads / Dashboard two-column
  | 'readingPane'    // Quran.tsx:299-303 — NO PULSE. See below.
  | 'stationGrid'    // Radio.tsx:173-178
  | 'detailPanel'    // PlaylistDetail.tsx:268-281
  | 'diagnostics';   // Settings.tsx:353-358

export interface LoadingStateProps {
  variant: LoadingVariant;
  rows?: number;                          // default per variant
  /** Picks the skeleton fill so a bar is always one elevation step above its host. */
  on?: 'page' | 'panel' | 'card';         // default 'panel'
  /** Announced in an sr-only aria-live="polite" region. Default 'loading'. */
  label?: TranslationKey;
  className?: string;
}

export interface SkeletonProps {
  w?: string;                             // Tailwind width class, e.g. 'w-2/5'
  h?: 1 | 2 | 3 | 5 | 8;                  // maps to h-px / h-0.5 / h-[3px] / h-5 / h-8
  radius?: 'none' | 'sm' | 'full';
  /** false suppresses motion-safe:animate-pulse. Forced false on readingPane. */
  pulse?: boolean;                        // default true
  on?: 'page' | 'panel' | 'card';
}

export interface InlineSpinnerProps {
  size?: 'sm' | 'md';                     // 14px / 18px
  className?: string;
}
```

**Fill token.** Skeleton fill is split between `bg-panel-hover` (three files) and `bg-elevated-panel` (two) today. Neither is right in general — a bar must be one elevation step above whatever hosts it. Add one derived token in `:root` and one map:

```css
--skeleton-on-page:  rgb(var(--bg-panel-rgb));
--skeleton-on-panel: rgb(var(--bg-card-rgb));
--skeleton-on-card:  rgb(var(--bg-card-hover-rgb));
```

Every theme's ladder already separates these three (verified on Onyx: 14/21/30; on Pearl: 249/255/238 — Pearl's ladder was re-ordered for exactly this reason, see the comment at `index.css:165-171`), so one definition covers all ten with zero per-theme code.

**Motion.** `motion-safe:animate-pulse` only — an opacity animation, compositor-only, and `prefers-reduced-motion` is already handled by the `motion-safe:` prefix. No new keyframes, no new duration, nothing added to the four Fluent tiers.

**`readingPane` is different and must stay different.** It renders `mistara` ruled lines inside the jadwal frame with `pulse={false}`, and it renders **no glyphs of any kind** — no placeholder Arabic, no lorem, no shaped text. Two reasons, both binding: a pulsing skeleton where the mushaf is about to appear reads as animating the mushaf, and any placeholder Arabic would be unshaped, un-vetted letterforms in the one place the app must never have them. It also must not set `overflow`, must not add a `border`, and must not become a scroll container — `.quran-reading-surface` keeps `overflow: visible; border: none;` and `positionWordCue` measures against its padding box.

**Migration table:**

| Current | Replace with |
|---|---|
| `Dashboard.tsx:257-273` `GlanceSkeleton` | `<LoadingState variant="statStrip" on="page" />` |
| `Dashboard.tsx:290-299` | `<LoadingState variant="listGrouped" rows={3} />` |
| `ContinueWatching.tsx:322-347` `FeatureSkeleton` | `<LoadingState variant="heroContinue" />` |
| `RecentlyAdded.tsx:100-110` | `<LoadingState variant="listCompact" rows={4} />` |
| `PlaylistGrid.tsx:145-163` `PlaylistGridSkeleton` | `<LoadingState variant="gridMedia" rows={3} />` |
| `PlaylistDetail.tsx:268-281` | `<LoadingState variant="detailPanel" />` |
| `Reminders.tsx:194-198` (hand-rolled `border-2 animate-spin` div) | `<LoadingState variant="listCompact" rows={5} />` |
| `Quran.tsx:299-303` (`Loader2`) | `<LoadingState variant="readingPane" />` |
| `Quran.tsx:1427-1431` (`Loader2`) | `<LoadingState variant="listCompact" rows={8} on="panel" />` |
| `Settings.tsx:353-358` (`Loader2`) | `<LoadingState variant="diagnostics" />` |
| `Radio.tsx:173-178` (`Loader2` + text) | `<LoadingState variant="stationGrid" rows={10} />` |

After this, `Loader2` appears in `src/` only inside `<InlineSpinner>` and `RadioMiniPlayer`'s buffering state.

---

## 6. `<FirstRun>`

**The brief is right that this is the most important screen and that it does not exist.** On first launch the app lands on `/` with three simultaneous empty states — `ContinueWatching.tsx:103`, `RecentlyAdded.tsx:112`, `Dashboard.tsx:305` — under a hero that occupies 416px of a 764px frame. The one good first-contact screen, `LibraryEmptyState`, is on a route the new user has no reason to visit.

**Placement decision: FirstRun is `/`'s body, not a modal and not a route.** An early return inside `Dashboard.tsx`, above the hero. Reasons: no navigation is required of someone who has not yet learned the navigation; there is no overlay to dismiss and lose; the sidebar stays visible so the app's shape is still legible; and the Dashboard is where the user already is.

**Trigger:**

```ts
export function useFirstRun(): { show: boolean; dismiss: () => void } {
  // show === true when ALL of:
  //   settings !== null && !settingsLoading      (never flash before settings load)
  //   settings.importedFolders.length === 0
  //   playlists.length === 0
  //   (stats?.totalVideos ?? 0) === 0
  //   localStorage['salafi-hub.first-run-dismissed'] !== '1'
}
```

`dismiss()` writes the flag. It is also written automatically on the first successful import, so the screen never reappears after the user has done the thing. The key follows the existing `salafi-hub.*` convention (`RadioMiniPlayer.tsx:48`).

```ts
export interface FirstRunProps {
  onImportFolder: () => Promise<void>;      // RECOVERY_ACTIONS.importFolder
  onImportVideo: () => Promise<void>;       // RECOVERY_ACTIONS.importVideo
  onOpenQuran: () => void;                  // navigate('/quran')
  onOpenRadio: () => void;                  // navigate('/radio')
  /** From settingsStore.ffmpegStatus — requires §1.4. */
  ffmpegMissing?: boolean;
  onInstallFfmpeg?: () => Promise<void>;    // RECOVERY_ACTIONS.installFfmpeg
  busy?: boolean;                           // disables every action, sets aria-busy
  onDismiss: () => void;
}
```

**Layout — four bands, in this order, on the page's own ground (no card):**

1. **Plate + promise.** `<Plate mark="khatam8" size="lg" frame="jadwal" tone="accent" />`, then the title and the promise line. The Basmala mark is deliberately **not** used here: on a screen carrying three buttons it would sit adjacent to controls and function as decoration for them, which constraint 10 forbids. It stays on the Dashboard hero, where it is the subject and is complete, static and full size.
2. **The one action.** `.btn-primary` "Import a folder", with `.quiet-action` "Import a single video" beside it. Nothing competes with these two.
3. **The other door.** A `gold-thread` rule, then two `.btn-secondary` buttons — "Read the mushaf" and "Listen to Quran radio" — under the line "Or start without importing anything". This band is what makes the screen honest: two of the app's four pillars need no library at all, and hiding that behind an import gate is the current design's real failure.
4. **Setup, conditional and quiet.** The ffmpeg row when `ffmpegMissing`, then the theme swatch row and the language toggle, under "You can change these at any time in Settings." Theme and language are the two settings most likely to be wanted at first contact and today both require a trip into a 918-line route.

**Copy:**

| key | en | ar |
|---|---|---|
| `firstRunTitle` | `Point the app at your lessons` | `وجّه التطبيق إلى دروسك` |
| `firstRunBody` | `Everything stays on this computer. Choose a folder of videos and it is scanned, catalogued and kept in sync — nothing is uploaded, nothing is tracked.` | `يبقى كل شيء على هذا الجهاز. اختر مجلد مقاطع فيُفحص ويُفهرس ويبقى متزامنًا — لا شيء يُرفع ولا شيء يُتتبَّع.` |
| `firstRunImportFolder` | `Import a folder` | `استيراد مجلد` |
| `firstRunImportVideo` | `Import a single video` | `استيراد مقطع واحد` |
| `firstRunAlternative` | `Or start without importing anything` | `أو ابدأ دون استيراد أي شيء` |
| `firstRunOpenQuran` | `Read the mushaf` | `اقرأ المصحف` |
| `firstRunOpenRadio` | `Listen to Quran radio` | `استمع إلى إذاعة القرآن` |
| `firstRunFfmpegTitle` | `Thumbnails need ffmpeg` | `تحتاج الصور المصغّرة إلى ffmpeg` |
| `firstRunFfmpegBody` | `Install it now and every video you import gets a still image.` | `ثبّته الآن ليحصل كل فيديو تستورده على صورة ثابتة.` |
| `firstRunSettingsNote` | `You can change these at any time in Settings.` | `يمكنك تغيير ذلك في أي وقت من الإعدادات.` |
| `firstRunSkip` | `Skip for now` | `تخطَّ الآن` |

`firstRunSkip` is a `.quiet-action` in the last band. It must exist — a first-run screen with no exit is a wall.

**During the import,** FirstRun stays mounted with `busy`, and band 2 is replaced by `<LoadingState variant="gridMedia" rows={2} />` — the shape of the library that is arriving. On success `dismiss()` fires and the Dashboard renders normally with real content. On failure, band 2 is replaced by `<ErrorState variant="folderMissing" density="strip" />` if the path vanished, otherwise the raw message goes in `detail` under a generic import failure — FirstRun never dead-ends.

---

## 7. Verification

Visual changes are checked by rendering. Extend the existing harness rather than adding a framework.

**7.1 Fixture modes** — add to `scripts/harness/fixtures.mjs` a `--fixture` switch consumed by `stub-tauri.js`:

| mode | stub behaviour |
|---|---|
| `empty` | `get_all_playlists`/`get_all_videos` → `[]`; `get_settings.importedFolders` → `[]`; `get_playlist_stats.totalVideos` → 0 → drives FirstRun and every empty variant |
| `drive-missing` | `check_file_exists` → `false`; `count_orphaned_entries` → `37` |
| `ffmpeg-missing` | `detect_ffmpeg.status` → `'missing'` |
| `offline` | `get_radio_stations`, `youtube_search`, `get_quran_reciters` reject; `navigator.onLine` stubbed false |
| `db-corrupt` | `repair_database` rejects with a realistic SQLite string |
| `thumbs-failed` | `thumbnail_batch_finished` emits `failed_count: 12` |
| `loading` | every command returns a promise that never settles |

**7.2 `scripts/harness/shoot.mjs`** gains `--fixture`; sweep is 8 routes × 5 themes × 2 languages × 7 fixture modes at 1280×800 and 1920×1080.

**7.3 `scripts/harness/probe.mjs` assertions** (each a hard failure, not a report line):

1. **No spinner in a content slot.** `document.querySelectorAll('[data-state-block] .animate-spin')` is empty except inside `button[aria-busy="true"]`.
2. **Every empty state has an action or a declared reason.** For every `[data-state-block="empty"]`: it contains a `button`, or it carries `data-no-action-reason`.
3. **Every error state has a wired action.** For every `[data-state-block="error"]`: at least one `button[data-recovery-action]`, and its value is a key of `RECOVERY_ACTIONS`.
4. **Arabic carries no tracking.** Under `--langs ar`, `getComputedStyle(el).letterSpacing === 'normal' || '0px'` for every text node inside `[data-state-block]`.
5. **No unisolated Arabic.** Under `--langs ar`, every `[data-state-block]` text node whose content matches `/[؀-ۿ]/` sits inside an element with `dir="auto"` or `dir="rtl"`, or its `textContent` starts with `⁧`.
6. **Reading pane is static.** In fixture `loading` on `/quran`, `[data-state-block="loading"][data-variant="readingPane"]` has no descendant with a non-`none` computed `animation-name`, and contains zero characters in `؀-ۿ`.
7. **`.quran-reading-surface` is intact.** `overflow === 'visible'` and `borderStyle === 'none'` on every theme, in every fixture mode.
8. **Ten-theme sweep of the plate.** Screenshot `[data-state-block]` in all ten themes; assert the outer frame's computed `border-color` differs between at least six of them (catches a hardcoded colour sneaking in).

**7.4 `scripts/check-manhaj.mjs`** (new, add `"check:manhaj": "node scripts/check-manhaj.mjs"` to `package.json` scripts) fails on, within `src/components/state/` and `src/store/healthStore.ts`:
- any `lucide-react` import naming a member of `ANIMATE_ICON_DENYLIST` (run repo-wide, not just this directory)
- `#[0-9a-fA-F]{3,8}` outside a comment
- `rgba(` anywhere (the slash-syntax rule: `rgb(var(--x-rgb) / 0.16)`, never `rgba(var(--x-rgb), 0.16)`)
- `text-white`, `bg-black`, `border-white`
- `tracking-`
- `basmala.svg` or `noor.svg` referenced from any state block
- `⁦` appearing in any `dictionaries.ar` value (LRI on an Arabic run is the `formatDuration` bug)

**7.5 Standard gates.** `npx tsc --noEmit`; `npm run build`. `cd src-tauri && cargo test` cannot run in this container (gdk-3.0 missing) and gates in CI; the one new command `count_orphaned_entries` needs a test asserting it returns 0 on a fixture where every path exists and N when N are removed, placed beside the existing `VIDEO_COLUMNS` ordering test.

---

## 8. Summary of net change

| | before | after |
|---|---|---|
| Plate / empty-icon idioms | 4 | 1 |
| Empty surfaces with a designed state | 9 of 22 | 22 of 22 |
| Empty surfaces with a wired action | 5 | 20 (+2 declared no-action) |
| List surfaces with no empty branch at all | 4 | 0 |
| Bare-string "empty states" | 5 | 0 |
| Named error conditions that surface | 3 of 7 | 7 of 7 |
| Named error conditions with detection | 4 of 7 | 7 of 7 |
| Recovery functions reachable outside `/settings` | 0 of 4 | 4 of 4, from 9 sites |
| Skeleton implementations | 6 bespoke + 5 spinners | 1 component, 11 variants |
| Spinners outside a pressed button | 5 | 0 |
| First-run screen | none | `/` body, 4 bands, 3 exits |
| New Rust commands | — | 1 (`count_orphaned_entries`, read-only) |
| New runtime dependencies | — | 0 |


## Risks

- **`healthStore.checkFolders()` calls `check_file_exists` on every imported folder. On a spun-down external or network drive that call can block for seconds, and if it fires while a lesson is playing it competes with playback — the same hazard `useAppEvents.ts:29-32` already guards against with `isPlayerBusy()`.**
  - Mitigation: Reuse `isPlayerBusy()` verbatim: skip `checkFolders` and `checkDatabase` whenever it returns true, and re-arm on the next window `focus`. Never poll on a timer. Debounce the `focus` handler to 5s. `checkNetwork` is cheap (`navigator.onLine`) and is exempt.
- **`repair_database` is used as a *detection* probe. It runs `PRAGMA integrity_check`, which is a full-database read and takes seconds on a large library — running it on every app start would delay first paint.**
  - Mitigation: Run it once per session, deferred behind `requestIdleCallback` (or a 3s timeout), after `count_orphaned_entries` (cheap) has already reported. Cache the result in `healthStore.lastCheckedAt` and do not repeat it on `focus` — only on explicit `runDiagnostics` or after `import_finished`.
- **`--warning-rgb` is currently identical in hue to `--accent-gold-rgb` on 8 of 10 themes. Every warning-toned ErrorState would read as an ordinary accent surface, so the error hierarchy would be invisible on most themes — a bug that only appears in a theme sweep, not in the diff.**
  - Mitigation: The three-declaration token repair in §1.3 (`--warning-rgb: 217 148 44` in `:root`, plus Pearl overrides for `--warning-rgb` and `--danger-rgb`). Probe assertion 8 catches any regression by comparing computed border colours across the ten themes.
- **`navigator.onLine` in WebView2 returns `true` behind a captive portal and on a connected-but-dead adapter. A confident "You are offline" that is wrong is worse than no message, because the user goes and checks their router.**
  - Mitigation: Three-tier detection with an explicit `confidence: 'certain' | 'suspected'` field on `HealthCondition`. `suspected` uses its own, hedged copy (`errOfflineSuspectedTitle`) and its primary action is `runDiagnostics`, which resolves the ambiguity authoritatively via `get_diagnostics.internetOk`.
- **`<LoadingState variant="readingPane">` mounts inside the Quran reading section. Any wrapper it introduces that sets `overflow`, adds a `border`, or becomes a scroll container desynchronises `positionWordCue` from the spoken word — a manhaj-relevant defect that presents as a layout bug.**
  - Mitigation: The variant renders as a sibling `<span>` inside the existing section, reproducing the exact DOM shape of `ReaderPlaceholder` (`Quran.tsx:326-333`), which is already correct. Probe assertion 7 checks `overflow: visible` and `border-style: none` on `.quran-reading-surface` in every theme and every fixture mode.
- **Adding `vars` to `t()` touches `src/i18n.ts`, which every component imports. A mistake in `interpolate` corrupts every string in the app, in both languages.**
  - Mitigation: `interpolate` returns the template unchanged when `vars` is undefined — the path every one of the ~600 existing call sites takes. `{name}` placeholders exist in no current dictionary value, so the regex cannot match anything that ships today. Add a unit-free assertion in the harness: under fixture `empty`, no rendered text contains a literal `{` or `}`.
- **Extracting `MARKS` out of `PlaylistCard.tsx:59-84` into `plateMarks.tsx` changes what `tailwind.config.js` needs to see. The marks are inline JSX (not SVG files), so `./src/**/*.{js,ts,jsx,tsx}` already covers the new path — but if any mark is ever moved into `src/assets/marks/*.svg`, its fill classes are purged and it renders SVG-default black.**
  - Mitigation: Keep every plate mark as inline JSX in `src/components/state/plateMarks.tsx`, stroked in `currentColor` with the tone class on the wrapper — the pattern `PlaylistArt` already uses and documents at `PlaylistCard.tsx:44-45`. Do not add files to `src/assets/marks/`; the `content` glob for that directory exists for `basmala.svg` and `noor.svg` and is not the route for these.
- **`FirstRun` gates on `playlists.length === 0 && stats.totalVideos === 0`. `loadStats` and `loadPlaylists` resolve independently, so between them the screen can flash for one frame on a user who has a full library.**
  - Mitigation: The `show` condition also requires `settings !== null && !settingsLoading`, and `importedFolders.length === 0` is the leading term — a user with a library always has at least one imported folder, and `settings` loads before either list. Additionally gate on `!statsLoading && !playlistsLoading` so no state is computed from a half-loaded store.

## Open questions

- FirstRun band 4 puts the theme swatch row inline. The swatch list at `src/i18n.ts:1090-1110` is the one remaining place with hex literals (30 of the repo's 31). Should FirstRun render the same hex swatches — accepting that they are data, not component code — or should the picker there be reduced to named labels only, leaving the visual swatches on `/settings` where they already exist?
- `quranReader`'s action is specified as "Open Al-Fatihah" (`openSurah(1)`). This is a real, forward-moving action rather than a dead placeholder, but it is also an opinion about where a reader should start. The alternative is to resume `lastRead` when one exists and offer Al-Fatihah only on a genuinely fresh install. Which behaviour is wanted when `lastRead` exists but no surah is currently open?
- `count_orphaned_entries` walks every video row and stats every path. On a library of several thousand files across a slow drive this is not instant. Is a full count acceptable at ~3s deferred, or should it short-circuit at a threshold (e.g. stop at 50 and report "50+"), which changes the `{count}` copy in both languages?
- The Arabic for `errOrphansTitle` is written as «{count} مدخلًا تشير إلى ملفات غير موجودة», using the accusative singular (تمييز) that is correct for 11-99. For 3-10 the correct form is «{count} مدخلات» and for 1-2 it changes again. Should the dictionary carry three plural forms selected by count (adding a small plural-rule helper to `i18n.ts`), or is the single 11-99 form acceptable for a count that is nearly always large?
- `radioOffline` scope `catalogueStale` surfaces the fact that `get_radio_stations` served a cached catalogue (`from_cache: true`). That flag is currently returned but never read by the frontend. Confirm that surfacing it as a persistent strip is wanted — the alternative is to show it only once per session, since the cache TTL means a normal offline session would otherwise carry the strip on every visit to `/radio`.
- The seven ErrorState variants have no shared destination for `RecoveryResult` — `ToastStack` (block #24) is specified separately and not yet built. Until it lands, should `<RecoveryButton>` render its result inline beneath itself (self-contained, no dependency) or should these blocks be held until ToastStack ships?
