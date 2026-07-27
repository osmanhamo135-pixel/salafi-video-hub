import React, { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Video } from '@/types';
import { useAppStore } from '@/store/appStore';
import { SectionHead } from '@/components/ui/SectionHead';
import { useI18n } from '@/i18n';

/**
 * Study activity, drawn from the library the user already has.
 *
 * Two figures a student of knowledge actually checks: how much they have been
 * studying lately, and whether the habit is unbroken. Both are computed from
 * `lastPlayedAt` on videos already in the database — no new command, no new
 * table, no telemetry.
 *
 * Honest limitation, stated because the shape of the data invites a wrong
 * reading: `lastPlayedAt` records only the MOST RECENT play of each video, so
 * a lesson studied on four separate days contributes to one day, not four.
 * These are "lessons you returned to, by day", not "minutes watched", and the
 * caption says so. A truthful weaker statistic beats an impressive invented one.
 *
 * Every colour is `rgb(var(--token))`, which the browser resolves per theme —
 * so recharts recolours across all ten themes with no per-theme code and no
 * JS reading computed styles.
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
  label: string;
  count: number;
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

  const fmtDay = useMemo(
    () =>
      new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', {
        day: 'numeric',
        month: 'short',
      }),
    [language],
  );

  const { buckets, streak, totalDays, peak } = useMemo(() => {
    const today = startOfDay(Date.now());
    const empty: Bucket[] = Array.from({ length: DAYS }, (_, i) => {
      const day = today - (DAYS - 1 - i) * DAY_MS;
      return { day, label: fmtDay.format(day), count: 0 };
    });
    if (!videos?.length) return { buckets: empty, streak: 0, totalDays: 0, peak: 1 };

    const index = new Map(empty.map((b, i) => [b.day, i]));
    for (const v of videos) {
      if (!v.lastPlayedAt || v.progressSeconds <= 0) continue;
      const slot = index.get(startOfDay(v.lastPlayedAt));
      if (slot === undefined) continue;
      empty[slot].count += 1;
    }

    // The streak runs back from today. A gap today alone does not break it —
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
      peak: Math.max(1, ...empty.map((b) => b.count)),
    };
  }, [videos, fmtDay]);

  if (videos === null) return <ChartsSkeleton />;

  return (
    <section className="reveal mt-9">
      <SectionHead
        className="mb-5"
        title={t('studyActivity')}
        meta={
          <>
            <bdi>{DAYS}</bdi> {t('lastNDays')}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
        <div className="glass glow-edge p-5">
          <div className="flex items-baseline gap-3">
            <p className="text-4xl font-semibold leading-none tabular-nums text-text-primary">
              <bdi>{totalDays}</bdi>
            </p>
            <p className="text-sm text-muted-text">{t('daysStudied')}</p>
          </div>

          <div className="mt-5 h-32 w-full" role="img" aria-label={t('studyActivityChartLabel')}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={buckets} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  {/* Token-derived, so the fill follows the active theme's
                      accent. The gradient is on the AREA, never on text. */}
                  <linearGradient id="study-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--accent-gold-rgb))" stopOpacity={0.34} />
                    <stop offset="100%" stopColor="rgb(var(--accent-gold-rgb))" stopOpacity={0} />
                  </linearGradient>
                  {/* The "glowing stroke": the line drawn twice, once blurred
                      underneath. A filter on a 28-point path is cheap; a
                      filter on a full-screen surface would not be. */}
                  <filter id="study-glow" x="-20%" y="-40%" width="140%" height="200%">
                    <feGaussianBlur stdDeviation="2.4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <CartesianGrid
                  vertical={false}
                  stroke="rgb(var(--sheen-rgb) / 0.06)"
                  strokeDasharray="0"
                />
                <XAxis dataKey="label" hide />
                <YAxis hide domain={[0, peak]} />
                <Tooltip
                  cursor={{ stroke: 'rgb(var(--accent-gold-rgb) / 0.35)', strokeWidth: 1 }}
                  contentStyle={{
                    background: 'rgb(var(--bg-panel-rgb) / 0.94)',
                    border: '1px solid rgb(var(--hair-rgb) / 0.22)',
                    borderRadius: 'var(--r-md)',
                    fontSize: 12,
                    color: 'rgb(var(--text-main-rgb))',
                    backdropFilter: 'blur(12px)',
                  }}
                  labelStyle={{ color: 'rgb(var(--text-muted-rgb))' }}
                  formatter={(value) => [String(value ?? 0), t('lessonsTouched')] as [string, string]}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="rgb(var(--accent-gold-rgb))"
                  strokeWidth={2}
                  fill="url(#study-area)"
                  filter="url(#study-glow)"
                  isAnimationActive={false}
                  activeDot={{
                    r: 3.5,
                    fill: 'rgb(var(--accent-gold-rgb))',
                    stroke: 'rgb(var(--bg-main-rgb))',
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex justify-between text-[10px] tabular-nums text-text-faint">
            <bdi>{buckets[0].label}</bdi>
            <bdi>{buckets[buckets.length - 1].label}</bdi>
          </div>
          <p className="mt-3 text-xs text-muted-text">{t('studyActivityCaption')}</p>
        </div>

        {/* The streak. A heatmap, not a chart — recharts has no calendar and
            faking one from a scatter costs more than 20 lines of grid. */}
        <div className="glass glow-edge p-5">
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
                  title={`${b.label} · ${b.count}`}
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
  <section className="reveal mt-9">
    <div className="mb-5 h-3 w-32 rounded bg-panel-hover motion-safe:animate-pulse" />
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
      <div className="glass h-56 motion-safe:animate-pulse" />
      <div className="glass h-56 motion-safe:animate-pulse" />
    </div>
  </section>
);
