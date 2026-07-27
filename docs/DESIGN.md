# Salafi Hub — Illuminated Manuscript Dark

The app's own DESIGN.md fingerprint, in the awesome-claude-design format so an
agent can be pointed at it cold. Family: **cinematic dark × glass/soft-futurism
× Islamic manuscript**. This file is the taste contract; `CLAUDE.md` is the
rules contract. Where they seem to conflict, `CLAUDE.md` wins.

## 1. Visual Theme & Atmosphere

A manuscript lit by one warm lamp in a dark room. The page is a study
instrument, not a poster — but it is a *cinematic* instrument: deep ground,
real light, living atmosphere, oversized headline where a headline is earned.
Media and calligraphy are the subjects; chrome floats above them as glass.

Mood: reverent, atmospheric, premium, alive-but-unhurried.

## 2. Color Palette & Roles

Everything derives from the ten theme blocks in `src/index.css`. No literal
colours in components, ever. The roles:

```
--bg-main-rgb          the canvas — each theme's own deep hue bias, never generic navy
--bg-card-rgb          raised surface step
--accent-gold-rgb      THE theme accent (legacy name; teal on noor, blue on blue…)
--mushaf-gold-rgb      ayah-medallion gold — pinned warm in EVERY theme, never the accent
--sheen-rgb/--shade-rgb light and shadow primitives (pearl inverts them)
--hair-rgb             every hairline, derived from the accent
```

Rule (Apple): **one accent per surface**, used for the primary action and the
light. Rule (ours): the second colour on any screen is the mushaf gold, and
only on ayah medallions and the jadwal.

Gradients: allowed and expected on grounds, washes, area-chart fills, and
edge lighting. **Never on text. Never on or under Qur'anic script.**

## 3. Typography Rules

- **Latin display:** `Plex Serif` (Tailwind `font-display`) — route/section
  titles and the featured headline only, weight 600.
- **Latin UI/body:** `Plex Sans` 400/500/600.
- **Arabic display:** `Aref Ruqaa` — headings only, never body.
- **Arabic UI/body:** `Plex Arabic`, line-height ≥ 1.6, **zero tracking**.
- **Mushaf:** KFGQPC per riwayah, untouched, unstyled, undecorated. The one
  exception: the ayah marker ornament may use Amiri Quran.

Scale (go bigger than instinct — sections must not whisper):
`11.5 / 13.5 / 15 / 17.5 / 21 / 27 / 37 / 50` with display headlines allowed
to `56–64px` in the hero band and featured card. Tracking tightens as size
rises, Latin only.

## 4. Component Stylings

**Glass surfaces** (`.glass`)
- Translucent theme-card fill 0.55 + `backdrop-filter: blur(18–26px)
  saturate(130–140%)` + specular rim (gradient hairline, brightest top-left).
- No hard uniform 1px borders on cards (Apple rule) — the rim IS the edge.
- Pearl: fill 0.72+, shade-based rim; glow reads as grime on light ground.

**Glow edge** (`.glow-edge`)
- Conic accent gradient masked to 1px, 0.5+ alpha at the lit corner.
- Brightens on hover/focus-within. Never pulses unprompted. Never neon hue.

**Cards / media tiles**
- Locked aspect ratios always. Hover: 3D tilt (posters 7°, featured 3°) with
  pointer-following sheen; border light answers the cursor (Runway rule:
  the edge becomes the accent on hover).
- Un-thumbnailed art is a designed panel — accent radials + khatam + noor
  mark — never a bare well.

**Buttons**
- Primary: accent fill, `--bg-main` text, radius 6, lift −1px on hover with
  soft accent bloom.
- Secondary: value step + hairline. Ghost: text only.
- Focus: two-tone ring — dark inner (`--bg-main`), accent outer halo.

**Rows** (`.rule-row` family — Radio, surah list, reminders, settings, queue)
- Hover: inset accent marker + one value step + 2px slide in the reading
  direction (logical properties; flips in RTL). 150ms, `--ease-out`.

**Sheets / modals**
- Glass material over 60% scrim, spring entry (settle, never bounce).

## 5. Layout Principles

- Density is identity: rails of real covers at locked ratios, microdata
  (duration · category · progress) on every card, no file paths ever.
- No vertical gap > 96px on any route at 1080p; empty states are designed
  panels with one action, never a lone icon in a void.
- The jadwal frames exactly two things: the mushaf page and the featured
  card. Rarity is what makes it the signature.
- The mihrab arch appears exactly once (hero). The khatam is the workhorse
  ornament (empty panels, sidebar ground, girih).

## 6. Depth & Elevation

- One key light per screen, warm, upper-left; vignette to the corners.
- Depth = value step + specular rim + (dark themes only) deep soft shadows on
  *floating* surfaces: `0 24px 64px rgb(var(--shade-rgb)/0.5)`. Anchored
  content never carries a drop shadow.
- Each dark theme has a living generated field (motes / starfield / ink /
  clouds) behind everything: tiered, token-coloured, paused on blur and video,
  clamped ≤ tier 1 on `/quran` in the resolver.

## 7. Do's and Don'ts

**Do**
- Oversize the featured headline; let calligraphy breathe at full size.
- Let each theme be a different *room* — ground hue, field, accent all move.
- Animate ornament and light. Reveal sections on scroll (`view()` timeline).
- Measure: contrast computed, gaps in pixels, screenshots as proof.

**Don't**
- Anything from `CLAUDE.md` §Manhaj — no beings, no Qur'anic styling/motion,
  no music. Non-negotiable, overrides all of the above.
- Gradient/track/animate text. Letter-space Arabic. Clip the Basmala.
- `data:` URIs in CSS (CSP has no data: source — build guard enforces).
- Second accent hue on a surface; neon; pulsing borders; light-theme glow.
- WebGL contexts (video decode competes), WASM eval, network fonts.

## 8. Responsive Behavior

Desktop-first (1280×800 → 1920×1080 primary). Rails scroll horizontally with
snap + edge fades; grids collapse column counts; the split Quran view keeps
the reading measure in `em` so word count per line survives font-size changes.
RTL is first-class: logical properties everywhere, `<bdi>` around numerals,
U+2067 for bidi wraps.

## 9. Agent Prompt Guide

Bias: deep theme-hued canvas with a living token-coloured field; glass chrome
with specular rims; one warm key light; jadwal/khatam/calligraphy as identity;
oversized Plex Serif display over quiet Plex Sans body; 3D tilt + pointer
sheen on cards; inset-marker slide hovers on rows; measured contrast.

Reject: template navy dashboards, second accents, neon, borders-as-boxes,
text effects, anything moving on or under Qur'anic script, animate beings at
any abstraction level, data: URIs, WebGL, hardcoded colour.
