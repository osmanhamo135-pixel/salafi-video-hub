import React, { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Window resize handles, for platforms whose window manager stops providing
 * them once the app draws its own title bar.
 *
 * The window is configured `decorations: false` so the themed TitleBar can
 * replace the OS chrome. On Windows that is free: an undecorated window keeps
 * WS_THICKFRAME, so the OS still hit-tests a resize border outside the client
 * area. GTK has no equivalent — `gtk_window_set_decorated(FALSE)` takes the
 * client-side decorations away wholesale, resize edges included, and offers
 * nothing in their place. So on Linux the window was pinned at whatever size
 * it was restored with and `"resizable": true` was a lie; maximize was the
 * only size control the user had.
 *
 * These are eight invisible strips along the edges and corners that call
 * `startResizeDragging`, which hands the drag to the window manager. They only
 * mount where the platform needs them, so Windows keeps using the real OS
 * border and nothing overlays the app's own edges there.
 */

type Dir =
  | 'North' | 'South' | 'East' | 'West'
  | 'NorthEast' | 'NorthWest' | 'SouthEast' | 'SouthWest';

const EDGE = 4;
const CORNER = 12;

const GRIPS: Array<{ dir: Dir; style: React.CSSProperties; cursor: string }> = [
  { dir: 'North', style: { top: 0, left: CORNER, right: CORNER, height: EDGE }, cursor: 'ns-resize' },
  { dir: 'South', style: { bottom: 0, left: CORNER, right: CORNER, height: EDGE }, cursor: 'ns-resize' },
  { dir: 'West', style: { left: 0, top: CORNER, bottom: CORNER, width: EDGE }, cursor: 'ew-resize' },
  { dir: 'East', style: { right: 0, top: CORNER, bottom: CORNER, width: EDGE }, cursor: 'ew-resize' },
  { dir: 'NorthWest', style: { top: 0, left: 0, width: CORNER, height: CORNER }, cursor: 'nwse-resize' },
  { dir: 'NorthEast', style: { top: 0, right: 0, width: CORNER, height: CORNER }, cursor: 'nesw-resize' },
  { dir: 'SouthWest', style: { bottom: 0, left: 0, width: CORNER, height: CORNER }, cursor: 'nesw-resize' },
  { dir: 'SouthEast', style: { bottom: 0, right: 0, width: CORNER, height: CORNER }, cursor: 'nwse-resize' },
];

export const ResizeGrips: React.FC = () => {
  const [needed, setNeeded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Windows gets its resize border from the OS; anywhere else, draw our own.
    // `plugin-os` is loaded lazily so a failure here can never block the shell.
    void import('@tauri-apps/plugin-os')
      .then(({ platform }) => {
        if (!cancelled) setNeeded(platform() !== 'windows');
      })
      .catch(() => {
        if (!cancelled) setNeeded(!/Windows/i.test(navigator.userAgent));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!needed) return null;

  return (
    <>
      {GRIPS.map(({ dir, style, cursor }) => (
        <div
          key={dir}
          aria-hidden="true"
          onMouseDown={(event) => {
            // Left button only, and never while maximized (the WM ignores it
            // there anyway, and swallowing the event breaks double-click).
            if (event.button !== 0) return;
            event.preventDefault();
            void getCurrentWindow().startResizeDragging(dir);
          }}
          style={{ position: 'fixed', zIndex: 2147483647, cursor, ...style }}
        />
      ))}
    </>
  );
};
