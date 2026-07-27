import { rgba, type ScenePainter } from './types';

/**
 * LANTERN — a room lit by oil lamps.
 *
 * The subject is not a lamp. It is the *air* of a room that has one: deep warm
 * dark, a long amber falloff, a couple of shafts you only half see, and dust
 * turning slowly upward through the heat. Nothing here is an object with an
 * outline; every form is a gradient with no edge, because an edge in a
 * background becomes a thing the eye lands on, and the eye belongs on the text.
 *
 * Painted in five passes, back to front. Each pass exists to carry a different
 * distance from the viewer — that separation is the whole illusion of depth,
 * and collapsing any two of them into one pass flattens the room into a
 * gradient swatch.
 */
export const paintLantern: ScenePainter = (f) => {
  const { ctx, W, H, palette: p, comp } = f;

  /**
   * Local time. Every animated term below reads this and never `f.t`.
   * A section that sets `speed: 0` — the Qur'an reading route does, because
   * motion behind Qur'anic text is forbidden — must get a frozen painting, not
   * a slow one. Multiplying once at the source is what makes that guarantee
   * total: a single layer reaching for `f.t` would keep crawling behind the
   * mushaf and nothing in a screenshot would reveal it.
   */
  const t = f.t * comp.speed;

  /**
   * Positions derived from `t` freeze on their own when `t` stops. Sinusoidal
   * *modulations* do not — `sin(phase)` at t = 0 is a nonzero constant, which
   * would leave the still scene permanently brighter or dimmer than intended
   * and make the two speed-0 sections disagree with each other. `alive` zeroes
   * those terms outright so the still frame is the canonical one.
   */
  const alive = comp.speed > 0 ? 1 : 0;

  /** House rule: artistic alpha * level * weight. Nothing draws without it. */
  const A = f.level * comp.weight;
  const a = (v: number) => v * A;

  const fx = W * comp.focusX;
  const fy = H * comp.focusY;
  const hy = H * comp.horizon;
  const D = comp.density;
  const R = Math.max(W, H);

  /**
   * Two summed, incommensurable frequencies. A single sine reads as a machine
   * pulse within about ten seconds; 0.83 and 0.31 Hz beat against each other
   * with no short common period, so the glow breathes like a wick instead of
   * looping. Amplitudes are deliberately tiny — this is a flame settling, not
   * a flame guttering, and anything larger starts pumping the text's contrast.
   */
  const flicker =
    1 + alive * (Math.sin(t * 0.83) * 0.038 + Math.sin(t * 0.31 + 1.7) * 0.024);

  ctx.save();

  // ---------------------------------------------------------------------
  // PASS 1 — the room itself: the dark the lamp has to push back against.
  // Without this the warm passes below sit on whatever the page ground is and
  // the lamp reads as a flat blob rather than light in a volume.
  // ---------------------------------------------------------------------

  ctx.fillStyle = rgba(p.ground, a(0.98));
  ctx.fillRect(0, 0, W, H);

  // Ceiling-to-floor darkening. Real rooms are darkest above the lamp line and
  // pool their gloom in the corners of the floor; a uniform ground makes the
  // shafts in pass 3 look pasted on because they have nothing to travel
  // through.
  const room = ctx.createLinearGradient(0, 0, 0, H);
  room.addColorStop(0, rgba(p.shade, a(0.55)));
  room.addColorStop(0.42, rgba(p.shade, a(0.18)));
  room.addColorStop(Math.min(0.98, Math.max(0.5, comp.horizon)), rgba(p.shade, a(0.3)));
  room.addColorStop(1, rgba(p.shade, a(0.62)));
  ctx.fillStyle = room;
  ctx.fillRect(0, 0, W, H);

  // The faintest warm bounce along the ground line — light that has left the
  // lamp, hit the floor and come back up. It is what stops the lower third
  // from going dead grey, and it is why the horizon value matters here at all.
  const bounce = ctx.createLinearGradient(0, hy - H * 0.1, 0, H);
  bounce.addColorStop(0, rgba(p.accent, 0));
  bounce.addColorStop(0.45, rgba(p.accent, a(0.05)));
  bounce.addColorStop(1, rgba(p.accent, a(0.015)));
  ctx.fillStyle = bounce;
  ctx.fillRect(0, hy - H * 0.1, W, H - hy + H * 0.1);

  // ---------------------------------------------------------------------
  // PASS 2 — the key glow. Additive from here so overlapping warm light
  // accumulates the way real light does; over `source-over` the stack would
  // instead paint each ring *over* the last and the core would read as a
  // series of discrete discs.
  // ---------------------------------------------------------------------
  ctx.globalCompositeOperation = 'lighter';

  /**
   * Five concentric gradients rather than one — but deliberately NOT a spike.
   *
   * The tempting version brightens each shrinking copy, which sums to a hot
   * point at the focus. On a background that is fatal: a findable point source
   * reads as a stage lamp or a lens flare, i.e. as a graphic sitting on the
   * page, and the eye locks onto it instead of the text. What a lit *room*
   * looks like is a pool with no locatable centre, so the alphas here are
   * nearly equal across radii and each copy holds a plateau out to ~0.2 of its
   * radius before a very long tail. The sum is broad and almost flat in the
   * middle — bright, but with nowhere for the eye to land.
   */
  const halo: Array<[number, number]> = [
    [1.0, 0.1],
    [0.72, 0.095],
    [0.5, 0.09],
    [0.34, 0.085],
    [0.21, 0.08],
  ];
  for (let i = 0; i < halo.length; i++) {
    const [rf, al] = halo[i];
    const r = R * 0.98 * rf;
    const v = a(al * flicker);
    const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
    g.addColorStop(0, rgba(p.accent, v));
    g.addColorStop(0.2, rgba(p.accent, v * 0.93));
    g.addColorStop(0.42, rgba(p.accent, v * 0.66));
    g.addColorStop(0.62, rgba(p.accent, v * 0.38));
    g.addColorStop(0.8, rgba(p.accent, v * 0.16));
    g.addColorStop(0.92, rgba(p.accent, v * 0.05));
    g.addColorStop(1, rgba(p.accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // The warm heart of the pool. `sheen` is here at a fraction of its old
  // strength and spread over four times the radius: enough to say the light is
  // warmer and paler where it is strongest, not enough to draw a wick. Kept
  // wide on purpose — a tight sheen disc was the "bright dot" that made the
  // whole frame read as a diagram of a lamp rather than a room with one.
  const core = ctx.createRadialGradient(fx, fy, 0, fx, fy, R * 0.34);
  core.addColorStop(0, rgba(p.sheen, a(0.05 * flicker)));
  core.addColorStop(0.25, rgba(p.sheen, a(0.036 * flicker)));
  core.addColorStop(0.5, rgba(p.accent, a(0.034 * flicker)));
  core.addColorStop(0.78, rgba(p.accent, a(0.012 * flicker)));
  core.addColorStop(1, rgba(p.accent, 0));
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, W, H);

  // Anamorphic smear: the same glow squashed vertically. Every photographed
  // lamp has one, and it is the cheapest single cue that says "lens" rather
  // than "vector art".
  ctx.save();
  ctx.translate(fx, fy);
  ctx.scale(1, 0.22);
  const smear = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.5);
  smear.addColorStop(0, rgba(p.accent, a(0.07 * flicker)));
  smear.addColorStop(0.5, rgba(p.accent, a(0.024 * flicker)));
  smear.addColorStop(1, rgba(p.accent, 0));
  ctx.fillStyle = smear;
  ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.restore();

  /**
   * A second, far weaker lamp derived from the focus rather than placed. It is
   * mirrored across the frame and dropped below the focal height so the room
   * has two light sources at different distances — one lamp gives a symmetric
   * blob, two give the asymmetry that reads as a place. It is kept near the
   * threshold of visibility so it never competes for attention.
   */
  const sx = W * (1 - comp.focusX * 0.82) * 0.92 + W * 0.04;
  const sy = fy + H * 0.26;
  const far = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 0.34);
  far.addColorStop(0, rgba(p.accent, a(0.055)));
  far.addColorStop(0.4, rgba(p.accent, a(0.022)));
  far.addColorStop(1, rgba(p.accent, 0));
  ctx.fillStyle = far;
  ctx.fillRect(0, 0, W, H);

  // ---------------------------------------------------------------------
  // PASS 3 — light shafts. These are the layer that turns "a glow" into "a
  // glow in dusty air": light is only visible in transit when something is
  // suspended in it, so the shafts and the bokeh below are the same physical
  // claim seen at two scales. Drop the shafts and the lamp stops belonging to
  // the room.
  // ---------------------------------------------------------------------
  const shafts = 4;

  // Shafts DESCEND; they do not radiate. Fanning them out of the focal point
  // draws a sunburst — the regular angular spacing is read instantly as a lens
  // flare and the frame stops being a room. Real light from a high window or a
  // hung lamp arrives as near-parallel columns, so every shaft here shares one
  // small lean (`tilt`) and departs from it only slightly. They are also born
  // above the top edge and at scattered x, not at the lamp: a common origin is
  // the other half of what makes a fan look like a fan.
  const tilt = 0.1;
  const originY = -H * 0.16;

  for (let i = 0; i < shafts; i++) {
    const ang = tilt + (f.rnd(i, 91) - 0.5) * 0.13;
    // Irregular x placement across the lamp's side of the frame. The jitter is
    // large relative to the step so no two gaps match.
    const originX =
      fx + (i - (shafts - 1) / 2) * W * 0.3 + (f.rnd(i, 96) - 0.5) * W * 0.26;

    /**
     * `character` splits the shafts into opposites rather than siblings. Near
     * 0 gives a broad, barely-there wash of air; near 1 gives a narrow column
     * with more presence in it. Width and alpha are driven from the same
     * number in *opposite* directions, because that inverse is the whole point:
     * four shafts of equal width and equal weight read as a repeated motif, and
     * a repeated motif in a background is decoration the eye starts counting.
     */
    const character = f.rnd(i, 97);
    const topW = W * (0.16 - character * 0.125);
    const botW = topW * (1.5 + f.rnd(i, 94) * 1.1);
    const base = (0.012 + character * 0.03) * (0.7 + f.rnd(i, 95) * 0.6);
    // Depths differ a lot. Shafts that all die at the same height draw an
    // invisible line across the frame.
    const len = H * (1.0 + f.rnd(i, 92) * 0.95);

    ctx.save();
    ctx.translate(originX, originY);
    ctx.rotate(ang);

    /**
     * Three widening, dimming copies instead of one shape. A linear gradient
     * fades a shaft along its length but leaves its *sides* razor-sharp, and a
     * hard-edged wedge on a small upscaled canvas aliases into a visible
     * triangle. Stacking copies fakes the lateral falloff that a single fill
     * cannot express.
     */
    for (let k = 0; k < 3; k++) {
      const spread = 1 + k * 0.85;
      const al = base / (1 + k * 1.5);
      const g = ctx.createLinearGradient(0, 0, 0, len);
      // Both ends dissolve. A shaft that simply stops leaves a horizontal edge
      // in the air; the tail is stretched so the bottom third carries almost
      // nothing and the column runs out of light instead of ending.
      g.addColorStop(0, rgba(p.accent, 0));
      g.addColorStop(0.16, rgba(p.accent, a(al)));
      g.addColorStop(0.42, rgba(p.accent, a(al * 0.62)));
      g.addColorStop(0.62, rgba(p.accent, a(al * 0.26)));
      g.addColorStop(0.78, rgba(p.accent, a(al * 0.08)));
      g.addColorStop(0.9, rgba(p.accent, a(al * 0.02)));
      g.addColorStop(1, rgba(p.accent, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo((-topW * spread) / 2, 0);
      ctx.lineTo((topW * spread) / 2, 0);
      ctx.lineTo((botW * spread) / 2, len);
      ctx.lineTo((-botW * spread) / 2, len);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------
  // PASS 4 — rising bokeh, in four depth bands.
  //
  // One band of orbs is confetti. Bands at different radius, drift rate and
  // brightness parallax against each other, and parallax is the only cue that
  // gives a flat canvas volume. Far is small/slow/dim, near is large/faster/
  // softer — near bands are deliberately the *dimmest per pixel* because a big
  // bright orb near the viewer would become a foreground object and pull the
  // eye off the text.
  //
  // The fourth band is the one that makes the depth legible: a handful of orbs
  // right up against the lens, several times the radius of the third band. The
  // jump has to be large — three bands of gently increasing size read as one
  // population with spread, not as near and far. They carry `soft`, which
  // trades the aperture rim for a plain dissolve, since a defocus this severe
  // has no rim left to speak of and a ringed orb that size would be an object.
  // ---------------------------------------------------------------------
  const bands: Array<{
    n: number;
    rMin: number;
    rMax: number;
    rate: number;
    al: number;
    sway: number;
    salt: number;
    soft?: boolean;
  }> = [
    { n: Math.round(20 * D), rMin: 1.6, rMax: 4, rate: 5, al: 0.1, sway: 6, salt: 11 },
    { n: Math.round(16 * D), rMin: 4, rMax: 9, rate: 9, al: 0.085, sway: 11, salt: 37 },
    { n: Math.round(10 * D), rMin: 9, rMax: 20, rate: 14, al: 0.055, sway: 18, salt: 63 },
    {
      n: Math.max(2, Math.round(4 * D)),
      rMin: 30,
      rMax: 62,
      rate: 21,
      al: 0.03,
      sway: 26,
      salt: 89,
      soft: true,
    },
  ];

  for (let b = 0; b < bands.length; b++) {
    const band = bands[b];
    // Wrap over more than a frame height so orbs enter from below the crop and
    // leave above it; wrapping exactly at H would pop them into existence on
    // the bottom edge.
    const span = H * 1.34;
    const y0 = H * 1.1;

    for (let i = 0; i < band.n; i++) {
      const s = band.salt;
      const x0 = f.rnd(i, s) * W;
      const seed = f.rnd(i, s + 1);
      const rad = band.rMin + f.rnd(i, s + 2) * (band.rMax - band.rMin);

      const y = y0 - ((seed * span + t * band.rate) % span);
      const prog = (y0 - y) / span; // 0 at entry, 1 at exit

      // Sway is a position, not a modulation, so it freezes correctly at t = 0
      // (it settles at sin(phase) — a fixed, deterministic offset).
      const x = x0 + Math.sin(t * (0.16 + f.rnd(i, s + 3) * 0.2) + seed * 8) * band.sway;

      // Fade in quickly, out slowly. Orbs that appear and vanish at full
      // strength read as blinking; this makes them dissolve into the dark.
      const fade = Math.min(1, prog / 0.16) * Math.pow(Math.max(0, 1 - prog), 1.1);
      if (fade <= 0.01) continue;

      // Light falls off with distance from the lamp, so dust far from it must
      // be dimmer. Without this the orbs float in an evenly lit void and stop
      // belonging to the same scene as the glow.
      const dx = (x - fx) / W;
      const dy = (y - fy) / H;
      const near = 1 / (1 + (dx * dx + dy * dy) * 3.2);

      const al = band.al * fade * (0.45 + near);
      if (al <= 0.004) continue;

      /**
       * The rim, not the centre, is what makes a circle read as *out of
       * focus*. A defocused point source images as a disc of near-uniform
       * energy with a brighter edge (the lens aperture's caustic); a plain
       * centre-bright radial gradient reads as a glowing dot instead — that
       * was the difference between this and the version that looked like
       * clip-art.
       */
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      if (band.soft) {
        // Near band: no rim, no sheen, no edge anywhere on it — a pressure of
        // warmth in the air rather than a disc.
        g.addColorStop(0, rgba(p.accent, a(al * 0.85)));
        g.addColorStop(0.45, rgba(p.accent, a(al * 0.7)));
        g.addColorStop(0.72, rgba(p.accent, a(al * 0.42)));
        g.addColorStop(0.88, rgba(p.accent, a(al * 0.16)));
        g.addColorStop(1, rgba(p.accent, 0));
      } else {
        g.addColorStop(0, rgba(p.accent, a(al * 0.55)));
        g.addColorStop(0.55, rgba(p.accent, a(al * 0.7)));
        g.addColorStop(0.82, rgba(p.sheen, a(al)));
        g.addColorStop(0.93, rgba(p.accent, a(al * 0.5)));
        g.addColorStop(1, rgba(p.accent, 0));
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------------------------------------------------------------------
  // PASS 5 — settle. Back to normal compositing: everything below *removes*
  // light, and `lighter` cannot subtract.
  // ---------------------------------------------------------------------
  ctx.globalCompositeOperation = 'source-over';

  // A slow warm haze lying along the ground line. Additive dust brightens the
  // lower frame; this puts a little of the room's own murk back in front of it
  // so the bokeh sits *in* air rather than on top of the picture.
  const hazeBands = 3;
  for (let i = 0; i < hazeBands; i++) {
    const cy = hy + (i - 1) * H * 0.07;
    const th = H * (0.1 + f.rnd(i, 71) * 0.09);
    const g = ctx.createLinearGradient(0, cy - th, 0, cy + th);
    g.addColorStop(0, rgba(p.shade, 0));
    g.addColorStop(0.5, rgba(p.shade, a(0.05 + f.rnd(i, 72) * 0.03)));
    g.addColorStop(1, rgba(p.shade, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, cy - th, W, th * 2);
  }

  /**
   * Vignette, drawn last and centred on the *focus* rather than the canvas.
   * Anchoring it to the light is what makes the darkness feel caused by the
   * lamp's falloff instead of applied as a filter. It is also the layer doing
   * the practical work of this scene: it guarantees the frame edges stay dark
   * and low-contrast wherever chrome and text sit.
   */
  const vig = ctx.createRadialGradient(fx, fy, R * 0.12, fx, fy, R * 0.95);
  vig.addColorStop(0, rgba(p.shade, 0));
  vig.addColorStop(0.55, rgba(p.shade, a(0.1)));
  vig.addColorStop(1, rgba(p.shade, a(0.46)));
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // Top scrim. Headers and titles live in the upper band, so it gets one extra
  // pass of quiet regardless of where the composition put the lamp.
  const scrim = ctx.createLinearGradient(0, 0, 0, H * 0.34);
  scrim.addColorStop(0, rgba(p.shade, a(0.24)));
  scrim.addColorStop(1, rgba(p.shade, 0));
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H * 0.34);

  ctx.restore();

  // Belt and braces: the contract says a painter hands the context back clean,
  // and `restore()` only unwinds what this painter pushed — if a caller ever
  // enters with a dirty state, the next scene in the stack inherits it.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};
