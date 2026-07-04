import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '@/store/playerStore';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const skipBackward = usePlayerStore((state) => state.skipBackward);
  const skipForward = usePlayerStore((state) => state.skipForward);
  const toggleMute = usePlayerStore((state) => state.toggleMute);
  const next = usePlayerStore((state) => state.next);
  const previous = usePlayerStore((state) => state.previous);
  const leavePlayerView = usePlayerStore((state) => state.leavePlayerView);
  const isPlayerOpen = usePlayerStore((state) => state.isPlayerOpen);
  const isFullscreen = usePlayerStore((state) => state.isFullscreen);
  const toggleFullscreen = usePlayerStore((state) => state.toggleFullscreen);
  const setRepeatMode = usePlayerStore((state) => state.setRepeatMode);
  const repeatMode = usePlayerStore((state) => state.repeatMode);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlayerOpen) return;

      // Don't trigger shortcuts when typing in inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipForward();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          next();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          previous();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          const modes: ('none' | 'one' | 'playlist')[] = ['none', 'one', 'playlist'];
          const currentIndex = modes.indexOf(repeatMode);
          const nextMode = modes[(currentIndex + 1) % modes.length];
          setRepeatMode(nextMode);
          break;
        case 'Escape':
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen?.().catch(console.error);
            return;
          }
          if (isFullscreen) {
            toggleFullscreen();
            return;
          }
          leavePlayerView();
          navigate('/library');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlayerOpen, isFullscreen, togglePlay, skipBackward, skipForward, toggleFullscreen, toggleMute, next, previous, leavePlayerView, navigate, setRepeatMode, repeatMode]);
}
