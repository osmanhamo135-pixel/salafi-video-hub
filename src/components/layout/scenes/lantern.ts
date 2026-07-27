import { rgba, type ScenePainter } from './types';

/**
 * LANTERN — an interior with HANGING MOSQUE LAMPS in it.
 *
 * The earlier versions had light but no SOURCE: a warm blur floating in a dark
 * rectangle. Light on its own is not a picture. What makes a lit interior read
 * is that the light comes FROM somewhere and lands ON something — a lamp above,
 * a wall behind, a floor below, corners the lamp never reaches. So the subject
 * here is the lamps: two or three of them, hung on slender chains from the top
 * edge at different depths, each a soft dark glass silhouette against its own
 * halo with a warm core burning in its flame chamber. Lamps are objects — no
 * animate being appears or is suggested anywhere in this file, and there is no
 * calligraphy on the glass: plain glowing lamps only.
 *
 * The room is built the way the room is: the volume first (dark ceiling, dark
 * corners), then the surfaces the light lands on, then each lamp with its own
 * pool, its own wall-touch and its own falling shafts — the shafts descend
 * FROM the lamps and lean with each lamp's position — then everything
 * suspended in the air between the lamps and the viewer. Dust brightens where
 * it crosses a shaft; bokeh floats at three depths.
 *
 * Nothing here is an outline. The lamp bodies are overlapping filled bezier
 * forms whose stacked low-alpha passes give a soft edge; every mass of light
 * is several plateaued radial ramps fused at low alpha. A findable hard edge
 * in a background becomes a thing the eye lands on, and the eye belongs on
 * the text — the lamps live in the upper half and the middle band stays air.
 *
 * Composition biases (`comp.density`):
 *   >= 0.85  mushaf-gold — three lamps, a faint gilded shimmer in the air,
 *            brighter, warmer, more bokeh.
 *   ~ 0.5    mushaf — a small dark room ruled by one dominant lamp.
 *   ~ 0.4 with focusX far from centre — maktabah: the lamps hang to one side
 *            over a wider, quieter room.
 *
 * Warm only. `accent` and `sheen` carry every lit surface; `shade` and
 * `ground` carry every unlit one and the lamp glass. The cool tokens (teal,
 * turquoise, green) are never touched — a lamp-lit room has no cold light.
 */

const TAU = Math.PI * 2;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Positive modulo. `%` keeps its operand's sign, which would strand a mote
 *  off-canvas the first time a drift term went negative. */
const wrap = (v: number, span: number): number => ((v % span) + span) % span;

/** One lamp, resolved before anything paints so every layer can agree on
 *  where the light hangs. All positions are post-sway. */
interface Lamp {
  /** Ceiling anchor x — where the chain leaves the top edge. */
  ax: number;
  /** Cap centre after the chain's sway is applied. */
  cx: number;
  capY: number;
  /** Body height in px; every body proportion is a fraction of this. */
  h: number;
  /** Depth/size key, 0..1 — the near lamp is 1, far lamps smaller. */
  k: number;
  /** Brightness multiplier: the far lamp is the same light, further away. */
  glow: number;
  /** Two summed slow sines — the light breathing. 1 exactly at speed 0. */
  br: number;
  /** Sway angle on the chain, radians. 0 exactly at speed 0. */
  sw: number;
  /** Centre of the flame chamber — the point everything is lit FROM. */
  gx: number;
  gy: number;
  i: number;
}

/** One shaft, resolved once so the dust pass can ask where the light is. */
interface Shaft {
  x: number;
  y: number;
  ang: number;
  len: number;
  halfW: number;
}

export const paintLantern: ScenePainter = (f) => {
  const { ctx, W, H, palette: p, comp } = f;

  /**
   * Local time. Every animated term below reads this and never `f.t`.
   * A section that sets `speed: 0` — the Qur'an reading route does, because
   * motion behind Qur'anic text is forbidden — must get a frozen painting,
   * not a slow one. Multiplying once at the source makes that guarantee
   * total: a single layer reaching for `f.t` would keep crawling behind the
   * mushaf and nothing in a screenshot would reveal it.
   */
  const t = f.t * comp.speed;

  /**
   * Positions derived from `t` freeze on their own when `t` stops. Sinusoidal
   * *modulations* do not — `sin(phase)` at t = 0 is a nonzero constant, which
   * would leave the still scene permanently swayed or brighter than intended.
   * `alive` zeroes those terms outright: at speed 0 every chain hangs plumb
   * and every flame holds steady, and the still frame is the canonical one.
   */
  const alive = comp.speed > 0 ? 1 : 0;

  /** House rule: artistic alpha * level * weight. Nothing draws without it. */
  const A = f.level * comp.weight;
  if (A <= 0) return;
  const a = (v: number) => v * A;

  const focusXn = clamp01(comp.focusX);
  /** The horizon as a fraction, clamped away from the very edges: the wall
   *  and floor planes are built around it and both need room to dissolve. */
  const hn = Math.min(0.86, Math.max(0.26, comp.horizon));
  const hy = hn * H;
  const D = clamp01(comp.density);
  const R = Math.max(W, H);

  // ---------------------------------------------------------------------
  // THEME BIAS — the three rooms this painter serves, told apart by density
  // and by where the composition put the light.
  // ---------------------------------------------------------------------
  /** mushaf-gold: gilded air, a third lamp, more of everything suspended. */
  const gold = D >= 0.85;
  /** How far off-centre the composition hung the light, 0 centre..1 edge. */
  const offside = Math.abs(focusXn - 0.5) * 2;
  /** maktabah: low density, light well off to one side — the lamps cluster
   *  there and the rest of the room is wide and quiet. */
  const aside = !gold && D < 0.45 && offside > 0.45;
  /** mushaf: a small dark room with one lamp that clearly rules it. */
  const dominant = !gold && !aside;
  /** Overall gain on the suspended warmth — gold lifts, maktabah hushes. */
  const airGain = gold ? 1.16 : aside ? 0.88 : 1;
  /** How hard the settle pass closes the room back down. */
  const vigK = gold ? 0.85 : dominant ? 1.16 : 1;

  // ---------------------------------------------------------------------
  // THE LAMPS, resolved before anything paints. Positions derive from the
  // composition's focus, never hard-coded, so each section hangs its lamps
  // where its layout wants the light. Cap heights stay in the top third and
  // bodies end well inside the upper half — the content's air stays clear.
  // ---------------------------------------------------------------------
  const nearAx = Math.min(0.84, Math.max(0.16, focusXn));
  const dir = nearAx < 0.5 ? 1 : -1;
  /** Off to one side the lamps bunch together on that side; otherwise the
   *  far lamp hangs across the room, which is what gives the room width. */
  const sep = aside ? 0.15 : 0.3;

  const specs: Array<{ ax: number; capN: number; hK: number; glow: number }> = [
    { ax: nearAx, capN: 0.22 + f.rnd(0, 7) * 0.05, hK: 1, glow: 1 },
    {
      ax: nearAx + dir * sep,
      capN: 0.11 + f.rnd(1, 7) * 0.05,
      hK: 0.58,
      // Under the dominant-lamp regime the companion is barely an ember.
      glow: dominant ? 0.34 : 0.55,
    },
  ];
  if (gold) {
    specs.push({
      ax: nearAx - dir * 0.19,
      capN: 0.29 + f.rnd(2, 7) * 0.04,
      hK: 0.78,
      glow: 0.72,
    });
  }

  const lamps: Lamp[] = [];
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    const ax = Math.min(0.92, Math.max(0.08, s.ax)) * W;
    const capY = s.capN * H;
    const h = H * 0.165 * s.hK * (dominant && i === 0 ? 1.06 : 1);
    /**
     * The sway. Each lamp gets its own period (incommensurable with its
     * breathing, below) and its own phase, and the amplitude is a couple of
     * milliradians — on a chain the length of the drop that is two or three
     * pixels of drift, felt rather than seen. `alive` gates the whole term.
     */
    const sw =
      alive *
      Math.sin(t * (0.16 + f.rnd(i, 53) * 0.11) + f.rnd(i, 54) * TAU) *
      (0.013 + f.rnd(i, 55) * 0.008);
    const chainLen = capY + 8;
    const cx = ax + Math.sin(sw) * chainLen;
    /**
     * The breathing: two summed slow sines with no short common period, so
     * the glow settles like a wick instead of pulsing like a machine. Tiny
     * amplitudes — a flame settling, not guttering; anything larger starts
     * pumping the text's contrast. Exactly 1 at speed 0.
     */
    const br =
      1 +
      alive *
        (Math.sin(t * 0.47 + f.rnd(i, 56) * 9) * 0.05 +
          Math.sin(t * 0.19 + f.rnd(i, 57) * 17) * 0.031);
    lamps.push({
      ax,
      cx,
      capY,
      h,
      k: s.hK,
      glow: s.glow,
      br,
      sw,
      gx: cx + Math.sin(sw) * h * 0.55,
      gy: capY + h * 0.58,
      i,
    });
  }
  /** Solid parts paint far-to-near so the near lamp overlaps the far one. */
  const byDepth = [...lamps].sort((l1, l2) => l1.k - l2.k);
  const near = lamps[0];

  /** How lit a point is: distance to the NEAREST lamp's flame, scaled by that
   *  lamp's brightness. Planes, dust and orbs all multiply by this, and the
   *  shared falloff is what makes the frame read as one place lit one way. */
  const litAt = (x: number, y: number, reach: number): number => {
    let m = 0;
    for (let i = 0; i < lamps.length; i++) {
      const L = lamps[i];
      const dx = (x - L.gx) / W;
      const dy = (y - L.gy) / H;
      const v = L.glow / (1 + (dx * dx + dy * dy) * reach);
      if (v > m) m = v;
    }
    return m;
  };

  /**
   * The workhorse. A soft ellipse with no edge anywhere on it: a radial ramp
   * under an anisotropic transform. `plateau` holds the value flat across the
   * middle before the six-stop tail starts — that is what stops a stack of
   * these summing to a spike, and a spike reads as a flare on the page.
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

  /**
   * The classic waisted urn profile of a mosque lamp, as ONE closed filled
   * path: flared mouth, narrow neck, swelling belly, taper to a small foot.
   * Coordinates are fractions of the body height `s`; `jx`/`jy` lean and
   * squash it slightly so no two passes (and no two lamps) are identical —
   * the stack of jittered fills is what makes the edge soft instead of cut.
   */
  const bodyPath = (s: number, jx: number, jy: number): void => {
    ctx.beginPath();
    ctx.moveTo((-0.3 + jx) * s, 0.02 * s);
    ctx.bezierCurveTo(-0.27 * s, 0.13 * s, -0.2 * s, 0.21 * s, (-0.13 + jx) * s, 0.3 * s);
    ctx.bezierCurveTo(-0.31 * s, 0.4 * s, -0.36 * s, 0.5 * s, -0.34 * s, (0.61 + jy) * s);
    ctx.bezierCurveTo(-0.32 * s, 0.73 * s, -0.22 * s, 0.81 * s, -0.14 * s, 0.87 * s);
    ctx.bezierCurveTo(-0.07 * s, 0.92 * s, -0.03 * s, 0.96 * s, 0, s);
    ctx.bezierCurveTo(0.03 * s, 0.96 * s, 0.07 * s, 0.92 * s, 0.14 * s, 0.87 * s);
    ctx.bezierCurveTo(0.22 * s, 0.81 * s, 0.32 * s, 0.73 * s, 0.34 * s, (0.61 + jy) * s);
    ctx.bezierCurveTo(0.36 * s, 0.5 * s, 0.31 * s, 0.4 * s, (0.13 + jx) * s, 0.3 * s);
    ctx.bezierCurveTo(0.2 * s, 0.21 * s, 0.27 * s, 0.13 * s, (0.3 + jx) * s, 0.02 * s);
    ctx.bezierCurveTo(0.17 * s, -0.02 * s, -0.17 * s, -0.02 * s, (-0.3 + jx) * s, 0.02 * s);
    ctx.closePath();
  };

  /** Point on a quadratic — the chain's curve — for placing link hints. */
  const qpt = (
    x0: number,
    y0: number,
    mx: number,
    my: number,
    x1: number,
    y1: number,
    u: number,
  ): [number, number] => {
    const v = 1 - u;
    return [
      v * v * x0 + 2 * v * u * mx + u * u * x1,
      v * v * y0 + 2 * v * u * my + u * u * y1,
    ];
  };

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineCap = 'round';

  // ---------------------------------------------------------------------
  // 1. THE BODY OF THE ROOM
  //
  // A full-height graded volume, not a flat backdrop. Ceilings are the
  // darkest thing in a lamp-lit room, the air lifts across the lamps' own
  // height, and the gloom pools again on the floor. Every warm pass below is
  // additive, and additive light needs a dark to be added to.
  // ---------------------------------------------------------------------
  ctx.fillStyle = rgba(p.ground, a(0.985));
  ctx.fillRect(0, 0, W, H);

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
   * Lateral enclosure. Each edge darkens in proportion to how far the lamps
   * hang from it, so the far side of the room is genuinely the darker one —
   * asymmetry the eye reads as space rather than as a filter. Both ramps
   * reach zero by mid-frame so neither can leave a vertical seam.
   */
  const leftWall = ctx.createLinearGradient(0, 0, W * 0.58, 0);
  leftWall.addColorStop(0, rgba(p.shade, a(0.14 + focusXn * 0.24)));
  leftWall.addColorStop(0.34, rgba(p.shade, a(0.06 + focusXn * 0.1)));
  leftWall.addColorStop(0.68, rgba(p.shade, a(0.018)));
  leftWall.addColorStop(1, rgba(p.shade, 0));
  ctx.fillStyle = leftWall;
  ctx.fillRect(0, 0, W * 0.58, H);

  const rightWall = ctx.createLinearGradient(W, 0, W * 0.42, 0);
  rightWall.addColorStop(0, rgba(p.shade, a(0.14 + (1 - focusXn) * 0.24)));
  rightWall.addColorStop(0.34, rgba(p.shade, a(0.06 + (1 - focusXn) * 0.1)));
  rightWall.addColorStop(0.68, rgba(p.shade, a(0.018)));
  rightWall.addColorStop(1, rgba(p.shade, 0));
  ctx.fillStyle = rightWall;
  ctx.fillRect(W * 0.42, 0, W * 0.58, H);

  // ---------------------------------------------------------------------
  // 2. SURFACES
  //
  // Additive from here: warm light lands and accumulates. Two planes, told
  // apart by their ANISOTROPY, never by an edge — the wall a tall broad lift
  // behind the lamps, the floor the same light squashed flat below the
  // horizon. They cross-fade around the horizon so the meeting is a change
  // of tone with nothing to point at.
  // ---------------------------------------------------------------------
  ctx.globalCompositeOperation = 'lighter';

  /** The wall's lift centres behind the lamps' combined weight of light. */
  let wx = 0;
  let wsum = 0;
  for (let i = 0; i < lamps.length; i++) {
    wx += lamps[i].gx * lamps[i].glow;
    wsum += lamps[i].glow;
  }
  wx /= wsum;

  const wallY = hy - H * 0.3;
  blob(wx - W * 0.06, wallY, W * 0.78, H * 0.72, 0, p.accent, a(0.05 * airGain), 0.3);
  blob(wx + W * 0.14, wallY - H * 0.08, W * 0.5, H * 0.5, 0, p.accent, a(0.032 * airGain), 0.26);
  blob(wx - W * 0.2, wallY + H * 0.1, W * 0.42, H * 0.4, 0, p.accent, a(0.026 * airGain), 0.24);

  // Floor. Reaches much further sideways than vertically; the wider second
  // lobe carries the light into the lower corners so the plane does not stop
  // where the first runs out. The maktabah room spreads it wider still.
  const floorY = hy + H * 0.11;
  const wideK = aside ? 1.18 : 1;
  blob(wx + W * 0.03, floorY, W * 0.62 * wideK, H * 0.15, 0, p.accent, a(0.05 * airGain), 0.28);
  blob(wx - W * 0.02, floorY + H * 0.09, W * 0.95 * wideK, H * 0.12, 0, p.accent, a(0.024 * airGain), 0.34);
  blob(wx, H * 1.02, W * 0.8, H * 0.16, 0, p.accent, a(0.014), 0.3);

  // ---------------------------------------------------------------------
  // 3. EACH LAMP'S OWN LIGHT
  //
  // A pool per lamp, breathing with that lamp's flame. The near lamp is
  // larger and SOFTER — bigger radii at lower peak alpha — the far lamp
  // smaller and dimmer: the same light seen from further away. A tall smear
  // behind each lamp lets its halo land on the wall plane, which is what
  // seats the lamp IN the room instead of in front of it; a squashed pool on
  // the floor below is the same light arriving at the other surface.
  // ---------------------------------------------------------------------
  for (let i = 0; i < lamps.length; i++) {
    const L = lamps[i];
    const g = L.glow * L.br * airGain;
    const rad = R * (0.24 + 0.36 * L.k);
    const soft = 0.55 + 0.45 * (1 - L.k); // near lamp trades alpha for size
    for (let j = 0; j < 4; j++) {
      const rf = 1 - j * 0.19;
      const ang = f.rnd(i * 7 + j, 401) * TAU;
      const off = R * 0.02 * f.rnd(i * 7 + j, 419);
      blob(
        L.gx + Math.cos(ang) * off,
        L.gy + Math.sin(ang) * off,
        rad * rf,
        rad * rf * (0.84 + f.rnd(i * 7 + j, 433) * 0.32),
        0,
        p.accent,
        a(0.052 * g * soft),
        0.22,
      );
    }
    // A paler heart in `sheen` — warm light desaturates at its brightest.
    blob(L.gx, L.gy, rad * 0.4, rad * 0.36, 0, p.sheen, a(0.034 * g), 0.26);
    // Wall touch: the halo reaching the plane behind the lamp.
    blob(L.gx, L.gy + H * 0.06, rad * 0.5, rad * 0.92, 0, p.accent, a(0.026 * g), 0.2);
    // Floor pool directly under this lamp.
    blob(L.gx, floorY, W * 0.32 * (0.5 + L.k * 0.5), H * 0.1, 0, p.accent, a(0.045 * g), 0.26);
    blob(L.gx, floorY + H * 0.08, W * 0.46 * (0.5 + L.k * 0.5), H * 0.09, 0, p.accent, a(0.02 * g), 0.3);
  }

  // ---------------------------------------------------------------------
  // 4. SHAFTS, FALLING FROM THE LAMPS
  //
  // Born just below each lamp's body, leaning outward in agreement with
  // where that lamp hangs — a lamp on the right sheds light down and to the
  // right. Each shaft is four overlapping lobes down its length, widening
  // and dimming as they fall: a wedge fill has razor-straight sides that
  // alias into a triangle at this canvas size; a stack of soft ellipses has
  // no side at all, and the last lobe runs out of light rather than ending.
  // ---------------------------------------------------------------------
  const shafts: Shaft[] = [];
  for (let i = 0; i < lamps.length; i++) {
    const L = lamps[i];
    const nS = L.i === 0 ? 2 : 1;
    for (let s = 0; s < nS; s++) {
      const si = L.i * 3 + s;
      /** The lean: mostly this lamp's position relative to the room's
       *  centre, split slightly when a lamp sheds two shafts, jittered so
       *  no two angles rhyme. Near-parallel, never a fan. */
      const ang =
        (L.cx / W - 0.5) * 0.34 +
        (nS === 2 ? (s - 0.5) * 0.13 : 0) +
        (f.rnd(si, 91) - 0.5) * 0.09;
      const ox = L.gx;
      const oy = L.capY + L.h * 1.02;
      const len = H * 0.8 + f.rnd(si, 92) * H * 0.5;
      const halfW = W * (0.045 + f.rnd(si, 97) * 0.05) * (0.5 + L.k * 0.5);
      const al = (0.02 + f.rnd(si, 95) * 0.022) * L.glow * L.br * airGain;

      shafts.push({ x: ox, y: oy, ang, len, halfW });

      const dx = Math.sin(ang);
      const dy = Math.cos(ang);
      for (let k = 0; k < 4; k++) {
        const u = 0.14 + k * 0.26;
        const spread = 1 + k * 0.55;
        const fall = Math.pow(1 - u, 1.35);
        blob(
          ox + dx * len * u,
          oy + dy * len * u,
          halfW * spread,
          len * 0.28,
          ang,
          p.accent,
          a(al * fall),
          0.16,
        );
      }
    }
  }

  // ---------------------------------------------------------------------
  // 5. THE LAMPS THEMSELVES
  //
  // Solid parts over the glow, far lamp first. Chain: two stroke passes of
  // decreasing width with bead-like link hints, curving with the sway, then
  // two short strands splitting to the shoulders. Body: three jittered
  // fills of the urn path at falling scale and rising alpha — the stack is
  // dark in the middle and soft at the edge, a silhouette against its own
  // halo with no outline anywhere. Then the flame chamber burns through.
  // ---------------------------------------------------------------------
  ctx.globalCompositeOperation = 'source-over';
  for (let d = 0; d < byDepth.length; d++) {
    const L = byDepth[d];
    const dim = 0.62 + L.k * 0.38; // far lamp's solids fade into the depth

    // Chain, ceiling to cap, bowing very slightly with the sway.
    const topY = -8;
    const endY = L.capY - L.h * 0.05;
    const mx = (L.ax + L.cx) / 2 + Math.sin(L.sw) * L.capY * 0.22;
    const my = (topY + endY) * 0.5;
    ctx.strokeStyle = rgba(p.shade, a(0.34 * dim));
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(L.ax, topY);
    ctx.quadraticCurveTo(mx, my, L.cx, endY);
    ctx.stroke();
    ctx.strokeStyle = rgba(p.shade, a(0.52 * dim));
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(L.ax, topY);
    ctx.quadraticCurveTo(mx, my, L.cx, endY);
    ctx.stroke();

    // Link hints: sparse beads along the chain, one visible every so often.
    const links = 5 + Math.round(L.k * 3);
    ctx.fillStyle = rgba(p.shade, a(0.5 * dim));
    for (let j = 0; j < links; j++) {
      const u = (j + 0.7) / (links + 0.7);
      const [lx, ly] = qpt(L.ax, topY, mx, my, L.cx, endY, u);
      ctx.beginPath();
      ctx.arc(lx, ly, 1 + L.k * 0.9, 0, TAU);
      ctx.fill();
    }

    // Two strands from the chain's end down to the shoulders.
    ctx.strokeStyle = rgba(p.shade, a(0.42 * dim));
    ctx.lineWidth = 0.9;
    for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.moveTo(L.cx, endY);
      ctx.quadraticCurveTo(
        L.cx + s * L.h * 0.1,
        L.capY + L.h * 0.04,
        L.cx + s * L.h * 0.24,
        L.capY + L.h * 0.16,
      );
      ctx.stroke();
    }

    // The glass, hanging from the cap and rotated by the sway.
    ctx.save();
    ctx.translate(L.cx, L.capY);
    ctx.rotate(L.sw);
    const passes: Array<[number, number]> = [
      [1.1, 0.15],
      [1, 0.23],
      [0.9, 0.3],
    ];
    for (let q = 0; q < passes.length; q++) {
      const jx = (f.rnd(L.i * 5 + q, 61) - 0.5) * 0.05;
      const jy = (f.rnd(L.i * 5 + q, 62) - 0.5) * 0.04;
      bodyPath(L.h * passes[q][0], jx, jy);
      ctx.fillStyle = rgba(p.shade, a(passes[q][1] * (0.8 + L.k * 0.3) * dim));
      ctx.fill();
    }
    // Finial — the small cap the strands meet.
    ctx.beginPath();
    ctx.arc(0, -L.h * 0.04, L.h * 0.05, 0, TAU);
    ctx.fillStyle = rgba(p.shade, a(0.45 * dim));
    ctx.fill();
    ctx.restore();

    // The flame chamber, glowing through the belly of the dark glass, and a
    // little light escaping up the throat. Breathes with this lamp's flame.
    ctx.globalCompositeOperation = 'lighter';
    const g = L.glow * L.br;
    const bx = L.gx;
    const by = L.capY + L.h * 0.58;
    blob(bx, by, L.h * 0.34, L.h * 0.42, L.sw, p.accent, a(0.15 * g), 0.22);
    blob(bx, by, L.h * 0.16, L.h * 0.21, L.sw, p.sheen, a(0.16 * g), 0.3);
    blob(bx, by - L.h * 0.3, L.h * 0.09, L.h * 0.2, L.sw, p.accent, a(0.09 * g), 0.2);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------------
  // 6. DUST IN THE LIT AIR
  //
  // The smallest scale in the frame. Motes are near-invisible on their own;
  // what shows is their density where the light is, and the way each one
  // brightens as it crosses a shaft — the same geometry the shafts were
  // drawn from, so the brightening lands exactly where the columns are.
  // ---------------------------------------------------------------------
  ctx.globalCompositeOperation = 'lighter';
  const motes = Math.round((40 + 44 * D) * (gold ? 1.2 : 1));
  const moteSpan = H * 1.22;

  for (let i = 0; i < motes; i++) {
    const x0 = f.rnd(i, 131) * W;
    const seed = f.rnd(i, 137);
    const rad = 0.7 + f.rnd(i, 139) * 1.9;
    // Heat carries dust up, slowly and at differing rates.
    const y = H * 1.06 - wrap(seed * moteSpan + t * (5 + f.rnd(i, 141) * 7), moteSpan);
    const x = x0 + Math.sin(t * (0.2 + f.rnd(i, 143) * 0.24) + seed * 8) * 9;

    let al = 0.115 * (0.12 + litAt(x, y, 4.2));

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
  // 7. BOKEH, IN THREE RANKS
  //
  // Depth on a flat canvas comes from contrast BETWEEN ranks: far is small,
  // dense, dim and slow; middle sits at three times its radius; near is an
  // order of magnitude larger, faster, and there are only a handful. The
  // near rank is the dimmest per pixel and carries no rim — a big bright
  // orb close to the lens becomes a foreground object.
  // ---------------------------------------------------------------------
  const bokMul = gold ? 1.4 : 1;
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
    { n: Math.round(24 * D * bokMul), rMin: 2, rMax: 5, rate: 4, al: 0.075, sway: 7, salt: 11 },
    { n: Math.round(13 * D * bokMul), rMin: 7, rMax: 15, rate: 9, al: 0.05, sway: 14, salt: 37 },
    {
      n: Math.max(2, Math.round(4 * D * bokMul)),
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
    // leave above it, never popping into existence on an edge.
    const span = H * 1.36;
    const y0 = H * 1.12;

    for (let i = 0; i < rk.n; i++) {
      const s = rk.salt;
      const x0 = f.rnd(i, s) * W;
      const seed = f.rnd(i, s + 1);
      const rad = rk.rMin + f.rnd(i, s + 2) * (rk.rMax - rk.rMin);

      const y = y0 - wrap(seed * span + t * rk.rate, span);
      const prog = (y0 - y) / span;

      const x = x0 + Math.sin(t * (0.15 + f.rnd(i, s + 3) * 0.2) + seed * 8) * rk.sway;

      const fade = Math.min(1, prog / 0.16) * Math.pow(Math.max(0, 1 - prog), 1.1);
      if (fade <= 0.01) continue;

      const al = rk.al * fade * (0.4 + litAt(x, y, 3.2));
      if (al <= 0.004) continue;

      if (rk.near) {
        blob(x, y, rad, rad * 0.94, 0, p.accent, a(al * 0.9), 0.34);
        blob(x, y, rad * 0.6, rad * 0.58, 0, p.accent, a(al * 0.4), 0.3);
      } else {
        /**
         * The rim is what makes a circle read as *out of focus*: a defocused
         * point images as a disc with a brighter edge. Still a gradient
         * falling to zero past it — there is no edge to find.
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
  // 8. GILDED SHIMMER (mushaf-gold only)
  //
  // Tiny points of `sheen` hanging in the upper air, each holding its own
  // slow pulse — gold leaf catching lamplight. The pulse is `alive`-gated:
  // at speed 0 every point holds a fixed mid-value and nothing twinkles.
  // ---------------------------------------------------------------------
  if (gold) {
    for (let i = 0; i < 32; i++) {
      const seed = f.rnd(i, 151);
      const x = f.rnd(i, 152) * W + Math.sin(t * 0.09 + seed * TAU) * 5;
      const y = f.rnd(i, 153) * H * 0.72;
      const pulse = 0.5 + 0.5 * alive * Math.sin(t * (0.3 + seed * 0.3) + seed * TAU);
      const al = (0.028 + 0.05 * pulse) * (0.3 + litAt(x, y, 2.6));
      blob(x, y, 0.7 + seed * 1.5, 0.7 + seed * 1.5, 0, p.sheen, a(al), 0.3);
    }
  }

  // ---------------------------------------------------------------------
  // 9. SETTLE
  //
  // Back to normal compositing: everything below REMOVES light, and
  // `lighter` cannot subtract. This pass is what encloses the room.
  // ---------------------------------------------------------------------
  ctx.globalCompositeOperation = 'source-over';

  /**
   * Murk lying along the ground line — some of the room's own air put back
   * in FRONT of the additive light, so the orbs sit in the room rather than
   * on top of the picture. Each band fades to zero at both ends: a soft
   * tonal change across the horizon, never a rule.
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
   * Two vignettes, and both are needed. The first is anchored on the NEAR
   * LAMP's flame, which makes the darkness feel caused by the light's
   * falloff rather than applied as a filter. The second is anchored on the
   * canvas centre and guarantees all four corners even when the composition
   * hangs the lamps at an edge. `vigK` is the theme bias: the mushaf's
   * small room closes harder, the gold room breathes a little wider.
   */
  const vig = ctx.createRadialGradient(near.gx, near.gy, R * 0.1, near.gx, near.gy, R * 0.98);
  vig.addColorStop(0, rgba(p.shade, 0));
  vig.addColorStop(0.42, rgba(p.shade, a(0.06 * vigK)));
  vig.addColorStop(0.72, rgba(p.shade, a(0.2 * vigK)));
  vig.addColorStop(1, rgba(p.shade, a(0.44 * vigK)));
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
  corners.addColorStop(0.45, rgba(p.shade, a(0.07 * vigK)));
  corners.addColorStop(0.75, rgba(p.shade, a(0.19 * vigK)));
  corners.addColorStop(1, rgba(p.shade, a(0.34 * vigK)));
  ctx.fillStyle = corners;
  ctx.fillRect(0, 0, W, H);

  // Top scrim. Headers and titles live in the upper band, so it gets one
  // extra pass of quiet — and a dark ceiling above the lamps is true to the
  // room anyway; the chains dissolving up into it is part of the picture.
  const scrim = ctx.createLinearGradient(0, 0, 0, H * 0.36);
  scrim.addColorStop(0, rgba(p.shade, a(0.26)));
  scrim.addColorStop(0.45, rgba(p.shade, a(0.09)));
  scrim.addColorStop(1, rgba(p.shade, 0));
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H * 0.36);

  ctx.restore();

  // Belt and braces: the contract says a painter hands the context back
  // clean, and `restore()` only unwinds what this painter pushed — if a
  // caller ever enters with a dirty state, the next scene inherits it.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};
