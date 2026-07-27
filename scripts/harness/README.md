# Visual harness

`CLAUDE.md` says visual changes are checked by rendering rather than by
eye-balling the diff, and that a stubbed Tauri host plus Playwright is how that
is done. Until now those scripts did not exist in the repository — every
session rebuilt them and threw them away. This is that harness, checked in.

## What it does

The app talks to Rust through exactly one object, `window.__TAURI_INTERNALS__`.
`stub-tauri.js` stands that object up in a plain browser, so the whole React
tree mounts against seeded data with no Rust build and no Windows.

`fixtures.mjs` seeds it. The surah list and ayah text are read out of
`src-tauri/resources/quran.json` — the same file the Rust command reads — and
the library is 163 videos, 10 playlists, 175 stations and 6 reminders with
realistic title lengths and real Windows paths. Screenshots taken against
placeholder data lie about line lengths, about how Arabic sits on the baseline,
and about how a card behaves when a title genuinely wraps.

## Usage

```sh
npm run build                                   # the harness serves dist/
node scripts/harness/shoot.mjs --out design-audit/before
node scripts/harness/shoot.mjs --out design-audit/x --themes noor,pearl --langs en,ar
node scripts/harness/probe.mjs                  # targeted measurements
```

Playwright is not a dependency of the app. Install it when you need the
harness:

```sh
npm install --no-save playwright@1.49.1
```

Chromium is already present in the container at `/opt/pw-browsers/chromium`;
do not run `playwright install`.

## Output

Per route, per viewport, per theme × language:

- `<route>-<w>x<h>.png` — the viewport, i.e. what the user actually sees
- `<route>-<w>x<h>-full.png` — the full scroll height
- `metrics.json` — `scrollHeight`, `largestGap`, `trailingDeadSpace`

`trailingDeadSpace` is the empty band below the last real content inside the
visible frame; `largestGap` is the tallest band anywhere in the page containing
no leaf content. Those two numbers answer "is this route mostly empty" without
anyone having to squint at a picture.

The PNGs are gitignored — 20MB per run, and a run per phase. The measurements
beside them are tracked, because those are what a later session can diff.

## Caveats

- `main` is a fixed-height flex child and always reports its client height. The
  real scroller is a descendant; `shoot.mjs` finds it by overflow. A naive
  `main.scrollHeight` reads identical on every route and is what a first
  attempt at this measured.
- The app mounts under `MemoryRouter`, so routes are reached by clicking the
  sidebar, not by URL.
- Windows-only paths (`Open externally`, `Reveal in folder`) are stubbed to
  no-ops. The harness cannot verify them; only CI compiles them.
