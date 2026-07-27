import React, { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { Video } from '@/types';
import { useAppStore } from '@/store/appStore';
import { usePlayerStore } from '@/store/playerStore';
import { LessonRail } from '@/components/dashboard/LessonRail';
import { useI18n } from '@/i18n';

/**
 * The rails that give the Dashboard its density.
 *
 * One fetch, three views of it — recently added, and the two largest
 * categories the library actually contains. Categories are derived rather
 * than hardcoded: a library of tafsir and one of fiqh should not both be told
 * they have a Hadith row.
 */
export const DashboardRails: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Video[]>([]);
  const importRefreshVersion = useAppStore((s) => s.importRefreshVersion);
  const thumbnailRefreshVersion = useAppStore((s) => s.thumbnailRefreshVersion);
  const openPlaylist = usePlayerStore((s) => s.openPlaylist);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await invoke<Video[]>('get_all_videos');
        if (!cancelled) setVideos(data || []);
      } catch (error) {
        console.error('Failed to load rails:', error);
        if (!cancelled) setVideos([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [importRefreshVersion, thumbnailRefreshVersion]);

  const open = (video: Video) => {
    void openPlaylist('', video.id).catch(() => undefined);
    navigate('/player');
  };

  const recent = useMemo(
    () => [...videos].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20),
    [videos],
  );

  /* The two biggest categories present, so the rails describe this library
     rather than an imagined one. Anything under three items is not a row. */
  const categories = useMemo(() => {
    const counts = new Map<string, Video[]>();
    for (const v of videos) {
      if (!v.category) continue;
      const list = counts.get(v.category);
      if (list) list.push(v);
      else counts.set(v.category, [v]);
    }
    return [...counts.entries()]
      .filter(([, list]) => list.length >= 3)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 2);
  }, [videos]);

  if (!videos.length) return null;

  return (
    <>
      <LessonRail title={t('recentlyAdded')} videos={recent} onOpen={open} />
      {categories.map(([name, list]) => (
        <LessonRail key={name} title={name} videos={list.slice(0, 20)} onOpen={open} />
      ))}
    </>
  );
};
