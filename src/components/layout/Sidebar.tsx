import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bell, Download, HardDrive, LayoutDashboard, Library, Settings } from 'lucide-react';
import appIcon from '@/assets/app-icon.png';
import { APP_NAME, APP_STAGE } from '@/utils/constants';
import { TranslationKey, useI18n } from '@/i18n';

const navItems = [
  { path: '/', labelKey: 'navDashboard', icon: LayoutDashboard },
  { path: '/library', labelKey: 'navLibrary', icon: Library },
  { path: '/reminders', labelKey: 'navReminders', icon: Bell },
  { path: '/downloads', labelKey: 'navDownloads', icon: Download },
  { path: '/settings', labelKey: 'navSettings', icon: Settings },
] satisfies Array<{
  path: string;
  labelKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
}>;

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { t } = useI18n();
  const isPlayerOpen = location.pathname === '/player';

  return (
    <aside 
      className={`app-sidebar flex flex-col bg-[linear-gradient(180deg,var(--bg-sidebar)_0%,var(--bg-main)_100%)] border-r border-primary-blue/15 transition-all duration-200 ${
        isPlayerOpen ? 'w-0 opacity-0 overflow-hidden' : 'w-[240px] opacity-100'
      }`}
    >
      {/* Logo */}
      <div className="relative flex items-center gap-3 border-b border-primary-blue/15 px-5 py-5">
        <div className="gold-thread absolute inset-x-5 bottom-0" />
        <div className="icon-medallion h-14 w-14 shrink-0 overflow-hidden p-1">
          <img
            src={appIcon}
            alt=""
            className="relative z-10 h-full w-full rounded-lg object-cover"
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
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || 
            (item.path !== '/' && location.pathname.startsWith(item.path));
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive: linkActive }) => 
                `relative flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors ${
                  linkActive || isActive
                    ? 'border-primary-blue/25 bg-primary-blue/10 text-text-primary shadow-[inset_3px_0_0_rgba(15,185,177,0.85)]' 
                    : 'border-transparent text-muted-text hover:border-primary-blue/10 hover:bg-primary-blue/[0.045] hover:text-text-primary'
                }`
              }
            >
              <Icon className="w-[18px] h-[18px]" />
              <span>{t(item.labelKey)}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-primary-blue/15 px-5 py-4">
        <div className="ornate-corner islamic-pattern relative flex items-center gap-2 overflow-hidden rounded-md border border-primary-blue/15 bg-background/80 px-3 py-2">
          <HardDrive className="h-4 w-4 text-primary-blue" />
          <div>
            <p className="text-[11px] font-medium text-text-primary">{t('offlineStorage')}</p>
            <p className="text-[10px] text-muted-text">{t('offlineStorageDetail')}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
