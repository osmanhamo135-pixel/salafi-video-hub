import { rgba, type ScenePainter, type SceneFrame } from './types';

/**
 * NIGHT — a real night sky, painted rather than drawn.
 *
 * The scene owns the whole frame, not a band of it. Reading top to bottom it
 * is: a full-height graded body that is deepest overhead and lifts toward a
 * scattered glow at the ground line, a broad soft light source at the
 * composition's focus that every later form answers to, three enormous sheets
 * of nebulosity so the dark parts of the frame are *something* rather than
 * empty, a milky band built from overlapping lobes with knots and dust lanes
 * in it, four ranks of stars at four depths, and finally the horizon haze
 * veiling the lowest reach.
 *
 * Three rules govern every line below, and each of them is the difference
 * between a night sky and a dark rectangle with dots on it:
 *
 *   1. NOTHING IS A SHAPE. Every mass — a nebula, a lobe of the band, a
 *      star's bloom — is an accumulation of many low-alpha gradients that
 *      overlap. Draw any of them as one primitive with its own bright core and
 *      the eye immediately counts the primitives and the frame reads as
 *      clip-art. The density of a form is the density of its overlaps.
 *   2. NOTHING ENDS ON A STEP. Every gradient carries a long tail to zero and
 *      every field fades out before its wrap boundary. At 768x448 upscaled
 *      about 3x, a stop that still has alpha in it becomes a visible seam
 *      straight across the frame, and a sky with a seam in it is not a sky.
 *   3. ONE LIGHT. `lit()` brightens whatever sits near (focusX, focusY) and
 *      lets whatever is far from it fall away, and `extinction()` thins
 *      everything toward the ground line. Between them, no two forms in the
 *      frame can disagree about where the light is or how much air is in the
 *      way — which is most of what makes a painted sky read as a real one.
 *
 * There is no object in this file, animate or otherwise: only gas, dust,
 * scattered light and points of light.
 */

const TAU = Math.PI * 2;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Hermite ease. Used everywhere a falloff must not show a seam. */
const smooth01 = (v: number): number => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};

/**
 * A soft elliptical blob: a radial gradient on the unit circle, squashed and
 * rotated into place.
 *
 * Every large form in this scene goes through here — nebula, band lobe, dust
 * lane, star halo, diffraction spike are all this one primitive at different
 * aspect ratios and alphas. Filling an ellipse *path* with a flat colour would
 * give a visible rim; filling a scaled radial gradient means the edge is the
 * gradient's own falloff, so there is no edge at all.
 *
 * Four stops, not three. `core` is where the plateau ends, then the ramp drops
 * to a sixth of its strength and only then runs out — that third stop is the
 * long tail, and without it the blob stops while it still has alpha and the
 * ellipse becomes visible as an ellipse.
 */
const softBlob = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  angle: number,
  triple: string,
  alpha: number,
  core: number,
): void => {
  if (alpha <= 0.0015 || rx <= 0.01 || ry <= 0.01) return;
  const c = core < 0.06 ? 0.06 : core > 0.62 ? 0.62 : core;
  ctx.save();
  ctx.translate(cx, cy);
  if (angle !== 0) ctx.rotate(angle);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, rgba(triple, alpha));
  g.addColorStop(c, rgba(triple, alpha * 0.46));
  g.addColorStop(c + (1 - c) * 0.45, rgba(triple, alpha * 0.15));
  g.addColorStop(1, rgba(triple, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();
};

export const paintNight: ScenePainter = (f: SceneFrame) => {
  const { ctx, W, H, palette: p, comp } = f;

  /**
   * Local time. Every animated quantity below is a function of `t` and
   * nothing else, so `speed === 0` freezes the world exactly — no drift, no
   * twinkle, not even a sub-pixel wobble. The Qur'an reading route relies on
   * this: motion behind Qur'anic text is not allowed, and it switches motion
   * off by handing us speed 0 rather than by unmounting the scene.
   */
  const t = f.t * comp.speed;

  /**
   * The one place opacity is decided. `level` is the user's motion/dim
   * preference and `weight` is the section's own restraint; folding them into
   * a single factor here means no later line can accidentally paint at full
   * strength on a page that asked to be quiet.
   */
  const A = f.level * comp.weight;
  if (A <= 0.001) return;

  const hy = comp.horizon * H; // the world's ground line, in pixels
  const fx = clamp01(comp.focusX) * W;
  const fy = clamp01(comp.focusY) * H;
  const dens = clamp01(comp.density);
  const diag = Math.hypot(W, H);

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  /* ------------------------------------------------------------------ *
   * ATMOSPHERE — the two functions everything else is multiplied by.
   * ------------------------------------------------------------------ */

  /**
   * Extinction. Real stars and real nebulosity dim toward the ground line
   * because there is more air in the way, and reproducing that is what gives
   * the sky a top and a bottom instead of the uniform speckle of a wallpaper
   * tile. It also keeps bright points out of the lower frame, where the
   * densest body text sits.
   *
   * The ramp is anchored to the horizon but is deliberately CONTINUOUS across
   * it. An earlier version multiplied by a constant below `hy`, which put a
   * hard line across the frame where star brightness stepped down threefold —
   * exactly the kind of seam rule 2 exists to forbid. Below the ground line
   * the sky is not cut off, it just keeps thinning.
   */
  const skyTop = Math.min(H * 0.12, Math.max(0, hy) * 0.25);
  const skySpan = Math.max(H * 0.35, hy + H * 0.12 - skyTop);
  const extinction = (y: number): number => 1 - 0.92 * smooth01((y - skyTop) / skySpan);

  /**
   * The light. One broad source at the composition's focus; `lit` returns 1
   * on top of it and falls to 0 across most of the diagonal. Every lobe, every
   * cloud and every star is scaled by some blend of this, which is why the
   * frame has a bright quarter and a deep one instead of being evenly lit.
   */
  const lit = (x: number, y: number): number =>
    1 - smooth01(Math.hypot(x - fx, y - fy) / (diag * 0.86));

  /** Light response for the big diffuse forms: never off, never doubled. */
  const litSoft = (x: number, y: number): number => 0.5 + 0.75 * lit(x, y);
  /** Extinction response for the big diffuse forms — gentler than for points. */
  const airSoft = (y: number): number => 0.4 + 0.6 * extinction(y);

  /* ------------------------------------------------------------------ *
   * PASS 1 — THE BODY.
   *
   * Three full-height ramps, not one. A single dark-to-light gradient reads as
   * a flat ramp; a night sky is deepest overhead, loses that depth quickly
   * through the upper third, and then holds a long slow lift down to a
   * horizon that is never black, because the ground scatters light back up
   * into the air.
   *
   * `deep` supplies the fast top-end falloff. `cold` gives the body its
   * night colour and dies out lower down. `lift` runs the other way — zero
   * overhead, strongest around the ground line — and it is anchored to `hy`
   * so a section with a high horizon gets its glow high. All three run the
   * FULL height and all three end on zero: stopping any of them at hy would
   * leave a horizontal edge where the last stop still had alpha.
   * ------------------------------------------------------------------ */
  const deep = ctx.createLinearGradient(0, 0, 0, H);
  deep.addColorStop(0.0, rgba(p.shade, 0.52 * A));
  deep.addColorStop(0.2, rgba(p.shade, 0.31 * A));
  deep.addColorStop(0.44, rgba(p.shade, 0.155 * A));
  deep.addColorStop(0.66, rgba(p.shade, 0.065 * A));
  deep.addColorStop(0.85, rgba(p.shade, 0.018 * A));
  deep.addColorStop(1.0, rgba(p.shade, 0));
  ctx.fillStyle = deep;
  ctx.fillRect(0, 0, W, H);

  const cold = ctx.createLinearGradient(0, 0, 0, H);
  cold.addColorStop(0.0, rgba(p.teal, 0.3 * A));
  cold.addColorStop(0.24, rgba(p.teal, 0.21 * A));
  cold.addColorStop(0.5, rgba(p.turquoise, 0.115 * A));
  cold.addColorStop(0.72, rgba(p.turquoise, 0.055 * A));
  cold.addColorStop(0.88, rgba(p.turquoise, 0.018 * A));
  cold.addColorStop(1.0, rgba(p.turquoise, 0));
  ctx.fillStyle = cold;
  ctx.fillRect(0, 0, W, H);

  // The ground-scatter lift. Stop positions are fractions of the canvas and
  // are derived from hy rather than fixed: `hRel` is where the ground line
  // falls, the ramp peaks just above it, and it tails away in both directions.
  //
  // `step` forces the offsets to stay strictly increasing. A section may put
  // its horizon anywhere from the top of the frame to the bottom, and at the
  // extremes two of these expressions collide; a gradient whose stops arrive
  // out of order is re-sorted by the implementation and the ramp comes out
  // inverted in that one composition only, which is exactly the kind of bug
  // that survives a five-theme sweep unnoticed.
  const hRel = clamp01(hy / H);
  const lift = ctx.createLinearGradient(0, 0, 0, H);
  let at = 0;
  const step = (v: number): number => {
    at = Math.min(0.999, Math.max(at + 0.004, v));
    return at;
  };
  lift.addColorStop(0, rgba(p.turquoise, 0));
  lift.addColorStop(step(Math.max(0.02, hRel - 0.62)), rgba(p.turquoise, 0));
  lift.addColorStop(step(at + (hRel - at) * 0.55), rgba(p.turquoise, 0.038 * A));
  lift.addColorStop(step(hRel - 0.03), rgba(p.turquoise, 0.085 * A));
  lift.addColorStop(step(hRel + 0.1), rgba(p.soft, 0.055 * A));
  lift.addColorStop(1, rgba(p.soft, 0.012 * A));
  ctx.fillStyle = lift;
  ctx.fillRect(0, 0, W, H);

  /* ------------------------------------------------------------------ *
   * PASS 2 — THE LIGHT SOURCE.
   *
   * Two very wide, very soft radials with no tight core. A bright centre
   * would read as a moon, i.e. a foreground object competing with the text.
   * What is wanted is not a disc but the *evidence* of one: a broad lift in
   * luminance that motivates every lit edge in the rest of the frame. Delete
   * this and the band's bright side and the nebulae's bright side stop being
   * caused by anything and the picture goes flat.
   * ------------------------------------------------------------------ */
  const halo = ctx.createRadialGradient(fx, fy, 0, fx, fy, diag * 0.95);
  halo.addColorStop(0.0, rgba(p.accent, 0.1 * A));
  halo.addColorStop(0.3, rgba(p.accent, 0.05 * A));
  halo.addColorStop(0.62, rgba(p.sheen, 0.022 * A));
  halo.addColorStop(0.85, rgba(p.sheen, 0.007 * A));
  halo.addColorStop(1.0, rgba(p.sheen, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, diag * 0.36);
  glow.addColorStop(0.0, rgba(p.sheen, 0.085 * A));
  glow.addColorStop(0.42, rgba(p.sheen, 0.042 * A));
  glow.addColorStop(0.76, rgba(p.accent, 0.013 * A));
  glow.addColorStop(1.0, rgba(p.accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  /* ------------------------------------------------------------------ *
   * PASS 3 — NEBULOSITY.
   *
   * Three enormous, extremely faint sheets of gas. Individually none of them
   * is visible as a thing; together they stop the dark two-thirds of the
   * frame from being empty, which was the whole complaint about the old
   * scene. Each is six overlapping lobes at 0.02-ish alpha rather than one
   * cloud, so the form has an uneven interior and no locatable centre.
   *
   * They breathe rather than travel: the offset is a sine of `t`, so an
   * object this large never has to wrap, and at speed 0 it is simply still.
   * ------------------------------------------------------------------ */
  const nebula = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    ang: number,
    triple: string,
    alpha: number,
    lobes: number,
    swim: number,
    salt: number,
  ): void => {
    const dx = Math.sin(t * 0.019 + salt * 0.7) * swim;
    const dy = Math.cos(t * 0.013 + salt * 1.3) * swim * 0.45;
    for (let i = 0; i < lobes; i++) {
      const ox = (f.rnd(i, salt) - 0.5) * rx * 1.05;
      const oy = (f.rnd(i, salt + 1) - 0.5) * ry * 1.2;
      const lx = cx + ox + dx;
      const ly = cy + oy + dy;
      const s = 0.5 + f.rnd(i, salt + 2) * 0.85;
      softBlob(
        ctx,
        lx,
        ly,
        rx * s,
        ry * s * (0.65 + f.rnd(i, salt + 3) * 0.7),
        ang + (f.rnd(i, salt + 4) - 0.5) * 1.1,
        triple,
        alpha * litSoft(lx, ly) * airSoft(ly),
        0.16,
      );
    }
  };

  // One sheet wrapped around the light (warm, the brightest), one in the deep
  // upper field away from it, one low and wide over the horizon glow. The
  // three sit at genuinely different scales so the frame has gas at more than
  // one distance.
  nebula(fx * 0.82 + W * 0.09, fy * 0.8 + H * 0.06, W * 0.46, H * 0.3, 0.35, p.accent, 0.026 * A, 6, 9, 5.1);
  nebula(W - fx * 0.7, H * 0.26 + (H * 0.5 - fy) * 0.2, W * 0.34, H * 0.22, -0.5, p.soft, 0.02 * A, 6, 6, 13.7);
  nebula(fx * 0.4 + W * 0.4, hy - H * 0.1, W * 0.55, H * 0.15, 0.08, p.soft, 0.017 * A, 6, 12, 23.3);

  /* ------------------------------------------------------------------ *
   * PASS 4 — THE MILKY BAND.
   *
   * A real arm is not a smudge, it is structure: an uneven ridge of light
   * with brighter knots along it and dark dust lanes cutting across it. So
   * this is built as three ARMS at three scales — a broad faint one behind, a
   * mid one carrying most of the mass, a narrow brighter one in front — each
   * a string of overlapping lobes laid along a shared axis, each drifting
   * along that axis at its own rate. The interference between them is what
   * produces a ragged spine; no single lobe is visible on its own.
   *
   * The axis runs diagonally across the whole frame and both its ends leave
   * the canvas, so the band is a feature of the composition rather than an
   * ellipse sitting in the middle of it. Its angle and anchor lean toward the
   * composition's focus, so a section that puts its light in a corner gets a
   * band that agrees with it instead of the same diagonal every time.
   * ------------------------------------------------------------------ */
  const bandAng = -0.6 + (comp.focusX - 0.5) * 0.3 + (comp.focusY - 0.5) * 0.22;
  const bandCos = Math.cos(bandAng);
  const bandSin = Math.sin(bandAng);
  const bandX = W * 0.47 + (fx - W * 0.5) * 0.34;
  const bandY = H * 0.44 + (fy - H * 0.5) * 0.3;
  const bandHalf = W * 0.95; // both ends fall well outside the canvas

  /** Perpendicular closeness to the band axis, 1 on the spine, 0 well off it. */
  const bandNear = (x: number, y: number): number => {
    const dx = x - bandX;
    const dy = y - bandY;
    return 1 - smooth01(Math.abs(-bandSin * dx + bandCos * dy) / (H * 0.36));
  };

  /**
   * One arm. Lobes are spaced along the axis, jittered off it, and each is
   * faded by a sine envelope that reaches zero at both ends of the wrap span —
   * which is what lets an arm drift forever without a lobe ever popping into
   * existence at the boundary.
   */
  const arm = (
    count: number,
    angOff: number,
    perp: number,
    rx: number,
    ry: number,
    alpha: number,
    triple: string,
    core: number,
    drift: number,
    salt: number,
  ): void => {
    const a = bandAng + angOff;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const span = bandHalf * 2;
    for (let i = 0; i < count; i++) {
      const seed = ((i + 0.5) / count) * span + (f.rnd(i, salt) - 0.5) * span * 0.5;
      const u = ((((seed + t * drift) % span) + span) % span) - bandHalf;
      const env = Math.sin(clamp01((u + bandHalf) / span) * Math.PI);
      if (env <= 0.03) continue;
      const off = perp + (f.rnd(i, salt + 1) - 0.5) * ry * 2.6;
      const lx = bandX + ca * u - sa * off;
      const ly = bandY + sa * u + ca * off;
      if (lx < -rx * 2 || lx > W + rx * 2) continue;
      const s = 0.55 + f.rnd(i, salt + 2) * 0.95;
      softBlob(
        ctx,
        lx,
        ly,
        rx * s,
        ry * (0.6 + f.rnd(i, salt + 3) * 0.85),
        a + (f.rnd(i, salt + 4) - 0.5) * 0.45,
        triple,
        alpha * env * litSoft(lx, ly) * airSoft(ly),
        core,
      );
    }
  };

  // Far arm: widest, faintest, slowest — the halo of the band.
  arm(11, 0.12, H * 0.02, W * 0.19, H * 0.115, 0.03 * A, p.soft, 0.3, 1.4, 61.2);
  // Mid arm: the body of the band, and where most of its value comes from.
  arm(10, -0.05, -H * 0.015, W * 0.15, H * 0.062, 0.042 * A, p.soft, 0.24, -2.6, 71.8);
  // Near arm: half the far arm's width, brighter, fastest — the bright spine
  // riding inside the broad halo. The scale ratio between this and the far arm
  // is the band's own parallax.
  arm(8, 0.03, -H * 0.005, W * 0.1, H * 0.032, 0.05 * A, p.sheen, 0.2, 4.6, 83.4);

  /**
   * Dust lanes. Deliberately `shade` — the same token that deepens the top of
   * the frame — laid ACROSS the band at a different angle from the arms, so
   * they cut the ridge into unequal segments instead of following it. Without
   * them the band is one continuous value along its length and reads as a
   * brush stroke; with them it reads as something with depth inside it.
   */
  arm(5, 0.26, H * 0.01, W * 0.13, H * 0.03, 0.05 * A, p.shade, 0.22, -1.1, 97.6);

  /**
   * Knots. A handful of small, brighter condensations sitting on the spine.
   * They are still blobs with no core to speak of and are heavily modulated by
   * `lit`, so the side of the band nearer the light has the brighter knots.
   */
  const knots = 7;
  for (let i = 0; i < knots; i++) {
    const u = (f.rnd(i, 103.5) - 0.5) * bandHalf * 1.7;
    const off = (f.rnd(i, 104.9) - 0.5) * H * 0.075;
    const kx = bandX + bandCos * u - bandSin * off;
    const ky = bandY + bandSin * u + bandCos * off;
    if (kx < -W * 0.1 || kx > W * 1.1) continue;
    const s = 0.6 + f.rnd(i, 106.1) * 0.9;
    softBlob(
      ctx,
      kx,
      ky,
      W * 0.055 * s,
      H * 0.026 * s,
      bandAng + (f.rnd(i, 107.3) - 0.5) * 0.6,
      p.sheen,
      0.05 * A * litSoft(kx, ky) * airSoft(ky),
      0.18,
    );
  }

  /* ------------------------------------------------------------------ *
   * PASS 5 — FOUR RANKS OF STARS.
   *
   * far   : many, tiny, dim, barely moving — the depth of the sky.
   * mid   : the body of the field, drifting the other way.
   * near  : few, three times the far rank's size, brightest, fastest. The
   *         eye reads differential motion as distance, so this rank is what
   *         actually sells the parallax; the size spread is what stops the
   *         field looking stamped from one die.
   * grain : not a depth at all but a texture — very small points scattered
   *         along the band axis with a bell-shaped falloff off it, so the
   *         band resolves into stars near its spine rather than staying a
   *         wash. This is the rank that makes the band read as structure.
   *
   * Every rank is dimmed by extinction, lifted near the light, and lifted
   * again near the band, so the field is denser and brighter exactly where
   * the painted structures already are. Per-star twinkle phase AND rate: a
   * synchronised field pulses like a UI element, which a background must
   * never do.
   * ------------------------------------------------------------------ */
  const total = Math.round(250 * (0.36 + 0.64 * dens));

  interface Rank {
    count: number;
    salt: number;
    size: number;
    alpha: number;
    drift: number; // px/sec; sign flips per rank for counter-parallax
    twinkle: number; // depth of the alpha modulation, 0 = steady
    round: boolean; // arcs cost more, so only the near rank gets them
    triple: string;
    onBand: boolean;
  }

  const ranks: Rank[] = [
    { count: Math.round(total * 0.56), salt: 11.3, size: 0.75, alpha: 0.26, drift: 0.65, twinkle: 0.16, round: false, triple: p.soft, onBand: false },
    { count: Math.round(total * 0.3), salt: 27.9, size: 1.4, alpha: 0.44, drift: -1.9, twinkle: 0.3, round: false, triple: p.soft, onBand: false },
    { count: Math.round(total * 0.14), salt: 43.1, size: 2.55, alpha: 0.66, drift: 4.4, twinkle: 0.44, round: true, triple: p.sheen, onBand: false },
    { count: Math.round(42 * (0.4 + 0.6 * dens)), salt: 57.7, size: 0.7, alpha: 0.3, drift: 1.15, twinkle: 0.22, round: false, triple: p.soft, onBand: true },
  ];

  const pad = W + 60; // wrap width for the open field, with margin
  const bandSpan = bandHalf * 2;

  for (let ri = 0; ri < ranks.length; ri++) {
    const r = ranks[ri];
    // One fillStyle per rank, with per-star opacity carried on globalAlpha.
    // Building 250 colour strings a frame is the expensive way to do this.
    ctx.fillStyle = rgba(r.triple, 1);
    for (let i = 0; i < r.count; i++) {
      let x: number;
      let y: number;
      let env = 1;

      if (r.onBand) {
        // Along the axis, wrapped over the band span; across it, three
        // averaged samples make a bell, so the grain crowds the spine and
        // thins away from it with no boundary anywhere.
        const seed = f.rnd(i, r.salt) * bandSpan;
        const u = ((((seed + t * r.drift) % bandSpan) + bandSpan) % bandSpan) - bandHalf;
        const bell =
          (f.rnd(i, r.salt + 1) + f.rnd(i, r.salt + 2) + f.rnd(i, r.salt + 3)) / 3 - 0.5;
        const off = bell * H * 0.46;
        x = bandX + bandCos * u - bandSin * off;
        y = bandY + bandSin * u + bandCos * off;
        env = Math.sin(clamp01((u + bandHalf) / bandSpan) * Math.PI);
        if (x < -8 || x > W + 8 || env <= 0.05) continue;
      } else {
        const bx = f.rnd(i, r.salt) * pad;
        // Double modulo because `drift` may be negative.
        x = ((((bx + t * r.drift) % pad) + pad) % pad) - 30;
        y = f.rnd(i, r.salt + 1) * H;
      }

      const ext = extinction(y);
      if (ext <= 0.025) continue;

      const phase = f.rnd(i, r.salt + 4) * TAU;
      const rate = 0.26 + f.rnd(i, r.salt + 5) * 0.55;
      const tw = 1 - r.twinkle + r.twinkle * (0.5 + 0.5 * Math.sin(t * rate + phase));

      // Size jitter within the rank, and a magnitude spread on top of the
      // alpha, so no depth band comes out as one uniform brightness.
      const s = r.size * (0.65 + f.rnd(i, r.salt + 6) * 0.8);
      const mag = 0.5 + f.rnd(i, r.salt + 7) * 0.5;

      ctx.globalAlpha = clamp01(
        r.alpha *
          A *
          ext *
          tw *
          env *
          mag *
          (0.74 + 0.42 * lit(x, y)) *
          (1 + 0.45 * bandNear(x, y)),
      );

      if (r.round) {
        ctx.beginPath();
        ctx.arc(x, y, s, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillRect(x - s * 0.5, y - s * 0.5, s, s);
      }
    }
  }
  ctx.globalAlpha = 1;

  /* ------------------------------------------------------------------ *
   * PASS 6 — THE BRIGHT FEW.
   *
   * Five stars get a halo and a faint diffraction cross. This is the pass
   * that makes the sky feel photographed: a real lens blooms on the brightest
   * points only, and a field where every star is the same magnitude has no
   * hierarchy for the eye to rest on. Held to five, in `accent`, and kept dim
   * — six blooming stars would start competing with the page's own content,
   * which is the one thing a scene may not do.
   *
   * The first two are placed ON the band axis, so the frame's brightest
   * points sit against structure rather than against emptiness; the rest are
   * scattered around the focus so the sky's highlights and the composition's
   * light agree, then nudged apart by hash so they never form a ring.
   * ------------------------------------------------------------------ */
  const blooms = 5;
  for (let i = 0; i < blooms; i++) {
    let bxp: number;
    let byp: number;

    if (i < 2) {
      // Kept to the middle 85% of the axis. The axis is steep enough that a
      // longer reach walks these two off the top of the frame, and a bloom
      // placed to sit inside the band is worth nothing if it is culled.
      const u = (f.rnd(i, 91.3) - 0.5) * bandHalf * 0.85;
      const off = (f.rnd(i, 92.7) - 0.5) * H * 0.13;
      bxp = bandX + bandCos * u - bandSin * off;
      byp = bandY + bandSin * u + bandCos * off;
    } else {
      const ang = f.rnd(i, 77.4) * TAU;
      const rad = 0.2 + f.rnd(i, 78.2) * 0.42;
      bxp = fx + Math.cos(ang) * rad * W * 0.72;
      byp = fy + Math.sin(ang) * rad * H * 0.6;
    }
    if (bxp < -20 || bxp > W + 20 || byp < -20 || byp > H + 20) continue;

    const ext = extinction(byp);
    if (ext <= 0.08) continue;

    // Slow, shallow breathing — a bright star's scintillation is calmer than
    // a faint one's, so this rides at half the rate of the field twinkle.
    const phase = f.rnd(i, 79.6) * TAU;
    const pulse = 0.82 + 0.18 * Math.sin(t * 0.22 + phase);
    const mag = (0.6 + f.rnd(i, 80.1) * 0.4) * ext * pulse * (0.78 + 0.35 * lit(bxp, byp));

    // Halo first, so the core sits inside its own glow, and the halo itself is
    // two nested blobs rather than one — the outer one is the long tail.
    softBlob(ctx, bxp, byp, 26 * mag, 26 * mag, 0, p.accent, 0.1 * A * mag, 0.12);
    softBlob(ctx, bxp, byp, 9 * mag, 9 * mag, 0, p.accent, 0.2 * A * mag, 0.2);

    // Diffraction cross: two very flat blobs rather than two hairlines. A
    // 1px line would smear into a grey dash once the canvas is upscaled;
    // a squashed gradient stays soft at any scale.
    const spike = 36 * mag;
    softBlob(ctx, bxp, byp, spike, 1.1, 0, p.accent, 0.15 * A * mag, 0.1);
    softBlob(ctx, bxp, byp, spike * 0.6, 1.0, Math.PI / 2, p.accent, 0.12 * A * mag, 0.1);

    // The core itself, small and warm.
    ctx.fillStyle = rgba(p.accent, clamp01(0.48 * A * mag));
    ctx.beginPath();
    ctx.arc(bxp, byp, 1.5 * mag, 0, TAU);
    ctx.fill();
  }

  /* ------------------------------------------------------------------ *
   * PASS 7 — THE HORIZON.
   *
   * Air near the ground scatters, so the bottom of a real night frame is
   * always lighter than the top and the stars in it are veiled rather than
   * crisp — which is why this runs AFTER the star ranks. It also closes the
   * composition: without a floor the field simply runs off the bottom edge.
   *
   * Cool tones, `turquoise` under `soft`, because a warm low band would read
   * as dusk and this scene is night. The only warmth allowed down here is the
   * faint pool under the focus, which is the same light source as pass 2 seen
   * through the whole depth of the atmosphere.
   * ------------------------------------------------------------------ */
  const hazeTop = Math.max(0, hy - H * 0.6);
  const hazeBottom = Math.min(H, hy + H * 0.42);
  if (hazeBottom > hazeTop + 1) {
    const haze = ctx.createLinearGradient(0, hazeTop, 0, hazeBottom);
    haze.addColorStop(0.0, rgba(p.turquoise, 0));
    haze.addColorStop(0.4, rgba(p.turquoise, 0.035 * A));
    haze.addColorStop(0.68, rgba(p.turquoise, 0.082 * A));
    haze.addColorStop(0.85, rgba(p.soft, 0.07 * A));
    haze.addColorStop(1.0, rgba(p.soft, 0));
    ctx.fillStyle = haze;
    ctx.fillRect(0, hazeTop, W, hazeBottom - hazeTop);
  }

  // Three stacked pools on the ground line beneath the focus, widest first.
  // This is what keeps the haze from reading as a flat stripe: the band now
  // has a centre and two dark ends, and the centre is under the light.
  softBlob(ctx, fx, hy + H * 0.03, W * 0.8, H * 0.185, 0, p.soft, 0.075 * A, 0.24);
  softBlob(ctx, fx, hy + H * 0.07, W * 0.46, H * 0.1, 0, p.sheen, 0.055 * A, 0.2);
  softBlob(ctx, fx, hy + H * 0.09, W * 0.26, H * 0.055, 0, p.accent, 0.04 * A, 0.16);

  // The lowest reach goes back toward the theme's own page colour so the scene
  // sinks into the layout instead of ending at a visible boundary. Three stops
  // so the dissolve itself has no edge either.
  const foot = ctx.createLinearGradient(0, H * 0.78, 0, H);
  foot.addColorStop(0.0, rgba(p.ground, 0));
  foot.addColorStop(0.45, rgba(p.ground, 0.05 * A));
  foot.addColorStop(0.78, rgba(p.ground, 0.14 * A));
  foot.addColorStop(1.0, rgba(p.ground, 0.22 * A));
  ctx.fillStyle = foot;
  ctx.fillRect(0, H * 0.78, W, H * 0.22);

  // Leave the context exactly as it was found: the next scene in the stack
  // inherits this ctx, and a stray globalAlpha here surfaces as an
  // unexplained fade over there.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
};
