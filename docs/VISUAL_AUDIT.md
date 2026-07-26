# Visual audit — research, gaps, constraints

Date: 2026-07-26. Scope: `src/index.css`, `src/pages/{Dashboard,Library,Settings,Radio,Quran}.tsx`,
`src/components/layout/*`, `src/components/dashboard/*`, `src/components/playlist/PlaylistCard.tsx`,
`src/components/radio/RadioMiniPlayer.tsx`, `tailwind.config.js`.

Read Part 1 if you want the reasoning. Read Part 2 if you want to know what to change.

---

## Part 1 — Research

### 1.1 Depth without drop shadows

The material-elevation model (a fixed z-ladder, each rung a bigger blurred shadow) was built for a
white ground. It does not survive a near-black one: a dark shadow on a dark surface has nothing to
fall on. Every serious system has moved the depth signal into *value* instead of *shadow*.

- **Material 3** replaced shadow-primary elevation with **tonal elevation**: raising a surface shifts
  its colour toward the primary tone rather than casting a shadow. In dark themes higher surfaces get
  a stronger, brighter overlay, because "the background is too dark to reliably portray dark shadows."
  M3 keeps shadow as an *option*, not the mechanism.
  ([Material 3 in Compose](https://developer.android.com/develop/ui/compose/designsystems/material3),
  [M2 dark theme](https://m2.material.io/design/color/dark-theme.html))
- **Apple** ships two full background sets in Dark Mode — **base** and **elevated**. "The base colors
  are dimmer, making background interfaces appear to recede, and the elevated colors are brighter,
  making foreground interfaces appear to advance." Separately, *materials* (translucency + blur) plus
  *vibrancy* pull colour forward from behind a surface to signal layering.
  ([HIG Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode),
  [HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials))
- **Microsoft** treats layering as a first-class concept: a **base layer** (the window, drawn in Mica,
  tinted by the desktop wallpaper, opaque, cheap) and a **content layer** above it, with contour /
  hairline strokes rather than ambient shadow doing most of the separating.
  ([Layering and elevation in Windows](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/layering),
  [Materials in Windows apps](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/materials))
- **What high-craft desktop apps actually do now** (Linear is the canonical example): a *surface
  ladder* — three or four fixed value steps — plus a **1px hairline** whose colour also steps per
  level. No ambient shadow anywhere except on genuinely transient, light-dismiss surfaces (menus,
  flyouts).
  ([Linear design notes](https://github.com/voltagent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md),
  [Atlassian elevation](https://atlassian.design/foundations/elevation))

**Where sources disagree.** Material 3 and Atlassian keep shadow in the toolkit; the Linear/hairline
school drops it entirely. This is a real disagreement, and it is resolved by ground value, not by
authority: on a #030404 ground a shadow is invisible, so the hairline + value-step model wins *here*.
That is a choice this app has already made in writing (`src/index.css:1228`) and then broken in three
places (see 2.14).

**The operative rule.** Depth = (a) a value step between stacked surfaces, (b) **one** hairline, (c)
**one** directional light per screen. A surface that has a border *and* a fill *and* a glow *and* an
inner ring is not four times as deep; it is noise. Repeated outlines are the single strongest "generic
dark dashboard" tell, because a dashboard template has no light and compensates with boxes.

### 1.2 Reading-first typography — the surface versus its chrome

The organising idea in every good reading app is that **the reading surface and the chrome obey
different rules and are allowed to look like different things.**

- Craig Mod's analysis of Kindle vs iBooks is the clearest statement of it: Kindle puts *meta*
  actions (library, bookmark) in the outer margins, away from the text, and *direct* actions (font
  size, navigation) below the text block; iBooks "lumps meta and direct elements together in a chrome
  soup." ([Embracing the Digital Book](https://craigmod.com/journal/ebooks/))
- Both Kindle and Apple Books let the reader control **margin width, measure, size, justification and
  hyphenation** — i.e. they treat measure as a user-facing typographic setting, not a layout accident.
  ([Kindle reading settings](https://www.amazon.com/gp/help/customer/display.html?nodeId=TABlJ4ot69emTO8jJG))
- **Measure.** Butterick: 45–90 characters including spaces, "two to three alphabets on a line."
  ([Line length](https://practicaltypography.com/line-length.html)) Bringhurst's widely-repeated figure
  is 45–75 for a single column; UXPin and others quote 50–75, with 66 as the conventional target.
  ([Google Fonts on measure](https://fonts.google.com/knowledge/using_type/understanding_measure_line_length),
  [UXPin](https://www.uxpin.com/studio/blog/optimal-line-length-for-readability/))
  **These disagree** — the 45–75 and 45–90 ranges are conventions restated, not measured optima. The
  safe reading is: below ~45 the eye ping-pongs, above ~90 it loses the return sweep, and *anything
  running the full width of a 1600px window is outside every published range.*
- **Leading scales with measure.** 120–145% of point size for Latin body (Butterick); the wider the
  measure the more leading it needs, to protect the return sweep.
  ([Line spacing](https://practicaltypography.com/line-spacing.html))
- **Optical sizing** is the part almost nobody implements. `opsz` is a registered OpenType axis: the
  design changes with intended size — thinner strokes and finer detail at display sizes, sturdier
  forms and looser spacing at text sizes. Browsers apply it automatically for variable fonts unless
  you set `font-optical-sizing: none`.
  ([OpenType `opsz` spec](https://learn.microsoft.com/en-us/typography/opentype/spec/dvaraxistag_opsz),
  [Pixelambacht](https://pixelambacht.nl/2021/optical-size-hidden-superpower/))
  Practical consequence for a static-instance app like this one: **you must fake it.** A 41px heading
  and a 12px caption cut from the same static font need different tracking (tighter at display,
  slightly open at caption) or the display size looks loose and the caption looks jammed.

### 1.3 Arabic and RTL typographic craft

- **Line height.** Arabic needs materially more leading than Latin because tashkeel sit above and
  below the baseline and letterforms have deep descenders. The practitioner consensus is **1.6–1.85
  for Arabic body versus 1.4–1.6 for Latin**, with headings needing 1.3–1.4 versus 1.1–1.2. Note this
  is craft consensus, not spec: **W3C ALReq describes the requirement but does not publish a number.**
  ([ALReq](https://www.w3.org/TR/alreq/),
  [Voxire](https://voxire.com/blog/arabic-rtl-typography-web-design-2026/))
- **Letter-spacing is not a legitimate operation on Arabic.** Arabic is a connected script; adding
  tracking breaks the joins between letters within a word. This is the single most common mistake made
  by designers without RTL experience.
  ([Voxire](https://voxire.com/blog/arabic-rtl-typography-web-design-2026/),
  [ALReq](https://www.w3.org/TR/alreq/))
- **Justification.** ALReq documents **six** mechanisms for changing the width of an Arabic line;
  kashida (extending the connection between joined letters) is the flexible one, but "excessive use of
  kashida results in uneven colour, and horizontal or vertical proximity of numerous kashida creates
  an unnatural colour." Browsers implement **none of them** — CSS `text-align: justify` stretches
  inter-word spaces only. So justified Arabic on the web produces the rivers that kashida exists to
  prevent. ([ALReq](https://www.w3.org/TR/alreq/), [Kashida](https://en.wikipedia.org/wiki/Kashida))
- **Size.** Arabic wants roughly **10–15% more size** than Latin for equal readability, because the
  legibility-bearing detail (dots, marks) is finer.
- **Display versus body is a hard convention in Arabic publishing, not a preference.** Naskh is the
  body script — "one of the clearest Arabic scripts... for daily publications, educational books, and
  Qur'ans." Thuluth, Diwani, Kufi are *display* scripts; Thuluth "becomes impractical when extended to
  paragraph length." For bilingual settings Naskh sits alongside Latin without competing.
  ([Khatarabic](https://khatarabic.com/Blog-Articles/arabic-calligraphy-styles.html),
  [Arabic calligraphy styles](https://nihad.me/arabic-calligraphy-styles/))
  This app already gets the *assignment* right (`src/index.css:25-48`: Aref Ruqaa display-only, Plex
  Arabic body, KFGQPC for Qur'an). What it gets wrong is enforcement — see 2.9.
- **Common web failure modes**, in order of frequency: tracking applied to a translated string;
  Tailwind-style `text-*` utilities that pin a Latin line-height onto Arabic descendants and clip the
  tashkeel; `text-align: justify` inherited from an LTR design; and font sizes below ~12px, at which
  Arabic diacritics stop resolving at all.

### 1.4 Islamic geometric ornament used with restraint

- Real girih is **strapwork built from a polygon tiling**, not a repeating texture. Lu & Steinhardt
  showed that by ~1200 CE designers had reconceived girih as tessellations of five equilateral tiles —
  decagon, pentagon, rhombus, bowtie, hexagon — each inscribed with line segments that connect
  seamlessly across tile edges, and that by the 15th century this produced near-perfect quasi-crystalline
  patterns.
  ([Science 315, 1106 (2007)](https://www.science.org/doi/10.1126/science.1135491),
  [PDF](https://peterlu.org/pdf/publications/2007/Science_315_1106_2007.pdf),
  [Girih tiles](https://en.wikipedia.org/wiki/Girih_tiles))
- The Met's framing: the patterns are generated from circle-derived constructions — star-and-polygon
  systems built on 6-, 8-, 10- and 12-fold division — and their power comes from *implied infinite
  extension*, which is why they historically fill a bounded field (a spandrel, a panel, a medallion)
  and are stopped by a border.
  ([Met, Geometric Patterns in Islamic Art](https://www.metmuseum.org/essays/geometric-patterns-in-islamic-art))

**What follows for UI, stated as rules:**

1. **A diagonal checkerboard is not Islamic geometry.** Two crossed 45° gradients produce argyle /
   harlequin — a European textile motif. There is no construction path from the girih tile set to it.
2. **Scale.** Historical girih repeats are large relative to the field they occupy — a bay, a panel.
   A 22–34px repeat tiled across a 1600px page is below the threshold at which the eye can read the
   construction, so it degrades to grain. If the star cannot be recognised as a star, it is texture,
   and texture on a dark ground reads as compression noise.
3. **Bounded, not ambient.** Ornament belongs inside a frame — a medallion, a header band, a
   cartouche. Wallpapering it behind content is the thing that turns it gaudy, because it competes
   with type across the whole field instead of marking one place.
4. **Opacity.** Below ~0.04 over a dark ground it is invisible and costs a paint layer for nothing;
   above ~0.12 it starts fighting body text. If you cannot see it, delete it; if you can see it
   everywhere, it is decoration rather than craft.

### 1.5 Windows 11 polish that web-derived UIs miss

- **Mica** is the opaque, wallpaper-tinted base-layer material, designed for long-lived window
  backgrounds and explicitly cheaper than acrylic. **Acrylic** is translucent/blurred and is reserved
  for *transient, light-dismiss* surfaces — flyouts, context menus. Mica also encodes **window focus**
  with active/inactive states.
  ([Materials](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/materials))
  A Tauri app cannot get real Mica through CSS, but it can honour the *rule*: the window base is
  opaque and quiet, and blur/translucency appears only on transient surfaces.
- **Corner radius is a two-value system, not a ladder.** 8px for top-level containers (windows,
  dialogs); 4px for in-page elements (buttons, fields).
  ([Apply rounded corners](https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/ui/apply-rounded-corners),
  [Fluent 2 Shapes](https://fluent2.microsoft.design/shapes))
  A 12–16px radius on an in-page card is bigger than the window that contains it — the giveaway that a
  UI was designed in a browser.
- **Motion.** Fluent 2 duration tiers: ultraFast 50ms, fast 100ms, normal 200ms, slow 300ms, slower
  500ms. 100ms for press feedback; 200ms for panels and card expansion; 300ms for page transitions and
  dialogs. Entering elements get slightly longer than exiting ones; larger/further-travelling elements
  get more time.
  ([Fluent 2 Motion](https://fluent2.microsoft.design/motion),
  [Motion in practice](https://learn.microsoft.com/en-us/windows/apps/design/motion/motion-in-practice),
  [NN/g on duration](https://www.nngroup.com/articles/animation-duration/))
- **Focus** on Windows is a **two-tone rectangle** — an inner light stroke and an outer dark stroke —
  precisely so it stays visible on any background including a saturated accent fill. A single-colour
  ring is a web convention and it fails on same-hue surfaces.
- **Density and affordance.** Desktop rows are tighter than web rows; hover is a *fill* change, press
  is a distinct third state (not just the hover state held), and disabled is reduced contrast rather
  than reduced opacity on the whole element.

---

## Part 2 — Gap list, ranked by visual impact per unit of work

Ranked so that #1–#5 are, together, most of the difference between "generic dark dashboard" and the
references — and are mostly *deletions*.

---

### P0 — the five things that make it read as a template

#### 2.1 `.ornate-corner` — two mismatched L-brackets on eleven surfaces

**Where.** Defined `src/index.css:1298-1319`. Applied at `src/pages/Dashboard.tsx:102`, `:156`, `:281`,
`:289`; `src/pages/Library.tsx:514`; `src/pages/Settings.tsx:366`, `:721`;
`src/components/dashboard/StatCard.tsx:13`; `src/components/dashboard/ContinueWatching.tsx:85`;
`src/components/dashboard/RecentlyAdded.tsx:100`; `src/components/playlist/PlaylistCard.tsx:118`;
`src/components/layout/Sidebar.tsx:87`.

**What is wrong.** It draws a 24px corner bracket at top-left in `accent-gold/0.45`
(`src/index.css:1310-1312`) and a *different-coloured* bracket at bottom-right in `accent-teal/0.35`
(`src/index.css:1316-1318`). Two colours, two corners, diagonally opposed, on top of the card's own
1px border.

**Why it reads as cheap.** Asymmetric corner flourishes in two hues are the visual signature of a free
Bootstrap "premium dashboard" theme. They are not an Islamic device — a cartouche or a jadwal is a
*complete* frame, not two opposite corners. Worse, `--accent-teal-rgb` is a per-theme alias: in
`red` (`src/index.css:216`) it is `229 84 92`, so on the red theme every card gets a gold bracket
top-left and a **red** bracket bottom-right. Eleven surfaces, each with a border, a fill, and two
clashing brackets, is why nothing on the Dashboard has focus.

**Fix.** Delete `.ornate-corner` from `src/index.css:1298-1319` and remove the class from all eleven
call sites. If a surface needs to feel framed, give it a *complete* hairline at one value and nothing
else. Reserve any bracket/cartouche device for exactly one place — the surah header band, which
already has one (`src/index.css:594-601`).

---

#### 2.2 Three "Islamic patterns" that are argyle at grain scale

**Where.**
- `.islamic-pattern`, `src/index.css:1290-1296` — 45°/−45° crossed gradients, 24px repeat, alphas 0.07
  and 0.055. Used at `src/components/layout/Sidebar.tsx:87`.
- `.thumbnail-fallback::before`, `src/index.css:1326-1337` — the same construction at 22px, `opacity: 0.45`,
  on every video without a thumbnail.
- `.salafi-dashboard-hero::before`, `src/index.css:1392-1403` — the same construction at 34px,
  `opacity: 0.18`, across the Dashboard's largest panel.

**What is wrong.** All three are diagonal checkerboards. Per 1.4 there is no construction path from
girih to this motif; it is harlequin. At 22–34px repeats it is below the scale at which any
construction is legible, so it renders as dither.

**Why it reads as cheap.** On a near-black ground a low-alpha 24px diagonal texture is
indistinguishable from JPEG blocking or panel noise. It makes the app look like it has a rendering
defect, and it makes the thumbnail fallback — which appears in bulk, dozens at a time in a grid — look
like broken image placeholders.

**Fix.** Delete all three. Replace the thumbnail fallback with a single centred glyph at
`--text-faint` on a flat `--bg-card`; replace the sidebar footer texture with nothing. The one
legitimate geometric construction in the codebase is `.hero-girih` (`src/index.css:1009-1018`) — an
8-point star plus two nested squares at 150px, which *is* a khatam. Keep that construction; see 2.16
for its opacity problem.

---

#### 2.3 The graph-paper grid behind every page

**Where.** `src/index.css:1213-1222`, specifically the two grid gradients at `:1218-1219` and the
`background-size: ... 42px 42px, 42px 42px, auto` at `:1221`.

**What is wrong.** Every page paints a 42px 1px-line grid at alpha 0.022/0.016 behind all content.

**Why it reads as generic.** Graph paper is the default background of analytics dashboards and
"developer tool" landing pages. It is the opposite of the reference material: a photographed room has
no ruled grid in it. On a cinematic near-black ground the grid also breaks the vignette — the eye
reads a repeating structure where the reference reads falloff into darkness.

**Fix.** Delete the two grid layers and the two `42px 42px` entries from `background-size`. If the
page needs anything at all behind content, it needs *one* directional falloff, not a lattice.

---

#### 2.4 Two heroes on the Dashboard, and a bordered box inside a bordered box inside a bordered box

**Where.** `src/pages/Dashboard.tsx:87` renders `<Hero />` (62vh, `src/index.css:875`). Then
`src/pages/Dashboard.tsx:102` renders a *second* hero — `.salafi-dashboard-hero`
(`src/index.css:1383-1403`) with its own two radial glows, its own gold border, its own inset
highlight, its own diagonal texture, and a 224×224px app-icon watermark at 8% opacity
(`src/pages/Dashboard.tsx:103-108`).

Inside that second hero: a bordered, filled `ProgressRing` box (`src/pages/Dashboard.tsx:208`), a
bordered gauge medallion (`:129`), and four `MetricTile`s each of which is
`rounded-md border border-border bg-background/45` (`src/pages/Dashboard.tsx:231`).

**What is wrong.** Four levels of border+fill nesting, plus a duplicate hero competing with the real
one. The metric tiles at `src/pages/Dashboard.tsx:231` use a border *and* a fill where a **value step
alone** would do, so eight boxes compete with the hero — and the hero is the one thing on the page
that carries the app's identity.

**Why it reads as cheap.** Per 1.1: repeated outlines are what a design does when it has no light.
The hero has a real key light (`src/index.css:902-903`, warm, at 34%/20%); nothing below it does, so
everything below it compensates with boxes. Two heroes means neither is the hero.

**Fix.**
- Delete `.salafi-dashboard-hero` (`src/index.css:1383-1403`) and its wrapper at
  `src/pages/Dashboard.tsx:102`; delete the app-icon watermark at `:103-108`.
- Turn `MetricTile` (`src/pages/Dashboard.tsx:226-238`) into a bare stat: number in
  `--text-main`, label in `--text-muted`, **no border, no fill**, separated from its neighbours by
  spacing only. Four numbers on the ground beat four boxes.
- Keep `ProgressRing` (`:200-224`) as the one figural element in the region, but drop its border and
  fill (`:208`) so it sits on the page rather than in a box, and fix its hardcoded colour (2.11).

---

#### 2.5 Two complete, contradictory design languages shipped side by side

**This is the direct cause of "the whole app style one" failing.**

**Language A — the ruled page (the intended one).** `.rule-list`, `.rule-row`, `.rule-row-active`,
`.rule-head`, `.segmented`, `.icon-btn`, `.field-quiet` at `src/index.css:766-865` and `:1163-1190`.
Its stated rule, in the file: *"Sections are separated by rules and value steps, never boxes"*
(`src/index.css:1163-1164`) and *"Active row: an inset marker and one value step — never a filled box"*
(`src/index.css:780`). Used by Radio (`src/pages/Radio.tsx:109`, `:118`, `:141`) and the Qur'an
toolbar (`src/pages/Quran.tsx:746`, `:754`).

**Language B — the premium card.** `.premium-surface`, `.premium-card`, `.premium-pill`,
`.icon-medallion`, `.brand-mark`, `.ornate-corner`, `.islamic-pattern`, `.surface-input`,
`.media-badge` at `src/index.css:1230-1416`. Used by Dashboard, Library, Settings, and every card
component.

**Consequence, concretely.** Radio's station list is hairline-ruled rows with baseline-underlined
segmented controls and a borderless search field (`src/pages/Radio.tsx:55` uses `.field-quiet`).
Library's toolbar *twelve lines of code away in spirit* is a bordered filled panel
(`src/pages/Library.tsx:360`) containing a bordered filled input (`:371`, `.surface-input`), a
bordered filled view-toggle group (`:384`), and two bordered filled `<select>` wrappers (`:401`,
`:443`). Settings wraps **every single section** in `.premium-surface .ornate-corner`
(`src/pages/Settings.tsx:721`). These are not variations of one style. They are two products.

The sidebar contradicts the app's own written rule in the same breath: `.rule-row-active` says "never
a filled box" (`src/index.css:780`), and `src/components/layout/Sidebar.tsx:73` styles the active nav
item as `border-accent-gold/25 bg-accent-gold/10 shadow-[inset_3px_0_0_...]` — a bordered, filled box
*with* the inset marker.

**Fix — pick Language A and convert.** It is the one that matches the references (a printed page:
rules and value steps, no boxes) and it is already the one the Qur'an and Radio pages use.

1. Redefine `.premium-surface` and `.premium-card` (`src/index.css:1230-1249`) as **borderless**:
   `background: rgb(var(--bg-card-rgb) / 0.5)` and nothing else. One value step, no hairline. Keep the
   hairline only on surfaces that genuinely float (the mini player).
2. Convert `SettingsSection` (`src/pages/Settings.tsx:716-728`) from a panel to a `.rule-head` title
   plus a `.rule-list` of `SettingRow`s. Settings becomes one continuous ruled page.
3. Convert Library's toolbar (`src/pages/Library.tsx:360-416`) to `.field-quiet` for search and
   `.segmented` for the grid/list toggle and the filter chips (`:423-442`, `:557-573`) — the Radio page
   already demonstrates all three.
4. Change the sidebar active state (`src/components/layout/Sidebar.tsx:73`) to
   `bg-accent-gold/[0.05]` + the inset marker, dropping the border — i.e. literally `.rule-row-active`.

This is the single largest item on this list by effort. It is also the only one that answers the
owner's actual complaint.

---

### P1 — the craft layer

#### 2.6 Three stacked background systems, two of which are invisible

**Where.**
- `body`, `src/index.css:371-374`: radial gold at top-left + radial emerald at 82%/6% + linear.
- `main` in `src/components/layout/AppShell.tsx:12`: radial teal at top-right + linear. Opaque.
- `.page-container`, `src/index.css:1215-1221`: radial gold at 88%/0% + radial emerald at 12%/18% +
  the grid + solid `--bg-main`. Opaque.

**What is wrong.** `.page-container` is opaque and fills the main area, so AppShell's gradient is never
seen; `main` is opaque and fills the shell, so `body`'s is never seen. Two of three are dead paint. The
one that survives has **two** glows, at opposite corners, which is a wash, not a key light.

**Why it matters.** The hero proves the team knows how to do this: `src/index.css:889-911` places one
warm key at 34%/20% with a long falloff and a heavy vignette, and the comment at `:884-887` states the
principle exactly right. Nothing else in the app follows it. A screen with two opposing glows has no
light direction, and no light direction is what makes a dark UI look like a dark *theme* rather than a
photographed room.

**Fix.** Delete the gradients from `body` (`src/index.css:371-374`, keep the colour) and from
`AppShell.tsx:12` (keep `bg-background`). In `.page-container`, keep **one** warm radial from the same
direction the hero lights from (upper-left, ~34%/8%) and add a vignette to the lower-right corner.
One light, one falloff, every page.

---

#### 2.7 The focus ring is invisible on the primary button

**Where.** `src/index.css:436-443` and `src/index.css:851-857`:
`outline: 2px solid rgb(var(--accent-gold-rgb) / 0.85)`.
`.btn-primary` fill: `background: rgb(var(--accent-gold-rgb))` (`src/index.css:1260`).

**What is wrong.** The focus ring is the accent gold at 85% opacity, sitting 2px outside a fill that
is the accent gold at 100%. On the app's most important button the focus indicator is the same hue as
the thing it surrounds.

**Why it reads as unpolished.** Per 1.5, Windows uses a two-tone focus rectangle precisely so it
survives on any background. A single-hue ring is a web-CSS habit.

**Fix.** Replace both rules with a two-tone ring that cannot collide:
`outline: 2px solid rgb(var(--bg-main-rgb)); outline-offset: 1px; box-shadow: 0 0 0 4px rgb(var(--accent-gold-rgb) / 0.9)`
— dark inner, accent outer, both token-derived. Verify on `pearl` (`src/index.css:133`), where
`--bg-main-rgb` is light and the polarity inverts correctly on its own.

---

#### 2.8 Motion: one 280ms duration for everything, and a page that bounces in on every route change

**Where.** `--dur: 280ms` (`src/index.css:355`) is the only duration token. Applied to hover colour on
`.rule-row` (`:1179`), `.icon-btn` (`:822`), `.segmented button` (`:803`), `.field-quiet` (`:839`),
`.premium-card` (`:1240`). Separately, `page-enter` (`src/index.css:1192-1205`) animates **every direct
child** of `.page-container` with a 180ms `translateY(6px)` fade.

**What is wrong.** 280ms for a hover tint is roughly 3× the Fluent `fast` tier (100ms) used for press
feedback; the UI feels like it is catching up with the cursor. And `page-container > *` means on the
Dashboard the hero, the header row, the metric section, ContinueWatching, RecentlyAdded and the
reminders panel all slide up in unison on every navigation.

**Why it reads as generic.** Staggered/uniform content lift-in on route change is the house style of
dashboard templates. It also makes the hero — a static, reverent object — bounce.

**Fix.** Replace the single token with the Fluent tiers, token-derived:
`--dur-fast: 100ms` (hover/press), `--dur-normal: 200ms` (panels, expansion), `--dur-slow: 300ms`
(page/dialog). Use `--dur-fast` for all hover states. Delete `page-enter` and its application at
`src/index.css:1203-1205`, or restrict it to a single opacity fade on `.page-container` itself with no
transform.

---

#### 2.9 Arabic: the leading fix covers `<p>` but not the elements Arabic actually lives in

**Where.** `src/index.css:384-391` restores `line-height: var(--lh-arabic)` (1.85) for
`p, h1, h2, h3, label, li` under `html[data-language='ar']`. `src/index.css:400-404` sets it on `body`.

**What is wrong.** The comment at `:381-383` diagnoses the problem correctly — Tailwind's `text-*`
utilities pin a Latin line-height — but the fix misses `span`, `div`, `button`, `a` and `td`, which is
where most Arabic UI text in this app actually renders. Every one of these keeps Tailwind's Latin
leading and clips tashkeel:

- `src/components/layout/Sidebar.tsx:79` — nav labels in `<span>`.
- `src/pages/Radio.tsx:161` — the LIVE badge, `<span>` at `text-[10px]`.
- `src/pages/Dashboard.tsx:119` — `<p>` is covered, but the sibling badges at `:494` (Settings) are not.
- Every `t(...)` string inside a `<button>`: `src/pages/Library.tsx:335`, `:344`; `src/pages/Settings.tsx:457`,
  `:491`; `src/components/dashboard/QuickActions.tsx:80`, `:89`.

Setting it on `body` (`:404`) does not help, because any `text-sm`/`text-xs` on a descendant re-pins
the line-height locally.

**Fix.** Replace the element list with a universal rule scoped to the language:
`html[data-language='ar'] :where(p,h1,h2,h3,h4,span,div,button,a,label,li,td,th) { line-height: var(--lh-arabic); }`
keeping the existing opt-outs at `src/index.css:393-398` for `.quran-script`, `.quran-flow`,
`.hero-basmala`, `.hero-mark`. Add a size floor: no Arabic text below 12px. Today
`src/components/layout/Sidebar.tsx:48` renders a badge at `text-[9px]` and `src/pages/Radio.tsx:161` at
`text-[10px]`; at those sizes Arabic dots and marks do not resolve at all.

---

#### 2.10 `letter-spacing` applied to translated strings — breaks Arabic joins

**Where.**
- `src/pages/Dashboard.tsx:119`: `tracking-[0.18em]` on `{t('libraryAtAGlance')}`.
- `src/pages/Radio.tsx:161`: `tracking-wider` on `{t('radioLive')}`.

**What is wrong.** Per 1.3, letter-spacing on Arabic breaks the connections between letters within a
word. `src/index.css:404` sets `letter-spacing: 0` on the Arabic body, but a Tailwind utility on the
element wins over an inherited body rule. In Arabic mode these two strings render disconnected.

**Fix.** Either drop the tracking, or gate it:
`html[data-language='ar'] :where([class*='tracking-']) { letter-spacing: 0 !important; }` in the base
layer. The `!important` is justified here — it is enforcing a script constraint against a utility
framework, and it is exactly the kind of rule that should not be re-litigated per component. Note
`.hero-wordmark-latin` (`src/index.css:1140-1144`) is correctly Latin-only and is not affected.

---

#### 2.11 Hardcoded colours that break the ten-theme guarantee

**Where.**
- `src/pages/Dashboard.tsx:215`: `shadow-[inset_0_0_0_1px_rgba(214,181,109,0.16)]`. That is the
  **default theme's** `--border-subtle-rgb` (`src/index.css:66`) baked in. On `blue`, `red`, `samaa`,
  `emerald`, `pearl` the progress ring's inner rule is the wrong hue.
- `src/components/layout/TitleBar.tsx:42`: `hover:text-white` on the window close button.
- `src/components/radio/RadioMiniPlayer.tsx:151` and `:192`: `text-white` on the play button.
- `src/pages/Settings.tsx:485`: `border-white/10` around the theme swatch strip — a white hairline on
  `pearl`'s white panel.
- `src/pages/Settings.tsx:74`: `shadow` (Tailwind default, a black drop shadow) on the toggle knob.

**Fix.** `rgb(var(--border-subtle-rgb) / 0.16)`; `text-background`; `border-border`; delete the toggle
shadow. Each is one token substitution.

---

#### 2.12 Two disagreeing radius ladders, neither of which is Windows'

**Where.** `tailwind.config.js:45-50`: `sm 6 / md 8 / lg 12 / xl 16`. `src/index.css:351`:
`--r-sm 4 / --r-md 8 / --r-lg 14`.

**What is wrong.** `rounded-sm` in a component is 6px; `var(--r-sm)` in CSS is 4px. `rounded-lg` is
12px; `--r-lg` is 14px. Both ladders are in active use — `.icon-btn` uses `--r-sm`
(`src/index.css:818`), `MetricTile` uses `rounded-md` (`src/pages/Dashboard.tsx:231`), cards use
`rounded-lg`. Per 1.5, Windows 11 is a two-value system: 8px for top-level containers, 4px for in-page
elements. A `rounded-lg` (12px) metric tile has a larger radius than the application window.

**Fix.** Collapse to two values in both places: `4px` for in-page elements (buttons, fields, rows,
tiles, badges) and `8px` for containers that read as panels (the mini player, dialogs, the hero).
Delete `xl`. Point the Tailwind tokens at the CSS variables so there is one source.

---

#### 2.13 Three different "subtle border" values from two different hues

**Where.** `--hair: rgb(var(--accent-gold-rgb) / 0.12)` (`src/index.css:347`); `--border-subtle:
rgba(214,181,109,0.14)` (`:88`, and re-declared per theme); Tailwind `border: rgb(var(--border-subtle-rgb) / 0.18)`
(`tailwind.config.js:20`).

**What is wrong.** `.premium-card` uses `--hair` at 0.12 gold; `.surface-input` uses Tailwind
`border-border` at 0.18 of `--border-subtle-rgb`, which in the `emerald` theme (`src/index.css:115`) is
**green**. So a card and the input inside it have hairlines of different hue and different weight, on
the same screen.

**Fix.** One hairline token, derived from the accent, used everywhere: make `tailwind.config.js:20-21`
point at `--hair` and a `--hair-strong`, and delete `--border-subtle` / `--border-strong` or alias
them. Per 1.1, a value ladder needs its hairline to step *with* it, not vary by hue.

---

#### 2.14 The app states "never a drop shadow" and then ships four

**Where.** The rule: `src/index.css:1228-1229` — *"Surfaces separate by a hairline and a value step —
never by a drop shadow."* The violations:
- `src/components/radio/RadioMiniPlayer.tsx:147`: `shadow-xl` on the collapsed pill.
- `src/components/radio/RadioMiniPlayer.tsx:187`: `shadow-2xl` on the expanded panel.
- `src/components/radio/RadioMiniPlayer.tsx:192`: `shadow-lg` on the play button.
- `src/components/player/VideoPlayer.tsx:359`: `shadow-panel`.

Compounding it, `tailwind.config.js:51-55` defines `subtle`, `panel` and `teal` as `0 0 0 1px` rings —
they are **not shadows at all**, they are named misleadingly, and `shadow-teal` on the hover play
button (`src/components/dashboard/ContinueWatching.tsx:148`) does nothing visible.

**Assessment.** The mini player is the app's most persistent surface and it is the one place a shadow
is arguably *correct* — it genuinely floats over content, and per 1.5 that is the acrylic/flyout case.
So the fix is not "delete all shadows", it is: state the exception. Floating, transient surfaces (mini
player, menus, dialogs) may carry one soft shadow; nothing anchored to the page may. Then rename the
three ring tokens in `tailwind.config.js:51-55` to `ring-*` so they stop pretending.

---

### P2 — the remaining tells

#### 2.15 Native `<select>` and `window.confirm()`

**Where.** Native selects: `src/pages/Library.tsx:403`, `:445`; `src/pages/Settings.tsx:561`;
`src/components/radio/RadioMiniPlayer.tsx:253`. Native confirms: `src/pages/Library.tsx:258`;
`src/pages/Settings.tsx:174`, `:198`, `:211`, `:225`.

**Why it matters more than it looks.** `confirm()` renders the WebView's own dialog — on Windows it
shows the page origin and a browser-chrome button pair. In a Tauri app with a custom title bar
(`src/components/layout/TitleBar.tsx`) it is the single loudest signal that this is a web page in a
frame. `src/index.css:417-434` does what it can for `<select>` (`color-scheme`, option colours) but the
popup list is still system-drawn and will never match.

**Fix.** A `Confirm` component reusing the existing modal treatment
(`src/components/reminders/ReminderModal.tsx:37` already has one), and a listbox built on `.rule-list`
+ `.rule-row-active` — the Qur'an toolbar's `ToolbarPanel` (`src/pages/Quran.tsx:744-761`) is already
exactly this pattern and can be lifted.

#### 2.16 The hero has six paint layers, two of which are invisible

**Where.** `src/components/home/Hero.tsx:50-54` and `:114` — ground, scene, girih, arch, scrim, fade.

- `.hero-girih` sits at `opacity: 0.05` (`src/index.css:1012`) and is masked to the centre
  (`:1016-1017`) — then `.hero-scrim` paints up to `0.46` of `--bg-main` over exactly that region
  (`src/index.css:1046-1050`). Net visibility: approximately zero.
- `.hero-arch` is bordered in `var(--hair)` = accent gold at **0.12** (`src/index.css:1029`), under the
  same scrim. Also approximately zero.

**Assessment.** Both are good ideas rendered invisible by the layer above them. Either raise the girih
to ~0.09 and the arch hairline to ~0.28 and move both **above** `.hero-scrim` in z-order, or delete
them and accept a four-layer hero. Do not leave them at a value where they cost a compositing layer
and deliver nothing.

#### 2.17 The shelf scene reads as a barcode, not a room

**Where.** `.hero-scene`, `src/index.css:923-969`.

**Plain assessment: this is the weakest of the recent changes, and the concept is right but the
execution cannot work as written.** Three stacked `repeating-linear-gradient`s at 15–30px feature
pitch under `blur(6px)`, uniform across the whole plane. Two structural reasons it will not read as a
photographed room:

1. **No perspective.** All three gradients are axis-aligned and infinite, at constant pitch across the
   full width. A real shelf wall converges — spacing compresses toward a vanishing point. Parallel
   stripes at constant pitch are read by the visual system as *pattern*, not *depth*, no matter how
   much blur is applied. This is why it looks like a striped curtain (the file's own comment at
   `:933-935` records hitting this).
2. **Uniform blur.** Real out-of-focus depth has a blur *gradient* — near-sharp at the plane of focus,
   progressively softer with distance. A single `filter: blur(6px)` across the whole element flattens
   everything to one depth, which is precisely the cue that says "CSS gradient."

**Fix, in order of cost.** (a) Cheapest real improvement: add a horizontal scale gradient — split the
scene into two or three absolutely-positioned bands with different `background-size` on the upright /
board gradients (wider pitch near the light, tighter at the far edge) and a different blur radius per
band (4px near, 9px far). That gives convergence and a blur ramp with no new assets. (b) If that still
does not land, drop `.hero-scene` entirely: `.hero-ground` (`src/index.css:889-911`) already has a
correct key light and heavy vignette, and an empty dark room with one warm light and the Basmala in it
is closer to the references than a room with unconvincing furniture. The reference plate
`design_refs/islamic_theme/02_mood_scholar_books_dark_blur.jpg` says the owner wants the shelves — so
try (a) before (b).

#### 2.18 The jadwal has rounded corners

**Where.** `src/index.css:554-572`. `.quran-reading-surface::before` at `border-radius: 6px` (`:561`),
`::after` at `4px` (`:571`).

**What is wrong.** A printed mushaf's jadwal is a **square-cornered** rectangular frame — a heavier
outer rule and a fine inner rule set close together at the page margin. Rounded corners on a double
rule do not read as a jadwal; they read as a web card with a doubled border, which is the exact thing
the change was trying to escape.

Secondary: `.quran-reading-surface` sets `isolation: isolate` (`:538`) *and* a background gradient
(`:545-549`), and then draws the frame at `z-index: -2` (`:557`). A negative-z child inside an isolated
stacking context paints behind the element's own background. It survives only because that background
is a low-alpha gradient. That is fragile — any future opaque background on the surface silently erases
the jadwal.

**Fix.** `border-radius: 0` on both pseudo-elements; widen the outer rule's inset slightly and thin the
gap between them (a jadwal's two rules sit close). Move the frame to `z-index: 0` with the content
raised, rather than relying on negative-z under an isolated background.

#### 2.19 Justified Arabic with an added word-space

**Where.** `.quran-flow`, `src/index.css:625-630`: `text-align: justify` + `word-spacing: 0.05em`.
Also `.quran-ayah-line`, `src/index.css:634-643`.

**What is wrong.** Per 1.3, browsers implement none of Arabic's six line-width mechanisms; CSS
justification stretches inter-word spaces only. On a 33em measure with long Arabic words this produces
rivers — the "uneven colour" ALReq warns kashida exists to prevent. `word-spacing: 0.05em` makes it
worse by widening the baseline gap *before* justification stretches it further.

**Assessment and fix.** This is a genuine trade-off, not a clear error: a mushaf page *is* justified,
and `text-align-last: center` (`:627`) is the right ending. But CSS cannot deliver the mechanism that
makes justified Arabic work. Recommend: drop `word-spacing` to `0` (so justification starts from the
font's own designed space), and consider `text-align: start` with `text-align-last: start` for the
ayah-list mode where lines are short and rivers are worst. Leave the mushaf-flow mode justified — the
long measure hides it — and revisit if `text-justify: inter-character` or CSS kashida support lands.

#### 2.20 The spacing and type scales exist and are almost entirely unused

**Where.** `--s1`…`--s8` (`src/index.css:349-350`) and `--fs-cap`…`--fs-3xl` (`:352-353`).

**What is wrong.** Grep the pages and you find `p-3`, `p-4`, `p-5`, `gap-2`, `gap-3`, `gap-4`, `gap-5`,
`mb-2`, `mb-3`, `mb-4`, `mb-5`, `mb-6`, `mt-1`, `mt-2`, `mt-3`, `mt-8`, `py-1.5`, `py-2`, `py-2.5`,
`py-3` — chosen ad hoc per component. Type is the same: `text-3xl`, `text-2xl`, `text-lg`, `text-sm`,
`text-xs`, `text-[11px]`, `text-[10px]`, `text-[9px]`
(`src/components/layout/Sidebar.tsx:48`). The scales in `index.css` are used by roughly the hero and
the shared primitives and nothing else.

**Why it reads as generic.** Inconsistent rhythm is what separates a designed page from an assembled
one, and it is invisible individually but obvious in aggregate — which is exactly how "I don't like it
but I can't say why" feedback is generated.

**Fix.** Map the Tailwind spacing and fontSize scales in `tailwind.config.js` onto the CSS variables so
the utilities *are* the scale, then delete the arbitrary `text-[9px]` / `text-[10px]` / `text-[11px]`
values. Set a floor of 12px on any text and 13px on any Arabic text.

#### 2.21 No reading measure outside the Qur'an page

**Where.** `.content-max-width` → `max-w-content` = **1600px** (`tailwind.config.js:43`,
`src/index.css:1224-1226`).

**What is wrong.** Per 1.2, every published measure range tops out around 75–90 characters. Body copy
in Settings (`src/pages/Settings.tsx:738` descriptions), Library and the Dashboard runs the full
1600px. `.quran-flow` correctly constrains to 33em (`src/index.css:625`) and `.hero-purpose` to 46ch
(`:1149`) — nothing else does.

**Fix.** Add a `--measure: 68ch` token and apply it to every paragraph-level element outside a grid.
Grids and tables may use the full width; prose may not.

#### 2.22 Five button vocabularies

**Where.** `.btn-primary` / `.btn-secondary` / `.btn-ghost` (`src/index.css:1258-1287`); `ActionButton`
(`src/pages/Settings.tsx:859-872`, its own `rounded-lg border bg-elevated-panel`); `FilterChip`
(`src/pages/Library.tsx:561-573`); `ViewButton` (`src/pages/Library.tsx:543-555`); the theme picker
buttons (`src/pages/Settings.tsx:479-497`); the language buttons (`src/pages/Settings.tsx:452-460`).

Separately, `.btn-secondary` (`src/index.css:1270-1275`) fills with a **vertical gradient** — a bevel
cue that reads as 2011 web chrome and directly contradicts the flat, light-driven model in 1.1.

**Fix.** Flatten `.btn-secondary` to a single value step with a hairline. Delete `ActionButton`'s
bespoke styling and use `.btn-secondary`. Convert `FilterChip` and `ViewButton` to `.segmented`
(`src/index.css:787-809`) — which is already the right component and is already used by Radio.

#### 2.23 `premium` as a name, and a "PREMIUM LIBRARY COMMAND" badge

**Where.** The class family `.premium-surface` / `.premium-card` / `.premium-pill`
(`src/index.css:1230-1256`), and the rendered string at `src/pages/Dashboard.tsx:91-93`.

Small, but: a local, private, offline Islamic library rendering a marketing badge that says PREMIUM
LIBRARY COMMAND above its own name is tonally wrong for an app whose reference material is reverent.
Rename the classes to `surface` / `card` / `tag` when 2.5 rewrites them anyway, and cut the badge.

#### 2.24 Dead CSS

`src/index.css:487-490` targets an escaped Tailwind arbitrary class
`.shadow-\[inset_3px_0_0_rgba\(15\2c 185\2c 177\2c 0\.85\)\]` that no longer exists — the sidebar moved
to a token version at `src/components/layout/Sidebar.tsx:73`. The RTL flip still works via the
`nav a[aria-current='page']` selector on the same rule, so this is cosmetic, but delete the escaped
selector.

---

## Part 3 — Do not do

### Hard constraints (violating any of these is a defect, not a preference)

1. **No depiction of animate beings anywhere.** No illustrations, no icons of people or animals, no
   photographic backgrounds that could contain either, no stock imagery, no avatars, no mascot. This
   also rules out AI-generated background art, which cannot be audited for what it contains. The
   current hero is procedural specifically so this is guaranteed by construction
   (`src/index.css:869-870`, `src/components/home/Hero.tsx:20-23`) — keep that property. Note that
   `design_refs/islamic_theme/` contains files named `*_mood_*` showing figures and riders; those are
   mood references for *lighting and tone only* and must never be used as assets.
2. **Qur'anic text is never decorated, restyled, clipped, or placed behind a control.** No text-shadow,
   no gradient fill, no synthesised weight, no letter-spacing, no `text-transform`, no truncation, no
   `overflow: hidden` on a container that can clip it, no hover transform, no word broken across lines.
   The existing guards at `src/index.css:507-520` (`font-synthesis: none`, `letter-spacing: 0`,
   `overflow-wrap: normal`, `hyphens: none`) and the `border: none` requirement at
   `src/index.css:537-541` are load-bearing — do not "tidy" them.
   The recitation cue must stay *behind* the glyphs (`z-index: -1`, `src/index.css:716`) and must never
   cover tashkeel; the current low-plate treatment (`:725-727`) is correct.
   The ayah medallion is an **ornament**, not Qur'anic text, and is the only element permitted to use a
   different face (`src/index.css:663-677`) — do not extend that exception to anything else.
3. **No music.** No audio-reactive visuals, no waveform decoration, no equaliser bars, no "now playing"
   visualiser. The `animate-pulse` dot at `src/pages/Radio.tsx:162` is a status indicator and is fine;
   anything that visualises the audio signal itself is not.
4. **Every colour token-derived.** No hex literals, no `rgba()` literals, no `text-white` /
   `bg-black` / `border-white` in components. Ten themes must recolour with **zero** per-theme
   component code. The existing per-theme override `html[data-theme='pearl'] .hero-scene`
   (`src/index.css:971-1000`) is already a violation of the spirit of this rule — it is a whole
   duplicated background for one theme. When 2.17 is reworked, fix it by deriving the scene from
   `--bg-*` and `--text-main` with a single `color-mix()` or alpha strategy that works in both
   polarities, rather than adding an eleventh copy.
5. **The Basmala is the subject, not decoration.** Complete, static, full size, never clipped, never
   animated, never behind a control, never a background element, never given a glow or shadow on the
   glyph itself. `src/components/home/Hero.tsx:56-64` and `src/index.css:1081-1114` get this right.

### Dated / wrong per the research above

6. **Do not add drop shadows to anchored surfaces** to create depth. They are invisible on a near-black
   ground and they contradict 1.1. The only legitimate shadow is on a genuinely floating, transient
   surface.
7. **Do not use glassmorphism / `backdrop-filter` blur as a general surface treatment.** Per 1.5,
   translucency is reserved for transient light-dismiss surfaces. It is already correctly limited to
   the mini player and modals; do not extend it to cards, the sidebar, or the toolbar.
8. **Do not add neon glows, gradient text, or gradient borders.** All three are 2020-era dark-dashboard
   signatures and all three fight a warm single-key scene.
9. **Do not raise pattern opacity to "make the Islamic identity clearer."** Per 1.4 the failure mode of
   ornament is ambient repetition, not insufficient opacity. Identity comes from the calligraphy, the
   light, and the ruled page — not from wallpaper.
10. **Do not add a second accent colour.** Ten themes each already carry `--accent-gold`,
    `--accent-teal`, `--accent-emerald`, `--accent-blue`, `--accent-turquoise`. Most screens should use
    exactly one plus the neutrals. The two-hue `.ornate-corner` (2.1) is what happens otherwise.
11. **Do not use `text-transform: uppercase` on anything that gets translated.** It is meaningless in
    Arabic and, combined with tracking, produces the artefacts in 2.10. `src/pages/Dashboard.tsx:119`
    is the current instance.
12. **Do not put animation on the hero, the Basmala, or the reading surface.** Motion belongs on
    interaction feedback and on transient surfaces entering/leaving.
13. **Do not reintroduce the ۞ ornaments at sub-em sizes.** The comment at `src/index.css:574-576`
    records why they were removed (illegible specks); the cartouche that replaced them is correct.

---

## Part 4 — What is already good, and must not be touched

1. **The token architecture.** `src/index.css:60-335` — every theme declares the complete variable set,
   and `src/index.css:340-356` derives the semantic tokens from it. This is the right structure and it
   is why most of the fixes above are one-line substitutions. Do not restructure it.
2. **The Qur'anic text guards.** `src/index.css:507-520`, `:537-541`, `:645-654`, `:698-734`. Every
   one of these has a stated reason and the reasons are correct. The `border: none` requirement on
   `.quran-reading-surface` (`:537-541`) in particular is a correctness constraint on the recitation
   cue's coordinate system, not a style choice — do not add a border there.
3. **The two-tone Basmala.** `src/components/home/Hero.tsx:59-64`, `src/index.css:1081-1114`, and
   `tailwind.config.js:6-10` (the safelist that keeps the group classes from being purged). Outlining
   the font's own paths and splitting them by the typeface's GDEF mark class is genuinely correct
   craft: nothing is traced or redrawn, and colouring harakat separately is what a printed mushaf does.
   This is the best thing in the codebase. Do not touch it, and do not let a future purge config drop
   the safelist.
4. **The `نور` mark's restraint.** `src/index.css:1116-1122` — `clamp(38px, 3.4vw, 58px)`, with the
   comment explaining it is a signature and not a second headline. Exactly right.
5. **The hero's key light and vignette.** `src/index.css:889-911`. Off-centre, high, warm, long
   falloff, heavy vignette — this is the only part of the app that matches the references, and the
   fix in 2.6 is to propagate it, not to change it.
6. **The shared ruled primitives.** `src/index.css:766-865` and `:1163-1190`. `.rule-row`,
   `.rule-row-active`, `.segmented`, `.field-quiet`, `.icon-btn` are the correct vocabulary, correctly
   token-derived, with correct reduced-motion handling. 2.5 asks for *more* of these, not fewer.
7. **The measure in `em` on the Qur'an page.** `src/index.css:619-630` — setting the measure in `em` so
   it stays a constant word-count per line at every reader font size is a printed-page behaviour that
   almost no web reader implements, and the comment correctly notes it leaves the recitation index
   untouched.
8. **`prefers-reduced-motion` coverage.** `src/index.css:752-764`, `:859-865`, `:1002-1006`,
   `:1186-1190`, `:1207-1211`. Consistently handled. Keep it as motion tokens change in 2.8.
9. **The RTL layout handling.** `src/index.css:469-490` plus the `ps-*`/`pe-*`/`ms-*`/`me-*` logical
   properties used throughout the pages, and the `<bdi>` wrapping of numerals
   (`src/pages/Radio.tsx:112`, `src/components/dashboard/ContinueWatching.tsx:101`). This is done
   properly and is easy to break — do not replace logical properties with `left`/`right`.
10. **The mushaf-gold token.** `src/index.css:80-82` — pinning the ayah medallion to warm gold in every
    theme, even where the UI accent is blue or bronze, is the correct call and matches print
    convention. Do not "fix" it to follow the accent.

---

## Suggested order of work

Deletions first — they are cheap, they are safe, and together they are most of the visual change:

| # | Item | Effort | Impact |
|---|---|---|---|
| 1 | 2.1 delete `.ornate-corner` + 11 call sites | XS | High |
| 2 | 2.2 delete the three checkerboards | XS | High |
| 3 | 2.3 delete the 42px grid | XS | High |
| 4 | 2.4 delete the second hero, flatten metric tiles | S | High |
| 5 | 2.6 one background, one light direction | S | High |
| 6 | 2.7 two-tone focus ring | XS | Medium |
| 7 | 2.11 hardcoded colours → tokens | XS | Medium (correctness) |
| 8 | 2.10 tracking on translated strings | XS | Medium (correctness) |
| 9 | 2.9 Arabic leading coverage | S | Medium (correctness) |
| 10 | 2.8 motion tiers, drop `page-enter` | S | Medium |
| 11 | 2.12 / 2.13 radii + hairline unification | S | Medium |
| 12 | 2.5 collapse the two design languages | **L** | **Highest** |
| 13 | 2.22 button vocabulary → 3 variants | M | Medium |
| 14 | 2.15 replace `confirm()` and `<select>` | M | Medium |
| 15 | 2.18 / 2.19 jadwal corners, justification | S | Low-Medium |
| 16 | 2.17 hero scene perspective + blur ramp | M | Medium (risky) |
| 17 | 2.20 / 2.21 scales and measure | M | Low individually, high in aggregate |

Item 12 is the one that answers "the whole app style one". Items 1–5 are what make the owner stop
seeing a dashboard. Do 1–5 first so 12 is being done against a quieter page.
