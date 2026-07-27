import React, { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * The per-theme ambient ground.
 *
 * This is the manhaj-safe answer to the animated-background galleries. Every
 * concept that survived the reference filter — starfield, drifting motes, slow
 * light sweep, noise flow — turned out to be the set that needs no image asset
 * at all, because none of them depicts anything. That is not a coincidence:
 * what makes a background safe here (no subject) is exactly what makes it
 * cheap to generate. So it ships as ~40 lines of canvas rather than as
 * megabytes of licensed video, and it re-colours from theme tokens for free.
 *
 * Four tiers, resolved as min(themeDefault, capability, userPreference):
 *   0 flat    — the token gradient, zero cost
 *   1 static  — one generated pattern, no motion
 *   2 css     — compositor-only drift
 *   3 canvas  — particle/starfield, rAF, capped at 30fps
 *
 * Hard rules enforced here rather than trusted to call sites:
 *   - prefers-reduced-motion forces tier 0, globally, no exception
 *   - Performance Mode forces tier 0
 *   - window blur pauses the loop; a background app must cost nothing
 *   - video playback pauses the loop
 *   - the mushaf reading surface never gets motion behind it — the Quran route
 *     is clamped to tier <= 1 regardless of theme (see resolveTier)
 *
 * It is mounted once in AppShell, outside the router, so navigation cannot
 * remount it. A background that restarts on every route change is the tell of
 * a cheap implementation.
 */

type Tier = 0 | 1 | 2 | 3;
type Motion = 'off' | 'subtle' | 'full';

/** Per-theme ceiling. Light and pure-black themes stay quiet by design. */
const THEME_TIER: Record<string, Tier> = {
  noor: 3,          // gold dust motes in a teal depth field
  mushaf: 3,        // ink diffusion over near-black
  blue: 3,          // starfield, slow parallax
  emerald: 2,
  red: 2,
  onyx: 2,          // one slow gold arc — the most disciplined of the set
  'mushaf-gold': 1,
  maktabah: 2,
  samaa: 2,
  pearl: 1,         // the only light theme: static grain, never motion
};

/** Which generator a tier-3 theme draws. */
const THEME_FIELD: Record<string, 'motes' | 'stars' | 'ink'> = {
  noor: 'motes',
  blue: 'stars',
  mushaf: 'ink',
};

export const MOTION_KEY = 'salafi-hub.background-motion';

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const AmbientLayer: React.FC = () => {
  const theme = useSettingsStore((s) => s.settings?.theme ?? 'noor');
  const performanceMode = useSettingsStore((s) => s.settings?.performanceMode ?? false);

  /* Kept in localStorage rather than in the Rust settings row on purpose: it
     is a pure presentation preference, and adding a column would mean a schema
     migration, a new command, and a round trip on a path that has none today. */
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

  /* Pause on blur and on video playback. Both are the same requirement: the
     app must not spend a frame on atmosphere while it is either invisible or
     busy with something the user is actually watching. */
  useEffect(() => {
    const sleep = () => setAwake(false);
    const wake = () => setAwake(document.visibilityState === 'visible' && !document.querySelector('video:not([paused])'));
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

  const ceiling: Tier =
    prefersReducedMotion() || performanceMode || motion === 'off'
      ? 0
      : motion === 'subtle'
        ? 2
        : 3;

  const tier = Math.min(THEME_TIER[theme] ?? 1, ceiling) as Tier;

  useEffect(() => {
    if (tier < 3 || !awake) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const field = THEME_FIELD[theme] ?? 'motes';
    let raf = 0;
    let last = 0;
    let stopped = false;

    /* The canvas is deliberately rendered small and scaled up by CSS. A
       full-resolution animated surface is the single most reliable way to tank
       a WebView's frame rate, and at 6% luminance behind glass nobody can tell
       the difference. This also keeps the backing store trivial rather than
       the ~17MB a 1080p buffer would cost. */
    const W = 320;
    const H = 200;
    canvas.width = W;
    canvas.height = H;

    /* Colour comes from the theme's own token, read once, so ten themes need
       zero per-theme JS. */
    const root = getComputedStyle(document.documentElement);
    const accent = root.getPropertyValue('--accent-gold-rgb').trim() || '236 195 102';

    const N = field === 'stars' ? 90 : 54;
    const parts = Array.from({ length: N }, (_, i) => ({
      x: ((i * 97) % 100) / 100 * W,
      y: ((i * 61) % 100) / 100 * H,
      r: field === 'stars' ? 0.4 + ((i * 13) % 7) / 10 : 0.6 + ((i * 17) % 9) / 8,
      s: 0.02 + ((i * 23) % 11) / 900,
      a: 0.10 + ((i * 31) % 20) / 130,
    }));

    const draw = (now: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(draw);
      // 30fps cap — halves GPU cost, imperceptible on a blurred ground.
      if (now - last < 33) return;
      last = now;

      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.y -= p.s;
        if (p.y < -2) p.y = H + 2;
        ctx.globalAlpha = p.a;
        ctx.fillStyle = `rgb(${accent})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    raf = requestAnimationFrame(draw);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [tier, theme, awake]);

  return (
    <div className="ambient-layer" data-tier={tier} data-theme-field={THEME_FIELD[theme] ?? ''} aria-hidden="true">
      <div className="ambient-wash" />
      {tier >= 2 && <div className="ambient-sweep" />}
      {tier >= 3 && <canvas ref={canvasRef} className="ambient-canvas" />}
    </div>
  );
};
