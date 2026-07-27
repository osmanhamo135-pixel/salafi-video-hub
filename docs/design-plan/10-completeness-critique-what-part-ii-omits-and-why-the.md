# Completeness critique: what Part II omits, and why the sequencing inverts

## Method and one caveat

Everything below is checked against the working tree at `/home/user/salafi-video-hub`. Line numbers are real. I did not re-derive the Phase 0 audit.

**Caveat on the sequencing question.** I was asked to validate the order `0, 1, 2, 3a, 3b, 3c, 3d, 4, 5, 6, 7, 8, 9, 10`, but no artefact in my context or in the repo defines what those phases are. `docs/` holds `DESIGN_SYSTEM.md`, `VISUAL_AUDIT.md`, `CONTENT_POLICY.md`, `AUTO_UPDATES.md` — none contains a phase legend, and there is no `PLAN.md`. **A 13-phase plan whose phase names exist nowhere in the repo is itself the largest process gap here.** §14 below evaluates the one ordering that *is* written down (the hero spec's §13 seven-step list) and names the dependency inversions any numbering must respect.

---

### 1. Twenty-one of the twenty-five requested blocks have no spec — and four heroes depend on four of the missing ones

The supplied design spec covers `HeroContinue`, `HeroMushaf`, `HeroAmbient`, `HeroCompact`. That is 4/25.

No spec exists for: `RailPoster`, `RailWide`, `RailStation`, `GridMedia`, `SplitPane`, `ListGrouped`, `ListCompact`, `StatStrip`, `ChipRow`, `SectionHeader`, `EmptyState`, `ErrorState`, `LoadingState`, `FirstRun`, `TitleBar`, `SidebarNav`, `PlayerDocked`, `PlayerExpanded`, `CommandPalette`, `ToastStack`, `SheetSettings`.

This would be merely incomplete if the hero spec stood alone. It does not — it consumes four unspecified blocks by name:

- **`HeroSkeleton` (§1.4) *is* `LoadingState`.** It fixes `--skeleton-fill`, the `.skeleton` class, a `shape` enum and the zero-CLS contract *before* the 11 existing loading treatments (6 bespoke skeletons + 5 spinners, two different fill tokens, two different spinner implementations) have been surveyed. The shared primitive is being defined by its first caller.
- **§1.5 says "the route owns `ErrorState`."** There is no `ErrorState` spec. Five routes receive a hero that delegates errors to a component nobody has designed.
- **§4.6 says QuickActions' two `.quiet-action`s "move into the glance section's `SectionHeader` action slot."** `SectionHeader` has no spec and no action slot; the recon establishes **8 distinct section-header treatments across 18 call sites**, and the hero spec silently adds a ninth (the `.hero-compact` eyebrow).
- **`HeroCompactMetric[]` (§7.1) is `StatStrip` renamed.** Library's 4-stat `<dl>` (`Library.tsx:404-420`) and Reminders' three `ReminderMetric`s (`Reminders.tsx:279-295`) are migrated into it — two of the six rival StatStrip treatments get a home inside a hero, and the remaining four are left where they are with no plan.

**Damage if not closed before Phase 1:** the four most-reused primitives in the app get their API fixed by whichever hero happened to need them first, and the 25-block inventory becomes 4 blocks plus 21 retrofits.

**Also unspecified and load-bearing:** `HeroCompactProps.aside?: React.ReactNode` is an untyped escape hatch on a fixed-height band. It is the only `ReactNode` prop in the spec, it is where Library's `scanSubfoldersRecursively` checkbox goes, and nothing constrains its height — so the "180px regardless" guarantee has an arbitrary-content hole in it.

---

### 2. `AmbientLayer` has no spec, and two heroes have already signed a contract with it

The Part II ambient contract specifies four tiers, `min(themeDefault, deviceCapability, userPreference)`, a Settings control, **eight hard rules** and **five perf budgets**. Nothing in the plan specifies: the component, the store slice, the tier enum, capability detection, the battery hook, the window-blur/video-playback pause, the 30fps cap, or the canvas lifecycle.

Yet the hero spec already depends on it in three places:
- §5.4 makes `.hero-mushaf` and the `/quran` route root publish `data-ambient-ceiling`.
- §6.1 types `HeroAmbientProps.ground?: 0 | 1`.
- §8.2's Pearl row reads "ambient locked Tier 1".

`AmbientLayer` must sit as a child of `.app-container` alongside `<TitleBar/>` and `<AppShell/>` (`App.tsx:60-77`) — **a sibling of the route tree**, so it has no `[data-ambient-ceiling]` ancestor to read. The attribute mechanism is unimplementable as specified, and the one hard rule the contract says must be "verified by test not by eye" (never behind mushaf text) has no assertion that measures the layer's resolved tier.

**Damage:** heroes ship with a dead attribute, and the ambient system is later designed around an interface that already exists in the codebase and does not work.

---

### 3. The `backgroundMotion` setting requires Rust work the plan explicitly denies

§11.3: *"`cargo test` is unaffected — no Rust changes."*

The ambient contract requires *"Settings control: Background motion — Off / Subtle / Full, default Subtle."* Settings persist through SQLite. Adding one field touches, minimum:

| File | What |
|---|---|
| `src-tauri/src/models/settings.rs:15,35` | struct field + `Default` |
| `src-tauri/src/db/mod.rs:154` | the migration column list (`("performance_mode", "INTEGER DEFAULT 1")`) |
| `src-tauri/src/db/mod.rs:279`, `src-tauri/src/db/schema.rs:97` | two `CREATE TABLE` bodies |
| `src-tauri/src/db/settings.rs:42,57,85,98` | read/write — and `row.get::<_, i64>(9)` is **positional**, so a new column shifts indices |
| `src/types/index.ts:71-88` | the TS `Settings` interface |
| `src/i18n.ts` | 2 keys × 2 dictionaries |

`cargo test` **cannot run in this container** (gdk-3.0 missing) — verification is CI-only. This is unnamed work on the one layer the plan claims it does not touch, and it gates one of the three inputs to the tier formula.

---

### 4. No fixture variants exist, so every state block in the inventory is untestable

The injection mechanism is there — `shoot.mjs:88-90` does `addInitScript` for `window.__HARNESS_FIXTURES__` and `window.__HARNESS_SETTINGS__`. What is missing is everything above it:

- `scripts/harness/fixtures.mjs` exports **one** dataset (206 lines, one `stats`, one `importedFolders`).
- `shoot.mjs` has flags for `themes` and `langs` (`:32`) and **none for fixtures**.
- `stub-tauri.js:112` is `Promise.resolve(respond(cmd, args))` — synchronous, no latency, **no failure injection path at all**.

Consequence: `FirstRun`, the 4 hero empty phases, all 11 loading treatments and **all seven error conditions** cannot be rendered by any test that exists or is proposed. §13 step 6's "test by clearing `importedFolders` in the stub fixtures" describes a capability with no selector.

Required and in no phase: a `--fixture=` flag; named variant sets (`default`, `first-run`, `folder-missing`, `radio-offline`, `ffmpeg-missing`, `db-orphaned`, `offline`, `update-failed`); per-command latency (`window.__HARNESS_LATENCY_MS__`); per-command rejection.

---

### 5. Zero of the seven error conditions gets a wired recovery

The recon is unambiguous: **2 of 7 detected and wired, 3 of 7 with no detection at all, 0 of 4 recovery functions reachable outside `/settings`.** Part II adds nothing. §1.5 pushes errors off the hero onto the route, and then specifies no route error surface.

Specifically unowned:

| # | Condition | What is missing |
|---|---|---|
| 1 | folder missing / drive disconnected | **No detection exists.** `Settings.tsx:514-532` lists paths with no existence check. Silent until a video is clicked. |
| 3 | ffmpeg not found | Detected, but surfaced only in Settings. Not on `/library` (thumbnails silently fail) or `/downloads` (merges fail). |
| 4 | thumbnail generation failed | Surfaces as a bare word in a metadata line (`PlaylistDetail.tsx:359`). No cause, no action at the failure point. |
| 5 | DB repair / orphaned entries | **No detection.** `Reminders.tsx:132-135` computes `brokenReminders`, renders a metric and a warning line — **with no action attached**, when `remove_orphaned_entries` is exactly the fix. |
| 6 | no network | **Zero hits** for `navigator.onLine` or an `offline` listener in `src/`. Nothing tells the user the library is unaffected. |
| 7 | update check failed | `UpdateManager.tsx:36-40` gates the error card on `Boolean(update)` — a failed *check* renders nothing. |

And the four recovery functions each have exactly one call site, all four in the same `.quiet-action` `ActionBar` in a 918-line Settings page (`Settings.tsx:535-539`, `:721-727`).

**Nothing in the plan schedules detection, schedules the `ErrorState` variants, or names who makes the recovery functions reachable from the point of failure.**

---

### 6. Ten themes, three reference plates, zero ambient concepts

§8.2's behaviour table uses a ditto mark (`"`) in the HeroAmbient column for **9 of 10 rows**. That is not a per-theme concept; it is one gradient in ten hues, which is the exact finding Phase 0 opened with.

What actually exists:

| Theme | Reference | Ambient concept |
|---|---|---|
| mushaf-gold | Plate A (clean) | none written |
| maktabah | Plate C (clean, plant is vegetal — permitted) | none written |
| samaa | Plate B — **disqualified as-is, bird silhouette in the cloud field** | none, and the ground must be regenerated before anything derives from it |
| noor, emerald, pearl, mushaf, blue, red, onyx | **none** | **none** |

Seven themes have neither a reference plate nor a written concept, and the one plate that maps to a theme's identity needs its ground rebuilt. Nobody is named as the author of the seven, no method is stated (the only supported route for Arabic in graphics is `scripts/build-*.py` with HarfBuzz — Manhaj 7), and no asset budget is allocated against the contract's `< 1.5MB across all ten themes`.

**Related, unaddressed:** `design_refs/islamic_theme/` holds 20 checked-in reference images, of which ~12 are `mood_*` files whose own filenames declare animate beings — `figures`, `rider`, `riders`, `warrior`, `masked_figure`, `faceless_figure`, `hand`, `ninja`. The plan states no policy for that directory, marks nothing as excluded, and never says which refs may seed a theme ground. Under Manhaj 1 this is the highest-consequence unowned surface in the repo.

---

### 7. Surface profiles: two themes assigned by stealth, one profile empty

**Two undeclared decisions inside a code snippet.** The brief names 8 of 10 themes: warm `{maktabah, mushaf-gold, emerald}`, cool `{samaa, blue, noor}`, light `{pearl}`, pure-black `{onyx}`. §8.1's `SURFACE_PROFILE` map adds `mushaf: 'warm'` and `red: 'warm'` with no argument. Mushaf Night is the app's darkest theme (`--bg-main-rgb: 5 7 6`, `index.css:193`) and has at least as good a claim on `pure-black` as Onyx does; Yaqut Red's temperature is a judgement nobody made out loud. **This is a decision being deferred by being made silently.**

**The `cool` profile is an empty block.** `html[data-surface='cool'] { /* glass opacity + backdrop prominence live here */ }` — 3 of 10 themes get a named profile containing zero declarations, and the one thing it gestures at (`backdrop-filter`) is the single highest perf risk in the scheme. Today the app's only `backdrop-filter` is `.surface-3 { blur(22px) saturate(1.35) }` (`index.css:1930`), correctly scoped to overlays. "More prominent" is undefined, has no ceiling, and no test.

**Two unexamined interactions:** `light` replaces `--elev-1/2/3` with 1px rings, but Pearl also sets `--sheen-rgb: 255 255 255` (`index.css:568`) — the inset highlight the ring replacement discards is what carries edge definition there. `pure-black` sets `--elev-*: none`, which kills the `inset 0 1px 0 rgb(var(--sheen-rgb) / …)` line in all three elevations (`index.css:565-575`), not just the drop shadow. Neither is discussed.

**And `root.dataset.surface` is in no step of §13.** Four CSS blocks and one line in `App.tsx` that the entire §8.2 behaviour table depends on are unscheduled.

---

### 8. The accent problem is named as the root cause and then deferred without a schedule

§8.3 is honest that it does not fix the five-seeds/one-rendered finding, and offers the migration path: `html[data-theme='blue'] { --hero-accent-rgb: var(--accent-blue-rgb); }`, *"No hero component changes."*

That is not true today, and the plan does not say what else must move first:

- **`--ring-focus` is hardcoded to gold.** `index.css:585-587`: `0 0 0 4px rgb(var(--accent-gold-rgb) / 0.95)`. Flip `--hero-accent-rgb` on Sakinah Blue and every button turns blue while every focus ring stays gold.
- `--hair-rgb: var(--accent-gold-rgb)` drives every hairline in the app, including `.hero-compact-metrics`' own rules.
- 130 `accent-gold` component usages, `.premium-pill`, `.gold-thread` — none routed.

The one-line promise is a three-file promise, and no phase owns the other two files.

---

### 9. Not one Part II perf budget can be measured by anything proposed

| Budget | Proposed measurement |
|---|---|
| idle CPU at Tier 3 < 3% | **none** |
| GPU memory for the layer < 40MB | **none** — needs CDP `Performance.getMetrics`, unmentioned |
| zero contribution to input latency | **none** |
| ambient assets across ten themes < 1.5MB | **no accounting method defined at all** |
| no `filter: blur()` on a large animated element | **no grep gate, no runtime check** |

Worse, **the mandated sweep runs with motion switched off**: `shoot.mjs:87` creates every context with `reducedMotion: 'reduce'`. Nothing in the harness ever exercises the motion path — not `.segmented`'s transition, not `busy`'s `motion-safe:animate-spin`, and certainly not Tier 2/3 ambient. A second `reducedMotion: 'no-preference'` axis is required and is in no phase.

**And Playwright is not a dependency.** `scripts/harness/README.md:30` says so explicitly (`npm install --no-save playwright@1.49.1`); it is absent from `package.json`; `shoot.mjs` hardcodes `executablePath: '/opt/pw-browsers/chromium'`. Of §11.3's eleven assertions, **only 9 and 10 (the greps) can run in CI**. The plan calls the rest a gate without naming a human or a moment.

---

### 10. `/player` is a ninth route with no block, no hero, and a dead accent

`App.tsx:66-75` registers **nine** routes. The audit and the plan both work from eight. `/player` gets:

- `PlayerExpanded` — unspecified (block 22).
- Its empty state (`PlayerPage.tsx:76-104`) painted in `text-primary-blue/55` — one of the four accent seeds the app renders roughly once.
- `PlayerHeader.tsx:41,45` and `QueuePanel.tsx:86,92,145,151` still on `primary-blue`.
- The sidebar collapsed to `w-0` while it is mounted (`Sidebar.tsx:52-54`), which is why "browse while watching" does not exist.
- No `HeroCompact`, no `HeroContinue`, no assignment of any kind.

`RadioMiniPlayer` is mounted outside `<Routes>` (`App.tsx:79`) and floats `fixed bottom-5 end-5 z-40` over the last row of every list **including the Qur'an reading pane** — and no route in Part II reserves space for it. `PlayerDocked`'s layout reservation is a cross-cutting change to all nine routes that Part II's route work does not account for.

---

### 11. `/radio`'s 6431px unvirtualized list has no owner, and Part II makes it worse

175 rows, `scrollHeight 6431px`, `Radio.tsx:218` is a plain `.map()`. Part II virtualizes nothing and adds a 180px band (209.5px in Arabic, per the auditor's measurement) above it — pushing the first station further down on the heaviest route in the app. `RailStation` (block 7) is unspecified. There is no tracked-debt entry, no named owner, and no statement that virtualization is out of scope.

It is also an unbudgeted CI cost: `shoot.mjs:113` takes `fullPage: true` screenshots, so a 40-combination × 8-route sweep includes 40 full-page captures of a 6431px document.

---

### 12. Props are declared that no data source produces

`HeroContinueProps.lesson` (§4.1) declares `playlistId`, `collection` and `siblingCount`. Reality:

- `get_continue_watching` returns `Vec<Video>` (`src-tauri/src/db/video.rs:250`, `commands/playback.rs:57`). `Video` (`src/types/index.ts:14-39`) has no playlist, no collection, no sibling count.
- `ContinueWatchingItem` is `{video, playlist}`; the folder-leaf fallback is derived **client-side** at `ContinueWatching.tsx:66-70`.
- **`siblingCount` cannot exist under §4.6's rule.** §4.6 says the hero takes *"the first item of `get_continue_watching` and nothing else."* `siblingCount` is `lead.items.length - 1` and requires the full grouped list of 20 (`ContinueWatching.tsx:62-80`) — the exact grouping §0 deletes along with `FeatureCard`.

The spec declares a prop shape and never names the derivation site. Either the grouping survives in a container the spec doesn't mention, or `siblingCount` is cut.

---

### 13. Smaller unnamed decisions

- **The Latin face.** `docs/DESIGN_SYSTEM.md:11-19` already calls this *"an open decision, not a bug to silently patch."* Every px in §7.2 and §11.1 is derived from metrics of a font that does not ship (`index.css:613` names Inter; the only `@font-face` families are Amiri Quran, Aref Ruqaa, KFGQPC Hafs, KFGQPC Warsh, Plex Arabic). Part II schedules neither the decision nor a measurement tolerance.
- **The twelve named libraries get zero verdicts.** KokonutUI, React Bits, Bklit, Limora, Anime.js, Motion, Rive, Magic UI, motionsites.ai, animated-backgrounds — not one is evaluated. Several need only a line: **Limora ("on-brand AI images") collides head-on with Manhaj 7** (Arabic in graphics must be HarfBuzz-shaped from a real font, never AI-generated); **Rive is interactive cursor animation** with a runtime; **Bklit's video export** is out of scope for an offline app. Beyond the manhaj question, none has a bundle-size, licence or offline-vendoring policy stated — this is a signed-updater Windows desktop app, and every one of these is a new npm dependency in a release that must be reproducible.
- **`page-enter` has two specs and no owner.** `.page-container { animation: page-enter … }` (`index.css:1834`) is a 0→1 opacity keyframe wrapping every route. The hero spec argues around it for the Basmala (§3); the ambient contract separately forbids animating on route change. Two documents, one 280ms, no shared decision.
- **`useEyebrowClass` is promoted, not tokenised.** It is moved verbatim into a shared hook (§0) carrying `text-[11px]` and `tracking-[0.16em]` — two of the 160 arbitrary Tailwind px classes the audit counted, now blessed as the app's single eyebrow definition. No decision is recorded either way. (Also: §0 cites it at `:22-28`; it is at `ContinueWatching.tsx:19-24`.)
- **Four empty-state icon idioms, and the plan adds a fifth.** Geometric `PlaylistArt`, the nested double-square frame, the circular medallion, a naked lucide glyph — and §4.4 introduces "seeded `PlaylistArt` at hero scale". `EmptyState` is unspecified, so the fifth idiom lands first.

---

### 14. Sequencing

I cannot map `3a–3d` — the phase legend is not in the repo or in my context, and that is a gap in its own right. Evaluating the hero spec's own §13 order, **six of its seven steps depend on something no step produces**:

| §13 step | Depends on something later or absent |
|---|---|
| 1 — tokens, `.skeleton`, `.jadwal-mount`, `HeroActionButton` | `.skeleton` is `LoadingState`'s fill token, fixed before `LoadingState` is specified. `HeroActionButton` fixes the button API before `ChipRow`/`ToastStack`/`ErrorState` state their button needs. **`root.dataset.surface` + the four `html[data-surface]` blocks are in no step at all**, yet §8.2's whole table depends on them. |
| 2 — `BasmalaPlate`, `NoorMark` | *"verify with the harness before touching anything else"* — the harness runs `reducedMotion: 'reduce'` only, and Playwright is not installed. |
| 3 — `HeroCompact` + 6 routes | Needs `SectionHeader` and `StatStrip`. Migrates Library's `<dl>` and Reminders' `ReminderMetric`s into `HeroCompactMetric[]` — StatStrip specified twice, under two names, in two phases. |
| 4 — `HeroContinue` + Dashboard | Needs the `siblingCount`/`collection` derivation site (§12), and deletes the grouping that computes it. |
| 5 — `HeroMushaf` | Publishes `data-ambient-ceiling` to a component that does not exist and whose sibling position makes the attribute unreadable. Ties `.quran-reading-viewport`'s max-height to hero chrome, but the assertion that guards the mushaf hard rule can't be written until `AmbientLayer` exists. |
| 6 — `HeroAmbient` + `firstRun` | Requires the fixture-variant harness (§4) — in no step. Also requires seven theme ambient concepts (§6) — in no step. |
| 7 — `assert-heroes.mjs` | Last, so steps 1–6 ship unverified. Requires Playwright in `devDependencies` and a non-`/opt` executable path — in no step. Assertion 8 (CLS) cannot execute against a synchronous stub. |

**Concrete inversions to fix before Phase 1 starts:**

1. **Harness before components.** Playwright pinned in `devDependencies`, `executablePath` fallback, `--fixture=` flag, named variant sets, per-command latency and rejection in `stub-tauri.js`, a `reducedMotion: 'no-preference'` axis, and the two grep gates. Nothing downstream is verifiable without it, and every later phase claims verification it cannot perform.
2. **Surface profiles + `root.dataset.surface` before any hero.** Four CSS blocks and one App.tsx line, currently unscheduled, that four heroes' per-theme behaviour is defined against.
3. **The Rust `backgroundMotion` column before the ambient system** — it is one of three inputs to the tier formula, it touches six Rust files with positional column indices, and it can only be tested in CI.
4. **`SectionHeader`, `StatStrip`, `ChipRow`, `LoadingState`, `EmptyState`, `ErrorState` before the heroes that consume them.** Six primitives, four of which the hero spec already builds by accident.
5. **`AmbientLayer`'s store slice before `HeroMushaf`**, so the ceiling is published to a subscriber rather than to an attribute nobody reads.
6. **Error detection + recovery wiring as its own phase**, sized against the three conditions with no detection at all — it is the largest unscheduled body of work in the inventory and the only one that changes what the app *does* rather than how it looks.


## Risks

- **The phase numbering (0,1,2,3a–3d,4–10) is defined nowhere in the repo, so my sequencing critique is against the hero spec's own §13 rather than the real plan. If 3a–3d already cover the harness, the surface profiles and the shared primitives, three of my inversions are moot.**
  - Mitigation: Check the phase legend into the repo (docs/PART_II_PLAN.md) with a one-line scope per phase and the block IDs each phase closes, before any code lands. Re-run this critique against it.
- **Closing all the gaps before Phase 1 would stall the work indefinitely — the gap list is longer than the spec.**
  - Mitigation: Only items 1–5 are true Phase-1 blockers (missing primitive specs, missing AmbientLayer, unscheduled Rust column, no fixture variants, no error ownership). Items 6–13 can be scheduled as named phases as long as they are named — the damage is from being unowned, not from being late.
- **Adding a settings column shifts positional indices in src-tauri/src/db/settings.rs (row.get::<_,i64>(9)) and cargo test cannot run in this Linux container, so a silent field-mapping regression would only surface in CI or on a user's machine.**
  - Mitigation: Convert db/settings.rs reads to named columns in the same PR as the new field, and require the 13-test cargo suite green in CI before the frontend consumes the setting.
- **Seven themes need an ambient concept authored from scratch with no reference plate, and the one plate that maps to Samaa contains a bird silhouette. An unowned asset task under Manhaj 1 is the highest-consequence gap here.**
  - Mitigation: Name an author and a method per theme before Phase 1. Restrict all Arabic-in-graphics to scripts/build-*.py + HarfBuzz. Add a policy file to design_refs/islamic_theme/ marking every mood_* file as excluded from derivation, and a grep/asset gate that fails if a new binary image lands outside src/assets/marks/.
- **The plan's §8.3 claims per-theme accent differentiation is a one-line change later. It is not (--ring-focus and --hair-rgb are hardcoded to --accent-gold-rgb), so the deferral may be relied on and then found impossible.**
  - Mitigation: Route --ring-focus and --hair-rgb through --hero-accent-rgb in the same phase that introduces the token, so the deferred change really is one line per theme.

## Open questions

- Where is the phase legend for 0,1,2,3a,3b,3c,3d,4,5,6,7,8,9,10? Nothing in the repo or the supplied specs defines what those phases contain, so the sequencing cannot be validated as asked.
- Who authors the ambient concept for the seven themes with no reference plate (noor, emerald, pearl, mushaf, blue, red, onyx), and by what method within Manhaj 7?
- Is Samaa's Plate B being cropped, or is its ground being regenerated? Until that is decided, one of the three supplied references cannot seed anything.
- Why are mushaf (Mushaf Night) and red (Yaqut Red) assigned the 'warm' surface profile? The brief assigns only 8 of 10 themes; the spec assigns the other two inside a code snippet with no argument. Mushaf Night's --bg-main-rgb is 5 7 6 — arguably 'pure-black'.
- What does html[data-surface='cool'] actually declare? It ships as an empty block, and the only thing it gestures at (backdrop-filter beyond .surface-3) is the highest perf risk in the scheme with no ceiling and no test.
- Does backgroundMotion persist through SQLite settings (six Rust files, positional column indices, CI-only verification) or through localStorage? The plan asserts no Rust changes; the ambient contract requires a persisted setting.
- How are the Part II perf budgets measured — idle CPU <3%, GPU memory <40MB, zero input-latency contribution, <1.5MB ambient assets? None has a proposed instrument, and Playwright alone cannot read two of them.
- Is Playwright becoming a pinned devDependency with a portable executablePath, or is the entire §11.3 assertion list a manual pre-merge check? If manual: which human runs the 40-combination sweep, and at which point in the phase plan?
- What is /player's block assignment? It is a ninth registered route (App.tsx:69), it is painted in a dead accent, it collapses the sidebar to w-0, and no block in the inventory is mapped to it.
- Is /radio's 6431px unvirtualized list in scope, deferred with a named owner, or accepted? Part II adds a 180px band above it and specifies no RailStation.
- Which of the twelve named libraries are accepted, and under what bundle-size, licence and offline-vendoring policy? Limora in particular appears to conflict directly with Manhaj 7.
- Is Inter being bundled, or is the type scale being retuned for Segoe UI? Every px in the height budget depends on the answer, and docs/DESIGN_SYSTEM.md already flags it as an open decision.
