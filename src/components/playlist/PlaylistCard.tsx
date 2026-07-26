import React, { useEffect, useId, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, FolderClosed, Play } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Playlist } from '@/types';
import { formatDuration } from '@/utils/formatTime';
import { CONTENT_CATEGORIES } from '@/utils/constants';
import { PlaylistMenu } from './PlaylistMenu';
import { useI18n } from '@/i18n';

/* ─────────────────────────────────────────────────────────────────────────────
   Playlist presentation kit.

   Everything here is markup + theme tokens. No bundled artwork, no per-theme
   code, no depiction of animate beings anywhere. The pieces are exported
   because the detail view and the search results have to show the SAME poster,
   the same meter and the same placeholder — the old page had three different
   treatments of one object.
   ────────────────────────────────────────────────────────────────────────── */

/** A playlist counts as finished at 95%, the same threshold the Library uses. */
const COMPLETE_AT = 95;

export const playlistProgress = (playlist: Playlist) => {
  if (!playlist.totalDurationSeconds || playlist.totalDurationSeconds <= 0) return 0;
  const pct = (playlist.progressSeconds / playlist.totalDurationSeconds) * 100;
  return Math.min(Math.max(pct, 0), 100);
};

/** Stable small hash — picks the placeholder's geometry and its rotation. */
const seedOf = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

/* ── The empty-thumbnail treatment ──────────────────────────────────────────
   Four stroked geometric marks, drawn from the same construction family as the
   khatam star the hero uses: an 8-point star, interlaced squares, a 12-point
   rosette, a hexagonal lattice. Which one a playlist gets — and how far it is
   rotated — comes from a hash of its id, so a wall of un-thumbnailed playlists
   is a wall of different marks instead of the same grey rectangle repeated.

   Everything is stroked in `currentColor` and the wrapper carries the accent
   token, so all ten themes recolour it for free.                            */

const polar = (radius: number, angleDeg: number) => {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return `${(50 + radius * Math.cos(a)).toFixed(2)},${(50 + radius * Math.sin(a)).toFixed(2)}`;
};

const starPoints = (points: number, outer: number, inner: number) =>
  Array.from({ length: points * 2 }, (_, i) => polar(i % 2 === 0 ? outer : inner, (180 / points) * i)).join(' ');

const regularPoints = (sides: number, radius: number, offset = 0) =>
  Array.from({ length: sides }, (_, i) => polar(radius, (360 / sides) * i + offset)).join(' ');

const MARKS: React.ReactNode[] = [
  // 8-point khatam star inside its own containing circle
  <>
    <polygon points={starPoints(8, 47, 27)} opacity="0.85" />
    <polygon points={regularPoints(4, 30, 45)} opacity="0.4" />
    <circle cx="50" cy="50" r="30" opacity="0.3" />
  </>,
  // interlaced squares
  <>
    <polygon points={regularPoints(4, 46, 0)} opacity="0.75" />
    <polygon points={regularPoints(4, 46, 45)} opacity="0.75" />
    <circle cx="50" cy="50" r="32" opacity="0.35" />
  </>,
  // 12-point rosette
  <>
    <polygon points={starPoints(12, 47, 33)} opacity="0.8" />
    <circle cx="50" cy="50" r="33" opacity="0.35" />
    <circle cx="50" cy="50" r="24" opacity="0.25" />
  </>,
  // hexagonal lattice
  <>
    <polygon points={regularPoints(6, 47, 0)} opacity="0.8" />
    <polygon points={regularPoints(6, 47, 30)} opacity="0.5" />
    <circle cx="50" cy="50" r="27" opacity="0.3" />
  </>,
];

interface PlaylistArtProps {
  seed: string;
  name: string;
  /** Row-sized: drop the initial and the inner rule, the mark alone reads. */
  dense?: boolean;
}

export const PlaylistArt: React.FC<PlaylistArtProps> = ({ seed, name, dense = false }) => {
  const gradientId = useId();
  const hash = useMemo(() => seedOf(seed), [seed]);
  const mark = MARKS[hash % MARKS.length];
  const rotation = (hash >> 3) % 24;
  const initial = useMemo(() => {
    const first = Array.from(name.trim())[0];
    return first ? first.toLocaleUpperCase() : '';
  }, [name]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-elevated-panel text-accent-gold">
      {/* A single directional wash — one key light, the same idea as the hero,
          distorted to the poster's shape so it never reads as a circle. */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id={`${gradientId}-wash`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.13" />
            <stop offset="55%" stopColor="currentColor" stopOpacity="0.04" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#${gradientId}-wash)`} />
      </svg>

      {/* The jadwal: the double rule that frames a printed page. Square
          corners, deliberately — a rounded double border is a web card. */}
      <span className={`pointer-events-none absolute border border-accent-gold/25 ${dense ? 'inset-1' : 'inset-3'}`} />
      {!dense && <span className="pointer-events-none absolute inset-[0.9rem] border border-accent-gold/10" />}

      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`relative ${dense ? 'h-[62%]' : 'h-[54%]'} aspect-square`}>
          <svg
            className="h-full w-full"
            viewBox="0 0 100 100"
            fill="none"
            stroke="currentColor"
            strokeWidth={dense ? 2.4 : 1.4}
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <g opacity={dense ? 0.34 : 0.42} transform={`rotate(${rotation} 50 50)`}>
              {mark}
            </g>
          </svg>
          {!dense && initial && (
            <span
              className="absolute inset-0 flex items-center justify-center text-[1.6rem] font-semibold leading-none text-text-primary/45"
              aria-hidden="true"
            >
              <bdi>{initial}</bdi>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Poster ─────────────────────────────────────────────────────────────────
   The generated art is the fallback, so a thumbnail that fails to decode lands
   on the composed placeholder rather than on a broken-image icon.            */

interface PlaylistPosterProps {
  path?: string | null;
  name: string;
  seed: string;
  dense?: boolean;
}

export const PlaylistPoster: React.FC<PlaylistPosterProps> = ({ path, name, seed, dense }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [path]);

  const src = useMemo(() => (!path || failed ? null : convertFileSrc(path)), [failed, path]);

  if (!src) return <PlaylistArt seed={seed} name={name} dense={dense} />;

  return (
    <img
      src={src}
      alt=""
      aria-label={name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
};

/* ── Progress ───────────────────────────────────────────────────────────────
   A bare "59%" is a number, not a reading of where you are. The meter carries
   the glance value; the number is the confirmation beside it.                */

export const ProgressMeter: React.FC<{ percent: number; done?: boolean; thick?: boolean }> = ({
  percent,
  done = false,
  thick = false,
}) => (
  <div className={`w-full overflow-hidden rounded-full bg-accent-gold/[0.14] ${thick ? 'h-1.5' : 'h-1'}`}>
    <div
      className={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500 ${
        done ? 'bg-success-green' : 'bg-accent-gold'
      }`}
      style={{ width: `${Math.max(percent, percent > 0 ? 2 : 0)}%` }}
    />
  </div>
);

/** Category ids are stored as free text; match the taxonomy case-insensitively
 *  and fall back to whatever the folder actually said. */
export const useCategoryLabel = (category: string | null) => {
  const { t } = useI18n();
  if (!category) return null;
  const known = CONTENT_CATEGORIES.find((item) => item.id.toLowerCase() === category.toLowerCase());
  return known ? t(known.labelKey) : category;
};

const Chip: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border border-accent-gold/25 bg-background/70 px-2 py-0.5 text-[11px] font-medium leading-none text-accent-gold backdrop-blur-sm ${className}`}
  >
    {children}
  </span>
);

interface PlaylistCardProps {
  playlist: Playlist;
  variant?: 'grid' | 'list' | 'wide';
  /** Wide variant only: the resume block at the head of a large library. */
  featured?: boolean;
  onOpen: (playlist: Playlist) => void;
  onContinue: (playlist: Playlist) => void;
  onRescan: (id: string) => void;
  onRegenerateThumbnails: (id: string) => void;
  onRemove: (id: string) => void;
}

export const PlaylistCard: React.FC<PlaylistCardProps> = React.memo(({
  playlist,
  variant = 'grid',
  featured = false,
  onOpen,
  onContinue,
  onRescan,
  onRegenerateThumbnails,
  onRemove,
}) => {
  const { t, language } = useI18n();
  const progressPercent = useMemo(() => playlistProgress(playlist), [playlist]);
  const categoryLabel = useCategoryLabel(playlist.category);

  const hasProgress = progressPercent > 0;
  const isComplete = progressPercent >= COMPLETE_AT;
  const lastUpdated = playlist.updatedAt
    ? new Date(playlist.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  const totalLabel = formatDuration(playlist.totalDurationSeconds, language);
  const watchedLabel = formatDuration(playlist.progressSeconds, language);

  const menu = (
    <PlaylistMenu
      playlistId={playlist.id}
      playlistName={playlist.name}
      onOpen={() => onOpen(playlist)}
      onRescan={() => onRescan(playlist.id)}
      onRegenerateThumbnails={() => onRegenerateThumbnails(playlist.id)}
      onRemove={() => onRemove(playlist.id)}
    />
  );

  /* The status line, in one shape everywhere: a state word, then the reading of
     how far in you are. Never a naked two-digit number. */
  const status = isComplete ? (
    <span className="inline-flex items-center gap-1.5 text-success-green">
      <CheckCircle2 className="h-3.5 w-3.5" />
      {t('completed')}
    </span>
  ) : hasProgress ? (
    <span className="inline-flex items-center gap-1.5 text-text-soft">
      <span className="font-semibold tabular-nums text-accent-gold">
        <bdi>{Math.round(progressPercent)}%</bdi>
      </span>
      <span className="text-muted-text">
        <bdi>{watchedLabel}</bdi> {t('of')} <bdi>{totalLabel}</bdi>
      </span>
    </span>
  ) : (
    <span className="text-muted-text">{t('notWatched')}</span>
  );

  /* ── Ruled row ──────────────────────────────────────────────────────────── */
  if (variant === 'list') {
    return (
      <div className="rule-row group">
        <button
          type="button"
          onClick={() => onContinue(playlist)}
          title={t('continue')}
          aria-label={t('continue')}
          className="relative h-[58px] w-[104px] shrink-0 overflow-hidden rounded-md bg-background"
        >
          <PlaylistPoster path={playlist.thumbnailPath} name={playlist.name} seed={playlist.id} dense />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/65 opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="h-5 w-5 fill-current text-text-primary" />
          </span>
          {hasProgress && (
            <span className="absolute inset-x-0 bottom-0 block h-[3px] bg-background/70">
              <span
                className={`block h-full ${isComplete ? 'bg-success-green' : 'bg-accent-gold'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </span>
          )}
        </button>

        <button type="button" onClick={() => onOpen(playlist)} className="min-w-0 flex-1 text-start">
          <p className="truncate text-[15px] font-medium text-text-primary" title={playlist.name}>
            <bdi>{playlist.name}</bdi>
          </p>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-text">
            {categoryLabel && (
              <>
                <span className="shrink-0 text-accent-gold/90"><bdi>{categoryLabel}</bdi></span>
                <span className="shrink-0 text-text-faint">&middot;</span>
              </>
            )}
            <span className="truncate text-text-faint" title={playlist.folderPath}>
              <bdi>{playlist.folderPath}</bdi>
            </span>
          </div>
        </button>

        <div className="hidden w-40 shrink-0 flex-col gap-1.5 sm:flex">
          <ProgressMeter percent={progressPercent} done={isComplete} />
          <div className="flex items-center justify-between text-[11px] tabular-nums text-muted-text">
            <span><bdi>{playlist.videoCount}</bdi> {t('videosLower')}</span>
            <span><bdi>{totalLabel}</bdi></span>
          </div>
        </div>

        <span className="hidden w-14 shrink-0 text-end text-xs font-semibold tabular-nums text-text-soft lg:block">
          {isComplete ? (
            <CheckCircle2 className="ms-auto h-4 w-4 text-success-green" />
          ) : hasProgress ? (
            <bdi>{Math.round(progressPercent)}%</bdi>
          ) : null}
        </span>

        {menu}
      </div>
    );
  }

  /* ── Wide showcase card ─────────────────────────────────────────────────────
     Used when the library is small enough that a poster grid would strand a
     few cards in the top-left of a very large screen, and for the resume block
     at the head of a big library. It fills the width with something worth
     reading instead of leaving a void beside it. */
  if (variant === 'wide') {
    return (
      <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-panel/50 transition-colors duration-300 hover:border-accent-gold/30 hover:bg-panel-hover/40 sm:flex-row">
        <button
          type="button"
          onClick={() => onContinue(playlist)}
          title={t('continue')}
          aria-label={t('continue')}
          className={`relative aspect-video w-full shrink-0 overflow-hidden bg-elevated-panel ${
            featured ? 'sm:w-[20rem] lg:w-[26rem]' : 'sm:w-[17rem] lg:w-[21rem]'
          }`}
        >
          <span className="absolute inset-0 motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.04]">
            <PlaylistPoster path={playlist.thumbnailPath} name={playlist.name} seed={playlist.id} />
          </span>
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
          <span className="pointer-events-none absolute bottom-2.5 end-2.5">
            <Chip>
              <bdi>{totalLabel}</bdi>
            </Chip>
          </span>
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-accent-gold/40 bg-background/80">
              <Play className="h-5 w-5 fill-current text-accent-gold" />
            </span>
          </span>
        </button>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3.5 p-5 lg:p-6">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
                {featured && <span className="text-accent-gold">{t('continueWatching')}</span>}
                {featured && categoryLabel && <span className="text-text-faint">/</span>}
                {categoryLabel && <span className="text-muted-text"><bdi>{categoryLabel}</bdi></span>}
              </div>
              <button type="button" onClick={() => onOpen(playlist)} className="min-w-0 max-w-full text-start">
                <h3
                  className={`line-clamp-2 font-semibold leading-tight tracking-[-0.01em] text-text-primary transition-colors group-hover:text-accent-gold ${
                    featured ? 'text-2xl lg:text-[1.7rem]' : 'text-lg lg:text-xl'
                  }`}
                  title={playlist.name}
                >
                  <bdi>{playlist.name}</bdi>
                </h3>
              </button>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-text">
                <span><bdi>{playlist.videoCount}</bdi> {t('videosLower')}</span>
                <span className="text-text-faint">&middot;</span>
                <span><bdi>{totalLabel}</bdi></span>
                {lastUpdated && (
                  <>
                    <span className="text-text-faint">&middot;</span>
                    <span className="inline-flex items-center gap-1 text-text-faint" title={t('lastUpdated')}>
                      <CalendarDays className="h-3 w-3" />
                      <bdi>{lastUpdated}</bdi>
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="-me-2 shrink-0">{menu}</div>
          </div>

          <div className="flex flex-col gap-2">
            <ProgressMeter percent={progressPercent} done={isComplete} thick={featured} />
            <div className="flex items-center justify-between gap-3 text-xs">
              {status}
              <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-text-faint" title={playlist.folderPath}>
                <FolderClosed className="h-3 w-3 shrink-0" />
                <span className="truncate"><bdi>{playlist.folderPath}</bdi></span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button type="button" onClick={() => onContinue(playlist)} className="btn-primary px-3.5 py-2 text-xs">
              <Play className="h-3.5 w-3.5 fill-current" />
              {t('continue')}
            </button>
            <button type="button" onClick={() => onOpen(playlist)} className="btn-secondary px-3.5 py-2 text-xs">
              {t('details')}
            </button>
          </div>
        </div>
      </article>
    );
  }

  /* ── Poster card ────────────────────────────────────────────────────────── */
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-panel/50 transition-colors duration-300 hover:border-accent-gold/30 hover:bg-panel-hover/40">
      <button
        type="button"
        onClick={() => onContinue(playlist)}
        title={t('continue')}
        aria-label={t('continue')}
        className="relative aspect-video w-full shrink-0 overflow-hidden bg-elevated-panel"
      >
        <span className="absolute inset-0 motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.04]">
          <PlaylistPoster path={playlist.thumbnailPath} name={playlist.name} seed={playlist.id} />
        </span>
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/75 via-background/5 to-transparent" />

        {categoryLabel && (
          <span className="pointer-events-none absolute start-2.5 top-2.5">
            <Chip><bdi>{categoryLabel}</bdi></Chip>
          </span>
        )}
        <span className="pointer-events-none absolute bottom-2.5 end-2.5">
          <Chip><bdi>{totalLabel}</bdi></Chip>
        </span>

        <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-accent-gold/40 bg-background/80">
            <Play className="h-4 w-4 fill-current text-accent-gold" />
          </span>
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <button type="button" onClick={() => onOpen(playlist)} className="min-w-0 text-start">
          <h3
            className="line-clamp-2 min-h-[2.6rem] text-[15px] font-semibold leading-snug tracking-[-0.01em] text-text-primary transition-colors group-hover:text-accent-gold"
            title={playlist.name}
          >
            <bdi>{playlist.name}</bdi>
          </h3>
        </button>

        <p className="flex items-center gap-1.5 text-xs text-muted-text">
          <span><bdi>{playlist.videoCount}</bdi> {t('videosLower')}</span>
          {lastUpdated && (
            <>
              <span className="text-text-faint">&middot;</span>
              <span className="text-text-faint" title={t('lastUpdated')}><bdi>{lastUpdated}</bdi></span>
            </>
          )}
        </p>

        <div className="mt-auto flex flex-col gap-2 pt-1.5">
          <ProgressMeter percent={progressPercent} done={isComplete} />
          <div className="flex items-center justify-between gap-2 text-xs">
            {status}
            <div className="-me-2 shrink-0">{menu}</div>
          </div>
          <p
            className="flex min-w-0 items-center gap-1.5 border-t border-border pt-2 text-[11px] text-text-faint"
            title={playlist.folderPath}
          >
            <FolderClosed className="h-3 w-3 shrink-0" />
            <span className="truncate"><bdi>{playlist.folderPath}</bdi></span>
          </p>
        </div>
      </div>
    </article>
  );
});

PlaylistCard.displayName = 'PlaylistCard';
