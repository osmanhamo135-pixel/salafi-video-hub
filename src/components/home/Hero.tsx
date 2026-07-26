import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Radio } from 'lucide-react';
import { useQuranStore } from '@/store/quranStore';
import { useI18n } from '@/i18n';

const BASMALA_LIGATURE = '﷽';
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
      <div className="hero-scene" aria-hidden="true" />
      <div className="hero-girih" aria-hidden="true" />
      <div className="hero-arch" aria-hidden="true" />
      <div className="hero-scrim" aria-hidden="true" />

      <div className="hero-inner">
        <p className="hero-basmala" role="img" aria-label={`${BASMALA_TEXT} — ${t('heroBasmalaMeaning')}`}>
          {BASMALA_LIGATURE}
        </p>

        {/* The نور mark, on the same two-group system as the Basmala:
            strokes take the text colour, the accent detail takes the theme
            accent. Swaps to the supplied vector without markup changes. */}
        <p className="hero-mark" role="img" aria-label={t('heroMarkLabel')}>
          نور
        </p>

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
