import { rgba, type ScenePainter, type SceneFrame } from './types';

/**
 * NIGHT — a monochrome sky, painted rather than drawn.
 *
 * The whole scene is four passes stacked back-to-front: a veil that deepens
 * the top of the frame, a milky band built from overlapping soft lobes, three
 * star fields at three depths, and a cool haze sitting on the horizon. Nothing
 * here is an object; every form is a gradient with no hard edge, because the
 * backing canvas is 768x448 and gets upscaled — a crisp shape becomes a
 * visibly resampled shape, while a gradient just gets softer.
 *
 * Depth is the point. A single star field over a flat wash reads as a texture
 * swatch; three fields at different sizes, brightnesses and drift rates read
 * as distance, and that is what makes the frame feel like a room with air in
 * it rather than a pattern behind text.
 */

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Hermite ease. Used everywhere a falloff must not show a seam. */
const smooth01 = (v: number): number => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};

/**
 * A soft elliptical blob: a radial gradient on the unit circle, squashed and
 * rotated into place.
 *
 * Every large form in this scene goes through here. Filling an ellipse path
 * with a flat colour would give a visible rim; filling a *scaled* radial
 * gradient means the edge is the gradient's own falloff, so a lobe of the
 * milky band, a star's halo and a diffraction spike are all the same
 * primitive at different aspect ratios. `core` controls how much of the blob
 * sits at full strength before the falloff starts — low values give a wide
 * atmospheric smear, high values give a compact glow.
 */
const softBlob = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  angle: number,
  triple: string,
  alpha: number,
  core: number,
): void => {
  if (alpha <= 0.001 || rx <= 0 || ry <= 0) return;
  ctx.save();
  ctx.translate(cx, cy);
  if (angle !== 0) ctx.rotate(angle);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, rgba(triple, alpha));
  g.addColorStop(core, rgba(triple, alpha * 0.42));
  g.addColorStop(1, rgba(triple, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

export const paintNight: ScenePainter = (f: SceneFrame) => {
  const { ctx, W, H, palette: p, comp } = f;

  /**
   * Local time. Every animated quantity below is a function of `t` and
   * nothing else, so `speed === 0` freezes the world exactly — no drift, no
   * twinkle, not even a sub-pixel wobble. The Qur'an reading route relies on
   * this: motion behind Qur'anic text is not allowed, and it switches motion
   * off by handing us speed 0 rather than by unmounting the scene.
   */
  const t = f.t * comp.speed;

  /**
   * The one place opacity is decided. `level` is the user's motion/dim
   * preference and `weight` is the section's own restraint; folding them into
   * a single factor here means no later line can accidentally paint at full
   * strength on a page that asked to be quiet.
   */
  const A = f.level * comp.weight;
  if (A <= 0.001) return;

  const hy = comp.horizon * H; // the world's ground line, in pixels
  const fx = comp.focusX * W;
  const fy = comp.focusY * H;
  const dens = clamp01(comp.density);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';

  /* ------------------------------------------------------------------ *
   * PASS 1 — the veil.
   *
   * A top-weighted wash of `shade` and a bottom lift of `soft`. Without it
   * the frame is uniformly the theme's page colour and the stars have
   * nothing to sit *in*: they read as specks on a flat plane. The vertical
   * ramp is what tells the eye the top of the frame is deep and the bottom
   * is near, before a single star is drawn. Kept very low contrast — this is
   * the room's air, not a backdrop panel.
   * ------------------------------------------------------------------ */
  const veil = ctx.createLinearGradient(0, 0, 0, H);
  veil.addColorStop(0, rgba(p.shade, 0.3 * A));
  veil.addColorStop(0.45, rgba(p.shade, 0.14 * A));
  veil.addColorStop(1, rgba(p.shade, 0.02 * A));
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, W, H);

  /* ------------------------------------------------------------------ *
   * PASS 2 — the milky band.
   *
   * Three overlapping lobes of different length, width and tilt rather than
   * one ellipse. A single ellipse always reads as an ellipse no matter how
   * soft its edge; the interference between three unequal lobes is what
   * produces the ragged, uneven spine a galaxy arm actually has. A fourth
   * lobe of `sheen` rides slightly off-axis so the band is not one flat
   * value across its width.
   *
   * The band is anchored between the frame centre and the composition's
   * focus, so a section that puts its light in a corner gets the band
   * leaning toward that corner instead of the same diagonal every time.
   * ------------------------------------------------------------------ */
  const bandX = W * 0.5 + (fx - W * 0.5) * 0.45;
  const bandY = H * 0.42 + (fy - H * 0.5) * 0.35;
  const tilt = -0.42 + (comp.focusY - 0.5) * 0.3; // gentle diagonal, focus-aware

  // Lobe geometry is authored, not random: these are the three overlapping
  // masses of the arm, and randomising them would make the band wander
  // between themes for no gain.
  softBlob(ctx, bandX - W * 0.16, bandY - H * 0.06, W * 0.62, H * 0.2, tilt, p.soft, 0.055 * A, 0.35);
  softBlob(ctx, bandX + W * 0.12, bandY + H * 0.05, W * 0.5, H * 0.12, tilt + 0.1, p.soft, 0.07 * A, 0.3);
  softBlob(ctx, bandX + W * 0.3, bandY + H * 0.12, W * 0.34, H * 0.26, tilt - 0.16, p.soft, 0.04 * A, 0.4);
  softBlob(ctx, bandX - W * 0.02, bandY - H * 0.01, W * 0.4, H * 0.07, tilt + 0.04, p.sheen, 0.05 * A, 0.25);

  /**
   * Atmospheric extinction.
   *
   * Real stars dim toward the ground line — there is more air in the way.
   * Reproducing that is what stops the star field from looking like a
   * wallpaper tile: it gives the sky a top and a bottom. It also keeps the
   * lower frame clear for the haze in pass 4, and stops bright points from
   * landing in the region where body text usually sits lowest.
   */
  const extinction = (y: number): number => {
    const ramp = smooth01((y - (hy - H * 0.62)) / (H * 0.62));
    const above = 1 - 0.88 * ramp;
    // Below the ground line the sky is not cut off — it just thins fast, so
    // there is never a hard edge where stars stop.
    return y > hy ? above * 0.3 : above;
  };

  /* ------------------------------------------------------------------ *
   * PASS 3 — three parallax star fields.
   *
   * far  : many, tiny, dim, barely moving — the depth of the sky.
   * mid  : the body of the field.
   * near : few, larger, brighter, drifting fastest — the layer that sells
   *        parallax, because the eye reads differential motion as distance.
   *
   * Drift rates differ per field on purpose. If all three moved together the
   * whole sky would slide as one flat sheet and the depth built in pass 2
   * would collapse. Each field wraps horizontally over a padded width so a
   * star leaving one edge re-enters the other without popping.
   *
   * Total is capped near 260 and scaled by density, which keeps the frame
   * inside the primitive budget even before the blooms are added.
   * ------------------------------------------------------------------ */
  const total = Math.round(260 * (0.35 + 0.65 * dens));

  interface Field {
    count: number;
    salt: number;
    size: number;
    alpha: number;
    drift: number; // px/sec; sign flips per field for counter-parallax
    twinkle: number; // depth of the alpha modulation, 0 = steady
    round: boolean; // arcs cost more, so only the near field gets them
  }

  const fields: Field[] = [
    { count: Math.round(total * 0.56), salt: 11.3, size: 0.85, alpha: 0.3, drift: 0.9, twinkle: 0.18, round: false },
    { count: Math.round(total * 0.3), salt: 27.9, size: 1.35, alpha: 0.46, drift: -2.1, twinkle: 0.3, round: false },
    { count: Math.round(total * 0.14), salt: 43.1, size: 2.3, alpha: 0.66, drift: 3.6, twinkle: 0.42, round: true },
  ];

  const pad = W + 40; // wrap width, with margin so nothing pops at the edges

  for (let fi = 0; fi < fields.length; fi++) {
    const fd = fields[fi];
    // One fillStyle per field, with per-star opacity carried on globalAlpha.
    // Building 260 colour strings per frame is the expensive way to do this.
    ctx.fillStyle = rgba(p.soft, 1);
    for (let i = 0; i < fd.count; i++) {
      const bx = f.rnd(i, fd.salt) * pad;
      const y = f.rnd(i, fd.salt + 1) * H;
      const ext = extinction(y);
      if (ext <= 0.02) continue;

      // Wrap. Double modulo because `drift` may be negative.
      const x = (((bx + t * fd.drift) % pad) + pad) % pad - 20;

      // Each star owns its twinkle phase and a slightly different rate, so
      // the field shimmers unevenly instead of pulsing in unison — a
      // synchronised field reads as a blinking UI element, which is exactly
      // what a background must never do.
      const phase = f.rnd(i, fd.salt + 2) * Math.PI * 2;
      const rate = 0.28 + f.rnd(i, fd.salt + 3) * 0.5;
      const tw = 1 - fd.twinkle + fd.twinkle * (0.5 + 0.5 * Math.sin(t * rate + phase));

      // Size jitter within the field keeps a depth band from looking stamped.
      const s = fd.size * (0.7 + f.rnd(i, fd.salt + 4) * 0.7);

      ctx.globalAlpha = clamp01(fd.alpha * A * ext * tw * (0.55 + f.rnd(i, fd.salt + 5) * 0.45));
      if (fd.round) {
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(x - s * 0.5, y - s * 0.5, s, s);
      }
    }
  }
  ctx.globalAlpha = 1;

  /* ------------------------------------------------------------------ *
   * PASS 4 — the bright few.
   *
   * Five stars get a halo and a faint diffraction cross. This is the pass
   * that makes the sky feel photographed: a real lens blooms on the brightest
   * points only, and a field where every star is the same size has no
   * hierarchy for the eye to rest on. Held to five, in `accent`, and kept
   * dim — six blooming stars would start competing with the page's own
   * content, which is the one thing a scene may not do.
   *
   * They are placed relative to the focus so the sky's brightest points and
   * the composition's light agree, then nudged apart by hash so they never
   * form a ring.
   * ------------------------------------------------------------------ */
  const blooms = 5;
  for (let i = 0; i < blooms; i++) {
    const ang = f.rnd(i, 77.4) * Math.PI * 2;
    const rad = 0.18 + f.rnd(i, 78.2) * 0.42;
    const bxp = fx + Math.cos(ang) * rad * W * 0.72;
    const byp = fy + Math.sin(ang) * rad * H * 0.6;
    if (bxp < -20 || bxp > W + 20) continue;

    const ext = extinction(byp);
    if (ext <= 0.08) continue;

    // Slow, shallow breathing — a bright star's scintillation is calmer than
    // a faint one's, so this rides at half the rate of the field twinkle.
    const phase = f.rnd(i, 79.6) * Math.PI * 2;
    const pulse = 0.82 + 0.18 * Math.sin(t * 0.22 + phase);
    const mag = (0.6 + f.rnd(i, 80.1) * 0.4) * ext * pulse;

    // Halo first, so the core sits inside its own glow.
    softBlob(ctx, bxp, byp, 22 * mag, 22 * mag, 0, p.accent, 0.12 * A * mag, 0.18);
    softBlob(ctx, bxp, byp, 8 * mag, 8 * mag, 0, p.accent, 0.22 * A * mag, 0.25);

    // Diffraction cross: two very flat blobs rather than two hairlines. A
    // 1px line would smear into a grey dash once the canvas is upscaled;
    // a squashed gradient stays soft at any scale.
    const spike = 34 * mag;
    softBlob(ctx, bxp, byp, spike, 1.1, 0, p.accent, 0.16 * A * mag, 0.12);
    softBlob(ctx, bxp, byp, spike * 0.62, 1.0, Math.PI / 2, p.accent, 0.13 * A * mag, 0.12);

    // The core itself, small and warm.
    ctx.fillStyle = rgba(p.accent, clamp01(0.5 * A * mag));
    ctx.beginPath();
    ctx.arc(bxp, byp, 1.5 * mag, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ------------------------------------------------------------------ *
   * PASS 5 — the horizon haze.
   *
   * Air near the ground scatters, so the bottom of a real night frame is
   * always lighter than the top. This band does that, and it does two jobs
   * beyond realism: it closes the composition (without it the star field
   * runs off the bottom edge and the frame has no floor), and it lifts the
   * region where the densest text usually sits, softening the contrast
   * between background and body copy.
   *
   * Cool tones — `turquoise` under `soft` — because a warm low band would
   * read as dusk, and this scene is night.
   * ------------------------------------------------------------------ */
  const hazeTop = Math.max(0, hy - H * 0.34);
  const hazeBottom = Math.min(H, hy + H * 0.3);
  if (hazeBottom > hazeTop) {
    const haze = ctx.createLinearGradient(0, hazeTop, 0, hazeBottom);
    haze.addColorStop(0, rgba(p.turquoise, 0));
    haze.addColorStop(0.6, rgba(p.turquoise, 0.07 * A));
    haze.addColorStop(1, rgba(p.turquoise, 0.12 * A));
    ctx.fillStyle = haze;
    ctx.fillRect(0, hazeTop, W, hazeBottom - hazeTop);
  }

  // A wide, very flat pool of light sitting on the ground line beneath the
  // focus — the glow of distance. It is what keeps the haze from reading as
  // a flat stripe: the band now has a centre and two dark ends.
  softBlob(ctx, fx, hy + H * 0.04, W * 0.72, H * 0.16, 0, p.soft, 0.09 * A, 0.28);
  softBlob(ctx, fx, hy + H * 0.1, W * 0.42, H * 0.08, 0, p.sheen, 0.06 * A, 0.22);

  // The lowest sliver goes back toward the theme's own page colour so the
  // scene sinks into the layout instead of ending at a visible boundary.
  const foot = ctx.createLinearGradient(0, H * 0.86, 0, H);
  foot.addColorStop(0, rgba(p.ground, 0));
  foot.addColorStop(1, rgba(p.ground, 0.22 * A));
  ctx.fillStyle = foot;
  ctx.fillRect(0, H * 0.86, W, H * 0.14);

  // Leave the context exactly as it was found: the next scene in the stack
  // inherits this ctx, and a stray globalAlpha here surfaces as an
  // unexplained fade over there.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
};
