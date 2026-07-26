import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Radio } from 'lucide-react';
import { useQuranStore } from '@/store/quranStore';
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
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const lastRead = useQuranStore((state) => state.lastRead);
  const surahs = useQuranStore((state) => state.surahs);
  const openSurah = useQuranStore((state) => state.openSurah);

  const lastSurah = lastRead ? surahs.find((surah) => surah.id === lastRead.surahId) : undefined;
  const lastSurahName = lastSurah
    ? language === 'ar'
      ? lastSurah.name
      : lastSurah.transliteration
    : null;

  const openMushaf = () => navigate('/quran');

  const continueReading = () => {
    if (lastRead) void openSurah(lastRead.surahId);
    navigate('/quran');
  };

  return (
    <section className="hero mb-6">
      <div className="hero-ground" aria-hidden="true" />
      {/* Three depth bands of one room: pitch converges and blur increases with
          distance from the key light. Separate elements rather than clipped
          pseudo-elements so each can carry its own soft-edged mask — a hard
          clip left a visible vertical seam where the bands met. */}
      <div className="hero-scene" aria-hidden="true">
        <div className="hero-band hero-band-near" />
        <div className="hero-band hero-band-mid" />
        <div className="hero-band hero-band-far" />
      </div>
      <div className="hero-girih" aria-hidden="true" />
      <div className="hero-arch" aria-hidden="true" />
      <div className="hero-scrim" aria-hidden="true" />

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

        <h1 className="hero-wordmark">
          {language === 'ar' ? (
            'سلفي هَب'
          ) : (
            <span className="hero-wordmark-latin">Salafi Hub</span>
          )}
        </h1>

        <p className="hero-purpose">{t('heroPurpose')}</p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={openMushaf} className="btn-primary px-5 py-2.5 text-sm">
            <BookOpen className="h-4 w-4" />
            {t('heroOpenMushaf')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/radio')}
            className="btn-secondary px-5 py-2.5 text-sm"
          >
            <Radio className="h-4 w-4" />
            {t('heroRadio')}
          </button>
        </div>

        {lastRead && lastSurahName && (
          <button
            type="button"
            onClick={continueReading}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-[11px] text-muted-text transition-colors hover:text-text-primary"
          >
            {t('heroContinue')}
            <span className="font-medium text-text-primary">
              {lastSurahName} · {t('quranAyah')} {lastRead.verseId}
            </span>
          </button>
        )}
      </div>

      <div className="hero-fade" aria-hidden="true" />
    </section>
  );
};
