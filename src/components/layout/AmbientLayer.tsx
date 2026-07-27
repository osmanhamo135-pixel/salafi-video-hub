import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettingsStore } from '@/store/settingsStore';
import { compositionFor, painterFor, readPalette } from './scenes';
import { rnd, SceneComposition, ScenePalette } from './scenes/types';

/**
 * The per-theme ambient ground — the drama pass.
 *
 * The first version of this layer was dialled to near-invisibility: canvas at
 * 0.5 opacity over 6%-luminance washes, and the default "subtle" ceiling cut
 * the canvas fields off entirely, so most themes showed a faint static
 * gradient and nothing else. Technically correct, visually absent. This
 * version gives every dark theme a DISTINCT, visible generated field:
 *
 *   noor         gold dust motes, twinkling, drifting up
 *   blue         a three-band parallax starfield
 *   mushaf       ink diffusion — soft blobs breathing over near-black
 *   samaa        a drifting cloud field
 *   emerald      motes (recoloured by the theme's own accent token)
 *   maktabah     motes, warm and sparse
 *   red / onyx   the CSS light sweep (a particle field fights their restraint)
 *   mushaf-gold  static illuminated ground (tier 1)
 *   pearl        static paper ground (tier 1 — the light theme never moves)
 *
 * What did NOT change, because it was right: min(theme, capability,
 * preference) tier resolution; reduced-motion and Performance Mode force flat;
 * blur and video playback pause the loop; the canvas renders small and
 * upscales; nothing restarts on navigation; and the Qur'an route is clamped to
 * tier <= 1 IN THE RESOLVER now, not just in CSS — the old display:none hid
 * the canvas but left rAF drawing into it concurrently with word-sync
 * measurement.
 */

type Tier = 0 | 1 | 2 | 3;
type Motion = 'off' | 'subtle' | 'full';

/* Every theme now reaches tier 3, and that is a change of principle rather
   than of numbers. The tier used to encode "this theme is too restrained for
   a canvas" — onyx and mushaf-gold sat at 2, pearl at 1 — which meant three
   of the ten themes could never paint a scene at all. Restraint now lives in
   the PAINTER: onyx paints a quiet night, pearl paints laid paper that barely
   moves. A theme's character belongs in its own world, not in a cap that
   denies it one. The ceiling below still drops everything to a still tier 1
   for reduced motion, Performance Mode and the off switch. */
const THEME_TIER: Record<string, Tier> = {
  noor: 3,
  mushaf: 3,
  blue: 3,
  samaa: 3,
  emerald: 3,
  maktabah: 3,
  red: 3,
  onyx: 3,
  'mushaf-gold': 3,
  pearl: 3,
};

export const MOTION_KEY = 'salafi-hub.background-motion';

/* How much of the canvas field each section gets. The dashboard is the stage;
   content-dense and task-focused routes pull the particles back so the work,
   not the weather, holds the eye. Read through a ref each frame so navigation
   never restarts the field — the particles dim, they do not blink. */
const ROUTE_FIELD_DIM: Record<string, number> = {
  dashboard: 1,
  library: 0.85,
  watch: 0.7,
  radio: 0.9,
  reminders: 0.9,
  downloads: 0.75,
  settings: 0.6,
  player: 0.4,
};

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const AmbientLayer: React.FC = () => {
  const theme = useSettingsStore((s) => s.settings?.theme ?? 'noor');
  const performanceMode = useSettingsStore((s) => s.settings?.performanceMode ?? false);
  const location = useLocation();

  const motion: Motion = (() => {
    try {
      const v = localStorage.getItem(MOTION_KEY);
      return v === 'off' || v === 'subtle' || v === 'full' ? v : 'subtle';
    } catch {
      return 'subtle';
    }
  })();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [awake, setAwake] = useState(true);

  const routeSlug =
    location.pathname === '/' ? 'dashboard' : location.pathname.replace(/^\//, '').split('/')[0];
  const fieldDimRef = useRef(1);
  fieldDimRef.current = ROUTE_FIELD_DIM[routeSlug] ?? 0.8;

  /* Read per frame, never in the effect's dependency list: a route change must
     re-frame the scene, not restart it. */
  const compRef = useRef<SceneComposition>(compositionFor(theme, routeSlug));
  compRef.current = compositionFor(theme, routeSlug);

  useEffect(() => {
    const sleep = () => setAwake(false);
    const wake = () =>
      setAwake(document.visibilityState === 'visible' && !document.querySelector('video:not([paused])'));
    const onVisibility = () => (document.visibilityState === 'visible' ? wake() : sleep());
    window.addEventListener('blur', sleep);
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('play', sleep, true);
    document.addEventListener('pause', wake, true);
    document.addEventListener('ended', wake, true);
    return () => {
      window.removeEventListener('blur', sleep);
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('play', sleep, true);
      document.removeEventListener('pause', wake, true);
      document.removeEventListener('ended', wake, true);
    };
  }, []);

  /* "Subtle" no longer amputates the field — it plays the same generator at
     reduced intensity. Off/reduced-motion/Performance Mode still mean flat.
     0.8, not 0.65: subtle is the DEFAULT, so it is the intensity most
     installs actually see, and at 0.65 the owner's word for it was still
     "void". Subtle now means calmer, not fainter. */
  const intensity = motion === 'full' ? 1 : 0.8;
  /* Ceiling 1, never 0. Reduced motion, Performance Mode and the "off"
     toggle all mean NO MOVEMENT — they must not mean no room. Windows'
     "animation effects" switch surfaces here as prefers-reduced-motion, and
     with the old ceiling of 0 that one OS setting erased every theme's
     ground entirely: the owner's machine showed the void the harness could
     not reproduce. Tier 1 is the static scene + lattice with every
     animation dead, which is the contract those three switches actually
     promise. */
  const ceiling: Tier = prefersReducedMotion() || performanceMode || motion === 'off' ? 1 : 3;

  /* The mushaf clamp lives here, in the resolver, so the loop does not run at
     all on /quran — display:none only hides the pixels, not the work. */
  const onQuran = location.pathname === '/quran';
  const tier = Math.min(THEME_TIER[theme] ?? 1, ceiling, onQuran ? 1 : 3) as Tier;

  useEffect(() => {
    if (tier < 3 || !awake) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    /* The theme picks the world; the section only shapes it. So the painter is
       bound once here, while the composition is read from a ref every frame —
       navigating re-frames the same sky rather than tearing it down and
       building a new one.

       The PALETTE, though, cannot be read here, and that is not a style
       preference — it is an effect-ordering bug that cost a whole review
       cycle. This component is a child of App, and React runs child effects
       BEFORE parent effects, so at this point App has not yet written the new
       value to html[data-theme]: getComputedStyle would hand back the
       OUTGOING theme's tokens. Sakinah Blue painted a teal sky for exactly
       this reason. So the palette is resolved on the first animation frame
       (rAF runs after style application) and re-resolved whenever the
       document's theme attribute changes underneath us. */
    const paint = painterFor(theme);
    let palette: ScenePalette | null = null;
    let paletteTheme = '';

    let raf = 0;
    let last = 0;
    let t = 0;
    let stopped = false;

    /* 768x448, up from 480x280. At 480 wide the upscale to a 2560px window
       was ~5.3x — every mote smeared into a faint blur, which is why the
       fields "worked" in the 1280px harness and vanished on the owner's real
       display. ~3.3x keeps the scene readable at desktop sizes while the
       draw loop stays trivially cheap. */
    const W = 768;
    const H = 448;
    canvas.width = W;
    canvas.height = H;

    const draw = (now: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(draw);
      if (now - last < 33) return; // 30fps cap
      last = now;
      t += 0.016;

      const domTheme = document.documentElement.dataset.theme || '';
      if (!palette || domTheme !== paletteTheme) {
        palette = readPalette();
        paletteTheme = domTheme;
      }

      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      paint({
        ctx,
        W,
        H,
        t,
        level: intensity * fieldDimRef.current,
        palette,
        comp: compRef.current,
        rnd,
      });
      /* A painter that forgot to reset state must not corrupt the next frame
         or the next scene. Cheap insurance, once per frame. */
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    raf = requestAnimationFrame(draw);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [tier, theme, awake]);

  return (
    <div
      className="ambient-layer"
      data-tier={tier}
      aria-hidden="true"
    >
      <div className="ambient-wash" />
      {/* The per-theme scene: the layer that stops the ground being a void.
          Pure CSS, transform/opacity only; its recipe comes from
          html[data-theme] so all ten themes carry their own weather. At tier 1
          it stands still; at 0 it is absent. The lattice is the geometric
          structure under the light — same tier rules. */}
      {tier >= 1 && <div className="ambient-lattice" />}
      {tier >= 1 && <div className="ambient-scene" />}
      {tier >= 2 && <div className="ambient-sweep" />}
      {tier >= 3 && <canvas ref={canvasRef} className="ambient-canvas" />}
    </div>
  );
};
