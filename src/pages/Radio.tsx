import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Pause, Play, RadioTower, RefreshCw, Search, Star, Wifi } from 'lucide-react';
import { RadioStation, useRadioStore } from '@/store/radioStore';
import { SectionHead } from '@/components/ui/SectionHead';
import { useI18n } from '@/i18n';

/**
 * The station's initial, set in a hairline ring. A station list has no
 * artwork — and cannot have any, since no depiction of animate beings is
 * permitted anywhere in this app — so the letter IS the station's mark. It
 * gives each row something to recognise it by at a glance, which is the
 * difference between tuning a set and reading a settings list.
 *
 * Takes the first character of the name in its own script: Arabic names get an
 * Arabic letter, Latin names a Latin one.
 */
const stationInitial = (name: string) => {
  const trimmed = name.trim();
  // Iterate by code point, not by index: a name starting outside the BMP would
  // otherwise render as half a surrogate pair.
  for (const character of trimmed) {
    if (/\p{L}|\p{N}/u.test(character)) return character;
  }
  return trimmed.slice(0, 1);
};

/**
 * A broadcast level meter: three bars, offset so they do not move together.
 * Not an ornament — it is the only thing on the page that says a stream is
 * actually live right now.
 *
 * Under `prefers-reduced-motion` the global rule in index.css collapses the
 * animation to a single 0.01ms iteration, so the bars are simply static rather
 * than merely slower.
 */
const SignalBars: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span aria-hidden="true" className={`flex items-end gap-[2px] ${className}`}>
    {[0.55, 1, 0.75].map((scale, index) => (
      <span
        key={index}
        className="w-[2px] animate-pulse rounded-full bg-current"
        style={{ height: `${scale * 100}%`, animationDelay: `${index * 180}ms` }}
      />
    ))}
  </span>
);

export const Radio: React.FC = () => {
  const { t, language } = useI18n();
  const stations = useRadioStore((state) => state.stations);
  const loading = useRadioStore((state) => state.loading);
  const loadError = useRadioStore((state) => state.loadError);
  const favorites = useRadioStore((state) => state.favorites);
  const loadStations = useRadioStore((state) => state.loadStations);
  const current = useRadioStore((state) => state.current);
  const playing = useRadioStore((state) => state.playing);
  const togglePlay = useRadioStore((state) => state.togglePlay);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void loadStations(language === 'ar' ? 'ar' : 'eng');
  }, [language, loadStations]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      normalizedQuery
        ? stations.filter((station) => station.name.toLowerCase().includes(normalizedQuery))
        : stations,
    [stations, normalizedQuery],
  );

  const favoriteStations = filtered.filter((station) => favorites.includes(station.id));
  const otherStations = filtered.filter((station) => !favorites.includes(station.id));
  // Only a station from THIS list gets the dial. The audio element is shared
  // with the Qur'an page's synced recitation, so `current` is frequently a
  // surah, and announcing "Al-Kahf · Alafasy" as a live radio station on the
  // Radio page would simply be wrong.
  const onAir = current ? stations.find((station) => station.id === current.id) ?? null : null;

  return (
    <div className="page-container">
      <div className="content-max-width">
        <div className="mb-5">
          <div className="premium-pill mb-2">
            <RadioTower className="h-3.5 w-3.5" />
            {t('radioPill')}
          </div>
          <h1 className="text-3xl font-semibold tracking-normal text-text-primary">{t('radioTitle')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-text">{t('radioSubtitle')}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-text">
            <Wifi className="h-3.5 w-3.5" />
            {t('radioOnlineNote')}
          </p>
        </div>

        {/* Everything below the masthead is held to a set measure. A station
            name is a short string; run at the page's full 1600px the list read
            as four hairlines crossing an empty screen, with the favourite star
            so far from the name they looked unrelated. */}
        <div className="max-w-5xl">
        {/* The dial readout. A tuner tells you what it is receiving in larger
            type than the list of what it could receive; without it the page was
            four rows with no sense of anything being tuned at all. */}
        {onAir && (
          <div className="mb-5 flex items-center gap-4 border-y border-border py-4">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-accent-gold/35 text-accent-gold"
            >
              {playing ? <SignalBars className="h-4" /> : <RadioTower className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              {/* "Live" only while the stream is actually running. A paused or
                  failed stream announcing itself as live is a lie the rest of
                  the page then has to argue with. */}
              {playing && (
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-accent-gold">
                  <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                  {t('radioLive')}
                </p>
              )}
              <p className="mt-0.5 truncate text-xl font-medium text-text-primary" title={onAir.name}>
                <bdi>{onAir.name}</bdi>
              </p>
            </div>
            <button
              type="button"
              onClick={togglePlay}
              title={playing ? t('pause') : t('play')}
              aria-label={playing ? t('pause') : t('play')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent-gold/40 text-accent-gold transition-colors hover:border-accent-gold hover:bg-accent-gold/10 motion-reduce:transition-none"
            >
              {playing ? (
                <Pause className="h-4 w-4" fill="currentColor" />
              ) : (
                <Play className="h-4 w-4" fill="currentColor" />
              )}
            </button>
          </div>
        )}

        <div className="mb-5">
          <div className="relative">
            <Search className="pointer-events-none absolute start-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('radioSearchPlaceholder')}
              className="field-quiet ps-7 text-sm"
            />
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-3 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-text" />
            <p className="text-sm text-muted-text">{t('radioLoading')}</p>
          </div>
        )}

        {loadError && !loading && (
          <div className="empty-panel px-6 py-12 text-center">
            <AlertTriangle className="mx-auto mb-2 h-7 w-7 text-warning-orange" />
            <p className="text-sm text-text-primary">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadStations(language === 'ar' ? 'ar' : 'eng')}
              disabled={loading}
              className="btn-secondary mx-auto mt-4 px-4 py-2 text-xs disabled:opacity-60"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('retry')}
            </button>
          </div>
        )}

        {!loading && !loadError && (
          <>
            {favoriteStations.length > 0 && (
              <StationSection title={t('favorites')} stations={favoriteStations} />
            )}
            <StationSection
              title={t('radioAllStations')}
              stations={otherStations}
              emptyLabel={filtered.length === 0 ? t('radioNoStations') : undefined}
            />
          </>
        )}
        </div>
      </div>
    </div>
  );
};

const StationSection: React.FC<{
  title: string;
  stations: RadioStation[];
  emptyLabel?: string;
}> = ({ title, stations, emptyLabel }) => {
  if (stations.length === 0 && !emptyLabel) return null;

  return (
    <section className="reveal mb-8">
      <SectionHead className="mb-1" title={title} meta={<bdi>{stations.length}</bdi>} />
      {stations.length === 0 ? (
        <div className="empty-panel mt-3 px-6 py-12 text-center">
          <p className="text-sm text-muted-text">{emptyLabel}</p>
        </div>
      ) : (
        // Two columns from `lg` up — no more. Three left a dangling hairline
        // under the last row wherever the station count is not a multiple of
        // three, which reads as a broken ledger.
        <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-2">
          {stations.map((station) => (
            <StationCard key={station.id} station={station} />
          ))}
        </div>
      )}
    </section>
  );
};

const StationCard: React.FC<{ station: RadioStation }> = React.memo(({ station }) => {
  const { t } = useI18n();
  const current = useRadioStore((state) => state.current);
  const playing = useRadioStore((state) => state.playing);
  const favorites = useRadioStore((state) => state.favorites);
  const play = useRadioStore((state) => state.play);
  const togglePlay = useRadioStore((state) => state.togglePlay);
  const toggleFavorite = useRadioStore((state) => state.toggleFavorite);

  const isCurrent = current?.id === station.id;
  const isFavorite = favorites.includes(station.id);

  const live = isCurrent && playing;

  return (
    <div className={`rule-row group gap-3 ${isCurrent ? 'rule-row-active' : ''}`}>
      {/* The station's mark: its own initial in a hairline ring, which becomes
          the level meter while it is on air. One object carries both identity
          and state, so the row does not need a separate status column. */}
      <button
        type="button"
        onClick={() => (isCurrent ? togglePlay() : play(station))}
        title={live ? t('pause') : t('play')}
        aria-label={live ? t('pause') : t('play')}
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors motion-reduce:transition-none ${
          isCurrent
            ? 'border-accent-gold/45 text-accent-gold'
            : 'border-border text-muted-text group-hover:border-border-strong group-hover:text-text-primary'
        }`}
      >
        {live ? (
          <SignalBars className="h-3.5" />
        ) : (
          <>
            <span className="text-sm font-medium transition-opacity group-hover:opacity-0 motion-reduce:transition-none">
              <bdi>{stationInitial(station.name)}</bdi>
            </span>
            {/* The play glyph replaces the initial on hover: the ring is the
                affordance, so the whole row has exactly one primary control. */}
            <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none">
              <Play className="h-3.5 w-3.5" fill="currentColor" />
            </span>
          </>
        )}
      </button>

      {/* <bdi> rather than dir="auto" on the <p>: dir="auto" flips the whole
          block to RTL for an Arabic name, which right-aligns it inside its
          flex cell, so a mixed list rendered ragged with the Arabic stations
          hard against the far edge. <bdi> isolates the string's bidi so it
          still shapes correctly, while alignment keeps following the list. */}
      <p
        className={`min-w-0 flex-1 truncate text-sm ${live ? 'text-text-primary' : 'text-text-soft'}`}
        title={station.name}
      >
        <bdi>{station.name}</bdi>
      </p>

      {live && (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-accent-gold">
          <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
          {t('radioLive')}
        </span>
      )}

      <button
        type="button"
        onClick={() => toggleFavorite(station.id)}
        className={`icon-btn shrink-0 ${isFavorite ? 'text-accent-gold' : 'text-text-faint'}`}
        title={t('favorite')}
        aria-label={t('favorite')}
        aria-pressed={isFavorite}
      >
        <Star className="h-4 w-4" fill={isFavorite ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
});

StationCard.displayName = 'StationCard';
