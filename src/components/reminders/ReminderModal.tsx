import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/i18n';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  const { t } = useI18n();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop. A modal scrim is a shadow cast over the whole application,
          not a themed surface, so it stays neutral in all ten themes. */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal — a hairline and a value step, no drop shadow. */}
      <div
        className="glass relative w-full max-w-lg overflow-hidden rounded-xl"
        style={{ background: 'rgb(var(--bg-panel-rgb))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary" dir="auto">{title}</h2>
          <button
            onClick={onClose}
            className="icon-btn shrink-0"
            aria-label={t('close')}
            title={t('close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
