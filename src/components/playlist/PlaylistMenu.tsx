import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, FolderOpen, RefreshCw, Image, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';

interface PlaylistMenuProps {
  playlistId: string;
  playlistName: string;
  onOpen: () => void;
  onRescan: () => void;
  onRegenerateThumbnails: () => void;
  onRemove: () => void;
}

export const PlaylistMenu: React.FC<PlaylistMenuProps> = ({
  onOpen,
  onRescan,
  onRegenerateThumbnails,
  onRemove,
}) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const menuWidth = 220;
      const menuHeight = 178;
      const gap = 6;
      const top = rect.bottom + menuHeight + gap > window.innerHeight
        ? Math.max(8, rect.top - menuHeight - gap)
        : rect.bottom + gap;
      const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));

      setMenuPosition({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  const handleAction = (callback: () => void) => {
    setIsOpen(false);
    callback();
  };

  const menu = (
    <div
      ref={containerRef}
      className="fixed z-[9999] w-[220px] overflow-hidden rounded-lg border border-border bg-panel shadow-panel"
      style={{ top: menuPosition.top, left: menuPosition.left }}
    >
      <button
        onClick={() => handleAction(onOpen)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-panel-hover"
      >
        <FolderOpen className="w-4 h-4 text-muted-text" />
        {t('open')}
      </button>
      <button
        onClick={() => handleAction(onRescan)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-panel-hover"
      >
        <RefreshCw className="w-4 h-4 text-muted-text" />
        {t('rescan')}
      </button>
      <button
        onClick={() => handleAction(onRegenerateThumbnails)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-panel-hover"
      >
        <Image className="w-4 h-4 text-muted-text" />
        {t('regenerateThumbnails')}
      </button>
      <div className="border-t border-border" />
      <button
        onClick={() => handleAction(onRemove)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-danger-red transition-colors hover:bg-danger-red/10"
      >
        <Trash2 className="w-4 h-4" />
        {t('removeFromLibrary')}
      </button>
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 rounded-md text-muted-text hover:text-text-primary hover:bg-elevated-panel transition-colors"
        aria-label={t('playlistOptions')}
        aria-expanded={isOpen}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && createPortal(menu, document.body)}
    </div>
  );
};
