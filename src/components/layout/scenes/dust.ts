import { rgba, type ScenePainter } from './types';

/**
 * DUST — sun coming into a high hall.
 *
 * The subject is not the window and not the beam. It is the *air*: light is
 * invisible in transit, and the only reason a shaft can be seen at all is that
 * something is suspended in it. So the shafts and the motes are one physical
 * claim painted at two scales, and the picture dies if either is removed — the
 * shafts alone are flat wedges of paint, the motes alone are confetti.
 *
 * The rule the whole file obeys: THE HALL IS LIT, it is not a dark room with a
 * lamp in it. Brightness is graded across the entire frame from the window to
 * the far corner, and every form — shaft, pool, mote, haze — takes its value
 * from where it stands on that grade. An earlier version lit only the shafts
 * and left the rest black; the result read as a few pale spokes on a void,
 * because a light source with nothing responding to it is just a shape.
 *
 * Everything is gradient; nothing has an outline. An edge in a background
 * becomes a thing the eye lands on, and the eye belongs on the text. Every ramp
 * in the file reaches zero over a long tail — a gradient that stops while it
 * still carries alpha leaves a seam, and a seam is an edge by another name.
 *
 * Passes run back to front. Each carries a different distance from the viewer,
 * and that separation is the entire illusion of depth — collapsing any two of
 * them into one pass flattens the hall into a gradient swatch.
 *
 * SIGNATURE — the bloom field. Low in the frame, where the dominant shaft
 * lands, the floor answers the light: a band of many-petalled radiant
 * blossoms, brightest exactly in the landing pool and falling off into the
 * gloom either side, with stem silhouettes between them and a few loose
 * petals riding up the beam. The field is the same physical claim as the
 * motes — light made visible by what stands in it — restated at the scale of
 * a flower. It lives strictly below `comp.horizon` and thickens only in the
 * lower fifth, so the content's air above stays clear.
 */
export const paintDust: ScenePainter = (f) => {
  const { ctx, W, H, palette: p, comp } = f;

  /**
   * Local time. Every animated term below reads this and never `f.t`.
   * A section that sets `speed: 0` — the Qur'an reading route does, because
   * motion behind Qur'anic text is forbidden — must receive a frozen painting,
   * not a slow one. Multiplying once at the source is what makes that total: a
   * single stray `f.t` would keep the dust crawling behind the mushaf, and
   * nothing in a screenshot would ever reveal it.
   */
  const t = f.t * comp.speed;

  /**
   * Positions derived from `t` stop on their own when `t` stops. Sinusoidal
   * *modulations* do not — `sin(phase)` at t = 0 is a nonzero constant, so a
   * global breath term would leave the still frame permanently brighter or
   * dimmer than the moving one and make the two speed-0 sections disagree.
   * `alive` zeroes the scene-wide modulations outright so the still frame is
   * the canonical one. Note that PER-MOTE twinkle below is deliberately *not*
   * gated: its phase is already randomised per mote, so freezing it samples a
   * fixed spread of brightnesses — which is exactly what a photograph of dust
   * in a beam looks like. Gating it would flatten every mote to one value.
   */
  const alive = comp.speed > 0 ? 1 : 0;

  /** House rule: artistic alpha * level * weight. Nothing draws without it. */
  const A = f.level * comp.weight;
  if (A <= 0) return;
  const a = (v: number) => v * A;

  const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

  const fx = W * clamp01(comp.focusX);
  const fy = H * clamp01(comp.focusY);
  const hy = H * clamp01(comp.horizon);
  const D = clamp01(comp.density);
  const R = Math.max(W, H);
  const TAU = Math.PI * 2;

  /**
   * Which way the light travels. Beams leave the window heading into the room,
   * i.e. away from whichever side wall the window is nearest. Deriving this
   * from the composition rather than randomising it is what keeps the shafts,
   * the floor pools, the haze and the shadow corner all agreeing about where
   * the sun is; a random direction would put the bright haze on the same side
   * as the dark corner and the frame would stop reading as one room.
   */
  const dirSign = fx < W * 0.5 ? 1 : -1;

  /** The corner the light never reaches — the deep end of the grade. */
  const oppX = dirSign > 0 ? W : 0;
  const oppY = fy < H * 0.55 ? H : 0;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // -----------------------------------------------------------------------
  // PASS 1 — THE BODY OF THE HALL.
  //
  // The whole frame, graded twice: once vertically (ceilings are unlit, floors
  // pool their own gloom) and once DIAGONALLY, from the window down to the
  // opposite corner. The diagonal ramp is the important one and it is what the
  // scene was missing: it is the difference between "a room that has a window
  // in it" and "a black rectangle with a glow pasted on". Everything painted
  // after this is read by the eye relative to this grade.
  //
  // All three ramps run the full canvas and end at zero, so the body never
  // hands off to a later pass across a visible line.
  // -----------------------------------------------------------------------
  ctx.fillStyle = rgba(p.ground, a(0.9));
  ctx.fillRect(0, 0, W, H);

  const hall = ctx.createLinearGradient(0, 0, 0, H);
  hall.addColorStop(0, rgba(p.shade, a(0.3)));
  // The lightest point of the room is pinned to the focal height rather than
  // to a fixed fraction, so a composition that puts its window low still gets
  // a room whose brightness agrees with where its light actually is.
  hall.addColorStop(Math.min(0.88, Math.max(0.12, comp.focusY)), rgba(p.shade, a(0.03)));
  hall.addColorStop(0.72, rgba(p.shade, a(0.16)));
  hall.addColorStop(1, rgba(p.shade, a(0.34)));
  ctx.fillStyle = hall;
  ctx.fillRect(0, 0, W, H);

  // The shadow gradient: nothing at the window, deepening the whole way to the
  // far corner. Starting at exact zero is what keeps the lit half clean.
  const gloom = ctx.createLinearGradient(fx, fy, oppX, oppY);
  gloom.addColorStop(0, rgba(p.shade, 0));
  gloom.addColorStop(0.34, rgba(p.shade, a(0.05)));
  gloom.addColorStop(0.62, rgba(p.shade, a(0.16)));
  gloom.addColorStop(0.84, rgba(p.shade, a(0.3)));
  gloom.addColorStop(1, rgba(p.shade, a(0.4)));
  ctx.fillStyle = gloom;
  ctx.fillRect(0, 0, W, H);

  // -----------------------------------------------------------------------
  // From here light ACCUMULATES. Over `source-over` each shaft would paint
  // *over* the last and their crossings would read as flat overlapping panes;
  // under `lighter` the crossings brighten, which is the one cue that says
  // these are volumes of lit air rather than translucent card.
  // -----------------------------------------------------------------------
  ctx.globalCompositeOperation = 'lighter';

  // -----------------------------------------------------------------------
  // PASS 2 — THE KEY GLOW: the window's own light, before it has gone
  // anywhere. Five stacked radials, not one, because a single gradient has a
  // single falloff curve; shrinking, brightening copies sum into a curve that
  // is hot and tight at the aperture and very long in the tail. The widest
  // copy is deliberately larger than the canvas diagonal so the lift reaches
  // every corner and the frame is never a lamp on a black field.
  // -----------------------------------------------------------------------
  const halo: Array<[number, number]> = [
    [1.55, 0.05],
    [1.0, 0.06],
    [0.58, 0.075],
    [0.29, 0.085],
    [0.13, 0.1],
  ];
  for (let i = 0; i < halo.length; i++) {
    const [rf, al] = halo[i];
    const r = R * rf;
    const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
    g.addColorStop(0, rgba(p.accent, a(al)));
    g.addColorStop(0.36, rgba(p.accent, a(al * 0.48)));
    g.addColorStop(0.7, rgba(p.accent, a(al * 0.15)));
    g.addColorStop(1, rgba(p.accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // The blown-out centre. `sheen` appears only here, in the floor pool and on
  // the few brightest motes; spread any wider it tints the whole hall toward
  // paper and the warm gold this scene is named for goes grey.
  const core = ctx.createRadialGradient(fx, fy, 0, fx, fy, R * 0.11);
  core.addColorStop(0, rgba(p.sheen, a(0.15)));
  core.addColorStop(0.42, rgba(p.accent, a(0.08)));
  core.addColorStop(1, rgba(p.accent, 0));
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, W, H);

  // -----------------------------------------------------------------------
  // PASS 3 — THE DUSTY AIR of the lit half.
  //
  // A very broad warm wash lying along the direction of travel, so the air
  // between the beams is faintly luminous instead of empty. Without it the
  // shafts have nothing to be continuous with and the hall looks clear, not
  // dusty — and clear air is exactly what a shaft cannot be seen in.
  //
  // Two parts: a directional ramp that dies before the shadow corner, and one
  // enormous soft ellipse hung on the beam axis, midway down. Both are far too
  // wide to have a readable shape, which is the point.
  // -----------------------------------------------------------------------
  const wash = ctx.createLinearGradient(fx, fy, oppX, oppY);
  wash.addColorStop(0, rgba(p.accent, a(0.05)));
  wash.addColorStop(0.26, rgba(p.accent, a(0.032)));
  wash.addColorStop(0.55, rgba(p.accent, a(0.012)));
  wash.addColorStop(0.8, rgba(p.accent, a(0.003)));
  wash.addColorStop(1, rgba(p.accent, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  // -----------------------------------------------------------------------
  // PASS 4 — THE SHAFTS.
  //
  // Each is built once into `shafts` and drawn from that record, because the
  // mote pass has to ask "is this mote inside a beam?" and the answer must come
  // from the same numbers that were painted. Recomputing the geometry in the
  // mote loop would drift the two apart and the motes would light up next to
  // the beams instead of in them — which is the whole effect.
  //
  // The set is deliberately UNEQUAL. One dominant shaft carries most of the
  // light; the rest are much narrower, much fainter, and at slightly different
  // angles. Four similar spokes read as a starburst — a logo — and that is what
  // made the earlier version look like a rendered icon rather than a window.
  // -----------------------------------------------------------------------
  interface Shaft {
    ox: number;
    oy: number;
    /** Unit vector down the axis. */
    dx: number;
    dy: number;
    /** Unit normal, for the perpendicular distance test in the mote pass. */
    nx: number;
    ny: number;
    len: number;
    topW: number;
    botW: number;
    al: number;
    /** Layer count and jitter budget for the soft-edge build below. */
    layers: number;
    rough: number;
    salt: number;
  }

  const nSecondary = 2 + Math.round(D * 1.6); // 2..4 minor shafts
  const shafts: Shaft[] = [];

  /** The base heading: down and into the room, away from the window's wall. */
  const baseAng = -dirSign * 0.4;

  for (let i = 0; i < 1 + nSecondary; i++) {
    const dominant = i === 0;

    /**
     * Origins are scattered a little around the focus rather than sharing one
     * point. A perfect common vertex reads as a starburst; a real window's
     * panes and mullions throw beams that are near-parallel, not radial. The
     * dominant shaft sits closest to the aperture so its throat is the part of
     * the frame the key glow is already brightest at.
     */
    const spreadX = dominant ? 0.06 : 0.34;
    const ox = fx + (f.rnd(i, 401) - 0.5) * W * spreadX;
    const oy = fy + (f.rnd(i, 402) - 0.5) * H * (dominant ? 0.05 : 0.18);

    /**
     * Angles differ by only a little — a few degrees each side of the base
     * heading. Sunlight through one opening is very nearly collimated, so a
     * wide fan would look like several suns; the small differences are what
     * keep the beams from looking stamped from one template.
     */
    const fan = dominant ? 0 : ((i - 1) / Math.max(1, nSecondary - 1) - 0.45) * 0.5;
    const jitter = (f.rnd(i, 403) - 0.5) * (dominant ? 0.07 : 0.2);
    // The scene-wide breath: a hair of angle and a hair of alpha, on two
    // incommensurable frequencies per shaft so the group never visibly loops.
    // Amplitudes are tiny on purpose — this is air moving, not a searchlight,
    // and anything larger starts pumping the contrast under the text.
    const sway = alive * Math.sin(t * (0.08 + f.rnd(i, 404) * 0.06) + i * 2.3) * 0.018;
    const ang = baseAng + fan + jitter + sway;

    // Long enough that the dominant beam always crosses the floor line, and
    // long enough that every beam's tail runs off the canvas rather than
    // stopping inside it.
    const len = H * (dominant ? 2.3 : 1.3 + f.rnd(i, 405) * 0.8);

    const topW = dominant
      ? W * (0.15 + f.rnd(i, 406) * 0.04)
      : W * (0.018 + f.rnd(i, 406) * 0.03);
    // Beams widen as they go: partly true perspective, mostly scattering. A
    // parallel-sided shaft looks like a ruler laid on the picture.
    const botW = topW * (dominant ? 2.1 : 2.4 + f.rnd(i, 407) * 2.2);

    /**
     * The dominant shaft is allowed to be both wide and bright because it is
     * the subject; every other shaft is held far below it. Elsewhere the old
     * inverse width/brightness rule still applies — a broad *and* bright minor
     * wedge stops being atmosphere and becomes a shape, the single failure that
     * makes this kind of scene read as clip-art.
     */
    const breath = 1 + alive * Math.sin(t * 0.19 + i * 1.9) * 0.1;
    const al = dominant
      ? 0.05 * breath
      : (0.02 - (topW / W - 0.018) * 0.22) * breath;

    const dx = -Math.sin(ang);
    const dy = Math.cos(ang);
    shafts.push({
      ox,
      oy,
      dx,
      dy,
      nx: dy,
      ny: -dx,
      len,
      topW,
      botW,
      al: Math.max(0.006, al),
      layers: dominant ? 7 : 3,
      rough: dominant ? 0.5 : 0.18,
      salt: 500 + i * 37,
    });
  }

  for (let i = 0; i < shafts.length; i++) {
    const s = shafts[i];
    ctx.save();
    ctx.translate(s.ox, s.oy);
    // Rotating into the shaft's own frame is what lets the length gradient be
    // a plain vertical one. Building the quad in world space instead would
    // need a gradient along an arbitrary axis and a matching arbitrary
    // taper — far more arithmetic for an identical result.
    ctx.rotate(Math.atan2(-s.dx, s.dy));

    /**
     * The beam is not one fill. It is a stack of widening, dimming, laterally
     * OFFSET tapered copies, each slightly rotated. Three things come out of
     * that which a single quad cannot give:
     *
     *   - lateral falloff. A linear gradient fades the shaft along its LENGTH
     *     but leaves its SIDES razor sharp, and a hard-edged wedge on a 768px
     *     canvas that is then upscaled aliases into a visible triangle.
     *   - irregular edges. The per-layer offset and rotation mean no two sides
     *     coincide, so the accumulated silhouette wanders the way real
     *     scattered light does instead of ruling two straight lines.
     *   - a body built by ACCUMULATION. No single copy is bright; the beam's
     *     density is the sum of the overlaps, which is why it has no core to
     *     count and reads as a volume.
     */
    for (let k = 0; k < s.layers; k++) {
      const wide = 1 + k * 0.55;
      const al = s.al / (1 + k * 1.05);
      const offTop = (f.rnd(k, s.salt) - 0.5) * s.topW * s.rough;
      const offBot = (f.rnd(k, s.salt + 1) - 0.5) * s.botW * s.rough * 0.8;
      const lean = (f.rnd(k, s.salt + 2) - 0.5) * 0.05 * s.rough;

      ctx.save();
      ctx.rotate(lean);
      const g = ctx.createLinearGradient(0, 0, 0, s.len);
      // Starts at zero so the shaft emerges out of the glow of pass 2 instead
      // of butting against it with a seam at the window, and ends at zero over
      // more than half its length so it dissolves rather than stopping.
      g.addColorStop(0, rgba(p.accent, 0));
      g.addColorStop(0.09, rgba(p.accent, a(al)));
      g.addColorStop(0.3, rgba(p.accent, a(al * 0.68)));
      g.addColorStop(0.55, rgba(p.accent, a(al * 0.34)));
      g.addColorStop(0.78, rgba(p.accent, a(al * 0.12)));
      g.addColorStop(0.92, rgba(p.accent, a(al * 0.03)));
      g.addColorStop(1, rgba(p.accent, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(offTop - (s.topW * wide) / 2, 0);
      ctx.lineTo(offTop + (s.topW * wide) / 2, 0);
      ctx.lineTo(offBot + (s.botW * wide) / 2, s.len);
      ctx.lineTo(offBot - (s.botW * wide) / 2, s.len);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // The throat: a soft radial where the beam leaves the aperture. It buries
    // the flat top edge of the quad stack under the key glow, so the shaft has
    // no beginning — only a place where it is already bright.
    const th = ctx.createRadialGradient(s.ox, s.oy, 0, s.ox, s.oy, s.topW * 2.2);
    th.addColorStop(0, rgba(p.accent, a(s.al * 1.1)));
    th.addColorStop(0.4, rgba(p.accent, a(s.al * 0.5)));
    th.addColorStop(1, rgba(p.accent, 0));
    ctx.fillStyle = th;
    ctx.beginPath();
    ctx.arc(s.ox, s.oy, s.topW * 2.2, 0, TAU);
    ctx.fill();
  }

  // -----------------------------------------------------------------------
  // PASS 5 — WHERE THE LIGHT LANDS.
  //
  // A shaft that simply fades out in mid-air is a beam in a void. Pooling
  // warmth on the floor line gives each one a destination, and it is the only
  // place `comp.horizon` visibly does any work in this scene. The dominant
  // shaft gets a three-layer pool, wide and soft; the minor ones get a single
  // faint smear, because five equal pools would read as a row of lamps.
  // -----------------------------------------------------------------------
  for (let i = 0; i < shafts.length; i++) {
    const s = shafts[i];
    if (Math.abs(s.dy) < 0.2) continue; // near-horizontal: it never reaches the floor
    const along = (hy - s.oy) / s.dy;
    if (along <= 0 || along > s.len) continue;
    const px = s.ox + s.dx * along;
    const halfW = (s.topW + (s.botW - s.topW) * (along / s.len)) * 0.5;
    // The beam is weaker by the time it arrives; the pool must agree with the
    // brightness the shaft actually has down there, not with its brightness at
    // the window, or the floor lights up under a beam that has already gone.
    const reach = Math.max(0, 1 - along / s.len);
    const dominant = i === 0;
    const passes = dominant ? 3 : 1;

    for (let k = 0; k < passes; k++) {
      const spread = halfW * (1.7 + k * 1.5);
      const al = s.al * reach * (dominant ? 1.5 : 0.7) / (1 + k * 1.6);
      ctx.save();
      ctx.translate(px, hy);
      // Squashed hard: a beam meeting a floor at a shallow angle makes a long
      // flat ellipse. A circular pool would read as a spotlight from directly
      // above and contradict the angles drawn in pass 4.
      ctx.scale(1, 0.17 + k * 0.05);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, spread);
      g.addColorStop(0, rgba(dominant && k === 0 ? p.sheen : p.accent, a(al)));
      g.addColorStop(0.34, rgba(p.accent, a(al * 0.5)));
      g.addColorStop(0.66, rgba(p.accent, a(al * 0.16)));
      g.addColorStop(1, rgba(p.accent, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, spread, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // The bounce for the dominant beam: light that hit the floor and came back
    // up into the air directly above the pool. This is what makes the beam feel
    // like it is landing somewhere rather than merely fading out.
    if (dominant) {
      const bh = H * 0.3;
      ctx.save();
      ctx.translate(px, hy);
      const b = ctx.createRadialGradient(0, -bh * 0.25, 0, 0, -bh * 0.25, halfW * 3);
      b.addColorStop(0, rgba(p.accent, a(s.al * reach * 0.5)));
      b.addColorStop(0.45, rgba(p.accent, a(s.al * reach * 0.2)));
      b.addColorStop(1, rgba(p.accent, 0));
      ctx.fillStyle = b;
      ctx.beginPath();
      ctx.arc(0, -bh * 0.25, halfW * 3, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // The general bounce: a low band of light lifted off the whole floor. It is
  // what stops the lower frame going dead and flat once the shafts have faded
  // out, and it ties the bottom of the picture to the same source.
  const bounceTop = Math.min(H, Math.max(0, hy - H * 0.18));
  if (H > bounceTop) {
    const bounce = ctx.createLinearGradient(0, bounceTop, 0, H);
    bounce.addColorStop(0, rgba(p.accent, 0));
    bounce.addColorStop(0.38, rgba(p.accent, a(0.03)));
    bounce.addColorStop(0.72, rgba(p.accent, a(0.016)));
    bounce.addColorStop(1, rgba(p.accent, a(0.004)));
    ctx.fillStyle = bounce;
    ctx.fillRect(0, bounceTop, W, H - bounceTop);
  }

  // -----------------------------------------------------------------------
  // PASS 5.5 — THE BLOOM FIELD (signature).
  //
  // Everything above says light by what hangs in the air; this says it by
  // what grows in it. The field obeys the same law as the motes: nothing here
  // owns its brightness. Each blossom asks the SAME shaft geometry the mote
  // pass asks — is a beam over me, and how much of it is left down here — and
  // adds a pull toward the dominant shaft's landing pool, so the brightest
  // heads stand exactly where the light arrives and the field dims away into
  // the hall's gloom with no edge of its own.
  //
  // Built in two materials. Stems and leaves are painted first, in
  // `source-over`, as shade-coloured silhouettes — they REMOVE light, dark
  // stalks against the pool glow, which is what gives the band body. The
  // blossoms then go down in `lighter`, petals as filled tapered beziers
  // (never strokes — thin lines smear at this canvas size) with a gradient
  // deeper at the base and paler at the tip, and per-petal length/angle
  // jitter so no head is a stamped icon.
  // -----------------------------------------------------------------------

  /** A slim pointed petal, tip up, base at the local origin. Fill after. */
  const petalPath = (len: number, w: number): void => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-w, -len * 0.32, -w * 0.55, -len * 0.86, 0, -len);
    ctx.bezierCurveTo(w * 0.55, -len * 0.86, w, -len * 0.32, 0, 0);
    ctx.closePath();
  };

  /** Same beam-proximity question the motes ask, at a point on the floor. */
  const litAt = (x: number, y: number): number => {
    let prox = 0;
    for (let k = 0; k < shafts.length; k++) {
      const s = shafts[k];
      const vx = x - s.ox;
      const vy = y - s.oy;
      const along = vx * s.dx + vy * s.dy;
      if (along < 0 || along > s.len) continue;
      const perp = Math.abs(vx * s.nx + vy * s.ny);
      const halfW = (s.topW + (s.botW - s.topW) * (along / s.len)) * 0.5;
      const q = Math.max(0, 1 - perp / halfW);
      const lit = q * q * (0.5 + s.al * 11) * Math.max(0.25, 1 - along / s.len);
      if (lit > prox) prox = lit;
    }
    return prox;
  };

  /** Where the dominant beam meets the floor — the field's brightest ground. */
  const dom = shafts[0];
  let poolX = fx + dirSign * W * 0.28;
  if (Math.abs(dom.dy) >= 0.2) {
    const along = (hy - dom.oy) / dom.dy;
    if (along > 0) poolX = dom.ox + dom.dx * along;
  }
  poolX = Math.min(W * 0.92, Math.max(W * 0.08, poolX));

  /**
   * The band the field may occupy: never above the horizon, and never above
   * the lower fifth even when the horizon sits high. When the composition
   * pins its horizon to the bottom the band collapses and the blossoms
   * shrink with it (`fieldScale`) rather than poking heads up into the text.
   */
  const fieldTop = Math.max(hy, H * 0.8);
  const fieldDepth = H - fieldTop;
  const fieldScale = clamp01(0.45 + (fieldDepth / (H * 0.2)) * 0.55);

  interface Bloom {
    x: number;
    y: number;
    rad: number;
    nP: number;
    al: number;
    seed: number;
  }
  const blooms: Bloom[] = [];

  /**
   * Three ranks, far to near, exactly as the motes have: the far rank small,
   * dim and slightly higher in the band; the near rank few, large and low.
   * Counts are odd and small — this is a signature, not a carpet, and the
   * petal fills are the most expensive primitives in the file.
   */
  const rankSpec: Array<[number, number, number, number, number, number]> = [
    // count, radMin, radSpan, baseAlpha, bandLift, salt
    [3 + Math.round(D * 2), H * 0.022, H * 0.009, 0.045, 0.15, 701],
    [5, H * 0.032, H * 0.013, 0.07, 0.4, 711],
    [3, H * 0.052, H * 0.02, 0.1, 0.65, 721],
  ];

  for (let r = 0; r < rankSpec.length; r++) {
    const [count, radMin, radSpan, baseAl, bandLift, salt] = rankSpec[r];
    for (let i = 0; i < count; i++) {
      // Clustered, not sown evenly: about half the field gathers at the pool,
      // the rest scatters, so the group reads as growth toward the light.
      const x =
        f.rnd(i, salt) < 0.5
          ? poolX + (f.rnd(i, salt + 1) - 0.5) * W * 0.2
          : f.rnd(i, salt + 1) * W;
      const y = fieldTop + fieldDepth * (bandLift + f.rnd(i, salt + 2) * 0.45);
      const rad = (radMin + f.rnd(i, salt + 3) * radSpan) * fieldScale;
      const nP = 10 + Math.round(f.rnd(i, salt + 4) * 4);

      /**
       * The shimmer: each blossom breathes on its own rate and phase, a field
       * of light answering the shafts. Gated by `alive` like every scene-wide
       * modulation — at speed 0 every head settles to exactly 1, so the still
       * frame is canonical, not caught mid-breath.
       */
      const breath =
        1 + alive * Math.sin(t * (0.25 + f.rnd(i, salt + 5) * 0.5) + i * 2.1 + r * 3.7) * 0.1;

      // Owned brightness is the floor value only; the rest is granted by the
      // pool underfoot and the beam overhead. An unlit blossom is a murmur.
      const poolQ = Math.max(0, 1 - Math.abs(x - poolX) / (W * 0.2));
      const bright = Math.min(1.6, 0.4 + poolQ * poolQ * 0.55 + litAt(x, y) * 0.8);
      blooms.push({ x, y, rad, nP, al: baseAl * bright * breath, seed: (r + 1) * 100 + i });
    }
  }

  // --- Stems and leaves: dark silhouettes, so back to subtracting light. ---
  ctx.globalCompositeOperation = 'source-over';

  const stem = (bx: number, by: number, seed: number): void => {
    const lean = (f.rnd(seed, 761) - 0.5) * W * 0.05;
    // Two passes of decreasing width and alpha: a soft-edged stalk, not a
    // ruled line. Widths stay above ~2px so the upscale cannot smear them.
    for (let k = 0; k < 2; k++) {
      ctx.strokeStyle = rgba(p.shade, a(0.12 - k * 0.045));
      ctx.lineWidth = H * 0.006 * (1.6 - k * 0.55);
      ctx.beginPath();
      ctx.moveTo(bx + lean, H + H * 0.02);
      ctx.bezierCurveTo(
        bx + lean * 0.6,
        by + (H - by) * 0.62,
        bx - lean * 0.3,
        by + (H - by) * 0.25,
        bx,
        by,
      );
      ctx.stroke();
    }
    if (f.rnd(seed, 765) < 0.55) {
      // One leaf at most — a filled teardrop swung out sideways. More per
      // stem and the band turns to thicket and starts competing upward.
      ctx.save();
      ctx.translate(bx + lean * 0.5, by + (H - by) * 0.45 + H * 0.015);
      ctx.rotate((f.rnd(seed, 766) < 0.5 ? -1 : 1) * (1.15 + f.rnd(seed, 767) * 0.4));
      ctx.fillStyle = rgba(p.shade, a(0.1));
      petalPath(H * 0.03 * fieldScale + H * 0.008, H * 0.009);
      ctx.fill();
      ctx.restore();
    }
  };

  for (let i = 0; i < blooms.length; i++) stem(blooms[i].x, blooms[i].y, blooms[i].seed);
  // A few bare stalks between the flowers, so the field has body — grass in
  // the gaps, not more heads.
  for (let i = 0; i < 4; i++) {
    stem(f.rnd(i, 771) * W, fieldTop + fieldDepth * (0.35 + f.rnd(i, 772) * 0.5), 900 + i);
  }

  // --- The blossoms themselves: back to accumulating light. ---
  ctx.globalCompositeOperation = 'lighter';

  for (let b = 0; b < blooms.length; b++) {
    const bl = blooms[b];
    ctx.save();
    ctx.translate(bl.x, bl.y);
    const baseRot = f.rnd(bl.seed, 731) * TAU;
    for (let k = 0; k < bl.nP; k++) {
      // Per-petal jitter in angle and length is the whole difference between
      // a flower and a gear glyph; the jitter budget is small so the ring
      // still reads as one radiant head.
      const jA = (f.rnd(bl.seed * 31 + k, 733) - 0.5) * (TAU / bl.nP) * 0.45;
      const len = bl.rad * (0.82 + f.rnd(bl.seed * 31 + k, 734) * 0.34);
      ctx.save();
      ctx.rotate(baseRot + (k / bl.nP) * TAU + jA);
      ctx.translate(0, -bl.rad * 0.1);
      const g = ctx.createLinearGradient(0, 0, 0, -len);
      g.addColorStop(0, rgba(p.accent, a(bl.al)));
      g.addColorStop(0.55, rgba(p.accent, a(bl.al * 0.66)));
      g.addColorStop(1, rgba(p.sheen, a(bl.al * 0.34)));
      ctx.fillStyle = g;
      petalPath(len, len * 0.21);
      ctx.fill();
      ctx.restore();
    }
    // The core: the same blown-white `sheen` the window centre, the pool
    // centre and the brightest motes already carry — one material, so the
    // flower reads as catching THAT light, not shining with its own.
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, bl.rad * 0.4);
    cg.addColorStop(0, rgba(p.sheen, a(bl.al * 1.1)));
    cg.addColorStop(0.45, rgba(p.accent, a(bl.al * 0.6)));
    cg.addColorStop(1, rgba(p.accent, 0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, bl.rad * 0.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // -----------------------------------------------------------------------
  // PASS 6 — THE MOTES, in three ranks.
  //
  // Two contrasts do all the work here and neither can be dropped:
  //
  //   IN-BEAM vs OUT-OF-BEAM. Lit uniformly the motes are snow on a dark
  //   rectangle; lit by proximity to a shaft axis, the beams acquire volume and
  //   the dark between them acquires depth, with no extra shape drawn.
  //
  //   FAR vs NEAR. Three ranks at genuinely different scales — the near rank is
  //   roughly six times the far rank's radius and climbs four times as fast.
  //   One continuous depth ramp was tried and it averages out: everything ends
  //   up mid-sized and mid-speed and the hall has no front and no back.
  //
  // The near rank is only a handful of very large, very soft blooms. More than
  // that, or any harder, and they stop being out-of-focus dust in front of the
  // viewer and become spots on the glass, competing with the text.
  // -----------------------------------------------------------------------

  /**
   * Density thins the air by DIMMING as well as by counting. Dropping the
   * count alone makes a low-density section look like the same air with holes
   * punched in it; scaling opacity too makes it read as genuinely clearer.
   */
  const airAl = 0.4 + 0.6 * D;

  const rank = (
    count: number,
    radMin: number,
    radSpan: number,
    rate: number,
    swayAmp: number,
    baseAl: number,
    soft: boolean,
    salt: number,
  ): void => {
    for (let i = 0; i < count; i++) {
      const v = f.rnd(i, salt);
      const rad = radMin + v * radSpan;

      // Wrap over more than a frame height so motes enter below the crop and
      // leave above it. Wrapping exactly at H pops them into existence on the
      // bottom edge, and a popping mote is the one thing here the eye will find.
      const span = H * 1.45;
      const y0 = H * 1.2;
      const seed = f.rnd(i, salt + 1);
      const y = y0 - ((seed * span + t * rate) % span);

      // Sway is a POSITION, not a modulation, so it freezes correctly at t = 0
      // (it settles to a fixed deterministic offset rather than to zero).
      const x =
        f.rnd(i, salt + 2) * W +
        Math.sin(t * (0.12 + f.rnd(i, salt + 3) * 0.2) + seed * 9.4) * swayAmp;

      if (x < -rad * 3 || x > W + rad * 3) continue;

      const prog = (y0 - y) / span;
      // In fast, out slow. A mote that appears and disappears at full strength
      // blinks; this dissolves it into the air at both ends of its travel.
      const fade = Math.min(1, prog / 0.16) * Math.pow(Math.max(0, 1 - prog), 1.2);
      if (fade <= 0.02) continue;

      /**
       * Proximity to the nearest beam axis, done as a cheap dot product per
       * shaft rather than by sampling the canvas. `along` is the distance down
       * the axis, `perp` the distance sideways from it; comparing `perp`
       * against the shaft's half-width AT THAT DEPTH is what makes a mote low
       * in the frame count as "inside" a beam that has widened to reach it.
       */
      let prox = 0;
      for (let k = 0; k < shafts.length; k++) {
        const s = shafts[k];
        const vx = x - s.ox;
        const vy = y - s.oy;
        const along = vx * s.dx + vy * s.dy;
        if (along < 0 || along > s.len) continue;
        const perp = Math.abs(vx * s.nx + vy * s.ny);
        const halfW = (s.topW + (s.botW - s.topW) * (along / s.len)) * 0.5;
        // Squared falloff, not linear: a beam has no wall. A linear ramp gives
        // the lit region a perceptible edge and the motes appear to cross a
        // line. The shaft's own alpha weights it, so dust in the dominant beam
        // is markedly brighter than dust in a minor one.
        const q = Math.max(0, 1 - perp / halfW);
        const lit = q * q * (0.5 + s.al * 11) * Math.max(0.25, 1 - along / s.len);
        if (lit > prox) prox = lit;
      }

      /**
       * Per-mote twinkle. Dust is not spherical; it flashes as it tumbles, and
       * without this the beams look like they contain a fixed grid of
       * pinpricks. Each mote gets its own rate AND phase — a shared rate would
       * make the whole hall blink in unison, which reads as a failing tube.
       */
      const tw = 0.7 + 0.3 * Math.sin(t * (0.5 + f.rnd(i, salt + 4) * 1.7) + v * 12);

      // Light also falls off with distance from the window, so dust in the far
      // corners must be dimmer even when it is technically inside a shaft.
      const ddx = (x - fx) / W;
      const ddy = (y - fy) / H;
      const near = 1 / (1 + (ddx * ddx + ddy * ddy) * 2.4);

      // 0.14 is the floor: unlit dust is still faintly there, and zeroing it
      // would leave the air between beams empty and papery.
      const al = baseAl * fade * tw * airAl * (0.14 + prox * 1.75) * (0.45 + near);
      if (al <= 0.003) continue;

      /**
       * Three draw paths, chosen by rank and brightness, purely for budget. A
       * radial gradient on every far mote would triple the primitive cost of
       * the frame for an effect invisible at one pixel; the faint tiny ones get
       * a flat disc, and only the ones that actually catch a beam pay for a
       * soft halo. The near rank is always soft — a large hard disc is the one
       * thing in this scene that would read as a drawn object.
       */
      if (soft) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 2.4);
        g.addColorStop(0, rgba(p.accent, a(al)));
        g.addColorStop(0.32, rgba(p.accent, a(al * 0.55)));
        g.addColorStop(0.66, rgba(p.accent, a(al * 0.18)));
        g.addColorStop(1, rgba(p.accent, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, rad * 2.4, 0, TAU);
        ctx.fill();
      } else if (prox > 0.5 && rad > 1.3) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 2.8);
        g.addColorStop(0, rgba(p.sheen, a(al)));
        g.addColorStop(0.28, rgba(p.accent, a(al * 0.7)));
        g.addColorStop(1, rgba(p.accent, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, rad * 2.8, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = rgba(p.accent, a(al));
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, TAU);
        ctx.fill();
      }
    }
  };

  // Far: many, tiny, dim, slow. This rank is the texture of the air itself.
  rank(Math.round(70 + 45 * D), 0.55, 0.7, 2.4, 3, 0.05, false, 21);
  // Middle: the rank that reads as "dust in a sunbeam".
  rank(Math.round(30 + 22 * D), 1.4, 1.3, 6.2, 11, 0.055, false, 61);
  // Near: a handful of big soft blooms drifting fastest, right in front of the
  // viewer. Low alpha and a wide gradient keep them as blur, not as circles.
  rank(Math.round(5 + 4 * D), 4.5, 4.5, 15, 26, 0.02, true, 131);

  // -----------------------------------------------------------------------
  // PASS 6.5 — WHAT THE BEAM CARRIES UP (signature, continued).
  //
  // A few petals loosed from the field, riding the dominant shaft's updraft
  // with some brighter-than-rank motes for company. Kept SCARCE on purpose:
  // this is the single strongest "alive" cue in the frame, and more than a
  // handful turns the beam into weather. Positions and rotations all derive
  // from `t`, so at speed 0 they freeze into a fixed scatter mid-beam — a
  // photograph, exactly like the motes — rather than settling or vanishing.
  // -----------------------------------------------------------------------
  {
    const s = shafts[0];
    const run = Math.min(s.len, H * 1.4);
    for (let i = 0; i < 4; i++) {
      // `u` runs 1 -> 0 as t grows: born low in the beam, dissolving before
      // the throat. Fades at both ends so nothing pops at either edge.
      const u = (((f.rnd(i, 801) - t * (0.008 + f.rnd(i, 802) * 0.006)) % 1) + 1) % 1;
      const fade = Math.min(1, u / 0.18) * Math.min(1, (1 - u) / 0.18);
      if (fade <= 0.03) continue;
      const along = run * (0.18 + u * 0.8);
      const halfW = (s.topW + (s.botW - s.topW) * (along / s.len)) * 0.5;
      // Sway is lateral, IN the beam's own frame — the petal wanders across
      // the shaft, never out of the light that makes it visible.
      const off =
        (f.rnd(i, 803) - 0.5) * halfW * 1.1 +
        Math.sin(t * (0.16 + f.rnd(i, 804) * 0.2) + i * 5.1) * halfW * 0.16;
      const len = H * (0.016 + f.rnd(i, 805) * 0.01);
      ctx.save();
      ctx.translate(s.ox + s.dx * along + s.nx * off, s.oy + s.dy * along + s.ny * off);
      ctx.rotate(
        f.rnd(i, 806) * TAU +
          t * (f.rnd(i, 807) < 0.5 ? -1 : 1) * (0.1 + f.rnd(i, 808) * 0.12),
      );
      const al = 0.1 * fade;
      const g = ctx.createLinearGradient(0, 0, 0, -len);
      g.addColorStop(0, rgba(p.accent, a(al)));
      g.addColorStop(1, rgba(p.sheen, a(al * 0.45)));
      ctx.fillStyle = g;
      petalPath(len, len * 0.34);
      ctx.fill();
      ctx.restore();
    }

    // The bright company: slightly larger, `sheen`-cored motes climbing the
    // same column a touch faster than the petals — pollen over dust.
    for (let i = 0; i < 6; i++) {
      const u = (((f.rnd(i, 811) - t * (0.012 + f.rnd(i, 812) * 0.01)) % 1) + 1) % 1;
      const fade = Math.min(1, u / 0.15) * Math.min(1, (1 - u) / 0.15);
      if (fade <= 0.03) continue;
      const along = run * (0.12 + u * 0.85);
      const halfW = (s.topW + (s.botW - s.topW) * (along / s.len)) * 0.5;
      const off =
        (f.rnd(i, 813) - 0.5) * halfW * 0.9 +
        Math.sin(t * (0.2 + f.rnd(i, 814) * 0.3) + i * 3.3) * halfW * 0.12;
      const x = s.ox + s.dx * along + s.nx * off;
      const y = s.oy + s.dy * along + s.ny * off;
      const rad = 1.3 + f.rnd(i, 815) * 1.5;
      const tw = 0.75 + 0.25 * Math.sin(t * (0.6 + f.rnd(i, 816) * 1.2) + i * 7.7);
      const al = 0.11 * fade * tw;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 2.6);
      g.addColorStop(0, rgba(p.sheen, a(al)));
      g.addColorStop(0.3, rgba(p.accent, a(al * 0.6)));
      g.addColorStop(1, rgba(p.accent, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad * 2.6, 0, TAU);
      ctx.fill();
    }
  }

  // -----------------------------------------------------------------------
  // PASS 7 — SETTLE. Back to `source-over`: everything below REMOVES light,
  // and `lighter` cannot subtract.
  // -----------------------------------------------------------------------
  ctx.globalCompositeOperation = 'source-over';

  /**
   * Three soft bands of the room's own murk lying across the lower frame,
   * drawn IN FRONT of the dust. Additive motes brighten wherever they land;
   * putting a little haze back over them is what makes them sit inside air
   * rather than on top of the picture. Their offsets follow the horizon so a
   * high-horizon composition keeps its haze where its floor is.
   */
  for (let i = 0; i < 3; i++) {
    const cy = hy + (i - 1) * H * 0.1;
    const th = H * (0.12 + f.rnd(i, 81) * 0.1);
    const g = ctx.createLinearGradient(0, cy - th, 0, cy + th);
    g.addColorStop(0, rgba(p.shade, 0));
    g.addColorStop(0.5, rgba(p.shade, a(0.03 + f.rnd(i, 82) * 0.022)));
    g.addColorStop(1, rgba(p.shade, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, cy - th, W, th * 2);
  }

  /**
   * Vignette, centred on the FOCUS rather than on the canvas. Anchoring it to
   * the light makes the darkness feel caused by the window's falloff instead
   * of applied as a filter afterwards. It is also the pass doing this scene's
   * practical work: it guarantees the frame edges stay low-contrast wherever
   * chrome and body text sit, whatever the theme's colours are.
   *
   * It is much lighter than it used to be. The old value crushed the far half
   * of the hall to near black and undid the diagonal grade of pass 1, which is
   * how the scene ended up reading as a dark frame with a few pale spokes.
   */
  const vig = ctx.createRadialGradient(fx, fy, R * 0.2, fx, fy, R * 1.15);
  vig.addColorStop(0, rgba(p.shade, 0));
  vig.addColorStop(0.5, rgba(p.shade, a(0.05)));
  vig.addColorStop(0.8, rgba(p.shade, a(0.16)));
  vig.addColorStop(1, rgba(p.shade, a(0.26)));
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // Top scrim. Headers and titles live in the upper band, so it gets one extra
  // pass of quiet no matter where the composition put the window — but it fades
  // to nothing well before the middle of the frame so it never cuts a line.
  const scrim = ctx.createLinearGradient(0, 0, 0, H * 0.34);
  scrim.addColorStop(0, rgba(p.shade, a(0.14)));
  scrim.addColorStop(0.55, rgba(p.shade, a(0.04)));
  scrim.addColorStop(1, rgba(p.shade, 0));
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H * 0.34);

  ctx.restore();

  // Belt and braces: the contract says a painter hands the context back clean.
  // `restore()` only unwinds what this painter pushed — if a caller ever enters
  // with dirty state, the next scene in the stack would inherit it.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};
