import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bell, BookOpen, Download, LayoutDashboard, Library, MonitorPlay, RadioTower, Settings, Sparkles } from 'lucide-react';
import appIcon from '@/assets/app-icon.png';
import { APP_NAME, APP_STAGE } from '@/utils/constants';
import { TranslationKey, useI18n } from '@/i18n';

/**
 * Eight undifferentiated rows gave the nav no rhythm and no sense of what the
 * app is for. Grouped, it reads as a shape: the day's landing, the things you
 * study with, and the things you maintain.
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

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { t } = useI18n();
  const isPlayerOpen = location.pathname === '/player';

  return (
    <aside 
      /* relative z-[1] so the sidebar sits above the fixed ambient layer.
         AmbientLayer is positioned at z-index 0, which paints it above
         non-positioned in-flow siblings — without this the sidebar's own fill
         and its group labels disappear underneath it. */
      className={`app-sidebar sidebar-glass relative z-[1] flex flex-col border-e border-border transition-all duration-200 ${
        isPlayerOpen ? 'w-0 opacity-0 overflow-hidden' : 'w-[240px] opacity-100'
      }`}
    >
      {/* Logo */}
      <div className="relative flex items-center gap-3 border-b border-border px-5 py-5">
        <div className="gold-thread absolute inset-x-5 bottom-0" />
        <div className="brand-mark h-14 w-14 shrink-0 overflow-hidden p-1">
          <img
            src={appIcon}
            alt=""
            className="relative z-10 h-full w-full rounded-full object-cover"
            draggable={false}
          />
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold leading-tight text-text-primary">{APP_NAME}</h1>
            <span className="rounded border border-accent-gold/25 bg-accent-gold/10 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-accent-gold">
              {APP_STAGE}
            </span>
          </div>
          <span className="truncate text-[10px] text-accent-gold/80">{t('privateLocalLibrary')}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group, groupIndex) => (
          <div key={group.labelKey ?? 'primary'} className={groupIndex > 0 ? 'mt-8' : ''}>
            {group.labelKey && (
              <p className="px-3 pb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint">
                {t(group.labelKey)}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.path ||
                  (item.path !== '/' && location.pathname.startsWith(item.path));

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive: linkActive }) =>
                      // An inset marker and one value step, never a filled box —
                      // the same treatment as .rule-row-active. The marker is
                      // physically left, so it flips for RTL or it lands at the
                      // reading END of the active item.
                      `group relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium ${
                        linkActive || isActive
                          ? 'bg-accent-gold/10 text-text-primary shadow-[inset_3px_0_0_rgb(var(--accent-gold-rgb))] rtl:shadow-[inset_-3px_0_0_rgb(var(--accent-gold-rgb))]'
                          : 'text-muted-text hover:text-text-primary'
                      }`
                    }
                  >
                    {({ isActive: linkActive }) => (
                      <>
                        <Icon
                          className={`h-[18px] w-[18px] shrink-0 transition-colors duration-150 ${
                            linkActive || isActive ? 'text-accent-gold' : 'text-text-faint group-hover:text-muted-text'
                          }`}
                        />
                        <span>{t(item.labelKey)}</span>
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
      <div className="sidebar-foot border-t border-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 shrink-0 text-accent-gold/70" />
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium text-text-primary">{t('offlineStorage')}</p>
            <p className="truncate text-[10px] text-muted-text">{t('offlineStorageDetail')}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
