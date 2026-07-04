import React from 'react';
import { Playlist } from '@/types';
import { PlaylistCard } from './PlaylistCard';
import { FolderOpen } from 'lucide-react';

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
  viewMode = 'grid',
  onOpenPlaylist,
  onContinuePlaylist,
  onRescanPlaylist,
  onRegenerateThumbnails,
  onRemovePlaylist,
}) => {
  if (playlists.length === 0) {
    return (
      <div className="premium-card ornate-corner relative flex flex-col items-center justify-center rounded-lg border-dashed px-6 py-24 text-center">
        <div className="icon-medallion mb-4 h-16 w-16">
          <FolderOpen className="h-8 w-8 text-primary-blue/80" />
        </div>
        <h3 className="text-base font-semibold text-text-primary mb-1">Import a local folder to begin.</h3>
        <p className="text-sm text-muted-text max-w-sm">
          Each imported folder becomes one playlist. Your video files stay private on this computer.
        </p>
      </div>
    );
  }

  return (
    <div className={viewMode === 'grid'
      ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6'
      : 'flex flex-col gap-2'
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
