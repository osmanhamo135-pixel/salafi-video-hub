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

## Verifying

```
npx tsc --noEmit
npm run build
cd src-tauri && cargo test        # 21 tests
```

Visual changes are checked by rendering, not by eye-balling the diff. The app
needs a stubbed Tauri host to mount in a plain browser; the harness scripts
build one and seed real data, then Playwright drives Chromium at
`/opt/pw-browsers/chromium`. Sweep 5 themes x 2 languages before shipping —
several bugs here only appeared in one theme or one direction.

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
