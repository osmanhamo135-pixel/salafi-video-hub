import React from 'react';
import { useI18n } from '@/i18n';
// Outlined paths from the bundled font, in two groups so the harakat can take
// the theme accent. See scripts/build-basmala-svg.py.
import basmalaSvg from '@/assets/marks/basmala.svg?raw';
import noorSvg from '@/assets/marks/noor.svg?raw';

const BASMALA_TEXT = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';

/**
 * The home hero. Five layers: procedural ground, khatam geometry, the mihrab
 * arch (used exactly once in the app), scrim, and content.
 *
 * Every colour comes from the active theme's tokens, so the hero re-colours
 * itself correctly in all themes with no per-theme code. The background is
 * generated rather than photographic: it costs no bytes, cannot fail to load,
 * and by construction contains no depiction of animate beings.
 *
 * The Basmala is the hero's subject, not decoration — rendered complete and
 * static at full size, never clipped, never behind a control, and never
 * restyled. The warm light sits in the background layer behind it, never as a
 * shadow on the glyph itself.
 */
export const Hero: React.FC = () => {
  const { t } = useI18n();

  return (
    /* The hero already dissolves into the page through .hero-fade, so the old
       24px margin on top of that read as a gap rather than a hand-off; the
       masthead's own top margin carries the separation now. */
    <section className="hero mb-1">
      {/* Every paint layer lives inside .hero-clip, which owns the rounded
          clip. .hero itself must stay overflow:visible — it is an ancestor of
          .hero-basmala, and Qur'anic text is never clipped. */}
      <div className="hero-clip" aria-hidden="true">
        <div className="hero-ground" />
        {/* The shelf scene is gone. Its three depth bands were composed for a
            400px+ room; cropped to a 120px band they read as dark rectangles
            with visible seams. At this scale the ground's key light and the
            girih are the whole picture. */}
        <div className="hero-girih" />
        <div className="hero-arch" />
        <div className="hero-scrim" />
      </div>

      <div className="hero-inner">
        {/* The verse is announced in full to assistive tech; the inline SVG
            itself is aria-hidden so the paths are never read out. */}
        <div
          className="hero-basmala"
          role="img"
          aria-label={`${BASMALA_TEXT} — ${t('heroBasmalaMeaning')}`}
          dangerouslySetInnerHTML={{ __html: basmalaSvg }}
        />

        {/* The نور mark, on the same two-group system as the Basmala:
            letterforms take the text colour, the i'jam takes the theme accent. */}
        <div
          className="hero-mark"
          role="img"
          aria-label={t('heroMarkLabel')}
          dangerouslySetInnerHTML={{ __html: noorSvg }}
        />


      </div>

      <div className="hero-fade" aria-hidden="true" />
    </section>
  );
};
