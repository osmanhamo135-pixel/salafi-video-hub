import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileVideo,
  Filter,
  FolderPlus,
  LayoutGrid,
  List,
  Loader2,
  Search,
  SlidersHorizontal,
  SortAsc,
  X,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { ImportResult, Playlist, Video } from '@/types';
import { useAppStore } from '@/store/appStore';
import { usePlayerStore } from '@/store/playerStore';
import { pickFolder, pickVideoFile } from '@/hooks/useTauriCommands';
import { PlaylistGrid } from '@/components/playlist/PlaylistGrid';
import { PlaylistDetail } from '@/components/playlist/PlaylistDetail';
import { SearchResults } from '@/components/playlist/SearchResults';
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

export const Library: React.FC = () => {
  const { t } = useI18n();
  const playlists = useAppStore((state) => state.playlists);
  const playlistsLoading = useAppStore((state) => state.playlistsLoading);
  const playlistsError = useAppStore((state) => state.playlistsError);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const searchResults = useAppStore((state) => state.searchResults);
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
      const path = await pickFolder();
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
      const path = await pickVideoFile();
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
          hours: summary.hours + playlist.totalDurationSeconds / 3600,
          inProgress: summary.inProgress + (progress > 0 && progress < 95 ? 1 : 0),
          completed: summary.completed + (progress >= 95 ? 1 : 0),
          empty: summary.empty + (playlist.videoCount === 0 ? 1 : 0),
        };
      },
      { videos: 0, hours: 0, inProgress: 0, completed: 0, empty: 0 },
    );
  }, [playlists]);

  const filteredPlaylists = useMemo(() => {
    const visible = playlists.filter((playlist) => {
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
  }, [playlistFilter, playlistSort, playlists]);

  return (
    <div className="page-container">
      <div className="content-max-width">
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="premium-pill mb-2">
                {t('localOnlyIslamicLibrary')}
              </div>
              <h1 className="text-3xl font-semibold tracking-normal text-text-primary">{t('library')}</h1>
              <p className="mt-1 text-sm text-muted-text">
                {playlists.length} {t('playlistsLower')} | {librarySummary.videos.toLocaleString()} {t('videosLower')} | {Math.round(librarySummary.hours).toLocaleString()}h
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  onClick={handleImportFolder}
                  disabled={importing}
                  className="btn-primary"
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
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
              <label className="ms-auto flex items-center gap-2 text-xs text-muted-text">
                <input
                  type="checkbox"
                  checked={includeSubfolders}
                  onChange={(event) => setIncludeSubfolders(event.target.checked)}
                  className="h-4 w-4 rounded border-border bg-panel text-primary-blue accent-primary-blue"
                />
                {t('scanSubfoldersRecursively')}
              </label>
            </div>
          </div>

          <div className="premium-surface flex flex-col gap-3 rounded-lg p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-xl flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
              <input
                type="text"
                placeholder={t('searchLibrary')}
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setSelectedPlaylist(null);
                }}
                className="surface-input w-full py-2.5 ps-10 pe-9"
              />
              {searchInput && (
                <button
                  onClick={handleClearSearch}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-text hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-md border border-border bg-background p-1">
                <ViewButton
                  label={t('gridView')}
                  active={viewMode === 'grid'}
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </ViewButton>
                <ViewButton
                  label={t('listView')}
                  active={viewMode === 'list'}
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </ViewButton>
              </div>

              <label className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-xs text-muted-text">
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

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-text">
              <Filter className="h-3.5 w-3.5" />
              {t('filter')}
            </div>
            <FilterChip
              label={`${t('all')} ${playlists.length}`}
              active={playlistFilter === 'all'}
              onClick={() => setPlaylistFilter('all')}
            />
            <FilterChip
              label={`${t('inProgress')} ${librarySummary.inProgress}`}
              active={playlistFilter === 'in-progress'}
              onClick={() => setPlaylistFilter('in-progress')}
            />
            <FilterChip
              label={`${t('completed')} ${librarySummary.completed}`}
              active={playlistFilter === 'completed'}
              onClick={() => setPlaylistFilter('completed')}
            />
            <FilterChip
              label={`${t('empty')} ${librarySummary.empty}`}
              active={playlistFilter === 'empty'}
              onClick={() => setPlaylistFilter('empty')}
            />
          </div>

          {importError && (
            <div className="flex items-start gap-2 rounded-md border border-danger-red/25 bg-danger-red/10 px-4 py-3 text-sm text-danger-red">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{importError}</span>
            </div>
          )}

          {playlistsError && (
            <div className="flex items-start gap-2 rounded-md border border-warning-orange/25 bg-warning-orange/10 px-4 py-3 text-sm text-warning-orange">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{playlistsError}</span>
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
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary-blue" />
            <p className="text-sm text-muted-text">{t('loadingLibrary')}</p>
          </div>
        ) : showSearchResults ? (
          <SearchResults
            query={searchQuery}
            results={searchResults}
            onOpenPlaylist={openPlaylistDetail}
            onOpenVideo={handlePlayVideo}
          />
        ) : isSearching ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary-blue" />
            <p className="text-sm text-muted-text">{t('searching')}</p>
          </div>
        ) : playlists.length > 0 && filteredPlaylists.length === 0 ? (
          <div className="premium-card ornate-corner relative flex flex-col items-center justify-center rounded-lg border-dashed px-6 py-20 text-center">
            <div className="icon-medallion mb-4 h-14 w-14">
              <SlidersHorizontal className="h-7 w-7 text-primary-blue/75" />
            </div>
            <h3 className="mb-1 text-base font-semibold text-text-primary">{t('noPlaylistsMatch')}</h3>
            <p className="max-w-sm text-sm text-muted-text">{t('switchFilters')}</p>
          </div>
        ) : (
          <PlaylistGrid
            playlists={filteredPlaylists}
            viewMode={viewMode}
            onOpenPlaylist={openPlaylistDetail}
            onContinuePlaylist={handleContinuePlaylist}
            onRescanPlaylist={handleRescan}
            onRegenerateThumbnails={handleRegenerateThumbnails}
            onRemovePlaylist={handleRemove}
          />
        )}
      </div>
    </div>
  );
};

const ViewButton: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, active, onClick, children }) => (
  <button
    type="button"
    title={label}
    onClick={onClick}
    className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
      active
        ? 'bg-primary-blue text-[#03110f]'
        : 'text-muted-text hover:bg-panel-hover hover:text-text-primary'
    }`}
  >
    {children}
  </button>
);

const FilterChip: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
      active
        ? 'border-primary-blue/35 bg-primary-blue/15 text-primary-blue'
        : 'border-border bg-panel text-muted-text hover:border-border-strong hover:text-text-primary'
    }`}
  >
    {label}
  </button>
);

const ImportSummary: React.FC<{ result: ImportResult }> = ({ result }) => {
  const { t } = useI18n();
  const hasErrors = result.failed_count > 0 || result.errors.length > 0;

  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${
      hasErrors
        ? 'border-warning-orange/30 bg-warning-orange/10 text-warning-orange'
        : 'border-success-green/25 bg-success-green/10 text-success-green'
    }`}>
      <div className="flex items-start gap-2">
        {hasErrors ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
        <div className="min-w-0">
          <p className="font-medium">
            {t('importFolder')}: {result.imported_count} / {t('skipped')}: {result.skipped_count} / {t('failed')}: {result.failed_count}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-1 space-y-1 text-xs opacity-90">
              {result.errors.slice(0, 4).map((error) => (
                <li key={error} className="truncate" title={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
