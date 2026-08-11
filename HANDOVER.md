# Salafi Video Hub — Complete Handover

Everything a new maintainer (human or AI) needs to work on this app safely.
Current version at the time of writing: **1.51.3**.

`CLAUDE.md` is the short, authoritative rulebook and is loaded automatically by
Claude Code. **This document is the long form.** Where the two disagree,
`CLAUDE.md` wins — and fix this file.

---

## 1. What the app is

An **offline Islamic study library** for the desktop. It is not a streaming
service and not a web app. Everything lives on the user's own machine.

Five things it does:

1. **Library** — point it at folders of video lessons; it scans them into a
   local database with progress, playlists, thumbnails, favourites.
2. **Mushaf (Qur'an)** — the Qur'anic text in **two riwayat** (Hafs and Warsh),
   with reciters, bookmarks, last-read position, and word-level recitation sync.
3. **Watch** — search YouTube and play through the app's own player, resolving a
   direct media stream so there are **no ads, no overlays, no recommendations**.
4. **Shuyukh** — named profiles for trusted scholars; each carries that shaykh's
   whole channel, kept current, flagging new lessons.
5. **Radio + Reminders** — Qur'an radio stations, and scheduled study reminders.

**Stack**: Tauri v2 · React 18 + TypeScript + Vite + Tailwind (frontend, `src/`)
· Rust (backend, `src-tauri/src/`) · SQLite (rusqlite) · zustand (state).

**Ships for Windows and Linux.** No macOS build.

---

## 2. The manhaj constraints — read this before touching any UI

These are **religious requirements, not style preferences**. A design that
violates one is rejected no matter how good it looks. This is the single most
important section in this document.

1. **No depiction of animate beings anywhere.** No humans, faces, animals or
   silhouettes — in any background, illustration, icon, empty state, avatar
   placeholder or loading art. Ornament must be **geometric or vegetal only**.
   - *Where this bites*: picking a "person" icon for an empty avatar; using a
     stock illustration; an AI-generated background.
   - *Note*: a YouTube channel's own profile photo is **channel content**, like a
     video thumbnail — the app displays it, it does not author it. The app's own
     fallback art must be geometric (see `ChannelAvatar` in `src/pages/Shuyukh.tsx`).
2. **Qur'anic text is never decoration.** Never behind a button, never a
   watermark, never clipped, never letter-by-letter animated, never faded in.
3. **Qur'anic text is never restyled.** No letter-spacing, no gradient fill, no
   drop shadow, no `text-transform`, no substituting a display face.
   - *Consequence*: `text-align: justify` is banned on Arabic — see §7.
4. **Mushaf text renders only through the bundled official KFGQPC face for its
   own riwayah** — Hafs v0.18 or Warsh v10. The ayah **marker** is an ornament,
   not Qur'anic text, so it may use Amiri Quran; **the ayah body may not**.
5. **Any hadith or athar must carry its source** (book + number).
6. **Arabic in graphics must be real, correctly shaped text from a real font.**
   Never AI-generated or hand-traced letterforms. `scripts/build-*.py` shape real
   fonts with HarfBuzz and emit outlines — that is the supported route.
7. **No music**, instrumental stings, or melodic feedback.
   - *This was violated once*: the default reminder sound was 880 Hz then
     1320 Hz — a rising perfect fifth, i.e. a two-note tune. It is now a
     band-limited **noise knock**: no pitch, no interval, no melody
     (`src/utils/reminderAudio.ts`).
8. **KFGQPC and font licence notices stay intact and reachable in the app.**
   (`src/assets/fonts/KFGQPC-NOTICE.txt`, `src-tauri/resources/QURAN_TEXT_NOTICE.txt`,
   `QURAN_WARSH_NOTICE.txt`.)

---

## 3. Riwayah rules (Hafs vs Warsh)

**The two readings are never mixed.** Hafs uses Kufan verse numbering, Warsh uses
Madani numbering. Text, numbering, fonts and localStorage keys are all tagged by
riwayah.

- Bookmarks and last-read are stored per riwayah:
  `salafi-hub.quran-bookmarks.v1` / `…bookmarks.warsh.v1`,
  `salafi-hub.quran-last-read.v1` / `…last-read.warsh.v1`.
- **Recitation timing data is Hafs-only.** The word-sync tracker must never point
  at a Warsh ayah. Both `syncActive` *and* the `synced` word list are gated on
  `!warshMode` in `src/pages/Quran.tsx`, and `setRiwayah` clears `syncedAudio`
  in `src/store/quranStore.ts`.
  - *This was a real bug*: playing a Hafs recitation then switching to Warsh made
    the **Hafs word text render inside Warsh ayat**, silently, under Warsh
    numbering. Fixed in 1.51.0.
- Font chains are per riwayah and must not fall through to the other face (§7).

---

## 4. Repository layout

```
src/                        React frontend
  App.tsx                   routes, <html> lang/theme/dir, player-open handling
  main.tsx                  entry
  i18n.ts                   both dictionaries + useI18n (large file)
  index.css                 ~4600 lines: themes, design system, mushaf CSS
  types/index.ts            AppTheme, AppLanguage, Video, Playlist, …
  pages/                    one file per route (see §5)
  components/
    layout/                 AppShell, Sidebar, TitleBar, ResizeGrips, AmbientLayer
    layout/scenes/          procedural ambient backgrounds (one per theme mood)
    player/                 VideoPlayer, controls, queue
    playlist/               playlist grid/detail/menu
    dashboard/              rails, charts, quick actions
    home/                   Hero, FirstRun
    radio/ reminders/ ui/ chrome/ updater/
  store/                    zustand stores (see §6)
  hooks/                    useAppEvents, useKeyboardShortcuts, useTauriCommands
  utils/                    formatTime, formatBytes, juz, pathHash,
                            reminderAudio, reminderSchedule, async, constants
  assets/fonts/             KFGQPC Hafs + Warsh (woff2 AND ttf), Amiri Quran,
                            Aref Ruqaa, IBM Plex (Arabic/Sans/Serif) + notices
  assets/marks/             SVG ornaments (jadwal bands, corners, basmala)

src-tauri/
  src/lib.rs                Tauri builder, plugins, THE COMMAND REGISTRY
  src/main.rs               thin entry
  src/commands/             one module per feature area (see §8)
  src/db/                   mod (schema+migrations), video, playlist, reminder,
                            settings, schema
  src/models/               serde structs mirroring the DB rows
  src/services/             scanner, thumbnail_gen, metadata, reminder_check
  src/utils/                paths, process, ffmpeg_finder, notifications
  resources/                quran.json, quran-warsh.json, notices, yt-dlp.exe
  tauri.conf.json           base config (version, window, CSP, updater)
  tauri.windows.conf.json   nsis/msi targets, bundled yt-dlp.exe
  tauri.linux.conf.json     appimage/deb targets, deb depends, appimage options
  capabilities/default.json Tauri permission grants

scripts/
  build-basmala-svg.py      shape real fonts with HarfBuzz -> SVG outlines
  build-jadwal-svg.py       jadwal ornament bands
  build-noor-svg.py         wordmark
  harness/                  screenshot/verification harness (see §11)

.github/workflows/
  release.yml               the release pipeline (Windows job, then Linux job)
  mirror.yml                repo mirroring
```

---

## 5. Routes and pages

Routing is **`MemoryRouter`** — there is no URL bar. Navigation happens by
clicking sidebar links. (This matters for the test harness: you cannot navigate
by URL, you must click `nav a[href="/x"]`.)

| Path | Page | What it is |
|---|---|---|
| `/` | `Dashboard.tsx` | Hero, continue-watching, recently added, rails, study charts, first-run |
| `/quran` | `Quran.tsx` | The mushaf. Largest and most rule-bound file |
| `/library` | `Library.tsx` | Imported folders as playlists, search, detail |
| `/watch` | `Watch.tsx` | YouTube search + ad-free player + history |
| `/shuyukh` | `Shuyukh.tsx` | Shaykh channel profiles |
| `/radio` | `Radio.tsx` | Qur'an radio stations |
| `/player` | `PlayerPage.tsx` | Full-screen local video player |
| `/reminders` | `Reminders.tsx` | Scheduled reminders |
| `/downloads` | `Downloads.tsx` | yt-dlp download manager |
| `/settings` | `Settings.tsx` | Settings + **Diagnostics** panel |

Sidebar groups: **Study** (Quran, Library, Watch, Shuyukh, Radio) and **Manage**
(Reminders, Downloads, Settings), with Dashboard above.

### The Quran page in detail (`src/pages/Quran.tsx`)

- Two tabs: **Read** and **Listen**.
- Two display modes: **mushaf flow** (continuous justified-look page) and
  **ayah list** (with translations; translations are Hafs-only).
- **Riwayah switch** (Hafs / Warsh) in the surah header.
- `QuranVerseWords` splits an ayah into per-word `<span>`s for recitation
  highlighting. **It splits on U+0020 only — never `\s`** (§7).
- `AyahMarker` renders the end-of-ayah medallion. **It does not let the shaper
  compose `۝`+digits** (§7). The ring is U+06DD alone; the number is a separate
  element centred by CSS at `top: 70%`.
- `toArabicDigits` maps 1 → ١ using U+0660–0669 (Arabic-Indic, *not* Persian).
- The decorative surah-opening basmala uses **U+FDFD** (a single ligature
  codepoint) with `role="img"` and an `aria-label` of the real words. Neither
  KFGQPC face contains U+FDFD, so this one element explicitly uses Amiri Quran.

---

## 6. State (zustand stores, `src/store/`)

| Store | Responsibility | Persists to |
|---|---|---|
| `settingsStore` | app settings, loaded from SQLite | DB via commands |
| `playerStore` | current video, queue, progress | DB (`save_progress`) |
| `quranStore` | surahs, riwayah, bookmarks, reciters, synced audio | localStorage (per riwayah) |
| `watchStore` | YouTube search, resolved stream, watch history | `salafi-hub.watch-history.v1` |
| `shuyukhStore` | shaykh profiles + channel catalogs | localStorage + **disk cache** |
| `radioStore` | stations, favourites, volume | localStorage |
| `remindersStore` | reminders | DB |
| `downloadStore` | download jobs/progress | in memory |
| `updateStore` | updater phase/progress | in memory |
| `appStore` | misc app-level UI state | — |

### Every localStorage key used

```
salafi-hub.background-motion            salafi-hub.quran-riwayah.v1
salafi-hub.player-collapsed             salafi-hub.quran-show-translation.v1
salafi-hub.sidebar-collapsed            salafi-hub.quran-timing-read.v1
salafi-hub.quran-bookmarks.v1           salafi-hub.quran-reciter.v1
salafi-hub.quran-bookmarks.warsh.v1     salafi-hub.quran-font-size.v1
salafi-hub.quran-last-read.v1           salafi-hub.radio-favorites.v1
salafi-hub.quran-last-read.warsh.v1     salafi-hub.radio-volume.v1
salafi-hub.shuyukh.v1                   salafi-hub.watch-history.v1
```

### Shuyukh storage model (worth understanding)

- **Profiles** (name + channel URL + cached channel identity) live in
  localStorage — they are a bookmark file, not library data.
- **Quick catalogs** (newest 90 uploads) live in memory only.
- **A fully-loaded catalog** (the entire channel, possibly 10 000+ entries) is
  cached **on disk** as one JSON file per profile under
  `<app-data>/shuyukh-catalogs/<profile-id>.json`, written tmp-then-rename.
  Rehydrated at start. Never a remote service — which shuyukh someone studies is
  nobody's data but theirs.
- A routine refresh **merges** the fresh head into a fully-loaded catalog only if
  the slice reaches the old head; otherwise it drops the "fully loaded" claim so
  the reader is told to reload rather than being shown a silent gap.

---

## 7. LOAD-BEARING INVARIANTS

Each of these was a real bug. Breaking one silently breaks something that looks
unrelated. Each is commented at its site in code; this is the index.

### Rendering / Arabic / Qur'an

1. **Never `text-align: justify` on a surface carrying Arabic.**
   WebKit (every Linux build) justifies Arabic by expanding **between letters**,
   which tears the cursive joins apart — letter-spacing on Qur'anic text by
   another name. Blink (Windows WebView2) expands only at spaces, so it looks
   perfect on Windows and broken on Linux. `text-justify: inter-word` is **not**
   a fix — WebKit ignores it. Use `text-align: start`.

2. **The ayah medallion must never depend on the shaper.**
   `۝` + digits is composed into one medallion by **HarfBuzz**, and only from a
   certain version: measured on one binary, HarfBuzz **8.3 sets the digits inside
   the ring** while HarfBuzz **2.7 leaves it empty and strands the number
   beside it**. Windows uses DirectWrite and never shows it; a current distro
   never shows it; an older Linux gets a page of empty medallions.
   `AyahMarker` therefore renders U+06DD **alone** and centres the number with
   CSS. The `top: 70%` offset is **measured**, not arbitrary — the ring glyph's
   ink sits low in its em box.

3. **One shaping run must live in one DOM text node.**
   WebKit shapes each text node independently; Blink merges adjacent ones first.
   So JSX like `۝{digits}` — ornament and number as separate children — renders
   an empty medallion on Linux and correctly on Windows. Build such strings whole.
   The same trap applies to any combining mark separated from its base.

4. **Split ayah text on U+0020 only, never `\s`.**
   Both corpora carry a second, deliberate space **inside** a word: Hafs has
   U+2009 THIN SPACE in 2:72; Warsh has **434** U+00A0 NBSPs binding ۞ to the
   word it opens. `\s` matches both. Splitting there puts bare combining marks at
   the head of their own span — which WebKit shapes as its own run, stamping a
   **dotted circle onto Qur'anic text** — besides orphaning the ornament and
   shifting every later word index.

5. **The mushaf font chain is the riwayah's KFGQPC face and nothing else.**
   CSS font fallback is **per glyph**, so any family listed after it can
   composite single letters into a Qur'anic word. The Hafs face sitting second in
   the Warsh chain mixed the two readings' letterforms inside one word. Both
   faces are `font-display: block` — with `swap` the ayah paints in a fallback
   first. Each face ships **woff2 first, TTF second** so a WebKit built without
   libwoff2 still gets the correct face rather than nothing.
   *Sole exception*: `.quran-basmala-calligraphy` names Amiri Quran explicitly
   (U+FDFD is an ornament ligature neither KFGQPC face contains), at the
   specificity of the Warsh rule.

6. **`.quran-reading-surface` must keep `overflow: visible` and `border: none`.**
   `positionWordCue` measures the cue against this element's padding box while
   the word's coordinates come from the border box. A border shifts the cue off
   the spoken word; making it a scroll container leaves the cue `scrollTop`
   pixels out. The scroller is `.quran-reading-viewport`, one level up.

7. **A CSS `mask` applies to an element's whole subtree.** The jadwal's hairline
   rules live on `.quran-reading-frame`'s pseudo-elements, not inside the masked
   `.quran-jadwal`, or they would be cut to the band's silhouette.

8. **`html[data-language='ar']` zeroes letter-spacing globally.** Tracking breaks
   the joins in a cursive script.

9. **Arabic strings wrapped for bidi need U+2067 (RLI); U+2066 (LRI) reverses
   them.** `formatDuration` once shipped `1س 0د` as `1د0 س` this way.

10. **The layout direction stays LTR in both languages** (`App.tsx` sets
    `root.dir = 'ltr'` deliberately). Switching to Arabic translates text but
    never moves sidebars or alignment; Arabic renders RTL inside each label via
    `dir="auto"` / `<bdi>`.

**The mushaf `@font-face` families are app-private names** — `SVH Mushaf Hafs`,
`SVH Mushaf Warsh`, `SVH Ornament Amiri` — never the fonts' real names. A
machine with `KFGQPC Uthmanic Script HAFS` installed system-wide otherwise wins
the name and sets the Qur'an in *its* copy of the face, silently. Proven by
installing an impostor under that name and watching the mushaf change. The
CSP's `font-src` must stay in step, or the faces never load at all.

### CSS mechanics

11. **`rgb(var(--x-rgb) / 0.16)` — slash syntax.** `rgba(var(--x-rgb), 0.16)`
    mixes space-separated channels with a comma alpha, is invalid, and silently
    drops the whole declaration.

12. **`tailwind.config.js` must keep `./src/assets/marks/*.svg` in `content`.**
    The fill classes on the inlined SVG marks appear nowhere else; without this
    they are purged and the marks render SVG-default black.

13. **`@supports not (...)` for `backdrop-filter` must test BOTH the prefixed and
    unprefixed property.** WebKit only shipped the unprefixed one in 2.46; older
    builds support `-webkit-backdrop-filter` while failing a query that names
    only the standard property, so the opaque fallback lands on top of a working
    blur and every glass surface goes flat on Linux alone.

### Data

14. **`src/db/video.rs` uses `VIDEO_COLUMNS`, never `SELECT *`** — column order
    in the file does not match the struct, and a test asserts this.

15. **`src/db/playlist.rs` uses `PLAYLIST_COLUMNS`, never `SELECT *`** — same
    reason, same kind of test. `ensure_column` **appends** on upgrade, so
    `SELECT *` yields a different index order on an upgraded install than on a
    fresh one, and one appended column breaks the Library for existing users.

16. **`get_videos_by_ids` returns rows in the CALLER's id order, never SQL's.**
    The scanner naturally-sorts `playlist.video_ids` so "الدرس 2" precedes
    "الدرس 10"; an `ORDER BY title` there became the player's queue and made
    "next lesson" play the tenth.

---

## 8. The Rust backend

`src-tauri/src/lib.rs` is the **single registry of every command**. If a command
is not listed in `invoke_handler![...]`, the frontend's `invoke()` fails at
runtime with "command not found" — this is the most common integration mistake.

Plugins enabled: dialog, fs, notification, os, shell, process, updater,
window-state (SIZE | POSITION | MAXIMIZED only — restoring DECORATIONS
re-applied the old native title bar over the custom one).

### Command modules

- **`video.rs`** — import_folder, import_single_video, get_video, get_all_videos,
  get_videos_by_ids, get_videos_by_playlist, update_video_progress /
  _favorite / _watch_later / _metadata, search_videos, delete_video_from_library.
- **`playlist.rs`** — get_all_playlists, get_playlist, update_playlist_name /
  _category, remove_playlist_from_library, delete_playlist_and_files,
  rescan_playlist, get_playlist_stats.
- **`reminder.rs`** — create/get_all/update/delete/toggle/mark_triggered,
  allow_reminder_sound_path, test_reminder_sound.
- **`downloader.rs`** — download_youtube_video, cancel_download. Wraps yt-dlp with
  progress parsing and cookie/browser-auth plans.
- **`youtube.rs`** — youtube_search, youtube_channel_catalog, youtube_resolve,
  shuyukh_catalog_cache_read / _write / _remove.
- **`quran.rs`** — get_quran_surahs, get_quran_surah, get_quran_reciters,
  get_quran_word_timing_reads, get_quran_synced_audio.
- **`radio.rs`** — get_radio_stations.
- **`settings.rs`** — get_settings, update_settings, add/remove_imported_folder,
  get_ffmpeg_status, set_ffmpeg_path, get_app_data_path,
  **updater_can_self_install**, export_backup, import_backup, rescan_all,
  repair_database, remove_orphaned_entries, play_sound, open_app_data_folder.
- **`playback.rs`** — save_progress, get_progress, get_continue_watching,
  get_recently_added.
- **`ffmpeg.rs`** — detect_ffmpeg, install_ffmpeg_helper, generate_thumbnail,
  get_video_metadata, clear_thumbnail_cache, regenerate_missing_thumbnails,
  set_thumbnail_generation_paused.
- **`file_ops.rs`** — convert_file_src, allow_video_asset_path,
  open_file_location, open_file_externally, check_file_exists.
- **`diagnostics.rs`** — get_diagnostics.

### Database

SQLite via rusqlite. Four tables: **videos**, **playlists**, **reminders**,
**settings** (single row, id `'default'`). Migrations are additive via
`ensure_column` — see invariants 14/15 for why that forces named-column SELECTs.

`videos` columns: id, title, file_path (UNIQUE), folder_path, file_name,
extension, duration_seconds, thumbnail_path, thumbnail_status, category, speaker,
description, progress_seconds, completed, favorite, watch_later, file_size,
modified_at, created_at, updated_at, last_played_at, playable_status,
last_playback_error, codec_info.

`settings` columns: id, language, theme, imported_folders (JSON), thumbnail_cache_path,
ffmpeg_path, ffprobe_path, ffmpeg_status, automatic_thumbnails_mode,
performance_mode, reminder_sound_path, reminder_volume, run_in_tray,
last_opened_playlist_id, last_played_video_id.

### External processes

- **yt-dlp** — search, channel catalog, stream resolve, downloads.
  Windows: bundled `resources/yt-dlp.exe`. Linux: **downloaded on demand**,
  chmod 0755 before first use, refreshed when stale.
- **ffmpeg / ffprobe** — thumbnails and metadata. Linux deb declares `ffmpeg`;
  AppImage self-installs on first need.
- **xdg-open / explorer** — reveal/open file, platform-switched in `file_ops.rs`.

All spawning goes through `utils/process.rs::hidden_command`, which sets
`CREATE_NO_WINDOW` on Windows so no console flashes.

---

## 9. Platform differences — the thing that will bite you

**Windows renders with WebView2 (Blink/Chromium). Linux renders with WebKitGTK.**
They are different browser engines. Almost every user-visible bug in this app's
history has come from that split.

| | Windows | Linux |
|---|---|---|
| Engine | WebView2 (Blink) | WebKitGTK |
| Text shaping | DirectWrite | HarfBuzz (**the host's version**) |
| Justify on Arabic | expands at spaces only | expands **between letters** |
| Adjacent text nodes | merged before shaping | shaped **separately** |
| `۝`+digits medallion | always composes | only on newer HarfBuzz |
| Video decoding | built in | **GStreamer plugins** |
| Undecorated window | keeps OS resize border | **no resize edges at all** |
| Self-update | always | **AppImage only** (not deb) |

Consequences already handled in the code:

- `ResizeGrips.tsx` draws eight invisible edge/corner strips calling
  `startResizeDragging`, mounted only where the platform needs them, because
  `decorations: false` on GTK removes resize edges and offers nothing back.
- The deb declares `gstreamer1.0-plugins-base/good/bad` and `gstreamer1.0-libav`;
  without them **no video plays at all** on a clean Linux install.
- The AppImage sets `bundleMediaFramework: true` because an AppImage cannot
  declare dependencies.
- The updater is gated on `updater_can_self_install` so deb users are not shown
  an update prompt whose Retry can never succeed.

### WebKitGTK 2.46+ drops the Qur'anic harakat (the big one)

**This is the outstanding Linux defect, it is not ours, and nothing in the app
can fix it.** Suspect it first whenever a Linux screenshot shows a mushaf of
bare consonants.

From WebKitGTK 2.46 — the release that moved rendering from Cairo to Skia — the
engine no longer applies HarfBuzz's GPOS mark-attachment offsets for the KFGQPC
faces. Shaping is fine: the glyph list carries every mark, and `hb-shape` on
the same file returns the right offsets under HarfBuzz 8.3 and 14.3 alike. The
marks are simply painted at the baseline instead of above their letter, where
they vanish into the letterforms. The reader is left with an incomplete
Qur'anic text — a manhaj problem, not a cosmetic one.

**How it was proven.** The *same* `.deb` binary, same fonts, same automation
script, captured twice: at 20:47 on 2026-08-01 under WebKitGTK 2.44, every
harakah present; and again under 2.52.3, all of them gone. `/var/log/dpkg.log`
records the downgrade to 2.44.0-2 at 20:44:16 and the upgrade back at 20:55:55.
One variable.

**Already ruled out — do not spend a day re-testing these.** Font fallback; the
app's CSS (it reproduces on a bare page whose only font is the `@font-face`
file); `.woff2` vs `.ttf`; Hafs vs Warsh (both fail); the `gasp` table; the
legacy `kern` table; `line-height`; `text-rendering`; `-webkit-font-smoothing`;
`text-shadow`; `-webkit-text-stroke`; layerisation (`opacity`, `will-change`,
`translateZ`, `contain`); `font-feature-settings`; `word-spacing`;
`paint-order`; font size; DOM vs SVG `<text>` vs `<canvas>` (all three fail
identically, so there is no surface to move the mushaf onto); and the env vars
`WEBKIT_FORCE_COMPLEX_TEXT`, `WEBKIT_SKIA_ENABLE_CPU_RENDERING`,
`WEBKIT_DISABLE_COMPOSITING_MODE`, `WEBKIT_DISABLE_DMABUF_RENDERER`,
`LIBGL_ALWAYS_SOFTWARE` (byte-identical output).

**Why a screenshot can look half-right.** KFGQPC precomposes some sequences
into single glyphs via GSUB — `بِسۡمِ` is one glyph (`Bism`), and most of
`ٱلرَّحۡمَٰنِ` likewise. A glyph carrying its own marks needs no GPOS offset, so
the basmala survives while `ٱلۡحَمۡدُ` beside it does not. Marks *below* the
line (kasra) also survive: their outlines already sit below the baseline.

**What the app does about it.** `checkHarakat` in `src/utils/mushafFont.ts`
detects it; the Qur'an page shows a plain-language warning
(`quranHarakatEngineBug`) and Settings → Diagnostics → "Mushaf fonts" appends
`harakat OK` / `HARAKAT NOT PLACED`. The probe measures painted pixels, because
that is the only thing that reveals it; canvas fails the same way as the DOM,
which is exactly what makes it a faithful witness.

**If you want to actually fix it**, the only avenues are outside the web layer,
and each is a real decision the owner should take, not a quiet refactor:
bundling a working WebKitGTK in the AppImage (large, fragile, and the AppImage
is not what the tester uses — he is on the deb); or generating a font whose
marks need no GPOS. The second would mean shipping a mushaf face that is not
the Complex's own file, which §2 forbids. Neither should be done unilaterally.

### The AppImage / HarfBuzz trap (do not repeat this)

The AppImage bundles GTK, Pango, cairo, ICU 70 and `libharfbuzz-icu`, but **not**
plain `libharfbuzz`. It is tempting to "complete the set" by bundling the
builder's `libharfbuzz.so.0`. **Do not.** The Linux job runs on ubuntu-22.04, so
the builder's HarfBuzz is **2.7.4** — too old to set the ayah number inside its
medallion. Bundling it inflicted the exact field-reported bug on every user; this
was measured, then reverted. The host's HarfBuzz is newer on any current distro,
so letting the host win is correct. ICU **must** stay bundled: WebKit links
`libicuuc.so.70` by soname and no current distro ships 70.

**The Linux job stays on ubuntu-22.04 deliberately** — building against the
oldest supported glibc is what lets the deb install broadly. Moving it up would
strand users on older distros.

---

## 10. Verifying changes

```bash
npx tsc --noEmit
npm run build
cd src-tauri && cargo test        # 23 tests
```

**Visual changes are checked by rendering, not by eye-balling the diff.**

The app needs a stubbed Tauri host to mount in a plain browser. `scripts/harness/`
provides it. Sweep **5 themes × 2 languages** before shipping — several bugs here
appeared in only one theme or one direction.

Themes: `noor` (default), `emerald`, `pearl` (light), `mushaf`, `blue`, `red`,
`onyx`, `mushaf-gold`, `maktabah`, `samaa`.

---

## 11. The test harness

```bash
npm run build                                    # harness serves dist/
npm install --no-save playwright@1.49.1          # not an app dependency
node scripts/harness/shoot.mjs --out design-audit/x --themes noor,pearl --langs en,ar
node scripts/harness/probe.mjs                   # targeted measurements
```

Chromium is at `/opt/pw-browsers/chromium` — **do not run `playwright install`**.

- `stub-tauri.js` stands up `window.__TAURI_INTERNALS__` so the whole React tree
  mounts with no Rust build. Plugin calls arrive as `plugin:name|method` and are
  handled by prefix.
- `fixtures.mjs` seeds realistic data — surahs/ayat read from the real
  `quran.json`, 163 videos, 10 playlists, 175 stations, 6 reminders.
- Output per route/viewport/theme/language: viewport PNG, full-page PNG, and
  `metrics.json` (`scrollHeight`, `largestGap`, `trailingDeadSpace`). PNGs are
  gitignored; the measurements are tracked.

**Caveats**: the app mounts under `MemoryRouter` so routes are reached by
clicking, not by URL; `main` is a fixed-height flex child so a naive
`main.scrollHeight` reads identical on every route (the harness finds the real
scroller by overflow); Windows-only paths are stubbed to no-ops.

### Testing WebKitGTK specifically (important, not yet checked in)

The Chromium harness **cannot** catch the Linux-only bugs above. To reproduce
Linux rendering, drive **WebKitGTK** directly:

```bash
apt-get install -y python3-gi python3-gi-cairo gir1.2-webkit2-4.1 xvfb \
                   xdotool imagemagick
# then a small python3 GTK/WebKit2 script that serves dist/, injects
# stub-tauri.js as a UserScript, clicks through, and writes a PNG snapshot.
```

To test the *shipped* artifact end-to-end:

```bash
./App.AppImage --appimage-extract          # no FUSE needed
xvfb-run -a ./squashfs-root/AppRun         # drive with xdotool, capture with import
```

You can force an **old HarfBuzz** by copying a 2.7.x `libharfbuzz.so.0` into
`squashfs-root/usr/lib/` — that is exactly how the medallion bug was found and
how the fix was proven.

### What is NOT covered by automated tests

- All React/TypeScript code — **there are no frontend unit tests**.
- Anything requiring a real Tauri runtime (file dialogs, notifications, updater).
- Windows-only Rust branches — they compile only in CI.
- Real yt-dlp/ffmpeg behaviour.
- Visual regressions, unless someone runs the harness and looks.

The 23 Rust tests cover: DB column ordering (video + playlist), Qur'an reciter and
word-timing parsing, download progress/percent parsing, YouTube URL collection
rules, downloader retry/self-update rules, channel avatar selection, profile-id
path-traversal rejection, and channel URL normalisation.

---

## 12. Releasing

**Bump the version in FIVE places, or `tauri-action` fails the tag check:**

1. `package.json` (line 4)
2. `package-lock.json` — **two places**, lines 3 and 9
3. `src-tauri/Cargo.toml` (line 3)
4. `src-tauri/tauri.conf.json` (line 3)
5. `src-tauri/Cargo.lock` — the `salafi-video-hub` entry (~line 3577).
   *Note*: `typenum` and `es-toolkit` carry their own unrelated versions — do not
   blanket find-and-replace.

Then: commit → push → open PR → **squash-merge** → dispatch `release.yml` on
`main` with `{"version":"X.Y.Z","draft":"false"}`.

The **Windows job publishes first**; the **Linux job then adds its artifacts to
the same release and merges its entries into `latest.json`**. The sequencing is
deliberate — see the comment in `release.yml`.

**Afterwards, confirm `latest.json` reports the new version and every platform
entry carries a signature**: `windows-x86_64`, `windows-x86_64-nsis`,
`windows-x86_64-msi`, `linux-x86_64`, `linux-x86_64-appimage`,
`linux-x86_64-deb` — 6 entries. That file is the updater endpoint installed apps
poll. A missing linux entry with intact windows entries means the Linux job
failed: **degraded, not broken**.

A squash-merge rewrites `main`, so a branch that predates it will conflict.
Restart from `origin/main` and cherry-pick rather than merging.

### Updater signing — absolute rule

**Do not touch the updater keys, the pubkey, or the signing config.**
Key rotation is **permanently cancelled** — it breaks every installed client.
**Never print or echo the key.**

---

## 13. Bugs already fixed — do not reintroduce

| Symptom | Root cause | Fix |
|---|---|---|
| Mushaf letters torn apart (Linux only) | `text-align: justify`; WebKit expands between Arabic letters | `text-align: start` |
| Ayah numbers outside their medallions | HarfBuzz version-dependent `۝`+digits composition | `AyahMarker`: ring alone + CSS-centred number |
| Empty medallion, number beside it | JSX emitted ornament and digits as two text nodes | build the marker as one element tree |
| Dotted circle stamped into an ayah | split on `\s` hit U+2009 / U+00A0 inside words | split on U+0020 only |
| Warsh showing Hafs words | `synced` not gated on `warshMode`; cache survived switch | gate + clear on `setRiwayah` |
| Letters from the wrong face inside one word | font chain fell through to Amiri/Noto/Segoe/sans-serif | one KFGQPC face per riwayah, `font-display: block` |
| Lessons played 1, 10, 11, 12, 2… | `get_videos_by_ids` did `ORDER BY title` | return in caller's id order |
| "Mark completed" did nothing | fractional duration sent to an `i64` command | `Math.floor(duration)` |
| Library could break on upgrade | `SELECT *` + positional reads in `playlist.rs` | `PLAYLIST_COLUMNS` + test |
| No video plays on clean Linux install | deb declared only `ffmpeg`, not GStreamer | declare the decoder plugins |
| Window can't be resized on Linux | `decorations: false` removes GTK resize edges | `ResizeGrips` |
| Glass panels flat on older WebKitGTK | `@supports` tested only unprefixed `backdrop-filter` | test both forms |
| deb users nagged by an unwinnable update | updater has no self-install path on deb | `updater_can_self_install` gate |
| Default reminder sound was a two-note tune | 880 Hz → 1320 Hz (a perfect fifth) | band-limited noise knock |
| AppImage broke ALL Arabic | bundling the builder's old HarfBuzz | reverted; host HarfBuzz wins |

---

## 14. Open / unresolved

- **The Linux field report is explained and is an upstream defect.** The tester
  saw torn letters and stranded ayah numbers. The torn letters were `justify`
  on Arabic (fixed 1.51.0) and the medallion was HarfBuzz-version dependent
  (fixed 1.51.3). What remains — a mushaf that reads as thin or wrong — is
  **WebKitGTK 2.46+ not placing the harakat** (§9). The app now detects and
  reports it; it cannot repair it. Ask a reporting user for
  **Settings → Diagnostics → "Mushaf fonts"**: `harakat OK` means the engine is
  fine and the cause is something else, `HARAKAT NOT PLACED` means it is this.
- **The AppImage bundles Pango but not HarfBuzz/FreeType/fontconfig.** This is
  inconsistent in principle. Do **not** "fix" it by bundling the builder's
  HarfBuzz (§9). If it is ever revisited, it must be tested against an old-host
  scenario first.
- **No frontend tests exist.** Highest-value place to add them.
- Several sync Rust commands do heavy I/O on the main thread (`rescan_all`,
  `export_backup`/`import_backup`, `generate_thumbnail`, the first
  `get_quran_surahs` parse). They should move to `spawn_blocking`.
- `import_backup` is non-transactional and rejects backups written by older
  builds (missing `#[serde(default)]` on `Video`).
- Tauri capabilities were narrowed in 1.51.4: `fs:read-all` and `fs:write-all`
  are gone (the app-scoped `fs:allow-app*`/`appcache`/`applocaldata`/`applog`
  grants remain) and `shell.open` is scoped to `^https://[^\s]+$` instead of
  `^.*$`. Nothing in `src/` imports `@tauri-apps/plugin-fs` or
  `-plugin-shell` — every file operation goes through the app's own Rust
  commands, which the fs plugin ACL does not govern. If a future change does
  need the fs plugin, add the narrowest scope that works, never `*-all`.

---

## 15. Working style that suits this project

- **Reproduce before fixing.** Several fixes here were wrong because the bug was
  Linux-only and the developer machine is not Linux-like enough. If a report is
  platform-specific, build the environment that reproduces it.
- **Verify in the artifact, not the source tree.** Download the released
  AppImage/deb and run it. Packaging bugs are invisible any other way.
- **Prefer a mechanism that cannot fail over one that usually works.** The
  medallion fix removed the dependency on the shaper entirely rather than
  demanding a newer HarfBuzz.
- **When a rule is discovered, write it into `CLAUDE.md`.** That file is the
  project's memory; this document is its expansion.
- Commit messages here explain **why**, with the failure they prevent. Keep that.
