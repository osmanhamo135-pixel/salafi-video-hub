import { rgba, type ScenePainter } from './types';

const TAU = Math.PI * 2;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * PAPER — a sheet of fine laid paper lying under a window.
 *
 * This is the light theme's world, and it is the only scene in the folder with
 * nowhere to hide. The others paint darkness and add light to it, so a clumsy
 * value sinks harmlessly into the ground. Here the ground is already near the
 * top of the range: every mark can only go *down* from the page, and anything
 * that goes down too far stops being paper and starts being a stain. The whole
 * scene therefore lives in a band of alpha roughly a quarter of what `dust` or
 * `night` use, and the numbers below look absurdly small on purpose.
 *
 * Quiet, however, is not the same as empty. The earlier version of this file
 * was a flat fill with an even grid ruled across it, and an even grid on a flat
 * fill is graph paper — the one thing a page of fine paper never looks like.
 * What separates the two is that real paper has FOUR unrelated things happening
 * at four different scales at once, and the eye needs all four:
 *
 *   - the sheet is unevenly toned in huge soft patches across its whole width,
 *     warm where the light falls and cool where it does not;
 *   - the mould's wires print a grid through it that fades in and out along
 *     every line, because no wire touches the pulp evenly for its whole run;
 *   - the pulp is full of irregular fibre at several sizes;
 *   - and one part of it is lit more than another, with the corners falling
 *     away to a deckle-soft edge.
 *
 * Drop any one and belief goes: tone alone is a gradient swatch, the grid alone
 * is graph paper, the fibre alone is noise, the bloom alone is a lens flare
 * over nothing.
 *
 * The surface has no space in it, so depth is built out of SCALE rather than
 * distance. Three ranks of tonal field — enormous, middling, and small — at
 * radii better than four to one, each drifting at its own rate, are what give
 * the sheet a sense of body instead of a printed backdrop. Nothing in this
 * file is a shape: every mass is an accumulation of overlapping low-alpha
 * gradients, and every gradient runs its tail all the way to zero. A stop that
 * still carries alpha when it ends leaves a rim, and a rim on a page is a
 * coffee ring.
 *
 * Everything is soft-edged for the usual reason — this canvas is 768x448 and
 * upscaled, so a true hairline lands between texels and smears into a grey
 * ghost. The laid lines get their crispness from sub-pixel `fillRect` heights
 * (which the rasteriser antialiases into a soft band) rather than from
 * `stroke` at `lineWidth` 1, which would fight the upscale.
 *
 * The test the whole file is written against: it must look like expensive
 * paper, and never like a dirty screen.
 *
 * PEARL's signature (passes 1.5, 3.5 and 4.5) tilts the sheet toward warm
 * polished stone: long soft marble veins in the ground, a gilded floral
 * arabesque growing in from the end-edge and owning the outer quarter, and
 * the near-still shadow of foliage falling diagonally across the open area.
 * The rule those passes obey is the scene's own: gilding and light on stone,
 * never a busy pattern — when in doubt, they dim.
 */
export const paintPaper: ScenePainter = (f) => {
  const { ctx, W, H, palette: p, comp } = f;

  /**
   * Local time. Read this, never `f.t`. The Qur'an reading route sets
   * `speed: 0` because motion behind Qur'anic text is forbidden, and this
   * scene is the one most likely to end up there — a page behind a page. One
   * stray `f.t` would leave the bloom crawling under the mushaf forever, and
   * no screenshot would ever catch it.
   *
   * Every drift term below is `sin(t * k)` with no phase offset, so at t = 0
   * they are all exactly zero. A frozen section therefore receives the
   * canonical, centred composition rather than an arbitrary point along a
   * cycle, and the ranks separate only as time runs.
   */
  const t = f.t * comp.speed;

  /** House rule: artistic alpha * level * weight. Nothing draws without it. */
  const A = f.level * comp.weight;
  if (A <= 0) return;
  const a = (v: number): number => v * A;

  const fx = W * clamp01(comp.focusX);
  const fy = H * clamp01(comp.focusY);
  const hy = H * clamp01(comp.horizon);
  const D = clamp01(comp.density);
  const R = Math.max(W, H);
  const diag = Math.hypot(W, H);

  /**
   * How lit a point on the sheet is: 1 at the focal point, easing to 0 well
   * before the far corner. Every layer in the file reads this — the tonal
   * fields choose warm or cool by it, the wires fade where the light is
   * head-on and print where it rakes, the fibre softens under the bloom, the
   * deckle darkens least on the side the light is on. One rule, applied
   * everywhere, is most of what makes a flat surface read as a lit object.
   */
  const lit = (x: number, y: number): number =>
    1 - clamp01(Math.hypot(x - fx, y - fy) / (diag * 0.62));

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // -------------------------------------------------------------------------
  // PASS 0 — the sheet itself.
  //
  // The theme's own page colour, laid down solid so every later mark is
  // computed against a known value instead of against whatever happens to be
  // behind the canvas. Without it the scene composites onto transparency and
  // the alphas below — which are chosen to sit a hair under the page — would
  // land on an unpredictable ground and either vanish or turn to grit.
  //
  // Note this is also why nothing here uses `multiply`, which is the obvious
  // choice for ink on paper: over a backing canvas that started transparent,
  // multiply has nothing to multiply against at the edges and produces hard
  // seams. Plain `source-over` at tiny alpha gets to the same place safely.
  // -------------------------------------------------------------------------
  ctx.fillStyle = rgba(p.ground, a(1));
  ctx.fillRect(0, 0, W, H);

  // -------------------------------------------------------------------------
  // PASS 1 — the sheet is not flat in tone.
  //
  // Eighteen enormous overlapping fields in three ranks. A hand-formed sheet
  // drains unevenly and dries unevenly, and that inequality — no two areas
  // quite the same value, no area obviously darker either — is most of what
  // separates paper from a fill.
  //
  // The ranks matter as much as the count. Rank 0 is wider than the canvas
  // diagonal and moves barely at all; rank 2 is a quarter that size and moves
  // three times faster. Only one rank and the page has a mood but no body;
  // three at genuinely different scales and the unevenness has structure at
  // every distance you look from.
  // -------------------------------------------------------------------------

  /** One tonal patch. Six stops so the falloff is a curve, not a cone, and so
   *  the last quarter of the radius is nearly all tail. Filled only over its
   *  own bounding box: rank 2's patches cover a fraction of the frame and
   *  eighteen full-canvas fills would cost more than the whole rest of the
   *  scene. */
  const field = (cx: number, cy: number, r: number, hue: string, al: number): void => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, rgba(hue, al));
    g.addColorStop(0.3, rgba(hue, al * 0.74));
    g.addColorStop(0.56, rgba(hue, al * 0.42));
    g.addColorStop(0.78, rgba(hue, al * 0.17));
    g.addColorStop(0.92, rgba(hue, al * 0.05));
    g.addColorStop(1, rgba(hue, 0));
    ctx.fillStyle = g;
    const x0 = Math.max(0, cx - r);
    const y0 = Math.max(0, cy - r);
    const x1 = Math.min(W, cx + r);
    const y1 = Math.min(H, cy + r);
    if (x1 > x0 && y1 > y0) ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  };

  const ranks: Array<{
    n: number;
    rad: number;
    al: number;
    rx: number;
    ry: number;
    amp: number;
    salt: number;
  }> = [
    // count, radius (x R), base alpha, x-rate, y-rate, drift amplitude, salt
    { n: 4, rad: 1.30, al: 0.021, rx: 0.031, ry: 0.024, amp: 0.022, salt: 101 },
    { n: 6, rad: 0.60, al: 0.016, rx: 0.068, ry: 0.052, amp: 0.014, salt: 211 },
    { n: 8, rad: 0.29, al: 0.012, rx: 0.121, ry: 0.094, amp: 0.008, salt: 331 },
  ];

  for (let k = 0; k < ranks.length; k++) {
    const rk = ranks[k];
    for (let i = 0; i < rk.n; i++) {
      /**
       * Centres are scattered over a frame and a half so a patch can sit
       * mostly off-canvas and only bleed a shoulder into it. Confining the
       * centres to the visible rect would put a soft bullseye inside the frame
       * for every one of them, which is the same mistake as giving a cloud a
       * bright core.
       */
      const cx0 = W * (-0.25 + f.rnd(i, rk.salt) * 1.5);
      const cy0 = H * (-0.25 + f.rnd(i, rk.salt + 1) * 1.5);

      // Per-patch rates, not per-patch phases: rates diverge over time while
      // still summing to zero offset at t = 0.
      const dx = Math.sin(t * (rk.rx + i * 0.0091)) * W * rk.amp;
      const dy = Math.sin(t * (rk.ry + i * 0.0073)) * H * rk.amp * 0.8;
      const cx = cx0 + dx;
      const cy = cy0 + dy;

      const l = lit(cx, cy);
      /**
       * Warm where the light is, cool where it is not — but chosen with a
       * random draw biased by the light rather than by a threshold, so the two
       * families interleave near the middle instead of meeting along a line.
       * `shade` is a single neutral: two copies of it can only make the page
       * uneven in *value*, and a page that varies only in value reads as
       * grubby. The accent patches are what give the unevenness a direction in
       * hue, far below the threshold where anyone would name a colour.
       */
      const warmField = f.rnd(i, rk.salt + 2) < 0.34 + l * 0.52;
      const tint = warmField ? 0.55 + l * 0.8 : 0.5 + (1 - l) * 0.85;
      const al = rk.al * tint * (0.62 + f.rnd(i, rk.salt + 3) * 0.76);
      const r = R * rk.rad * (0.8 + f.rnd(i, rk.salt + 4) * 0.45);

      field(cx, cy, r, warmField ? p.accent : p.shade, a(al));
    }
  }

  /**
   * The warm-to-cool swing across the whole sheet, under the patches. Two
   * whisper-weight directional washes that key off `focusX`, so the lit half
   * always drifts a fraction toward the theme's accent and the shaded half a
   * fraction toward its teal. Remove them and the sheet goes grey and slightly
   * dirty, which is the exact failure this scene must avoid.
   */
  const warmDir = comp.focusX < 0.5 ? -1 : 1;
  const warm = ctx.createLinearGradient(
    W * (0.5 - warmDir * 0.5), 0,
    W * (0.5 + warmDir * 0.5), 0,
  );
  warm.addColorStop(0, rgba(p.accent, 0));
  warm.addColorStop(0.55, rgba(p.accent, a(0.011)));
  warm.addColorStop(1, rgba(p.accent, a(0.028)));
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, W, H);

  const cool = ctx.createLinearGradient(
    W * (0.5 + warmDir * 0.5), H,
    W * (0.5 - warmDir * 0.5), 0,
  );
  cool.addColorStop(0, rgba(p.teal, 0));
  cool.addColorStop(0.6, rgba(p.teal, a(0.007)));
  cool.addColorStop(1, rgba(p.teal, a(0.020)));
  ctx.fillStyle = cool;
  ctx.fillRect(0, 0, W, H);

  /**
   * `horizon` in a scene with no landscape. Every other painter reads it as a
   * ground line; here it is the height at which the sheet stops being lit from
   * the front and starts lying against the surface under it — a very broad,
   * very soft settling of tone with no edge of its own. It is what keeps the
   * page from floating, and it is the only thing in the scene that responds to
   * `horizon` at all, so without it a section that moves its horizon gets an
   * identical picture and the composition table stops meaning anything here.
   */
  const bedTop = Math.max(0, hy - H * 0.46);
  const bed = ctx.createLinearGradient(0, bedTop, 0, H);
  bed.addColorStop(0, rgba(p.shade, 0));
  bed.addColorStop(0.45, rgba(p.shade, a(0.006)));
  bed.addColorStop(0.78, rgba(p.shade, a(0.016)));
  bed.addColorStop(1, rgba(p.shade, a(0.028)));
  ctx.fillStyle = bed;
  ctx.fillRect(0, bedTop, W, H - bedTop);

  // -------------------------------------------------------------------------
  // PASS 1.5 — the stone in the sheet.
  //
  // The reference the owner supplied is not paper at all but warm polished
  // marble, and what says "stone" rather than "pulp" at a glance is veining:
  // two or three enormously long diagonal drifts of tone running the whole
  // sheet. They are BANDS, not lines — each is a single soft-shouldered
  // gradient wider than a hand, rising to a peak far below anything the eye
  // could trace as an edge, so from reading distance they register only as the
  // sheet being faintly grained in one direction. One of the three is cool
  // where the others are neutral, because marble veins are mineral and carry a
  // hue the ground does not. Static: stone does not drift.
  // -------------------------------------------------------------------------
  for (let v = 0; v < 3; v++) {
    const angV = -0.58 + (f.rnd(v, 66) - 0.5) * 0.24;
    const off = (f.rnd(v, 67) - 0.5) * H * 1.1;
    const halfV = 26 + f.rnd(v, 68) * 44;
    const hueV = v === 1 ? p.teal : p.shade;
    const alV = 0.008 + f.rnd(v, 69) * 0.007;
    ctx.save();
    ctx.translate(W * 0.5, H * 0.5);
    ctx.rotate(angV);
    const gv = ctx.createLinearGradient(0, off - halfV, 0, off + halfV);
    gv.addColorStop(0, rgba(hueV, 0));
    gv.addColorStop(0.5, rgba(hueV, a(alV)));
    gv.addColorStop(1, rgba(hueV, 0));
    ctx.fillStyle = gv;
    ctx.fillRect(-diag, off - halfV, diag * 2, halfV * 2);
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // PASS 2 — the mould.
  //
  // Laid paper is formed on a screen of closely spaced wires held together by
  // a few widely spaced stitches, and the pulp settles thinner over every
  // wire. Held to the light the sheet prints that whole grid back. This is the
  // layer that names the scene: without it the picture is a warm wash and
  // could be any surface at all; with it, it can only be paper.
  //
  // The one rule that keeps it from being graph paper is that NO LINE IS
  // UNIFORM. A wire lies against the pulp harder in some parts of its run than
  // others, so each line here is three overlapping segments of differing
  // weight, and each segment is itself a gradient that rises and falls and
  // ends at zero at both ends. Nothing starts or stops; lines surface and
  // submerge. Their alpha is around half what the previous version used —
  // barely perceptible is the brief, and on a light ground everything shows.
  //
  // Still drawn as `fillRect`s of fractional height rather than as strokes. A
  // stroke of width 1 on this small canvas snaps to a texel and then gets
  // scaled up into a hard grey wire; a 0.7px rect lands soft, which is what a
  // wire mark actually looks like.
  // -------------------------------------------------------------------------
  const LAID = 36;
  const step = H / LAID;
  const SEGS = 3;

  for (let i = 0; i < LAID; i++) {
    /**
     * Jitter both the position and the weight. A mould is strung by hand and
     * its wires are neither evenly spaced nor identically thick; a perfectly
     * regular grid immediately reads as a CSS repeating-linear-gradient, which
     * is the tell that ruined the first attempt at this scene.
     */
    const jitter = (f.rnd(i, 11) - 0.5) * step * 0.3;
    const y = (i + 0.5) * step + jitter;
    const thick = 0.5 + f.rnd(i, 12) * 0.5;
    const base = 0.0072 + f.rnd(i, 13) * 0.0076;

    for (let s = 0; s < SEGS; s++) {
      const j = i * SEGS + s;
      // Segments overlap by roughly a third of their length and overhang both
      // frame edges, so the run has no visible joins and no visible ends.
      const x0 = W * (-0.08 + s * 0.36) + (f.rnd(j, 14) - 0.5) * W * 0.06;
      const x1 = x0 + W * (0.44 + f.rnd(j, 15) * 0.14);

      /**
       * Wires disappear where the light hits the sheet straight on and show
       * most where it rakes. Fading each segment by its own distance from the
       * focal point stops the grid reading as a flat overlay printed on top of
       * the tone, and ties it to the same light the bloom below comes from.
       */
      const near = lit((x0 + x1) * 0.5, y);
      const al = base * (1 - near * 0.52) * (0.5 + f.rnd(j, 16) * 0.95);
      const mid = 0.6 + f.rnd(j, 17) * 0.55;

      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, rgba(p.shade, 0));
      g.addColorStop(0.16, rgba(p.shade, a(al * 0.5)));
      g.addColorStop(0.38, rgba(p.shade, a(al)));
      g.addColorStop(0.58, rgba(p.shade, a(al * mid)));
      g.addColorStop(0.8, rgba(p.shade, a(al * 0.28)));
      g.addColorStop(1, rgba(p.shade, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x0, y, x1 - x0, thick);
    }
  }

  /**
   * The chain lines. Five to seven, an order of magnitude further apart than
   * the wires and heavier — but built as a column of five overlapping soft
   * ellipses rather than drawn as a band, for the same reason the wires are
   * segmented: a chain stitch pulls the pulp away over a few millimetres, and
   * it does not pull equally down the whole height of the sheet. Stacking
   * ellipses gives a line whose weight breathes along its length and which has
   * no edge in either axis. A crisp dark rule here would be the single most
   * "clip-art" mark in the whole folder.
   */
  const chains = 5 + Math.floor(f.rnd(1, 21) * 3);
  const NODES = 5;
  for (let i = 0; i < chains; i++) {
    const x = W * ((i + 0.5) / chains + (f.rnd(i, 22) - 0.5) * 0.05);
    const halfW = 3 + f.rnd(i, 23) * 2.4;

    for (let k = 0; k < NODES; k++) {
      const j = i * NODES + k;
      const y = H * ((k + 0.5) / NODES) + (f.rnd(j, 25) - 0.5) * H * 0.07;
      // Reach is longer than the spacing, so consecutive nodes always overlap
      // and the column fuses instead of beading.
      const rise = H * (0.17 + f.rnd(j, 26) * 0.11);
      const near = lit(x, y);
      const al = (0.011 + f.rnd(j, 27) * 0.010) * (1 - near * 0.45);

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(halfW / rise, 1);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rise);
      g.addColorStop(0, rgba(p.shade, a(al)));
      g.addColorStop(0.35, rgba(p.shade, a(al * 0.66)));
      g.addColorStop(0.66, rgba(p.shade, a(al * 0.28)));
      g.addColorStop(0.86, rgba(p.shade, a(al * 0.08)));
      g.addColorStop(1, rgba(p.shade, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rise, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // -------------------------------------------------------------------------
  // PASS 3 — fibre.
  //
  // Short unaligned inclusions in the pulp, and the finest scale in the scene.
  // They exist to break the regularity of pass 2 — a grid over a smooth wash
  // still looks manufactured, and it is the irregular matter caught between
  // the wires that makes the surface look formed rather than printed.
  //
  // Roughly twice as many as before, at half the alpha, spread over five size
  // tiers instead of three. That trade is the whole point: fibre you can pick
  // out individually is dirt, fibre you can only see as a change in the
  // surface is texture, and the way to more texture is more marks that are
  // each less visible, not fewer that are stronger.
  //
  // Batched into paths rather than drawn one at a time. Each fleck as its own
  // save/rotate/restore would cost several hundred state changes for marks
  // that are individually invisible; ten `stroke()` calls over ten accumulated
  // paths give the same picture.
  // -------------------------------------------------------------------------
  const flecks = Math.round(96 + 84 * D);
  const tiers: Array<[number, number, number]> = [
    // [alpha, lineWidth, length scale] — finest and longest, down to shortest.
    [0.0080, 0.45, 1.7],
    [0.0105, 0.55, 1.1],
    [0.0135, 0.70, 0.8],
    [0.0175, 0.85, 0.55],
    [0.0215, 1.00, 0.38],
  ];

  ctx.lineCap = 'round';
  for (let tier = 0; tier < tiers.length; tier++) {
    const [al, lw, ls] = tiers[tier];

    /**
     * Two sub-batches per tier: fibre under the bloom is softer, fibre out in
     * the shaded corners prints harder. The split is a threshold on `lit`, but
     * the threshold is dithered per fleck — without that jitter the change in
     * contrast would trace a clean circle through the texture, which is the
     * one artefact a light theme cannot absorb.
     */
    for (let half = 0; half < 2; half++) {
      ctx.beginPath();
      let drawn = false;

      for (let i = tier; i < flecks; i += tiers.length) {
        const x = f.rnd(i, 31) * W;
        const y = f.rnd(i, 32) * H;
        const near = lit(x, y) + (f.rnd(i, 35) - 0.5) * 0.34 > 0.46 ? 1 : 0;
        if (near !== half) continue;

        /**
         * Angles are biased to within about +-35 degrees of horizontal instead
         * of being uniform over the circle. Fibre in a hand-formed sheet lines
         * up loosely with the direction the mould is shaken, which is the same
         * direction the laid lines run — so a uniform scatter of angles
         * actually looks *less* random than this does, because it disagrees
         * with the grid it is sitting in.
         */
        const ang = (f.rnd(i, 33) - 0.5) * 1.2;
        const len = (1.8 + f.rnd(i, 34) * 4.4) * ls;
        const dx = Math.cos(ang) * len * 0.5;
        const dy = Math.sin(ang) * len * 0.5;

        ctx.moveTo(x - dx, y - dy);
        ctx.lineTo(x + dx, y + dy);
        drawn = true;
      }

      if (!drawn) continue;
      ctx.strokeStyle = rgba(p.shade, a(al * (half === 1 ? 0.62 : 1.12)));
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }

  /**
   * A handful of long fibres — the strands that survived the beater whole and
   * lie across several wires at once. They are what stops the fibre layer
   * reading as a single grain size, and there are deliberately very few: this
   * is the largest mark on the sheet and the most able to look like a scratch.
   *
   * Each is drawn twice, once full length and once over its middle only, so
   * the accumulated weight tapers toward the ends and neither end stops on a
   * defined tip.
   */
  const longs = Math.round(4 + 5 * D);
  for (let i = 0; i < longs; i++) {
    const x = f.rnd(i, 51) * W;
    const y = f.rnd(i, 52) * H;
    const ang = (f.rnd(i, 53) - 0.5) * 1.15;
    const len = 24 + f.rnd(i, 54) * 44;
    const bow = (f.rnd(i, 55) - 0.5) * len * 0.3;
    const al = (0.0085 + f.rnd(i, 56) * 0.0065) * (1 - lit(x, y) * 0.38);
    const cx = Math.cos(ang);
    const sy = Math.sin(ang);

    ctx.strokeStyle = rgba(p.shade, a(al));
    ctx.lineWidth = 0.45 + f.rnd(i, 57) * 0.3;
    for (let pass = 0; pass < 2; pass++) {
      const h = (len * (pass === 0 ? 1 : 0.56)) * 0.5;
      const b = bow * (pass === 0 ? 1 : 0.56);
      ctx.beginPath();
      ctx.moveTo(x - cx * h, y - sy * h);
      ctx.quadraticCurveTo(x - sy * b, y + cx * b, x + cx * h, y + sy * h);
      ctx.stroke();
    }
  }

  /**
   * Pulp knots — places where the fibre balled up before the sheet was
   * couched. Soft radials, never dots: a hard-edged speck at any alpha reads
   * as a dead pixel or a spot of grime, and the softness is the entire
   * difference between "thickness in the paper" and "something on the paper".
   * Faint under the light, a shade stronger out in the corners.
   */
  const knots = Math.round(4 + 5 * D);
  for (let i = 0; i < knots; i++) {
    const x = f.rnd(i, 41) * W;
    const y = f.rnd(i, 42) * H;
    const r = 6 + f.rnd(i, 43) * 11;
    const al = 0.016 * (1 - lit(x, y) * 0.4);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(p.shade, a(al)));
    g.addColorStop(0.4, rgba(p.shade, a(al * 0.55)));
    g.addColorStop(0.72, rgba(p.shade, a(al * 0.2)));
    g.addColorStop(1, rgba(p.shade, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // -------------------------------------------------------------------------
  // PASS 3.5 — SIGNATURE: the gilded arabesque.
  //
  // From the end-edge of the frame a border of gold floral ornament grows
  // inward: scrolling stems carrying flat medallion rosettes, split-palmette
  // leaves and small buds — dense against the edge, thinning as it reaches
  // toward the open sheet, and never past the outer quarter. It is drawn
  // entirely in the accent triple at gilding weight: strong enough to read as
  // metal laid into the stone, far too faint to compete with ink. Every
  // element is placed and jittered by rnd(), every petal is a filled bezier
  // with its gradient deeper at the base, and every stem is two passes of
  // decreasing width — nothing here is a hairline, because a hairline smears
  // under the upscale. The outermost elements are slightly stronger, exactly
  // as leaf gilding wears: brightest where the border is densest. Static by
  // design — gilding is the one part of this world that could never move.
  // -------------------------------------------------------------------------
  const bandX = W * 0.73;
  const edgeOf = (x: number): number => clamp01((x - bandX) / (W - bandX));

  // A faint warmth under the whole band, so the ornament sits IN a gilded
  // margin rather than floating as separate stickers on bare stone.
  const gild = ctx.createLinearGradient(bandX, 0, W, 0);
  gild.addColorStop(0, rgba(p.accent, 0));
  gild.addColorStop(0.6, rgba(p.accent, a(0.012)));
  gild.addColorStop(1, rgba(p.accent, a(0.026)));
  ctx.fillStyle = gild;
  ctx.fillRect(bandX, 0, W - bandX, H);

  /** Two-pass gilt stem: a wide soft underlay and a narrower brighter core. */
  const gStem = (
    x0: number, y0: number, qx: number, qy: number,
    x1: number, y1: number, al: number,
  ): void => {
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = rgba(p.accent, a(al * (pass === 0 ? 0.45 : 0.85)));
      ctx.lineWidth = pass === 0 ? 1.9 : 0.95;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(qx, qy, x1, y1);
      ctx.stroke();
    }
  };

  /** A rosette: 6-8 filled bezier petals around a soft core, each petal's
   *  length and angle jittered so no two blossoms are the same medallion. */
  const gRosette = (cx: number, cy: number, r: number, al: number, seed: number): void => {
    const petals = 6 + Math.floor(f.rnd(seed, 71) * 3);
    const rot = f.rnd(seed, 72) * TAU;
    for (let k = 0; k < petals; k++) {
      const ang = rot + (k / petals) * TAU + (f.rnd(seed * 31 + k, 73) - 0.5) * 0.14;
      const len = r * (0.84 + f.rnd(seed * 31 + k, 74) * 0.3);
      const wid = len * (0.36 + f.rnd(seed * 31 + k, 75) * 0.12);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      const gp = ctx.createLinearGradient(0, 0, len, 0);
      gp.addColorStop(0, rgba(p.accent, a(al)));
      gp.addColorStop(0.55, rgba(p.accent, a(al * 0.8)));
      gp.addColorStop(1, rgba(p.accent, a(al * 0.4)));
      ctx.fillStyle = gp;
      ctx.beginPath();
      ctx.moveTo(len * 0.14, 0);
      ctx.bezierCurveTo(len * 0.34, -wid, len * 0.9, -wid * 0.6, len, 0);
      ctx.bezierCurveTo(len * 0.9, wid * 0.6, len * 0.34, wid, len * 0.14, 0);
      ctx.fill();
      ctx.restore();
    }
    const heart = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.32);
    heart.addColorStop(0, rgba(p.accent, a(al * 1.1)));
    heart.addColorStop(0.55, rgba(p.accent, a(al * 0.5)));
    heart.addColorStop(1, rgba(p.accent, 0));
    ctx.fillStyle = heart;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.32, 0, TAU);
    ctx.fill();
  };

  /** A split palmette: two mirrored crescent lobes parting at the tip. */
  const gPalmette = (
    cx: number, cy: number, ang: number, len: number, al: number, seed: number,
  ): void => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    const w = len * (0.34 + f.rnd(seed, 81) * 0.14);
    const gl = ctx.createLinearGradient(0, 0, len, 0);
    gl.addColorStop(0, rgba(p.accent, a(al)));
    gl.addColorStop(1, rgba(p.accent, a(al * 0.38)));
    ctx.fillStyle = gl;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(len * 0.3, -w * s, len * 0.85, -w * 0.8 * s, len, -w * 0.1 * s);
      ctx.bezierCurveTo(len * 0.62, -w * 0.3 * s, len * 0.24, -w * 0.2 * s, 0, 0);
      ctx.fill();
    }
    ctx.restore();
  };

  /** A closed bud: one small filled teardrop on the end of its stemlet. */
  const gBud = (cx: number, cy: number, ang: number, len: number, al: number): void => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    const w = len * 0.42;
    const gb = ctx.createLinearGradient(0, 0, len, 0);
    gb.addColorStop(0, rgba(p.accent, a(al)));
    gb.addColorStop(1, rgba(p.accent, a(al * 0.45)));
    ctx.fillStyle = gb;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.35, -w, len * 0.82, -w * 0.5, len, 0);
    ctx.bezierCurveTo(len * 0.82, w * 0.5, len * 0.35, w, 0, 0);
    ctx.fill();
    ctx.restore();
  };

  // The spines: long undulating stems running the height of the border, the
  // trellis everything else hangs from. Smooth S-curves with vertical
  // tangents, overhung past both frame edges so they never visibly end.
  for (let i = 0; i < 3; i++) {
    const sx = W - 7 - i * 10 - f.rnd(i, 76) * 6;
    const alS = 0.1 + edgeOf(sx) * 0.07;
    for (let pass = 0; pass < 2; pass++) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(p.accent, a(alS * (pass === 0 ? 0.45 : 0.8)));
      ctx.lineWidth = pass === 0 ? 2.0 : 1.0;
      ctx.beginPath();
      let px0 = sx + (f.rnd(i * 7, 77) - 0.5) * 16;
      ctx.moveTo(px0, -12);
      for (let seg = 1; seg <= 4; seg++) {
        const py1 = -12 + ((H + 24) * seg) / 4;
        const px1 = sx + (f.rnd(i * 7 + seg, 77) - 0.5) * 16;
        ctx.bezierCurveTo(px0, py1 - H * 0.12, px1, py1 - H * 0.12, px1, py1);
        px0 = px1;
      }
      ctx.stroke();
    }
  }

  // The rosettes, each grown in from the edge on its own branch. Depth is
  // biased hard toward the edge (pow > 1), which is what makes the border
  // dense against the frame and sparse at its inner reach; scale and alpha
  // both follow the same falloff so the far members are smaller and dimmer.
  const rosN = 9 + Math.round(2 * D);
  for (let i = 0; i < rosN; i++) {
    const depth = Math.pow(f.rnd(i, 83), 1.7);
    const rx = W - 10 - depth * (W - bandX - 14);
    const ry = H * ((i + f.rnd(i, 84)) / rosN);
    const e = edgeOf(rx);
    const rr = (7.5 + f.rnd(i, 85) * 6) * (0.7 + e * 0.5);
    const alR = 0.095 + e * 0.085 + f.rnd(i, 86) * 0.012;
    gStem(
      W + 4, ry + (f.rnd(i, 87) - 0.5) * H * 0.16,
      (rx + W) * 0.5 + (f.rnd(i, 88) - 0.5) * 24, ry + (f.rnd(i, 89) - 0.5) * 30,
      rx, ry, alR * 0.8,
    );
    gRosette(rx, ry, rr, alR, i);
  }

  // The palmettes, angled loosely inward the way leaves lean off a scroll.
  const palmN = 10 + Math.round(2 * D);
  for (let i = 0; i < palmN; i++) {
    const depth = Math.pow(f.rnd(i, 91), 1.5);
    const px = W - 6 - depth * (W - bandX - 10);
    const py = H * ((i + f.rnd(i, 92)) / palmN);
    const e = edgeOf(px);
    const angP = Math.PI + (f.rnd(i, 93) - 0.5) * 1.5;
    const lenP = (10 + f.rnd(i, 94) * 9) * (0.7 + e * 0.45);
    gPalmette(px, py, angP, lenP, 0.085 + e * 0.075 + f.rnd(i, 96) * 0.012, i);
  }

  // The buds, on short stemlets, filling the gaps the blossoms leave.
  for (let i = 0; i < 8; i++) {
    const depth = Math.pow(f.rnd(i, 97), 1.3);
    const bux = W - 8 - depth * (W - bandX - 6);
    const buy = H * ((i + f.rnd(i, 98)) / 8);
    const e = edgeOf(bux);
    const angB = Math.PI + (f.rnd(i, 99) - 0.5) * 2.2;
    const lenB = 5 + f.rnd(i, 102) * 4.5;
    const alB = 0.1 + e * 0.08;
    const sxx = bux - Math.cos(angB) * lenB * 1.6;
    const syy = buy - Math.sin(angB) * lenB * 1.6;
    gStem(
      sxx, syy,
      (sxx + bux) * 0.5 + (f.rnd(i, 103) - 0.5) * 6,
      (syy + buy) * 0.5 + (f.rnd(i, 104) - 0.5) * 6,
      bux, buy, alB * 0.7,
    );
    gBud(bux, buy, angB, lenB, alB);
  }

  // A few bare tendril curls — the scrollwork between the flowers, drawn with
  // the same two-pass weight as every other stem so nothing reads as a wire.
  for (let i = 0; i < 6; i++) {
    const depth = Math.pow(f.rnd(i, 106), 1.4);
    const cxx = W - 12 - depth * (W - bandX - 12);
    const cyy = H * ((i + f.rnd(i, 107)) / 6);
    const sC = 6 + f.rnd(i, 108) * 7;
    const alC = 0.09 + edgeOf(cxx) * 0.06;
    const dir = f.rnd(i, 109) < 0.5 ? 1 : -1;
    for (let pass = 0; pass < 2; pass++) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(p.accent, a(alC * (pass === 0 ? 0.5 : 0.85)));
      ctx.lineWidth = pass === 0 ? 1.7 : 0.9;
      ctx.beginPath();
      ctx.moveTo(cxx + sC, cyy + dir * sC * 0.2);
      ctx.bezierCurveTo(
        cxx + sC * 0.2, cyy - dir * sC,
        cxx - sC, cyy - dir * sC * 0.5,
        cxx - sC * 0.3, cyy + dir * sC * 0.45,
      );
      ctx.stroke();
    }
  }

  // -------------------------------------------------------------------------
  // PASS 4 — the light on the sheet.
  //
  // Three summed radials at the focal point, and this is the layer that turns
  // a texture sample into a photograph of a page. A surface lit evenly
  // everywhere has no light in it at all; the grid, the fibre and the tonal
  // ranks above are every one of them already dimmed or warmed toward this
  // point in anticipation of it. Painting it last means it warms everything
  // beneath rather than sitting under the marks, which is how light on a page
  // behaves.
  //
  // Three curves rather than one because a single gradient has a single
  // falloff and reads as a soft disc. A small bright core summed into a mid
  // wash summed into an enormous dim halo gives a curve that is warm at the
  // centre and very long in the tail, and the long tail is what prevents any
  // visible boundary to the lit area.
  // -------------------------------------------------------------------------

  /**
   * The only motion in the scene, and it is meant to be below the threshold of
   * conscious notice — a couple of pixels over a forty-second cycle, as though
   * the light outside the room changed slightly. `sin(t * k)` with no phase
   * offset is deliberate: at t = 0 it is exactly 0, so the frozen frame a
   * `speed: 0` section receives is the canonical centred composition rather
   * than an arbitrary point along the drift.
   */
  const bx = fx + Math.sin(t * 0.16) * W * 0.008;
  const by = fy + Math.sin(t * 0.11) * H * 0.006;

  const halo = ctx.createRadialGradient(bx, by, 0, bx, by, R * 0.98);
  halo.addColorStop(0, rgba(p.accent, a(0.040)));
  halo.addColorStop(0.34, rgba(p.accent, a(0.023)));
  halo.addColorStop(0.66, rgba(p.accent, a(0.009)));
  halo.addColorStop(0.86, rgba(p.accent, a(0.003)));
  halo.addColorStop(1, rgba(p.accent, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  const wash = ctx.createRadialGradient(bx, by, 0, bx, by, R * 0.46);
  wash.addColorStop(0, rgba(p.accent, a(0.030)));
  wash.addColorStop(0.42, rgba(p.accent, a(0.016)));
  wash.addColorStop(0.74, rgba(p.accent, a(0.005)));
  wash.addColorStop(1, rgba(p.accent, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  /**
   * `sheen` appears only here. It is the lightest token the theme owns and it
   * is the one mark in the file that lifts the page rather than settling it —
   * spread any wider it bleaches the sheet and the paper turns to screen.
   */
  const core = ctx.createRadialGradient(bx, by, 0, bx, by, R * 0.26);
  core.addColorStop(0, rgba(p.sheen, a(0.052)));
  core.addColorStop(0.4, rgba(p.sheen, a(0.026)));
  core.addColorStop(0.72, rgba(p.sheen, a(0.008)));
  core.addColorStop(1, rgba(p.sheen, 0));
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, W, H);

  // -------------------------------------------------------------------------
  // PASS 4.5 — SIGNATURE: the shadow of foliage.
  //
  // Across the open area of the sheet, the soft shadow of a plant standing
  // somewhere off-frame in the sunlight: a diagonal run of leaf-cluster
  // shapes in the shade triple, so faint they read as weather on the stone
  // rather than as an object. Everything about a cast shadow is soft — every
  // leaflet is a radial gradient squashed along its own axis, every cluster
  // has a shapeless heart under its leaves, and no edge anywhere reaches an
  // alpha the eye could trace. Painted AFTER the light because a shadow is an
  // absence of it. This is the only thing in the scene that moves: a sway of
  // a couple of pixels on rates measured in minutes — sin(t * k), zero at
  // t = 0, dead still at speed 0 — as though the plant stood in still air.
  // -------------------------------------------------------------------------
  for (let c = 0; c < 4; c++) {
    const pxc = W * (0.08 + c * 0.155 + (f.rnd(c, 121) - 0.5) * 0.07);
    const pyc = H * (0.1 + c * 0.21 + (f.rnd(c, 122) - 0.5) * 0.1);
    const cx2 = pxc + Math.sin(t * (0.024 + c * 0.006)) * 2.2;
    const cy2 = pyc + Math.sin(t * (0.017 + c * 0.005)) * 1.3;
    const sc = 0.8 + f.rnd(c, 123) * 0.5;

    const rb = 34 * sc;
    const gb = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, rb);
    gb.addColorStop(0, rgba(p.shade, a(0.016)));
    gb.addColorStop(0.5, rgba(p.shade, a(0.009)));
    gb.addColorStop(1, rgba(p.shade, 0));
    ctx.fillStyle = gb;
    ctx.fillRect(cx2 - rb, cy2 - rb, rb * 2, rb * 2);

    for (let k = 0; k < 7; k++) {
      const j = c * 7 + k;
      const angL = 0.62 + (f.rnd(j, 124) - 0.5) * 1.5
        + Math.sin(t * (0.013 + j * 0.0021)) * 0.012;
      const dL = (6 + f.rnd(j, 125) * 30) * sc;
      const lr = (8 + f.rnd(j, 126) * 8) * sc;
      const alL = 0.014 + f.rnd(j, 127) * 0.012;
      ctx.save();
      ctx.translate(cx2 + Math.cos(angL) * dL, cy2 + Math.sin(angL) * dL);
      ctx.rotate(angL);
      ctx.scale(1, 0.42 + f.rnd(j, 128) * 0.16);
      const gl2 = ctx.createRadialGradient(0, 0, 0, 0, 0, lr);
      gl2.addColorStop(0, rgba(p.shade, a(alL)));
      gl2.addColorStop(0.55, rgba(p.shade, a(alL * 0.5)));
      gl2.addColorStop(1, rgba(p.shade, 0));
      ctx.fillStyle = gl2;
      ctx.beginPath();
      ctx.arc(0, 0, lr, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // -------------------------------------------------------------------------
  // PASS 5 — the deckle, and the far corners falling away.
  //
  // Two different darkenings, and they are not the same idea. The first is a
  // property of the SHEET: a hand-made page is thinner and softer where the
  // pulp ran out against the frame, so it takes a shade more tone along every
  // border. The second is a property of the LIGHT: a page under one lamp is
  // never as bright at the corners furthest from it.
  //
  // Both are kept under 0.03. Anything heavier turns into a visible frame
  // around the reading area, which is exactly the kind of foreground object
  // this scene must never produce. Each ramp reaches zero a quarter of the way
  // in, over four stops, so there is no line where the darkening stops.
  // -------------------------------------------------------------------------
  const deckle = (
    x0: number, y0: number, x1: number, y1: number,
    rx: number, ry: number, rw: number, rh: number,
    al: number,
  ): void => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, rgba(p.shade, a(al)));
    g.addColorStop(0.28, rgba(p.shade, a(al * 0.42)));
    g.addColorStop(0.58, rgba(p.shade, a(al * 0.14)));
    g.addColorStop(0.82, rgba(p.shade, a(al * 0.035)));
    g.addColorStop(1, rgba(p.shade, 0));
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  };

  // Each border darkens less on the side the light is on, so the deckle agrees
  // with pass 4 instead of ringing the frame evenly. The small per-edge random
  // is what keeps it from looking like a CSS box-shadow: a torn edge is not
  // the same weight all the way round.
  const inX = W * 0.26;
  const inY = H * 0.3;
  const eb = 0.019;
  const fxn = clamp01(comp.focusX);
  const fyn = clamp01(comp.focusY);

  deckle(0, 0, inX, 0, 0, 0, inX, H,
    eb * (0.5 + fxn * 0.8) * (0.85 + f.rnd(0, 61) * 0.3));
  deckle(W, 0, W - inX, 0, W - inX, 0, inX, H,
    eb * (0.5 + (1 - fxn) * 0.8) * (0.85 + f.rnd(1, 61) * 0.3));
  deckle(0, 0, 0, inY, 0, 0, W, inY,
    eb * (0.5 + fyn * 0.8) * (0.85 + f.rnd(2, 61) * 0.3));
  deckle(0, H, 0, H - inY, 0, H - inY, W, inY,
    eb * (0.5 + (1 - fyn) * 0.8) * (0.85 + f.rnd(3, 61) * 0.3));

  // The corners, centred on the light rather than on the frame.
  const fall = ctx.createRadialGradient(bx, by, R * 0.3, bx, by, R * 1.1);
  fall.addColorStop(0, rgba(p.shade, 0));
  fall.addColorStop(0.45, rgba(p.shade, a(0.006)));
  fall.addColorStop(0.75, rgba(p.shade, a(0.016)));
  fall.addColorStop(1, rgba(p.shade, a(0.030)));
  ctx.fillStyle = fall;
  ctx.fillRect(0, 0, W, H);

  ctx.restore();

  // `restore` returns the saved state, but the scene runner shares one context
  // across painters and a leaked alpha or composite mode would show up as an
  // unrelated scene mysteriously washing out. Reset explicitly.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};
