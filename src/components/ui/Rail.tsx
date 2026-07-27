import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n';

/**
 * A horizontal rail of cards with snap, edge fades, and keyboard paging.
 *
 * This is the density the app was missing. A library reads as a library when
 * it shows rows of real things at a locked ratio; four numbers and one card
 * read as a settings screen with a picture on it.
 *
 * Built on native overflow plus CSS scroll-snap rather than a carousel
 * library: a carousel imposes its own layout and its own idea of a "slide",
 * and everything wanted here — snap points, momentum, RTL, and the scrollbar
 * staying out of the layout — is already in the platform.
 *
 * RTL is the part that usually breaks. `scrollLeft` is negative-going in RTL
 * in Chromium, so paging is done with `scrollBy` and a signed delta rather
 * than by computing absolute offsets, and the chevrons swap by logical
 * property rather than by a `language === 'ar'` branch at each call site.
 */
interface RailProps {
  children: React.ReactNode;
  /** Accessible name for the scroll region — a rail without one is a div. */
  label: string;
  className?: string;
}

export const Rail: React.FC<RailProps> = ({ children, label, className }) => {
  const { t, language } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // abs() because RTL reports scrollLeft as <= 0 in Chromium.
    const x = Math.abs(el.scrollLeft);
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(x < 4);
    setAtEnd(max - x < 4);
  }, []);

  useEffect(() => {
    sync();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sync, children]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const rtl = language === 'ar';
    const amount = el.clientWidth * 0.85 * dir * (rtl ? -1 : 1);
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <div className={`rail ${className ?? ''}`}>
      <div
        ref={ref}
        onScroll={sync}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="rail-track"
      >
        {children}
      </div>

      {/* Edge fades tell the eye there is more without spending a control on
          it. Hidden at the ends so the rail does not look permanently cut. */}
      <div className="rail-fade rail-fade-start" data-hidden={atStart} aria-hidden="true" />
      <div className="rail-fade rail-fade-end" data-hidden={atEnd} aria-hidden="true" />

      <button
        type="button"
        onClick={() => page(-1)}
        disabled={atStart}
        aria-label={t('railPrevious')}
        className="rail-nav rail-nav-start"
      >
        <ChevronLeft className="h-4 w-4 rtl:hidden" />
        <ChevronRight className="hidden h-4 w-4 rtl:block" />
      </button>
      <button
        type="button"
        onClick={() => page(1)}
        disabled={atEnd}
        aria-label={t('railNext')}
        className="rail-nav rail-nav-end"
      >
        <ChevronRight className="h-4 w-4 rtl:hidden" />
        <ChevronLeft className="hidden h-4 w-4 rtl:block" />
      </button>
    </div>
  );
};
