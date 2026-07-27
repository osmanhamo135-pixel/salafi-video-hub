import { rgba, type ScenePainter } from './types';

/**
 * EMBER — red spider lilies against a banked-coal dark.
 *
 * The owner's reference: tall slender stems rising out of the lower frame,
 * each carrying a firework-burst blossom of long recurved petals, a fan of
 * still longer arcing filaments reaching past them, everything backlit by a
 * deep red glow low in the frame and falling to near-black at the corners.
 * The subject is the SILHOUETTE-AND-GLOW relationship: dark stems against
 * warm light, warm petals against dark air.
 *
 * Construction, back to front:
 *
 *   1  the body    — room dark, full-height warm bleed, floor wash
 *   2  the glow    — the old coal bed, kept as the lilies' backlight: fused
 *                    low-alpha pools that never resolve into countable shapes
 *   3  the stems   — slender layered bezier strokes, darker than the glow,
 *                    descending out of the bottom edge (source-over: they must
 *                    REMOVE light, which `lighter` cannot)
 *   4  the lilies  — 5-8 blossoms at two depths along the lower third, plus
 *                    one or two much larger near-camera blossoms cut by the
 *                    frame edge. Each blossom: 6-9 long curved petals as
 *                    filled tapered beziers, a fan of longer 2-pass filament
 *                    arcs, each ending in a tiny anther dot — the only place
 *                    `sheen` is admitted in the whole scene.
 *   5  the air     — a faint remnant of rising sparks reading as drifting
 *                    embers among the flowers, and two or three detached
 *                    petals adrift
 *   6  the close   — vignette and lid, so text keeps the contrast
 *
 * Everything red is `accent`; everything dark is `shade` over the theme's own
 * `ground`; `sheen` appears only in the anther tips. Nothing cool is drawn at
 * any point — a single cool token here reads as daylight and kills the night.
 *
 * NO SYMMETRY ANYWHERE. Every petal takes its own length and angle jitter,
 * every filament its own bow, every blossom its own tilt and petal count. A
 * perfectly regular burst reads as a clip-art asterisk; the jitter is what
 * makes it a flower.
 */
export const paintEmber: ScenePainter = (f) => {
  const { ctx, W, H, palette: p, comp } = f;

  const TAU = Math.PI * 2;
  const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

  /**
   * Local time. Every animated term below reads this and never `f.t`.
   * A section that sets `speed: 0` — the Qur'an reading route does, because
   * motion behind Qur'anic text is forbidden — must get a genuinely frozen
   * painting rather than a slow one. Multiplying once at the source is what
   * makes that guarantee total: one layer reaching past this for `f.t` would
   * keep crawling behind the mushaf and no screenshot would ever reveal it.
   */
  const t = f.t * comp.speed;

  /**
   * Positions derived from `t` freeze on their own when `t` stops.
   * Sinusoidal *modulations* do not: `sin(phase)` at t = 0 is some nonzero
   * constant, so a frozen frame would sit permanently brighter or dimmer than
   * intended. `alive` zeroes every such term outright — sway, pulse, flicker —
   * which makes the still frame the canonical one. Static *seeded* tilts stay
   * separate from these, so a frozen field still leans every which way.
   */
  const alive = comp.speed > 0 ? 1 : 0;

  /** House rule: artistic alpha * level * weight. Nothing draws without it. */
  const A = f.level * comp.weight;
  if (A <= 0) return;
  const a = (v: number) => v * A;

  const D = clamp01(comp.density);
  const R = Math.max(W, H);

  /**
   * The glow sits on the composition's ground line, clamped into the lower
   * half — the lilies grow out of a floor, and a floor at a third of the frame
   * height stops being a floor and becomes a bar across the text.
   */
  const bedY = Math.min(H * 0.97, Math.max(H * 0.56, H * clamp01(comp.horizon)));
  const fx = clamp01(comp.focusX) * W;
  const fy = clamp01(comp.focusY) * H;

  /**
   * THE LIGHT SOURCE — the red backlight behind the flowers. Drawn toward the
   * composition's focus but pulled only a third of the way up from the floor:
   * the focus says where the light lives, the glow still has to lie low.
   */
  const lightX = fx;
  const lightY = bedY + (fy - bedY) * 0.34;

  /**
   * How lit a point is, 0..1, on a soft falloff that never reaches zero — a
   * hard cutoff would put a visible boundary through the frame. Wider on X
   * than on Y because light lying on a floor spreads sideways. Every warm
   * pass multiplies its alpha by this; it is the one rule making the whole
   * frame read as a single space.
   */
  const litR = R * 0.85;
  const lit = (x: number, y: number): number => {
    const dx = (x - lightX) / litR;
    const dy = (y - lightY) / (litR * 0.5);
    return 1 / (1 + (dx * dx + dy * dy) * 1.9);
  };

  /**
   * Two summed, incommensurable frequencies so the glow swells rather than
   * throbs — a single sine reads as a machine pulse within ten seconds.
   */
  const breath =
    1 + alive * (Math.sin(t * 0.21) * 0.05 + Math.sin(t * 0.077 + 2.2) * 0.032);

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  /**
   * Hard guarantee for the "draw only within the frame" rule: several passes
   * fill deliberately oversized rects in transformed space, and the giant
   * near-camera blossoms are POSITIONED partly outside the frame on purpose.
   * The clip is what cuts them, cheaply and without seams.
   */
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();

  // ---------------------------------------------------------------------
  // PASS 1 — THE BODY. Three full-height fills; every ramp ends on a zero
  // stop after a long tail, because a gradient that stops while it still has
  // alpha leaves a seam, and a seam across a dark frame outshines the scene.
  // ---------------------------------------------------------------------

  // The dark has to exist before the glow does, or the additive passes have
  // nothing to push against and the red reads as a flat shape, not as light.
  ctx.fillStyle = rgba(p.ground, a(0.99));
  ctx.fillRect(0, 0, W, H);

  // Top-heavy darkening; the bottom stop lifts again so the very base closes
  // down too — the stems descend into a floor, not into a lamp.
  const room = ctx.createLinearGradient(0, 0, 0, H);
  room.addColorStop(0.0, rgba(p.shade, a(0.78)));
  room.addColorStop(0.2, rgba(p.shade, a(0.52)));
  room.addColorStop(0.46, rgba(p.shade, a(0.28)));
  room.addColorStop(0.68, rgba(p.shade, a(0.14)));
  room.addColorStop(0.86, rgba(p.shade, a(0.07)));
  room.addColorStop(1.0, rgba(p.shade, a(0.3)));
  ctx.fillStyle = room;
  ctx.fillRect(0, 0, W, H);

  /**
   * Additive from here: overlapping warm light must accumulate the way real
   * light does, or the glow separates into discrete discs with visible rims.
   */
  ctx.globalCompositeOperation = 'lighter';

  // The warm bleed, full height — nearly nothing at the ceiling, climbing to
  // the floor, with stops placed relative to where the ground actually is.
  const bedU = clamp01(bedY / H);
  const bleed = ctx.createLinearGradient(0, 0, 0, H);
  bleed.addColorStop(0.0, rgba(p.accent, 0));
  bleed.addColorStop(Math.min(0.99, bedU * 0.18), rgba(p.accent, a(0.012)));
  bleed.addColorStop(Math.min(0.99, bedU * 0.42), rgba(p.accent, a(0.03)));
  bleed.addColorStop(Math.min(0.99, bedU * 0.66), rgba(p.accent, a(0.055)));
  bleed.addColorStop(Math.min(0.995, bedU * 0.87), rgba(p.accent, a(0.085)));
  bleed.addColorStop(Math.min(0.998, bedU), rgba(p.accent, a(0.1)));
  bleed.addColorStop(1.0, rgba(p.accent, a(0.02)));
  ctx.fillStyle = bleed;
  ctx.fillRect(0, 0, W, H);

  // ---------------------------------------------------------------------
  // PASS 2 — THE GLOW. Fused pools at two to six percent each; no pool is
  // legible on its own, and the hot and cool patches are entirely where the
  // overlaps pile up. This is the backlight the lilies stand against.
  // ---------------------------------------------------------------------

  /** One flattened pool. Every warm mass goes through here, so there is
   *  exactly one falloff shape in the scene and nothing ends on a step. */
  const pool = (
    cx: number,
    cy: number,
    rad: number,
    flat: number,
    al: number,
  ): void => {
    if (al <= 0.0015 || rad <= 0) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, flat);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
    g.addColorStop(0, rgba(p.accent, a(al)));
    g.addColorStop(0.46, rgba(p.accent, a(al * 0.44)));
    g.addColorStop(0.74, rgba(p.accent, a(al * 0.13)));
    g.addColorStop(1, rgba(p.accent, 0));
    ctx.fillStyle = g;
    // Bounds taken in LOCAL space, where the gradient is still circular —
    // computing them post-scale crops a squashed pool along its long axis.
    ctx.fillRect(-rad * 1.6, -rad * 1.6, rad * 3.2, rad * 3.2);
    ctx.restore();
  };

  // Spill: shrinking, brightening, progressively rounder copies sliding from
  // the canvas centre toward the light — a lopsided ramp of heat, never
  // concentric rings.
  const spill: Array<[number, number, number, number]> = [
    [1.25, 0.1, 0.05, 0.0],
    [0.92, 0.13, 0.055, 0.3],
    [0.62, 0.16, 0.06, 0.6],
    [0.4, 0.2, 0.062, 0.82],
    [0.24, 0.25, 0.06, 1.0],
  ];
  for (let i = 0; i < spill.length; i++) {
    const [rf, flat, al, pull] = spill[i];
    pool(
      W * 0.5 + (lightX - W * 0.5) * pull,
      bedY + (lightY - bedY) * pull,
      R * rf,
      flat,
      al * breath,
    );
  }

  // The bed of the glow: overlapping pools bunched toward the light on a
  // signed power curve, each breathing on its own phase — coals never pulse
  // in unison, and unison reads as the whole band blinking.
  const bedCount = Math.round(16 + 10 * D);
  for (let i = 0; i < bedCount; i++) {
    const s = f.rnd(i, 101) * 2 - 1;
    const cx = lightX + Math.sign(s) * Math.pow(Math.abs(s), 1.35) * W * 0.82;
    const cy = bedY + (f.rnd(i, 102) - 0.5) * H * 0.11;
    const size = f.rnd(i, 103);
    const rad = R * (0.035 + size * size * 0.19);
    const glow =
      1 + alive * Math.sin(t * (0.24 + f.rnd(i, 104) * 0.5) + f.rnd(i, 105) * 9) * 0.28;
    const heat = 0.22 + lit(cx, cy) * 0.9;
    pool(
      cx,
      cy,
      rad,
      0.12 + f.rnd(i, 106) * 0.16,
      (0.02 + f.rnd(i, 107) * 0.035) * heat * glow * breath,
    );
  }

  // Veils over the mass, so no individual pool can be counted, plus one flat
  // haze just above the floor to put a soft warm ground under the stems.
  pool(lightX, bedY, R * 0.8, 0.11, 0.028 * breath);
  pool(lightX, bedY - H * 0.04, R * 0.45, 0.16, 0.03 * breath);
  pool(lightX, bedY - H * 0.13, R * 0.8, 0.28, 0.03 * breath);

  // ---------------------------------------------------------------------
  // THE LILIES — layout first, then stems, then blossoms.
  //
  // Layout is computed once so the stem pass and the blossom pass agree on
  // where every flower is and how it is currently swaying. Two ranks along
  // the lower third — a far rank, smaller and dimmer, and a mid rank carrying
  // the picture — plus one or two near-camera giants cut by the frame edge.
  // ---------------------------------------------------------------------
  interface Lily {
    x: number;
    y: number;
    L: number; // petal length — the blossom's whole scale hangs off this
    al: number;
    soft: number; // 0 = in the picture plane, 1 = just in front of the lens
    seed: number;
    sway: number; // current lean in radians; stem tops follow it
    stemW: number;
  }

  const lilies: Lily[] = [];
  const nBloss = 5 + Math.round(3 * D); // 5..8, per the reference
  const nFar = Math.ceil(nBloss / 2);

  for (let i = 0; i < nBloss; i++) {
    const far = i < nFar;
    const seed = i + 1;
    // Positions are seeded, not evenly spaced — an even row reads as a fence.
    const x = W * (0.06 + f.rnd(seed, 501) * 0.88);
    const y = far
      ? bedY - H * (0.03 + f.rnd(seed, 502) * 0.09)
      : bedY + H * (0.0 + f.rnd(seed, 503) * 0.09);
    const L = far
      ? H * (0.07 + f.rnd(seed, 504) * 0.03)
      : H * (0.105 + f.rnd(seed, 505) * 0.05);
    // Blossoms standing in the backlight carry more of it — same single rule
    // as everything else in the file.
    const al = (far ? 0.09 : 0.15) * (0.55 + lit(x, y) * 0.75);
    // Barely-perceptible sway; the far rank sways a touch less, being
    // notionally further from the draught.
    const sway =
      alive *
      Math.sin(t * (0.13 + f.rnd(seed, 506) * 0.09) + seed * 5.1) *
      (far ? 0.02 : 0.03);
    lilies.push({
      x,
      y,
      L,
      al,
      soft: 0,
      seed,
      sway,
      stemW: far ? 1.4 : 2.1,
    });
  }

  // The near rank: much larger, softer, dimmer, deliberately half out of
  // frame — the clip installed at the top of the painter is what cuts them.
  const nGiant = 1 + Math.round(D);
  for (let g = 0; g < nGiant; g++) {
    const seed = 40 + g;
    const left = g === 0 ? f.rnd(seed, 511) < 0.5 : f.rnd(seed, 511) >= 0.5;
    lilies.push({
      x: left ? W * (0.02 + f.rnd(seed, 512) * 0.08) : W * (0.9 + f.rnd(seed, 512) * 0.08),
      y: H * (0.86 + f.rnd(seed, 513) * 0.1),
      L: H * (0.26 + f.rnd(seed, 514) * 0.07),
      al: 0.075,
      soft: 1,
      seed,
      sway: alive * Math.sin(t * 0.11 + seed * 3.3) * 0.016,
      stemW: 3.2,
    });
  }

  // ---------------------------------------------------------------------
  // PASS 3 — STEMS. Source-over, because a silhouette must REMOVE light and
  // `lighter` cannot subtract. Each stem is three layered bezier passes of
  // decreasing width at low alpha — one stroke would give it two hard sides,
  // and a hard 1px edge on a 768px canvas upscaled 3x aliases into a wire.
  // ---------------------------------------------------------------------
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineCap = 'round';

  for (let i = 0; i < lilies.length; i++) {
    const ly = lilies[i];
    // A seeded lean survives a frozen frame; sway rides on top of it. The
    // whole curve is a gentle C — spider lily stems are near-straight, and an
    // S-curve here reads as a vine, which is a different plant.
    const bend = (f.rnd(ly.seed, 521) - 0.5) * W * 0.06;
    const topX = ly.x + ly.sway * ly.L * 2.2;
    const topY = ly.y + ly.L * 0.12;
    const widths = [2.6, 1.55, 1.0];
    const alphas = [0.09, 0.14, 0.2];
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = rgba(p.shade, a(alphas[k] * (ly.soft > 0 ? 0.7 : 1)));
      ctx.lineWidth = ly.stemW * widths[k];
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.bezierCurveTo(
        ly.x + bend * 0.45,
        ly.y + (H - ly.y) * 0.38,
        ly.x - bend * 0.35,
        ly.y + (H - ly.y) * 0.74,
        ly.x + bend * 0.2,
        H + 8,
      );
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------------
  // PASS 4 — BLOSSOMS. Additive again: petals are made of light against the
  // dark air, and where two overlap they genuinely brighten.
  // ---------------------------------------------------------------------
  ctx.globalCompositeOperation = 'lighter';

  /**
   * One petal, in local space with +x pointing outward: a filled tapered
   * bezier that arcs up toward a recurved tip. The fill fades to zero before
   * the path's own tip, so the petal has NO drawn edge anywhere — soft filled
   * shapes are the whole strategy on a small upscaled canvas, where any thin
   * stroke smears.
   */
  const petal = (L: number, w: number, curl: number, base: number): void => {
    const g = ctx.createLinearGradient(0, 0, L, -curl);
    g.addColorStop(0, rgba(p.accent, a(base)));
    g.addColorStop(0.5, rgba(p.accent, a(base * 0.55)));
    g.addColorStop(0.92, rgba(p.accent, a(base * 0.14)));
    g.addColorStop(1, rgba(p.accent, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(L * 0.3, -w - L * 0.02, L * 0.72, -curl * 0.55 - w, L, -curl);
    ctx.bezierCurveTo(L * 0.7, -curl * 0.45 + w * 0.6, L * 0.28, w, 0, 0);
    ctx.closePath();
    ctx.fill();
  };

  const drawLily = (ly: Lily): void => {
    const { L, al, soft, seed } = ly;
    const salt = seed * 31;
    // 6..9 petals, 5..7 filaments, and a per-blossom swirl direction so the
    // recurve does not read as one repeated stamp across the frame.
    const nPetals = 6 + Math.round(f.rnd(seed, 531) * 3);
    const nFils = 5 + Math.round(f.rnd(seed, 532) * 2);
    const swirl = f.rnd(seed, 533) < 0.5 ? 1 : -1;
    const dim = soft > 0 ? 0.75 : 1;

    ctx.save();
    ctx.translate(ly.x, ly.y);
    // Seeded tilt (survives freezing) plus the barely-perceptible sway.
    ctx.rotate((f.rnd(seed, 534) - 0.5) * 0.5 + ly.sway);

    // A soft halo behind the whole burst, so the blossom sits IN the glowing
    // air instead of being pasted onto it. Near-camera blossoms get a wider,
    // fainter one — out-of-focus is painted as bigger and dimmer, nothing else.
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, L * (1.1 + soft * 0.4));
    halo.addColorStop(0, rgba(p.accent, a(al * 0.5 * dim)));
    halo.addColorStop(0.55, rgba(p.accent, a(al * 0.18 * dim)));
    halo.addColorStop(1, rgba(p.accent, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, L * (1.1 + soft * 0.4), 0, TAU);
    ctx.fill();

    // PETALS. Angle, length and width all jittered per petal: the jitter IS
    // the flower — a regular burst is an asterisk.
    for (let i = 0; i < nPetals; i++) {
      const ang =
        (i / nPetals) * TAU + (f.rnd(i + salt, 541) - 0.5) * (TAU / nPetals) * 0.55;
      const len = L * (0.78 + f.rnd(i + salt, 542) * 0.42);
      const w = len * (0.1 + f.rnd(i + salt, 543) * 0.05) * (1 + soft * 0.3);
      const curl = len * (0.26 + f.rnd(i + salt, 544) * 0.14) * swirl;
      ctx.save();
      ctx.rotate(ang);
      petal(len, w, curl, al * (0.75 + f.rnd(i + salt, 545) * 0.4) * dim);
      ctx.restore();
    }

    // Core: a small gradient heart where the petals meet. Accent only — the
    // brief admits `sheen` at the anther tips and nowhere else.
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, L * 0.18);
    core.addColorStop(0, rgba(p.accent, a(al * 0.9 * dim)));
    core.addColorStop(0.5, rgba(p.accent, a(al * 0.35 * dim)));
    core.addColorStop(1, rgba(p.accent, 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, L * 0.18, 0, TAU);
    ctx.fill();

    // FILAMENTS — the reference's signature. Long arcs reaching well past the
    // petals, drawn as two passes (wide-and-faint under narrow-and-brighter)
    // with an alpha gradient along their length, so they taper and stay soft
    // instead of scratching the canvas. They sway slightly more than the
    // blossom does: the sway term below is theirs alone.
    for (let k = 0; k < nFils; k++) {
      const th = (k / nFils) * TAU + (f.rnd(k + salt, 551) - 0.5) * 0.6;
      const r1 = L * (1.35 + f.rnd(k + salt, 552) * 0.55);
      const bow = L * 0.32 * swirl * (0.7 + f.rnd(k + salt, 553) * 0.6);
      const fsway =
        alive *
        Math.sin(t * (0.22 + f.rnd(k + salt, 554) * 0.15) + k * 2.7 + seed) *
        L *
        0.05;
      const cs = Math.cos(th);
      const sn = Math.sin(th);
      const bx = cs * L * 0.14;
      const by = sn * L * 0.14;
      const mx = cs * r1 * 0.55 - sn * (bow * 0.6 + fsway * 0.5);
      const my = sn * r1 * 0.55 + cs * (bow * 0.6 + fsway * 0.5);
      const ex = cs * r1 - sn * (bow + fsway);
      const ey = sn * r1 + cs * (bow + fsway);

      const lw = Math.max(1.1, L * 0.022);
      for (let pass = 0; pass < 2; pass++) {
        const av = (pass === 0 ? 0.16 : 0.4) * al * dim;
        const sg = ctx.createLinearGradient(bx, by, ex, ey);
        sg.addColorStop(0, rgba(p.accent, a(av)));
        sg.addColorStop(0.65, rgba(p.accent, a(av * 0.6)));
        sg.addColorStop(1, rgba(p.accent, a(av * 0.22)));
        ctx.strokeStyle = sg;
        ctx.lineWidth = pass === 0 ? lw * 2.6 : lw;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.stroke();
      }

      // The anther: a tiny bright tip, and the scene's ONLY use of `sheen`.
      const ar = L * 0.055;
      const ag = ctx.createRadialGradient(ex, ey, 0, ex, ey, ar);
      ag.addColorStop(0, rgba(p.sheen, a(al * 0.9 * dim)));
      ag.addColorStop(0.35, rgba(p.accent, a(al * 0.55 * dim)));
      ag.addColorStop(1, rgba(p.accent, 0));
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.arc(ex, ey, ar, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  };

  // Far rank first, then mid, then the near giants — painter's order is the
  // depth order, so a near blossom's halo lies over a far one's filaments.
  for (let i = 0; i < lilies.length; i++) drawLily(lilies[i]);

  // ---------------------------------------------------------------------
  // PASS 5 — THE AIR. A faint remnant of the ember field, reading as sparks
  // drifting among the flowers, and two or three detached petals adrift.
  // Kept scarce: this is the scene's one "alive" cue, and multiplying it
  // turns the picture into weather.
  // ---------------------------------------------------------------------
  const sparks = Math.round(10 + 12 * D);
  for (let i = 0; i < sparks; i++) {
    const seed = f.rnd(i, 61);
    const life = 9 + f.rnd(i, 62) * 11;
    // Seeded phase offset: the field is fully populated at t = 0, so a frozen
    // frame is a plausible instant, not a starting gun.
    const prog = (seed + t / life) % 1;
    // Position, not velocity — `prog^1.6` is the acceleration a thermal gives
    // a spark, expressed in a form that freezes correctly when `t` does.
    const climb = Math.pow(prog, 1.6);
    const y = bedY + H * 0.02 - climb * H * (0.45 + f.rnd(i, 63) * 0.5);
    const splay = (f.rnd(i, 64) - 0.5) * W * 0.16;
    const swayS =
      alive * Math.sin(t * (0.35 + f.rnd(i, 65) * 0.5) + seed * 11) * W * 0.03;
    const x = lightX + (f.rnd(i, 66) - 0.5) * W * 0.9 + (splay + swayS) * climb;
    if (y < -H * 0.05 || x < -W * 0.06 || x > W * 1.06) continue;

    const born = Math.min(1, prog / 0.07);
    const cool = Math.pow(Math.max(0, 1 - prog), 2.1);
    // Forced to zero well before the top edge: headings live up there, and a
    // spark vanishing at the frame edge reads as clipped, not burnt out.
    const ceiling = clamp01((y - H * 0.05) / (H * 0.2));
    const flick =
      1 + alive * Math.sin(t * (4.5 + f.rnd(i, 67) * 5) + seed * 21) * 0.3;
    const al = 0.07 * (0.5 + f.rnd(i, 68) * 0.6) * born * cool * ceiling * flick;
    if (al <= 0.004) continue;

    const rad = 0.9 + f.rnd(i, 69) * 1.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 3.2);
    g.addColorStop(0, rgba(p.accent, a(al)));
    g.addColorStop(0.35, rgba(p.accent, a(al * 0.45)));
    g.addColorStop(1, rgba(p.accent, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad * 3.2, 0, TAU);
    ctx.fill();
  }

  // Detached petals. Their sway and spin are functions of `prog`, hence of
  // `t` — positions, so they freeze correctly with no `alive` gate needed.
  for (let i = 0; i < 3; i++) {
    const seed = f.rnd(i, 71);
    const life = 14 + f.rnd(i, 72) * 8;
    const prog = (seed + t / life) % 1;
    const x0 = W * (0.12 + f.rnd(i, 73) * 0.76);
    const y = bedY - H * 0.02 - prog * H * 0.5;
    const x = x0 + Math.sin(prog * TAU * (1.5 + f.rnd(i, 74)) + seed * 9) * W * 0.045;
    const rot = seed * TAU + prog * TAU * (1 + f.rnd(i, 75)) * (f.rnd(i, 77) < 0.5 ? -1 : 1);
    // Sine envelope: born from nothing near the flowers, gone before the top.
    const fade = Math.sin(prog * Math.PI);
    const pl = H * (0.018 + f.rnd(i, 76) * 0.013);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    petal(pl, pl * 0.16, pl * 0.3, 0.1 * fade);
    ctx.restore();
  }

  // ---------------------------------------------------------------------
  // PASS 6 — CLOSE THE FRAME. Guarantees the edges, corners and top stay
  // dark and low-contrast wherever chrome and text actually sit.
  // ---------------------------------------------------------------------
  ctx.globalCompositeOperation = 'source-over';

  // Vignette anchored on the glow, not the canvas centre: the surrounding
  // dark then feels *caused* by the backlight's falloff, and the corners are
  // simply the points furthest from the one light in the scene. This is also
  // what softens and dims the near-camera blossoms it lies over.
  const vig = ctx.createRadialGradient(lightX, lightY, R * 0.08, lightX, lightY, R * 1.1);
  vig.addColorStop(0.0, rgba(p.shade, 0));
  vig.addColorStop(0.36, rgba(p.shade, a(0.06)));
  vig.addColorStop(0.62, rgba(p.shade, a(0.2)));
  vig.addColorStop(0.84, rgba(p.shade, a(0.4)));
  vig.addColorStop(1.0, rgba(p.shade, a(0.58)));
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // The lid: closes the top over the bleed and the last sparks so the page's
  // own text stays the highest-contrast thing on screen. Ends on zero over a
  // long tail, so there is no line where it stops.
  const lid = ctx.createLinearGradient(0, 0, 0, H * 0.5);
  lid.addColorStop(0.0, rgba(p.shade, a(0.42)));
  lid.addColorStop(0.35, rgba(p.shade, a(0.2)));
  lid.addColorStop(0.68, rgba(p.shade, a(0.07)));
  lid.addColorStop(1.0, rgba(p.shade, 0));
  ctx.fillStyle = lid;
  ctx.fillRect(0, 0, W, H * 0.5);

  ctx.restore();

  // Belt and braces: the contract says a painter hands the context back clean.
  // `restore()` only unwinds what this painter pushed — if a caller ever
  // enters with dirty state, the next scene would inherit it.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};
