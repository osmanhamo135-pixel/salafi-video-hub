import { rgba, type ScenePainter } from './types';

/**
 * EMBER — a hearth hours after the flame went out.
 *
 * The subject is heat, not fire. There is no flame shape anywhere in here and
 * there deliberately never will be: a flame has a silhouette, and a silhouette
 * in a background becomes an object the eye keeps returning to. What is painted
 * instead is what a banked coal bed *does* to a dark room — a flat pool of glow
 * pressed along the floor, air above it bending in slow columns, and a thin
 * traffic of sparks that are born bright, cool as they climb, and are gone.
 *
 * Four passes, back to front, each carrying a different distance from the
 * viewer. That separation is the whole illusion of depth; fold any two of them
 * into one and the scene collapses into an orange smudge with confetti on it.
 *
 *   1  the coal bed    — flattened radial pools, hottest and smallest at focus
 *   2  the heat shimmer— broad leaning columns of nearly-invisible warm air
 *   3  the sparks      — accelerating, spreading, flickering, briefly trailed
 *   4  the close       — vignette and top scrim so the frame shuts over it all
 *
 * Everything is `accent`, with only the true cores lifted toward `sheen`.
 * Nothing cool is drawn at any point — a single cool token in here reads as
 * daylight leaking in and destroys the "long after the flame" premise.
 */
export const paintEmber: ScenePainter = (f) => {
  const { ctx, W, H, palette: p, comp } = f;

  /**
   * Local time. Every animated term below reads this and never `f.t`.
   * A section that sets `speed: 0` — the Qur'an reading route does, because
   * motion behind Qur'anic text is forbidden — must get a genuinely frozen
   * painting rather than a slow one. Multiplying once at the source is what
   * makes that guarantee total: one layer reaching past this for `f.t` would
   * keep crawling behind the mushaf and no screenshot would ever reveal it.
   */
  const t = f.t * comp.speed;

  /**
   * Anything derived from `t` as a *position* freezes on its own when `t`
   * stops. Sinusoidal *modulations* do not: `sin(phase)` at t = 0 is some
   * nonzero constant, so a frozen frame would sit permanently brighter or
   * dimmer than intended and two speed-0 sections would disagree with each
   * other. `alive` zeroes every such term outright, which makes the still
   * frame the canonical one — the flicker and the shimmer sway both hang off
   * it. Static *seeded* offsets are kept separate from these so the frozen
   * scene still has variety rather than snapping into perfect symmetry.
   */
  const alive = comp.speed > 0 ? 1 : 0;

  /** House rule: artistic alpha * level * weight. Nothing draws without it. */
  const A = f.level * comp.weight;
  const a = (v: number) => v * A;

  const D = comp.density;
  const R = Math.max(W, H);

  /**
   * The bed sits on the composition's ground line, but clamped into the lower
   * half. A section may legitimately place its horizon high for other scenes
   * (a sky wants that); a coal bed floating at a third of the frame height
   * stops being a floor and becomes a bar across the middle of the text.
   */
  const bedY = Math.min(H * 0.98, Math.max(H * 0.52, H * comp.horizon));
  const fx = W * comp.focusX;
  const fy = H * comp.focusY;

  /**
   * The hot core is drawn toward the focus, but only pulled a third of the way
   * there. The focus says where the scene's light lives; the coals still have
   * to lie on the floor. A full pull would lift the brightest thing in the
   * frame up into the reading area on any section with a high focus.
   */
  const coreX = fx;
  const coreY = bedY + (fy - bedY) * 0.34;

  /**
   * Two summed, incommensurable frequencies. A single sine reads as a machine
   * pulse inside ten seconds; 0.21 and 0.077 Hz beat with no short common
   * period, so the bed breathes the way coals actually do — a slow swell as
   * draught crosses them, not a throb. The amplitude is small on purpose:
   * anything larger starts pumping the contrast of text sitting over it.
   */
  const breath =
    1 + alive * (Math.sin(t * 0.21) * 0.05 + Math.sin(t * 0.077 + 2.2) * 0.032);

  ctx.save();

  /**
   * Hard guarantee for the "draw only within the frame" rule. Several passes
   * below fill in transformed space with deliberately oversized rects (that is
   * how a scaled radial gradient gets its soft edge), and a clip is far cheaper
   * than computing tight bounds for each of them.
   */
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();

  // ---------------------------------------------------------------------
  // PASS 1 — the room, and then the coal bed inside it.
  //
  // The dark has to exist before the glow does. Painted straight onto whatever
  // the page ground happens to be, the additive passes below have nothing to
  // push against and the bed reads as a flat orange shape rather than as light
  // in a volume of dark air.
  // ---------------------------------------------------------------------

  ctx.fillStyle = rgba(p.ground, a(0.99));
  ctx.fillRect(0, 0, W, H);

  // Top-heavy darkening. A hearth room is blackest at the ceiling and keeps
  // only a smear of warmth near the floor; a uniform ground would give the
  // shimmer columns in pass 2 nothing to travel through and they would look
  // pasted on rather than suspended.
  const room = ctx.createLinearGradient(0, 0, 0, H);
  room.addColorStop(0, rgba(p.shade, a(0.72)));
  room.addColorStop(0.45, rgba(p.shade, a(0.34)));
  room.addColorStop(0.82, rgba(p.shade, a(0.16)));
  room.addColorStop(1, rgba(p.shade, a(0.4)));
  ctx.fillStyle = room;
  ctx.fillRect(0, 0, W, H);

  /**
   * Additive from here. Overlapping warm light has to *accumulate* the way real
   * light does; over `source-over` each pool would paint on top of the last and
   * the bed would separate into a stack of discrete discs with visible rims.
   */
  ctx.globalCompositeOperation = 'lighter';

  /**
   * The bed proper: wide radial pools squashed hard on Y.
   *
   * A round gradient placed on the floor reads as a ball of light hovering over
   * it. Flattening is the entire difference between "glowing sphere" and
   * "glow lying on a surface", and the flattest, widest pool is also what
   * carries the light sideways to the frame edges so the floor feels
   * continuous rather than spotlit.
   *
   * Five entries, not one, because a single radial gradient has exactly one
   * falloff curve. Stacking shrinking, brightening, progressively rounder
   * copies sums into a curve that is very long in the tail and very tight at
   * the core — which is what a bed of coals measures like. Drop the outer two
   * and the room goes black at the edges; drop the inner two and there is no
   * sense that anything in there is still hot.
   *
   * [radiusFactor, yFlatten, alpha, xLerpTowardCore, yLerpTowardCore]
   */
  const pools: Array<[number, number, number, number, number]> = [
    [1.15, 0.13, 0.075, 0.0, 0.0],
    [0.78, 0.16, 0.085, 0.35, 0.25],
    [0.5, 0.2, 0.095, 0.65, 0.5],
    [0.29, 0.26, 0.11, 0.85, 0.75],
    [0.15, 0.34, 0.14, 1.0, 1.0],
  ];

  for (let i = 0; i < pools.length; i++) {
    const [rf, flat, al, lx, ly] = pools[i];
    // Each pool slides from the bed's own centre toward the focal core, so the
    // stack is a lopsided ramp of heat rather than concentric rings. Concentric
    // rings are exactly what makes canvas glows look like clip-art.
    const cx = W * 0.5 + (coreX - W * 0.5) * lx;
    const cy = bedY + (coreY - bedY) * ly;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, flat);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * rf);
    g.addColorStop(0, rgba(p.accent, a(al * breath)));
    g.addColorStop(0.38, rgba(p.accent, a(al * breath * 0.46)));
    g.addColorStop(0.72, rgba(p.accent, a(al * breath * 0.13)));
    g.addColorStop(1, rgba(p.accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-R * 2, -R * 2, R * 4, R * 4);
    ctx.restore();
  }

  /**
   * Individual coals: a scatter of small flat hot spots along the bed line.
   *
   * Without these the bed is one perfectly smooth blob, which reads as a
   * gradient someone applied rather than as matter that is burning. Each gets
   * its own slow breathing phase so the bed's brightness travels across it —
   * real coals do not pulse in unison. Their alphas stay under the pools' core
   * so no single coal ever becomes a countable object.
   */
  const coals = Math.round(5 + 5 * D);
  for (let i = 0; i < coals; i++) {
    const s = f.rnd(i, 17);
    // Positions bunch toward the core: heat concentrates where the fire was.
    const cx = coreX + (s - 0.5) * W * (0.5 + f.rnd(i, 18) * 0.75);
    const cy = bedY + (f.rnd(i, 19) - 0.5) * H * 0.1;
    const rad = R * (0.035 + f.rnd(i, 20) * 0.075);
    const glow =
      1 + alive * Math.sin(t * (0.3 + f.rnd(i, 21) * 0.5) + s * 9) * 0.34;
    const al = (0.05 + f.rnd(i, 22) * 0.055) * glow;
    if (al <= 0.004) continue;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.4 + f.rnd(i, 23) * 0.22);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
    // `sheen` only at the dead centre of a coal. Spreading it any wider washes
    // the whole bed toward paper-white and the scene stops being "deep and
    // dark" the moment it does.
    g.addColorStop(0, rgba(p.sheen, a(al * 0.5)));
    g.addColorStop(0.3, rgba(p.accent, a(al)));
    g.addColorStop(1, rgba(p.accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-rad * 2, -rad * 2, rad * 4, rad * 4);
    ctx.restore();
  }

  // The hottest, smallest core, sitting at the focus end of the ramp. This is
  // the only place in the scene where sheen is allowed a visible share, and it
  // is what gives the eye a sense that the bed has a source rather than being
  // uniformly warm everywhere.
  ctx.save();
  ctx.translate(coreX, coreY);
  ctx.scale(1, 0.42);
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.1);
  core.addColorStop(0, rgba(p.sheen, a(0.16 * breath)));
  core.addColorStop(0.34, rgba(p.accent, a(0.13 * breath)));
  core.addColorStop(1, rgba(p.accent, 0));
  ctx.fillStyle = core;
  ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.restore();

  // ---------------------------------------------------------------------
  // PASS 2 — heat shimmer.
  //
  // Hot air above coals is visible only as a slow bending of what is behind
  // it. There is nothing behind this but dark, so the shimmer is painted as
  // its own faint warm columns leaning off the bed. It is the layer that makes
  // the sparks in pass 3 look like they are being *carried* by something;
  // remove it and they read as dots animating upward through vacuum.
  //
  // Kept at the edge of perception on purpose. The failure mode here is bands
  // becoming legible as bands — the moment the eye can count them they are
  // stripes across the text, not air.
  // ---------------------------------------------------------------------
  const columns = 3 + Math.round(2 * D);
  for (let i = 0; i < columns; i++) {
    const seed = f.rnd(i, 41);
    const baseX = coreX + (seed - 0.5) * W * 0.95;
    const wide = W * (0.1 + f.rnd(i, 42) * 0.14);
    const top = bedY - H * (0.42 + f.rnd(i, 43) * 0.45);
    const al = 0.028 + f.rnd(i, 44) * 0.022;

    /**
     * The wobble is a *lean*, applied as a shear about the column's foot, not
     * a translation. Sliding a whole column sideways reads as a panel moving;
     * shearing it keeps the foot planted on the coals and lets the top drift,
     * which is how a rising thermal actually behaves. The seeded term survives
     * `alive = 0` so a frozen frame still has columns leaning at different
     * angles instead of a rank of parallel verticals.
     */
    const lean =
      (f.rnd(i, 45) - 0.5) * 0.5 +
      alive * Math.sin(t * (0.18 + f.rnd(i, 46) * 0.26) + seed * 7) * 0.28;

    ctx.save();
    ctx.translate(baseX, bedY);
    // Rows of the shear matrix: x' = x + lean*y. y is negative going up, so
    // the top of the column swings and the base stays put.
    ctx.transform(1, 0, lean, 1, 0, 0);

    /**
     * Three nested widths rather than one rect. A vertical linear gradient
     * fades a column along its length but leaves its left and right edges
     * perfectly sharp, and a hard vertical edge on a 768px canvas that is then
     * upscaled aliases into a visible seam. Stacking widening, dimming copies
     * fakes the lateral falloff a single fill cannot express — the same trick
     * the lantern scene uses for its shafts, for the same reason.
     */
    for (let k = 0; k < 3; k++) {
      const w = wide * (1 + k * 0.9);
      const av = al / (1 + k * 1.6);
      const g = ctx.createLinearGradient(0, 0, 0, top - bedY);
      // Starts transparent so the column emerges out of the bed's own light
      // instead of butting against it with a join at the floor.
      g.addColorStop(0, rgba(p.accent, 0));
      g.addColorStop(0.22, rgba(p.accent, a(av)));
      g.addColorStop(0.62, rgba(p.accent, a(av * 0.4)));
      g.addColorStop(1, rgba(p.accent, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-w, top - bedY, w * 2, bedY - top);
    }
    ctx.restore();
  }

  // A single wide, very flat haze lying just above the bed. Additive sparks and
  // columns both brighten this zone; this puts a soft warm floor under them so
  // the transition from lit floor to dark air is a gradient and not a step.
  ctx.save();
  ctx.translate(coreX, bedY - H * 0.12);
  ctx.scale(1, 0.3);
  const haze = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.85);
  haze.addColorStop(0, rgba(p.accent, a(0.045 * breath)));
  haze.addColorStop(0.5, rgba(p.accent, a(0.018 * breath)));
  haze.addColorStop(1, rgba(p.accent, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(-R * 2, -R * 2, R * 4, R * 4);
  ctx.restore();

  // ---------------------------------------------------------------------
  // PASS 3 — rising sparks.
  //
  // This is the only layer with discrete elements, and it is what makes the
  // scene alive rather than a static glow. The physics matter more than the
  // count: a spark leaves the bed slow and bright, *accelerates* as the
  // thermal takes it, spreads sideways as that thermal widens, and dims as it
  // cools. Sparks that rise at constant speed and constant brightness look
  // like falling snow run backwards, which was the note on the version of this
  // scene that got rejected.
  // ---------------------------------------------------------------------
  const sparks = Math.round(18 + 56 * D);
  for (let i = 0; i < sparks; i++) {
    const seed = f.rnd(i, 61);
    const life = 5.5 + f.rnd(i, 62) * 9; // seconds from bed to burn-out
    const rise = H * (0.42 + f.rnd(i, 63) * 0.62);

    // Phase wraps in [0,1). Seeded offset means the field is already fully
    // populated at t = 0 rather than every spark launching from the floor at
    // once — and it means the frozen frame is a plausible instant, not a
    // starting gun.
    const prog = (seed + t / life) % 1;

    /**
     * Position, not velocity. `prog^1.7` climbs slowly at first and steeply
     * later, which is the acceleration the brief asks for expressed in a form
     * that freezes correctly when `t` does. Integrating a velocity here would
     * need state, and scenes are pure functions.
     */
    const climb = Math.pow(prog, 1.7);
    const y = bedY + H * 0.02 - climb * rise;

    // Birth point, bunched toward the core the way the coals are.
    const x0 = coreX + (f.rnd(i, 64) - 0.5) * W * (0.35 + f.rnd(i, 65) * 0.8);

    /**
     * Horizontal drift scales with height, because a thermal fans out as it
     * rises. Two terms: a seeded splay that survives a frozen frame, and a
     * slow sway that does not. Both multiplied by `climb` so a spark leaves
     * the bed on a near-vertical line and only wanders once it is well up —
     * sparks that wander at birth read as floating dust, not as fire.
     */
    const splay = (f.rnd(i, 66) - 0.5) * W * 0.16;
    const sway =
      alive *
      Math.sin(t * (0.35 + f.rnd(i, 67) * 0.55) + seed * 11) *
      W *
      0.035;
    const x = x0 + (splay + sway) * climb;

    if (y < -H * 0.05 || x < -W * 0.05 || x > W * 1.05) continue;

    /**
     * Cooling curve. Quick fade *in* over the first slice so a spark does not
     * pop into existence at full brightness on the floor, then a steep fade
     * out — most of a spark's visible life is spent in its first third, which
     * is what keeps the upper frame (where headings sit) nearly clear.
     */
    const born = Math.min(1, prog / 0.06);
    const cool = Math.pow(Math.max(0, 1 - prog), 2.0);

    /**
     * Fast flicker, from two beating rates again. A single fast sine on dozens
     * of sparks synchronises visibly into a strobe across the whole field;
     * beaten rates keep them independent. Gated by `alive` so a frozen frame
     * shows a field of steady sparks at their seeded brightness.
     */
    const ph = seed * 21;
    const flick =
      1 +
      alive *
        (Math.sin(t * (5.5 + f.rnd(i, 68) * 6) + ph) * 0.3 +
          Math.sin(t * (2.1 + f.rnd(i, 69) * 3) + ph * 1.7) * 0.18);

    const big = f.rnd(i, 70);
    const rad = 0.9 + big * big * 3.4; // squared, so large sparks stay rare
    const al = (0.16 + f.rnd(i, 71) * 0.2) * born * cool * flick;
    if (al <= 0.006) continue;

    /**
     * Only the biggest and youngest sparks get a trail, and it is drawn first
     * so the head sits on top of it. A trail on every spark turns the field
     * into rain; a trail on the few that are still hot enough to streak is
     * what sells the upward motion in a single still frame — which matters,
     * because on the speed-0 routes a still frame is all anyone ever sees.
     */
    if (rad > 2.6 && prog < 0.55) {
      const len = rad * (7 + f.rnd(i, 72) * 9) * (1 - prog);
      ctx.save();
      // Squash a radial gradient along Y into a soft spindle. A stroked line
      // would give the trail two hard sides and a flat cap; this has neither,
      // and softness is the only thing keeping it from reading as a scratch.
      ctx.translate(x, y + len * 0.42);
      ctx.scale(1, len / (rad * 1.6));
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad * 1.6);
      g.addColorStop(0, rgba(p.accent, a(al * 0.5)));
      g.addColorStop(0.45, rgba(p.accent, a(al * 0.2)));
      g.addColorStop(1, rgba(p.accent, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-rad * 3, -rad * 3, rad * 6, rad * 6);
      ctx.restore();
    }

    /**
     * The head. Sheen appears only in the innermost stop and only while the
     * spark is young — a spark that stays white all the way up never reads as
     * cooling, and cooling is the entire behaviour being depicted. The wide
     * outer stop at low alpha is the spark's own little halo in the hazy air;
     * without it these are hard dots and the scene looks like clip-art.
     */
    const hot = Math.max(0, 1 - prog * 2.4);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 3.2);
    g.addColorStop(0, rgba(hot > 0.35 ? p.sheen : p.accent, a(al)));
    g.addColorStop(0.3, rgba(p.accent, a(al * 0.55)));
    g.addColorStop(1, rgba(p.accent, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad * 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------------------------------------------------------------------
  // PASS 4 — close the frame.
  //
  // Back to normal compositing: everything below *removes* light, and
  // `lighter` cannot subtract. This pass is the one doing the practical work
  // of the whole scene — it guarantees the edges and the top stay dark and
  // low-contrast wherever chrome and text actually sit, regardless of where
  // the composition put the focus.
  // ---------------------------------------------------------------------
  ctx.globalCompositeOperation = 'source-over';

  // Vignette anchored on the coals rather than on the canvas centre. Anchoring
  // it to the light is what makes the surrounding dark feel *caused* by the
  // bed's falloff instead of applied afterwards as a filter.
  const vig = ctx.createRadialGradient(
    coreX,
    coreY,
    R * 0.1,
    coreX,
    coreY,
    R * 1.05,
  );
  vig.addColorStop(0, rgba(p.shade, 0));
  vig.addColorStop(0.5, rgba(p.shade, a(0.12)));
  vig.addColorStop(1, rgba(p.shade, a(0.55)));
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // The lid. Sparks reach the upper frame at low alpha but they still reach
  // it, and headings live up there. This closes the top over the glow so the
  // eye is walked downward into the dark and the page's own text stays the
  // highest-contrast thing on screen.
  const lid = ctx.createLinearGradient(0, 0, 0, H * 0.46);
  lid.addColorStop(0, rgba(p.shade, a(0.44)));
  lid.addColorStop(0.45, rgba(p.shade, a(0.16)));
  lid.addColorStop(1, rgba(p.shade, 0));
  ctx.fillStyle = lid;
  ctx.fillRect(0, 0, W, H * 0.46);

  ctx.restore();

  // Belt and braces: the contract says a painter hands the context back clean.
  // `restore()` only unwinds what this painter pushed — if a caller ever enters
  // with dirty state, the next scene in the stack would inherit it.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};
