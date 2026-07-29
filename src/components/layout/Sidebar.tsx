import React, { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Bell,
  GraduationCap,
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  Download,
  LayoutDashboard,
  Library,
  MonitorPlay,
  RadioTower,
  Settings,
  Sparkles,
} from 'lucide-react';
import appIcon from '@/assets/app-icon.png';
import { APP_NAME, APP_STAGE } from '@/utils/constants';
import { TranslationKey, useI18n } from '@/i18n';
import { useRemindersStore } from '@/store/remindersStore';
import { useDownloadStore } from '@/store/downloadStore';
import { useShuyukhStore } from '@/store/shuyukhStore';
import { getNextReminderOccurrence } from '@/utils/reminderSchedule';

/**
 * Eight undifferentiated rows gave the nav no rhythm and no sense of what the
 * app is for. Grouped, it reads as a shape: the day's landing, the things you
 * study with, and the things you maintain.
 *
 * Beyond the grouping, the rail now carries live state — how many reminders
 * come due today, whether a download is running — because a sidebar that
 * knows nothing about the app it navigates is furniture. And it collapses to
 * an icon rail: the mushaf and the player are both places where 240px of
 * chrome is 240px of distraction.
 */
const navGroups = [
  {
    labelKey: null,
    items: [{ path: '/', labelKey: 'navDashboard', icon: LayoutDashboard }],
  },
  {
    labelKey: 'navGroupStudy',
    items: [
      { path: '/quran', labelKey: 'navQuran', icon: BookOpen },
      { path: '/library', labelKey: 'navLibrary', icon: Library },
      { path: '/watch', labelKey: 'navWatch', icon: MonitorPlay },
      { path: '/shuyukh', labelKey: 'navShuyukh', icon: GraduationCap },
      { path: '/radio', labelKey: 'navRadio', icon: RadioTower },
    ],
  },
  {
    labelKey: 'navGroupManage',
    items: [
      { path: '/reminders', labelKey: 'navReminders', icon: Bell },
      { path: '/downloads', labelKey: 'navDownloads', icon: Download },
      { path: '/settings', labelKey: 'navSettings', icon: Settings },
    ],
  },
] satisfies Array<{
  labelKey: TranslationKey | null;
  items: Array<{
    path: string;
    labelKey: TranslationKey;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}>;

const COLLAPSE_KEY = 'salafi-hub.sidebar-collapsed';

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
};

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { t } = useI18n();
  const isPlayerOpen = location.pathname === '/player';
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const reminders = useRemindersStore((s) => s.reminders);
  const activeJobId = useDownloadStore((s) => s.activeJobId);
  const shuyukhNew = useShuyukhStore((s) =>
    s.profiles.reduce((sum, p) => sum + p.newCount, 0),
  );

  /* Reminders due before this day ends. Memoised on the list, not the clock:
     the count only needs to be right when the sidebar renders, and it renders
     on every navigation — a per-minute timer here would buy nothing. */
  const dueTodayCount = useMemo(() => {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return reminders.filter((r) => {
      if (!r.enabled) return false;
      const next = getNextReminderOccurrence(r);
      return next !== null && next.getTime() <= endOfDay.getTime();
    }).length;
  }, [reminders]);

  const badgeFor = (path: string): { count?: number; pulse?: boolean } | null => {
    if (path === '/reminders' && dueTodayCount > 0) return { count: dueTodayCount };
    if (path === '/downloads' && activeJobId) return { pulse: true };
    if (path === '/shuyukh' && shuyukhNew > 0) return { count: shuyukhNew };
    return null;
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* persistence is a nicety, not a requirement */
      }
      return next;
    });
  };

  return (
    <aside
      /* relative z-[1] so the sidebar sits above the fixed ambient layer.
         AmbientLayer is positioned at z-index 0, which paints it above
         non-positioned in-flow siblings — without this the sidebar's own fill
         and its group labels disappear underneath it. */
      className={`app-sidebar sidebar-glass relative z-[1] flex flex-col border-e border-border transition-all duration-200 ${
        isPlayerOpen ? 'w-0 opacity-0 overflow-hidden' : collapsed ? 'w-[76px] opacity-100' : 'w-[240px] opacity-100'
      }`}
    >
      {/* Logo */}
      <div
        className={`sidebar-head flex items-center border-b border-border py-5 ${
          collapsed ? 'flex-col gap-2 px-2' : 'gap-3 px-5'
        }`}
      >
        {!collapsed && <div className="gold-thread absolute inset-x-5 bottom-0" />}
        <div className={`brand-mark shrink-0 overflow-hidden p-1 ${collapsed ? 'h-10 w-10' : 'h-14 w-14'}`}>
          <img
            src={appIcon}
            alt=""
            className="relative z-10 h-full w-full rounded-full object-cover"
            draggable={false}
          />
        </div>
        {!collapsed && (
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold leading-tight text-text-primary">{APP_NAME}</h1>
              <span className="rounded border border-accent-gold/25 bg-accent-gold/10 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-accent-gold">
                {APP_STAGE}
              </span>
            </div>
            <span className="truncate text-[10px] text-accent-gold/80">{t('privateLocalLibrary')}</span>
          </div>
        )}
      </div>

      {/* Collapse toggle — its own quiet strip so the header stays a brand
          block and the nav stays navigation. */}
      <div className={`flex border-b border-border/60 px-2 py-1.5 ${collapsed ? 'justify-center' : 'justify-end'}`}>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? t('sidebarExpand') : t('sidebarCollapse')}
          title={collapsed ? t('sidebarExpand') : t('sidebarCollapse')}
          className="rounded-md p-1.5 text-text-faint transition-colors hover:bg-elevated-panel hover:text-muted-text"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto py-4 ${collapsed ? 'px-2' : 'px-3'}`}>
        {navGroups.map((group, groupIndex) => (
          <div key={group.labelKey ?? 'primary'} className={groupIndex > 0 ? (collapsed ? 'mt-5' : 'mt-8') : ''}>
            {group.labelKey &&
              (collapsed ? (
                <div className="mx-2 mb-3 border-t border-border/70" aria-hidden="true" />
              ) : (
                <p className="px-3 pb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint">
                  {t(group.labelKey)}
                </p>
              ))}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.path ||
                  (item.path !== '/' && location.pathname.startsWith(item.path));
                const badge = badgeFor(item.path);

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={collapsed ? t(item.labelKey) : undefined}
                    className={({ isActive: linkActive }) =>
                      `side-nav group relative flex items-center text-sm font-medium ${
                        collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
                      } ${
                        linkActive || isActive
                          ? 'side-nav-active text-text-primary'
                          : 'text-muted-text hover:text-text-primary'
                      }`
                    }
                  >
                    {({ isActive: linkActive }) => (
                      <>
                        <span className="relative shrink-0">
                          <Icon
                            className={`h-[18px] w-[18px] transition-colors duration-150 ${
                              linkActive || isActive
                                ? 'text-accent-gold'
                                : 'text-text-faint group-hover:text-muted-text'
                            }`}
                          />
                          {/* Collapsed: the badge shrinks to a corner dot so
                              the rail stays a rail. */}
                          {collapsed && badge && (
                            <span
                              className={`absolute -end-1 -top-1 h-2 w-2 rounded-full bg-accent-gold ${
                                badge.pulse ? 'motion-safe:animate-pulse' : ''
                              }`}
                            />
                          )}
                        </span>
                        {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                        {!collapsed && badge && (
                          <span
                            className={`ms-auto flex items-center ${
                              badge.count !== undefined
                                ? 'rounded-full bg-accent-gold/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-accent-gold'
                                : ''
                            }`}
                          >
                            {badge.count !== undefined ? (
                              badge.count
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-accent-gold motion-safe:animate-pulse" />
                            )}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer — the brand block on its own ornamental ground. */}
      <div className={`sidebar-foot border-t border-border py-4 ${collapsed ? 'px-0' : 'px-5'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
          <Sparkles className="h-4 w-4 shrink-0 text-accent-gold/70" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-text-primary">{t('offlineStorage')}</p>
              <p className="truncate text-[10px] text-muted-text">{t('offlineStorageDetail')}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
