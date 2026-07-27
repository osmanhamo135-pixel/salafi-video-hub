import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Library, LayoutDashboard, Play, RadioTower, Search } from 'lucide-react';
import { Video } from '@/types';
import { useAppStore } from '@/store/appStore';
import { usePlayerStore } from '@/store/playerStore';
import { useQuranStore } from '@/store/quranStore';
import { useRadioStore } from '@/store/radioStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useI18n } from '@/i18n';

/**
 * Ctrl+K across everything the app holds.
 *
 * Hand-built rather than `cmdk`: the whole visual vocabulary it needs —
 * `.rule-list`, `.rule-row`, the glass surface, the two-tone focus ring —
 * already exists here, and cmdk would arrive with its own opinions about all
 * three plus a colour model that does not read CSS custom properties. What is
 * left is a filtered list and a roving selection, which is the part that was
 * never the hard bit.
 *
 * The riwayah rule is load-bearing. A surah result opens in whatever riwayah
 * is ACTIVE — it never sets one. Recitation timing data is Hafs-only, so a
 * result that silently switched the reader to Warsh would point the word-sync
 * tracker at a text whose ayah numbering does not match its timings.
 */

type Kind = 'surah' | 'station' | 'video' | 'playlist' | 'page';

interface Item {
  id: string;
  kind: Kind;
  title: string;
  subtitle?: string;
  run: () => void;
}

const KIND_ICON: Record<Kind, React.ComponentType<{ className?: string }>> = {
  surah: BookOpen,
  station: RadioTower,
  video: Play,
  playlist: Library,
  page: LayoutDashboard,
};

/** Prefix beats substring; earlier match beats later. Recency is the tiebreak
 *  the caller supplies by ordering its own source list. */
const score = (haystack: string, needle: string) => {
  const h = haystack.toLowerCase();
  const i = h.indexOf(needle);
  if (i === -1) return -1;
  if (i === 0) return 1000;
  // A match at a word boundary reads as intentional; mid-word is incidental.
  return h[i - 1] === ' ' || h[i - 1] === '-' ? 500 - i : 100 - i;
};

export const CommandPalette: React.FC = () => {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [videos, setVideos] = useState<Video[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<Element | null>(null);

  const surahs = useQuranStore((s) => s.surahs);
  const openSurah = useQuranStore((s) => s.openSurah);
  const loadSurahs = useQuranStore((s) => s.loadSurahs);
  const stations = useRadioStore((s) => s.stations);
  const loadStations = useRadioStore((s) => s.loadStations);
  const playStation = useRadioStore((s) => s.play);
  const playlists = useAppStore((s) => s.playlists);
  const openPlaylist = usePlayerStore((s) => s.openPlaylist);
  const settings = useSettingsStore((s) => s.settings);

  /* Ctrl+K / Cmd+K. Bound on the window rather than through the existing
     player shortcut hook, which early-returns unless the player is open. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* Sources are loaded lazily on first open, not at app start: the palette
     should not cost a Rust round trip for a user who never presses Ctrl+K. */
  useEffect(() => {
    if (!open) return;
    restoreFocusTo.current = document.activeElement;
    setQuery('');
    setActive(0);
    void loadSurahs();
    void loadStations(settings?.language ?? language);
    if (!videos.length) {
      invoke<Video[]>('get_all_videos')
        .then((v) => setVideos(v || []))
        .catch(() => setVideos([]));
    }
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    // Return focus where it was — a palette that drops focus on the body
    // strands keyboard users on the next Tab.
    const el = restoreFocusTo.current as HTMLElement | null;
    if (el && typeof el.focus === 'function') el.focus();
  }, []);

  const pages: Item[] = useMemo(
    () => [
      { id: 'p-dash', kind: 'page', title: t('navDashboard'), run: () => navigate('/') },
      { id: 'p-quran', kind: 'page', title: t('navQuran'), run: () => navigate('/quran') },
      { id: 'p-lib', kind: 'page', title: t('navLibrary'), run: () => navigate('/library') },
      { id: 'p-watch', kind: 'page', title: t('navWatch'), run: () => navigate('/watch') },
      { id: 'p-radio', kind: 'page', title: t('navRadio'), run: () => navigate('/radio') },
      { id: 'p-rem', kind: 'page', title: t('navReminders'), run: () => navigate('/reminders') },
      { id: 'p-dl', kind: 'page', title: t('navDownloads'), run: () => navigate('/downloads') },
      { id: 'p-set', kind: 'page', title: t('navSettings'), run: () => navigate('/settings') },
    ],
    [navigate, t],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    const build = (): Item[] => [
      ...surahs.map((s) => ({
        id: `s-${s.id}`,
        kind: 'surah' as const,
        title: language === 'ar' ? s.name : s.transliteration,
        subtitle: `${s.id} · ${language === 'ar' ? s.transliteration : s.name}`,
        run: () => {
          // Opens in the ACTIVE riwayah. Never sets one — see the docblock.
          void openSurah(s.id);
          navigate('/quran');
        },
      })),
      ...videos.map((v) => ({
        id: `v-${v.id}`,
        kind: 'video' as const,
        title: v.title,
        subtitle: v.speaker ?? v.category ?? undefined,
        run: () => {
          void openPlaylist('', v.id).catch(() => undefined);
          navigate('/player');
        },
      })),
      ...playlists.map((p) => ({
        id: `pl-${p.id}`,
        kind: 'playlist' as const,
        title: p.name,
        subtitle: `${p.videoCount}`,
        run: () => {
          void openPlaylist(p.id);
          navigate('/player');
        },
      })),
      ...stations.map((st) => ({
        id: `st-${st.id}`,
        kind: 'station' as const,
        title: st.name,
        run: () => {
          void playStation(st);
        },
      })),
      ...pages,
    ];

    const all = build();
    if (!q) {
      // Empty query is a launcher, not a dump: routes plus a little recency.
      return [...pages, ...all.filter((i) => i.kind === 'video').slice(0, 5)];
    }
    return all
      .map((i) => ({ i, s: Math.max(score(i.title, q), i.subtitle ? score(i.subtitle, q) - 200 : -1) }))
      .filter((x) => x.s > -1)
      .sort((a, b) => b.s - a.s)
      .slice(0, 40)
      .map((x) => x.i);
  }, [query, surahs, videos, playlists, stations, pages, language, navigate, openSurah, openPlaylist, playStation]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[active];
      if (item) {
        close();
        item.run();
      }
    } else if (e.key === 'Tab') {
      // The palette is the whole interaction while it is open; trapping Tab
      // is simpler and less surprising than cycling two controls.
      e.preventDefault();
    }
  };

  return (
    <div
      className="palette-scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="palette glass glow-edge"
        role="dialog"
        aria-modal="true"
        aria-label={t('paletteLabel')}
        onKeyDown={onKeyDown}
      >
        <div className="palette-field">
          <Search className="h-4 w-4 shrink-0 text-text-faint" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('palettePlaceholder')}
            aria-label={t('paletteLabel')}
            aria-controls="palette-results"
            aria-activedescendant={results[active] ? `pal-${results[active].id}` : undefined}
            role="combobox"
            aria-expanded="true"
            className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-faint"
            dir="auto"
          />
          <kbd className="palette-kbd">Esc</kbd>
        </div>

        <div id="palette-results" ref={listRef} role="listbox" className="palette-list rule-list">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-text">{t('paletteEmpty')}</p>
          ) : (
            results.map((item, i) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <div
                  key={item.id}
                  id={`pal-${item.id}`}
                  role="option"
                  aria-selected={i === active}
                  data-active={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => {
                    close();
                    item.run();
                  }}
                  className="palette-row"
                >
                  <Icon className="h-4 w-4 shrink-0 text-text-faint" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm text-text-primary" dir="auto">
                    {item.title}
                  </span>
                  {item.subtitle && (
                    <span className="shrink-0 truncate text-[11px] text-text-faint" dir="auto">
                      <bdi>{item.subtitle}</bdi>
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
