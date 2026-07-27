# Per-Theme Catalog: ten themes, four surface profiles, one structure

## 0. The reduction, stated once

Today a theme is a 24-line block in `src/index.css` that declares five accent seeds, five ground steps, four text steps and **six hand-composed values** (`--border-subtle`, `--border-strong`, `--teal-glass`, `--gold-glass`, `--surface-wash`, `--card-wash`). Ten of those blocks × 6 composed values = the 72 `rgba()` literals the Phase 0 audit counted inside `html[data-theme]`.

I read every one of those six through the whole tree:

```
--border-subtle   1 use   (src/index.css:2173, .thumbnail-fallback-quiet .icon-medallion)
--border-strong   0 uses
--teal-glass      0 uses
--gold-glass      0 uses
--surface-wash    0 uses
--card-wash       0 uses
--border-subtle-rgb  0 uses   (declared in all 10 themes)
```

**Five of the six, plus one seed, are dead.** Deleting them removes ~60 of the 72 in-theme `rgba()` literals with zero render change. The one live use is rewritten to `rgb(var(--hair-rgb) / var(--hair-a))`.

After that deletion a theme block contains **only colour seeds**. Everything that is *material* — glass, hairline weight, shadow, radius, tint, ambient ceiling — moves into **four** profile blocks. That is the whole answer to "ten themes must not become ten design systems": after this change there are exactly 10 colour declarations and exactly 4 material declarations, and no component or page file contains a per-theme branch.

I also verified the two things that would break this: `var(--r-*)` is used only in `border-radius` (`index.css:1235`, `:1424`) and nowhere in padding/inset, so the warm profile's radius bump cannot move a box; and no theme block declares a non-colour property today.

---

## 1. The corrected seed contract

### 1.1 Five accent seeds → two

`--accent-teal-rgb`, `--accent-turquoise-rgb`, `--accent-emerald-rgb`, `--accent-blue-rgb` and `--accent-gold-rgb` become:

| New seed | Meaning | Where it may appear |
|---|---|---|
| `--accent-rgb` | **The** accent. The theme's identity. | Everything interactive: focus ring, active nav, primary button, meters, chips, hairlines (default), washes, edges. |
| `--accent-2-rgb` | Support hue. | `AmbientLayer` gradients and `.app-ground` **only**. Never on a control, never on text, never on a border. Enforced by test §9.4. |
| `--hair-rgb` | Hairline hue. Seed, not derived. | Default `var(--accent-rgb)`; two themes override it. |

`--quran-green-rgb` and `--mushaf-gold-rgb` are **not** accents and are unchanged. `--mushaf-gold-rgb` in particular stays fixed per the existing print-convention comment at `index.css:80-82` — recolouring the accent must never turn the ayah medallion or the jadwal cyan, and because the jadwal (`index.css:876-905`) and frame rules (`:841-860`) already read `--mushaf-gold-rgb`, they are immune by construction.

### 1.2 Migration that costs nothing

`tailwind.config.js` keeps every existing class name and repoints it, so the 130 `accent-gold` call sites and the ~6 stray dead-accent sites (`QueuePanel.tsx:86,92,145,151`, `PlayerHeader.tsx:41,45`) all become the one accent on the first commit, before any component is touched:

```js
colors: {
  accent:              'rgb(var(--accent-rgb) / <alpha-value>)',
  'accent-gold':       'rgb(var(--accent-rgb) / <alpha-value>)',  // deprecated alias
  'primary-blue':      'rgb(var(--accent-rgb) / <alpha-value>)',  // deprecated alias
  'primary-blue-hover':'rgb(var(--accent-rgb) / <alpha-value>)',  // deprecated alias
  'accent-turquoise':  'rgb(var(--accent-rgb) / <alpha-value>)',  // deprecated alias
  'accent-emerald':    'rgb(var(--accent-rgb) / <alpha-value>)',  // deprecated alias
  'accent-blue':       'rgb(var(--accent-rgb) / <alpha-value>)',  // deprecated alias
  border:        'rgb(var(--hair-rgb) / var(--hair-a))',
  'border-strong':'rgb(var(--hair-rgb) / var(--hair-a-strong))',
  'border-faint': 'rgb(var(--hair-rgb) / var(--hair-a-faint))',
}
```

The three `border-*` entries lose `<alpha-value>` on purpose — their alpha is now profile-controlled. A grep test forbids `border-border/`, `border-strong/`, `border-faint/` (one current offender, `RadioMiniPlayer.tsx:187`, which is being rewritten as `PlayerDocked` anyway).

In `src/index.css`, `--hair-rgb: var(--accent-gold-rgb)` at `:436` becomes a per-theme seed; `--ring-focus` at `:586` and every `--wash-*`/`--edge-*` swap `--accent-gold-rgb` → `--accent-rgb`.

### 1.3 Two corrected grounds

Two themes get a ground correction because their current ground actively defeats their identity:

| Theme | `--bg-main-rgb` now | corrected | why |
|---|---|---|---|
| `noor` | `3 4 4` | `4 12 13` | At `3 4 4` (Y = 0.0032, max channel 4) Noor Teal is *pure black*, indistinguishable in ground from Onyx, and the "teal" existed only in a swatch array. `4 12 13` is a deep teal ink: still Y = 0.0032-class dark, but with real chroma. Ladder follows: sidebar `6 17 18`, panel `8 22 24`, card `11 29 31`, card-hover `16 40 43`. |
| `mushaf` | `5 7 6` | `3 4 3` | "Mushaf Night — ink black". Pushing the ground to max-channel 4 puts it under the measured `pure-black` threshold (§2.1) honestly rather than by declaration. The other four steps are unchanged (`8 12 10` / `11 16 13` / `15 22 18` / `22 33 27`). |

### 1.4 Measured accent table

Every value below is measured, not chosen by eye — WCAG contrast against the theme's own `--bg-main` and `--bg-card`, computed with the same method as `docs/DESIGN_SYSTEM.md §1`.

| Theme | `--accent-rgb` | hue | vs ground | vs card | `--accent-2-rgb` | `--hair-rgb` |
|---|---|---|---|---|---|---|
| noor | `38 198 196` | 179° | **9.36:1** | 8.23:1 | `214 181 109` gold | `var(--accent-rgb)` |
| emerald | `72 208 122` | 142° | **9.90:1** | 8.39:1 | `176 141 87` bronze | `var(--accent-rgb)` |
| pearl | `13 105 98` | 175° | **6.02:1** | 6.53:1 | `158 118 40` bronze | `var(--accent-rgb)` |
| mushaf | `126 196 96` | 102° | **9.73:1** | 8.70:1 | `200 164 93` mushaf gold | `var(--accent-rgb)` |
| blue | `125 185 255` | 212° | **9.74:1** | 8.73:1 | `226 197 122` gold thread | `var(--accent-2-rgb)` |
| red | `236 105 110` | 358° | **6.53:1** | 5.96:1 | `226 197 122` gold thread | `var(--accent-2-rgb)` |
| onyx | `212 168 60` | 43° | **9.35:1** | 8.21:1 | `212 168 60` (same) | `var(--accent-rgb)` |
| mushaf-gold | `240 210 150` | 40° | **12.95:1** | 11.64:1 | `176 128 66` deep amber | `var(--accent-rgb)` |
| maktabah | `239 161 99` | 27° | **8.64:1** | 7.47:1 | `120 148 104` sage | `var(--accent-rgb)` |
| samaa | `79 195 247` | 199° | **7.47:1** | 5.90:1 | `168 198 219` cloud | `var(--accent-rgb)` |

Six themes change accent. Hue spread is now 27° / 40° / 43° / 102° / 142° / 175° / 179° / 199° / 212° / 358°. The two closest pairs are resolved by value and ground, not hue:

- **onyx 43° vs mushaf-gold 40°** — both are gold *by name*. Separated by lightness (L 53 vs L 76: struck brass vs gold leaf), by ground (neutral `2 2 3` vs warm `20 16 12`), by profile (`pure-black` vs `warm`) and by ambient (one key light vs a photographic plate).
- **noor 179° vs pearl 175°** — deliberate. Pearl Scholar is Noor Teal's daylight sibling; identical hue at opposite polarity (L 48 vs L 23) is the relationship, not a collision.

`blue` and `red` keep `226 197 122` as their **hairline** — that is literally what "with a refined gold thread" means in their own descriptions (`i18n.ts:137`, `:139`) — while gaining a real accent. This is the single change that ends "Sakinah Blue and Yaqut Red are byte-identical".

---

## 2. The four surface profiles

### 2.1 Assignment rule

Profile is **declared, not inferred**, and lives in one table. Two of the four are forced by measurement so the table cannot drift:

- **`light`** is forced when ground relative luminance Y > 0.18. Pearl: Y = 0.9168.
- **`pure-black`** is forced when every ground channel ≤ 4. Below that, ambient occlusion provably cannot render: a 0.70-alpha black shadow over `rgb(2 2 3)` moves luminance by under 0.3%, so shipping the shadow costs paint for nothing. Onyx `2 2 3`; Mushaf `3 4 3` after §1.3.
- **`warm`** / **`cool`** is a declared choice among the remainder. The rule that matters is that the table has four values and a fifth is never added.

```ts
// src/theme/catalog.ts
export const SURFACE_PROFILE: Record<AppTheme, SurfaceProfile> = {
  pearl: 'light',
  onyx: 'pure-black',  mushaf: 'pure-black',
  'mushaf-gold': 'warm', maktabah: 'warm', emerald: 'warm', red: 'warm',
  noor: 'cool', blue: 'cool', samaa: 'cool',
};
```

`App.tsx` sets it alongside the theme, in the same effect at `App.tsx:36-48`:

```ts
root.dataset.theme   = theme;
root.dataset.surface = SURFACE_PROFILE[theme];
```

### 2.2 Selector change that makes previews possible

Every theme block changes from `html[data-theme='x']` to `[data-theme='x']`, and the four profile blocks are written as `[data-surface='y']`. Specificity is (0,1,0) — equal to `:root`, and the theme blocks come later in source (`index.css:122-373` vs the seed `:root` at `:60`), so they still win. Dropping `html` is what lets `<div data-theme="samaa" data-surface="cool">` inside Settings resolve a complete token set (§8). The two existing descendant rules become `[data-theme='pearl'] select` (`:664`) and `[data-theme='pearl'] .hero-scene` (`:1554`) — and the latter is deleted outright, replaced by the ambient layer.

Pearl's `--sheen-rgb: 255 255 255` / `--shade-rgb: 15 26 38` (`index.css:160-161`) move out of the theme block into `[data-surface='light']`. That is the last piece of material in a theme block.

### 2.3 The four blocks, exactly

Base values live in the derived `:root` (`index.css:378+`); each profile overrides only what it changes.

```css
:root {
  /* material knobs — every one of these is overridden per profile */
  --hair-a-faint: 0.07;  --hair-a: 0.13;  --hair-a-strong: 0.26;
  --edge-gain: 1;        --wash-gain: 1;
  --glass-a: 0.82;       --glass-blur: 22px;  --glass-sat: 1.35;
  --fill-tint-rgb: var(--accent-rgb);  --fill-tint-pct: 0%;
  --ambient-ceiling: 3;  --ambient-a: 1;
  /* --r-sm/md/lg/xl unchanged: 4 / 6 / 10 / 14 */

  --surf-1: color-mix(in srgb, rgb(var(--fill-tint-rgb)) var(--fill-tint-pct), rgb(var(--bg-panel-rgb)));
  --surf-2: color-mix(in srgb, rgb(var(--fill-tint-rgb)) var(--fill-tint-pct), rgb(var(--bg-card-rgb)));
  --surf-3: color-mix(in srgb, rgb(var(--fill-tint-rgb)) var(--fill-tint-pct), rgb(var(--bg-card-hover-rgb)));
  /* --fill-1/2/3 at index.css:542-556 swap rgb(var(--bg-*-rgb)) for var(--surf-N) */

  /* alphas become calc()-scaled. SLASH syntax — rgba(var(--x), a) is invalid
     and silently drops the declaration (CLAUDE.md). */
  --edge-2: linear-gradient(146deg,
    rgb(var(--hair-rgb) / calc(0.360 * var(--edge-gain))) 0%,
    rgb(var(--hair-rgb) / calc(0.190 * var(--edge-gain))) 30%,
    rgb(var(--hair-rgb) / calc(0.090 * var(--edge-gain))) 66%,
    rgb(var(--hair-rgb) / calc(0.055 * var(--edge-gain))) 100%);
  /* --edge-1, --edge-3, --edge-accent, --wash-hover(-rtl), --wash-active(-rtl),
     --wash-btn, --wash-btn-strong: same treatment, --wash-gain for the washes. */
}

[data-surface='light'] {
  --sheen-rgb: 255 255 255;  --shade-rgb: 15 26 38;
  --hair-a-faint: 0.12; --hair-a: 0.20; --hair-a-strong: 0.34;
  --edge-gain: 1.35;    --wash-gain: 1.15;
  --glass-a: 0.92;      --glass-blur: 14px;  --glass-sat: 1.10;
  --fill-tint-pct: 0%;
  --ambient-ceiling: 1; --ambient-a: 0.5;
  /* shadow policy: ~0. Hierarchy is the ring, not the shadow. */
  --elev-1: 0 0 0 1px rgb(var(--hair-rgb) / var(--hair-a-faint));
  --elev-2: 0 0 0 1px rgb(var(--hair-rgb) / var(--hair-a)),
            0 1px 2px -1px rgb(var(--shade-rgb) / 0.06);
  --elev-3: 0 0 0 1px rgb(var(--hair-rgb) / var(--hair-a)),
            0 8px 20px -14px rgb(var(--shade-rgb) / 0.14);
  --elev-press: inset 0 1px 2px rgb(var(--shade-rgb) / 0.10);
}

[data-surface='pure-black'] {
  --hair-a-faint: 0.06; --hair-a: 0.11; --hair-a-strong: 0.22;
  --edge-gain: 0.5;     --wash-gain: 0.5;      /* accent restraint doubled */
  --glass-a: 1;         --glass-blur: 0px;     --glass-sat: 1;
  --fill-tint-pct: 0%;
  --ambient-ceiling: 1; --ambient-a: 0.7;
  /* NO shadows. Only the inset top highlight — the value step does the rest. */
  --elev-1: inset 0 1px 0 rgb(var(--sheen-rgb) / 0.030);
  --elev-2: inset 0 1px 0 rgb(var(--sheen-rgb) / 0.045);
  --elev-3: inset 0 1px 0 rgb(var(--sheen-rgb) / 0.070);
  --elev-press: inset 0 -1px 0 rgb(var(--sheen-rgb) / 0.060);
}

[data-surface='warm'] {
  --hair-a-faint: 0.08; --hair-a: 0.14; --hair-a-strong: 0.28;
  --glass-a: 0.88;      --glass-blur: 18px;  --glass-sat: 1.28;
  --fill-tint-rgb: var(--accent-2-rgb);  --fill-tint-pct: 3%;
  --r-sm: 6px; --r-md: 8px; --r-lg: 12px; --r-xl: 16px;   /* +1 step */
  --ambient-ceiling: 3; --ambient-a: 1;
  /* elevation: base ladder, unchanged */
}

[data-surface='cool'] {
  --hair-a-faint: 0.07; --hair-a: 0.13; --hair-a-strong: 0.26;
  --glass-a: 0.76;      --glass-blur: 26px;  --glass-sat: 1.42;
  --fill-tint-rgb: var(--accent-rgb);  --fill-tint-pct: 2%;
  --ambient-ceiling: 3; --ambient-a: 1;
}
```

`.surface-3` (`index.css:1921-1932`) and `.app-sidebar` consume the glass tokens:

```css
.surface-3 {
  background: linear-gradient(177deg,
      color-mix(in srgb, rgb(var(--sheen-rgb)) 6%, var(--surf-3)) 0, var(--surf-3) 130px)
    padding-box, var(--edge-3) border-box;
  background-color: rgb(var(--bg-card-hover-rgb) / var(--glass-a));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
}
/* backdrop-filter forces a per-frame readback of the backdrop. Over a playing
   <video> that copies the decoded frame every frame and can demote the video
   out of Chromium's zero-copy overlay path. Same flag that pauses ambient. */
html[data-video-playing] .surface-3,
html[data-video-playing] .app-sidebar {
  -webkit-backdrop-filter: none; backdrop-filter: none;
  background-color: rgb(var(--bg-panel-rgb));
}
```

Measured hairline weights (accent over the theme's own card):

| profile | `--hair-a` | ratio vs card | `--hair-a-strong` | ratio |
|---|---|---|---|---|
| pure-black (onyx) | 0.11 | 1.21:1 | 0.22 | 1.55:1 |
| cool / warm | 0.13 / 0.14 | 1.25:1 | 0.26 / 0.28 | 1.66:1 |
| light (pearl) | 0.20 | 1.40:1 | 0.34 | 1.75:1 |

Pearl is set deliberately **above** perceptual parity: it has no shadow, so the hairline carries the hierarchy alone.

---

## 3. The ten-theme catalog

`src/theme/catalog.ts` — the whole per-theme surface of the design system:

```ts
export const THEME_CATALOG: Record<AppTheme, ThemeEntry> = {
  noor:          { surface: 'cool',       ambient: { kind: 'aurora'    }, defaultTier: 2, maxTier: 3 },
  emerald:       { surface: 'warm',       ambient: { kind: 'lamp'      }, defaultTier: 2, maxTier: 2 },
  pearl:         { surface: 'light',      ambient: { kind: 'paper'     }, defaultTier: 1, maxTier: 1 },
  mushaf:        { surface: 'pure-black', ambient: { kind: 'girih'     }, defaultTier: 1, maxTier: 1 },
  blue:          { surface: 'cool',       ambient: { kind: 'starfield' }, defaultTier: 2, maxTier: 3 },
  red:           { surface: 'warm',       ambient: { kind: 'beams'     }, defaultTier: 2, maxTier: 2 },
  onyx:          { surface: 'pure-black', ambient: { kind: 'keylight'  }, defaultTier: 1, maxTier: 1 },
  'mushaf-gold': { surface: 'warm',       ambient: { kind: 'plate', asset: 'mushaf-gold' }, defaultTier: 1, maxTier: 1 },
  maktabah:      { surface: 'warm',       ambient: { kind: 'plate', asset: 'maktabah'    }, defaultTier: 1, maxTier: 1 },
  samaa:         { surface: 'cool',       ambient: { kind: 'clouds'    }, defaultTier: 2, maxTier: 2 },
};
```

### 3.1 Resolved surface treatment — the collapse, shown

Ten rows, four distinct value sets. This table is the deliverable: it is what "structure never changes between themes" looks like when you write it down.

| Theme | Profile | Glass α / blur / sat | Hairline faint/base/strong | Shadow policy | Radius ladder |
|---|---|---|---|---|---|
| Noor Teal | cool | 0.76 / 26px / 1.42 | .07 / .13 / .26 | full 3-level ladder | 4 / 6 / 10 / 14 |
| Sakinah Blue | cool | 0.76 / 26px / 1.42 | .07 / .13 / .26 | full 3-level ladder | 4 / 6 / 10 / 14 |
| Samaa | cool | 0.76 / 26px / 1.42 | .07 / .13 / .26 | full 3-level ladder | 4 / 6 / 10 / 14 |
| Emerald Majlis | warm | 0.88 / 18px / 1.28 | .08 / .14 / .28 | full 3-level ladder | 6 / 8 / 12 / 16 |
| Yaqut Red | warm | 0.88 / 18px / 1.28 | .08 / .14 / .28 | full 3-level ladder | 6 / 8 / 12 / 16 |
| Mushaf Gold | warm | 0.88 / 18px / 1.28 | .08 / .14 / .28 | full 3-level ladder | 6 / 8 / 12 / 16 |
| Maktabah | warm | 0.88 / 18px / 1.28 | .08 / .14 / .28 | full 3-level ladder | 6 / 8 / 12 / 16 |
| Pearl Scholar | light | 0.92 / 14px / 1.10 | .12 / .20 / .34 | ring + AO ≤ 0.14α | 4 / 6 / 10 / 14 |
| Onyx Black | pure-black | 1.00 / 0 / — | .06 / .11 / .22 | **none** (inset highlight only) | 4 / 6 / 10 / 14 |
| Mushaf Night | pure-black | 1.00 / 0 / — | .06 / .11 / .22 | **none** (inset highlight only) | 4 / 6 / 10 / 14 |

### 3.2 Per-theme detail

**1. `noor` — Noor Teal.** *Deep teal ink, cyan-teal accent, gold support.* Ground corrected to `4 12 13` (§1.3). Accent `38 198 196` (9.36:1); support `214 181 109` — the "refined gold accents" of its own description, now confined to the ambient where it belongs. Profile **cool**. Ambient **Aurora**: three `radial-gradient` pools, two in accent and one in accent-2, drifting on a 84s `translate3d` keyframe. **Tier 2** default, max 3 (the Tier-3 opt-in reuses the shared starfield). **Generated, 0 bytes.**

**2. `emerald` — Emerald Majlis.** *Dark green room, leaf-green accent, bronze support.* Accent `72 208 122` (9.90:1); support `176 141 87`. Profile **warm** — the majlis is a lamp-lit room, so surfaces take a 3% bronze tint and radii step up. Ambient **Lamp**: one large static warm key-light `radial-gradient` at 26%/18% plus a `--hair-faint` mistara dot field (`radial-gradient(circle, rgb(var(--hair-rgb) / 0.06) 1px, transparent 1px) / 24px 24px`); at Tier 2 only the pool breathes, 96s, ±3% scale. **Tier 2** default, max 2. **Generated.**

**3. `pearl` — Pearl Scholar.** *The only light theme.* Accent `13 105 98` (6.02:1 on ground, 6.53:1 on card — AA for body text, which matters because Pearl is the reading theme). Support `158 118 40`; `--mushaf-gold-rgb: 158 118 40` stays as-is per the existing comment. Profile **light** — border-led, shadow ~0, glass barely there. Ambient **Paper**: a static inline `feTurbulence` grain as a `data:` URI (rasterises exactly once) over two `repeating-linear-gradient` mistara rules at `--hair-faint`. **Tier 1, hard-locked** by `--ambient-ceiling: 1`. **Generated, < 1 KB inline.** The current `[data-theme='pearl'] .hero-scene` override (`index.css:1554-1583`, three stacked `repeating-linear-gradient`s pretending to be a bookshelf) is **deleted** — it is the last per-theme visual override in the file.

**4. `mushaf` — Mushaf Night.** *True ink black, manuscript green.* Ground corrected to `3 4 3` (§1.3). Accent `126 196 96` (9.73:1) — yellow-green at 102°, a manuscript green clearly apart from Emerald's leaf green at 142°. Support `200 164 93`. Profile **pure-black**: no shadows, accent restraint doubled. Ambient **Girih**: an interlaced 10-fold khatam strapwork field, tiled SVG `<pattern>`, tinted `rgb(var(--hair-rgb) / 0.05)`, **static**. This is the one background that is native to the subject rather than borrowed. **Tier 1**, max 1. **Build-time SVG** — `scripts/build-girih-svg.py` → `src/assets/marks/girih-field.svg`, < 4 KB, sibling to the existing `build-jadwal-svg.py`. Geometric by construction, so constraint 1 is satisfied without inspection.

**5. `blue` — Sakinah Blue.** *Navy, sapphire accent, gold thread.* Accent `125 185 255` (9.74:1); `--hair-rgb: var(--accent-2-rgb)` = `226 197 122`, so every edge in the app is the gold thread its name promises while the accent is finally sapphire. Profile **cool**. Ambient **Starfield over sapphire**: Tier 2 is the shared aurora in sapphire; Tier 3 adds a 2D-canvas starfield, ≤ 220 points, 30 fps cap. Celestial, inanimate, and the only theme where Tier 3 is worth the loop. **Tier 2** default, max 3. **Generated.**

**6. `red` — Yaqut Red.** *Deep crimson, ruby accent, gold thread.* Accent `236 105 110` (6.53:1) — deliberately lighter than the current `229 84 92` so it clears AA on `--bg-card` (5.96:1) where the old value sat at 5.03:1. `--hair-rgb: var(--accent-2-rgb)` = `226 197 122`. Profile **warm**. Ambient **Beams**: two skewed `linear-gradient` shafts, slow `translateX`, no blur filter. Explicitly *not* fire, embers or flame — light through a cut stone. **Tier 2** default, max 2. **Generated.**

**7. `onyx` — Onyx Black.** *Pure black, struck brass.* Accent `212 168 60` (9.35:1) — deeper and more saturated than Mushaf Gold's leaf. Support = the accent (a single-accent theme by definition). Profile **pure-black**: no shadows at all, `--edge-gain`/`--wash-gain` halved. Ambient **Key light**: one static `radial-gradient` pool at 4% accent, nothing else — the theme's identity is *absence*, and the ambient layer honouring that is the point. **Tier 1**, max 1. **Generated.**

**8. `mushaf-gold` — Mushaf Gold.** *Warm near-black paper, pale gold leaf.* Accent `240 210 150` (12.95:1, the brightest in the set — correct for a leaf-gold theme). Support `176 128 66`. Profile **warm**. Ambient **Plate A ground**, blurred: the stacked mushaf volumes, **calligraphy cropped away** (§4.2). **Tier 1**, max 1. **Owner photograph**, pipeline §4.

**9. `maktabah` — Maktabah.** *Warm brown, lamp amber.* Accent `239 161 99` (8.64:1). Support `120 148 104` — sage, taken from the potted plant in Plate C; vegetal, permitted, and it ties the token set to the asset. Profile **warm**. Ambient **Plate C ground**, blurred: the bookshelf wall and the plant, calligraphy cropped away. **Tier 1**, max 1. **Owner photograph**, pipeline §4.

**10. `samaa` — Samaa.** *Blue-grey sky, clear cyan.* Accent `79 195 247` (7.47:1 ground / 5.90:1 card). Support `168 198 219`. Profile **cool** — the highest glass prominence in the set, which is the right home for the one theme whose ground is genuinely atmospheric. Ambient **Generated cloud field**: four stacked large-radius `radial-gradient` banks in `--accent-2-rgb` and `--bg-card-hover-rgb` at 0.10-0.18α over the ground, drifting horizontally on 130s/190s/240s keyframes at different rates (parallax without parallax code), plus the shared static grain to break the gradient banding. **Tier 2** default, max 2. **Generated — Plate B is not shipped** (§4.3).

**Asset budget:** 2 photographic themes only. Everything else generates. Total §4.4 = **~473 KB of 1500 KB**.

---

## 4. The three plates

### 4.1 The disqualification nobody has flagged yet

All three plates contain the **Basmala** and the **نور** calligraphy. Using any of them as a blurred background makes Qur'anic text a watermark, clipped, degraded and sitting behind controls — constraints 2, 3 and 10, four ways at once. A 56px blur does not soften the problem; it *is* the problem.

**Therefore, before blur, before resize, before anything: crop to the ground region only.** The calligraphy band is removed from the source, not blurred into it. What ships from Plate A is the stacked-volumes field; from Plate C, the bookshelf wall and the plant. This is step 1 of the pipeline and is non-negotiable.

### 4.2 `scripts/build-ambient-plate.py`

New script, sibling to `build-jadwal-svg.py` / `build-basmala-svg.py`. Python + Pillow + `pillow-avif-plugin`. Deterministic; re-running produces byte-identical output.

```
python3 scripts/build-ambient-plate.py \
    --theme mushaf-gold \
    --source design_refs/plates/plate-a-mushaf-gold.jpg \
    --crop 0,0.58,1,1.0 \
    --blur 56 \
    --out src/assets/ambient/
```

Ordered steps:

1. **Crop** to `--crop l,t,r,b` (normalised). Fails with a non-zero exit if the crop rectangle overlaps the `calligraphy` rectangle recorded for that plate in `src/assets/ambient/ASSETS.md`. The two rectangles are checked in code so a future re-run cannot quietly reintroduce the Basmala.
2. **Resize** longest edge to **1280 px**, `Image.LANCZOS`.
3. **Gaussian blur**, radius from `--blur`, **40-80 px at 1280 px output** (Plate A: 64 — it is already soft, and its subject must not resolve into readable spines; Plate C: 44 — it is sharp, and 44 is enough to make it texture while keeping the plant readable as a green mass). Blurring *after* the resize is correct here: any resample aliasing is annihilated by a ≥ 40 px kernel, and it makes the radius mean the same thing in every plate.
4. **Desaturate** `ImageEnhance.Color(0.72)` and **compress levels** into `[0.06, 0.58]` of the theme's own `--bg-main`→`--bg-card-hover` range, so the plate can never out-contrast content sitting on it.
5. **Encode** `‹theme›-1280.avif` (AVIF, `quality` bisected down from 62 until ≤ 120 KB) and `‹theme›-1280.webp` (`quality=62, method=6`) as fallback.
6. **Emit preview derivative** `‹theme›-320.avif` / `.webp` at 320 px wide for `ThemePreview` (§8), target ≤ 12 KB each.
7. **Hard-fail** if any AVIF or WebP exceeds `120 * 1024` bytes, or if the running total under `src/assets/ambient/` exceeds `1500 * 1024`.
8. **Write the ASSETS.md row**: theme, source filename, source SHA-256, crop rect, blur radius, output sizes, output SHA-256s, licence/ownership line, and the manhaj sign-off line from step 9.

`scripts/audit-ambient.py` is the gate: it tiles the **cropped, pre-blur** image into a contact sheet at 8× local gain (per-tile autocontrast) and writes `design-audit/ambient/‹theme›-audit.png`. A machine cannot certify the absence of animate beings; a human reviews the sheet and the reviewer's name plus date is recorded in ASSETS.md. No sign-off line, no build.

Consumption — one rule per photographic theme, in `src/index.css`:

```css
[data-theme='mushaf-gold'] .ambient-still {
  background-image: image-set(
    url('./assets/ambient/mushaf-gold-1280.avif') type('image/avif'),
    url('./assets/ambient/mushaf-gold-1280.webp') type('image/webp'));
  background-size: cover;
  background-position: center 62%;
}
```

`image-set()` with `type()` is Chromium-native, so WebView2 picks AVIF and the WebP only fires on a pinned pre-85 runtime. CSP `img-src 'self'` already covers bundled assets (`tauri.conf.json:28`); nothing in the security config changes.

### 4.3 Plate B — Samaa

**Disqualified as supplied.** The cloud field below the calligraphy contains what reads as a bird silhouette.

**Remedy: replace with a fully generated cloud field (§3.2, item 10). Plate B is not shipped in any form.**

Rationale, briefly: cropping below the horizon does not survive review — a blurred bird is still a bird, and a 4%-opacity silhouette in a soft field is exactly the artefact that passes a glance and fails an audit. The evidence is the plate itself: it was human-selected and still carried the violation into the reference set. Generated clouds are auditable by construction (they are four radial gradients), cost 0 bytes, and Samaa's Tier-2 default wants motion anyway, which a still photograph cannot give.

Plate B is retained in `design_refs/` **as a colour reference only**, and its ASSETS.md entry records `status: rejected — animate being in source; not shipped` so the decision cannot be silently reversed.

If the owner insists on the photograph, the only permitted path is: crop strictly above the horizon line, run `audit-ambient.py`, obtain a written sign-off recorded in ASSETS.md naming the reviewer, and re-run the full pipeline. That path is gated, not default, and nothing in the schedule depends on it.

### 4.4 Budget

| Asset | AVIF | WebP | preview AVIF | preview WebP | total |
|---|---|---|---|---|---|
| `mushaf-gold-1280` | ≤ 96 KB | ≤ 118 KB | ≤ 10 KB | ≤ 12 KB | ≤ 236 KB |
| `maktabah-1280` | ≤ 96 KB | ≤ 118 KB | ≤ 10 KB | ≤ 12 KB | ≤ 236 KB |
| `girih-field.svg` | 4 KB | — | — | — | 4 KB |
| grain (inline `data:`) | < 1 KB | — | — | — | < 1 KB |
| **Total** | | | | | **≤ 477 KB / 1500 KB** |

Headroom 1023 KB. For calibration, `dist/assets/app-icon-CElKQprs.png` is 378 KB on its own.

---

## 5. `<AmbientLayer />`

### 5.1 Types

```ts
// src/theme/types.ts
import type { AppTheme } from '@/types';

export type SurfaceProfile = 'light' | 'pure-black' | 'warm' | 'cool';
export type AmbientTier = 0 | 1 | 2 | 3;
export type AmbientMotionPref = 'off' | 'subtle' | 'full';
export type AmbientKind =
  | 'flat' | 'paper' | 'girih' | 'keylight' | 'plate'
  | 'aurora' | 'lamp' | 'beams' | 'clouds' | 'starfield';

export interface ThemeEntry {
  surface: SurfaceProfile;
  ambient: { kind: AmbientKind; asset?: 'mushaf-gold' | 'maktabah' };
  defaultTier: AmbientTier;   // what 'subtle' gives
  maxTier: AmbientTier;       // what 'full' gives
}
```

### 5.2 Tier resolution — one pure function, unit-testable

```ts
// src/theme/tier.ts
export interface TierInputs {
  theme: AppTheme;
  motionPref: AmbientMotionPref;
  reducedMotion: boolean;   // matchMedia('(prefers-reduced-motion: reduce)')
  deviceCap: AmbientTier;   // 3 normally; 1 when deviceMemory<=4 || hardwareConcurrency<=4
  routeCap: AmbientTier;    // 1 on '/quran', else 3
  videoPlaying: boolean;
  windowFocused: boolean;
  batteryLow: boolean;      // level < 0.20 && !charging; false when API absent
}

export function resolveTier(i: TierInputs): AmbientTier {
  if (i.reducedMotion || i.motionPref === 'off') return 0;
  const entry = THEME_CATALOG[i.theme];
  const want = i.motionPref === 'full' ? entry.maxTier : entry.defaultTier;
  const profileCeiling = SURFACE_PROFILE_CEILING[entry.surface]; // light:1, others:3
  const runtime = (i.videoPlaying || !i.windowFocused || i.batteryLow) ? 1 : 3;
  return Math.min(want, entry.maxTier, profileCeiling,
                  i.deviceCap, i.routeCap, runtime) as AmbientTier;
}
```

Everything is a `min`, so no combination can raise the tier, and every hard rule from the contract is one term. `prefers-reduced-motion` short-circuits to 0 globally before any other consideration.

### 5.3 Component

```ts
// src/components/ambient/AmbientLayer.tsx
export interface AmbientLayerProps {
  /** 'app' mounts fixed behind the whole shell; 'preview' fills its positioned parent. */
  variant?: 'app' | 'preview';
  /** Preview only. In 'app' the theme is read from document.documentElement.dataset.theme. */
  theme?: AppTheme;
  /** Extra ceiling applied on top of resolveTier(). Preview passes 1. */
  tierCap?: AmbientTier;
  /** Freezes all motion without unmounting anything. Preview passes true. */
  paused?: boolean;
  className?: string;
}
```

Structure — **fixed**, so the DOM never changes with tier and nothing can be "restarted":

```jsx
<div className="ambient-root" data-tier={tier} aria-hidden="true">
  <div className="ambient-flat"  />   {/* always painted, opaque, tier 0 */}
  <div className="ambient-still" />   {/* tier >= 1: grain / girih / keylight / plate */}
  <div className="ambient-drift">     {/* tier >= 2: aurora / lamp / beams / clouds  */}
    <i className="amb-a" /><i className="amb-b" /><i className="amb-c" />
  </div>
  {tier === 3 && <StarfieldCanvas paused={paused} />}
</div>
```

Mounted **once**, as the first child of `.app-container` in `App.tsx` (before `<TitleBar/>`), `position: fixed; inset: 0; z-index: 0; pointer-events: none`. `.app-shell` and `<main>` become `position: relative; z-index: 1; background: transparent`. Two existing gradient stacks are deleted and folded into the layer: `body`'s three-layer background (`index.css:614-617`, which becomes a flat `var(--bg-main)`) and `.app-ground` (`index.css:1936-1945`) — otherwise you get two competing fields.

**Tier is a data attribute, never a mount condition.** `ambient-drift` always exists in the DOM and always has its keyframes running; the tier attribute controls `opacity` and `animation-play-state`. Pausing a CSS animation preserves the timeline position, so returning from `/quran` resumes mid-drift rather than restarting. Only `StarfieldCanvas` mounts conditionally, and only between Tier 2 and 3, which the user changes deliberately.

```css
.ambient-root { position: fixed; inset: 0; z-index: 0; pointer-events: none;
                opacity: var(--ambient-a); contain: strict; }
.ambient-still, .ambient-drift { position: absolute; inset: 0;
                transition: opacity var(--dur-slow) var(--ease-out); }
.ambient-root[data-tier='0'] .ambient-still,
.ambient-root[data-tier='0'] .ambient-drift { opacity: 0; }
.ambient-root[data-tier='1'] .ambient-drift  { opacity: 0; animation-play-state: paused; }
.ambient-drift i { position: absolute; inset: -20%; will-change: transform;
                   animation: amb-drift var(--amb-dur, 84s) linear infinite; }
@keyframes amb-drift {
  from { transform: translate3d(-2%, -1%, 0) scale(1.04); }
  50%  { transform: translate3d( 3%,  2%, 0) scale(1.10); }
  to   { transform: translate3d(-2%, -1%, 0) scale(1.04); }
}
@media (prefers-reduced-motion: reduce) { .ambient-drift { display: none; } }
```

No `filter: blur()` anywhere in the layer. A `radial-gradient` **is** pre-blurred, which is why every Tier-2 concept is built from them; the only real blur in the system is baked into the two AVIFs at build time.

### 5.4 State

```ts
// src/store/ambientStore.ts
interface AmbientState {
  motionPref: AmbientMotionPref;      // localStorage 'salafi-hub.ambient-motion', default 'subtle'
  reducedMotion: boolean;
  deviceCap: AmbientTier;
  videoPlaying: boolean;
  windowFocused: boolean;
  batteryLow: boolean;
  routeCap: AmbientTier;
  setMotionPref: (p: AmbientMotionPref) => void;
  setVideoPlaying: (v: boolean) => void;
  setRouteCap: (c: AmbientTier) => void;
}
```

- **Persistence** is `localStorage`, precedent `salafi-hub.player-collapsed` (`RadioMiniPlayer.tsx:48`). This keeps the change out of the Rust `Settings` struct and off the migration path. Promoting it to `Settings` later is a follow-up, not a prerequisite.
- **`videoPlaying`** is set from `VideoPlayer.tsx`'s `play`/`pause`/`ended` handlers and also stamps `html[data-video-playing]` for the backdrop-filter rule in §2.3.
- **`windowFocused`** from `window` `blur`/`focus`.
- **`batteryLow`** from `navigator.getBattery()` behind a feature check — Chromium ships it on Windows, but if it is absent the term is `false` and the rest of the system is unaffected.
- **`routeCap`** — a `useEffect` in `App.tsx` on `location.pathname`: `setRouteCap(pathname === '/quran' ? 1 : 3)`. The Qur'an lock is therefore in one place, applies in all ten themes, and is asserted by test §9.3 rather than checked by eye.

### 5.5 Perf

Tier 0/1 are paint-once. Tier 2 animates `transform` and `opacity` only on three absolutely positioned elements inside `contain: strict` — compositor-only, zero layout, zero paint. Tier 3 is 2D canvas at 30 fps with ≤ 220 points and no WebGL context, so there is no backbuffer to account for and the < 40 MB GPU line is trivially met. Nothing in the layer touches `pointermove`, so the "zero contribution to input latency" clause is satisfied by construction.

---

## 6. Theme switch

Three properties, each with a mechanism and a test.

**No layout shift.** A theme block declares colour only — verified: no theme block today declares a non-colour property, and `var(--r-*)` is used only in `border-radius` (`index.css:1235`, `:1424`). Radius changes between profiles cannot move a box. Test §9.1 measures `getBoundingClientRect()` for a fixed selector set across all ten themes on all eight routes and asserts byte equality.

**No ambient restart.** `<AmbientLayer/>` is outside `<Routes>`, mounted once, keyed by nothing. On theme change only custom-property values change; the `amb-drift` animation continues on its own timeline. `StarfieldCanvas` keeps its `requestAnimationFrame` loop and re-reads its colour on the `theme:changed` event, tweening over `--dur-slow`. The plate themes swap `background-image` via `[data-theme]` — no remount, no reflow.

**No hard colour flip.** Custom properties are not interpolable, but the *computed* colours that depend on them are. A transient attribute enables a one-shot transition on the real animatable properties:

```ts
// src/theme/applyTheme.ts
export function applyTheme(theme: AppTheme, opts?: { animate?: boolean }) {
  const root = document.documentElement;
  const animate = opts?.animate !== false
    && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (animate) root.dataset.themeSwitching = '';
  requestAnimationFrame(() => {
    root.dataset.theme = theme;
    root.dataset.surface = SURFACE_PROFILE[theme];
    root.dispatchEvent(new CustomEvent('theme:changed', { detail: { theme } }));
    if (animate) setTimeout(() => delete root.dataset.themeSwitching, 260);
  });
}
```

```css
html[data-theme-switching] *:not(.quran-script):not(.quran-flow):not(.quran-reading-surface)
                            :not(.hero-basmala):not(.hero-mark):not(.quran-jadwal) {
  transition:
    background-color var(--dur-normal) var(--ease-out),
    background-image var(--dur-normal) var(--ease-out),
    border-color     var(--dur-normal) var(--ease-out),
    color            var(--dur-normal) var(--ease-out),
    box-shadow       var(--dur-normal) var(--ease-out) !important;
}
```

`background-image` interpolates because our fills are the same gradient shape with different stops. **Qur'anic text and the Basmala are excluded by name**: a colour transition applied to a glyph is a restyle-in-time, and constraint 3's list ("no gradient fill, no hover state, no scroll-linked transform") is a list of exactly this category. They cut instantly. Under `prefers-reduced-motion`, everything cuts instantly.

`applyTheme` replaces the `root.dataset.theme = theme` line inside the existing effect at `App.tsx:36-48`; the effect still owns `lang`, `dir` and `data-language`.

---

## 7. Killing the 30 hex literals

`src/i18n.ts:1066-1131` — `themeOptions` loses its `swatches` field entirely. 30 of the app's 31 hex literals disappear in one edit.

```ts
export const themeOptions: Array<{
  id: AppTheme;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
}> = [ /* ten entries, labels and descriptions only */ ];
```

The picker no longer needs them because `ThemePreview` renders the real tokens.

---

## 8. `ThemePreview` and `ThemePicker`

### 8.1 How the preview gets a theme without being the document

Because §2.2 changed the selectors to `[data-theme='x']` / `[data-surface='y']`, any element can carry a complete token set. The preview root is `<div data-theme={theme} data-surface={SURFACE_PROFILE[theme]}>` and every token — accent, ground ladder, hairline alphas, elevation, radii, glass, fill tint — resolves inside it exactly as it would on `<html>`. There is no second source of truth and no drift is possible: change a seed and every preview changes with it.

### 8.2 Rendering technique

Render the miniature at **400 × 260 CSS px** and scale it by `0.5` into a `200 × 130` box:

```css
.theme-preview { width: 200px; height: 130px; overflow: hidden; border-radius: var(--r-md); }
.theme-preview-inner { width: 400px; height: 260px; transform: scale(0.5); transform-origin: top left; }
```

At a native 200 px the 11.5 px caption step and the 1 px hairlines render as sub-pixel mud. At 2× and scaled, the geometry is correct, the hairlines land at a clean 0.5 px, and the proportions are the app's own.

### 8.3 What it shows — and what it must not

The preview is a scale model of the actual shell, built from the actual classes:

- 8 px title-bar strip with three end-aligned dots
- 28 px sidebar rail, `.app-sidebar` glass, five nav pills, one with the inset active marker
- hero band: `<AmbientLayer variant="preview" theme={theme} tierCap={1} paused />` behind an accent eyebrow bar and two text bars
- one `.rule-head` hairline
- three `.surface-2` cards in a `GridMedia` row
- four `.rule-row` list rows, one `.rule-row-active`

**No calligraphy of any kind.** Not the Basmala (constraint 10 — complete, static, full size; a 100 px-wide Basmala inside a picker chip is decoration by definition), and not the نور mark either — it would be illegible at that scale and the mihrab arch is documented as appearing exactly once in the app (`docs/DESIGN_SYSTEM.md §3`), which ten previews would end. What varies between themes is ground, accent, hairline weight, glass, shadow and radius, and all six are visible in structure alone.

For the two plate themes, `AmbientLayer variant="preview"` selects the 320 px derivative via a `[data-theme][data-ambient-scale='preview'] .ambient-still` rule, so Settings never decodes two 1280 px AVIFs.

### 8.4 Props

```ts
// src/components/settings/ThemePreview.tsx
export interface ThemePreviewProps {
  theme: AppTheme;
  /** Rendered box. Interior is always drawn at 2x and scaled to fit. Default 200. */
  width?: number;
  /** Default 130. */
  height?: number;
  /** Draws the selected ring. Purely visual — a11y state lives on the radio. */
  selected?: boolean;
  className?: string;
}

// src/components/settings/ThemePicker.tsx
export interface ThemePickerProps {
  value: AppTheme;
  onChange: (theme: AppTheme) => void;
  /** Grid columns. Default 3 at >=1280px, 2 below. */
  columns?: 2 | 3;
  disabled?: boolean;
}
```

`ThemePreview` is `aria-hidden="true"` throughout; the accessible name and state come from the enclosing `role="radio"` button, which keeps the label + description text and the `Check` mark already at `Settings.tsx:492-495`. `ThemePicker` replaces the `role="radiogroup"` block at `Settings.tsx:466-499`, keeps `role="radiogroup"`, and adds roving arrow-key navigation (absent today).

`onChange` calls `applyTheme(theme)` **immediately** for the visual switch and `updateSettings({ theme })` for persistence, in that order — so the switch is instant and does not wait on a Tauri round-trip that can take 12 s to time out (`settingsStore.ts` `withTimeout(..., 12000)`).

`ThemePreview` is `React.memo`'d on `theme` + `selected`. Ten previews are ten static DOM subtrees with no animation, no canvas and no rAF; the Settings route pays one layout for them and nothing thereafter.

---

## 9. Verification

The harness at `scripts/harness/` already iterates all ten themes (`probe.mjs:35`), so these are additions to it, not new infrastructure.

**9.1 — `scripts/harness/theme-matrix.mjs` (no layout shift).** For each of 8 routes × 10 themes × 2 languages, capture `getBoundingClientRect()` for a fixed selector list (`.app-sidebar`, `main`, `.rule-row`, `.surface-2`, `.rule-head`, `h1`, `.quran-reading-frame`). Assert every rect is identical across themes within a route+language. Any difference is a theme block that grew a non-colour property.

**9.2 — profile collapse.** Read the resolved value of `--hair-a`, `--glass-a`, `--glass-blur`, `--r-lg`, `--elev-2` in all ten themes. Assert the set of **distinct** tuples has cardinality exactly **4**. This is the test that stops ten themes becoming ten design systems, and it fails loudly the first time someone adds a per-theme material override.

**9.3 — Qur'an ambient lock.** On `/quran`, in all ten themes, assert `.ambient-root[data-tier]` ≤ 1 and that every element on the paint path between `.ambient-root` and `.quran-script` computes `opacity: 1` with a non-transparent `background-color`. Also assert `.quran-reading-surface` still computes `overflow: visible` and `border-width: 0px`, and that `.ambient-root` is not an ancestor of `.quran-reading-frame` — the invariant `positionWordCue` depends on.

**9.4 — accent discipline.** Grep `src/**/*.{ts,tsx}` for `accent-2`, `--accent-2-rgb` outside `src/index.css` and `src/components/ambient/`; must be zero. Grep for `text-white`, `bg-black`, `rgba(`, `#[0-9a-fA-F]{3,6}` in `src/components/` and `src/pages/`; must be zero after migration.

**9.5 — asset budget.** `du -b src/assets/ambient` ≤ 1 500 000 and every individual file ≤ 122 880. Wired into `build-ambient-plate.py` step 7 so it fails at generation, not at review.

**9.6 — contrast.** Port the accent table of §1.4 into a script asserting `--accent-rgb` vs `--bg-main-rgb` ≥ 4.5:1 and vs `--bg-card-rgb` ≥ 4.5:1 in all ten themes.

`cd src-tauri && cargo test` is unaffected — nothing here touches Rust. Note that it cannot run in this container (gdk-3.0 absent) and is a CI-only check.

---

## 10. Files

**New**
- `src/theme/types.ts`, `src/theme/catalog.ts`, `src/theme/tier.ts`, `src/theme/applyTheme.ts`, `src/theme/useSurfaceProfile.ts`
- `src/components/ambient/AmbientLayer.tsx`, `src/components/ambient/StarfieldCanvas.tsx`, `src/components/ambient/ambient.css`
- `src/store/ambientStore.ts`
- `src/components/settings/ThemePreview.tsx`, `src/components/settings/ThemePicker.tsx`
- `src/assets/ambient/` — `mushaf-gold-1280.{avif,webp}`, `mushaf-gold-320.{avif,webp}`, `maktabah-1280.{avif,webp}`, `maktabah-320.{avif,webp}`, `ASSETS.md`
- `src/assets/marks/girih-field.svg`
- `scripts/build-ambient-plate.py`, `scripts/audit-ambient.py`, `scripts/build-girih-svg.py`
- `scripts/harness/theme-matrix.mjs`

**Edited**
- `src/index.css` — ten theme blocks reduced to seeds and re-selectored; four `[data-surface]` blocks added; `--hair-rgb`/`--ring-focus`/`--edge-*`/`--wash-*` repointed at `--accent-rgb` with `calc()` gains; `--surf-1/2/3` added and `--fill-*` repointed; `.surface-3` glass tokenised; `body` background flattened; `.app-ground` and `.hero-scene`/`.hero-band-*`/`[data-theme='pearl'] .hero-scene` deleted (`:1497-1583`); `--border-subtle`(-`rgb`)/`--border-strong`/`--teal-glass`/`--gold-glass`/`--surface-wash`/`--card-wash` deleted from all ten blocks; `.thumbnail-fallback-quiet .icon-medallion` (`:2173`) repointed.
- `tailwind.config.js` — colour map per §1.2. `./src/assets/marks/*.svg` stays in `content` (`girih-field.svg` lands there and would otherwise be purged, same failure mode as the existing marks).
- `src/App.tsx` — `<AmbientLayer/>` mounted; `data-surface` stamped; `applyTheme` used; `routeCap` effect added.
- `src/i18n.ts` — `swatches` removed (30 hex literals).
- `src/pages/Settings.tsx` — theme radiogroup (`:466-499`) replaced by `<ThemePicker/>`; a "Background motion — Off / Subtle / Full" `SettingRow` added to the same `Section`.
- `src/components/home/Hero.tsx` — `.hero-scene`/`.hero-band-*` subtree (`:53-60`) removed; the hero now sits on the shared ambient.
- `src/components/player/VideoPlayer.tsx` — `setVideoPlaying` on play/pause/ended.
- `docs/DESIGN_SYSTEM.md` — §1 token table replaced by §1.4 and §3.1 here.

**Untouched, deliberately:** `src/pages/Quran.tsx`, `src/store/quranStore.ts`, everything under word timing and audio matching, `src-tauri/**`, the updater keys and signing config.


## Risks

- **Changing the theme selectors from `html[data-theme='x']` to `[data-theme='x']` drops specificity from (0,1,1) to (0,1,0), which is equal to the seed `:root` block at index.css:60. The theme blocks only win because they appear later in source order.**
  - Mitigation: Add a comment at the top of the theme block region stating the ordering dependency, and add an assertion to scripts/harness/theme-matrix.mjs that `getComputedStyle(html).getPropertyValue('--accent-rgb')` differs across all ten themes. Any future refactor that moves the seed `:root` below the theme blocks fails that test immediately.
- **Recolouring six themes' accents changes the look of 130 existing `accent-gold` call sites at once. Some may have been visually tuned against gold specifically (for example alpha values chosen so a gold wash reads correctly on a warm ground).**
  - Mitigation: Sweep the harness across 10 themes x 2 languages x 8 routes before and after (`node scripts/harness/shoot.mjs --themes noor,emerald,pearl,mushaf,blue,red,onyx,mushaf-gold,maktabah,samaa --langs en,ar`) and diff. The alphas are all profile-gained now, so a wash that reads too strong in one profile is fixed by that profile's `--wash-gain`, never by a per-theme override.
- **`calc()` in the alpha slot of `rgb(var(--hair-rgb) / calc(0.22 * var(--edge-gain)))` is correct CSS and works in Chromium, but a typo reverting it to comma form silently drops the whole declaration — the exact failure mode CLAUDE.md documents.**
  - Mitigation: Add a grep gate to CI: `rg 'rgba\(var\(' src/` must return zero. Pair it with a harness assertion that `--edge-2` resolves to a non-empty computed value in all ten themes.
- **Moving `<AmbientLayer/>` to a fixed layer at z-index 0 and making `.app-shell`/`main` transparent can expose stacking-context bugs in components that assume an opaque parent — particularly the sticky headers, the fixed RadioMiniPlayer at z-40, and the ReminderModal scrim.**
  - Mitigation: `.ambient-root` uses `contain: strict` and `pointer-events: none`, and the shell gets an explicit `position: relative; z-index: 1`. Verify with the full-page harness captures at both 1280x800 and 1920x1080 in all ten themes; the `-full` variants already exist in design-audit/ as the before baseline.
- **Cropping the calligraphy out of Plates A and C may leave too little usable ground, or a ground that is compositionally uninteresting once blurred to 44-64px.**
  - Mitigation: The crop rectangle is a script parameter, so it is cheap to iterate. If a plate cannot yield a usable ground without the calligraphy, that theme falls back to the generated concept for its profile (warm -> `lamp`), which is already specified and costs zero assets. No schedule depends on either photograph shipping.
- **`navigator.getBattery()` is deprecated and may be absent or permission-gated in a future WebView2 runtime, silently disabling the under-20%-battery pause.**
  - Mitigation: The term defaults to `false` when the API is absent, so the system degrades to Tier 2 on battery rather than erroring. The device-capability term (`deviceMemory`/`hardwareConcurrency`) and the window-blur pause remain, and together they cover most of the same power cases.
- **The theme-switch crossfade applies a `transition` to `*` for 260ms. On a heavy route (Radio at 6431px scrollHeight and 175 unvirtualized rows) that is 175+ elements transitioning four properties simultaneously.**
  - Mitigation: The transition only runs for 260ms and only on compositor-cheap colour properties, and the attribute is removed afterwards so nothing persists. If it measures badly on Radio, scope the selector to `.app-shell *` and exclude `.rule-row` — the rows inherit their ground from the panel behind them, so excluding them is visually free.

## Open questions

- Plate B (Samaa): this spec defaults to a fully generated cloud field and does not ship the photograph in any form. Does the owner accept that, or does he want the gated crop-above-the-horizon path attempted first? The gated path needs a named human reviewer for the ASSETS.md sign-off line.
- Do the owner's plates come with a clear licence/provenance (own photography, purchased stock, or found)? ASSETS.md requires a licence line per asset, and a found image cannot ship inside a signed binary regardless of how heavily it is blurred.
- Two grounds are corrected in this spec — Noor Teal `3 4 4` -> `4 12 13` and Mushaf Night `5 7 6` -> `3 4 3`. Noor's is the larger visual change (it is currently indistinguishable from Onyx). Confirm before implementation, since Noor is the app's default theme (`App.tsx:38`).
- Onyx `212 168 60` and Mushaf Gold `240 210 150` remain the closest pair in hue (43 deg vs 40 deg), separated by 23 lightness points, a neutral-vs-warm ground and different surface profiles. Is that separation enough, or should Onyx move to a cooler pewter/steel accent and give up 'royal gold' from its description?
- Should `ambientMotion` live in `localStorage` (specified here — zero backend change) or be promoted to the Rust `Settings` struct so it round-trips with backup/restore? The latter needs a `src-tauri` migration and touches `update_settings`.
- `--quran-green-rgb` (5 uses) is now the only seed that is neither `--accent-rgb`, `--accent-2-rgb`, `--hair-rgb` nor `--mushaf-gold-rgb`. Its live uses are `.app-ground` (being deleted) and four others. Should it be folded into `--accent-2-rgb`, or kept as a Qur'an-domain colour alongside `--mushaf-gold-rgb`?
- Tier 3 is specified as opt-in and reachable only on `blue` (starfield). Is one Tier-3 concept across ten themes the right ambition, or should `noor` and `samaa` also get canvas concepts (dot-matrix wave and noise flow respectively) at `motionPref: 'full'`?
