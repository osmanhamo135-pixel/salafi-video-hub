import { rgba, type ScenePainter } from './types';

/**
 * LANTERN — an interior. A room with one lamp in it.
 *
 * The earlier version had light but no ROOM: a warm blur floating in a dark
 * rectangle. Light on its own is not a picture. What makes a lit interior read
 * is that the light lands on SOMETHING and falls off away from it — a wall
 * behind, a table below, corners the lamp never reaches. That relationship,
 * not the glow, is the subject here.
 *
 * So the file is built the way the room is: the volume first (a full-height
 * graded body, dark at the ceiling and dark in the corners), then the surfaces
 * the light will land on, then the lamp, then everything suspended in the air
 * between the lamp and the viewer. Every one of those layers answers to the
 * single light at (focusX, focusY): nearer it, brighter; away from it, into
 * shadow. That one rule does most of the work.
 *
 * Nothing in here is an object with an outline. Every form is a gradient that
 * ends at zero over a long tail, and every mass — the lamp pool, the shafts,
 * the planes — is FUSED out of several overlapping low-alpha primitives rather
 * than drawn as one shape with a bright core. A findable centre or a findable
 * edge in a background becomes a thing the eye lands on, and the eye belongs
 * on the text.
 *
 * Warm only. `accent` and `sheen` carry every lit surface; `shade` and `ground`
 * carry every unlit one. The cool tokens (teal, turquoise, green) are never
 * touched in this file — a lamp-lit room has no cold light in it.
 */

const TAU = Math.PI * 2;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Positive modulo. `%` keeps its operand's sign, which would strand a mote
 *  off-canvas the first time a drift term went negative. */
const wrap = (v: number, span: number): number => ((v % span) + span) % span;

/** One shaft, resolved once so the dust pass can ask where the light is. */
interface Shaft {
  x: number;
  y: number;
  ang: number;
  len: number;
  halfW: number;
  al: number;
}

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
  if (A <= 0) return;
  const a = (v: number) => v * A;

  const fx = clamp01(comp.focusX) * W;
  const fy = clamp01(comp.focusY) * H;
  /** The horizon as a fraction, clamped away from the very edges: the wall and
   *  floor planes are built around it and both need room to dissolve. */
  const hn = Math.min(0.86, Math.max(0.26, comp.horizon));
  const hy = hn * H;
  const D = clamp01(comp.density);
  const R = Math.max(W, H);

  /**
   * Two summed, incommensurable frequencies. A single sine reads as a machine
   * pulse within about ten seconds; 0.83 and 0.31 Hz beat against each other
   * with no short common period, so the glow breathes like a wick instead of
   * looping. Amplitudes are deliberately tiny — this is a flame settling, not
   * a flame guttering, and anything larger starts pumping the text's contrast.
   */
  const flicker =
    1 + alive * (Math.sin(t * 0.83) * 0.034 + Math.sin(t * 0.31 + 1.7) * 0.021);

  /**
   * The workhorse. A soft ellipse with no edge anywhere on it: a radial ramp
   * under an anisotropic transform, so it has neither a stroke nor a straight
   * side. `plateau` holds the value flat across the middle before the tail
   * starts — that is what stops a stack of these from summing to a spike, and
   * a spike at the focus would read as a lens flare sitting on the page.
   *
   * The tail is six stops long and reaches exactly zero. Every mass in this
   * file is several of these overlapping at low alpha; none of them is ever
   * strong enough on its own to be picked out of the accumulation.
   */
  const blob = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rot: number,
    triple: string,
    al: number,
    plateau: number,
  ): void => {
    if (al <= 0.0015 || rx <= 0 || ry <= 0) return;
    ctx.save();
    ctx.translate(cx, cy);
    if (rot !== 0) ctx.rotate(rot);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, rgba(triple, al));
    g.addColorStop(plateau, rgba(triple, al * 0.93));
    g.addColorStop(0.44, rgba(triple, al * 0.63));
    g.addColorStop(0.63, rgba(triple, al * 0.35));
    g.addColorStop(0.79, rgba(triple, al * 0.15));
    g.addColorStop(0.92, rgba(triple, al * 0.04));
    g.addColorStop(1, rgba(triple, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  /** How lit a point is, purely as a function of its distance from the lamp.
   *  Everything in the room — planes, dust, orbs — is multiplied by this, and
   *  that shared falloff is what makes the frame read as one place. */
  const litAt = (x: number, y: number, reach: number): number => {
    const dx = (x - fx) / W;
    const dy = (y - fy) / H;
    return 1 / (1 + (dx * dx + dy * dy) * reach);
  };

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // ---------------------------------------------------------------------
  // 1. THE BODY OF THE ROOM
  //
  // A full-height graded volume, not a flat backdrop. Ceilings are the darkest
  // thing in a lamp-lit room, the air lifts across the lamp's own height, and
  // the gloom pools again on the floor. The whole frame is owned here — there
  // is no band of canvas this pass leaves empty — because every warm pass
  // below is additive and additive light needs a dark to be added to.
  // ---------------------------------------------------------------------
  ctx.fillStyle = rgba(p.ground, a(0.985));
  ctx.fillRect(0, 0, W, H);

  /**
   * The stop positions are built from the horizon rather than hard-coded, so
   * the lift always sits where the section says the room's ground line is. A
   * fixed ramp put the bright band on the ceiling in the low-horizon sections
   * and the room turned inside out.
   */
  const body = ctx.createLinearGradient(0, 0, 0, H);
  const bodyStops: Array<[number, number]> = [
    [0, 0.68],
    [hn * 0.2, 0.48],
    [hn * 0.46, 0.28],
    [hn * 0.74, 0.15],
    [hn, 0.1],
    [hn + (1 - hn) * 0.22, 0.16],
    [hn + (1 - hn) * 0.52, 0.31],
    [hn + (1 - hn) * 0.79, 0.47],
    [1, 0.62],
  ];
  for (let i = 0; i < bodyStops.length; i++) {
    body.addColorStop(clamp01(bodyStops[i][0]), rgba(p.shade, a(bodyStops[i][1])));
  }
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, W, H);

  /**
   * Lateral enclosure. The vertical ramp alone gives a floor and a ceiling but
   * no side walls, and a room with no sides is a landscape. Each edge darkens
   * in proportion to how far the lamp is from it, so the far side of the room
   * is genuinely the darker one — asymmetry the eye reads as space rather than
   * as a filter. Both ramps reach zero by mid-frame, well inside the canvas,
   * so neither can leave a vertical seam.
   */
  const leftWall = ctx.createLinearGradient(0, 0, W * 0.58, 0);
  leftWall.addColorStop(0, rgba(p.shade, a(0.14 + clamp01(comp.focusX) * 0.24)));
  leftWall.addColorStop(0.34, rgba(p.shade, a(0.06 + clamp01(comp.focusX) * 0.1)));
  leftWall.addColorStop(0.68, rgba(p.shade, a(0.018)));
  leftWall.addColorStop(1, rgba(p.shade, 0));
  ctx.fillStyle = leftWall;
  ctx.fillRect(0, 0, W * 0.58, H);

  const rightWall = ctx.createLinearGradient(W, 0, W * 0.42, 0);
  rightWall.addColorStop(0, rgba(p.shade, a(0.14 + (1 - clamp01(comp.focusX)) * 0.24)));
  rightWall.addColorStop(0.34, rgba(p.shade, a(0.06 + (1 - clamp01(comp.focusX)) * 0.1)));
  rightWall.addColorStop(0.68, rgba(p.shade, a(0.018)));
  rightWall.addColorStop(1, rgba(p.shade, 0));
  ctx.fillStyle = rightWall;
  ctx.fillRect(W * 0.42, 0, W * 0.58, H);

  // ---------------------------------------------------------------------
  // 2. SURFACES
  //
  // Additive from here: warm light lands and accumulates. Over `source-over`
  // each plane would paint *over* the last and the overlaps would step instead
  // of summing, which is the difference between light and paint.
  //
  // Two planes, and they are told apart by their ANISOTROPY, never by an edge.
  // The wall behind the lamp is a tall, broad lift that reaches up toward the
  // ceiling; the table or floor below is the same light spread flat and wide,
  // squashed to a fifth of its height because a surface seen at a shallow
  // angle compresses. They overlap for a third of the frame around the horizon
  // and cross-fade there, so the "meeting" is a change of tone with nothing to
  // point at. If a viewer can find the line, one of these two is too strong.
  // ---------------------------------------------------------------------
  ctx.globalCompositeOperation = 'lighter';

  // Wall. Three fused lobes rather than one ellipse — offset from each other
  // so the lit patch is lopsided the way a real wall's is, and so it has no
  // single centre of its own to compete with the lamp.
  const wallY = hy - H * 0.3;
  blob(fx - W * 0.06, wallY, W * 0.78, H * 0.72, 0, p.accent, a(0.05), 0.3);
  blob(fx + W * 0.14, wallY - H * 0.08, W * 0.5, H * 0.5, 0, p.accent, a(0.032), 0.26);
  blob(fx - W * 0.2, wallY + H * 0.1, W * 0.42, H * 0.4, 0, p.accent, a(0.026), 0.24);

  // Floor / table. Sits a little below the horizon and reaches much further
  // sideways than it does vertically. The second, wider lobe is what carries
  // the light out into the corners of the lower frame so the plane does not
  // simply stop where the first one runs out.
  const floorY = hy + H * 0.11;
  blob(fx + W * 0.03, floorY, W * 0.62, H * 0.15, 0, p.accent, a(0.055), 0.28);
  blob(fx - W * 0.02, floorY + H * 0.09, W * 0.95, H * 0.12, 0, p.accent, a(0.026), 0.34);
  // A last very faint sheet across the very bottom, so the floor recedes into
  // the frame edge instead of ending in the dark with a visible boundary.
  blob(fx, H * 1.02, W * 0.8, H * 0.16, 0, p.accent, a(0.014), 0.3);

  // ---------------------------------------------------------------------
  // 3. THE LAMP
  //
  // A pool, not a point. Seven overlapping lobes at nearly equal alpha, each
  // with a wide plateau, each nudged off the focus by a deterministic little
  // offset and each with its own aspect ratio. The sum is broad, bright and
  // has nowhere for the eye to land — which is the whole requirement for a
  // light source that lives behind readable text.
  //
  // The tempting version brightens each shrinking copy toward a hot centre.
  // That is a stage lamp, and a stage lamp is a foreground object.
  // ---------------------------------------------------------------------
  for (let i = 0; i < 7; i++) {
    const rf = 1 - i * 0.115;
    const ang = f.rnd(i, 401) * TAU;
    const off = R * 0.035 * f.rnd(i, 419);
    const aspect = 0.82 + f.rnd(i, 433) * 0.42;
    blob(
      fx + Math.cos(ang) * off,
      fy + Math.sin(ang) * off,
      R * 0.92 * rf,
      R * 0.92 * rf * aspect,
      0,
      p.accent,
      a(0.072 * flicker),
      0.2,
    );
  }

  // The heart of the pool: paler where the light is strongest, spread over a
  // third of the frame so it never resolves into a wick. `sheen` desaturates
  // the gold slightly here, which is what warm light does at its brightest —
  // it is not a second, cooler source.
  blob(fx, fy, R * 0.34, R * 0.3, 0, p.sheen, a(0.042 * flicker), 0.24);
  blob(fx, fy, R * 0.19, R * 0.17, 0, p.sheen, a(0.03 * flicker), 0.3);

  // Two crossed anamorphic smears — one lying flat, one standing up the wall.
  // Crossed anisotropy is what a diffuser does to a source, and the pair fuse
  // into a soft irregular pool with no axis of symmetry to read.
  blob(fx, fy, R * 0.56, R * 0.12, 0, p.accent, a(0.062 * flicker), 0.22);
  blob(fx, fy - H * 0.04, R * 0.16, R * 0.44, 0, p.accent, a(0.038 * flicker), 0.22);

  /**
   * A second, far weaker lamp deeper in the room — derived from the focus, not
   * placed, so it moves with the composition. One lamp gives a symmetric blob;
   * two at different distances give the asymmetry that reads as a place. It is
   * held near the threshold of visibility and sits nearer the horizon, where
   * distance would put it.
   */
  const sx2 = W * (1 - clamp01(comp.focusX) * 0.8) * 0.9 + W * 0.05;
  const sy2 = fy * 0.35 + hy * 0.65 + H * 0.06;
  blob(sx2, sy2, R * 0.3, R * 0.24, 0, p.accent, a(0.034), 0.24);
  blob(sx2, sy2, R * 0.14, R * 0.09, 0, p.accent, a(0.022), 0.26);
  blob(sx2, sy2 + H * 0.07, R * 0.26, R * 0.05, 0, p.accent, a(0.018), 0.3);

  // ---------------------------------------------------------------------
  // 4. SHAFTS
  //
  // Light is only visible in transit when something is suspended in it, so the
  // shafts and the dust below are the same physical claim at two scales.
  //
  // They DESCEND; they do not radiate. Fanning them out of the lamp draws a
  // sunburst, and regular angular spacing is read instantly as a lens flare.
  // Every shaft shares one small lean and departs from it only slightly, and
  // all of them are born above the top edge at scattered x — a common origin
  // is the other half of what makes a fan look like a fan.
  //
  // Each is built from four overlapping lobes down its length, widening and
  // dimming as they fall. A wedge fill has razor-straight sides that alias
  // into a visible triangle at this canvas size; a stack of soft ellipses has
  // no side at all, and the last lobe is faint enough that the column runs out
  // of light rather than ending.
  // ---------------------------------------------------------------------
  const shaftCount = 5;
  const tilt = 0.1;
  const originY = -H * 0.14;
  const shafts: Shaft[] = [];

  for (let i = 0; i < shaftCount; i++) {
    const ang = tilt + (f.rnd(i, 91) - 0.5) * 0.12;
    // Irregular x, with jitter large relative to the step so no two gaps match.
    const ox = fx + (i - (shaftCount - 1) / 2) * W * 0.27 + (f.rnd(i, 96) - 0.5) * W * 0.3;

    /**
     * `character` splits the shafts into opposites rather than siblings. Near
     * 0 is a broad, barely-there wash of air; near 1 is a narrower column with
     * some presence. Width and alpha are driven from the same number in
     * OPPOSITE directions, because five shafts of equal width and weight read
     * as a repeated motif, and a repeated motif in a background is decoration
     * the eye starts counting.
     */
    const character = f.rnd(i, 97);
    const halfW = W * (0.115 - character * 0.075);
    const len = H * (0.95 + f.rnd(i, 92) * 0.95);
    // Shafts far from the lamp are dimmer: they are the same light, seen where
    // there is less of it.
    const al =
      (0.018 + character * 0.026) *
      (0.65 + f.rnd(i, 95) * 0.7) *
      (0.45 + litAt(ox, hy * 0.6, 1.4));

    shafts.push({ x: ox, y: originY, ang, len, halfW, al });

    const dx = Math.sin(ang);
    const dy = Math.cos(ang);
    for (let k = 0; k < 4; k++) {
      // Lobe centres march down the column; each is wider and fainter than the
      // last, and the fourth carries almost nothing.
      const u = 0.16 + k * 0.25;
      const spread = 1 + k * 0.55;
      const fall = Math.pow(1 - u, 1.35);
      blob(
        ox + dx * len * u,
        originY + dy * len * u,
        halfW * spread,
        len * 0.3,
        ang,
        p.accent,
        a(al * fall),
        0.16,
      );
    }
  }

  // ---------------------------------------------------------------------
  // 5. DUST IN THE LIT AIR
  //
  // The smallest scale in the frame, and the only reason the lamp belongs to
  // the room rather than sitting in front of it. Motes are near-invisible on
  // their own; what shows is the density of them where the light is, and the
  // way that density brightens as they cross a shaft.
  // ---------------------------------------------------------------------
  const motes = Math.round(46 + 44 * D);
  const moteSpan = H * 1.22;

  for (let i = 0; i < motes; i++) {
    const x0 = f.rnd(i, 131) * W;
    const seed = f.rnd(i, 137);
    const rad = 0.7 + f.rnd(i, 139) * 1.9;
    // Heat carries dust up, slowly and at differing rates.
    const y = H * 1.06 - wrap(seed * moteSpan + t * (5 + f.rnd(i, 141) * 7), moteSpan);
    const x = x0 + Math.sin(t * (0.2 + f.rnd(i, 143) * 0.24) + seed * 8) * 9;

    // Distance from the lamp is most of a mote's brightness.
    let al = 0.115 * (0.12 + litAt(x, y, 4.2));

    // Crossing a shaft lifts it. Perpendicular distance to each shaft's axis,
    // squared falloff, only while the mote is inside the shaft's length — the
    // same geometry the shaft was drawn from, so the brightening lands exactly
    // where the column is.
    let boost = 0;
    for (let s = 0; s < shafts.length; s++) {
      const sh = shafts[s];
      const rx = x - sh.x;
      const ry = y - sh.y;
      const along = rx * Math.sin(sh.ang) + ry * Math.cos(sh.ang);
      if (along < 0 || along > sh.len) continue;
      const perp = Math.abs(rx * Math.cos(sh.ang) - ry * Math.sin(sh.ang));
      const halfW = sh.halfW * (1 + (along / sh.len) * 0.9);
      if (perp > halfW) continue;
      const k = 1 - perp / halfW;
      const fall = Math.pow(1 - along / sh.len, 1.2);
      if (k * fall > boost) boost = k * fall;
    }
    al *= 1 + boost * 1.7;
    if (al <= 0.004) continue;

    blob(x, y, rad, rad, 0, p.accent, a(al), 0.2);
  }

  // ---------------------------------------------------------------------
  // 6. BOKEH, IN THREE RANKS
  //
  // Depth on a flat canvas comes from contrast between ranks, not from spread
  // within one. So the far rank is small, dense, dim and slow; the middle sits
  // at roughly three times its radius; and the near rank is an order of
  // magnitude larger, several times faster, and there are only a handful of
  // them. That jump is the whole cue — three ranks of gently increasing size
  // read as one population, not as near and far.
  //
  // The near rank is deliberately the DIMMEST per pixel. A big bright orb
  // close to the lens would become a foreground object and pull the eye off
  // the text, so it carries no rim and no sheen at all: a pressure of warmth
  // in the air rather than a disc.
  // ---------------------------------------------------------------------
  const ranks: Array<{
    n: number;
    rMin: number;
    rMax: number;
    rate: number;
    al: number;
    sway: number;
    salt: number;
    near?: boolean;
  }> = [
    { n: Math.round(24 * D), rMin: 2, rMax: 5, rate: 4, al: 0.075, sway: 7, salt: 11 },
    { n: Math.round(13 * D), rMin: 7, rMax: 15, rate: 9, al: 0.05, sway: 14, salt: 37 },
    {
      n: Math.max(2, Math.round(4 * D)),
      rMin: 34,
      rMax: 78,
      rate: 19,
      al: 0.026,
      sway: 24,
      salt: 89,
      near: true,
    },
  ];

  for (let b = 0; b < ranks.length; b++) {
    const rk = ranks[b];
    // Wrap over more than a frame height so orbs enter below the crop and
    // leave above it; wrapping exactly at H would pop them into existence on
    // the bottom edge.
    const span = H * 1.36;
    const y0 = H * 1.12;

    for (let i = 0; i < rk.n; i++) {
      const s = rk.salt;
      const x0 = f.rnd(i, s) * W;
      const seed = f.rnd(i, s + 1);
      const rad = rk.rMin + f.rnd(i, s + 2) * (rk.rMax - rk.rMin);

      const y = y0 - wrap(seed * span + t * rk.rate, span);
      const prog = (y0 - y) / span; // 0 at entry, 1 at exit

      // Sway is a position, not a modulation, so it freezes correctly at t = 0
      // (it settles at sin(phase) — a fixed, deterministic offset).
      const x = x0 + Math.sin(t * (0.15 + f.rnd(i, s + 3) * 0.2) + seed * 8) * rk.sway;

      // Fade in quickly, out slowly. Orbs that appear and vanish at full
      // strength read as blinking; this dissolves them into the dark.
      const fade = Math.min(1, prog / 0.16) * Math.pow(Math.max(0, 1 - prog), 1.1);
      if (fade <= 0.01) continue;

      // Same falloff every other layer obeys: dust away from the lamp is
      // dimmer, or the orbs float in an evenly lit void and stop belonging to
      // the same scene as the light.
      const al = rk.al * fade * (0.4 + litAt(x, y, 3.2));
      if (al <= 0.004) continue;

      if (rk.near) {
        // No rim, no sheen, no edge anywhere on it.
        blob(x, y, rad, rad * 0.94, 0, p.accent, a(al * 0.9), 0.34);
        blob(x, y, rad * 0.6, rad * 0.58, 0, p.accent, a(al * 0.4), 0.3);
      } else {
        /**
         * The rim, not the centre, is what makes a circle read as *out of
         * focus*: a defocused point images as a disc of near-uniform energy
         * with a brighter edge, where a plain centre-bright dot just reads as
         * a glowing dot. This is the one place in the file that deliberately
         * puts its value at the outside — and it is still a gradient falling
         * to zero past it, so there is no edge to find.
         */
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, rgba(p.accent, a(al * 0.55)));
        g.addColorStop(0.55, rgba(p.accent, a(al * 0.72)));
        g.addColorStop(0.82, rgba(p.sheen, a(al)));
        g.addColorStop(0.93, rgba(p.accent, a(al * 0.48)));
        g.addColorStop(1, rgba(p.accent, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, TAU);
        ctx.fill();
      }
    }
  }

  // ---------------------------------------------------------------------
  // 7. SETTLE
  //
  // Back to normal compositing: everything below REMOVES light, and `lighter`
  // cannot subtract. This pass is what encloses the room.
  // ---------------------------------------------------------------------
  ctx.globalCompositeOperation = 'source-over';

  /**
   * Murk lying along the ground line. Additive light has just brightened the
   * whole lower frame; this puts some of the room's own air back in FRONT of
   * it, so the orbs sit in the room rather than on top of the picture. Three
   * offset bands of different thickness, each fading to zero at both ends, so
   * what the eye gets is a soft tonal change across the horizon — the only
   * place the wall and floor planes are told apart — and never a rule.
   */
  for (let i = 0; i < 3; i++) {
    const cy = hy + (i - 1) * H * 0.075;
    const th = H * (0.11 + f.rnd(i, 71) * 0.1);
    const g = ctx.createLinearGradient(0, cy - th, 0, cy + th);
    g.addColorStop(0, rgba(p.shade, 0));
    g.addColorStop(0.5, rgba(p.shade, a(0.045 + f.rnd(i, 72) * 0.03)));
    g.addColorStop(1, rgba(p.shade, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, cy - th, W, th * 2);
  }

  /**
   * Two vignettes, and both are needed.
   *
   * The first is anchored on the LAMP, which is what makes the darkness feel
   * caused by the light's falloff rather than applied as a filter.
   *
   * The second is anchored on the canvas centre, and it is the one that
   * guarantees the corners. When the composition puts the lamp near an edge —
   * settings sits it at (0.9, 0.86) — a focus-anchored vignette alone crushes
   * the far side and leaves the near corners open, which unrolls the room into
   * a flat wash. This one closes all four regardless of where the light is.
   */
  const vig = ctx.createRadialGradient(fx, fy, R * 0.1, fx, fy, R * 0.98);
  vig.addColorStop(0, rgba(p.shade, 0));
  vig.addColorStop(0.42, rgba(p.shade, a(0.06)));
  vig.addColorStop(0.72, rgba(p.shade, a(0.2)));
  vig.addColorStop(1, rgba(p.shade, a(0.44)));
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  const diag = Math.hypot(W, H) * 0.5;
  const corners = ctx.createRadialGradient(
    W * 0.5,
    H * 0.5,
    diag * 0.34,
    W * 0.5,
    H * 0.5,
    diag * 1.02,
  );
  corners.addColorStop(0, rgba(p.shade, 0));
  corners.addColorStop(0.45, rgba(p.shade, a(0.07)));
  corners.addColorStop(0.75, rgba(p.shade, a(0.19)));
  corners.addColorStop(1, rgba(p.shade, a(0.34)));
  ctx.fillStyle = corners;
  ctx.fillRect(0, 0, W, H);

  // Top scrim. Headers and titles live in the upper band, so it gets one extra
  // pass of quiet regardless of where the composition put the lamp — and a
  // dark ceiling is true to the room anyway.
  const scrim = ctx.createLinearGradient(0, 0, 0, H * 0.36);
  scrim.addColorStop(0, rgba(p.shade, a(0.26)));
  scrim.addColorStop(0.45, rgba(p.shade, a(0.09)));
  scrim.addColorStop(1, rgba(p.shade, 0));
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H * 0.36);

  ctx.restore();

  // Belt and braces: the contract says a painter hands the context back clean,
  // and `restore()` only unwinds what this painter pushed — if a caller ever
  // enters with a dirty state, the next scene in the stack inherits it.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};
