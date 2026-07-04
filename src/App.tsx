import { useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './pages/Dashboard';
import { Library } from './pages/Library';
import { PlayerPage } from './pages/PlayerPage';
import { Reminders } from './pages/Reminders';
import { Downloads } from './pages/Downloads';
import { Settings } from './pages/Settings';
import { ReminderAlarm } from './components/reminders/ReminderAlarm';
import { UpdateManager } from './components/updater/UpdateManager';
import { usePlayerStore } from './store/playerStore';
import { useSettingsStore } from './store/settingsStore';
import { useAppEvents } from './hooks/useAppEvents';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const isPlayerOpen = usePlayerStore((state) => state.isPlayerOpen);
  const playerOpenRequestId = usePlayerStore((state) => state.playerOpenRequestId);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const settings = useSettingsStore((state) => state.settings);
  const handledPlayerOpenRequest = useRef(playerOpenRequestId);

  useAppEvents();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const language = settings?.language ?? 'en';
    const theme = settings?.theme ?? 'noor';
    const root = document.documentElement;

    root.lang = language;
    root.dir = language === 'ar' ? 'rtl' : 'ltr';
    root.dataset.language = language;
    root.dataset.theme = theme;
  }, [settings?.language, settings?.theme]);

  useEffect(() => {
    const hasUnhandledOpenRequest = playerOpenRequestId !== handledPlayerOpenRequest.current;
    if (isPlayerOpen && hasUnhandledOpenRequest) {
      handledPlayerOpenRequest.current = playerOpenRequestId;
      if (!location.pathname.includes('player')) {
        navigate('/player');
      }
    }
  }, [isPlayerOpen, playerOpenRequestId, navigate, location.pathname]);

  return (
    <div className="app-container">
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/library" element={<Library />} />
          <Route path="/player" element={<PlayerPage />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </AppShell>
      <ReminderAlarm />
      <UpdateManager />
    </div>
  );
}
