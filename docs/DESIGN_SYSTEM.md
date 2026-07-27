# Design plan — Hero & Visual Identity

Status: **shipped**, as of v1.17.0–v1.21.0 (PRs #26–#31). This document was
written as a proposal and its header said so for eight releases after it stopped
being true — long enough that a fresh session could read it and conclude the hero
did not exist. It is kept as the record of *why* the visual direction is what it
is; for what the app actually does today, read `CLAUDE.md` and
`docs/VISUAL_AUDIT.md`.

Direction: *dark scholarly cinematic* — one warm light, a ruled page, content
emerging from darkness.

**Known divergence from §2 below: `Inter` is not bundled.** `src/index.css` names
it as the Latin family, but the only `@font-face` declarations in the app are
Amiri Quran, Aref Ruqaa, KFGQPC Hafs, KFGQPC Warsh and Plex Arabic. Every Latin
glyph therefore falls through to `system-ui` — Segoe UI Variable on Windows. The
table below claiming Inter is "already bundled" has never been true. Choosing the
Latin face is an open decision, not a bug to silently patch.

## 1. Tokens

Measured with a WCAG contrast script, not eyeballed (`scripts/contrast` in the
implementation commit). All ratios are against the theme's own `--base`.

| Token | mushaf (default) | maktabah | samaa |
|---|---|---|---|
| `--accent` | `#F0D296` | `#EFA163` | `#4FC3F7` |
| `--base` | `#14100C` | `#1A1410` | `#1B2836` |
| `--surface` | `#221B13` | `#2A211A` | `#28394B` |
| `--text` | `#F2EDE6` | `#F2EDE6` | `#EDF2F6` |
| `--muted` | `#867E71` | `#8E7E70` | `#7A93A3` |
| `--dim` | `#6E6558` | `#736255` | `#5C7687` |
| `--hair` | `#2E271D` | `#34251A` | `#213B4D` |

Measured ratios: text/base **16.3 / 15.7 / 13.3**, text/surface 14.6 / 13.6 / 10.5,
accent/base 13.0 / 8.6 / 7.5, muted/base **4.72 / 4.66 / 4.65** (body captions),
dim/base 3.30 / 3.13 / 3.13 (non-text and large-only).

**Deviation from the brief, deliberate:** the spec said muted = base lightened
~45% toward the accent hue. Measured, that lands at **3.45 / 2.71 / 2.67:1** and
fails WCAG AA for caption text. `--muted` is instead base→text with a 15% accent
tint, keeping the warm hue while passing 4.5:1. The 45% value survives as
`--dim`, restricted to non-text and large text only.

Scale (4px base): `--s1..s8` = 4, 8, 12, 16, 24, 36, 56, 88.
Radii: 4 / 8 / 14. Type scale (1.25): 12, 14, 16, 20, 26, 33, 41.
Line-height is per script: `--lh-latin: 1.5`, `--lh-arabic: 1.85`.
Motion: `--dur: 280ms`, `--ease: cubic-bezier(.22,1,.36,1)`; removed entirely
under `prefers-reduced-motion`, not shortened.

Onyx stays untouched as the default until you say otherwise.

## 2. Typefaces — three roles, kept separate

| Role | Face | License | Notes |
|---|---|---|---|
| Arabic display | **Aref Ruqaa** | OFL | Hero wordmark and surah band only. Never body. |
| Arabic body/UI | **IBM Plex Sans Arabic** | OFL | Replaces Segoe UI/Tahoma fallback. |
| Latin | **Inter** — *named in CSS, never bundled; falls back to `system-ui`* | OFL | See the divergence note at the top. |
| Mushaf | **KFGQPC Hafs / Warsh** | KFGQPC | Untouched, never used for UI chrome. |
| Basmala ligature | **Amiri Quran** | OFL | Stand-in until your vector arrives. |

## 3. The signature element — "the ruled page (mistara)"

Traditional manuscripts were ruled with a *mistara* before writing. So this app
has **no boxes**. Lists, toolbars, and sections are separated by 1px accent-at-12%
rules and value steps — never card borders, never drop shadows. One warm key
light per screen supplies depth instead.

The **mihrab arch** appears exactly once in the entire app: crowning the hero
calligraphy. Rarity is the point — a motif used everywhere is wallpaper.

## 4. Hero wireframe

```
┌──────────────────────────────────────────────── 64vh ──┐
│              ╭─────── arch (hairline, 12%) ───────╮    │
│   ░░ radial key light behind the calligraphy ░░        │
│                                                        │
│            ﷽   ← complete, static, never clipped       │
│                    stroke=--text · harakat=--accent    │
│                                                        │
│                    سلفي هَب                            │
│        one line: what the app is for (--muted)         │
│                                                        │
│      [ افتح المصحف ]   [ الإذاعة ]                     │
│      ⟨ تابع القراءة · سورة الكهف، الآية ١٠ ⟩            │
│  ▒▒▒▒▒▒ fade into page background ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒     │
└────────────────────────────────────────────────────────┘
  ── الأقسام ──────────────────────── ٤ أقسام ──   ← ruled
  ١  المصحف                          حفص · ورش
  ٢  الإذاعة                          بث مباشر
```

## 5. Self-critique (as requested)

Things in my first draft that any generic Islamic app would have produced, and
what replaced them:

- **Rounded glowing cards.** Replaced with the mistara rule system.
- **A geometric star pattern as wallpaper.** Kept, but pushed to 5% opacity and
  masked to the light pool so it reads as texture on a surface, not decoration.
  It is procedural SVG: **0 KB**, and cannot contain animate beings by construction.
- **A stock mosque/lantern photograph.** Dropped. The hero background is
  generated from tokens (gradient + light + girih + grain), so it costs nothing,
  never fails to load, and re-themes automatically. A bundled still can replace
  it later if you supply one.
- **Accent-coloured everything.** Rationed: the interior page carries exactly two
  UI accents (active riwayah, surah band). Ayah medallions stay gold because that
  is print mushaf convention, not UI decoration.

## 6. Section 1 compliance — every point where a decision touched the rules

| Rule | How it was resolved |
|---|---|
| No animate beings | Background is procedural geometry + light. No photography of any kind ships. |
| No crescent-as-emblem | Not used. The only motif is an 8-fold khatam and a mihrab arch. |
| Qur'an never decoration | The Basmala is the hero's subject, at full size, complete, static, never behind a control, never scrolled under chrome. |
| Never restyled | No text-shadow, no gradient fill, no letter-spacing on it. The warm glow is a **background layer behind** the glyph, never a shadow on it. Recolouring is limited to the two path groups you specified. |
| Never clipped | Verified at 1920, 1366, and a 900px-wide window — the calligraphy scales and stays whole. |
| Mushaf surface stays quiet | The reading page uses no accent surfaces, no glow, no arch, no card. Only the text, gold medallions, and hairlines. |
| Real Arabic only | Every Arabic glyph in the mockups is shaped live by a real font (Amiri Quran, Aref Ruqaa, KFGQPC). Nothing traced or generated. |
| Sourced quotes | No hadith/athar copy proposed; the hero uses only app-descriptive text. |
| No sound | No audio added anywhere. |
| Licences reachable | KFGQPC + OFL notices ship with the fonts; an About → Licences screen is part of the implementation scope. |

## 7. Open items — all resolved

Kept as a record of what unblocked implementation.

1. ~~The reference banner and three plates did not arrive.~~ **Resolved.** Three
   plates arrived (blurred mushaf volumes, cloud/sky, bookshelf wall) and map to
   the Mushaf Gold, Samaa and Maktabah themes respectively. Note for whoever
   builds ambients from them: the cloud plate as supplied appears to contain a
   bird silhouette and must be cropped or its ground regenerated — an animate
   being at 6% luminance behind glass is still an animate being.
2. ~~The Basmala vector.~~ **Resolved.** `scripts/build-basmala-svg.py` shapes the
   real font with HarfBuzz and emits outlines split by the typeface's GDEF mark
   class, so `.basmala-stroke` and `.basmala-harakat` are the font's own paths
   rather than a trace. Ships at `src/assets/marks/basmala.svg`.
3. ~~Confirmation on two new bundled fonts, and whether the three themes are
   added to Onyx or replace part of the set.~~ **Resolved.** Aref Ruqaa and Plex
   Arabic both ship. The three themes were *added*: the set is now ten, and Onyx
   is one of them rather than the default. The Latin face remains unresolved —
   see the divergence note at the top.
