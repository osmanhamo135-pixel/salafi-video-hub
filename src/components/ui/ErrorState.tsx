import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

/**
 * The error panel — what broke, why, and the button that fixes it.
 *
 * An error screen is where a user decides whether an app is serious. The bar
 * this sets: plain-language cause (never an exception message as the
 * headline), and the recovery action wired RIGHT HERE to the command that
 * fixes it — not a sentence telling the user to go find Repair Database
 * three screens away in Settings.
 *
 * The plate is the khatam at low alpha — geometric, never a sad-face
 * illustration, and never Qur'anic text as decoration.
 */
export interface ErrorAction {
  label: string;
  run: () => Promise<void> | void;
  primary?: boolean;
}

interface ErrorStateProps {
  title: string;
  /** Plain language. The raw error, if any, goes in `detail`. */
  body: string;
  /** Optional raw detail, rendered small — for bug reports, not for reading. */
  detail?: string | null;
  actions?: ErrorAction[];
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  body,
  detail,
  actions = [],
  className,
}) => {
  const [busy, setBusy] = useState<string | null>(null);

  const runAction = async (a: ErrorAction) => {
    setBusy(a.label);
    try {
      await a.run();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`error-state glass ${className ?? ''}`} role="alert">
      <div className="error-state-plate" aria-hidden="true" />
      <div className="relative z-[1] flex flex-col items-center gap-3 px-6 py-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-warning-orange/35 bg-warning-orange/10">
          <AlertTriangle className="h-5 w-5 text-warning-orange" />
        </span>
        <p className="text-base font-semibold text-text-primary" dir="auto">{title}</p>
        <p className="max-w-md text-sm leading-relaxed text-muted-text" dir="auto">{body}</p>

        {actions.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2.5">
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                disabled={busy !== null}
                onClick={() => void runAction(a)}
                className={`${a.primary ? 'btn-primary' : 'btn-secondary'} px-4 py-2 text-sm`}
              >
                {busy === a.label && <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" />}
                {a.label}
              </button>
            ))}
          </div>
        )}

        {detail && (
          <p className="mt-2 max-w-md break-all text-[11px] text-text-faint" dir="auto">
            <bdi>{detail}</bdi>
          </p>
        )}
      </div>
    </div>
  );
};
