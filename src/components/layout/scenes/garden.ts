/**
 * GARDEN — standing inside the foliage, looking out.
 *
 * This is not a wall with vines on it. It is a PLACE: a canopy hanging into the
 * top of the frame, light falling through the gaps in it, three ranks of leaf
 * mass at three distances, and warm air with pollen turning over in it. The
 * earlier version was a flat green wash with ornament laid on top, and it read
 * as wallpaper because nothing in it was in front of or behind anything else.
 *
 * The rules the sky scene established, applied here:
 *
 *   - A FULL-FRAME GRADED BODY. The green owns the whole canvas, deep and
 *     shadowed under the canopy at the top, opening to warm light at the
 *     horizon where the garden clears, closing again into near shadow at the
 *     bottom. Every ramp carries a long tail to zero alpha; a layer that stops
 *     while it still has alpha leaves a seam, and a seam turns a place back
 *     into a swatch.
 *   - ONE LIGHT SOURCE, at (focusX, focusY), and everything answers to it. The
 *     canopy's underside glows where it is near the light and falls dark where
 *     it is not; the beams that are aimed near it are brighter; leaves are lit
 *     by their distance from it; motes brighten inside a beam. That single rule
 *     is most of what makes the frame read as a real space.
 *   - FUSED MASSES, NOT SHAPES. No foliage cluster anywhere in this file is one
 *     drawn shape with its own bright core. Each is five or six overlapping
 *     ellipse-gradients at ~0.06 alpha whose accumulation is the form. Give one
 *     blob a core and the eye instantly counts the blobs, which is exactly the
 *     clip-art failure this scene was rewritten twice to escape.
 *   - NO OUTLINES, NO HARD EDGES. Every gradient in the file reaches zero.
 *
 * Islimi is still here — a long stem that sweeps across and turns over once,
 * split-palmette leaves hanging off it — but it is now the MIDDLE rank only,
 * threaded through the foliage rather than floating on a tint. It is the
 * tradition's own ornamental language and the only figurative vocabulary open
 * to us. There is no animate being anywhere in this file and none may ever be
 * added: leaf, vine, light and air. Nothing that breathes.
 *
 * The SIGNATURE of the scene is the MEADOW: a band of small blossoms across
 * the lower quarter, white and gold over the green, denser at the bottom edge
 * and thinning to nothing by the horizon — the alpine flower carpet of the
 * owner's reference. Three ranks inside the band: far heads are plain soft
 * dots, the middle rank carries real five-petal geometry with per-petal
 * jitter, and a handful of much larger out-of-focus blossoms sit half-cut by
 * the bottom edge. A few detached petals ride the light shafts upward among
 * the pollen. Flowers, petals and leaves only — still nothing that breathes.
 *
 * Every colour is a palette triple. There is no literal hue in this file.
 */

import type { ScenePainter } from './types';
import { rgba } from './types';

const TAU = Math.PI * 2;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Positive modulo — `%` keeps the sign, which would strand a rising mote. */
const wrap01 = (v: number): number => v - Math.floor(v);

interface Pt {
  x: number;
  y: number;
}

/** A resolved beam axis, kept so the motes can ask whether they are inside one. */
interface Beam {
  x: number;
  y: number;
  dx: number;
  dy: number;
  len: number;
  /** Half-width at the beam's mouth, before it widens on the way down. */
  r0: number;
}

/** One islimi sweep, fully resolved before anything is painted. */
interface Stem {
  x0: number;
  y0: number;
  a0: number;
  len: number;
  turn: number;
  dir: number;
  squash: number;
  phase: number;
  swayX: number;
  swayY: number;
  swayAmp: number;
  alpha: number;
  leafLen: number;
}

/** Samples per stem path. Enough to carry the late curl without faceting. */
const SEG = 12;

export const paintGarden: ScenePainter = (f) => {
  const { ctx, W, H, palette: p, comp } = f;

  /**
   * Local time. Nothing in this file may read f.t directly. comp.speed is 0 on
   * the Qur'an reading route and that has to yield a *frozen* frame, not a slow
   * one — motion behind Qur'anic text is forbidden. Every animated term below
   * is a sine or a product of `t`, so at speed 0 they all collapse to constants
   * and the scene is still a composed picture rather than a degenerate one.
   */
  const t = f.t * comp.speed;

  /**
   * The single opacity budget. Artistic alphas are chosen as though the scene
   * were at full strength and multiplied through here exactly once, so the
   * caller can dim the whole world without one layer drifting out of
   * proportion with the rest.
   */
  const A = f.level * comp.weight;
  if (A <= 0) return;

  const hz = clamp01(comp.horizon);
  const hzY = hz * H;
  const lightX = clamp01(comp.focusX) * W;
  const lightY = clamp01(comp.focusY) * H;
  const d = clamp01(comp.density);
  const diag = Math.hypot(W, H);

  /** How much of the light reaches a point. The scene's one lighting model. */
  const lit = (x: number, y: number): number =>
    1 - clamp01(Math.hypot(x - lightX, y - lightY) / (diag * 0.82));

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  /**
   * The workhorse of the whole file: one soft ellipse-gradient, optionally
   * rotated and squashed, always falling to zero alpha at its rim.
   *
   * Everything massy in this scene — canopy, all three foliage ranks, the
   * beams, the motes — is built by overlapping these at low alpha. An ellipse
   * gradient has no edge whatsoever, which is why nothing here is ever a filled
   * shape: a filled shape at this canvas size shows a rim on upscale and the
   * frame stops being atmosphere.
   */
  const blob = (
    x: number,
    y: number,
    r: number,
    sx: number,
    sy: number,
    rot: number,
    tone: string,
    a: number,
  ): void => {
    if (a <= 0.0005 || r <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    if (rot !== 0) ctx.rotate(rot);
    ctx.scale(sx, sy);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0.0, rgba(tone, a));
    g.addColorStop(0.4, rgba(tone, a * 0.66));
    g.addColorStop(0.72, rgba(tone, a * 0.26));
    g.addColorStop(0.9, rgba(tone, a * 0.07));
    g.addColorStop(1.0, rgba(tone, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  // =====================================================================
  // 1. THE BODY OF THE GARDEN
  //
  // Full frame, top to bottom, in three passes. One ramp would read as a
  // gradient swatch; what is wanted is the vertical structure of a place seen
  // from inside it — heavy shadow overhead where the canopy is thick, a warm
  // opening at the horizon where the garden clears, and mass closing back in
  // at the bottom where the near foliage stands.
  // =====================================================================

  // Pass A — the shade the canopy casts. Top-weighted, and it keeps easing all
  // the way to the bottom edge so the scene sinks into the theme's own page
  // colour rather than stopping on a line.
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0.0, rgba(p.ground, 0.54 * A));
  shade.addColorStop(0.18, rgba(p.ground, 0.3 * A));
  shade.addColorStop(0.42, rgba(p.ground, 0.11 * A));
  shade.addColorStop(0.66, rgba(p.ground, 0.04 * A));
  shade.addColorStop(0.85, rgba(p.ground, 0.012 * A));
  shade.addColorStop(1.0, rgba(p.ground, 0));
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  /**
   * Pass B — the green itself, and this is the layer that has to win. It is
   * densest under the canopy, thins as it approaches the horizon (distance and
   * light both eat it), then thickens again below, where the near rank lives.
   *
   * The stop positions are derived from comp.horizon, so the clearing lands
   * where the section's composition says the world's ground line is. hzS is
   * clamped to 0.3..0.9 purely so the derived offsets stay strictly increasing
   * — an out-of-order stop is a silent no-op in some engines and a throw in
   * others.
   */
  const hzS = Math.min(0.9, Math.max(0.3, hz));
  const green = ctx.createLinearGradient(0, 0, 0, H);
  green.addColorStop(0.0, rgba(p.green, 0.5 * A));
  green.addColorStop(0.2, rgba(p.green, 0.36 * A));
  green.addColorStop(hzS * 0.72, rgba(p.green, 0.22 * A));
  green.addColorStop(hzS, rgba(p.teal, 0.13 * A));
  green.addColorStop((hzS + 1) * 0.5, rgba(p.green, 0.19 * A));
  green.addColorStop(1.0, rgba(p.green, 0.27 * A));
  ctx.fillStyle = green;
  ctx.fillRect(0, 0, W, H);

  /**
   * Pass C — the clearing. A warm band around the horizon, fading in AND back
   * out over a long stretch in both directions. This is the "opening to light"
   * the composition asks for; without it the green is one continuous mass and
   * there is nowhere for the eye to rest, which is what made the old version
   * feel like a tint rather than a depth.
   */
  const clearTop = Math.max(0, hzY - H * 0.42);
  const clearBot = Math.min(H, hzY + H * 0.3);
  if (clearBot > clearTop) {
    const clearing = ctx.createLinearGradient(0, clearTop, 0, clearBot);
    clearing.addColorStop(0.0, rgba(p.accent, 0));
    clearing.addColorStop(0.34, rgba(p.accent, 0.035 * A));
    clearing.addColorStop(0.6, rgba(p.accent, 0.085 * A));
    clearing.addColorStop(0.78, rgba(p.sheen, 0.05 * A));
    clearing.addColorStop(1.0, rgba(p.sheen, 0));
    ctx.fillStyle = clearing;
    ctx.fillRect(0, clearTop, W, clearBot - clearTop);
  }

  // =====================================================================
  // 2. THE LIGHT
  //
  // Two very wide radials with no tight core, deliberately. A bright centre
  // would read as a lamp — a foreground object competing with the text. What
  // is wanted is the *evidence* of a sun somewhere past the leaves: a broad
  // lift that thins the green at the focus and gives every mass below it a
  // consistent reason to be brighter on one side. Delete this and the canopy's
  // rim lighting and the beams stop being motivated and the frame goes flat.
  // =====================================================================
  const halo = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, diag * 0.95);
  halo.addColorStop(0.0, rgba(p.accent, 0.15 * A));
  halo.addColorStop(0.3, rgba(p.accent, 0.075 * A));
  halo.addColorStop(0.62, rgba(p.turquoise, 0.03 * A));
  halo.addColorStop(0.85, rgba(p.turquoise, 0.009 * A));
  halo.addColorStop(1.0, rgba(p.turquoise, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  const core = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, diag * 0.36);
  core.addColorStop(0.0, rgba(p.sheen, 0.16 * A));
  core.addColorStop(0.42, rgba(p.accent, 0.07 * A));
  core.addColorStop(0.76, rgba(p.accent, 0.022 * A));
  core.addColorStop(1.0, rgba(p.accent, 0));
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, W, H);

  // =====================================================================
  // 3. FAR RANK — massed foliage at distance
  //
  // Big, extremely soft, and almost monochrome: distance eats contrast and
  // detail long before it eats size. There is no leaf in this rank at all,
  // only swells of green whose overlaps make an uneven wall of foliage for the
  // middle rank to sit against. Slowest drift in the scene.
  // =====================================================================
  const farDrift = Math.sin(t * 0.043) * W * 0.011;
  const farLift = Math.cos(t * 0.037) * H * 0.006;
  const farCount = 5 + Math.round(d * 2);
  for (let i = 0; i < farCount; i++) {
    const cx = W * (-0.05 + ((i + 0.5) / farCount) * 1.1) + (f.rnd(i, 401) - 0.5) * W * 0.12 + farDrift;
    // Biased around and below the horizon: mass settles where the ground is.
    const cy = hzY + (f.rnd(i, 419) - 0.42) * H * 0.46 + farLift;
    const rr = H * (0.15 + f.rnd(i, 433) * 0.11);
    const l = lit(cx, cy);
    const a = (0.05 + d * 0.03) * (0.62 + l * 0.6) * A;
    for (let j = 0; j < 5; j++) {
      const ox = (f.rnd(i * 7 + j, 443) - 0.5) * rr * 1.5;
      const oy = (f.rnd(i * 7 + j, 457) - 0.5) * rr * 0.95;
      const rj = rr * (0.55 + f.rnd(i * 7 + j, 463) * 0.6);
      blob(cx + ox, cy + oy, rj, 1.25, 0.72, (f.rnd(i * 7 + j, 467) - 0.5) * 0.7, p.green, a);
    }
  }

  // =====================================================================
  // 4. THE CANOPY
  //
  // A heavy mass of foliage hanging into the upper third and cut off by the top
  // edge, so the viewer is UNDER it rather than looking at it. It is built from
  // overlapping low-alpha clusters whose bottoms sit at wildly different
  // heights — the lumpy lower edge is the whole point, because a canopy with an
  // even hem reads as a drawn band across the top of the frame.
  //
  // Each cluster is also given a rim: a soft warm ellipse just under its lowest
  // reach, scaled by how near the cluster is to the light. That is foliage lit
  // from behind, and it is what stops the canopy from being a black bar.
  // =====================================================================
  const canopyReach = H * 0.34;
  const canopySway = Math.sin(t * 0.055) * W * 0.014;
  const canopyCount = 10 + Math.round(d * 4);
  for (let i = 0; i < canopyCount; i++) {
    const cx =
      W * (-0.1 + ((i + 0.5) / canopyCount) * 1.2) +
      (f.rnd(i, 509) - 0.5) * W * 0.07 +
      canopySway * (0.55 + f.rnd(i, 521) * 0.9);
    // Hang depth varies by better than 2:1, which is where the lumpy hem
    // comes from. Centres sit above the top edge so the mass is cut off.
    const hang = 0.35 + f.rnd(i, 523) * 0.85;
    const cy = -H * 0.1 + canopyReach * hang * 0.55;
    const rr = H * (0.13 + f.rnd(i, 541) * 0.09);
    const l = lit(cx, cy + rr);
    // Deepest clusters lean on `ground` so the top of the frame really is dark;
    // the rest are green, with the occasional teal for a cooler pocket.
    const tone = f.rnd(i, 547) < 0.28 ? p.ground : f.rnd(i, 557) < 0.2 ? p.teal : p.green;
    const a = (0.075 + d * 0.03) * (0.72 + l * 0.4) * A;

    let lowY = cy;
    for (let j = 0; j < 5; j++) {
      const ox = (f.rnd(i * 11 + j, 563) - 0.5) * rr * 1.8;
      const oy = (f.rnd(i * 11 + j, 569) - 0.35) * rr * 1.25;
      const rj = rr * (0.5 + f.rnd(i * 11 + j, 571) * 0.7);
      // Squashed wider than tall: a hanging mass spreads sideways.
      blob(cx + ox, cy + oy, rj, 1.35, 0.78, (f.rnd(i * 11 + j, 577) - 0.5) * 0.9, tone, a);
      if (cy + oy + rj * 0.6 > lowY) lowY = cy + oy + rj * 0.6;
    }

    // Backlit rim on the underside. Warm, wide, weak, and only really visible
    // on the clusters nearest the light — which is exactly how a canopy reads.
    blob(cx, lowY, rr * 1.1, 1.5, 0.55, 0, p.accent, 0.05 * l * l * A);
  }

  /**
   * The canopy's own cast shadow: a short ramp hanging off its hem, fading to
   * nothing well before the horizon. It ties the mass to the air under it, so
   * the canopy sits IN the scene instead of on top of it.
   */
  const castTop = canopyReach * 0.35;
  const castBot = Math.min(H, canopyReach * 1.9);
  if (castBot > castTop) {
    const cast = ctx.createLinearGradient(0, castTop, 0, castBot);
    cast.addColorStop(0.0, rgba(p.ground, 0.16 * A));
    cast.addColorStop(0.4, rgba(p.ground, 0.07 * A));
    cast.addColorStop(0.72, rgba(p.ground, 0.02 * A));
    cast.addColorStop(1.0, rgba(p.ground, 0));
    ctx.fillStyle = cast;
    ctx.fillRect(0, castTop, W, castBot - castTop);
  }

  // =====================================================================
  // 5. LIGHT THROUGH THE LEAVES
  //
  // The detail the whole scene turns on. Shafts falling out of the gaps in the
  // canopy, splaying away from the light, widening and weakening as they drop,
  // reaching zero before they land. Sun filtering through foliage is the single
  // thing that makes a green frame feel like somewhere rather than like a tint.
  //
  // A beam is NOT a filled trapezoid: a polygon has two hard sides and at this
  // upscale they turn into visible wires. It is a chain of elongated ellipse
  // gradients marching down the axis, each larger and fainter than the last, so
  // the shaft has soft flanks, a soft mouth and a soft foot, and no edge at all.
  // =====================================================================
  const beamCount = 3 + Math.round(d * 3);
  const beams: Beam[] = [];
  for (let i = 0; i < beamCount; i++) {
    const gapX =
      W * (0.06 + ((i + 0.5) / beamCount) * 0.88) + (f.rnd(i, 601) - 0.5) * W * 0.09;
    const gapY = canopyReach * (0.42 + f.rnd(i, 607) * 0.42);

    /**
     * Direction. Beams splay away from the light horizontally and always fall,
     * so wherever the composition puts the focus the shafts stay coherent with
     * it — the ones on the far side of the frame lean further out, the ones
     * under the light drop almost straight. A tiny sine on the angle lets the
     * whole shaft breathe as if the canopy above it were stirring.
     */
    const ang =
      Math.atan2(1, ((gapX - lightX) / W) * 1.15 + (f.rnd(i, 613) - 0.5) * 0.22) +
      Math.sin(t * 0.08 + i * 1.9) * 0.022;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const len = H * (0.6 + f.rnd(i, 617) * 0.5);
    const r0 = H * (0.032 + f.rnd(i, 619) * 0.022);

    // Beams pointed near the light are the bright ones. Squared, so one or two
    // dominate and the rest are barely-there — an evenly bright fan reads as a
    // graphic device, not as weather.
    const near = 1 - clamp01(Math.abs(gapX - lightX) / (W * 0.72));
    const a = (0.026 + near * near * 0.055) * (0.65 + d * 0.45) * A;

    beams.push({ x: gapX, y: gapY, dx, dy, len, r0 });

    const steps = 7;
    for (let j = 0; j < steps; j++) {
      const u = j / (steps - 1);
      // Fade in over the mouth, then a long power tail to exactly zero at the
      // foot. Nothing about a shaft of light may terminate on a value.
      const w = Math.min(1, u / 0.2) * Math.pow(1 - u, 1.55);
      blob(
        gapX + dx * len * u,
        gapY + dy * len * u,
        r0 * (0.7 + u * 2.8),
        1,
        2.1,
        ang - Math.PI * 0.5,
        u < 0.45 ? p.sheen : p.accent,
        a * w,
      );
    }
  }

  // =====================================================================
  // 6. MIDDLE RANK — the islimi
  //
  // Stems, leaves and blossoms are one system and are built together: a leaf's
  // position, angle and size all come from the stem's own path, so when the
  // stem breathes the leaves ride it instead of sliding along it.
  //
  // This rank is deliberately subordinate now. It is the only place in the
  // frame with a readable silhouette, which is enough to carry it — if you find
  // yourself reading the vines before the foliage and the light, the stroke
  // alphas have crept back up.
  // =====================================================================

  /**
   * Sample the stem's path once per frame, as a polyline.
   *
   * The shape is integrated rather than given in closed form because the point
   * is the *distribution* of curvature: heading turns by `turn` in total, but
   * the easing `0.18u + 0.82u^3.6` spends barely a tenth of it in the first
   * half and dumps the rest into the tail. So the stem runs long and nearly
   * straight and then rolls over once at the end. A constant-curvature arc, or
   * the spiral this file once used, distributes turn evenly, and evenly
   * distributed turn is what reads as coiled wire rather than as a vine.
   *
   * Sway is folded in HERE rather than applied to the finished path, because
   * the leaves read their positions out of this same array; offsetting the
   * stroke afterwards would leave them behind on the un-swayed curve.
   */
  const buildPath = (s: Stem): Pt[] => {
    const pts: Pt[] = new Array(SEG + 1);
    let x = s.x0;
    let y = s.y0;
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG;
      const sway = Math.sin(t * 0.19 + s.phase + u * 1.7) * s.swayAmp * u * u;
      pts[i] = { x: x + s.swayX * sway, y: y + s.swayY * sway };
      if (i === SEG) break;
      const um = (i + 0.5) / SEG;
      const ang = s.a0 + s.dir * s.turn * (0.18 * um + 0.82 * Math.pow(um, 3.6));
      const ds = (s.len / SEG) * (1 - 0.5 * um * um);
      x += Math.cos(ang) * ds;
      y += Math.sin(ang) * ds * s.squash;
    }
    return pts;
  };

  /** Linear read-off of the sampled path at parameter u in [0,1]. */
  const at = (pts: Pt[], u: number): Pt => {
    const g = clamp01(u) * SEG;
    const i = Math.min(SEG - 1, Math.floor(g));
    const k = g - i;
    return {
      x: pts[i].x + (pts[i + 1].x - pts[i].x) * k,
      y: pts[i].y + (pts[i + 1].y - pts[i].y) * k,
    };
  };

  /**
   * Trace the first `upTo` fraction of the path as a chain of cubics. Control
   * points are Catmull-Rom tangents converted to Bezier handles, so consecutive
   * segments share a tangent and the joins are invisible. `upTo` exists so one
   * stem can be stroked at several widths over several lengths — that overlay
   * is how a plain stroke gets both a soft shoulder and a real taper.
   */
  const traceStem = (pts: Pt[], upTo: number): void => {
    const last = Math.max(1, Math.round(SEG * clamp01(upTo)));
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < last; i++) {
      const a = pts[Math.max(i - 1, 0)];
      const b = pts[i];
      const c = pts[i + 1];
      const e = pts[Math.min(i + 2, last)];
      ctx.bezierCurveTo(
        b.x + (c.x - a.x) / 6,
        b.y + (c.y - a.y) / 6,
        c.x - (e.x - b.x) / 6,
        c.y - (e.y - b.y) / 6,
        c.x,
        c.y,
      );
    }
  };

  /**
   * A split palmette, traced in local space with its base at the origin and its
   * axis along +x.
   *
   * The notch is the whole identity of the form: a long principal lobe, a bite
   * out of the profile, then a shorter secondary lobe. Without it this is a
   * teardrop and the ornament stops reading as islimi. Four cubics is the
   * minimum that holds the silhouette — fewer and the notch rounds itself away
   * at this canvas size.
   */
  const tracePalmette = (L: number, Wd: number): void => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(L * 0.22, -Wd * 0.95, L * 0.62, -Wd * 0.86, L, -Wd * 0.18);
    ctx.bezierCurveTo(L * 0.8, -Wd * 0.1, L * 0.66, 0, L * 0.6, Wd * 0.07);
    ctx.bezierCurveTo(L * 0.74, Wd * 0.31, L * 0.87, Wd * 0.53, L * 0.78, Wd * 0.73);
    ctx.bezierCurveTo(L * 0.46, Wd * 0.67, L * 0.16, Wd * 0.43, 0, 0);
    ctx.closePath();
  };

  /** Paint one whole sweep: stem, leaves, blossom. */
  const paintStem = (s: Stem, leafCount: number, blossom: boolean): void => {
    const pts = buildPath(s);

    // Light falloff per stem, from the same model everything else uses. A stem
    // in the light pool is measurably brighter than one in the far corner,
    // which is what makes the light look like it is illuminating the ornament
    // rather than sitting on top of it.
    const mid = pts[SEG >> 1];
    const ink = s.alpha * (0.6 + lit(mid.x, mid.y) * 0.6) * A;

    // -- the stem: three overlaid strokes, each shorter and thinner than the
    // last, so by the tip only the narrow core remains. No sheen pass at all —
    // a highlight down the middle of a thin stroke turns a vine into glowing
    // filament. The stem is lit by the scene and by nothing else, and its
    // brightest pass stays quieter than a leaf's base.
    const w0 = H * 0.0095;
    const passes: Array<[number, number, number]> = [
      [0.52, 2.5, 0.05],
      [0.82, 1.35, 0.085],
      [1.0, 0.6, 0.13],
    ];
    for (let i = 0; i < passes.length; i++) {
      const [upTo, wm, am] = passes[i];
      traceStem(pts, upTo);
      ctx.lineWidth = Math.max(0.7, w0 * wm);
      ctx.strokeStyle = rgba(i === passes.length - 1 ? p.teal : p.green, ink * am);
      ctx.stroke();
    }

    // -- leaves. Gradient-filled masses rather than outlines, placed by the
    // path's own parameter, alternating sides, tapering slowly toward the tip
    // the way a palmette always scales with the stem it springs from. The
    // tangent is a finite difference of the same swayed polyline, so a leaf can
    // never drift off its stem when the scene breathes.
    for (let k = 0; k < leafCount; k++) {
      const u = 0.08 + (k + 0.35) * (0.88 / leafCount);
      const base = at(pts, u);
      const ahead = at(pts, Math.min(1, u + 0.03));
      const behind = at(pts, Math.max(0, u - 0.03));
      const ang = Math.atan2(ahead.y - behind.y, ahead.x - behind.x);
      const side = k % 2 === 0 ? 1 : -1;
      const splay = side * (0.55 + f.rnd(k, 907 + Math.floor(s.phase * 100)) * 0.45);

      const shrink = 1 - 0.42 * u;
      const L = s.leafLen * shrink * (0.78 + f.rnd(k, 929) * 0.44);
      const Wd = L * (0.46 + f.rnd(k, 941) * 0.16);
      // Each leaf's own slow curl, out of phase with the stem, so the foliage
      // does not move as one rigid body.
      const curl = Math.sin(t * 0.28 + s.phase * 1.7 + k) * 0.08;
      // Per-leaf light, so one side of a sweep is warmer than the other.
      const ll = lit(base.x, base.y);

      ctx.save();
      ctx.translate(base.x, base.y);
      ctx.rotate(ang + splay + curl);

      // Halo pass: the same silhouette, oversized and nearly transparent — the
      // cheap substitute for a blur, giving the leaf a soft outer shoulder so
      // its edge dissolves into the foliage instead of cutting it.
      ctx.save();
      ctx.scale(1.45, 1.45);
      tracePalmette(L, Wd);
      ctx.fillStyle = rgba(p.green, ink * 0.1);
      ctx.fill();
      ctx.restore();

      // Body pass: a gradient along the leaf's axis reaching zero at the tip,
      // so the palmette fades out rather than ending on a point. Filling flat
      // here is what made an earlier attempt look like a sticker.
      const lg = ctx.createLinearGradient(0, 0, L, 0);
      lg.addColorStop(0.0, rgba(p.green, ink * 0.44));
      lg.addColorStop(0.3, rgba(p.turquoise, ink * 0.3));
      lg.addColorStop(0.68, rgba(p.green, ink * 0.13));
      lg.addColorStop(1.0, rgba(p.green, 0));
      tracePalmette(L, Wd);
      ctx.fillStyle = lg;
      ctx.fill();

      // Sunlight caught on the shoulder — only on leaves that are actually in
      // the light, so the pass costs nothing where it would be invisible.
      if (ll > 0.45) {
        const sg = ctx.createRadialGradient(
          L * 0.26,
          -Wd * 0.24,
          0,
          L * 0.26,
          -Wd * 0.24,
          L * 0.66,
        );
        sg.addColorStop(0.0, rgba(p.sheen, ink * 0.16 * ll));
        sg.addColorStop(0.55, rgba(p.accent, ink * 0.06 * ll));
        sg.addColorStop(1.0, rgba(p.accent, 0));
        ctx.fillStyle = sg;
        tracePalmette(L, Wd);
        ctx.fill();
      }

      ctx.restore();
    }

    // -- blossom. Two concentric radials, no outline: a wide accent halo and a
    // small warm core where the sweep runs out. Rare, and soft enough that it
    // never becomes a dot of light. The pulse is a sine of `t`, so at speed 0
    // it settles at a fixed size rather than stopping mid-flicker.
    if (blossom) {
      const tip = pts[SEG];
      const pulse = 0.9 + Math.sin(t * 0.5 + s.phase) * 0.1;
      const br = s.leafLen * 0.3 * pulse;
      const bl = 0.55 + lit(tip.x, tip.y) * 0.7;

      const outer = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, br * 2.8);
      outer.addColorStop(0.0, rgba(p.accent, ink * 0.12 * bl));
      outer.addColorStop(0.45, rgba(p.accent, ink * 0.045 * bl));
      outer.addColorStop(1.0, rgba(p.accent, 0));
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, br * 2.8, 0, TAU);
      ctx.fill();

      const inner = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, br);
      inner.addColorStop(0.0, rgba(p.sheen, ink * 0.18 * bl));
      inner.addColorStop(0.4, rgba(p.accent, ink * 0.13 * bl));
      inner.addColorStop(1.0, rgba(p.accent, 0));
      ctx.fillStyle = inner;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, br, 0, TAU);
      ctx.fill();
    }
  };

  /**
   * The middle rank's sweeps. They enter from alternating edges, just off
   * frame, and travel across rather than up: a form that runs horizontally past
   * body copy interferes with it far less than one climbing through it, and an
   * off-frame entry means no stem ever appears to start in mid-air.
   *
   * The rank is offset by a slow bounded oscillation rather than a wrapping
   * drift — a vine is anchored to the garden; it sways, it does not travel.
   * Bounded motion also means nothing ever has to pop in at an edge.
   */
  const stemCount = 2 + Math.round(d * 2);
  const midOx = Math.sin(t * 0.105) * W * 0.021;
  const midOy = Math.cos(t * 0.077) * H * 0.012;
  ctx.save();
  ctx.translate(midOx, midOy);
  for (let i = 0; i < stemCount; i++) {
    const from = i % 2 === 0 ? 1 : -1;
    const tilt = (f.rnd(i, 743 + 127) - 0.5) * 0.5;
    paintStem(
      {
        x0: from > 0 ? -W * (0.06 + f.rnd(i, 743) * 0.1) : W * (1.06 + f.rnd(i, 743) * 0.1),
        y0: hzY * (0.5 + f.rnd(i, 754) * 0.62) + (f.rnd(i, 761) - 0.45) * H * 0.3,
        a0: (from > 0 ? 0 : Math.PI) + tilt,
        len: W * 0.86 * (0.82 + f.rnd(i, 766) * 0.4),
        // A little over a half turn at most: the stem reads as a sweep that
        // rolls over once, never as a coil. Past roughly TAU*0.55 the spring
        // comes back.
        turn: TAU * (0.26 + f.rnd(i, 796) * 0.22),
        dir: f.rnd(i, 810) > 0.5 ? 1 : -1,
        squash: 0.7 + f.rnd(i, 826) * 0.25,
        phase: f.rnd(i, 840) * TAU,
        swayX: (f.rnd(i, 846) - 0.5) * 1.4,
        swayY: (f.rnd(i, 852) - 0.5) * 2,
        swayAmp: H * 0.02,
        alpha: 0.4,
        leafLen: H * 0.115,
      },
      7,
      i % 3 === 0,
    );
  }
  ctx.restore();

  // =====================================================================
  // 7. POLLEN
  //
  // Motes turning over slowly upward through the air. Each is brighter inside a
  // beam than outside one — that is the only reason they are here, because a
  // field of evenly bright specks is confetti, whereas specks that light up as
  // they cross a shaft are what the shaft is made visible BY.
  //
  // Every mote fades to nothing at both ends of its rise (sin over the cycle),
  // so none ever pops into or out of existence.
  // =====================================================================
  const moteCount = 12 + Math.round(d * 16);
  for (let i = 0; i < moteCount; i++) {
    const rise = 0.008 + f.rnd(i, 1301) * 0.014;
    const cycle = wrap01(f.rnd(i, 1307) + t * rise);
    const mx = W * (-0.04 + f.rnd(i, 1319) * 1.08) + Math.sin(t * 0.13 + i * 2.1) * W * 0.014;
    const my = H * 1.04 - cycle * H * 1.12;
    const mr = H * (0.005 + f.rnd(i, 1327) * 0.011);

    // How deep inside a shaft this mote is. The beam widens with distance from
    // its mouth, exactly as it was painted, so the brightening tracks the shape
    // the eye can already see.
    let inBeam = 0;
    for (let b = 0; b < beams.length; b++) {
      const bm = beams[b];
      const ex = mx - bm.x;
      const ey = my - bm.y;
      const along = ex * bm.dx + ey * bm.dy;
      if (along < 0 || along > bm.len) continue;
      const u = along / bm.len;
      const half = bm.r0 * (0.7 + u * 2.8);
      const perp = Math.abs(ex * -bm.dy + ey * bm.dx);
      const v = clamp01(1 - perp / half) * (1 - u);
      if (v > inBeam) inBeam = v;
    }

    const a = (0.035 + inBeam * 0.28) * Math.sin(cycle * Math.PI) * A;
    blob(mx, my, mr * (1 + inBeam * 1.6), 1, 1, 0, inBeam > 0.3 ? p.sheen : p.accent, a);
  }

  // =====================================================================
  // 8. NEAR RANK — foliage at arm's length
  //
  // Roughly twice the far rank's scale, darker, and entering from the frame
  // edges rather than sitting in the middle of it. This rank is what makes the
  // viewer feel enclosed: leaves too close to be in focus, framing the space
  // the rest of the picture happens in. It drifts fastest of the three, because
  // the near thing moving further per unit time than the far thing IS the
  // parallax cue.
  //
  // Nothing here holds an edge. The palmettes are painted as three concentric
  // scales of the same silhouette at falling alpha, which is a poor man's blur
  // and reads correctly at this size — a crisp leaf this large would become a
  // foreground object competing with the text.
  // =====================================================================
  const nearDrift = Math.sin(t * 0.165) * W * 0.036;
  const nearLift = Math.cos(t * 0.128) * H * 0.018;
  const nearCount = 3 + Math.round(d * 2);
  for (let i = 0; i < nearCount; i++) {
    // Anchored to the edges: alternating sides, biased to the corners, with a
    // little of the mass always off-canvas so the rank has no visible start.
    const side = i % 2 === 0 ? -0.08 : 1.08;
    const cx = W * side + (f.rnd(i, 1451) - 0.5) * W * 0.16 + nearDrift * (i % 2 === 0 ? 1 : -1);
    const cy = H * (0.12 + f.rnd(i, 1459) * 0.92) + nearLift;
    const rr = H * (0.26 + f.rnd(i, 1471) * 0.16);
    const l = lit(cx, cy);
    const tone = f.rnd(i, 1481) < 0.45 ? p.ground : p.green;
    const a = (0.055 + d * 0.025) * (0.85 + l * 0.35) * A;

    for (let j = 0; j < 5; j++) {
      const ox = (f.rnd(i * 13 + j, 1483) - 0.5) * rr * 1.4;
      const oy = (f.rnd(i * 13 + j, 1487) - 0.5) * rr * 1.5;
      const rj = rr * (0.55 + f.rnd(i * 13 + j, 1489) * 0.65);
      blob(cx + ox, cy + oy, rj, 1.2, 0.9, (f.rnd(i * 13 + j, 1493) - 0.5) * 1.2, tone, a);
    }

    // One big soft palmette per mass, so the near rank still reads as foliage
    // and not as a smudge — but blurred into three shells, never a silhouette.
    const L = rr * 1.5;
    const Wd = L * 0.5;
    const lean =
      (side < 0.5 ? -0.5 : Math.PI + 0.5) + (f.rnd(i, 1499) - 0.5) * 0.9 +
      Math.sin(t * 0.14 + i) * 0.05;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(lean);
    for (let s = 0; s < 3; s++) {
      const scale = 1 + s * 0.34;
      ctx.save();
      ctx.scale(scale, scale);
      tracePalmette(L, Wd);
      ctx.fillStyle = rgba(s === 0 ? p.green : p.ground, (0.05 / (1 + s * 1.4)) * A);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // =====================================================================
  // 9. THE MEADOW — the signature layer
  //
  // The reference is an alpine flower meadow: a carpet of small bright heads
  // in the foreground, green depth behind, big soft light. The band owns the
  // lower quarter of the frame and nothing above it, so the content's air
  // stays clear. Density is clumped, never uniform — clusters seeded by rnd,
  // thick against the bottom edge, gone by the horizon. Whites and golds
  // (sheen + accent) over the green, with deeper leaf tufts among them.
  //
  // Budget discipline: only the middle rank pays for petal geometry. The far
  // rank is plain dots of sheen, and the near rank is a few big soft
  // silhouettes — the reference's blurred foreground flowers.
  // =====================================================================
  const meadowTop = Math.max(hzY + H * 0.05, H * 0.68);
  const meadowSpan = H * 1.02 - meadowTop;

  /**
   * One petal in local space: a filled bezier teardrop, base at the origin,
   * tip on -y. Always FILLED with a gradient, never stroked — at this canvas
   * size a thin stroke smears on upscale, a soft filled mass does not.
   */
  const tracePetal = (L: number, Wd: number): void => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-Wd, -L * 0.32, -Wd * 0.84, -L * 0.8, 0, -L);
    ctx.bezierCurveTo(Wd * 0.84, -L * 0.8, Wd, -L * 0.32, 0, 0);
    ctx.closePath();
  };

  /**
   * A blossom head: five petal teardrops rotated around a centre, each with
   * its own length, width and angle jitter — the jitter is what keeps it a
   * flower rather than a symmetric icon — filled deeper at the base, lighter
   * at the tip, reaching zero alpha so no petal holds an edge. A tiny soft
   * core after. Each head nods on its own frequency and phase; a product of
   * `t`, so speed 0 leaves it settled at a fixed lean, never mid-nod.
   */
  const paintBlossom = (
    x: number,
    y: number,
    r: number,
    seed: number,
    gold: boolean,
    a: number,
  ): void => {
    if (a <= 0.0005 || r <= 0) return;
    const nod =
      Math.sin(t * (0.35 + f.rnd(seed, 1901) * 0.45) + f.rnd(seed, 1907) * TAU) * 0.07;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(f.rnd(seed, 1913) * TAU + nod);
    for (let k = 0; k < 5; k++) {
      const L = r * (0.85 + f.rnd(seed * 31 + k, 1919) * 0.35);
      const Wd = L * (0.42 + f.rnd(seed * 31 + k, 1931) * 0.16);
      ctx.save();
      ctx.rotate((k / 5) * TAU + (f.rnd(seed * 31 + k, 1933) - 0.5) * 0.3);
      const g = ctx.createLinearGradient(0, 0, 0, -L);
      if (gold) {
        g.addColorStop(0.0, rgba(p.accent, a));
        g.addColorStop(0.55, rgba(p.sheen, a * 0.62));
        g.addColorStop(1.0, rgba(p.sheen, 0));
      } else {
        g.addColorStop(0.0, rgba(p.accent, a * 0.85));
        g.addColorStop(0.35, rgba(p.sheen, a * 0.8));
        g.addColorStop(1.0, rgba(p.sheen, 0));
      }
      ctx.fillStyle = g;
      tracePetal(L, Wd);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    blob(x, y, r * 0.34, 1, 1, 0, gold ? p.sheen : p.accent, a * 0.85);
  };

  // -- far rank: tiny soft dots of sheen and accent, clumped, sitting in the
  // upper half of the band where distance has eaten all detail. One blob each.
  const dotClusters = 6;
  for (let c = 0; c < dotClusters; c++) {
    const ccx = W * (0.02 + f.rnd(c, 1621) * 0.96);
    const ccy = meadowTop + Math.pow(f.rnd(c, 1627), 1.35) * meadowSpan * 0.55;
    const n = 3 + Math.round(f.rnd(c, 1631) * 2 + d);
    for (let j = 0; j < n; j++) {
      const s = c * 17 + j;
      const x = ccx + (f.rnd(s, 1637) - 0.5) * W * 0.14;
      const y = ccy + (f.rnd(s, 1657) - 0.5) * H * 0.05;
      if (y < meadowTop) continue;
      const depth = clamp01((y - meadowTop) / meadowSpan);
      const r = H * (0.004 + 0.008 * depth) * (0.7 + f.rnd(s, 1663) * 0.6);
      const a = (0.05 + 0.1 * depth) * (0.6 + lit(x, y) * 0.5) * A;
      blob(x, y, r, 1, 1, 0, f.rnd(s, 1667) < 0.4 ? p.accent : p.sheen, a);
    }
  }

  // -- leaf tufts: deeper green masses among the heads, so the carpet reads
  // as flowers IN grass rather than lights on a ground.
  const tuftCount = 4 + Math.round(d * 2);
  for (let i = 0; i < tuftCount; i++) {
    const x = W * (0.03 + f.rnd(i, 1721) * 0.94);
    const y = H - Math.pow(f.rnd(i, 1727), 1.6) * meadowSpan * 0.7;
    const depth = clamp01((y - meadowTop) / meadowSpan);
    const r = H * (0.02 + 0.03 * depth);
    const tone = f.rnd(i, 1733) < 0.5 ? p.teal : p.green;
    blob(x, y, r, 1.5, 0.8, (f.rnd(i, 1741) - 0.5) * 0.8, tone, (0.1 + 0.08 * depth) * A);
    blob(x - r * 0.5, y + r * 0.25, r * 0.7, 1.3, 0.75, (f.rnd(i, 1747) - 0.5) * 0.8, p.ground, 0.06 * A);
  }

  // -- middle rank: the readable blossoms, in odd-numbered clumps of three
  // and one, larger and brighter the nearer the bottom edge they sit.
  const bloomClusters = 5;
  for (let c = 0; c < bloomClusters; c++) {
    const ccx = W * (0.05 + f.rnd(c, 1801) * 0.9);
    const ccy = H * 0.99 - Math.pow(f.rnd(c, 1807), 1.7) * meadowSpan * 0.75;
    const n = c % 2 === 0 ? 3 : 1;
    for (let j = 0; j < n; j++) {
      const s = 100 + c * 23 + j * 7;
      const x = ccx + (f.rnd(s, 1823) - 0.5) * W * (0.04 + n * 0.02);
      const y = Math.max(meadowTop, ccy + (f.rnd(s, 1831) - 0.5) * H * 0.05);
      const depth = clamp01((y - meadowTop) / meadowSpan);
      const r = H * (0.012 + 0.02 * depth) * (0.8 + f.rnd(s, 1847) * 0.4);
      const a = (0.1 + 0.16 * depth) * (0.55 + lit(x, y) * 0.45) * A;
      paintBlossom(x, y, r, s, f.rnd(s, 1861) < 0.35, a);
    }
  }

  // -- near rank: a handful of much larger heads at the very bottom edge,
  // half-cut by the frame and very soft — each sits inside its own oversize
  // halo blob, the cheap blur that pushes it out of focus so it frames the
  // meadow instead of competing with the text above it.
  const nearBloomCount = 4;
  for (let i = 0; i < nearBloomCount; i++) {
    const x = W * (0.08 + f.rnd(i, 2001) * 0.84) + Math.sin(t * 0.09 + i * 2.4) * W * 0.006;
    const y = H * (0.99 + f.rnd(i, 2011) * 0.08);
    const r = H * (0.07 + f.rnd(i, 2017) * 0.05);
    const gold = f.rnd(i, 2027) < 0.5;
    const a = 0.06 * (0.7 + lit(x, y) * 0.4) * A;
    blob(x, y, r * 1.5, 1.2, 0.9, 0, gold ? p.accent : p.sheen, a * 0.8);
    paintBlossom(x, y, r, 300 + i * 13, gold, a);
  }

  // -- detached petals, riding the shafts. They rise from a beam's foot to
  // its mouth with a lateral sway, fading in and out at the ends of the climb
  // so none ever pops. Scarce on purpose: this is the scene's single biggest
  // "alive" cue and scarcity is what keeps it one.
  if (beams.length > 0) {
    const petalCount = 3 + Math.round(d * 3);
    for (let i = 0; i < petalCount; i++) {
      const bm = beams[i % beams.length];
      const rise = 0.01 + f.rnd(i, 2101) * 0.012;
      const cycle = wrap01(f.rnd(i, 2107) + t * rise);
      const u = 1 - cycle;
      const lat =
        (f.rnd(i, 2117) - 0.5) * bm.r0 * 3 +
        Math.sin(t * 0.6 + f.rnd(i, 2113) * TAU) * bm.r0 * 1.4;
      const px = bm.x + bm.dx * bm.len * u - bm.dy * lat;
      const py = bm.y + bm.dy * bm.len * u + bm.dx * lat;
      const L = H * (0.011 + f.rnd(i, 2127) * 0.007);
      const rot =
        f.rnd(i, 2131) * TAU +
        t * (0.2 + f.rnd(i, 2137) * 0.25) * (f.rnd(i, 2141) < 0.5 ? 1 : -1);
      const a = 0.2 * Math.sin(cycle * Math.PI) * (0.55 + lit(px, py) * 0.5) * A;
      if (a > 0.0005) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        const pg = ctx.createLinearGradient(0, 0, 0, -L);
        pg.addColorStop(0.0, rgba(p.accent, a));
        pg.addColorStop(0.5, rgba(p.sheen, a * 0.7));
        pg.addColorStop(1.0, rgba(p.sheen, 0));
        ctx.fillStyle = pg;
        tracePetal(L, L * 0.5);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // =====================================================================
  // 10. SETTLING THE FRAME
  //
  // One atmosphere over everything. Without this the ranks sit proud of each
  // other and the frame reads as stacked images; with it they share one body of
  // air. The vignette pulls the corners into the theme's own page colour so the
  // canvas never looks pasted onto the app, and the top ramp keeps the busiest
  // part of the canopy off the region where headers and titles live.
  // =====================================================================
  const air = ctx.createRadialGradient(lightX, lightY, diag * 0.1, W * 0.5, H * 0.5, diag * 0.8);
  air.addColorStop(0.0, rgba(p.ground, 0));
  air.addColorStop(0.5, rgba(p.ground, 0.14 * A));
  air.addColorStop(0.78, rgba(p.ground, 0.32 * A));
  air.addColorStop(1.0, rgba(p.ground, 0.48 * A));
  ctx.fillStyle = air;
  ctx.fillRect(0, 0, W, H);

  const top = ctx.createLinearGradient(0, 0, 0, H * 0.3);
  top.addColorStop(0.0, rgba(p.ground, 0.22 * A));
  top.addColorStop(0.55, rgba(p.ground, 0.07 * A));
  top.addColorStop(1.0, rgba(p.ground, 0));
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.3);

  ctx.restore();

  // Belt and braces: the caller shares one context between scenes, so leaving
  // either of these dirty would silently corrupt whatever paints next.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};
