import React, { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Video } from '@/types';
import { useAppStore } from '@/store/appStore';
import { useI18n } from '@/i18n';

/**
 * Study activity, drawn from the library rather than from a chart library.
 *
 * Two figures a student of knowledge actually checks: how much they have been
 * studying lately, and whether the habit is unbroken. Both are computed from
 * `lastPlayedAt` on the videos already in the database — no new command, no
 * new table, no telemetry.
 *
 * Honest limitation, stated because the shape of the data invites a wrong
 * reading: `lastPlayedAt` records only the MOST RECENT play of each video, so
 * a video studied on four separate days contributes to one day, not four.
 * These are therefore "lessons touched per day", not "minutes watched per
 * day", and the label says so. A truthful weaker statistic beats an
 * impressive invented one.
 *
 * Everything is SVG built from theme tokens: one accent, no second hue, no
 * gradients on text, and no fixed colour anywhere — so it recolours across all
 * ten themes with no per-theme code, and it renders identically on Pearl.
 */

const DAYS = 28;
const DAY_MS = 86_400_000;

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

interface Bucket {
  day: number;
  count: number;
  seconds: number;
}

export const StudyCharts: React.FC = () => {
  const { t, language } = useI18n();
  const [videos, setVideos] = useState<Video[] | null>(null);
  const loadedRef = useRef(false);
  const progressRefreshVersion = useAppStore((s) => s.progressRefreshVersion);
  const importRefreshVersion = useAppStore((s) => s.importRefreshVersion);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await invoke<Video[]>('get_all_videos');
        if (!cancelled) setVideos(data || []);
      } catch (error) {
        console.error('Failed to load study activity:', error);
        if (!cancelled) setVideos([]);
      } finally {
        loadedRef.current = true;
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [importRefreshVersion, progressRefreshVersion]);

  const { buckets, streak, totalDays, busiest } = useMemo(() => {
    const today = startOfDay(Date.now());
    const empty: Bucket[] = Array.from({ length: DAYS }, (_, i) => ({
      day: today - (DAYS - 1 - i) * DAY_MS,
      count: 0,
      seconds: 0,
    }));
    if (!videos?.length) return { buckets: empty, streak: 0, totalDays: 0, busiest: 0 };

    const index = new Map(empty.map((b, i) => [b.day, i]));
    for (const v of videos) {
      if (!v.lastPlayedAt || v.progressSeconds <= 0) continue;
      const slot = index.get(startOfDay(v.lastPlayedAt));
      if (slot === undefined) continue;
      empty[slot].count += 1;
      empty[slot].seconds += v.progressSeconds;
    }

    // Streak runs back from today; a gap today alone does not break it, since
    // the day is still in progress.
    let run = 0;
    for (let i = empty.length - 1; i >= 0; i -= 1) {
      if (empty[i].count > 0) run += 1;
      else if (i !== empty.length - 1) break;
    }

    return {
      buckets: empty,
      streak: run,
      totalDays: empty.filter((b) => b.count > 0).length,
      busiest: Math.max(...empty.map((b) => b.count)),
    };
  }, [videos]);

  if (videos === null) return <ChartsSkeleton />;

  const peak = Math.max(busiest, 1);
  const W = 100;
  const H = 30;
  const step = W / (DAYS - 1);

  // A closed area path plus its top line. Rendered in a normalised viewBox and
  // stretched, so it stays crisp at any container width without measuring.
  const points = buckets.map((b, i) => [i * step, H - (b.count / peak) * H] as const);
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;

  const fmtDay = (ms: number) =>
    new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', { day: 'numeric', month: 'short' }).format(ms);

  return (
    <section className="mt-9">
      <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-border pb-3">
        <h2
          className={
            language === 'ar'
              ? 'text-[11px] font-medium text-muted-text'
              : 'text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-text'
          }
        >
          {t('studyActivity')}
        </h2>
        <span className="text-[11px] tabular-nums text-text-faint">
          <bdi>{DAYS}</bdi> {t('lastNDays')}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
        {/* Activity over time. */}
        <div className="glass p-5">
          <div className="flex items-baseline gap-3">
            <p className="text-4xl font-semibold leading-none tabular-nums text-text-primary">
              <bdi>{totalDays}</bdi>
            </p>
            <p className="text-sm text-muted-text">{t('daysStudied')}</p>
          </div>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="mt-5 h-24 w-full"
            role="img"
            aria-label={t('studyActivityChartLabel')}
          >
            <defs>
              {/* Token-derived, so the fill follows the theme accent. The
                  gradient is on the AREA, never on text. */}
              <linearGradient id="study-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--accent-gold-rgb))" stopOpacity="0.30" />
                <stop offset="100%" stopColor="rgb(var(--accent-gold-rgb))" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#study-area)" />
            <path
              d={line}
              fill="none"
              stroke="rgb(var(--accent-gold-rgb))"
              strokeWidth="0.7"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div className="mt-2 flex justify-between text-[10px] tabular-nums text-text-faint">
            <bdi>{fmtDay(buckets[0].day)}</bdi>
            <bdi>{fmtDay(buckets[buckets.length - 1].day)}</bdi>
          </div>
          <p className="mt-3 text-xs text-muted-text">{t('studyActivityCaption')}</p>
        </div>

        {/* The streak, and the same 28 days as a calendar band. */}
        <div className="glass p-5">
          <div className="flex items-baseline gap-3">
            <p className="text-4xl font-semibold leading-none tabular-nums text-accent-gold">
              <bdi>{streak}</bdi>
            </p>
            <p className="text-sm text-muted-text">
              {streak === 1 ? t('dayStreak') : t('dayStreakPlural')}
            </p>
          </div>

          {/* Seven columns, four rows: a week reads across, which is how a
              habit is actually checked. */}
          <div className="mt-5 grid grid-cols-7 gap-1.5">
            {buckets.map((b) => {
              const level = b.count === 0 ? 0 : Math.min(3, Math.ceil((b.count / peak) * 3));
              return (
                <span
                  key={b.day}
                  title={`${fmtDay(b.day)} · ${b.count}`}
                  className="aspect-square rounded-[3px]"
                  style={{
                    background:
                      level === 0
                        ? 'rgb(var(--sheen-rgb) / 0.06)'
                        : `rgb(var(--accent-gold-rgb) / ${0.22 + level * 0.24})`,
                  }}
                />
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted-text">{t('studyStreakCaption')}</p>
        </div>
      </div>
    </section>
  );
};

const ChartsSkeleton: React.FC = () => (
  <section className="mt-9">
    <div className="mb-5 h-3 w-32 rounded bg-panel-hover motion-safe:animate-pulse" />
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
      <div className="glass h-56 motion-safe:animate-pulse" />
      <div className="glass h-56 motion-safe:animate-pulse" />
    </div>
  </section>
);
