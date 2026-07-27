import { rgba, type ScenePainter } from './types';

/**
 * PAPER — a sheet of laid paper, seen flat, in even indoor light.
 *
 * This is the light theme's world, and it is the only scene in the folder with
 * nowhere to hide. The others paint darkness and add light to it, so a clumsy
 * value sinks harmlessly into the ground. Here the ground is already near the
 * top of the range: every mark can only go *down* from the page, and anything
 * that goes down too far stops being paper and starts being a stain. The whole
 * scene therefore lives in a band of alpha roughly a third of what `dust` or
 * `night` use, and the numbers below look absurdly small on purpose.
 *
 * The subject is a surface, not a space — there is no depth to build here, so
 * the layering does a different job. Real paper is legible as paper because
 * four unrelated things happen at four different scales at once: the sheet is
 * unevenly toned across its whole width, the mould's wires print a regular
 * grid through it, the pulp is full of irregular fibre, and the light falls on
 * one part of it more than another. Drop any one and the eye stops believing
 * the surface: tone alone is a gradient swatch, the grid alone is graph paper,
 * the fibre alone is noise, the bloom alone is a lens flare over nothing.
 *
 * Everything is soft-edged for the usual reason — this canvas is 768x448 and
 * upscaled, so a true hairline lands between texels and smears into a grey
 * ghost. The laid lines get their crispness from sub-pixel `fillRect` heights
 * (which the rasteriser antialiases into a soft band) rather than from
 * `stroke` at `lineWidth` 1, which would fight the upscale.
 */
export const paintPaper: ScenePainter = (f) => {
  const { ctx, W, H, palette: p, comp } = f;

  /**
   * Local time. Read this, never `f.t`. The Qur'an reading route sets
   * `speed: 0` because motion behind Qur'anic text is forbidden, and this
   * scene is the one most likely to end up there — a page behind a page. One
   * stray `f.t` would leave the bloom crawling under the mushaf forever, and
   * no screenshot would ever catch it.
   */
  const t = f.t * comp.speed;

  /** House rule: artistic alpha * level * weight. Nothing draws without it. */
  const A = f.level * comp.weight;
  const a = (v: number) => v * A;

  const fx = W * comp.focusX;
  const fy = H * comp.focusY;
  const hy = H * comp.horizon;
  const D = comp.density;
  const R = Math.max(W, H);

  ctx.save();

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
  // Two enormous radials in `shade`, pushed toward opposite corners and far
  // wider than the frame so neither shows a rim. A hand-formed sheet drains
  // unevenly and dries unevenly; the result is that no two areas of it are
  // quite the same value, and that inequality is most of what separates paper
  // from a fill. The radii are deliberately larger than the diagonal — the eye
  // is very good at finding the edge of a circle, and there must not be one.
  // -------------------------------------------------------------------------
  const toneA = ctx.createRadialGradient(
    W * 0.16, H * 0.1, 0,
    W * 0.16, H * 0.1, R * 1.35,
  );
  toneA.addColorStop(0, rgba(p.shade, a(0.026)));
  toneA.addColorStop(0.55, rgba(p.shade, a(0.012)));
  toneA.addColorStop(1, rgba(p.shade, 0));
  ctx.fillStyle = toneA;
  ctx.fillRect(0, 0, W, H);

  const toneB = ctx.createRadialGradient(
    W * 0.88, H * 0.94, 0,
    W * 0.88, H * 0.94, R * 1.2,
  );
  toneB.addColorStop(0, rgba(p.shade, a(0.032)));
  toneB.addColorStop(0.5, rgba(p.shade, a(0.014)));
  toneB.addColorStop(1, rgba(p.shade, 0));
  ctx.fillStyle = toneB;
  ctx.fillRect(0, 0, W, H);

  /**
   * The warm-to-cool swing across the sheet. `shade` is a single neutral, so
   * two overlapping copies of it can only make the page uneven in *value* —
   * and a page that varies only in value reads as dirty rather than as paper.
   * The two whisper-weight washes below give the unevenness a direction in
   * hue as well: the lit half drifts a fraction toward the theme's accent, the
   * shaded half a fraction toward its teal. Both are far below the threshold
   * where anyone would name a colour; remove them and the sheet goes grey and
   * slightly grubby, which is the exact failure this scene must avoid.
   *
   * They key off `focusX` so the warm side is always the side the light is on.
   */
  const warmDir = comp.focusX < 0.5 ? -1 : 1;
  const warm = ctx.createLinearGradient(
    W * (0.5 - warmDir * 0.5), 0,
    W * (0.5 + warmDir * 0.5), 0,
  );
  warm.addColorStop(0, rgba(p.accent, 0));
  warm.addColorStop(1, rgba(p.accent, a(0.030)));
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, W, H);

  const cool = ctx.createLinearGradient(
    W * (0.5 + warmDir * 0.5), H,
    W * (0.5 - warmDir * 0.5), 0,
  );
  cool.addColorStop(0, rgba(p.teal, 0));
  cool.addColorStop(1, rgba(p.teal, a(0.024)));
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
  const bed = ctx.createLinearGradient(0, hy - H * 0.42, 0, H);
  bed.addColorStop(0, rgba(p.shade, 0));
  bed.addColorStop(0.62, rgba(p.shade, a(0.013)));
  bed.addColorStop(1, rgba(p.shade, a(0.030)));
  ctx.fillStyle = bed;
  ctx.fillRect(0, Math.max(0, hy - H * 0.42), W, H);

  // -------------------------------------------------------------------------
  // PASS 2 — the mould.
  //
  // Laid paper is formed on a screen of closely spaced wires held together by
  // a few widely spaced stitches, and the pulp settles thinner over every
  // wire. Held to the light the sheet prints that whole grid back: dozens of
  // fine parallel lines with a handful of much heavier ones crossing them.
  // This is the layer that names the scene. Without it the picture is a warm
  // wash and could be any surface at all; with it, it can only be paper.
  //
  // The lines are drawn as `fillRect`s of fractional height rather than as
  // strokes. A stroke of width 1 on this small canvas snaps to a texel and
  // then gets scaled up into a hard grey wire; a 0.8px rect lands soft, which
  // is what a wire mark actually looks like.
  // -------------------------------------------------------------------------
  const LAID = 40;
  const step = H / LAID;

  for (let i = 0; i < LAID; i++) {
    /**
     * Jitter both the position and the weight. A mould is strung by hand and
     * its wires are neither evenly spaced nor identically thick; a perfectly
     * regular grid immediately reads as a CSS repeating-linear-gradient, which
     * is the tell that ruined the first attempt at this scene.
     */
    const jitter = (f.rnd(i, 11) - 0.5) * step * 0.28;
    const y = (i + 0.5) * step + jitter;
    const thick = 0.55 + f.rnd(i, 12) * 0.55;

    /**
     * Wires disappear where the light hits the sheet straight on and show
     * most where it rakes. Fading each line by its distance from the focal
     * point is a one-line cost that stops the grid reading as a flat overlay
     * printed on top of the tone, and instead ties it to the same light the
     * bloom below comes from.
     */
    const near = 1 - Math.min(1, Math.abs(y - fy) / (H * 0.85));
    const al = (0.020 + f.rnd(i, 13) * 0.014) * (1 - near * 0.45);

    ctx.fillStyle = rgba(p.shade, a(al));
    ctx.fillRect(0, y, W, thick);
  }

  /**
   * The chain lines. Five to seven, an order of magnitude further apart, and
   * heavier — but drawn as narrow gradient bands rather than as lines, because
   * a chain stitch pulls the pulp away over a few millimetres rather than
   * along a wire's width. A crisp dark rule here would be the single most
   * "clip-art" mark in the whole folder.
   */
  const chains = 5 + Math.floor(f.rnd(1, 21) * 3);
  for (let i = 0; i < chains; i++) {
    const x = W * ((i + 0.5) / chains + (f.rnd(i, 22) - 0.5) * 0.06);
    const halfW = 2.2 + f.rnd(i, 23) * 1.8;
    const al = 0.030 + f.rnd(i, 24) * 0.020;

    const band = ctx.createLinearGradient(x - halfW, 0, x + halfW, 0);
    band.addColorStop(0, rgba(p.shade, 0));
    band.addColorStop(0.5, rgba(p.shade, a(al)));
    band.addColorStop(1, rgba(p.shade, 0));
    ctx.fillStyle = band;
    ctx.fillRect(x - halfW, 0, halfW * 2, H);
  }

  // -------------------------------------------------------------------------
  // PASS 3 — fibre.
  //
  // Short unaligned inclusions in the pulp. They are the smallest scale in the
  // scene and they exist to break the regularity of pass 2: a grid over a
  // smooth wash still looks manufactured, and it is the irregular matter
  // caught between the wires that makes the surface look formed rather than
  // printed.
  //
  // Batched into three passes rather than drawn one at a time. Each fleck as
  // its own save/rotate/restore would cost several hundred state changes for
  // marks that are individually invisible; three `stroke()` calls over three
  // accumulated paths give the same picture, and the three alpha/width tiers
  // are what stop the fibre from reading as one uniform speckle — which is
  // precisely when it would start to look like dirt on the page.
  // -------------------------------------------------------------------------
  const flecks = Math.round(45 + 55 * D);
  const tiers: Array<[number, number, number]> = [
    // [alpha, lineWidth, length scale] — faint and long, to mid, to short.
    [0.020, 0.7, 1.4],
    [0.028, 0.9, 1.0],
    [0.038, 1.1, 0.6],
  ];

  ctx.lineCap = 'round';
  for (let tier = 0; tier < tiers.length; tier++) {
    const [al, lw, ls] = tiers[tier];
    ctx.beginPath();

    for (let i = tier; i < flecks; i += tiers.length) {
      const x = f.rnd(i, 31) * W;
      const y = f.rnd(i, 32) * H;

      /**
       * Angles are biased to within about +-35 degrees of horizontal instead
       * of being uniform over the circle. Fibre in a hand-formed sheet lines
       * up loosely with the direction the mould is shaken, which is the same
       * direction the laid lines run — so a uniform scatter of angles actually
       * looks *less* random than this does, because it disagrees with the grid
       * it is sitting in.
       */
      const ang = (f.rnd(i, 33) - 0.5) * 1.2;
      const len = (2.5 + f.rnd(i, 34) * 6) * ls;
      const dx = Math.cos(ang) * len * 0.5;
      const dy = Math.sin(ang) * len * 0.5;

      ctx.moveTo(x - dx, y - dy);
      ctx.lineTo(x + dx, y + dy);
    }

    ctx.strokeStyle = rgba(p.shade, a(al));
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  /**
   * A few pulp knots — places where the fibre balled up before the sheet was
   * couched. Soft radials, never dots: a hard-edged speck at any alpha reads
   * as a dead pixel or a spot of grime, and the softness is the entire
   * difference between "thickness in the paper" and "something on the paper".
   */
  const knots = Math.round(3 + 4 * D);
  for (let i = 0; i < knots; i++) {
    const x = f.rnd(i, 41) * W;
    const y = f.rnd(i, 42) * H;
    const r = 5 + f.rnd(i, 43) * 9;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(p.shade, a(0.026)));
    g.addColorStop(0.5, rgba(p.shade, a(0.012)));
    g.addColorStop(1, rgba(p.shade, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // -------------------------------------------------------------------------
  // PASS 4 — the light on the sheet.
  //
  // One wide, very weak radial in `accent` at the focal point. This is the
  // layer that turns a texture sample into a photograph of a page: a surface
  // lit evenly everywhere has no light in it at all, and the grid and fibre
  // above are already dimmed toward this point in anticipation of it. Painting
  // it last means it warms everything beneath rather than sitting under the
  // marks, which is how light on a page behaves.
  // -------------------------------------------------------------------------

  /**
   * The only motion in the scene, and it is meant to be below the threshold of
   * conscious notice — a couple of pixels over a forty-second cycle, as though
   * the light outside the room changed slightly. `sin(t * k)` with no phase
   * offset is deliberate: at t = 0 it is exactly 0, so the frozen frame a
   * `speed: 0` section receives is the canonical centred composition rather
   * than an arbitrary point along the drift.
   */
  const driftX = Math.sin(t * 0.16) * W * 0.008;
  const driftY = Math.cos(t * 0.11) * H * 0.006;
  const bx = fx + driftX;
  const by = fy + driftY;

  const bloom = ctx.createRadialGradient(bx, by, 0, bx, by, R * 0.78);
  bloom.addColorStop(0, rgba(p.accent, a(0.055)));
  bloom.addColorStop(0.35, rgba(p.accent, a(0.030)));
  bloom.addColorStop(0.72, rgba(p.accent, a(0.010)));
  bloom.addColorStop(1, rgba(p.accent, 0));
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, W, H);

  /**
   * A second, much tighter core. A single gradient has a single falloff curve
   * and reads as a soft disc; a small bright one summed into a wide dim one
   * gives a curve that is warm at the centre and very long in the tail, and
   * the long tail is what prevents any visible boundary to the lit area.
   * `sheen` appears only here — spread any wider it bleaches the sheet.
   */
  const core = ctx.createRadialGradient(bx, by, 0, bx, by, R * 0.22);
  core.addColorStop(0, rgba(p.sheen, a(0.045)));
  core.addColorStop(0.55, rgba(p.sheen, a(0.016)));
  core.addColorStop(1, rgba(p.sheen, 0));
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, W, H);

  /**
   * PASS 5 — the far corners fall away.
   *
   * A page held under a single light is never as bright at its corners, and
   * this closing vignette is what gives the sheet a sense of being an object
   * with edges rather than a texture tiled to the viewport. It is centred on
   * the light, not on the frame, so it agrees with pass 4 instead of fighting
   * it. Kept under 0.04 — anything heavier turns into a visible oval frame,
   * and a frame around the reading area is exactly the kind of foreground
   * object this scene must never produce.
   */
  const fall = ctx.createRadialGradient(bx, by, R * 0.32, bx, by, R * 1.05);
  fall.addColorStop(0, rgba(p.shade, 0));
  fall.addColorStop(0.65, rgba(p.shade, a(0.014)));
  fall.addColorStop(1, rgba(p.shade, a(0.038)));
  ctx.fillStyle = fall;
  ctx.fillRect(0, 0, W, H);

  ctx.restore();

  // `restore` returns the saved state, but the scene runner shares one context
  // across painters and a leaked alpha or composite mode would show up as an
  // unrelated scene mysteriously washing out. Reset explicitly.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};
