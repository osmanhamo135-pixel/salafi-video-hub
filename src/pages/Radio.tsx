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
          <p className="mt-2 flex items-center gap-1.5 text-xs text-accent-gold">
            <Wifi className="h-3.5 w-3.5" />
            {t('radioOnlineNote')}
          </p>
        </div>

        <div className="premium-surface mb-5 rounded-lg p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('radioSearchPlaceholder')}
              className="surface-input w-full py-2.5 ps-10"
            />
          </div>
        </div>

        {loading && (
          <div className="premium-surface flex items-center gap-3 rounded-lg p-5">
            <Loader2 className="h-5 w-5 animate-spin text-primary-blue" />
            <p className="text-sm text-text-primary">{t('radioLoading')}</p>
          </div>
        )}

        {loadError && !loading && (
          <div className="premium-surface rounded-lg p-6 text-center">
            <AlertTriangle className="mx-auto mb-2 h-7 w-7 text-warning-orange" />
            <p className="text-sm text-text-primary">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadStations(language === 'ar' ? 'ar' : 'eng')}
              className="btn-secondary mx-auto mt-4 px-4 py-2 text-xs"
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
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-text-primary">{title}</h2>
      {stations.length === 0 ? (
        <div className="premium-surface rounded-lg p-8 text-center text-sm text-muted-text">{emptyLabel}</div>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
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
    <div
      className={`premium-card flex items-center gap-3 rounded-lg p-3 transition-colors ${
        isCurrent ? 'border-primary-blue/45' : 'premium-card-hover'
      }`}
    >
      <button
        type="button"
        onClick={() => (isCurrent ? togglePlay() : play(station))}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
          isCurrent && playing
            ? 'bg-primary-blue text-white'
            : 'bg-primary-blue/15 text-primary-blue hover:bg-primary-blue hover:text-white'
        }`}
        title={isCurrent && playing ? t('pause') : t('play')}
      >
        {isCurrent && playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
      </button>

      <p className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary" title={station.name}>
        {station.name}
      </p>

      {isCurrent && playing && (
        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-success-green">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-green" />
          {t('radioLive')}
        </span>
      )}

      <button
        type="button"
        onClick={() => toggleFavorite(station.id)}
        className={`shrink-0 rounded p-1.5 transition-colors ${
          isFavorite ? 'text-accent-gold' : 'text-muted-text hover:text-accent-gold'
        }`}
        title={t('favorite')}
      >
        <Star className="h-4 w-4" fill={isFavorite ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
});

StationCard.displayName = 'StationCard';
