import React from 'react';
import { Playlist } from '@/types';
import { PlaylistCard } from './PlaylistCard';
import { useI18n } from '@/i18n';

interface PlaylistGridProps {
  playlists: Playlist[];
  viewMode?: 'grid' | 'list';
  onOpenPlaylist: (playlist: Playlist) => void;
  onContinuePlaylist: (playlist: Playlist) => void;
  onRescanPlaylist: (id: string) => void;
  onRegenerateThumbnails: (id: string) => void;
  onRemovePlaylist: (id: string) => void;
}

export const PlaylistGrid: React.FC<PlaylistGridProps> = ({
  playlists,
  viewMode = 'list',
  onOpenPlaylist,
  onContinuePlaylist,
  onRescanPlaylist,
  onRegenerateThumbnails,
  onRemovePlaylist,
}) => {
  const { t } = useI18n();

  if (playlists.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="text-sm text-muted-text">{t('noVideosYet')}</p>
        <p className="mt-1 text-xs text-text-faint">{t('importFolderHint')}</p>
      </div>
    );
  }

  return (
    <div className={viewMode === 'grid'
      ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6'
      : 'rule-list'
    }>
      {playlists.map((playlist) => (
        <PlaylistCard
          key={playlist.id}
          playlist={playlist}
          variant={viewMode}
          onOpen={onOpenPlaylist}
          onContinue={onContinuePlaylist}
          onRescan={onRescanPlaylist}
          onRegenerateThumbnails={onRegenerateThumbnails}
          onRemove={onRemovePlaylist}
        />
      ))}
    </div>
  );
};
