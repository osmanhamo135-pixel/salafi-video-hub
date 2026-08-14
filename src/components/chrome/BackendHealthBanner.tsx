import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n';
import {
  BackendHealth,
  getBackendHealth,
  probeBackend,
  subscribeBackendHealth,
} from '@/utils/backendWatchdog';

/**
 * The visible face of the backend watchdog. Mounted once at the app root;
 * renders nothing while the engine answers. When the probe goes unanswered it
 * pins a plain-language banner over the shell: the window is fine, the engine
 * is not, here is what to try. An eternal skeleton tells the user nothing —
 * this tells them the one thing that matters and what to send us.
 */
export const BackendHealthBanner: React.FC = () => {
  const { t } = useI18n();
  const [health, setHealth] = useState<BackendHealth>(getBackendHealth());
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeBackendHealth(setHealth);
    void probeBackend();
    return unsubscribe;
  }, []);

  if (health.state !== 'unresponsive') return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await probeBackend();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[70] flex items-start justify-center px-4 pt-3"
    >
      <div className="flex max-w-2xl items-start gap-3 rounded-lg border border-warning-orange/50 bg-panel/95 px-4 py-3 text-sm leading-relaxed text-warning-orange shadow-lg backdrop-blur-md">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div dir="auto">
          <p className="font-semibold">{t('backendUnresponsiveTitle')}</p>
          <p className="mt-1 text-warning-orange/90">{t('backendUnresponsiveBody')}</p>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="mt-0.5 flex shrink-0 items-center gap-1.5 rounded-md border border-warning-orange/40 px-2.5 py-1 text-xs font-medium hover:bg-warning-orange/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} aria-hidden="true" />
          {t('backendRetry')}
        </button>
      </div>
    </div>
  );
};
