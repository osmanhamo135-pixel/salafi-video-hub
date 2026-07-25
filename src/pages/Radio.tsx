import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Pause, Play, RadioTower, RefreshCw, Search, Star, Wifi } from 'lucide-react';
import { RadioStation, useRadioStore } from '@/store/radioStore';
import { useI18n } from '@/i18n';

export const Radio: React.FC = () => {
  const { t, language } = useI18n();
  const stations = useRadioStore((state) => state.stations);
  const loading = useRadioStore((state) => state.loading);
  const loadError = useRadioStore((state) => state.loadError);
  const favorites = useRadioStore((state) => state.favorites);
  const loadStations = useRadioStore((state) => state.loadStations);
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

  return (
    <div className="page-container">
      <div className="content-max-width">
        <div className="mb-6">
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
          <div className="py-10 text-center">
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
  );
};

const StationSection: React.FC<{
  title: string;
  stations: RadioStation[];
  emptyLabel?: string;
}> = ({ title, stations, emptyLabel }) => {
  if (stations.length === 0 && !emptyLabel) return null;

  return (
    <section className="mb-8">
      <div className="rule-head mb-1">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        <span className="text-xs tabular-nums text-muted-text">
          <bdi>{stations.length}</bdi>
        </span>
      </div>
      {stations.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-text">{emptyLabel}</p>
      ) : (
        <div className="rule-list">
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

  return (
    <div className={`rule-row ${isCurrent ? 'rule-row-active' : ''}`}>
      <button
        type="button"
        onClick={() => (isCurrent ? togglePlay() : play(station))}
        className={`icon-btn shrink-0 ${isCurrent && playing ? 'text-text-primary' : ''}`}
        title={isCurrent && playing ? t('pause') : t('play')}
        aria-label={isCurrent && playing ? t('pause') : t('play')}
      >
        {isCurrent && playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
      </button>

      <p
        dir="auto"
        className="min-w-0 flex-1 truncate text-sm text-text-primary"
        title={station.name}
      >
        {station.name}
      </p>

      {isCurrent && playing && (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-text">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
          {t('radioLive')}
        </span>
      )}

      <button
        type="button"
        onClick={() => toggleFavorite(station.id)}
        className={`icon-btn shrink-0 ${isFavorite ? 'text-accent-gold' : ''}`}
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
