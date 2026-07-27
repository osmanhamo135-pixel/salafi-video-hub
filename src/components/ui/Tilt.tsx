import React, { useCallback, useRef } from 'react';

/**
 * Pointer-tracked 3D tilt — the YouTube-trend card effect, done at desktop
 * cost. No library and no React state: pointermove writes two CSS custom
 * properties straight onto the element, CSS owns the transform, and a
 * transition eases the card back on leave. Transform-only, so every frame is
 * a composite; the backdrop-filter on a glass card never re-resolves.
 *
 * The shine is a radial highlight that follows the pointer through the same
 * two properties — one extra layer, zero extra JS.
 *
 * Never on the mushaf, the Basmala, or anything carrying Qur'anic text.
 */
export const Tilt: React.FC<{
  children: React.ReactNode;
  className?: string;
  /** Max tilt in degrees. Poster cards want ~7; the featured card ~4. */
  max?: number;
}> = ({ children, className, max = 7 }) => {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--tilt-rx', `${((0.5 - py) * 2 * max).toFixed(2)}deg`);
      el.style.setProperty('--tilt-ry', `${((px - 0.5) * 2 * max).toFixed(2)}deg`);
      el.style.setProperty('--shine-x', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--shine-y', `${(py * 100).toFixed(1)}%`);
    },
    [max],
  );

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--tilt-rx', '0deg');
    el.style.setProperty('--tilt-ry', '0deg');
  }, []);

  return (
    <div
      ref={ref}
      className={`tilt ${className ?? ''}`}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <div className="tilt-inner">
        {children}
        <div className="tilt-shine" aria-hidden="true" />
      </div>
    </div>
  );
};
