import { rgba, type ScenePainter } from './types';

/**
 * DUST — sun through a high window into a quiet hall.
 *
 * The subject is not the window and not the beam. It is the *air*: light is
 * invisible in transit, and the only reason a shaft can be seen at all is that
 * something is suspended in it. So the shafts and the motes are one physical
 * claim painted at two scales, and the picture dies if either is removed — the
 * shafts alone are flat wedges of paint, the motes alone are confetti.
 *
 * Everything is gradient; nothing has an outline. An edge in a background
 * becomes a thing the eye lands on, and the eye belongs on the text.
 *
 * Six passes, back to front. Each carries a different distance from the
 * viewer, and that separation is the entire illusion of depth — collapsing any
 * two of them into one pass flattens the hall into a gradient swatch.
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
  const a = (v: number) => v * A;

  const fx = W * comp.focusX;
  const fy = H * comp.focusY;
  const hy = H * comp.horizon;
  const D = comp.density;
  const R = Math.max(W, H);

  ctx.save();

  // -----------------------------------------------------------------------
  // PASS 1 — the hall. The volume the light has to travel through.
  //
  // Without a graded ground the shafts sit on whatever the page colour is and
  // read as pasted-on decals. Real interiors are darkest in the upper corners
  // (the ceiling is unlit) and pool a second gloom on the floor; that vertical
  // sandwich is what gives the beam something to be brighter *than*.
  // -----------------------------------------------------------------------
  ctx.fillStyle = rgba(p.ground, a(0.96));
  ctx.fillRect(0, 0, W, H);

  const hall = ctx.createLinearGradient(0, 0, 0, H);
  hall.addColorStop(0, rgba(p.shade, a(0.42)));
  // The lightest point of the room is pinned to the focal height rather than
  // to a fixed fraction, so a composition that puts its window low still gets
  // a room whose brightness agrees with where its light actually is.
  hall.addColorStop(Math.min(0.9, Math.max(0.1, comp.focusY)), rgba(p.shade, a(0.1)));
  hall.addColorStop(1, rgba(p.shade, a(0.5)));
  ctx.fillStyle = hall;
  ctx.fillRect(0, 0, W, H);

  // -----------------------------------------------------------------------
  // From here light ACCUMULATES. Over `source-over` each shaft would paint
  // *over* the last and their crossings would read as flat overlapping panes;
  // under `lighter` the crossings brighten, which is the one cue that says
  // these are volumes of lit air rather than translucent card.
  // -----------------------------------------------------------------------
  ctx.globalCompositeOperation = 'lighter';

  // -----------------------------------------------------------------------
  // PASS 2 — the key glow: the window's own light, before it has gone
  // anywhere. Four stacked radials, not one, because a single gradient has a
  // single falloff curve; shrinking, brightening copies sum into a curve that
  // is hot and tight at the aperture and very long in the tail. That long tail
  // is what keeps the shafts from starting at a visible seam.
  // -----------------------------------------------------------------------
  const halo: Array<[number, number]> = [
    [1.05, 0.055],
    [0.6, 0.06],
    [0.3, 0.075],
    [0.14, 0.09],
  ];
  for (let i = 0; i < halo.length; i++) {
    const [rf, al] = halo[i];
    const r = R * rf;
    const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
    g.addColorStop(0, rgba(p.accent, a(al)));
    g.addColorStop(0.38, rgba(p.accent, a(al * 0.45)));
    g.addColorStop(0.72, rgba(p.accent, a(al * 0.13)));
    g.addColorStop(1, rgba(p.accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // The blown-out centre. `sheen` appears only here and on the few brightest
  // motes; spread any wider it tints the whole hall toward paper and the warm
  // gold this scene is named for goes grey.
  const core = ctx.createRadialGradient(fx, fy, 0, fx, fy, R * 0.09);
  core.addColorStop(0, rgba(p.sheen, a(0.13)));
  core.addColorStop(0.45, rgba(p.accent, a(0.07)));
  core.addColorStop(1, rgba(p.accent, 0));
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, W, H);

  // -----------------------------------------------------------------------
  // PASS 3 — the shafts.
  //
  // Each is built once into `shafts` and drawn from that record, because pass
  // 4 has to ask "is this mote inside a beam?" and the answer must come from
  // the same numbers that were painted. Recomputing the geometry in the mote
  // loop would drift the two apart and the motes would light up next to the
  // beams instead of in them — which is the whole effect.
  // -----------------------------------------------------------------------
  interface Shaft {
    ox: number;
    oy: number;
    /** Unit vector down the axis. */
    dx: number;
    dy: number;
    /** Unit normal, for the perpendicular distance test in pass 4. */
    nx: number;
    ny: number;
    len: number;
    topW: number;
    botW: number;
    al: number;
  }

  const nShafts = 4 + Math.round(D * 2);
  const shafts: Shaft[] = [];

  for (let i = 0; i < nShafts; i++) {
    /**
     * Origins are scattered a little around the focus rather than sharing one
     * point. A perfect common vertex reads as a starburst — a logo, a rendered
     * icon — and instantly breaks the illusion of a real window, whose panes
     * and mullions throw beams that are near-parallel, not radial.
     */
    const ox = fx + (f.rnd(i, 401) - 0.5) * W * 0.3;
    const oy = fy + (f.rnd(i, 402) - 0.5) * H * 0.14;

    /**
     * Angles fan downward and mostly one way, the way real sunlight does — a
     * symmetric fan is a diagram. `rnd` breaks the even spacing that would
     * otherwise creep in from the `i` term.
     */
    const spread = (i / Math.max(1, nShafts - 1) - 0.42) * 0.85;
    const jitter = (f.rnd(i, 403) - 0.5) * 0.26;
    // The scene-wide breath: a hair of angle and a hair of alpha, on two
    // incommensurable frequencies per shaft so the group never visibly loops.
    // Amplitudes are tiny on purpose — this is air moving, not a searchlight,
    // and anything larger starts pumping the contrast under the text.
    const sway = alive * Math.sin(t * (0.09 + f.rnd(i, 404) * 0.07) + i * 2.3) * 0.022;
    const ang = spread + jitter + sway;

    const len = H * (1.15 + f.rnd(i, 405) * 0.75);
    const topW = W * (0.03 + f.rnd(i, 406) * 0.08);
    // Beams widen as they go: partly true perspective, mostly scattering. A
    // parallel-sided shaft looks like a ruler laid on the picture.
    const botW = topW * (2.2 + f.rnd(i, 407) * 2.6);

    /**
     * Brightness is tied INVERSELY to width. The widest shaft must be nearly
     * invisible — a broad *and* bright wedge stops being atmosphere and
     * becomes a shape, the single failure that makes this kind of scene read
     * as clip-art. Wide and faint is haze; narrow and bright is a beam.
     */
    const widthNorm = (topW / W - 0.03) / 0.08; // 0 narrow .. 1 wide
    const al = (0.05 - widthNorm * 0.032) * (1 + alive * Math.sin(t * 0.21 + i * 1.9) * 0.12);

    const dx = -Math.sin(ang);
    const dy = Math.cos(ang);
    shafts.push({ ox, oy, dx, dy, nx: dy, ny: -dx, len, topW, botW, al: Math.max(0.008, al) });
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
     * Three widening, dimming copies rather than one fill. A linear gradient
     * fades the shaft along its LENGTH but leaves its SIDES razor sharp, and a
     * hard-edged wedge on a 768px canvas that is then upscaled aliases into a
     * visible triangle. Stacking copies fakes the lateral falloff a single
     * fill cannot express — this is the difference between "a beam of light"
     * and "a grey polygon".
     */
    for (let k = 0; k < 3; k++) {
      const wide = 1 + k * 0.9;
      const al = s.al / (1 + k * 1.45);
      const g = ctx.createLinearGradient(0, 0, 0, s.len);
      // Starts at zero so the shaft emerges out of the glow of pass 2 instead
      // of butting against it with a seam at the window.
      g.addColorStop(0, rgba(p.accent, 0));
      g.addColorStop(0.1, rgba(p.accent, a(al)));
      g.addColorStop(0.42, rgba(p.accent, a(al * 0.46)));
      g.addColorStop(0.78, rgba(p.accent, a(al * 0.13)));
      g.addColorStop(1, rgba(p.accent, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo((-s.topW * wide) / 2, 0);
      ctx.lineTo((s.topW * wide) / 2, 0);
      ctx.lineTo((s.botW * wide) / 2, s.len);
      ctx.lineTo((-s.botW * wide) / 2, s.len);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // -----------------------------------------------------------------------
  // PASS 4 — the motes.
  //
  // The contrast between a mote inside a beam and one outside it IS the
  // subject. Lit uniformly they are snow on a dark rectangle; lit by
  // proximity, the beams acquire volume and the dark between them acquires
  // depth, without a single extra shape being drawn.
  // -----------------------------------------------------------------------
  const nMotes = Math.round(90 + 50 * D);

  /**
   * Density thins the air by DIMMING as well as by counting. Dropping the
   * count alone makes a low-density section look like the same air with holes
   * punched in it; scaling opacity too makes it read as genuinely clearer.
   */
  const airAl = 0.4 + 0.6 * D;

  for (let i = 0; i < nMotes; i++) {
    /**
     * One continuous depth value instead of discrete bands. Bands are right
     * for bokeh, where each band is a different focal plane, but dust in a
     * beam is a continuum — quantising it here produces visible size cliffs
     * once a dozen motes share a radius.
     */
    const depth = f.rnd(i, 21);

    const rad = 0.9 + depth * 2.4;
    // Near dust climbs faster and swings wider: parallax, and the only cue on
    // a flat canvas that the hall has a front and a back.
    const rate = 3.5 + depth * 10;
    const swayAmp = 4 + depth * 18;

    // Wrap over more than a frame height so motes enter below the crop and
    // leave above it. Wrapping exactly at H pops them into existence on the
    // bottom edge, and a popping mote is the one thing here the eye will find.
    const span = H * 1.4;
    const y0 = H * 1.18;
    const seed = f.rnd(i, 22);
    const y = y0 - ((seed * span + t * rate) % span);

    // Sway is a POSITION, not a modulation, so it freezes correctly at t = 0
    // (it settles to a fixed deterministic offset rather than to zero).
    const x =
      f.rnd(i, 23) * W +
      Math.sin(t * (0.14 + f.rnd(i, 24) * 0.22) + seed * 9.4) * swayAmp;

    if (x < -8 || x > W + 8) continue;

    const prog = (y0 - y) / span;
    // In fast, out slow. A mote that appears and disappears at full strength
    // blinks; this dissolves it into the dark at both ends of its travel.
    const fade = Math.min(1, prog / 0.14) * Math.pow(Math.max(0, 1 - prog), 1.15);
    if (fade <= 0.02) continue;

    /**
     * Proximity to the nearest beam axis, done as a cheap dot product per
     * shaft rather than by sampling the canvas. `along` is the distance down
     * the axis, `perp` the distance sideways from it; comparing `perp` against
     * the shaft's half-width AT THAT DEPTH is what makes a mote low in the
     * frame count as "inside" a beam that has widened to reach it.
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
      // the lit region a perceptible edge and the motes appear to cross a line.
      const q = Math.max(0, 1 - perp / halfW);
      const lit = q * q * (0.55 + s.al * 9);
      if (lit > prox) prox = lit;
    }

    /**
     * Per-mote twinkle. Dust is not spherical; it flashes as it tumbles, and
     * without this the beams look like they contain a fixed grid of pinpricks.
     * Each mote gets its own rate AND phase — a shared rate would make the
     * whole hall blink in unison, which reads as a failing fluorescent tube.
     */
    const tw = 0.7 + 0.3 * Math.sin(t * (0.5 + f.rnd(i, 25) * 1.7) + f.rnd(i, 26) * 12);

    // Light also falls off with distance from the window, so dust in the far
    // corners must be dimmer even when it is technically inside a shaft.
    const ddx = (x - fx) / W;
    const ddy = (y - fy) / H;
    const near = 1 / (1 + (ddx * ddx + ddy * ddy) * 2.6);

    // 0.12 is the floor: unlit dust is still faintly there, and zeroing it
    // would leave the dark between beams empty and papery.
    const al =
      (0.06 - depth * 0.014) * fade * tw * airAl * (0.12 + prox * 1.55) * (0.4 + near);
    if (al <= 0.004) continue;

    /**
     * Two draw paths, chosen by brightness, purely for budget. A radial
     * gradient per mote at 140 motes would triple the primitive cost of the
     * frame for an effect invisible on the dim majority; the faint ones get a
     * flat disc, and only the few that actually catch the beam pay for a soft
     * halo and a `sheen` core. Give every mote a hard disc instead and the
     * bright ones turn into punched dots — that was the "too basic" failure.
     */
    if (prox > 0.5 && rad > 1.8) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 2.6);
      g.addColorStop(0, rgba(p.sheen, a(al)));
      g.addColorStop(0.3, rgba(p.accent, a(al * 0.72)));
      g.addColorStop(1, rgba(p.accent, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad * 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = rgba(p.accent, a(al));
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // -----------------------------------------------------------------------
  // PASS 5 — where the light lands.
  //
  // A shaft that simply fades out in mid-air is a beam in a void. Pooling a
  // little warmth on the floor line gives each one a destination, and it is
  // the only place `comp.horizon` visibly does any work in this scene.
  // -----------------------------------------------------------------------
  for (let i = 0; i < shafts.length; i++) {
    const s = shafts[i];
    if (Math.abs(s.dy) < 0.2) continue; // near-horizontal: it never reaches the floor
    const along = (hy - s.oy) / s.dy;
    if (along <= 0 || along > s.len) continue;
    const px = s.ox + s.dx * along;
    const halfW = (s.topW + (s.botW - s.topW) * (along / s.len)) * 0.5;

    ctx.save();
    ctx.translate(px, hy);
    // Squashed hard: a beam meeting a floor at a shallow angle makes a long
    // flat ellipse. A circular pool would read as a spotlight from directly
    // above and contradict the angles drawn in pass 3.
    ctx.scale(1, 0.2);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, halfW * 1.9);
    g.addColorStop(0, rgba(p.accent, a(s.al * 1.15)));
    g.addColorStop(0.45, rgba(p.accent, a(s.al * 0.4)));
    g.addColorStop(1, rgba(p.accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-halfW * 2, -halfW * 2, halfW * 4, halfW * 4);
    ctx.restore();
  }

  // The bounce: light that has hit the floor and come back up into the air. It
  // is what stops the lower frame going dead and flat once the shafts have
  // faded out, and it ties the whole bottom band to the same source.
  const bounceTop = Math.min(H, Math.max(0, hy - H * 0.14));
  const bounce = ctx.createLinearGradient(0, bounceTop, 0, H);
  bounce.addColorStop(0, rgba(p.accent, 0));
  bounce.addColorStop(0.4, rgba(p.accent, a(0.038)));
  bounce.addColorStop(1, rgba(p.accent, a(0.012)));
  ctx.fillStyle = bounce;
  ctx.fillRect(0, bounceTop, W, H - bounceTop);

  // -----------------------------------------------------------------------
  // PASS 6 — settle. Back to `source-over`: everything below REMOVES light,
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
    const cy = hy + (i - 1) * H * 0.09;
    const th = H * (0.11 + f.rnd(i, 81) * 0.1);
    const g = ctx.createLinearGradient(0, cy - th, 0, cy + th);
    g.addColorStop(0, rgba(p.shade, 0));
    g.addColorStop(0.5, rgba(p.shade, a(0.045 + f.rnd(i, 82) * 0.03)));
    g.addColorStop(1, rgba(p.shade, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, cy - th, W, th * 2);
  }

  /**
   * Vignette, centred on the FOCUS rather than on the canvas. Anchoring it to
   * the light makes the darkness feel caused by the window's falloff instead
   * of applied as a filter afterwards. It is also the pass doing this scene's
   * practical work: it guarantees the frame edges stay dark and low-contrast
   * wherever chrome and body text sit, whatever the theme's colours are.
   */
  const vig = ctx.createRadialGradient(fx, fy, R * 0.14, fx, fy, R * 1.0);
  vig.addColorStop(0, rgba(p.shade, 0));
  vig.addColorStop(0.55, rgba(p.shade, a(0.1)));
  vig.addColorStop(1, rgba(p.shade, a(0.42)));
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // Top scrim. Headers and titles live in the upper band, so it gets one extra
  // pass of quiet no matter where the composition put the window.
  const scrim = ctx.createLinearGradient(0, 0, 0, H * 0.3);
  scrim.addColorStop(0, rgba(p.shade, a(0.2)));
  scrim.addColorStop(1, rgba(p.shade, 0));
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H * 0.3);

  ctx.restore();

  // Belt and braces: the contract says a painter hands the context back clean.
  // `restore()` only unwinds what this painter pushed — if a caller ever enters
  // with dirty state, the next scene in the stack would inherit it.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};
