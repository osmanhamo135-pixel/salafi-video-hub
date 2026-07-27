import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettingsStore } from '@/store/settingsStore';

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
type Field = 'motes' | 'stars' | 'ink' | 'clouds';

const THEME_TIER: Record<string, Tier> = {
  noor: 3,
  mushaf: 3,
  blue: 3,
  samaa: 3,
  emerald: 3,
  maktabah: 3,
  red: 2,
  onyx: 2,
  'mushaf-gold': 1,
  pearl: 1,
};

const THEME_FIELD: Record<string, Field> = {
  noor: 'motes',
  blue: 'stars',
  mushaf: 'ink',
  samaa: 'clouds',
  emerald: 'motes',
  maktabah: 'motes',
};

export const MOTION_KEY = 'salafi-hub.background-motion';

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Deterministic per-index pseudo-random so a re-mount draws the same field. */
const rnd = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

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
     reduced intensity. Off/reduced-motion/Performance Mode still mean flat. */
  const intensity = motion === 'full' ? 1 : 0.65;
  const ceiling: Tier = prefersReducedMotion() || performanceMode || motion === 'off' ? 0 : 3;

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

    const field: Field = THEME_FIELD[theme] ?? 'motes';
    let raf = 0;
    let last = 0;
    let t = 0;
    let stopped = false;

    const W = 480;
    const H = 280;
    canvas.width = W;
    canvas.height = H;

    const root = getComputedStyle(document.documentElement);
    const accent = root.getPropertyValue('--accent-gold-rgb').trim() || '236 195 102';
    const soft = root.getPropertyValue('--text-soft-rgb').trim() || '215 221 232';

    const draw = (now: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(draw);
      if (now - last < 33) return; // 30fps cap
      last = now;
      t += 0.016;

      ctx.clearRect(0, 0, W, H);

      if (field === 'motes') {
        for (let i = 0; i < 90; i += 1) {
          const speed = 4 + rnd(i, 1) * 9;
          const x = rnd(i, 2) * W + Math.sin(t * 0.3 + i) * 6;
          const y = ((rnd(i, 3) * H - t * speed) % H + H) % H;
          const r = 0.5 + rnd(i, 4) * 1.7;
          const tw = 0.5 + 0.5 * Math.sin(t * (0.6 + rnd(i, 5)) + i * 2.1);
          ctx.globalAlpha = (0.10 + 0.30 * tw) * intensity;
          ctx.fillStyle = `rgb(${accent})`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (field === 'stars') {
        for (let band = 0; band < 3; band += 1) {
          const drift = (band + 1) * 1.1;
          for (let i = 0; i < 60; i += 1) {
            const k = band * 60 + i;
            const x = ((rnd(k, 6) * W + t * drift) % W + W) % W;
            const y = rnd(k, 7) * H;
            const r = 0.35 + band * 0.28 + rnd(k, 8) * 0.5;
            const tw = 0.55 + 0.45 * Math.sin(t * (0.8 + rnd(k, 9) * 1.6) + k);
            ctx.globalAlpha = (0.10 + 0.34 * tw) * intensity;
            ctx.fillStyle = band === 2 ? `rgb(${accent})` : `rgb(${soft})`;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (field === 'ink') {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 7; i += 1) {
          const x = W * (0.15 + 0.7 * rnd(i, 10)) + Math.sin(t * 0.11 + i * 2.2) * 46;
          const y = H * (0.2 + 0.6 * rnd(i, 11)) + Math.cos(t * 0.09 + i * 1.7) * 30;
          const r = 60 + rnd(i, 12) * 80 + Math.sin(t * 0.13 + i) * 12;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgb(${accent} / ${0.10 * intensity})`);
          g.addColorStop(1, 'transparent');
          ctx.globalAlpha = 1;
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      } else {
        // clouds — big soft ellipses in the text-soft tone, drifting slowly
        for (let i = 0; i < 9; i += 1) {
          const x = ((rnd(i, 13) * (W + 200) + t * (2 + rnd(i, 14) * 2.4)) % (W + 200)) - 100;
          const y = H * (0.12 + 0.7 * rnd(i, 15));
          const rx = 70 + rnd(i, 16) * 90;
          const ry = rx * 0.34;
          const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
          g.addColorStop(0, `rgb(${soft} / ${0.085 * intensity})`);
          g.addColorStop(1, 'transparent');
          ctx.globalAlpha = 1;
          ctx.fillStyle = g;
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(1, ry / rx);
          ctx.beginPath();
          ctx.arc(0, 0, rx, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
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
    <div
      className="ambient-layer"
      data-tier={tier}
      data-theme-field={THEME_FIELD[theme] ?? ''}
      aria-hidden="true"
    >
      <div className="ambient-wash" />
      {tier >= 2 && <div className="ambient-sweep" />}
      {tier >= 3 && <canvas ref={canvasRef} className="ambient-canvas" />}
    </div>
  );
};
