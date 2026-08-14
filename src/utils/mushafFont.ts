/**
 * Whether a bundled face actually loaded.
 *
 * `document.fonts.check()` is the obvious API and the wrong one: it answers
 * "can these glyphs be drawn?", counting every fallback the engine would reach
 * for, so it returns true even when the requested face failed outright. That is
 * precisely the case we need to detect — Qur'anic text must render through the
 * Complex's own face and nothing else, so a face that failed to load is not a
 * cosmetic problem, it is the app quietly setting Qur'an in some other font.
 *
 * The FontFace objects registered from @font-face carry their own `status`
 * ('unloaded' | 'loading' | 'loaded' | 'error'), which answers the real
 * question. `load()` is called first because a declared-but-unused face sits at
 * 'unloaded' forever.
 */
export type FaceState = 'loaded' | 'failed' | 'unknown';

const findFaces = (family: string): FontFace[] => {
  const out: FontFace[] = [];
  try {
    document.fonts.forEach((face) => {
      // FontFace.family keeps the quotes it was declared with on some engines.
      if (face.family.replace(/["']/g, '') === family) out.push(face);
    });
  } catch {
    /* document.fonts is not iterable in very old engines */
  }
  return out;
};

export async function checkFace(family: string): Promise<FaceState> {
  const faces = findFaces(family);
  if (faces.length === 0) return 'unknown';

  await Promise.all(
    faces.map((face) =>
      face.status === 'loaded' || face.status === 'error'
        ? Promise.resolve()
        : face.load().catch(() => undefined),
    ),
  );

  if (faces.some((face) => face.status === 'loaded')) return 'loaded';
  if (faces.every((face) => face.status === 'error')) return 'failed';
  return 'unknown';
}

/** The private family name for a riwayah's mushaf face. */
export const mushafFamily = (warsh: boolean) =>
  warsh ? 'SVH Mushaf Warsh' : 'SVH Mushaf Hafs';

/**
 * Whether the engine actually places the harakat where the font says.
 *
 * WebKitGTK 2.46+ (the Skia rendering backend) does not apply HarfBuzz's GPOS
 * mark-attachment offsets for the KFGQPC faces. The marks are shaped — the
 * text and the glyph list are right — but they are painted at the baseline
 * instead of above the letter, where they disappear into the letterforms. The
 * mushaf then renders as bare consonants: an incomplete Qur'anic text, not a
 * cosmetic defect. WebKitGTK 2.44 paints them correctly, Blink (Windows) has
 * never been affected, and every path inside the broken engine — DOM, SVG and
 * canvas alike — is affected, so there is nothing to switch to. All the app
 * can do is notice and say so.
 *
 * The probe measures where ink actually lands. `لَّهِ` is lam + shadda +
 * fatha: the fatha rides on the shadda, so its ink sits far above the lam on a
 * correct engine and collapses onto it on a broken one. Measured at 64px:
 * Blink and WebKitGTK 2.44 put the topmost ink 1.22em above the baseline,
 * WebKitGTK 2.52 puts it at 0.92em. The 1.05em threshold sits in the middle of
 * that gap, and both riwayat measure identically, so one probe covers both.
 *
 * Canvas is used because it is the only way to see painted pixels, and it
 * fails in exactly the same way as the DOM here — which is what makes it a
 * faithful witness rather than a separate code path.
 */
export type HarakatState = 'ok' | 'broken' | 'unknown';

/* \u0644\u0651\u064E\u0647\u0650 (lam shadda fatha heh kasra) against \u0644\u0647
   (lam heh) — the same letters with the marks taken away. Spelled in escapes
   so no editor, formatter or normalisation pass can reorder or drop the very
   marks this probe exists to measure. */
const PROBE_MARKED = '\u0644\u0651\u064E\u0647\u0650';
const PROBE_BARE = '\u0644\u0647';
const PROBE_SIZE = 64;
/* How much higher the marked form's topmost ink must sit, in em. Measured in
   the app on both riwayat: a correct engine lifts it 0.34–0.45em, WebKitGTK
   2.52 lifts it 0.00–0.16em. 0.25 sits in the gap with margin on both sides.
   A difference is used rather than an absolute height because it cancels out
   everything that legitimately varies — face, riwayah, engine metrics — and
   leaves only the question asked: did the marks move up at all? */
const PROBE_MIN_RISE = 0.25;
// A family name no font can have, so canvas resolves it to the default face.
const ABSENT_FAMILY = 'SVH No Such Face 8f21';

export async function checkHarakat(family: string): Promise<HarakatState> {
  try {
    const size = PROBE_SIZE;
    const spec = `${size}px "${family}"`;

    /* Load the face FOR CANVAS before measuring. A FontFace can report
       'loaded' while a canvas naming it still paints in the default face, and
       the default face carries its marks high in their own outlines — so
       probing too early measures a font that was never in question and calls
       a perfectly good engine broken. This is the difference between a true
       reading and a false alarm on Windows. */
    try {
      await document.fonts.load(spec, PROBE_MARKED);
      await document.fonts.ready;
    } catch {
      /* no Font Loading API — the width guard below still protects us */
    }

    const width = size * 8;
    const height = size * 3;
    const baseline = size * 2;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 'unknown';

    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';

    /* Confirm canvas is really using the mushaf face and not a stand-in: the
       KFGQPC metrics differ from any default face, so equal advances mean the
       probe would be measuring the wrong font entirely. */
    ctx.font = spec;
    const mine = ctx.measureText(PROBE_MARKED).width;
    ctx.font = `${size}px "${ABSENT_FAMILY}"`;
    const other = ctx.measureText(PROBE_MARKED).width;
    if (!mine || Math.abs(mine - other) < 0.5) return 'unknown';

    const inkTop = (text: string): number | null => {
      ctx.font = spec;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#fff';
      ctx.fillText(text, width - size * 0.5, baseline);
      const data = ctx.getImageData(0, 0, width, height).data;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (data[(y * width + x) * 4 + 3] > 40) return (baseline - y) / size;
        }
      }
      return null;
    };

    const marked = inkTop(PROBE_MARKED);
    const bare = inkTop(PROBE_BARE);
    if (marked === null || bare === null) return 'unknown';
    return marked - bare >= PROBE_MIN_RISE ? 'ok' : 'broken';
  } catch {
    return 'unknown';
  }
}
