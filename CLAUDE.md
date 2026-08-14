# Salafi Video Hub

Tauri v2 desktop app (Windows) — React + TypeScript + Vite + Tailwind on a Rust
backend. An offline Islamic study library: local video, the mushaf in two
riwayat with word-level recitation sync, radio, reminders.

## Manhaj constraints

These are not style preferences. A design that violates one is rejected
regardless of how good it looks.

- **No depiction of animate beings anywhere.** No humans, faces, animals or
  silhouettes — in any background, illustration, icon, empty state or loading
  art. Ornament is geometric or vegetal only.
- **Qur'anic text is never decoration.** Never behind a button, never a
  watermark, never clipped, never letter-by-letter animated, never faded in.
- **Qur'anic text is never restyled.** No letter-spacing, no gradient fill, no
  drop shadow, no `text-transform`, no substituting a display face.
- **Mushaf text renders only through the bundled official KFGQPC face for its
  own riwayah** — Hafs v0.18 or Warsh v10. The ayah marker is an ornament, not
  Qur'anic text, so it may use Amiri Quran; the ayah body may not.
- **Any hadith or athar must carry its source** (book + number).
- **Arabic in graphics must be real, correctly shaped text from a real font.**
  Never AI-generated or hand-traced letterforms. `scripts/build-*.py` shape
  real fonts with HarfBuzz and emit outlines — that is the supported route.
- **No music**, instrumental stings, or melodic feedback.
- KFGQPC and font licence notices stay intact and reachable in the app.

## Riwayah

Hafs (Kufan verse numbering) and Warsh (Madani numbering) are never mixed. The
two texts, their numbering, their fonts and their localStorage keys are all
tagged by riwayah. Recitation timing data is Hafs-only, so the word-sync
tracker must never point at a Warsh ayah.

## Load-bearing invariants

Changing any of these silently breaks something that looks unrelated. Each is
commented at its site; this is the index.

- `.quran-reading-surface` must keep `overflow: visible` and `border: none`.
  `positionWordCue` measures the cue against this element's padding box while
  the word's coordinates come from the border box. A border shifts the cue off
  the spoken word; making it a scroll container leaves the cue `scrollTop`
  pixels out. The scroller is `.quran-reading-viewport`, one level up, where
  both rects move together.
- A CSS `mask` applies to an element's whole subtree. The jadwal's hairline
  rules therefore live on `.quran-reading-frame`'s pseudo-elements, not inside
  the masked `.quran-jadwal`, or they would be cut to the band's silhouette.
- `tailwind.config.js` must keep `./src/assets/marks/*.svg` in `content`. The
  fill classes on the inlined SVG marks appear nowhere else, and without this
  they are purged and the marks render SVG-default black.
- `rgb(var(--x-rgb) / 0.16)` — slash syntax. `rgba(var(--x-rgb), 0.16)` mixes
  space-separated channels with a comma alpha, is invalid, and silently drops
  the whole declaration.
- Arabic strings wrapped for bidi need U+2067 (RLI); U+2066 (LRI) reverses
  them. `formatDuration` shipped `1س 0د` as `1د0 س` this way.
- `html[data-language='ar']` zeroes letter-spacing globally. Tracking breaks
  the joins in a cursive script.
- `src/db/video.rs` uses the `VIDEO_COLUMNS` const, never `SELECT *` — column
  order in the file does not match the struct, and a test asserts this.
- **Never `text-align: justify` on a surface carrying Arabic, above all
  Qur'anic text.** WebKit — every Linux build — justifies Arabic by expanding
  between LETTERS, not only at spaces, which tears the joins of the cursive
  script apart. That is letter-spacing on Qur'anic text by another name, so
  the manhaj forbids it outright. Blink (Windows WebView2) expands only at
  spaces, so this looks perfect on Windows and broken on Linux.
  `text-justify: inter-word` is not a fix — WebKit ignores it.
- **Split ayah text on U+0020 only, never `\s`.** Both corpora carry a second,
  deliberate space *inside* a word: Hafs has U+2009 THIN SPACE in 2:72, Warsh
  has 434 U+00A0 NBSPs binding ۞ to the word it opens. `\s` matches both, and
  splitting there puts bare combining marks at the head of their own span —
  which WebKit shapes as its own run, stamping a dotted circle onto Qur'anic
  text — besides orphaning the ornament and shifting every later word index.
- **The mushaf font chain is the riwayah's KFGQPC face and nothing else.**
  CSS font fallback is per GLYPH, so any family listed after it can composite
  single letters into a Qur'anic word; the Hafs face sitting second in the
  Warsh chain mixed the two readings' letterforms inside one word. Both faces
  are `font-display: block` — with `swap` the ayah paints in a fallback first.
  The sole exception is `.quran-basmala-calligraphy`: U+FDFD is an ornament
  ligature (the element is `role="img"`) that neither KFGQPC face contains, so
  it names Amiri Quran explicitly, at the specificity of the Warsh rule.
- `get_videos_by_ids` returns rows in the CALLER's id order, never SQL's. The
  scanner naturally-sorts `playlist.video_ids` so "الدرس 2" precedes "الدرس 10";
  an `ORDER BY title` there became the player's queue and made "next lesson"
  play the tenth.
- `src/db/playlist.rs` uses `PLAYLIST_COLUMNS`, never `SELECT *` — same reason
  as `VIDEO_COLUMNS`, and a test asserts the order.
- **The ayah medallion never depends on the shaper.** `۝` + digits is
  composed into one medallion by HARFBUZZ, and only from a certain version:
  measured on one binary, HarfBuzz 8.3 sets the digits inside the ring while
  HarfBuzz 2.7 leaves it empty and strands the number beside it. Windows uses
  DirectWrite and never shows it; a current distro never shows it; an older
  Linux gets a page of empty medallions. `AyahMarker` therefore renders U+06DD
  ALONE (nothing follows it in its run, so there is nothing to compose) and
  centres the number over it with CSS. The 70% offset is measured, not
  arbitrary — the ring glyph's ink sits low in its em box.
- **One shaping run must live in one DOM text node.** WebKit shapes each text
  node independently; Blink merges adjacent ones first. So JSX of the form
  `۝{digits}` — ornament and number as separate children — renders an empty
  ayah medallion with the number stranded beside it on Linux and correctly on
  Windows. Build such strings whole rather than letting JSX split them. The same trap applies to any combining
  mark separated from its base.
- **The mushaf `@font-face` families are app-private names** — `SVH Mushaf
  Hafs`, `SVH Mushaf Warsh`, `SVH Ornament Amiri` — never the real font names.
  A machine with `KFGQPC Uthmanic Script HAFS` installed system-wide otherwise
  wins the name and sets the Qur'an in *its* copy, silently, with no way to
  tell from inside the app. Proven by installing an impostor under that name.
  Keep the CSP's `font-src` in step; without it the faces never load at all.

## WebKitGTK 2.46+ drops the harakat

Not an app bug, and the app cannot make the engine place them — but it no
longer has to: see "The app works around it" below. This is still the first
thing to suspect whenever a Linux screenshot shows a mushaf of bare
consonants.

WebKitGTK from 2.46 (the Skia rendering backend) does not apply HarfBuzz's
GPOS mark-attachment offsets for the KFGQPC faces. Shaping is correct — the
glyph list carries every mark, and `hb-shape` on the same font returns the
right offsets under both HarfBuzz 8.3 and 14.3 — but the marks are painted at
the baseline instead of above their letter, where they disappear into the
letterforms. The reader gets an incomplete Qur'anic text.

Proven, not inferred: the *same* `.deb` binary, same fonts, same script, was
captured at 20:47 on 2026-08-01 under WebKitGTK 2.44 with every harakah in
place, and again under 2.52.3 with them all gone. `/var/log/dpkg.log` records
the downgrade at 20:44:16 and the upgrade back at 20:55:55. One variable.

Ruled out, each by experiment — do not re-litigate these:

- Not font fallback, and not the app's CSS: it reproduces on a bare page whose
  only font is the `@font-face` file.
- Not the file, the format or the build: `.woff2` and `.ttf` fail alike, and
  both riwayat fail alike.
- Not `gasp` grid-fitting, not the legacy `kern` table.
- Not `line-height`, `text-rendering`, `-webkit-font-smoothing`, `text-shadow`,
  `-webkit-text-stroke`, layerisation, `font-feature-settings`, `word-spacing`,
  `paint-order`, `contain`, or font size.
- Not the rendering surface: DOM, SVG `<text>` and `<canvas>` all fail
  identically, so there is no path to switch the mushaf onto.
- Not an env var: `WEBKIT_FORCE_COMPLEX_TEXT`, `WEBKIT_SKIA_ENABLE_CPU_RENDERING`,
  `WEBKIT_DISABLE_COMPOSITING_MODE`, `WEBKIT_DISABLE_DMABUF_RENDERER` and
  `LIBGL_ALWAYS_SOFTWARE` all produce byte-identical output.
- Not the harness: `get_snapshot()` and an X-screen capture of a real window
  agree, and the real `.deb` reproduces it.

Why some words still look right: KFGQPC precomposes some sequences into single
glyphs through GSUB — `بِسۡمِ` is one glyph (`Bism`), and much of `ٱلرَّحۡمَٰنِ`
likewise — and a glyph that carries its own marks needs no GPOS offset. That is
why the basmala survives while `ٱلۡحَمۡدُ` next to it does not, and why a
screenshot can look half-right. Marks *below* the line (kasra) also survive:
their outlines already sit below the baseline.

### The app works around it

`checkHarakat` in `src/utils/mushafFont.ts`
detects the engine; when it is one of these, the Qur'an page stops asking the
engine to lay out Qur'anic text and asks it only to fill outlines shaped out in
Rust — `src-tauri/src/commands/mushaf_shape.rs`, rustybuzz over the Complex's
own face, the offsets the Complex's own GPOS asks for. Verified end to end: on
WebKitGTK 2.52 the page renders `ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ` complete.

Rules for that path:

- It is keyed on the probe, never on the platform. A healthy engine — every
  Windows build, Linux before 2.46 — takes the normal text path and shapes
  nothing. Verified: Chromium renders 0 outline SVGs.
- Each GLYPH is sent once and placed by reference. Whole-word paths measure
  ~19 MB for al-Baqarah alone and ~139 MB for the Qur'an; per glyph the total
  is bounded by the face, about 1400 outlines.
- Coordinates are font units, and SVG's y grows DOWNWARD: the outline is
  written negated and the placement must be negated too, or every mark GPOS
  lifts lands below its letter — the same defect, reintroduced by a sign. A
  test asserts a raised mark has negative y.
- The word span keeps its id and its box, so the recitation cue and the
  word-sync highlight need no changes; the glyphs take `fill: currentColor` so
  colouring the span still colours the word.
- The surah heading and quran.com's synced word list are shaped too. The
  synced words are DIFFERENT strings than the bundled corpus, so without
  shaping them the mushaf regressed to bare consonants the moment playback
  started; the heading's dammas dropped like the ayah text's.
- The real text stays in the DOM under `.quran-word-source`, clipped rather
  than `display:none`, so the ayah can still be selected, copied and announced.
- The warning banner only appears if the fallback ITSELF could not run. When
  the outlines are drawn there is nothing for the reader to do, so nothing is
  said.
- Cost: a long surah gains roughly four `<use>` nodes per word. Acceptable
  against an unreadable mushaf, but it is why the fallback is not the default.

The banner text and the Diagnostics row still report the engine plainly. It measures painted pixels — canvas is the only way to see them,
and it fails the same way, which is what makes it a faithful witness. It
compares the topmost ink of `لَّهِ` against `له`: a correct engine lifts it
0.34–0.45em, a broken one 0.00–0.16em, and the threshold is 0.25em. Measure
the *difference*, never an absolute height — the absolute varies with face,
riwayah and engine, and a 1.05em absolute threshold shipped a false alarm on
Chromium at 1.047em. Load the face for canvas first (`document.fonts.load`)
and confirm canvas is really using it by advance width, or the probe measures
a fallback and blames a healthy engine.

## Verifying

```
npx tsc --noEmit
npm run build
cd src-tauri && cargo test        # 23 tests
```

Visual changes are checked by rendering, not by eye-balling the diff. The app
needs a stubbed Tauri host to mount in a plain browser; the harness scripts
build one and seed real data, then Playwright drives Chromium at
`/opt/pw-browsers/chromium`. Sweep 5 themes x 2 languages before shipping —
several bugs here only appeared in one theme or one direction.

Chromium stands in for Windows only. To see what a Linux user sees, drive the
same `dist/` through WebKitGTK (`python3.12` + `gi` + WebKit2 4.1 under
`xvfb`). Before reading anything into such a render, check
`dpkg -l libwebkit2gtk-4.1-0`: on 2.46+ the mushaf will be missing its harakat
no matter what the app does, and that render says nothing about the change in
front of you. `import -window root` and `get_snapshot()` agree, so either
capture is fine.

**The AppImage must NOT bundle `libharfbuzz.so.0`.** It was tried, on the
theory that the bundled `libharfbuzz-icu` should be paired with a matching
HarfBuzz, and it regressed the mushaf: the builder's HarfBuzz is 2.7 (the
job runs on ubuntu-22.04), which is too old to set the ayah number inside
its medallion, so bundling it inflicted on every user the exact fault the
field reported. The host's HarfBuzz is newer than the builder's on any
current distro, so letting it win is correct. ICU stays bundled and cannot
be dropped — WebKit links `libicuuc.so.70` by soname and no current distro
ships 70. The Linux job stays on **ubuntu-22.04** deliberately: building
against the oldest supported glibc is what lets the deb install anywhere.
`bundleMediaFramework` is on because an AppImage cannot declare the
GStreamer decoders the deb declares.

The app ships for **Windows and Linux**. The Rust helpers (ffmpeg, yt-dlp,
open/reveal) are platform-switched on `cfg`; the Windows-only branches compile
only in CI, the Linux branches compile natively here — `cargo test` exercises
them. Platform bundling lives in `tauri.windows.conf.json` (nsis/msi,
bundled yt-dlp.exe) and `tauri.linux.conf.json` (appimage/deb; yt-dlp is
downloaded on demand, not bundled). Only the AppImage auto-updates on Linux —
deb installs are updated by their package manager, not by the app.

## Releasing

Bump the version in **five** places, or `tauri-action` fails the tag check:
`package.json`, `package-lock.json` (lines 3 and 9), `src-tauri/Cargo.toml`,
`src-tauri/tauri.conf.json`, and `src-tauri/Cargo.lock` (the
`salafi-video-hub` entry — note `typenum` carries its own unrelated version).

Then commit, push, open a PR, squash-merge, and dispatch `release.yml` on
`main` with `{"version":"X.Y.Z","draft":"false"}`. The Windows job publishes
first; the Linux job then adds its artifacts to the same release and merges
its entries into `latest.json` (the sequencing is deliberate — see the
comment in release.yml). Confirm afterwards that `latest.json` reports the
new version and every platform entry (three windows-x86_64 variants plus
linux-x86_64) carries a signature — that file is the updater endpoint the
installed app polls. A missing linux entry with intact windows entries means
the Linux job failed; that is degraded, not broken.

A squash-merge rewrites `main`, so a branch that predates it will conflict.
Restart from `origin/main` and cherry-pick the new commits rather than merging.

## Updater signing

**Do not touch the updater keys, the pubkey, or the signing config.** Key
rotation is permanently cancelled — it breaks installed clients. Never print
or echo the key.
