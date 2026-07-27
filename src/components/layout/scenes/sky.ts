/**
 * SKY — the daytime scene.
 *
 * An anime-bright afternoon: deep colour overhead thinning to pale at the
 * horizon, a wide sun-glow that lights the whole frame from one point, and
 * four ranks of cumulus at four depths, plus high cirrus above them.
 *
 * The shape of this file follows the shape of the picture: far things first,
 * near things last, because the whole illusion of depth here is painter's
 * algorithm plus parallax. Nothing is drawn with an outline — cloud edges are
 * gradient falloff, never a stroke — since a stroked edge at this canvas size
 * (768x448, upscaled) turns into a visible wire and the scene stops reading as
 * atmosphere and starts reading as clip-art.
 *
 * For the same reason no gradient in this file is allowed to end on a step.
 * Every ramp — sky body, glow, haze, the horizon dissolve — carries a long
 * tail to zero. A layer that stops while it still has alpha leaves a seam
 * straight across the frame, and a sky with a seam in it is not a sky.
 *
 * Every colour is a palette triple. There is no hue anywhere in this file, so
 * the same code paints a warm dusk theme and a cold night theme correctly.
 */

import type { ScenePainter } from './types';
import { rgba } from './types';

const TAU = Math.PI * 2;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Positive modulo. `%` in JS keeps the sign, which would strand a band's
 *  clouds off-canvas the moment drift went negative. */
const wrap = (v: number, span: number): number => ((v % span) + span) % span;

/** One puff of a cumulus cluster, resolved before any painting happens. */
interface Puff {
  x: number;
  y: number;
  r: number;
}

export const paintSky: ScenePainter = (f) => {
  const { ctx, W, H, palette: p, comp } = f;

  /**
   * Local time. Everything that moves reads only from `t`, never from `f.t`.
   * comp.speed is 0 on the Qur'an reading route, and that must produce a
   * *completely* frozen frame — not a slow one. Any drift term that reached
   * for f.t directly would keep crawling behind the mushaf and break the rule
   * the whole speed control exists to enforce.
   */
  const t = f.t * comp.speed;

  /**
   * The single opacity budget. Artistic alpha is chosen as if the scene were
   * at full strength, then multiplied through here. Keeping this in one
   * constant is what lets the caller dim the scene (reduced-motion, a dim
   * route) without any layer drifting out of proportion with the others.
   */
  const A = f.level * comp.weight;
  if (A <= 0) return;

  const hzY = Math.max(clamp01(comp.horizon) * H, 1);
  const sunX = clamp01(comp.focusX) * W;
  const sunY = clamp01(comp.focusY) * H;
  const d = clamp01(comp.density);

  /**
   * Sparse air is a different *kind* of sky, not just a fainter one: high thin
   * cirrus and lots of open blue. Dense air is a cumulus bank. Interpolating
   * one into the other would give a muddy middle, so the counts move in
   * opposite directions and the cloud alpha follows density too.
   */
  const sparse = d < 0.45;
  const cloudA = 0.55 + d * 0.45;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // ---------------------------------------------------------------------
  // 1. THE SKY BODY
  //
  // Two stacked vertical gradients rather than one. A single gradient from
  // dark to pale reads as a flat ramp; real sky darkens toward the zenith
  // much faster than it pales toward the horizon. The `ground` wash supplies
  // that fast top-end falloff and also sinks the scene into the theme's own
  // page colour, so the canvas never looks pasted on top of the app.
  //
  // Both run the FULL height of the canvas, not down to the horizon. Ending
  // them at hzY put a horizontal edge across the frame where the last stop
  // still carried alpha; the horizon lift below then read as a separate,
  // lighter band. Instead the ramps carry a long tail — the bottom third is
  // all easing — so the sky simply runs out of itself.
  // ---------------------------------------------------------------------
  const zenith = ctx.createLinearGradient(0, 0, 0, H);
  zenith.addColorStop(0.0, rgba(p.ground, 0.42 * A));
  zenith.addColorStop(0.26, rgba(p.ground, 0.15 * A));
  zenith.addColorStop(0.5, rgba(p.ground, 0.07 * A));
  zenith.addColorStop(0.72, rgba(p.ground, 0.028 * A));
  zenith.addColorStop(0.88, rgba(p.ground, 0.008 * A));
  zenith.addColorStop(1.0, rgba(p.ground, 0));
  ctx.fillStyle = zenith;
  ctx.fillRect(0, 0, W, H);

  const blue = ctx.createLinearGradient(0, 0, 0, H);
  blue.addColorStop(0.0, rgba(p.teal, 0.5 * A));
  blue.addColorStop(0.22, rgba(p.teal, 0.37 * A));
  blue.addColorStop(0.46, rgba(p.turquoise, 0.24 * A));
  blue.addColorStop(0.64, rgba(p.turquoise, 0.14 * A));
  blue.addColorStop(0.78, rgba(p.turquoise, 0.075 * A));
  blue.addColorStop(0.9, rgba(p.turquoise, 0.03 * A));
  blue.addColorStop(1.0, rgba(p.turquoise, 0));
  ctx.fillStyle = blue;
  ctx.fillRect(0, 0, W, H);

  // ---------------------------------------------------------------------
  // 2. SUN GLOW
  //
  // Two very wide, very soft radials — deliberately with no tight core. A
  // bright centre would read as a disc, i.e. a foreground object competing
  // with the text, which rule 8 forbids. What is wanted is not a sun but the
  // *evidence* of one: a broad lift in luminance that gives every cloud below
  // a consistent light direction. Delete this and the clouds' lit tops stop
  // being motivated and the whole frame goes flat.
  // ---------------------------------------------------------------------
  const diag = Math.hypot(W, H);

  const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, diag * 0.95);
  halo.addColorStop(0.0, rgba(p.accent, 0.2 * A));
  halo.addColorStop(0.3, rgba(p.accent, 0.1 * A));
  halo.addColorStop(0.65, rgba(p.sheen, 0.04 * A));
  halo.addColorStop(0.85, rgba(p.sheen, 0.012 * A));
  halo.addColorStop(1.0, rgba(p.sheen, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  const core = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, diag * 0.34);
  core.addColorStop(0.0, rgba(p.sheen, 0.24 * A));
  core.addColorStop(0.45, rgba(p.accent, 0.12 * A));
  core.addColorStop(0.78, rgba(p.accent, 0.035 * A));
  core.addColorStop(1.0, rgba(p.accent, 0));
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, W, H);

  // ---------------------------------------------------------------------
  // 3. CUMULUS
  // ---------------------------------------------------------------------

  /**
   * Build one cumulus and paint it in three passes, in this order and no
   * other. The order is the whole difference between a cloud and a string of
   * cotton balls.
   *
   *   pass 1 — SILHOUETTE. Every puff goes down in the same low-alpha pass
   *            (~0.1 each). No puff is opaque and no puff has a bright core;
   *            the body's density is entirely the *accumulation* of ten to
   *            sixteen overlaps. Give a puff its own highlight and the eye
   *            immediately counts the puffs.
   *   pass 2 — BELLY. One broad soft ellipse under the whole mass.
   *   pass 3 — LIT TOP. One broad soft ellipse riding the top edge, pushed
   *            toward the sun.
   *
   * Passes 2 and 3 are per-CLOUD, never per-puff — they are the only thing
   * modelling the form, and modelling applied puff-by-puff is exactly what
   * makes a row of beads. Both are ellipse gradients falling to zero, so they
   * spill a little soft light and shadow past the silhouette rather than
   * stopping on an edge.
   *
   * Radii vary by better than 3:1 and each puff's vertical offset is jittered,
   * so the crown comes out lumpy instead of describing a neat arc.
   */
  const cumulus = (
    cx: number,
    cy: number,
    scale: number,
    count: number,
    alpha: number,
    salt: number,
  ): void => {
    // Light direction for the whole cloud, not per puff: a cluster lit from a
    // single consistent angle reads as one solid; per-puff directions make it
    // shimmer apart into separate bubbles.
    const ldx = sunX - cx;
    const ldy = sunY - cy;
    const llen = Math.hypot(ldx, ldy) || 1;
    const sx = ldx / llen;
    const sy = ldy / llen;

    const spread = scale * 2.7;
    const puffs: Puff[] = [];
    let minX = Infinity;
    let maxX = -Infinity;
    let topY = Infinity;
    let botY = -Infinity;

    for (let i = 0; i < count; i++) {
      const u = count === 1 ? 0.5 : i / (count - 1);
      // Arched baseline: cumulus pile up in the middle and taper at the ends.
      const arch = Math.pow(Math.sin(u * Math.PI), 0.72);
      const jx = (f.rnd(i, salt) - 0.5) * scale * 0.6;
      const jy = (f.rnd(i, salt + 17) - 0.5) * scale * 0.5;
      // 0.42..1.14 from the arch, times 0.72..1.27 of noise: the smallest puff
      // lands near a third of the largest, which is what stops the crown
      // reading as a repeated stamp.
      const r = scale * (0.42 + arch * 0.72) * (0.72 + f.rnd(i, salt + 41) * 0.55);
      const px = cx + (u - 0.5) * 2 * spread + jx;
      // Anchoring each puff by its BASE rather than its centre gives the flat
      // underside real cumulus have, and lets the varied radii push the top
      // edge around freely.
      const py = cy - r * 0.62 - arch * scale * 0.4 + jy;
      puffs.push({ x: px, y: py, r });
      if (px - r < minX) minX = px - r;
      if (px + r > maxX) maxX = px + r;
      if (py - r < topY) topY = py - r;
      if (py + r > botY) botY = py + r;
    }

    // Pass 1 — silhouette. One low alpha, no core, no per-puff light.
    const body = 0.185 * alpha;
    for (let i = 0; i < puffs.length; i++) {
      const q = puffs[i];
      const g = ctx.createRadialGradient(q.x, q.y, q.r * 0.08, q.x, q.y, q.r * 1.14);
      g.addColorStop(0.0, rgba(p.soft, body));
      g.addColorStop(0.52, rgba(p.soft, body * 0.86));
      g.addColorStop(0.8, rgba(p.soft, body * 0.36));
      g.addColorStop(1.0, rgba(p.soft, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r * 1.14, 0, TAU);
      ctx.fill();
    }

    const cw = Math.max(1, maxX - minX);
    const ch = Math.max(1, botY - topY);
    const mx = (minX + maxX) * 0.5;

    // Pass 2 — belly. Cool, broad, low-contrast; a weight cue, not a shape.
    ctx.save();
    ctx.translate(mx - sx * cw * 0.07, botY - ch * 0.3);
    ctx.scale(1, (ch * 0.44) / (cw * 0.52));
    const belly = ctx.createRadialGradient(0, 0, 0, 0, 0, cw * 0.52);
    belly.addColorStop(0.0, rgba(p.shade, 0.24 * alpha));
    belly.addColorStop(0.44, rgba(p.shade, 0.14 * alpha));
    belly.addColorStop(0.76, rgba(p.teal, 0.045 * alpha));
    belly.addColorStop(1.0, rgba(p.teal, 0));
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.arc(0, 0, cw * 0.52, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Pass 3 — lit top. Pushed along the sun vector so the whole cloud, and
    // every other cloud in the frame, is lit from the one place.
    ctx.save();
    ctx.translate(mx + sx * cw * 0.17, topY + ch * 0.34 + sy * ch * 0.1);
    ctx.scale(1, (ch * 0.42) / (cw * 0.5));
    const lit = ctx.createRadialGradient(0, 0, 0, 0, 0, cw * 0.5);
    lit.addColorStop(0.0, rgba(p.sheen, 0.3 * alpha));
    lit.addColorStop(0.42, rgba(p.sheen, 0.16 * alpha));
    lit.addColorStop(0.74, rgba(p.accent, 0.05 * alpha));
    lit.addColorStop(1.0, rgba(p.accent, 0));
    ctx.fillStyle = lit;
    ctx.beginPath();
    ctx.arc(0, 0, cw * 0.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  /**
   * A rank of cumulus at one depth.
   *
   * `span` is the wrap period and is deliberately wider than the canvas by a
   * full cloud diameter at each side, so a cloud always leaves the frame
   * completely before its copy re-enters. Wrapping on W itself would pop a
   * half-cloud into existence at the edge every cycle.
   */
  const band = (
    count: number,
    baseY: number,
    scale: number,
    puffs: number,
    alpha: number,
    drift: number,
    jitterSpan: number,
    salt: number,
  ): void => {
    if (count <= 0) return;
    const margin = scale * 5;
    const span = W + margin * 2;
    const step = span / count;

    for (let i = 0; i < count; i++) {
      const jitterX = (f.rnd(i, salt) - 0.5) * step * 0.5;
      const jitterY = (f.rnd(i, salt + 7) - 0.5) * scale * jitterSpan;
      const sizing = 0.75 + f.rnd(i, salt + 23) * 0.55;
      const x = wrap(i * step + jitterX + t * drift, span) - margin;
      const w = scale * sizing * 5;
      if (x + w < 0 || x - w > W) continue; // cheap cull keeps the budget flat
      cumulus(x, baseY + jitterY, scale * sizing, puffs, alpha, salt + i * 31);
    }
  };

  /**
   * Clip to the sky. Clouds belong above the world's ground line; the slack
   * below hzY exists only so the near band's bellies can dissolve into the
   * horizon fade below instead of meeting a straight cut.
   */
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, hzY + H * 0.06);
  ctx.clip();

  /**
   * Four ranks, and the vertical spread between them is doing as much work as
   * the sizes. Confining cumulus to one band across the middle flattens the
   * frame no matter how well each cloud is modelled: the eye needs cloud at
   * the top edge and cloud at the horizon to read the space between them.
   *
   * So: an overhead rank whose bodies run off the top of the canvas, two
   * middle ranks, and a near rank sitting low and roughly three times the far
   * rank's scale. That size ratio between the highest and lowest thing in the
   * picture is the parallax cue.
   */

  // Overhead: cut off by the top edge, so only the underside is in frame.
  band(
    sparse ? 1 : 2,
    hzY * 0.15,
    Math.max(7, hzY * 0.092),
    12,
    cloudA * 0.5 * A,
    2.5,
    0.9,
    409,
  );

  // Far: small, slow, faint. Distance eats both contrast and detail, and the
  // shallow puff count here is also where the frame budget comes from.
  band(
    sparse ? 3 : Math.round(4 + d * 2),
    hzY * 0.52,
    Math.max(4, hzY * 0.048),
    10,
    cloudA * 0.4 * A,
    1.7,
    1.7,
    3,
  );

  // Mid: the rank that carries the picture. Most of the cumulus mass lives
  // here, at the scale where the belly/top contrast is legible.
  band(
    sparse ? 2 : Math.round(3 + d * 2),
    hzY * 0.74,
    Math.max(6, hzY * 0.085),
    13,
    cloudA * 0.58 * A,
    3.4,
    1.5,
    91,
  );

  // Near: few, large, low, fastest. One or two big forms grazing the horizon
  // is what sells parallax; more than three at this scale would crowd the text.
  band(
    sparse ? 1 : Math.round(2 + d),
    hzY * 0.97,
    Math.max(10, hzY * 0.165),
    15,
    cloudA * 0.66 * A,
    6.1,
    1.0,
    157,
  );

  ctx.restore();

  // ---------------------------------------------------------------------
  // 4. CIRRUS
  //
  // Drawn last but conceptually highest: thin ice streaks well above the
  // cumulus, drifting fastest of all. Each is a radial gradient squashed on
  // one axis under a transform — an ellipse gradient, which has no edge at
  // all. Stroked lines were tried and smear on upscale; this does not.
  // Sparse skies lean on these to stay interesting without adding mass.
  // ---------------------------------------------------------------------
  const cirrusCount = Math.round(4 + (1 - d) * 6);
  const cirrusSpan = W * 1.6;

  for (let i = 0; i < cirrusCount; i++) {
    const y = hzY * (0.06 + f.rnd(i, 211) * 0.34);
    const len = W * (0.16 + f.rnd(i, 233) * 0.22);
    const thin = 0.045 + f.rnd(i, 257) * 0.05;
    const tilt = (f.rnd(i, 271) - 0.5) * 0.16;
    const a = (sparse ? 0.16 : 0.1) * (0.5 + f.rnd(i, 283) * 0.5) * A;
    const x =
      wrap((i / cirrusCount) * cirrusSpan + f.rnd(i, 293) * 90 + t * 9.2, cirrusSpan) -
      W * 0.3;
    if (x + len < 0 || x - len > W) continue;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(1, thin);

    // Wide, near-invisible haze first, then a tighter brighter filament — the
    // two together give a streak a soft shoulder and a defined spine.
    const g1 = ctx.createRadialGradient(0, 0, 0, 0, 0, len);
    g1.addColorStop(0.0, rgba(p.sheen, a));
    g1.addColorStop(0.55, rgba(p.soft, a * 0.4));
    g1.addColorStop(0.82, rgba(p.soft, a * 0.12));
    g1.addColorStop(1.0, rgba(p.soft, 0));
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.arc(0, 0, len, 0, TAU);
    ctx.fill();

    const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, len * 0.55);
    g2.addColorStop(0.0, rgba(p.sheen, a * 1.1));
    g2.addColorStop(0.6, rgba(p.sheen, a * 0.32));
    g2.addColorStop(1.0, rgba(p.sheen, 0));
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(0, 0, len * 0.55, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  // ---------------------------------------------------------------------
  // 4b. BLOSSOM BRANCH — the signature layer.
  //
  // One dark bough enters from the upper corner OPPOSITE the sun, so the
  // light always falls across it instead of from behind it, and forks into a
  // few slender twigs carrying pale five-petal blossoms, with a handful of
  // shed petals adrift below. It owns only the outer quarter of the frame
  // diagonally and its petals stay on its side of the sky, so the reading
  // air in the middle stays clear.
  //
  // Wood is the one place strokes are allowed, and only layered: 2-3 passes
  // of decreasing width and rising alpha read as one painted limb, where a
  // single thin stroke would smear on upscale. Blossoms and petals are all
  // filled beziers under gradients — no outline anywhere.
  //
  // Sway reads only from `t`: at speed 0 every sin() term is a constant and
  // the branch, twigs and airborne petals all freeze mid-pose.
  // ---------------------------------------------------------------------

  /** Growth direction: sun on the left means the branch enters upper-right. */
  const growX = sunX < W * 0.5 ? -1 : 1;
  const ex = growX < 0 ? W + 6 : -6;
  const ey = -6;
  // Sparse air carries a thinner, higher, shorter branch — a different
  // branch, not a faded one, matching how the cloud counts flip above.
  const reach = diag * (sparse ? 0.15 : 0.19);
  const boughW = sparse ? 3 : 4.4;
  const branchA = (0.36 + d * 0.18) * A;
  const blossomA = (sparse ? 0.6 : 0.52) * A;

  /** Cubic bezier on one axis; the bough is one cubic, sampled for forks. */
  const bez = (c0: number, c1: number, c2: number, c3: number, u: number): number => {
    const v = 1 - u;
    return v * v * v * c0 + 3 * v * v * u * c1 + 3 * v * u * u * c2 + u * u * u * c3;
  };

  const bX = [
    ex,
    ex + growX * reach * 0.32,
    ex + growX * reach * 0.7,
    ex + growX * reach * 1.02,
  ];
  const bY = [
    ey,
    ey + reach * 0.16,
    ey + reach * (sparse ? 0.26 : 0.38),
    ey + reach * (sparse ? 0.46 : 0.68),
  ];

  /**
   * Wind. Two incommensurate sines so the sway never loops visibly. The
   * whole branch pivots a fraction of a degree around its entry point; twigs
   * ride the same pivot multiplied up, which is how real wood moves — the
   * limb barely, the extremities more.
   */
  const swayBase = Math.sin(t * 0.42) * 0.006 + Math.sin(t * 0.19 + 2.3) * 0.0045;

  /** One filled teardrop petal: base at (x,y), tip `len` away along `ang`. */
  const petalShape = (
    x: number,
    y: number,
    ang: number,
    len: number,
    wd: number,
    fill: string | CanvasGradient,
  ): void => {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x + ca * len * 0.3 - sa * wd,
      y + sa * len * 0.3 + ca * wd,
      x + ca * len * 0.92 - sa * wd * 0.55,
      y + sa * len * 0.92 + ca * wd * 0.55,
      x + ca * len,
      y + sa * len,
    );
    ctx.bezierCurveTo(
      x + ca * len * 0.92 + sa * wd * 0.55,
      y + sa * len * 0.92 - ca * wd * 0.55,
      x + ca * len * 0.3 + sa * wd,
      y + sa * len * 0.3 - ca * wd,
      x,
      y,
    );
    ctx.fill();
  };

  /**
   * A five-petal blossom. Every petal shares one radial gradient centred on
   * the flower — deeper at the base, palest past the tip — and takes its own
   * length and angle jitter, which is the whole difference between a flower
   * and a stamped icon. Sparse skies bleach the base toward sheen: fewer,
   * whiter blossoms up high.
   */
  const blossom = (x: number, y: number, r: number, alpha: number, salt: number): void => {
    const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * 1.05);
    g.addColorStop(0.0, rgba(sparse ? p.sheen : p.soft, alpha));
    g.addColorStop(0.55, rgba(p.sheen, alpha * 0.8));
    g.addColorStop(1.0, rgba(p.sheen, alpha * 0.42));
    const rot = f.rnd(0, salt) * TAU;
    for (let k = 0; k < 5; k++) {
      const ang = rot + (k / 5) * TAU + (f.rnd(k, salt + 3) - 0.5) * 0.34;
      const len = r * (0.8 + f.rnd(k, salt + 11) * 0.36);
      petalShape(x, y, ang, len, len * 0.36, g);
    }
    const coreG = ctx.createRadialGradient(x, y, 0, x, y, r * 0.32);
    coreG.addColorStop(0.0, rgba(p.accent, alpha * 0.85));
    coreG.addColorStop(1.0, rgba(p.accent, 0));
    ctx.fillStyle = coreG;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.32, 0, TAU);
    ctx.fill();
  };

  // The bough: three passes, widest and faintest first, so the accumulated
  // edge is soft the way the clouds' edges are — no single hard line.
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(swayBase);
  ctx.translate(-ex, -ey);
  ctx.lineCap = 'round';
  const boughPasses: Array<[number, number]> = [
    [1.0, 0.3],
    [0.62, 0.5],
    [0.34, 0.8],
  ];
  for (let i = 0; i < boughPasses.length; i++) {
    ctx.strokeStyle = rgba(p.shade, branchA * boughPasses[i][1]);
    ctx.lineWidth = boughW * boughPasses[i][0];
    ctx.beginPath();
    ctx.moveTo(bX[0], bY[0]);
    ctx.bezierCurveTo(bX[1], bY[1], bX[2], bY[2], bX[3], bY[3]);
    ctx.stroke();
  }
  ctx.restore();

  // Twigs fork alternately above and below the bough's tangent, each with
  // its own angle jitter and a slight gravity droop at the end. Each twig's
  // blossoms are drawn inside the twig's own sway transform, so a flower
  // never detaches from its wood as the wind moves.
  const twigN = sparse ? 3 : 5;
  for (let i = 0; i < twigN; i++) {
    const u0 = 0.34 + (i / (twigN - 1)) * 0.6 + (f.rnd(i, 503) - 0.5) * 0.07;
    const rx = bez(bX[0], bX[1], bX[2], bX[3], u0);
    const ry = bez(bY[0], bY[1], bY[2], bY[3], u0);
    const nx = bez(bX[0], bX[1], bX[2], bX[3], Math.min(1, u0 + 0.02));
    const ny = bez(bY[0], bY[1], bY[2], bY[3], Math.min(1, u0 + 0.02));
    const boughAng = Math.atan2(ny - ry, nx - rx);
    const fork = (i % 2 === 0 ? -1 : 1) * (0.35 + f.rnd(i, 521) * 0.5);
    const ang = boughAng + fork;
    const tl = reach * (0.2 + f.rnd(i, 541) * 0.18) * (sparse ? 0.85 : 1);
    const cx2 = rx + Math.cos(ang) * tl * 0.55;
    const cy2 = ry + Math.sin(ang) * tl * 0.55;
    const tipX = rx + Math.cos(ang) * tl;
    const tipY = ry + Math.sin(ang) * tl + tl * 0.2;

    const swayT = swayBase * 1.5 + Math.sin(t * 0.55 + i * 1.9) * 0.0045;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(swayT);
    ctx.translate(-ex, -ey);
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = rgba(p.shade, branchA * (pass === 0 ? 0.4 : 0.75));
      ctx.lineWidth = boughW * (pass === 0 ? 0.42 : 0.22);
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.quadraticCurveTo(cx2, cy2, tipX, tipY);
      ctx.stroke();
    }

    // Tight buds low on the twig — small filled teardrops, no petals yet.
    const budN = 1 + (f.rnd(i, 563) < 0.5 ? 0 : 1);
    for (let k = 0; k < budN; k++) {
      const v = 0.3 + f.rnd(k, 571 + i * 13) * 0.45;
      const iv = 1 - v;
      const qx = iv * iv * rx + 2 * iv * v * cx2 + v * v * tipX;
      const qy = iv * iv * ry + 2 * iv * v * cy2 + v * v * tipY;
      const bl = 2.6 + f.rnd(k, 577 + i * 13) * 2;
      const bAng = ang + (f.rnd(k, 587 + i * 13) - 0.5) * 1.6;
      const bg = ctx.createRadialGradient(qx, qy, 0, qx, qy, bl);
      bg.addColorStop(0.0, rgba(p.soft, blossomA * 0.9));
      bg.addColorStop(1.0, rgba(p.sheen, blossomA * 0.45));
      petalShape(qx, qy, bAng, bl, bl * 0.42, bg);
    }

    // Open blossoms: the sqrt skew piles them toward the twig tip, they grow
    // slightly with v, and the side facing the sun runs a touch brighter.
    const bn = sparse ? 2 : 3 + (f.rnd(i, 557) < 0.5 ? 0 : 1);
    for (let k = 0; k < bn; k++) {
      const v = 0.4 + 0.6 * Math.sqrt(f.rnd(k, 601 + i * 17));
      const iv = 1 - v;
      const qx = iv * iv * rx + 2 * iv * v * cx2 + v * v * tipX;
      const qy = iv * iv * ry + 2 * iv * v * cy2 + v * v * tipY;
      const rr =
        (sparse ? 3.4 : 4.4) * (0.7 + f.rnd(k, 613 + i * 17) * 0.6) * (0.75 + v * 0.45);
      const lit2 = 0.82 + 0.3 * clamp01(1 - Math.abs(qx - sunX) / (W * 0.9));
      blossom(qx, qy, rr, blossomA * lit2, 617 + i * 29 + k * 7);
    }
    ctx.restore();
  }

  // A small crown at the bough's own tip, swaying a little more than the
  // limb it ends — the extremity again.
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(swayBase * 1.3);
  ctx.translate(-ex, -ey);
  const tipN = sparse ? 1 : 2;
  for (let k = 0; k < tipN; k++) {
    const qx = bX[3] + (f.rnd(k, 641) - 0.5) * 10;
    const qy = bY[3] + (f.rnd(k, 647) - 0.5) * 10;
    const rr = (sparse ? 3.6 : 5) * (0.85 + f.rnd(k, 653) * 0.3);
    const lit2 = 0.82 + 0.3 * clamp01(1 - Math.abs(qx - sunX) / (W * 0.9));
    blossom(qx, qy, rr, blossomA * lit2, 659 + k * 11);
  }
  ctx.restore();

  // Shed petals adrift: scarce by design — this is the single strongest
  // "alive" cue and it works by rarity. Each falls on its own wrapped cycle,
  // sways across the fall, spins slowly either way, and its envelope reaches
  // zero well before the horizon (the destination-out fade below is only a
  // second guarantee). They stay on the branch's side of the sky.
  const driftN = sparse ? 5 : 8;
  const fallSpan = Math.max(hzY * 0.85, 60);
  for (let i = 0; i < driftN; i++) {
    const prog = wrap(f.rnd(i, 701) * fallSpan + t * (5.5 + f.rnd(i, 709) * 4.5), fallSpan);
    const u = prog / fallSpan;
    const env = Math.pow(u, 0.25) * Math.pow(1 - u, 1.4) * 1.7;
    if (env <= 0.01) continue;
    const startX = ex + growX * reach * (0.15 + f.rnd(i, 719) * 1.25);
    const swayP =
      Math.sin(t * (0.45 + f.rnd(i, 727) * 0.35) + i * 2.1) * (7 + f.rnd(i, 733) * 8);
    const px = startX + growX * prog * 0.4 + swayP;
    const py = ey + prog;
    const spin = i * 1.3 + t * (0.35 + f.rnd(i, 739) * 0.4) * (f.rnd(i, 743) < 0.5 ? -1 : 1);
    const plen = 3.6 + f.rnd(i, 751) * 2.8;
    const aP = (sparse ? 0.5 : 0.42) * A * Math.min(1, env);
    const pg = ctx.createRadialGradient(px, py, 0, px, py, plen);
    pg.addColorStop(0.0, rgba(p.soft, aP));
    pg.addColorStop(1.0, rgba(p.sheen, aP * 0.4));
    petalShape(px, py, spin, plen, plen * 0.42, pg);
  }

  // ---------------------------------------------------------------------
  // 5. HORIZON
  //
  // A pale lift around the ground line — distant air scatters light, and
  // without this the sky's lower reach looks like a gradient that simply ran
  // out. It fades in AND back out: an earlier version held 0.14 alpha at its
  // last stop and that bottom edge was the visible seam across the frame.
  //
  // Then a destination-out ramp dissolves the whole scene away over the last
  // stretch of the canvas, reaching full erasure exactly at y = H. Because it
  // starts at zero well above the horizon and eases the whole way down, there
  // is no line anywhere in it — the scene thins out into the page's own
  // background. This also softens the cloud clip above, which is why it runs
  // after the bands.
  // ---------------------------------------------------------------------
  const hazeTop = Math.max(0, hzY - H * 0.3);
  const hazeBottom = Math.min(H, hzY + H * 0.08);
  if (hazeBottom > hazeTop) {
    const haze = ctx.createLinearGradient(0, hazeTop, 0, hazeBottom);
    haze.addColorStop(0.0, rgba(p.sheen, 0));
    haze.addColorStop(0.42, rgba(p.sheen, 0.05 * A));
    haze.addColorStop(0.72, rgba(p.sheen, 0.11 * A));
    haze.addColorStop(0.86, rgba(p.soft, 0.08 * A));
    haze.addColorStop(1.0, rgba(p.soft, 0));
    ctx.fillStyle = haze;
    ctx.fillRect(0, hazeTop, W, hazeBottom - hazeTop);
  }

  const fadeTop = Math.max(0, Math.min(hzY - H * 0.12, H * 0.6));
  if (H > fadeTop) {
    ctx.globalCompositeOperation = 'destination-out';
    const erase = ctx.createLinearGradient(0, fadeTop, 0, H);
    // The colour here is irrelevant to the result — only alpha is read by
    // destination-out — but it still has to come from the palette so no hue
    // is ever literal in this file.
    erase.addColorStop(0.0, rgba(p.ground, 0));
    erase.addColorStop(0.22, rgba(p.ground, 0.14));
    erase.addColorStop(0.45, rgba(p.ground, 0.42));
    erase.addColorStop(0.68, rgba(p.ground, 0.72));
    erase.addColorStop(0.86, rgba(p.ground, 0.92));
    erase.addColorStop(1.0, rgba(p.ground, 1));
    ctx.fillStyle = erase;
    ctx.fillRect(0, fadeTop, W, H - fadeTop);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore();

  // Belt and braces: the caller shares one context across scenes, so leaving
  // either of these dirty would silently corrupt whatever paints next.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};
