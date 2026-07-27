# Seed Contract and Token Layer Redesign

## 0. What the current layer actually is (measured, not assumed)

Read: `/home/user/salafi-video-hub/src/index.css` lines 59–589, `/home/user/salafi-video-hub/tailwind.config.js`.

Three facts change the shape of the fix:

**(a) Five of the six hand-written composed values are dead code.** Grepping every consumer of `var(--…)` across `src/**` (css, ts, tsx, svg) and `tailwind.config.js`:

| composed value | consumers |
|---|---|
| `--border-subtle` | **1** — `src/index.css:2173`, `.thumbnail-fallback-quiet .icon-medallion { border-color }` |
| `--border-strong` | 0 |
| `--teal-glass` | 0 |
| `--gold-glass` | 0 |
| `--surface-wash` | 0 |
| `--card-wash` | 0 |

So the 72 `rgba()` literals inside `html[data-theme]` blocks are 8 per block × 9 blocks (`surface-wash` and `card-wash` carry two each), and **60 of them paint nothing**. This is not a refactor with a migration risk; it is a deletion with one rename.

**(b) `--border-subtle-rgb` has zero consumers** — 10 declarations, never read. It is the only per-theme var that is pure dead weight.

**(c) The spacing scale is not in use.** `var(--s1)`=0, `--s2`=1, `--s3`=2, `--s4`=2, `--s5`=1, `--s6`=3, `--s7`=0, `--s8`=0 — nine uses total against 160 arbitrary Tailwind px classes. Retuning `--s6/7/8` costs three call sites. The radius tokens *are* live, through Tailwind: `rounded-md` 25, `rounded-lg` 18, `rounded-xl` 9, `rounded-sm` 2 — retuning the token values propagates for free.

**(d) The material system is sound and stays.** `--sheen`/`--shade`, `--fill-1/2/3`, `--fill-well`, `--elev-1/2/3/press`, `--edge-1/2/3`, `--wash-*`, four motion tiers, eight type steps with per-step tracking zeroed under `html[data-language='ar']`. `color-mix(in srgb, …)` already ships in five places. None of that is torn out; it is re-pointed at new inputs.

---

## 1. The seed set

Nine seeds. **Five are mandatory**, four have `:root` defaults so a theme may omit them. Every other token in the app derives.

```css
@layer base {
  /* ── Typed numeric seeds ────────────────────────────────────────────────
     Registered so a unit typo degrades to the initial value instead of
     poisoning the cascade. `--seed-lift: 2.6px` in an untyped world makes
     calc(var(--seed-lift) * 1%) invalid-at-computed-value-time, which takes
     the ENTIRE surface ladder down to `unset` — every card goes transparent
     and the theme looks broken in a way that reads as a layout bug. */
  @property --seed-lift     { syntax: '<number>'; inherits: true; initial-value: 2.8; }
  @property --seed-chroma   { syntax: '<number>'; inherits: true; initial-value: 1; }
  @property --seed-ink-fade { syntax: '<number>'; inherits: true; initial-value: 48; }
  @property --seed-tier     { syntax: '<integer>'; inherits: true; initial-value: 2; }
}
```

| # | seed | type | required | what it is |
|---|---|---|---|---|
| 1 | `--seed-canvas` | `<r g b>` triplet | **yes** | the ground; the page behind everything |
| 2 | `--seed-ink` | `<r g b>` triplet | **yes** | text at full strength; also *what light is* on dark grounds |
| 3 | `--seed-accent` | `<r g b>` triplet | **yes** | **the** accent. Exactly one. |
| 4 | `--seed-ambient` | `<r g b>` triplet | **yes** | the field colour `<AmbientLayer />` paints at every tier |
| 5 | `--seed-lift` | `<number>` (percent, unitless) | **yes** | size of one surface step, as a % of canvas→sheen |
| 6 | `--seed-chroma` | `<number>` 0–1 | no (`1`) | accent-saturation multiplier **in chrome only** |
| 7 | `--seed-ink-fade` | `<number>` (percent) | no (`48`) | how far `--text-tertiary` falls toward canvas |
| 8 | `--seed-tier` | `<integer>` 0–3 | no (`2`) | theme's default ambient fidelity tier |
| 9 | `--seed-gold` | `<r g b>` triplet | no (`224 190 116`) | mushaf medallion gold. Declared by the **light profile**, not by themes. |

The triplet form on 1–4 and 9 is deliberate and load-bearing: it is the only form Tailwind's `<alpha-value>` slot accepts, so `rgb(var(--seed-accent) / <alpha-value>)` keeps `border-accent/30`-style utilities working across the 130 existing accent call sites. Everything derived is a *colour*, not a triplet, and deliberately loses `<alpha-value>` — see §9.

### 1.1 Fate of today's 22–25 per-theme vars

| today | fate |
|---|---|
| `--bg-main-rgb` | **SEED** → `--seed-canvas` |
| `--text-main-rgb` | **SEED** → `--seed-ink` |
| `--accent-gold-rgb` | **SEED** → `--seed-accent`, and retuned per theme (§6) |
| `--bg-sidebar-rgb` | derived → `--bg-chrome` |
| `--bg-panel-rgb` | derived → `--surface-1` |
| `--bg-card-rgb` | derived → `--surface-2` |
| `--bg-card-hover-rgb` | derived → `--surface-3` |
| `--text-soft-rgb` | derived → `--text-secondary` |
| `--text-muted-rgb` | derived → `--text-tertiary` |
| `--text-faint-rgb` | derived → `--text-disabled` |
| `--border-subtle` (composed) | derived (§3) |
| `--border-strong` (composed) | derived (§3) |
| `--accent-teal-rgb` | **deleted** — 0 component uses. Its value survives as the *chosen accent* on noor/emerald/pearl/mushaf. |
| `--accent-turquoise-rgb` | **deleted** — 0 uses. Superseded by derived `--accent-hover`. |
| `--accent-emerald-rgb` | **deleted** — 0 uses. |
| `--accent-blue-rgb` | **deleted** — 0 uses. |
| `--border-subtle-rgb` | **deleted** — 0 consumers, 10 declarations. |
| `--teal-glass`, `--gold-glass`, `--surface-wash`, `--card-wash` | **deleted** — dead (§0a). |
| `--quran-green-rgb` | leaves the theme block; global constant + one light-profile override |
| `--mushaf-gold-rgb`, `--sheen-rgb`, `--shade-rgb` (Pearl-only) | move to the `light` **profile** |
| `--danger/--warning/--success` | stay global, retuned (§6.4), light-profile overrides |
| *(new)* | `--seed-ambient`, `--seed-lift`, `--seed-chroma`, `--seed-ink-fade`, `--seed-tier` |

Per-theme declaration surface: **315 lines → ~90**. `rgba()` literals in theme blocks: **72 → 0**.

---

## 2. The four surface profiles

A profile is an **attribute**, not per-theme CSS: four blocks total, never ten. The same code that writes `data-theme` writes `data-surface` from a single map (§10).

```css
:root {                                 /* neutral defaults; `cool` and `warm` build on these */
  --sheen:       rgb(var(--seed-ink));
  --shade:       rgb(0 0 0);
  --tint:        0%;                    /* accent bled into the surface climb */
  --chrome-dir:  var(--sheen);          /* which way chrome steps off the canvas */
  --elev-scale:  1;                     /* multiplies every drop-shadow alpha */
  --glass-a:     0.66;
  --glass-blur:  16px;
  --radius-bump: 0;                     /* 0 = 4/6/10/14, 1 = 6/10/14/20 */
  --accent-fg:   var(--bg-canvas);
  --chroma:      var(--seed-chroma);
}

html[data-surface='cool'] {
  --tint: 14%;                          /* surfaces climb toward the accent hue */
  --glass-a: 0.72;
  --glass-blur: 22px;                   /* backdrop-filter more prominent */
}

html[data-surface='warm'] {
  --tint: 10%;
  --radius-bump: 1;                     /* radii +1 step, as a rung, not +4px */
}

html[data-surface='pure-black'] {
  --tint: 0%;
  --elev-scale: 0;                      /* NO drop shadows. Inset sheen survives. */
  --chroma: calc(var(--seed-chroma) * 0.5);   /* accent restraint doubled */
  --glass-a: 0.78;
}

html[data-surface='light'] {
  --sheen: rgb(255 255 255);
  --shade: rgb(15 26 38);               /* cool ink, not the near-white ground */
  --tint: 6%;
  --chrome-dir: var(--shade);           /* chrome RECEDES from a light canvas */
  --elev-scale: 0.35;                   /* shadow ~0; borders lead the hierarchy */
  --glass-a: 0.82;
  --accent-fg: var(--sheen);
  --seed-gold: 138 102 32;              /* medallion bronze that holds on paper */
  --seed-quran: 14 122 75;
  --lift-1: 50%;  --lift-2: 100%;       /* white is the ceiling; s3 = s2 */
  --surface-3: var(--surface-2);
  --border-lead: 1;
}
```

### 2.1 Assignment

| profile | themes | why |
|---|---|---|
| `light` | **pearl** | only light ground in the app |
| `pure-black` | **onyx**, **mushaf** | ground at or near `#000`; a drop shadow is invisible by definition, so it is cost with no benefit |
| `warm` | **emerald**, **red**, **mushaf-gold**, **maktabah** | warm surface tint, radii one rung larger |
| `cool` | **noor**, **blue**, **samaa** | cooler surfaces, higher glass opacity, backdrop-filter prominent |

Note `mushaf` (Mushaf Night, ground `#050706`) sits in `pure-black` for the shadow rule, not because it is literally `#000`.

---

## 3. The derived semantic token layer

Written against the Part I §6 contract names. This is the whole layer; nothing else is authored.

```css
:root {
  /* ── Grounds ──────────────────────────────────────────────────────────── */
  --bg-canvas:  rgb(var(--seed-canvas));
  --bg-ambient: rgb(var(--seed-ambient));

  /* The colour surfaces climb toward. On a dark ground that is the ink,
     bled with the accent by --tint so the ladder carries the theme's hue
     instead of greying out. On Pearl the light profile makes it pure white. */
  --sheen-mixed: color-mix(in srgb, rgb(var(--seed-accent)) var(--tint), var(--sheen));

  --lift-1: calc(var(--seed-lift) * 1%);
  --lift-2: calc(var(--seed-lift) * 2.4%);
  --lift-3: calc(var(--seed-lift) * 4%);

  --bg-chrome: color-mix(in srgb, var(--chrome-dir) calc(var(--seed-lift) * 0.6%), var(--bg-canvas));
  --surface-1: color-mix(in srgb, var(--sheen-mixed) var(--lift-1), var(--bg-canvas));
  --surface-2: color-mix(in srgb, var(--sheen-mixed) var(--lift-2), var(--bg-canvas));
  --surface-3: color-mix(in srgb, var(--sheen-mixed) var(--lift-3), var(--bg-canvas));
  --surface-glass: rgb(from var(--surface-2) r g b / var(--glass-a));

  /* ── Accent ───────────────────────────────────────────────────────────── */
  --accent: rgb(var(--seed-accent));

  /* The chrome hue. oklch relative-color is the ONLY correct operation here:
     it scales chroma at constant lightness and hue. color-mix toward a grey
     drags lightness with it, so Onyx's restrained gold would also go dim and
     the hairline would disappear rather than calm down. */
  --accent-chroma: oklch(from var(--accent) l calc(c * var(--chroma)) h);

  /* Perceptually-uniform, polarity-correct. --lift-dir is +1 on dark grounds
     and -1 on light: a "brighter on hover" that literally brightens is wrong
     on Pearl, where hover must go darker to read as a response. */
  --lift-dir: 1;
  --accent-hover:   oklch(from var(--accent) calc(l + 0.06 * var(--lift-dir)) c h);
  --accent-pressed: oklch(from var(--accent) calc(l - 0.07 * var(--lift-dir)) c h);
  --accent-fg:      var(--bg-canvas);            /* light profile overrides to --sheen */
  --accent-muted:   rgb(from var(--accent-chroma) r g b / 0.14);

  /* ── Borders ──────────────────────────────────────────────────────────── */
  /* One hue for every edge in the app, taken from the restrained accent.
     Alphas are MEASURED, not chosen: see §7.4. */
  --border-subtle:  rgb(from var(--accent-chroma) r g b / 0.09);  /* decoration only */
  --border-default: rgb(from var(--accent-chroma) r g b / 0.16);  /* structure */
  --border-strong:  rgb(from var(--accent-chroma) r g b / 0.30);  /* emphasis */
  --border-state:   rgb(from var(--accent) r g b / 0.72);         /* conveys state; 3:1 */

  /* ── Text ─────────────────────────────────────────────────────────────── */
  --text-primary:   rgb(var(--seed-ink));
  --text-secondary: color-mix(in srgb, var(--bg-canvas) calc(var(--sec-fade) * 1%), var(--text-primary));
  --text-tertiary:  color-mix(in srgb, var(--bg-canvas) calc(var(--seed-ink-fade) * 1%), var(--text-primary));
  --text-disabled:  color-mix(in srgb, var(--bg-canvas) calc((var(--seed-ink-fade) + 18) * 1%), var(--text-primary));
  --sec-fade: 13;                                 /* light profile: 17 */

  /* ── Focus ────────────────────────────────────────────────────────────── */
  /* Two-tone, per Windows: a ground-coloured inner stroke and an accent outer
     one, so the ring survives on a surface of its own hue — a single accent
     ring is invisible on the accent-filled primary button. */
  --focus-ring: 0 0 0 2px var(--bg-canvas), 0 0 0 4px var(--accent);
  --ring-focus: var(--focus-ring);                /* legacy alias; 2 call sites */

  /* ── Status ───────────────────────────────────────────────────────────── */
  --success: rgb(var(--seed-success));
  --warning: rgb(var(--seed-warning));
  --danger:  rgb(var(--seed-danger));
  --success-muted: rgb(from var(--success) r g b / 0.14);
  --warning-muted: rgb(from var(--warning) r g b / 0.14);
  --danger-muted:  rgb(from var(--danger)  r g b / 0.14);

  /* ── Scrim ────────────────────────────────────────────────────────────── */
  /* rgb(from …) and NOT color-mix(…, transparent): --shade may already carry
     an alpha, and color-mix would SCALE that alpha where we mean to REPLACE it. */
  --scrim: rgb(from var(--shade) r g b / 0.62);

  /* ── Non-negotiables that are not the accent ──────────────────────────── */
  /* Print-mushaf convention: the ayah medallion stays warm gold in EVERY
     theme, even where the UI accent is blue or ruby. It is not the accent and
     must never be "fixed" to follow it. */
  --mushaf-gold: rgb(var(--seed-gold));
  --quran-green: rgb(var(--seed-quran));
}
```

### 3.1 `color-mix()` vs relative-color-syntax — where each, and why

| operation | function | reason |
|---|---|---|
| surface ladder, text ladder, sheen tint | `color-mix(in srgb, A p%, B)` | mixing two *different* colours. Also matches the five `color-mix(in srgb, …)` calls already shipping in `--fill-1/2/3/well`, so one interpolation model app-wide. |
| applying alpha to a derived colour (`--border-*`, `--accent-muted`, `--*-muted`) | `rgb(from X r g b / a)` | states the intent (change alpha only). `color-mix(…, transparent)` reads as a lightening operation and is routinely mis-written as one. |
| `--scrim` | `rgb(from …)` **required** | `--shade` may be translucent; `color-mix` scales an existing alpha, `rgb(from)` replaces it. Only one of those is correct. |
| chroma restraint (`--accent-chroma`) | `oklch(from X l calc(c * k) h)` **required** | the only way to desaturate at constant lightness. `color-mix` toward grey moves L and would dim Onyx's hairline out of existence. |
| hover / pressed | `oklch(from X calc(l ± Δ) c h)` | perceptually uniform, hue-stable, and one sign token flips it for the light theme. An sRGB mix toward white shifts hue on saturated reds and cyans. |

**Interpolation space is load-bearing.** Every ratio in §7 was computed with the same channel-space lerp Chromium performs for `in srgb`. Changing any `--surface-*` or `--text-*` mix to `in oklab` voids the whole table. Comment it at the site.

**Compatibility.** `color-mix()` = Chrome 111, relative color syntax = Chrome 119, `oklch(from …)` = Chrome 119. WebView2 evergreen (Tauri v2's default runtime) is well past both. Guard the two `oklch(from)` tokens for fixed-version WebView2 deployments:

```css
@supports not (color: oklch(from red l c h)) {
  :root {
    --accent-chroma:  var(--accent);
    --accent-hover:   color-mix(in srgb, var(--sheen) 12%, var(--accent));
    --accent-pressed: color-mix(in srgb, var(--shade) 12%, var(--accent));
  }
}
```
Consequence of the fallback: Onyx loses chroma restraint. Acceptable and visible-only-if-it-happens.

---

## 4. The six composed values collapse

| today (72 rgba literals across 9 theme blocks) | replacement | net |
|---|---|---|
| `--border-subtle` — 10 hand-written rgba, alphas 0.13–0.17 | `rgb(from var(--accent-chroma) r g b / 0.09)` | one derivation. The 4-point alpha spread across themes was below the perceptual threshold and cost 10 declarations. |
| `--border-strong` — 10 rgba, alphas 0.31–0.38 | `rgb(from var(--accent-chroma) r g b / 0.30)` | one derivation. **Zero consumers today** — it is being re-introduced as a live token, not preserved. |
| `--teal-glass` — 10 rgba | **deleted.** Intent (accent-tinted translucent fill) is served by `--accent-muted` and the existing `--wash-btn`. | −10 |
| `--gold-glass` — 10 rgba | **deleted.** Same. | −10 |
| `--surface-wash` — 10 gradients, 20 rgba | **deleted.** Superseded by `--fill-1`, which already derives from `color-mix` and already handles both polarities through `--sheen`. | −20 |
| `--card-wash` — 10 gradients, 20 rgba | **deleted.** Superseded by `--fill-2`. | −20 |

**72 → 0.** Two live derivations replace two of the six; four are removed outright. Exactly **one** call site needs a rename: `src/index.css:2173`, `.thumbnail-fallback-quiet .icon-medallion { border-color: var(--border-subtle) }` → `var(--border-default)` (that rule wants structure, not decoration).

Additionally `--hair-rgb` / `--hair-faint` / `--hair` / `--hair-strong` fold into `--border-subtle/default/strong`. `--edge-1/2/3` and `--wash-*` re-point from `rgb(var(--hair-rgb) / a)` and `rgb(var(--accent-gold-rgb) / a)` to `rgb(from var(--accent-chroma) r g b / a)` — a mechanical sweep of 75 occurrences in `index.css`, values unchanged.

---

## 5. The accent problem

### 5.1 Diagnosis

Each theme declares five accent seeds; the app renders one. Component usage: `accent-gold` 130, `accent-teal` 0, `accent-emerald` 0, `accent-turquoise` 0, `accent-blue` 1. `--hair-rgb: var(--accent-gold-rgb)`, so every hairline, every `--edge-*`, every `--wash-*`, the scrollbar thumb, and the focus outline are all gold too. `blue` and `red` both resolve `--accent-gold-rgb` to the byte-identical `226 197 122` — **Sakinah Blue and Yaqut Red are the same theme with a different ground.** Eight of ten resolve gold.

### 5.2 Fix

1. **One accent seed per theme.** `--seed-accent`. The other four are deleted, not renamed — a second accent seed is what let the app render the wrong one for a year.
2. **The accent is chosen to be the theme's name.** Sakinah Blue is blue; Yaqut Red is ruby; Noor Teal is teal.
3. **Hover/pressed derive**, so no theme can ship a hover that is a different hue from its accent.
4. **`--mushaf-gold` is a separate axis and stays warm gold in all ten themes.** It is print convention. Do not follow the accent. Do not "fix" it.
5. **Restraint is a scalar, not a colour.** Onyx keeps its royal gold at `--seed-accent` (used at full strength for the handful of genuine accent moments) but sets `--seed-chroma: 0.34`, and the `pure-black` profile halves that again to `0.17`. The chrome hue resolves to `#CBC0A6` — a warm near-neutral. Since chrome (borders, edges, washes, fills, scrollbar) is where >97% of accent-touched pixels live, this is what delivers "gold under 3% of pixels", and it is one number, not a per-theme stylesheet.

### 5.3 The ten accents

`--seed-canvas` is also retuned on one theme; see the Samaa note.

| theme | name | `--seed-accent` | hex | canvas | lift | profile | chroma | ink-fade |
|---|---|---|---|---|---|---|---|---|
| `noor` | Noor Teal | `41 196 180` | `#29C4B4` | `#030404` | 2.6 | cool | 1.00 | 48 |
| `emerald` | Emerald Majlis | `63 203 124` | `#3FCB7C` | `#050D0A` | 2.8 | warm | 1.00 | 48 |
| `pearl` | Pearl Scholar | `14 111 104` | `#0E6F68` | `#F3F6F7` | 2.6 | light | 1.00 | 38 |
| `mushaf` | Mushaf Night | `155 201 74` | `#9BC94A` | `#050706` | 2.9 | pure-black | 0.90 | 48 |
| `blue` | Sakinah Blue | `94 157 247` | `#5E9DF7` | `#040912` | 2.7 | cool | 1.00 | 48 |
| `red` | Yaqut Red | `231 94 112` | `#E75E70` | `#0E0506` | 2.8 | warm | 1.00 | 48 |
| `onyx` | Onyx Black | `224 188 106` | `#E0BC6A` | `#020203` | 3.4 | pure-black | **0.34** | 48 |
| `mushaf-gold` | Mushaf Gold | `239 209 153` | `#EFD199` | `#14100C` | 3.2 | warm | 0.85 | 44 |
| `maktabah` | Maktabah | `239 161 99` | `#EFA163` | `#1A1410` | 3.4 | warm | 0.90 | 42 |
| `samaa` | Samaa | `108 201 240` | `#6CC9F0` | `#101A24` | 3.4 | cool | 1.00 | 42 |

Plate mapping holds: Mushaf Gold takes Plate A's warm gold harakat, Samaa takes Plate B's pale blue, Maktabah takes Plate C's warm amber. (Plate B's bird must be cropped or the ground regenerated before any asset derives from it — that constraint is unaffected by this layer.)

**Samaa's canvas moves `#1B2836 → #101A24`.** Its old ground was the lightest in the app and it failed WCAG in four separate columns (see §7.3). The plate colour is not lost — it moves to `--seed-ambient: 27 40 54`, which is where `<AmbientLayer />` paints it. The theme still reads as night sky; the *text ground* no longer has to.

### 5.4 Global status seeds, retuned

Today's `--danger: 239 68 68` measures **3.18:1** on Samaa's surface-2 — a fail hiding inside a theme's ground choice.

| token | dark seed | light-profile seed |
|---|---|---|
| `--seed-success` | `47 203 147` `#2FCB93` | `4 120 87` `#047857` |
| `--seed-warning` | `224 192 120` `#E0C078` | `126 92 28` `#7E5C1C` |
| `--seed-danger` | `244 102 106` `#F4666A` | `180 35 24` `#B42318` |
| `--seed-quran` | `82 199 124` `#52C77C` | `14 122 75` `#0E7A4B` |
| `--seed-gold` | `224 190 116` `#E0BE74` | `138 102 32` `#8A6620` |

---

## 6. WCAG — measured, not eyeballed

Method: sRGB → linear (`c ≤ 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`) → relative luminance (`0.2126R + 0.7152G + 0.0722B`) → `(L₁+0.05)/(L₂+0.05)`. Surfaces are the *derived* values from §3, mixed in the same sRGB channel space Chromium uses for `color-mix(in srgb, …)`. Script: `/tmp/claude-0/-home-user-salafi-video-hub/6d3f654a-3527-5c86-8c51-d4d4728d0c92/scratchpad/final.mjs` (scratchpad, not the repo).

### 6.1 Derived surface ladder

| theme | canvas | chrome | surface-1 | surface-2 | surface-3 | ambient |
|---|---|---|---|---|---|---|
| noor | `#030404` | `#060808` | `#090A0A` | `#101313` | `#191D1D` | `#04100F` |
| emerald | `#050D0A` | `#09110E` | `#0B1310` | `#141D19` | `#1E2723` | `#07170F` |
| pearl | `#F3F6F7` | `#EFF3F4` | `#F9FBFB` | `#FFFFFF` | `#FFFFFF` | `#E8EEEF` |
| mushaf | `#050706` | `#090B0A` | `#0C0E0D` | `#161816` | `#212321` | `#080D07` |
| blue | `#040912` | `#070D16` | `#0A0F18` | `#121821` | `#1B212B` | `#061428` |
| red | `#0E0506` | `#12090A` | `#150B0C` | `#1E1415` | `#281E1F` | `#1A0709` |
| onyx | `#020203` | `#070708` | `#0A0A0B` | `#161617` | `#232324` | `#070707` |
| mushaf-gold | `#14100C` | `#181410` | `#1B1713` | `#25211C` | `#302C27` | `#241B12` |
| maktabah | `#1A1410` | `#1E1814` | `#211B17` | `#2C2520` | `#37302B` | `#2A1E14` |
| samaa | `#101A24` | `#141E28` | `#17212B` | `#212B35` | `#2C3740` | `#1B2836` |

Pearl's `--surface-3 = --surface-2` is not a bug: white is the ceiling, so the third elevation is expressed by `--elev-3` + `--border-*`, which is exactly what `border-led hierarchy` means. Hover on Pearl is `--wash-hover`, which is accent-derived and therefore polarity-correct.

### 6.2 Accent — every value, against its own canvas and against surface-2

Body text 4.5:1, large text / non-text 3:1.

| theme | accent | /canvas | /surface-1 | **/surface-2** | /surface-3 | `--accent-fg` on accent |
|---|---|---|---|---|---|---|
| noor | `#29C4B4` | 9.43 | 9.11 | **8.58** | 7.81 | 9.43 |
| emerald | `#3FCB7C` | 9.40 | 9.01 | **8.24** | 7.33 | 9.40 |
| **pearl** | `#0E6F68` | **5.54** | 5.79 | **6.01** | 6.01 | 6.01 |
| mushaf | `#9BC94A` | 10.44 | 10.00 | **9.22** | 8.17 | 10.44 |
| blue | `#5E9DF7` | 7.26 | 6.98 | **6.49** | 5.88 | 7.26 |
| red | `#E75E70` | 5.98 | 5.74 | **5.35** | 4.81 | 5.98 |
| onyx | `#E0BC6A` | 11.43 | 10.90 | **9.96** | 8.65 | 11.43 |
| mushaf-gold | `#EFD199` | 12.85 | 12.09 | **10.85** | 9.40 | 12.85 |
| maktabah | `#EFA163` | 8.64 | 8.06 | **7.14** | 6.14 | 8.64 |
| samaa | `#6CC9F0` | 9.41 | 8.73 | **7.70** | 6.51 | 9.41 |

**Every value ≥ 4.5:1 on every rung.** Pearl, the likeliest to fail, is the tightest at 5.54 against canvas — a 23% margin over AA body text, and it clears AAA large text (4.5) too.

### 6.3 Text ladder, medallion gold, status

| theme | pri/cv | pri/s2 | sec/cv | sec/s2 | ter/cv | **ter/s2** | gold/cv | gold/s2 | succ/s2 | warn/s2 | dang/s2 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| noor | 19.32 | 17.57 | 14.39 | 13.09 | 5.40 | **4.92** | 11.52 | 10.48 | 8.97 | 10.65 | 6.18 |
| emerald | 18.66 | 16.35 | 14.05 | 12.31 | 5.44 | **4.76** | 11.03 | 9.67 | 8.27 | 9.82 | 5.70 |
| pearl | 16.33 | 17.74 | 9.91 | 10.77 | 4.85 | **5.27** | 4.83 | 5.25 | 5.48 | 6.11 | 6.57 |
| mushaf | 18.87 | 16.68 | 14.19 | 12.53 | 5.35 | **4.73** | 11.34 | 10.02 | 8.57 | 10.18 | 5.91 |
| blue | 18.21 | 16.27 | 13.66 | 12.21 | 5.30 | **4.74** | 11.19 | 10.00 | 8.56 | 10.17 | 5.90 |
| red | 18.52 | 16.56 | 13.89 | 12.43 | 5.30 | **4.74** | 11.30 | 10.11 | 8.65 | 10.27 | 5.96 |
| onyx | 19.36 | 16.88 | 14.42 | 12.57 | 5.33 | **4.65** | 11.64 | 10.15 | 8.68 | 10.32 | 5.99 |
| mushaf-gold | 16.26 | 13.73 | 12.36 | 10.44 | 5.66 | **4.78** | 10.63 | 8.98 | 7.68 | 9.12 | 5.30 |
| maktabah | 15.66 | 12.95 | 12.01 | 9.93 | 5.91 | **4.89** | 10.24 | 8.46 | 7.24 | 8.60 | 4.99 |
| samaa | 15.59 | 12.75 | 11.98 | 9.80 | 5.95 | **4.86** | 9.86 | 8.06 | 6.90 | 8.20 | 4.76 |

`--text-disabled` runs 2.43–3.19:1 and is deliberately below AA. It is exempt under SC 1.4.3 (inactive components) and must **never** be used for readable copy. Enforce by name, not by discipline: it is `--text-disabled`, not `--text-quaternary`.

### 6.4 What the measurement found (defects in today's shipped values)

1. **Pearl's medallion gold `#9E7628` measures 3.81:1 on canvas / 4.14:1 on white — it fails AA.** The current comment at `src/index.css:150-155` says it was already darkened once for exactly this reason; it was not darkened enough. `#8A6620` → 4.83 / 5.25.
2. **Pearl's `--quran-green: 16 138 87` (`#108A57`) measures 4.03 / 4.38 — fails.** `#0E7A4B` → 4.95 / 5.38.
3. **`--danger: 239 68 68` fails on Samaa's surface-2 at 3.18:1.**
4. **A hairline cannot carry state.** Measured alpha needed for 3:1 against surface-2: red 66%, pearl 66%, blue 58%, samaa 50%, noor 51%. So `--border-subtle` (0.09) and `--border-default` (0.16) resolve to ~1.2–1.5:1 and are **decoration only** — legitimate under 1.4.11, which does not govern purely decorative boundaries. Anything that conveys state (selected row, active tab, checked toggle, error field) must use `--border-state` at 0.72, or the solid `--accent`. This is the single most likely place to regress silently.
5. **Rejected candidates, recorded so they are not re-proposed:**
   - Yaqut: `#C41E3A` (true ruby pigment) = 3.45 / 3.05 — fail. `#D32F45` = 4.09 / 3.62 — fail. `#E03A52` = 4.69 / 4.16 — fails on surface-2. `#E75E70` is the most saturated red that clears 4.5:1 on all four rungs. A darker ruby is not available on a `#0E0506` ground; a lit ruby is what survives.
   - Pearl medallion `#AF7B2D` (today's `--accent-gold-rgb`) = 3.40 — fail.

---

## 7. Scales reconciled

### 7.1 Spacing — Part I's top end wins, today's bottom end wins (they already agree)

| step | today | Part I | ships |
|---|---|---|---|
| `--s1` | 4 | 4 | **4** |
| `--s2` | 8 | 8 | **8** |
| `--s3` | 12 | 12 | **12** |
| `--s4` | 16 | 16 | **16** |
| `--s5` | 24 | 24 | **24** |
| `--s6` | 36 | 32 | **32** |
| `--s7` | 56 | 48 | **48** |
| `--s8` | 88 | 64 | **64** |
| `--s9` | — | 96 | **96** (new) |

Steps 1–5 are already identical; nothing moves. The top three change because:
- They carry **layout** gutters and section rhythm. 36 and 56 do not divide the 1600px `max-w-content` into whole-pixel gutters at 3- and 4-column; 32/48/64/96 do.
- The audit's 160 arbitrary px classes are mostly large one-offs. 32/48/64/96 are Tailwind's own `p-8/p-12/p-16/p-24`, so the scale absorbs them. 36/56/88 are reachable by no default utility, which is *why* the scale went unused.
- Migration cost is **three call sites** (`--s6` ×3; `--s7` and `--s8` have zero uses).

### 7.2 Radius — today's ladder wins; Part I's 28 is rejected

| rung | today | Part I | ships (`--radius-bump: 0`) | `--radius-bump: 1` (warm) |
|---|---|---|---|---|
| `--r-sm` | 4 | 6 | **4** | 6 |
| `--r-md` | 6 | 10 | **6** | 10 |
| `--r-lg` | 10 | 14 | **10** | 14 |
| `--r-xl` | 14 | 20 | **14** | 20 |
| `--r-2xl` | — | 28 | **20** (new, hero/sheet only) | 20 |
| `--r-full` | — | full | **9999px** (new, pills) | 9999px |

Today's `md/lg/xl` = 6/10/14 *are* Part I's first three rungs; the disagreement is only the entry point and the extension. The reasoning is already in the repo at `tailwind.config.js:71-76` — Windows 11 is a two-value radius system, and a 16px radius inside an 8px window corner is the tell that a desktop UI was designed in a browser. The app draws its own frame (`decorations:false` + `TitleBar.tsx`) but it is still a Windows window with an 8px system corner. **28px is a phone idiom and is rejected outright.** `--r-2xl` caps at 20.

This is also what makes "warm themes get radii +1 step" a real token operation rather than an arbitrary `+4px`: `--radius-bump` selects the next *rung*, so the two ladders stay commensurable.

### 7.3 Elevation — kept, made profile-aware

`--elev-1/2/3/press` and `--fill-1/2/3/well` stay exactly as authored. One change: every drop-shadow alpha multiplies by `--elev-scale`.

```css
--elev-2:
  inset 0 1px 0 rgb(from var(--sheen) r g b / 0.055),
  0 1px 2px -1px  rgb(from var(--shade) r g b / calc(0.24 * var(--elev-scale))),
  0 10px 24px -16px rgb(from var(--shade) r g b / calc(0.55 * var(--elev-scale)));
```
`--elev-scale: 0` on `pure-black` removes both drop shadows and keeps the inset sheen — which is the only part that was ever doing work on a `#020203` ground. `0.35` on `light` is the "shadow opacity ~0, borders lead" rule. `--ring-focus` becomes an alias of `--focus-ring` (2 call sites).

### 7.4 Motion — unchanged, one addition

`--dur-press: 90ms`, `--dur-fast: 140ms`, `--dur-normal: 200ms`, `--dur-slow: 300ms`, `--ease-out`, `--ease-standard`, `--ease-spring`, and the legacy `--dur`/`--ease` aliases all stay. Fluent's tiers are correct and the `prefers-reduced-motion` coverage already exists.

One addition, so nobody reaches for `--dur-slow` for ambient drift:

```css
--dur-ambient: 44s;
--ease-ambient: linear;
```

Deliberately an order of magnitude outside the interaction tiers. Under `prefers-reduced-motion` the ambient layer forces Tier 0 rather than shortening `--dur-ambient` — the existing convention in this file is *remove*, not *shorten*.

---

## 8. Tailwind config shape

The pivotal constraint: `color-mix()` returns a **colour**, not a triplet, so a derived token cannot feed Tailwind's `<alpha-value>` slot. The split:

```js
colors: {
  // Seeds keep the triplet form — the ONLY reason is <alpha-value>. The 130
  // existing accent call sites include `border-accent/30`-style utilities.
  accent:  'rgb(var(--seed-accent) / <alpha-value>)',
  canvas:  'rgb(var(--seed-canvas) / <alpha-value>)',
  ink:     'rgb(var(--seed-ink) / <alpha-value>)',

  // Derived tokens are plain colours and deliberately lose <alpha-value>.
  // Nobody should be writing bg-surface-2/40 — a translucent surface is
  // --surface-glass, and a scrim is --scrim.
  ambient:        'var(--bg-ambient)',
  chrome:         'var(--bg-chrome)',
  'surface-1':    'var(--surface-1)',
  'surface-2':    'var(--surface-2)',
  'surface-3':    'var(--surface-3)',
  'surface-glass':'var(--surface-glass)',
  'accent-hover': 'var(--accent-hover)',
  'accent-press': 'var(--accent-pressed)',
  'accent-fg':    'var(--accent-fg)',
  'accent-muted': 'var(--accent-muted)',
  border:         'var(--border-default)',
  'border-subtle':'var(--border-subtle)',
  'border-strong':'var(--border-strong)',
  'border-state': 'var(--border-state)',
  'text-primary':  'var(--text-primary)',
  'text-secondary':'var(--text-secondary)',
  'text-tertiary': 'var(--text-tertiary)',
  'text-disabled': 'var(--text-disabled)',
  success:'var(--success)', warning:'var(--warning)', danger:'var(--danger)',
  'success-muted':'var(--success-muted)',
  'warning-muted':'var(--warning-muted)',
  'danger-muted': 'var(--danger-muted)',
  'mushaf-gold':  'var(--mushaf-gold)',
  'quran-green':  'var(--quran-green)',
},
borderRadius: { sm:'var(--r-sm)', md:'var(--r-md)', lg:'var(--r-lg)',
                xl:'var(--r-xl)', '2xl':'var(--r-2xl)', full:'var(--r-full)' },
boxShadow:    { 'elev-1':'var(--elev-1)', 'elev-2':'var(--elev-2)',
                'elev-3':'var(--elev-3)', press:'var(--elev-press)',
                'ring-focus':'var(--focus-ring)' },
```

**`./src/assets/marks/*.svg` stays in `content`** — the fill classes on the inlined marks appear nowhere else and are purged without it. The `sans` stack drops `'Inter'` (named at `src/index.css:613`, never bundled; `docs/DESIGN_SYSTEM.md:46` is wrong) and leads with `system-ui`, which is what actually renders today. `boxShadow.subtle/panel/teal` — the misnamed 0-0-0-1px "shadows" — are removed; they were aliases onto the real ladder and their names are why the ladder was misused.

The renames `primary-blue` → `accent`, `elevated-panel` → `surface-2`, `panel-hover` → `surface-3`, `muted-text` → `text-tertiary`, `text-soft` → `text-secondary`, `text-faint` → `text-disabled`, `danger-red` → `danger`, `success-green` → `success`, `warning-orange` → `warning` are a mechanical codemod across 198 occurrences in 31 files.

---

## 9. Proving the eleven-line diff

Three one-time refactors are prerequisites, and without them the claim is false — state them, do them first:

1. `src/themes.ts` becomes the single registry: `id`, `profile`, `en`/`ar` label + description, swatches.
2. `AppTheme` derives from it (`typeof THEMES[number]['id']`), so `src/types/index.ts` never changes again.
3. `src/store/settingsStore.ts:151` validates against the registry instead of a hardcoded array, and `src/i18n.ts:1065` `themeOptions` reads it instead of duplicating it. The 30 hex literals in `themeOptions.swatches` — the audit's only real hex in TS — move to the registry beside the seeds they mirror.

With those in place, theme eleven is **exactly eleven added lines**:

```diff
--- a/src/index.css
+++ b/src/index.css
@@ -373,6 +373,14 @@
   }
 
+  html[data-theme='sidrah'] {
+    --seed-canvas:  8 14 9;
+    --seed-ink:     240 246 240;
+    --seed-accent:  126 200 122;
+    --seed-ambient: 10 22 12;
+    --seed-lift:    2.8;
+  }
+
   /* ── Derived tokens ─────────────────────────────────────────────────────

--- a/src/themes.ts
+++ b/src/themes.ts
@@ -49,4 +49,7 @@ export const THEMES = [
   { id: 'samaa', profile: 'cool', swatch: ['#101A24', '#6CC9F0'],
     en: ['Samaa', 'Night sky with clear cyan.'],
     ar: ['السماء', 'سماء الليل بلون سماوي صافٍ.'] },
+  { id: 'sidrah', profile: 'warm', swatch: ['#080E09', '#7EC87A'],
+    en: ['Sidrah', 'Olive green under a soft lamp.'],
+    ar: ['سدرة', 'أخضر زيتوني تحت مصباح هادئ.'] },
 ] as const satisfies readonly ThemeDef[];
```

That is 7 CSS lines + 4 TS lines = **11**. It buys, with zero further edits: the whole surface ladder, the whole text ladder, both border ladders, hover/pressed/fg/muted, focus ring, glass, scrim, elevation, hairlines, edge gradients, interaction washes, ambient field colour, ambient default tier, the settings swatch, both languages, `AppTheme` union membership, and settings-store validation. Four seeds are omitted and inherit their `:root` defaults; the `warm` profile supplies the tint, the radius bump and the glass values.

The Arabic strings need **U+2067 (RLI)** wrapping at the render site, not in the registry — U+2066 reverses them, which is how `formatDuration` shipped `1س 0د` as `1د0 س`.

---

## 10. Verification, and how this is enforced

Add `scripts/harness/tokens.mjs`, alongside the existing `shoot.mjs`/`probe.mjs`/`stub-tauri.js`/`fixtures.mjs`. It serves `dist`, launches `/opt/pw-browsers/chromium`, and for each of the ten `data-theme` values reads the **computed** value of every token via `getComputedStyle`, parses it, and asserts:

1. `--accent`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--mushaf-gold`, `--success`, `--warning`, `--danger` each ≥ 4.5:1 against `--bg-canvas` **and** `--surface-2`. Fails the build otherwise.
2. `--border-state` ≥ 3:1 against `--surface-2`.
3. `--accent-fg` ≥ 4.5:1 against `--accent`.
4. No two themes resolve `--accent` to the same value (the `blue`/`red` bug, caught mechanically).
5. `--surface-1 < --surface-2 < --surface-3` in relative luminance on the eight non-light, non-Pearl themes — the Pearl ladder-inversion bug, generalised.
6. In the Quran route, the resolved ambient tier is 0 or 1 in **all ten themes**.

This is the Phase 0 harness pattern, not a new toolchain: `npm run build && node scripts/harness/tokens.mjs`. `cargo test` is unaffected and still cannot run in this Linux container (gdk-3.0 missing).

**Do not touch** `src/db/video.rs` (`VIDEO_COLUMNS`), the Quran data layer, word timings, audio matching, the updater keys/pubkey/signing config, or the five version sites. None of them are in this layer's blast radius.

### Migration order

1. Registry refactor (`src/themes.ts`, `AppTheme`, `settingsStore`, `themeOptions`) — no visual change.
2. `data-surface` written alongside `data-theme` from the registry — no visual change.
3. Add the seed + derived layer under the existing tokens, aliasing old names to new (`--bg-card: var(--surface-2)` etc.) — no visual change, and every existing component keeps working.
4. Delete the four dead composed values and `--border-subtle-rgb`; rename the one live `--border-subtle` call site at `src/index.css:2173`.
5. Sweep `--hair-rgb` / `--accent-gold-rgb` → `--accent-chroma` / `--accent` inside `index.css` (75 occurrences, values unchanged).
6. Codemod the Tailwind colour names across 198 occurrences in 31 files.
7. Delete the aliases and the nine old theme blocks.
8. Retune the seeds to §5.3 — **this is the only step with a visible diff**, and it is the step the sweep of 5 themes × 2 languages exists to check.


## Risks

- **`oklch(from …)` (relative color syntax, Chrome 119+) is required for `--accent-chroma`, `--accent-hover` and `--accent-pressed`. A fixed-version WebView2 runtime older than Edge 119 would drop those three declarations, and because they are consumed by `--border-*`, `--edge-*` and every wash, the failure cascades into the whole chrome layer rather than degrading locally.**
  - Mitigation: Ship the `@supports not (color: oklch(from red l c h))` block given in §3.1, which redefines the three tokens with `color-mix(in srgb, …)`. The only loss is Onyx's chroma restraint. Add an assertion to `scripts/harness/tokens.mjs` that `--accent-chroma` resolves to a parseable colour in all ten themes, so a future WebView2 pin surfaces as a test failure and not as a black-bordered app.
- **Moving derived tokens off the triplet form removes Tailwind's `<alpha-value>` for surfaces, text and borders. Any existing class of the form `bg-elevated-panel/60` or `text-muted-text/70` silently produces an invalid colour and Tailwind emits nothing — the element falls back to inherited or transparent, which reads as a layout bug rather than a colour bug.**
  - Mitigation: Grep for `/[0-9]` opacity modifiers on the nine renamed colour names before the codemod and enumerate them; the audit's own numbers say there are 198 total occurrences across 31 files, so this is an enumerable set, not a search. Where a translucent surface is genuinely wanted, the replacement is `--surface-glass` or `--scrim`. Keep `accent`, `canvas` and `ink` on the triplet form precisely so the 130 accent call sites need no such review.
- **The WCAG table in §6 is computed against `color-mix(in srgb, …)`. Changing any surface or text mix to `in oklab` — which looks like a strict improvement and is a natural later 'cleanup' — silently invalidates every ratio, and the affected tokens are exactly the ones nobody re-measures.**
  - Mitigation: Comment the interpolation space at each mix site as load-bearing and add it to the CLAUDE.md invariant index. `scripts/harness/tokens.mjs` re-measures the resolved computed values rather than the authored formulas, so an interpolation-space change that breaks a threshold fails the build regardless of how it was introduced.
- **`--border-subtle` (0.09) and `--border-default` (0.16) resolve to 1.2–1.5:1 against surface-2. They are correct as decoration, but the measured alpha needed for the 3:1 non-text threshold is 50–66% depending on theme. A developer reaching for `border-border-strong` (0.30, ~1.5–2.2:1) to mark a selected row or a checked toggle produces a state that is invisible to low-vision users and passes every visual review.**
  - Mitigation: Name the token for its job: `--border-state` at 0.72 exists solely for boundaries that convey state, and `--border-strong` is documented as emphasis-only. Assert `--border-state` ≥ 3:1 against `--surface-2` in the harness. Where a state boundary sits on a surface of the accent's own hue, use the solid `--accent` rather than any alpha.
- **Samaa's canvas moves `#1B2836 → #101A24`. That is the one seed change in this spec that alters a theme's identity rather than its correctness, and the owner sampled that value from Plate B.**
  - Mitigation: The plate colour is preserved exactly, as `--seed-ambient: 27 40 54` — it moves from the text ground to the ambient field, which is where a cloud-sky colour belongs and where `<AmbientLayer />` will actually paint it. Render Samaa at Tier 0, 1 and 2 side by side before and after and put both in front of the owner; if the darker ground is rejected, the fallback is to keep `#1B2836` and accept `--danger` at 4.33:1 on that one theme, recorded as a documented exception rather than an unnoticed fail.
- **`--seed-lift` and the other numeric seeds are consumed through `calc(var(--seed-lift) * 1%)`. A theme author writing `2.8px` or `2.8%` makes the declaration invalid at computed-value time, taking every `--surface-*` down at once.**
  - Mitigation: The `@property` registrations in §1 give each numeric seed a `<number>` syntax and an initial value, so a malformed declaration degrades to the default instead of cascading. Ordering matters: the `@property` rules must appear before the first theme block in `src/index.css`.

## Open questions

- Yaqut Red: `#E75E70` is the most saturated red that clears 4.5:1 on all four surface rungs over a `#0E0506` ground; a true ruby pigment `#C41E3A` measures 3.45:1 and is not available. Does the owner accept a lit ruby, or should Yaqut's canvas be lightened (which would let the accent go deeper) — and does that break the theme's identity?
- Samaa's canvas move from `#1B2836` to `#101A24` (§5.3): confirm with the owner that carrying Plate B's colour in `--seed-ambient` rather than in the text ground is acceptable, since that value was sampled directly from the plate.
- Onyx `--seed-chroma: 0.34`, halved again by the `pure-black` profile to 0.17, resolves the chrome hue to `#CBC0A6` — a warm near-neutral. Is that the intended reading of 'gold under 3% of pixels', or should the accent itself also be pulled back and the 3% budget be spent entirely on the medallion and the focus ring?
- `--r-2xl` caps at 20px and Part I's 28px is rejected on the Windows two-value-radius argument. Confirm no Part II block (HeroAmbient, SheetSettings, PlayerExpanded) is specified with a 28px corner, since those are the surfaces most likely to want one.
- The registry refactor (§9, prerequisites 1–3) makes `AppTheme` a derived type. Confirm nothing in `src-tauri` or the persisted settings JSON round-trips a theme id in a way that a `satisfies readonly ThemeDef[]` narrowing would break — settingsStore.ts:151 currently validates against a literal array and falls back to 'noor'.
- Should `--seed-tier` (theme default ambient tier) live in the CSS seed block, where it is a `<integer>` custom property readable by `<AmbientLayer />` via `getComputedStyle`, or in the TS registry, where it is a plain field? CSS keeps the eleven-line diff intact and keeps every per-theme value in one place; TS avoids a layout-read on mount.
