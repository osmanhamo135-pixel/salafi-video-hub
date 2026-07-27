import React, { useCallback, useEffect, useRef } from 'react';

/**
 * A two-pane grid with a draggable, keyboard-operable divider.
 *
 * Hand-rolled rather than react-resizable-panels: the pane is already a CSS
 * grid, so the entire feature is one custom property on the grid element and
 * a separator that writes it. A panel library would wrap both panes in its
 * own flex containers — and on the Quran route the right pane's descendants
 * carry the word-cue coordinate invariant (.quran-reading-surface must not
 * gain new positioned/scrolling ancestors), so the fewer wrappers around that
 * subtree, the fewer ways to silently break it. This adds ZERO wrappers:
 * the same grid, the same children, plus one divider element between them.
 *
 * Keyboard follows the WAI-ARIA window-splitter pattern: arrows nudge 16px,
 * Home/End jump to min/max, and the separator carries aria-valuenow.
 */
interface SplitGridProps {
  children: [React.ReactNode, React.ReactNode];
  storageKey: string;
  min?: number;
  max?: number;
  initial?: number;
  /** Grid classes for the collapsed (non-split) small-screen layout. */
  className?: string;
  /** Accessible name for the separator. */
  label: string;
}

export const SplitGrid: React.FC<SplitGridProps> = ({
  children,
  storageKey,
  min = 240,
  max = 480,
  initial = 320,
  className,
  label,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(initial);

  const clamp = useCallback(
    (w: number) => Math.min(max, Math.max(min, Math.round(w))),
    [min, max],
  );

  const apply = useCallback((w: number, persist: boolean) => {
    widthRef.current = w;
    gridRef.current?.style.setProperty('--split', `${w}px`);
    gridRef.current
      ?.querySelector<HTMLElement>('[role="separator"]')
      ?.setAttribute('aria-valuenow', String(w));
    if (persist) {
      try {
        localStorage.setItem(storageKey, String(w));
      } catch {
        /* private mode — the width just does not persist */
      }
    }
  }, [storageKey]);

  useEffect(() => {
    let w = initial;
    try {
      const stored = Number(localStorage.getItem(storageKey));
      if (Number.isFinite(stored) && stored > 0) w = stored;
    } catch {
      /* ignore */
    }
    apply(clamp(w), false);
  }, [apply, clamp, initial, storageKey]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widthRef.current;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      // The app's layout direction is pinned LTR (App.tsx sets root.dir='ltr'
      // in both languages), so the delta needs no RTL sign flip.
      apply(clamp(startW + (ev.clientX - startX)), false);
    };
    const up = () => {
      target.releasePointerCapture(e.pointerId);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      apply(widthRef.current, true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 16;
    let next: number | null = null;
    if (e.key === 'ArrowLeft') next = widthRef.current - step;
    else if (e.key === 'ArrowRight') next = widthRef.current + step;
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    if (next != null) {
      e.preventDefault();
      apply(clamp(next), true);
    }
  };

  return (
    <div
      ref={gridRef}
      className={className}
      style={{ ['--split' as string]: `${initial}px` }}
    >
      {children[0]}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={initial}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        className="split-handle"
      />
      {children[1]}
    </div>
  );
};
