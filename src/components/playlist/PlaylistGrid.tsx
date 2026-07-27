import React from 'react';
import { FolderPlus } from 'lucide-react';
import { Playlist } from '@/types';
import { PlaylistArt, PlaylistCard } from './PlaylistCard';
import { useI18n } from '@/i18n';

/* The poster grid's track sizing. `auto-fill` with a 17.5rem floor keeps the
   cards at a readable size on every width instead of stretching two of them
   across a 1600px screen; the SMALL-library case is handled by switching
   layout entirely (see below) rather than by torturing the track sizes. */
const GRID_TRACKS = 'repeat(auto-fill, minmax(min(100%, 17.5rem), 1fr))';

/** Below this, a poster grid strands a handful of cards in the top-left of a
 *  wide screen. Those libraries get full-width showcase rows instead. */
const SHOWCASE_MAX = 3;

interface PlaylistGridProps {
  playlists: Playlist[];
  viewMode?: 'grid' | 'list';
  /** Resume block pinned above a large library. Already excluded from `playlists`. */
  featured?: Playlist | null;
  onOpenPlaylist: (playlist: Playlist) => void;
  onContinuePlaylist: (playlist: Playlist) => void;
  onRescanPlaylist: (id: string) => void;
  onRegenerateThumbnails: (id: string) => void;
  onRemovePlaylist: (id: string) => void;
  onImportFolder?: () => void;
}

export const PlaylistGrid: React.FC<PlaylistGridProps> = ({
  playlists,
  viewMode = 'list',
  featured = null,
  onOpenPlaylist,
  onContinuePlaylist,
  onRescanPlaylist,
  onRegenerateThumbnails,
  onRemovePlaylist,
  onImportFolder,
}) => {
  const { t } = useI18n();

  if (playlists.length === 0 && !featured) {
    return <LibraryEmptyState onImportFolder={onImportFolder} />;
  }

  const handlers = {
    onOpen: onOpenPlaylist,
    onContinue: onContinuePlaylist,
    onRescan: onRescanPlaylist,
    onRegenerateThumbnails,
    onRemove: onRemovePlaylist,
  };

  if (viewMode === 'list') {
    return (
      <div className="rule-list">
        {[...(featured ? [featured] : []), ...playlists].map((playlist) => (
          <PlaylistCard key={playlist.id} playlist={playlist} variant="list" {...handlers} />
        ))}
      </div>
    );
  }

  const showcase = playlists.length <= SHOWCASE_MAX;

  return (
    <div className="flex flex-col gap-8">
      {featured && (
        <PlaylistCard key={featured.id} playlist={featured} variant="wide" featured {...handlers} />
      )}

      {playlists.length > 0 && (
        <div>
          <SectionRule label={t('playlists')} count={playlists.length} className="mb-5" />
          {showcase ? (
            <div className="flex flex-col gap-5">
              {playlists.map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} variant="wide" {...handlers} />
              ))}
            </div>
          ) : (
            <div className="grid gap-5" style={{ gridTemplateColumns: GRID_TRACKS }}>
              {playlists.map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} variant="grid" {...handlers} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Section rule ───────────────────────────────────────────────────────────
   The section header shape for this page, upgraded from a whisper: a small
   accent eyebrow (Latin only) over a display-weight title, sharing the app's
   .section-head grammar. Counts and actions sit at the far end of the rule. */
export const SectionRule: React.FC<{
  label: string;
  count?: number;
  action?: React.ReactNode;
  className?: string;
}> = ({ label, count, action, className = '' }) => {
  const { language } = useI18n();
  const isArabic = language === 'ar';

  return (
    <div className={`section-head ${className}`}>
      <div className="min-w-0">
        {!isArabic && (
          <p aria-hidden="true" className="section-eyebrow">
            {label}
          </p>
        )}
        <h2 className={`section-title ${isArabic ? '' : 'section-title-latin'} truncate`}>{label}</h2>
      </div>
      <div className="section-meta flex items-center gap-3">
        {count !== undefined && <bdi>{count}</bdi>}
        {action}
      </div>
    </div>
  );
};

/* ── Empty state ────────────────────────────────────────────────────────────
   A designed opening screen rather than a failure notice: the same generated
   geometry the placeholders use, at poster scale, with the one action that
   moves the user forward. */
const LibraryEmptyState: React.FC<{ onImportFolder?: () => void }> = ({ onImportFolder }) => {
  const { t } = useI18n();

  return (
    <div className="empty-panel flex flex-col items-center rounded-xl border border-border px-6 py-16 text-center">
      <div className="relative h-28 w-44 overflow-hidden rounded-lg border border-border">
        <PlaylistArt seed="library-empty" name="" dense />
      </div>
      <h3 className="mt-6 text-lg font-semibold tracking-[-0.01em] text-text-primary">{t('noVideosYet')}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-text">{t('importFolderHint')}</p>
      {onImportFolder && (
        <button type="button" onClick={onImportFolder} className="btn-primary mt-6">
          <FolderPlus className="h-4 w-4" />
          {t('importFolder')}
        </button>
      )}
    </div>
  );
};

/* ── Loading ────────────────────────────────────────────────────────────────
   The skeleton has the shape of the thing that is coming, so the page does not
   jump from a centred spinner in a void to a full layout. */
export const PlaylistGridSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="flex flex-col gap-5" aria-hidden="true">
    {Array.from({ length: rows }).map((_, index) => (
      <div
        key={index}
        className="flex flex-col overflow-hidden rounded-xl border border-border bg-panel/40 sm:flex-row"
      >
        <div className="aspect-video w-full shrink-0 bg-elevated-panel motion-safe:animate-pulse sm:w-[17rem] lg:w-[21rem]" />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 p-6">
          <div className="h-2.5 w-24 rounded-full bg-elevated-panel motion-safe:animate-pulse" />
          <div className="h-5 w-2/5 rounded bg-elevated-panel motion-safe:animate-pulse" />
          <div className="h-3 w-1/4 rounded bg-elevated-panel motion-safe:animate-pulse" />
          <div className="h-1 w-full rounded-full bg-elevated-panel motion-safe:animate-pulse" />
          <div className="h-3 w-1/3 rounded bg-elevated-panel motion-safe:animate-pulse" />
        </div>
      </div>
    ))}
  </div>
);
