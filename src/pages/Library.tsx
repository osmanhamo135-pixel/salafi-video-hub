import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileVideo,
  FolderPlus,
  LayoutGrid,
  List,
  Loader2,
  Search,
  SearchX,
  SlidersHorizontal,
  SortAsc,
  X,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { ImportResult, Playlist, Video } from '@/types';
import { useAppStore } from '@/store/appStore';
import { usePlayerStore } from '@/store/playerStore';
import { pickFolder, pickVideoFile } from '@/hooks/useTauriCommands';
import { PlaylistGrid, PlaylistGridSkeleton, SectionRule } from '@/components/playlist/PlaylistGrid';
import { findCategory } from '@/components/playlist/PlaylistCard';
import { PlaylistDetail } from '@/components/playlist/PlaylistDetail';
import { SearchResults } from '@/components/playlist/SearchResults';
import { CONTENT_CATEGORIES } from '@/utils/constants';
import { formatDuration } from '@/utils/formatTime';
import { useI18n } from '@/i18n';

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'The import failed. Please try another local folder or video file.';
};

type PlaylistSortKey = 'recent' | 'name' | 'videos' | 'duration' | 'progress';
type PlaylistFilterKey = 'all' | 'in-progress' | 'completed' | 'empty';
type PlaylistViewMode = 'grid' | 'list';

const getPlaylistProgress = (playlist: Playlist) => {
  if (!playlist.totalDurationSeconds || playlist.totalDurationSeconds <= 0) return 0;
  return Math.min(Math.max((playlist.progressSeconds / playlist.totalDurationSeconds) * 100, 0), 100);
};

/** A playlist is "finished" at 95%, and "in progress" between 0 and that. */
const COMPLETE_AT = 95;

export const Library: React.FC = () => {
  const { t, language } = useI18n();
  const playlists = useAppStore((state) => state.playlists);
  const playlistsLoading = useAppStore((state) => state.playlistsLoading);
  const playlistsError = useAppStore((state) => state.playlistsError);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const searchResults = useAppStore((state) => state.searchResults);
  const searchError = useAppStore((state) => state.searchError);
  const loadPlaylists = useAppStore((state) => state.loadPlaylists);
  const importFolder = useAppStore((state) => state.importFolder);
  const importSingleVideo = useAppStore((state) => state.importSingleVideo);
  const removePlaylist = useAppStore((state) => state.removePlaylist);
  const search = useAppStore((state) => state.search);
  const thumbnailRefreshVersion = useAppStore((state) => state.thumbnailRefreshVersion);
  const progressRefreshVersion = useAppStore((state) => state.progressRefreshVersion);
  const importRefreshVersion = useAppStore((state) => state.importRefreshVersion);
  const openPlayerPlaylist = usePlayerStore((state) => state.openPlaylist);

  const [importing, setImporting] = useState(false);
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistVideos, setPlaylistVideos] = useState<Video[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistSort, setPlaylistSort] = useState<PlaylistSortKey>('recent');
  const [playlistFilter, setPlaylistFilter] = useState<PlaylistFilterKey>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  // Grid stays the default: it is what the library has always opened on, and
  // the restyle was meant to change how things look, not what they do. The
  // ruled list is one click away and both variants carry the house style.
  const [viewMode, setViewMode] = useState<PlaylistViewMode>('grid');

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (!trimmed) {
      search('');
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      await search(trimmed);
      setIsSearching(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const openPlaylistDetail = useCallback(async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setPlaylistLoading(true);
    setImportError(null);

    try {
      const videos = await invoke<Video[]>('get_videos_by_playlist', { playlistId: playlist.id });
      setPlaylistVideos(videos);
    } catch (error) {
      setPlaylistVideos([]);
      setImportError(getErrorMessage(error));
    } finally {
      setPlaylistLoading(false);
    }
  }, []);

  const openPlaylistDetailById = useCallback(async (playlistId: string | null) => {
    if (!playlistId) return;

    const playlist = await invoke<Playlist | null>('get_playlist', { id: playlistId });
    if (playlist) {
      await openPlaylistDetail(playlist);
    }
  }, [openPlaylistDetail]);

  useEffect(() => {
    if (!selectedPlaylist?.id) return;

    let cancelled = false;
    const refreshSelectedPlaylist = async () => {
      try {
        const [playlist, videos] = await Promise.all([
          invoke<Playlist | null>('get_playlist', { id: selectedPlaylist.id }),
          invoke<Video[]>('get_videos_by_playlist', { playlistId: selectedPlaylist.id }),
        ]);

        if (cancelled) return;
        if (playlist) setSelectedPlaylist(playlist);
        setPlaylistVideos(videos);
      } catch (error) {
        if (!cancelled) setImportError(getErrorMessage(error));
      }
    };

    refreshSelectedPlaylist();

    return () => {
      cancelled = true;
    };
  }, [importRefreshVersion, progressRefreshVersion, selectedPlaylist?.id, thumbnailRefreshVersion]);

  const finishImport = useCallback(async (result: ImportResult) => {
    setImportResult(result);
    await loadPlaylists();
    await openPlaylistDetailById(result.playlist_id);
  }, [loadPlaylists, openPlaylistDetailById]);

  const handleImportFolder = useCallback(async () => {
    try {
      setImportError(null);
      setImportResult(null);
      const path = await pickFolder(t('dialogSelectFolder'));
      if (!path) return;

      setImporting(true);
      const result = await importFolder(path, includeSubfolders);
      await finishImport(result);
    } catch (error) {
      setImportError(getErrorMessage(error));
    } finally {
      setImporting(false);
    }
  }, [finishImport, importFolder, includeSubfolders]);

  const handleImportSingleVideo = useCallback(async () => {
    try {
      setImportError(null);
      setImportResult(null);
      const path = await pickVideoFile(t('dialogSelectVideo'));
      if (!path) return;

      setImporting(true);
      const result = await importSingleVideo(path);
      await finishImport(result);
    } catch (error) {
      setImportError(getErrorMessage(error));
    } finally {
      setImporting(false);
    }
  }, [finishImport, importSingleVideo]);

  const handlePlayVideo = useCallback(async (video: Video) => {
    const playlist = selectedPlaylist ?? playlists.find((item) => item.videoIds.includes(video.id));
    if (!playlist) {
      setImportError(t('playlistNotFoundForVideo'));
      return;
    }

    await openPlayerPlaylist(playlist.id, video.id);
  }, [openPlayerPlaylist, playlists, selectedPlaylist]);

  const handleContinuePlaylist = useCallback(async (playlist: Playlist) => {
    try {
      setImportError(null);
      const videos = await invoke<Video[]>('get_videos_by_playlist', { playlistId: playlist.id });
      const resumeVideo =
        videos
          .filter((video) => video.progressSeconds > 0 && !video.completed)
          .sort((a, b) => (b.lastPlayedAt ?? b.updatedAt) - (a.lastPlayedAt ?? a.updatedAt))[0] ??
        videos.find((video) => !video.completed) ??
        videos[0];

      if (!resumeVideo) {
        setImportError(t('playlistNoPlayableVideos'));
        return;
      }

      await openPlayerPlaylist(playlist.id, resumeVideo.id);
    } catch (error) {
      setImportError(getErrorMessage(error));
    }
  }, [openPlayerPlaylist]);

  const handleRescan = useCallback(async (id: string) => {
    try {
      setImportError(null);
      const playlist = await invoke<Playlist>('rescan_playlist', { id });
      await loadPlaylists();
      await openPlaylistDetail(playlist);
    } catch (error) {
      setImportError(getErrorMessage(error));
    }
  }, [loadPlaylists, openPlaylistDetail]);

  const handleRegenerateThumbnails = useCallback(async () => {
    try {
      const result = await invoke<{
        generated_count: number;
        skipped_count: number;
        failed_count: number;
        errors: string[];
      }>('regenerate_missing_thumbnails');
      await loadPlaylists();
      if (selectedPlaylist) {
        const updated = await invoke<Playlist | null>('get_playlist', { id: selectedPlaylist.id });
        if (updated) await openPlaylistDetail(updated);
      }
      setImportResult({
        imported_count: result.generated_count,
        skipped_count: result.skipped_count,
        failed_count: result.failed_count,
        playlist_id: selectedPlaylist?.id ?? null,
        errors: result.errors.length > 0 ? result.errors : [t('regenerateMissingThumbnails')],
      });
    } catch (error) {
      setImportError(getErrorMessage(error));
    }
  }, [loadPlaylists, openPlaylistDetail, selectedPlaylist]);

  const handleRemove = useCallback(async (id: string) => {
    const playlist = playlists.find((item) => item.id === id);
    const name = playlist?.name ?? t('playlist');
    if (!confirm(`${t('removeFromLibrary')}: ${name}?`)) return;

    try {
      await removePlaylist(id);
      if (selectedPlaylist?.id === id) {
        setSelectedPlaylist(null);
        setPlaylistVideos([]);
      }
    } catch (error) {
      setImportError(getErrorMessage(error));
    }
  }, [playlists, removePlaylist, selectedPlaylist?.id]);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    search('');
  }, [search]);

  const showSearchResults = !selectedPlaylist && searchQuery.trim().length > 0 && searchResults !== null;
  const showInitialLibraryLoading = playlistsLoading && playlists.length === 0 && !showSearchResults && !selectedPlaylist;

  const librarySummary = useMemo(() => {
    return playlists.reduce(
      (summary, playlist) => {
        const progress = getPlaylistProgress(playlist);
        return {
          videos: summary.videos + playlist.videoCount,
          seconds: summary.seconds + playlist.totalDurationSeconds,
          inProgress: summary.inProgress + (progress > 0 && progress < COMPLETE_AT ? 1 : 0),
          completed: summary.completed + (progress >= COMPLETE_AT ? 1 : 0),
          empty: summary.empty + (playlist.videoCount === 0 ? 1 : 0),
        };
      },
      { videos: 0, seconds: 0, inProgress: 0, completed: 0, empty: 0 },
    );
  }, [playlists]);

  const filteredPlaylists = useMemo(() => {
    const visible = playlists.filter((playlist) => {
      if (categoryFilter && playlist.category !== categoryFilter) return false;
      const progress = getPlaylistProgress(playlist);
      if (playlistFilter === 'in-progress') return progress > 0 && progress < 95;
      if (playlistFilter === 'completed') return progress >= 95;
      if (playlistFilter === 'empty') return playlist.videoCount === 0;
      return true;
    });

    return [...visible].sort((a, b) => {
      if (playlistSort === 'name') return a.name.localeCompare(b.name);
      if (playlistSort === 'videos') return b.videoCount - a.videoCount;
      if (playlistSort === 'duration') return b.totalDurationSeconds - a.totalDurationSeconds;
      if (playlistSort === 'progress') return getPlaylistProgress(b) - getPlaylistProgress(a);
      return b.updatedAt - a.updatedAt;
    });
  }, [categoryFilter, playlistFilter, playlistSort, playlists]);

  /* The resume block. Only when nothing is narrowing the view and the library
     is big enough that a bare grid would give the eye nowhere to land first —
     under that size every card is already a full-width showcase row. */
  const featuredPlaylist = useMemo(() => {
    const unnarrowed = playlistFilter === 'all' && !categoryFilter && !searchQuery.trim();
    if (!unnarrowed || viewMode !== 'grid' || filteredPlaylists.length < 5) return null;

    return (
      [...filteredPlaylists]
        .filter((playlist) => {
          const progress = getPlaylistProgress(playlist);
          return progress > 0 && progress < COMPLETE_AT;
        })
        .sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null
    );
  }, [categoryFilter, filteredPlaylists, playlistFilter, searchQuery, viewMode]);

  const gridPlaylists = useMemo(
    () => (featuredPlaylist ? filteredPlaylists.filter((item) => item.id !== featuredPlaylist.id) : filteredPlaylists),
    [featuredPlaylist, filteredPlaylists],
  );

  /* Category shortcuts. Worth a band of their own only once the library is
     large enough for them to be a way in rather than a restatement of the
     three cards already on screen. */
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    playlists.forEach((playlist) => {
      if (!playlist.category) return;
      counts.set(playlist.category, (counts.get(playlist.category) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [playlists]);

  const showCategoryRail = !selectedPlaylist && !showSearchResults && playlists.length >= 6 && categoryCounts.length >= 3;

  const stats = [
    { label: t('playlistsLower'), value: playlists.length.toLocaleString() },
    { label: t('videosLower'), value: librarySummary.videos.toLocaleString() },
    { label: t('watchTime'), value: formatDuration(librarySummary.seconds, language) },
    { label: t('completed'), value: librarySummary.completed.toLocaleString() },
  ];

  return (
    <div className="page-container">
      <div className="content-max-width">
        {/* ── Masthead ──────────────────────────────────────────────────────
            One dominant thing (the title), one supporting rail (the numbers),
            and the two import actions. Everything below this is smaller and
            quieter than it, so the eye lands here first. */}
        <header className="mb-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="premium-pill mb-3">
                {t('localOnlyIslamicLibrary')}
              </div>
              <h1 className="text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.025em] text-text-primary">
                {t('library')}
              </h1>
            </div>

            <div className="flex shrink-0 flex-col gap-2.5 xl:items-end">
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <button
                  onClick={handleImportFolder}
                  disabled={importing}
                  className="btn-primary"
                >
                  {importing ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <FolderPlus className="h-4 w-4" />}
                  {t('importFolder')}
                </button>
                <button
                  onClick={handleImportSingleVideo}
                  disabled={importing}
                  className="btn-secondary"
                >
                  <FileVideo className="h-4 w-4" />
                  {t('importSingleVideo')}
                </button>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-text">
                <input
                  type="checkbox"
                  checked={includeSubfolders}
                  onChange={(event) => setIncludeSubfolders(event.target.checked)}
                  className="h-4 w-4 rounded border-border bg-panel accent-accent-gold"
                />
                {t('scanSubfoldersRecursively')}
              </label>
            </div>
          </div>

          {/* The library in four numbers, on a ruled band. Values read first,
              labels are captions — the reverse of the old metadata line where
              every part carried the same weight. */}
          <dl className="mt-6 grid grid-cols-2 border-y border-border sm:grid-cols-4">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={`px-5 py-3.5 first:ps-0 ${index > 0 ? 'sm:border-s sm:border-border' : ''}`}
              >
                <dd className="text-xl font-semibold tabular-nums tracking-[-0.01em] text-text-primary">
                  <bdi>{stat.value}</bdi>
                </dd>
                <dt className="mt-1 truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-text">
                  {stat.label}
                </dt>
              </div>
            ))}
          </dl>
        </header>

        <div className="mb-6 flex flex-col gap-3.5">
          {/* Toolbar: a quiet field and two segmented controls sharing a
              baseline rule. No panel, no boxed inputs, no filled toggles. */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-xl flex-1">
              <Search className="pointer-events-none absolute start-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
              <input
                type="text"
                placeholder={t('searchLibrary')}
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setSelectedPlaylist(null);
                }}
                className="field-quiet ps-7 pe-8 text-sm"
              />
              {searchInput && (
                <button
                  onClick={handleClearSearch}
                  title={t('clearSearch')}
                  aria-label={t('clearSearch')}
                  className="icon-btn absolute end-0 top-1/2 h-6 w-6 -translate-y-1/2"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <div className="segmented" role="group" aria-label={t('view')}>
                <button
                  type="button"
                  title={t('listView')}
                  aria-label={t('listView')}
                  aria-pressed={viewMode === 'list'}
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title={t('gridView')}
                  aria-label={t('gridView')}
                  aria-pressed={viewMode === 'grid'}
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-text">
                <SortAsc className="h-3.5 w-3.5" />
                <select
                  value={playlistSort}
                  onChange={(event) => setPlaylistSort(event.target.value as PlaylistSortKey)}
                  className="bg-transparent text-text-primary outline-none"
                >
                  <option value="recent">{t('recent')}</option>
                  <option value="name">{t('name')}</option>
                  <option value="videos">{t('mostVideos')}</option>
                  <option value="duration">{t('longest')}</option>
                  <option value="progress">{t('progress')}</option>
                </select>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="segmented" role="group" aria-label={t('filter')}>
              <button type="button" aria-pressed={playlistFilter === 'all'} onClick={() => setPlaylistFilter('all')}>
                {t('all')} <bdi>{playlists.length}</bdi>
              </button>
              <button type="button" aria-pressed={playlistFilter === 'in-progress'} onClick={() => setPlaylistFilter('in-progress')}>
                {t('inProgress')} <bdi>{librarySummary.inProgress}</bdi>
              </button>
              <button type="button" aria-pressed={playlistFilter === 'completed'} onClick={() => setPlaylistFilter('completed')}>
                {t('completed')} <bdi>{librarySummary.completed}</bdi>
              </button>
              <button type="button" aria-pressed={playlistFilter === 'empty'} onClick={() => setPlaylistFilter('empty')}>
                {t('empty')} <bdi>{librarySummary.empty}</bdi>
              </button>
            </div>
            <label className="ms-auto flex items-center gap-2 text-xs text-muted-text">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="bg-transparent text-text-primary outline-none"
              >
                <option value="">{t('allCategories')}</option>
                {CONTENT_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {t(category.labelKey)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {importError && (
            <div className="flex items-start gap-2 border-s-2 border-danger-red/70 ps-3 text-sm text-danger-red">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <bdi>{importError}</bdi>
            </div>
          )}

          {playlistsError && (
            <div className="flex items-start gap-2 border-s-2 border-warning-orange/70 ps-3 text-sm text-warning-orange">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <bdi>{playlistsError}</bdi>
            </div>
          )}

          {importResult && <ImportSummary result={importResult} />}
        </div>

        {selectedPlaylist ? (
          <PlaylistDetail
            playlist={selectedPlaylist}
            videos={playlistVideos}
            loading={playlistLoading}
            onBack={() => {
              setSelectedPlaylist(null);
              setPlaylistVideos([]);
            }}
            onPlayVideo={handlePlayVideo}
          />
        ) : showInitialLibraryLoading ? (
          <div>
            <SectionRule
              label={t('loadingLibrary')}
              className="mb-5"
              action={<Loader2 className="h-3.5 w-3.5 text-muted-text motion-safe:animate-spin" />}
            />
            <PlaylistGridSkeleton />
          </div>
        ) : showSearchResults ? (
          <>
            {searchError && (
              <div className="mb-4 flex items-start gap-2 border-s-2 border-danger-red/70 ps-3 text-xs text-danger-red">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="whitespace-pre-wrap"><bdi>{searchError}</bdi></span>
              </div>
            )}
            <SearchResults
              query={searchQuery}
              results={searchResults}
              onOpenPlaylist={openPlaylistDetail}
              onOpenVideo={handlePlayVideo}
            />
          </>
        ) : isSearching ? (
          <div>
            <SectionRule
              label={t('searching')}
              className="mb-5"
              action={<Loader2 className="h-3.5 w-3.5 text-muted-text motion-safe:animate-spin" />}
            />
            <PlaylistGridSkeleton rows={2} />
          </div>
        ) : playlists.length > 0 && filteredPlaylists.length === 0 ? (
          <div className="empty-panel flex flex-col items-center rounded-xl border border-border px-6 py-16 text-center">
            <SearchX className="h-7 w-7 text-text-faint" />
            <p className="mt-5 text-lg font-semibold tracking-[-0.01em] text-text-primary">{t('noPlaylistsMatch')}</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-text">{t('switchFilters')}</p>
            <button
              type="button"
              onClick={() => {
                setPlaylistFilter('all');
                setCategoryFilter('');
              }}
              className="btn-secondary mt-6 px-3.5 py-2 text-xs"
            >
              {t('clear')}
            </button>
          </div>
        ) : (
          <PlaylistGrid
            playlists={gridPlaylists}
            featured={featuredPlaylist}
            viewMode={viewMode}
            onOpenPlaylist={openPlaylistDetail}
            onContinuePlaylist={handleContinuePlaylist}
            onRescanPlaylist={handleRescan}
            onRegenerateThumbnails={handleRegenerateThumbnails}
            onRemovePlaylist={handleRemove}
            onImportFolder={handleImportFolder}
          />
        )}

        {showCategoryRail && (
          <section className="reveal mt-10">
            <SectionRule label={t('allCategories')} count={categoryCounts.length} className="mb-4" />
            <div className="flex flex-wrap gap-2">
              {categoryCounts.map(([category, count]) => {
                const known = findCategory(category);
                const active = categoryFilter === category;
                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategoryFilter(active ? '' : category)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                      active
                        ? 'border-accent-gold/45 bg-accent-gold/10 text-text-primary'
                        : 'border-border text-muted-text hover:border-accent-gold/30 hover:text-text-primary'
                    }`}
                  >
                    <bdi>{known ? t(known.labelKey) : category}</bdi>
                    <span className="tabular-nums text-text-faint"><bdi>{count}</bdi></span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

const ImportSummary: React.FC<{ result: ImportResult }> = ({ result }) => {
  const { t } = useI18n();
  const hasErrors = result.failed_count > 0 || result.errors.length > 0;

  return (
    <div className={`flex items-start gap-2 border-s-2 ps-3 text-sm ${
      hasErrors ? 'border-warning-orange/70 text-warning-orange' : 'border-success-green/70 text-success-green'
    }`}>
      {hasErrors ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0">
        <p>
          {t('importFolder')}: <bdi>{result.imported_count}</bdi> / {t('skipped')}: <bdi>{result.skipped_count}</bdi> / {t('failed')}: <bdi>{result.failed_count}</bdi>
        </p>
        {result.errors.length > 0 && (
          <ul className="mt-1 space-y-1 text-xs opacity-90">
            {result.errors.slice(0, 4).map((error) => (
              <li key={error} className="truncate" title={error}><bdi>{error}</bdi></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
