/**
 * GARDEN — the vegetal arabesque scene.
 *
 * Islimi: a long stem that sweeps across the wall and turns over once at its
 * end, split-palmette leaves hanging off it, a blossom where the stem runs out.
 * This is the tradition's own ornamental language and the only figurative
 * vocabulary open to us — there is no animate being anywhere in this file, and
 * none may ever be added. Leaf, vine and blossom. Nothing that breathes.
 *
 * Two things this file is deliberately NOT, both of which it was once rejected
 * for:
 *   - It is not a coil. An earlier version wound each stem through two or three
 *     turns of a logarithmic spiral, and at this size tight repeated turns stop
 *     reading as a vine and start reading as a spring or a light trail. A real
 *     islimi scroll travels a long way and turns over ONCE, late. Hence the
 *     arc-length integration below with almost all of its curvature pushed into
 *     the last third of the path.
 *   - It is not a line drawing. The stem is the quietest thing in the frame —
 *     barely above the wash — and the leaves carry the picture. If you find
 *     yourself reading the stems before the foliage, the stroke alphas have
 *     crept back up.
 *
 * The picture is built the way a painter builds one: an atmospheric ground
 * first, then a far rank of ornament that is large, faint and dissolved, then a
 * near rank that is smaller and holds an edge. Depth here is entirely painter's
 * algorithm plus scale/alpha/contrast falloff — there is no blur filter, because
 * `ctx.filter` costs more per frame than the whole rest of the scene. Softness
 * comes from gradient stops that reach zero alpha, so no form in this file ever
 * terminates on a hard edge.
 *
 * Every colour is a palette triple. There is no literal hue in this file, so
 * the same code paints Emerald correctly and would paint any future theme
 * correctly too.
 */

import type { ScenePainter } from './types';
import { rgba } from './types';

const TAU = Math.PI * 2;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

interface Pt {
  x: number;
  y: number;
}

/** One islimi sweep, fully resolved before anything is painted. */
interface Stem {
  /** Where the stem enters, usually just off frame. */
  x0: number;
  y0: number;
  /** Initial heading. Near 0 or PI — these travel across, not up. */
  a0: number;
  /** Arc length of the whole sweep, in pixels. Long: this is the point. */
  len: number;
  /** TOTAL turn over the whole path, radians. Around one half-turn. */
  turn: number;
  /** +1 / -1: whether the end curls up or down. Mirroring stops a stamped look. */
  dir: number;
  /** Vertical squash, so the sweep lies in the plane of the wall. */
  squash: number;
  /** Sway phase and direction — the stem's own share of the breathing. */
  phase: number;
  swayX: number;
  swayY: number;
  swayAmp: number;
  /** Depth-resolved ink strength for this particular stem. */
  alpha: number;
  /** Leaf length in pixels at the base of the stem. */
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
   * is a sine of `t`, so at speed 0 they all collapse to a constant and the
   * scene is still a composed picture rather than a degenerate one.
   */
  const t = f.t * comp.speed;

  /**
   * The single opacity budget. Artistic alphas are chosen as though the scene
   * were at full strength and multiplied through here exactly once. Keeping it
   * in one constant is what lets the caller dim the whole world (reduced
   * motion, a dim route) without one layer drifting out of proportion with the
   * rest.
   */
  const A = f.level * comp.weight;
  if (A <= 0) return;

  const hzY = clamp01(comp.horizon) * H;
  const lightX = clamp01(comp.focusX) * W;
  const lightY = clamp01(comp.focusY) * H;
  const d = clamp01(comp.density);
  const diag = Math.hypot(W, H);

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // =====================================================================
  // 1. THE ATMOSPHERIC GROUND
  //
  // Before any ornament there has to be air for it to hang in, otherwise the
  // vines read as a decal pasted on the page — which is precisely the
  // "clip-art" failure this scene was rewritten to avoid. The wash does three
  // jobs at once: it establishes that the world is green, it puts more matter
  // low (near the horizon, where a garden's mass actually is) than high, and
  // it opens a hole of light at the focus so the later layers have a
  // direction to be lit from.
  //
  // The wash is also meant to WIN. It is the loudest layer in the file; the
  // ornament is worked into it, not laid on top of it.
  // =====================================================================

  /**
   * Vertical body. Two stops below the horizon and one above: the green must
   * build fast under the ground line and thin out quickly above it, because a
   * single top-to-bottom ramp reads as a flat gradient swatch and gives the
   * frame no sense of depth at all.
   */
  const body = ctx.createLinearGradient(0, 0, 0, H);
  body.addColorStop(0.0, rgba(p.ground, 0.34 * A));
  body.addColorStop(Math.max(0.02, clamp01(comp.horizon) * 0.55), rgba(p.green, 0.05 * A));
  body.addColorStop(clamp01(comp.horizon), rgba(p.green, 0.13 * A));
  body.addColorStop(1.0, rgba(p.green, 0.2 * A));
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, W, H);

  /**
   * Broad pools. Four very large radials, deterministically placed and biased
   * below the horizon, give the wash an uneven grain — real foliage mass is
   * lumpy, and an even tint is the thing that makes a canvas background look
   * synthetic. They are far wider than they are strong; each is nearly
   * invisible alone and only the overlap is legible.
   */
  const poolCount = 4;
  for (let i = 0; i < poolCount; i++) {
    const px = W * (0.1 + f.rnd(i, 401) * 0.8);
    // Bias toward the lower half of the frame: matter settles.
    const py = hzY + (f.rnd(i, 419) - 0.25) * H * 0.5;
    const pr = diag * (0.3 + f.rnd(i, 433) * 0.28);
    // A slow, tiny wander so the ground is not perfectly static when the scene
    // is allowed to move. Amplitude is a fraction of the radius, so it never
    // reads as an object sliding — only as light shifting.
    const wob = Math.sin(t * 0.11 + i * 1.7) * pr * 0.035;
    const tone = i % 2 === 0 ? p.green : p.teal;
    const g = ctx.createRadialGradient(px + wob, py, 0, px + wob, py, pr);
    g.addColorStop(0.0, rgba(tone, 0.12 * (0.6 + d * 0.4) * A));
    g.addColorStop(0.5, rgba(tone, 0.055 * (0.6 + d * 0.4) * A));
    g.addColorStop(1.0, rgba(tone, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /**
   * The light. Two radials with no tight core, deliberately: a bright centre
   * would read as a lamp, i.e. a foreground object competing with the text.
   * What is wanted is the *evidence* of light — a broad lift that thins the
   * green at the focus and gives every stem and leaf below a consistent
   * reason to be brighter on one side. Remove this and the ornament flattens
   * into a uniform stencil.
   */
  const halo = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, diag * 0.9);
  halo.addColorStop(0.0, rgba(p.sheen, 0.11 * A));
  halo.addColorStop(0.32, rgba(p.accent, 0.06 * A));
  halo.addColorStop(0.7, rgba(p.turquoise, 0.03 * A));
  halo.addColorStop(1.0, rgba(p.turquoise, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  const shaft = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, diag * 0.34);
  shaft.addColorStop(0.0, rgba(p.sheen, 0.13 * A));
  shaft.addColorStop(0.55, rgba(p.accent, 0.05 * A));
  shaft.addColorStop(1.0, rgba(p.accent, 0));
  ctx.fillStyle = shaft;
  ctx.fillRect(0, 0, W, H);

  /**
   * Undergrowth: a few very wide, very flat ellipse-gradients sitting on the
   * horizon. These are massed foliage seen at distance — no individual leaf,
   * just a soft swell of darker green that gives the ground line somewhere to
   * come from. Drawn as squashed radials under a transform because an ellipse
   * gradient has no edge whatsoever; a filled shape here would show a rim.
   */
  const swells = 3 + Math.round(d * 2);
  for (let i = 0; i < swells; i++) {
    const sx = W * ((i + 0.5) / swells) + (f.rnd(i, 461) - 0.5) * W * 0.2;
    const sy = hzY + H * (0.02 + f.rnd(i, 479) * 0.1);
    const sr = W * (0.2 + f.rnd(i, 491) * 0.18);
    const flat = 0.26 + f.rnd(i, 503) * 0.12;
    const a = (0.1 + d * 0.09) * A;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, flat);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sr);
    g.addColorStop(0.0, rgba(p.green, a));
    g.addColorStop(0.5, rgba(p.green, a * 0.42));
    g.addColorStop(1.0, rgba(p.green, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, sr, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // =====================================================================
  // 2-4. THE ORNAMENT
  //
  // Stems, leaves and blossoms are one system and are built together: a leaf's
  // position, angle and size all come from the stem's own path, so when the
  // stem breathes the leaves ride it instead of sliding along it.
  // =====================================================================

  /**
   * Sample the stem's path once per frame, as a polyline.
   *
   * The shape is integrated rather than given in closed form because the whole
   * point of the rebuild is the *distribution* of curvature: heading turns by
   * `turn` in total, but the easing `0.18u + 0.82u^3.6` spends barely a tenth
   * of that in the first half of the path and dumps the rest into the tail. So
   * the stem runs long and nearly straight across the frame and then rolls over
   * once at the end. A constant-curvature arc, or the old spiral, distributes
   * turn evenly and that is exactly what reads as coiled wire.
   *
   * Step length also decays (`1 - 0.5u^2`), so the curl at the end is a little
   * tighter than the sweep that feeds it — a stem thins and shortens its reach
   * as it runs out, it does not turn at full stride.
   *
   * Sway is folded in HERE rather than applied to the finished path, because
   * the leaves read their positions out of this same array. Offsetting the
   * stroke afterwards would leave the leaves behind on the un-swayed curve. The
   * `u * u` weighting anchors the entry and lets the tail travel, which is how
   * a real stem moves.
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
   * Trace the first `upTo` fraction of the path as a chain of cubics.
   *
   * The control points are Catmull-Rom tangents converted to Bezier handles, so
   * consecutive segments share a tangent and the join is invisible. `upTo`
   * exists so the same stem can be stroked at several widths over several
   * lengths — see the taper below.
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
   * taken out of the profile, then a shorter secondary lobe. Without it this is
   * just a teardrop and the ornament stops reading as islimi and starts reading
   * as generic foliage. The four cubics are the minimum that will hold that
   * silhouette — fewer and the notch rounds itself away at this canvas size.
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

  /**
   * Paint one whole sweep: stem, leaves, blossom.
   *
   * `crisp` is the depth dial and drives everything that distance actually
   * changes — contrast, edge definition and how much of the light reaches the
   * form. Far ornament gets a fat, faint, shoulder-heavy stroke that dissolves
   * into the wash; near ornament gets a tighter core that survives the upscale.
   */
  const paintStem = (s: Stem, leafCount: number, crisp: number, blossom: boolean): void => {
    const pts = buildPath(s);

    /**
     * Light falloff per stem. A stem sitting in the focus is measurably
     * brighter than one in the far corner; this is what makes the wash's light
     * pool look like it is illuminating the ornament rather than sitting on
     * top of it.
     */
    const mid = pts[SEG >> 1];
    const lit = 1 - clamp01(Math.hypot(mid.x - lightX, mid.y - lightY) / (diag * 0.85));
    const ink = s.alpha * (0.62 + lit * 0.55) * A;

    // -- 2. THE STEM ---------------------------------------------------
    //
    // Three overlaid strokes, each shorter and thinner than the last. This is
    // how the stem gets both a soft shoulder AND a real taper out of a plain
    // stroke: the widest pass covers only the base, so by the tip only the
    // narrow core remains.
    //
    // The alphas here are roughly a third of what they once were, and there is
    // no `sheen` pass at all any more. A highlight down the middle of a thin
    // stroke is what turned these into glowing filament; the vine is allowed to
    // be lit by the wash and by nothing else. Its brightest pass is quieter
    // than a leaf's base, which is the ordering the scene depends on.
    const w0 = H * 0.011 * (1.3 - crisp * 0.4);
    const passes: Array<[number, number, number]> = [
      // [fraction of the sweep covered, width multiplier, alpha multiplier]
      [0.52, 2.5, 0.055],
      [0.82, 1.35, 0.095],
      [1.0, 0.6, 0.15 * (0.55 + crisp * 0.45)],
    ];
    for (let i = 0; i < passes.length; i++) {
      const [upTo, wm, am] = passes[i];
      if (am <= 0) continue;
      traceStem(pts, upTo);
      ctx.lineWidth = Math.max(0.7, w0 * wm);
      ctx.strokeStyle = rgba(i === passes.length - 1 ? p.teal : p.green, ink * am);
      ctx.stroke();
    }

    // -- 3. LEAVES -----------------------------------------------------
    //
    // These are the subject. They are large, they are many, and each is a
    // gradient-filled mass rather than an outline, so what the eye picks up
    // first is soft foliage and only afterwards the line it hangs from.
    //
    // Placed by the path's own parameter, alternating sides, shrinking slowly
    // toward the tip — a palmette on an islimi always scales with the stem it
    // springs from. The tangent is a finite difference of the same swayed
    // polyline, so a leaf can never drift off its stem when the scene breathes.
    for (let k = 0; k < leafCount; k++) {
      const u = 0.08 + (k + 0.35) * (0.88 / leafCount);
      const base = at(pts, u);
      const ahead = at(pts, Math.min(1, u + 0.03));
      const behind = at(pts, Math.max(0, u - 0.03));
      const ang = Math.atan2(ahead.y - behind.y, ahead.x - behind.x);
      // Alternate the side and splay outward from the stem's own direction,
      // the way leaves alternate along a real shoot.
      const side = k % 2 === 0 ? 1 : -1;
      const splay = side * (0.55 + f.rnd(k, 907 + Math.floor(s.phase * 100)) * 0.45);

      // A long taper along the sweep rather than the old geometric shrink: the
      // leaves near the entry are nearly full size, so the foliage mass is
      // spread over the whole stem instead of piling up at one end.
      const shrink = 1 - 0.42 * u;
      const L = s.leafLen * shrink * (0.78 + f.rnd(k, 929) * 0.44);
      const Wd = L * (0.46 + f.rnd(k, 941) * 0.16);

      // A leaf's own slow curl, out of phase with the stem, so the foliage
      // does not move as one rigid body.
      const curl = Math.sin(t * 0.28 + s.phase * 1.7 + k) * 0.08;

      ctx.save();
      ctx.translate(base.x, base.y);
      ctx.rotate(ang + splay + curl);

      // Halo pass: the same silhouette, oversized and nearly transparent. This
      // is the cheap substitute for a blur — it gives the leaf a soft outer
      // shoulder so its edge dissolves into the wash instead of cutting it.
      ctx.save();
      ctx.scale(1.42, 1.42);
      tracePalmette(L, Wd);
      ctx.fillStyle = rgba(p.green, ink * 0.11);
      ctx.fill();
      ctx.restore();

      // Body pass: a gradient along the leaf's axis that reaches zero alpha at
      // the tip, so the palmette fades out rather than ending on a hard point.
      // Filling flat here is what made an earlier attempt look like a sticker.
      const lg = ctx.createLinearGradient(0, 0, L, 0);
      lg.addColorStop(0.0, rgba(p.green, ink * 0.46));
      lg.addColorStop(0.3, rgba(p.turquoise, ink * 0.32));
      lg.addColorStop(0.68, rgba(p.green, ink * 0.14));
      lg.addColorStop(1.0, rgba(p.green, 0));
      tracePalmette(L, Wd);
      ctx.fillStyle = lg;
      ctx.fill();

      // Near ornament only: a soft light catching the shoulder of the leaf. At
      // distance this is invisible anyway, so spending the primitive on far
      // leaves would cost budget for nothing.
      if (crisp > 0.7) {
        const sg = ctx.createRadialGradient(L * 0.26, -Wd * 0.24, 0, L * 0.26, -Wd * 0.24, L * 0.62);
        sg.addColorStop(0.0, rgba(p.sheen, ink * 0.13));
        sg.addColorStop(1.0, rgba(p.sheen, 0));
        ctx.fillStyle = sg;
        tracePalmette(L, Wd);
        ctx.fill();
      }

      ctx.restore();
    }

    // -- 4. BLOSSOM ----------------------------------------------------
    //
    // Where the sweep runs out there is a bud. Two concentric radials, no
    // outline: a wide accent halo and a small warm core. This is the only
    // place `accent` is allowed to concentrate, and it is what keeps the frame
    // from being one undifferentiated green. Rare — most stems end on a bare
    // curl — and soft enough that it never becomes a dot of light. The pulse is
    // a sine of `t`, so at speed 0 it settles at a fixed size rather than
    // stopping mid-flicker.
    if (blossom) {
      const tip = pts[SEG];
      const pulse = 0.9 + Math.sin(t * 0.5 + s.phase) * 0.1;
      const br = s.leafLen * 0.3 * pulse * (1.25 - crisp * 0.25);

      const outer = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, br * 2.6);
      outer.addColorStop(0.0, rgba(p.accent, ink * 0.13));
      outer.addColorStop(0.45, rgba(p.accent, ink * 0.05));
      outer.addColorStop(1.0, rgba(p.accent, 0));
      ctx.fillStyle = outer;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, br * 2.6, 0, TAU);
      ctx.fill();

      const core = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, br);
      core.addColorStop(0.0, rgba(p.sheen, ink * 0.2));
      core.addColorStop(0.4, rgba(p.accent, ink * 0.15));
      core.addColorStop(1.0, rgba(p.accent, 0));
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, br, 0, TAU);
      ctx.fill();
    }
  };

  /**
   * Build one rank of sweeps.
   *
   * Stems enter from alternating edges, just off frame, and travel inward. They
   * are given a heading of 0 or PI plus a small tilt, so the rank as a whole
   * lies down across the wall rather than standing up through the reading
   * column — a form that runs horizontally past body copy interferes with it far
   * less than one that climbs through it, and the entries being off-frame means
   * no stem ever appears to start in mid-air.
   *
   * The rank as a whole is offset by a slow bounded oscillation rather than a
   * wrapping drift. A vine is anchored to its wall; it sways, it does not
   * travel. Bounded motion also means nothing ever has to pop in at an edge.
   */
  const rank = (
    count: number,
    salt: number,
    len: number,
    leafLen: number,
    yBias: number,
    ySpread: number,
    alpha: number,
    parallax: number,
    parallaxRate: number,
    leaves: number,
    crisp: number,
    blossomEvery: number,
  ): void => {
    if (count <= 0) return;
    const ox = Math.sin(t * parallaxRate) * parallax;
    const oy = Math.cos(t * parallaxRate * 0.73) * parallax * 0.45;

    ctx.save();
    ctx.translate(ox, oy);

    for (let i = 0; i < count; i++) {
      // Alternate the edge of entry so the two halves of the frame are dressed.
      const from = i % 2 === 0 ? 1 : -1;
      const tilt = (f.rnd(i, salt + 127) - 0.5) * 0.5;
      const s: Stem = {
        x0: from > 0 ? -W * (0.06 + f.rnd(i, salt) * 0.1) : W * (1.06 + f.rnd(i, salt) * 0.1),
        y0: hzY * yBias + (f.rnd(i, salt + 11) - 0.45) * H * ySpread,
        a0: (from > 0 ? 0 : Math.PI) + tilt,
        len: len * (0.82 + f.rnd(i, salt + 23) * 0.4),
        // A little over a half turn at most. This is the whole correction: the
        // stem reads as a sweep that rolls over once, never as a coil. Raising
        // this past roughly TAU * 0.55 starts to reintroduce the spring.
        turn: TAU * (0.26 + f.rnd(i, salt + 53) * 0.22),
        dir: f.rnd(i, salt + 67) > 0.5 ? 1 : -1,
        squash: 0.7 + f.rnd(i, salt + 83) * 0.25,
        phase: f.rnd(i, salt + 97) * TAU,
        swayX: (f.rnd(i, salt + 103) - 0.5) * 1.4,
        swayY: (f.rnd(i, salt + 109) - 0.5) * 2,
        swayAmp: H * 0.022,
        alpha,
        leafLen,
      };
      paintStem(s, leaves, crisp, i % blossomEvery === 0);
    }

    ctx.restore();
  };

  /**
   * Density buys ornament, not opacity — a sparse garden should be an emptier
   * garden, not a greyer one. Two ranks at different scales and drift rates is
   * the minimum that reads as depth; the far rank alone looks like a stain and
   * the near rank alone looks like a decal.
   */
  const farCount = 2 + Math.round(d * 2);
  const nearCount = 1 + Math.round(d * 2);

  // Far: a long sweep almost the full width of the frame, carrying very large
  // and very faint leaves, drifting slowly and spread over most of the height.
  // No highlight pass — distance eats contrast and detail before it eats size,
  // and skipping the sheen is where the frame budget for the near rank comes
  // from.
  rank(farCount, 601, W * 1.05, H * 0.17, 0.78, 0.52, 0.3, W * 0.01, 0.06, 7, 0.4, 4);

  // Near: a shorter sweep with smaller leaves, only slightly stronger, drifting
  // faster and hugging the horizon band. Edge, not size, is what the eye reads
  // as proximity at this canvas resolution, so the near rank keeps its
  // highlight pass and a tighter stem core while staying quieter in mass.
  rank(nearCount, 743, W * 0.62, H * 0.115, 0.98, 0.3, 0.44, W * 0.028, 0.13, 8, 1, 3);

  // =====================================================================
  // 5. SETTLING THE FRAME
  //
  // A last wash over everything. Without it the ornament sits proud of the
  // wash and the frame reads as two separate images stacked; with it the whole
  // thing shares one atmosphere. The corner vignette pulls the scene down into
  // the theme's own page colour so the canvas never looks pasted onto the app,
  // and the top fade keeps the busiest ornament off the region where headers
  // and titles live.
  // =====================================================================
  const veil = ctx.createRadialGradient(
    lightX,
    lightY,
    diag * 0.12,
    W * 0.5,
    H * 0.5,
    diag * 0.78,
  );
  veil.addColorStop(0.0, rgba(p.ground, 0));
  veil.addColorStop(0.55, rgba(p.ground, 0.18 * A));
  veil.addColorStop(1.0, rgba(p.ground, 0.46 * A));
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, W, H);

  const top = ctx.createLinearGradient(0, 0, 0, H * 0.34);
  top.addColorStop(0.0, rgba(p.ground, 0.3 * A));
  top.addColorStop(1.0, rgba(p.ground, 0));
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.34);

  ctx.restore();

  // Belt and braces: the caller shares one context between scenes, so leaving
  // either of these dirty would silently corrupt whatever paints next.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};
