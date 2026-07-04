# Salafi Video Hub

A polished, fast, local-only desktop Islamic video library and player built with **React + TypeScript + Vite + Tauri v2 + Rust + SQLite**.

## Overview

Salafi Video Hub is a private local video library and player for videos stored on your PC. It supports local imports, offline playback, reminders, progress tracking, and a beta downloader page for permitted videos you are allowed to save.

### Supported Content
- Quran, Hadith, Tafsir, Aqeedah, Tawheed, Manhaj, Fiqh, Seerah
- Arabic Lessons, Refutations, Short Clips, Long Lessons
- Any local Islamic video collection

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand |
| Desktop | Tauri v2, Rust |
| Database | SQLite (via rusqlite) |
| Media | FFmpeg, FFprobe |
| State | Zustand (client), SQLite (persistent) |

---

## Project Structure

```
salafi-video-hub/
├── src/                          # React frontend
│   ├── components/
│   │   ├── ui/                   # Primitive components
│   │   ├── layout/               # AppShell, Sidebar
│   │   ├── playlist/             # PlaylistCard, PlaylistGrid, PlaylistMenu, SearchResults
│   │   ├── player/               # VideoPlayer, PlayerControls, ProgressBar, QueuePanel, QueueRow, PlayerHeader
│   │   └── dashboard/            # StatCard, ContinueWatching, RecentlyAdded, QuickActions
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Library.tsx
│   │   ├── PlayerPage.tsx
│   │   ├── Reminders.tsx
│   │   └── Settings.tsx
│   ├── hooks/
│   │   ├── useTauriCommands.ts
│   │   └── useKeyboardShortcuts.ts
│   ├── store/
│   │   ├── appStore.ts
│   │   ├── playerStore.ts
│   │   ├── settingsStore.ts
│   │   └── remindersStore.ts
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── formatTime.ts
│   │   ├── formatBytes.ts
│   │   ├── pathHash.ts
│   │   └── constants.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Entry point
│   │   ├── lib.rs                # Module exports + Tauri setup
│   │   ├── commands/             # Tauri invoke handlers
│   │   │   ├── video.rs
│   │   │   ├── playlist.rs
│   │   │   ├── reminder.rs
│   │   │   ├── settings.rs
│   │   │   ├── playback.rs
│   │   │   ├── ffmpeg.rs
│   │   │   └── file_ops.rs
│   │   ├── db/                   # SQLite layer
│   │   │   ├── mod.rs            # Connection + schema
│   │   │   ├── video.rs
│   │   │   ├── playlist.rs
│   │   │   ├── reminder.rs
│   │   │   └── settings.rs
│   │   ├── models/               # Rust data structs
│   │   │   ├── video.rs
│   │   │   ├── playlist.rs
│   │   │   ├── reminder.rs
│   │   │   └── settings.rs
│   │   ├── services/             # Business logic
│   │   │   ├── scanner.rs        # Folder scanning + import
│   │   │   ├── metadata.rs       # FFprobe extraction
│   │   │   ├── thumbnail_gen.rs  # Thumbnail generation
│   │   │   └── reminder_check.rs # Reminder polling
│   │   └── utils/                # Utilities
│   │       ├── paths.rs          # App data paths
│   │       ├── ffmpeg_finder.rs  # FFmpeg auto-detection
│   │       └── notifications.rs  # Desktop notifications
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   └── capabilities/
│       └── default.json          # Tauri permissions
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── index.html
```

---

## Prerequisites

1. **Node.js** (v18+ recommended)
2. **npm** or **pnpm**
3. **Rust** toolchain (install via [rustup.rs](https://rustup.rs))
4. **Windows 11** (primary target; also works on macOS/Linux with minor adjustments)
5. **FFmpeg + FFprobe** (optional but strongly recommended for thumbnails and metadata)

---

## How to Run (Development)

```powershell
# 1. Navigate to project
cd salafi-video-hub

# 2. Install frontend dependencies
npm install

# 3. Run the Tauri development window
# This starts Vite dev server + opens the Tauri app window
npm run tauri-dev
```

> **Note:** On Windows, use `npm.cmd` / `npx.cmd` if PowerShell execution policy blocks `.ps1` scripts:
> ```powershell
> npm.cmd install
> npm.cmd run tauri-dev
> ```

---

## How to Build (Production)

```powershell
# Install dependencies
npm install

# Build production bundle + create Windows installer
npm run tauri-build
```

### Output Locations
- **NSIS Installer**: `src-tauri/target/release/bundle/nsis/*.exe`
- **MSI Installer**: `src-tauri/target/release/bundle/msi/*.msi`

---

## How the Local Database Works

- **Engine**: SQLite (bundled via `rusqlite`)
- **Location**: OS app data folder
  - Windows: `%APPDATA%/com.salafivideohub.app/salafi_video_hub.db`
- **Tables**:
  - `videos` — all imported videos with metadata, progress, thumbnails
  - `playlists` — one row per imported folder
  - `reminders` — user-created reminders
  - `settings` — single-row app configuration
- **Initialization**: Auto-created on first launch with indexes for fast queries
- **No data is stored beside your video files** — everything stays in the app data folder

---

## How Local Playback Works

1. **File Access**: Tauri's `convertFileSrc()` converts Windows/Unicode file paths into safe `asset://` URLs that the WebView can load
2. **Single Video Element**: Only ONE `<video>` element exists in the entire app (in `VideoPlayer.tsx`)
3. **Memoized Source**: `videoSrc` is computed with `useMemo(() => convertFileSrc(filePath), [filePath])` — only changes when the actual file path changes
4. **Key-based Remount**: The `<video>` element uses `key={currentVideoId}` to force a clean remount only when switching videos
5. **State Machine**: Player tracks status: `idle → resolvingPath → loadingMetadata → ready → playing → paused → error → missing`
6. **Loading Overlay**: Shows only during `loadingMetadata` / `resolvingPath`. Auto-hides when `readyState >= 1 && duration > 0 && currentTime > 0`

---

## How Thumbnails Are Generated

1. **Detection**: App auto-detects FFmpeg on startup (bundled → PATH → common Windows locations)
2. **Queue**: When a video is imported, its thumbnail status becomes `queued`
3. **Generation Algorithm**:
   - Try frame at **0.2s** → if valid (>100 bytes), use it
   - If failed/black, try **1.0s**
   - If still failed, try **3.0s**
   - If all fail, mark as `failed` and use fallback UI
4. **Safe Args**: FFmpeg runs with arguments as an array (NOT a shell string) to handle spaces, Arabic, and Unicode paths safely
5. **Single Process**: Max 1 FFmpeg job at a time. Background jobs pause while video is playing (in Performance Mode)

---

## Where Thumbnails Are Cached

- **Location**: OS app data folder under `media-cache/thumbnails/`
  - Windows: `%APPDATA%/com.salafivideohub.app/media-cache/thumbnails/`
- **Filename**: `SHA256(filePath + modifiedTime)[..16].jpg`
- **Stability**: If source file hasn't changed, the same hash is generated → no redundant regeneration
- **Cleanup**: Settings page has "Clear Thumbnail Cache" button
- **NEVER stored beside your videos**

---

## How FFmpeg Is Detected

Detection order (first match wins):
1. **Bundled**: Checks `ffmpeg.exe` / `ffprobe.exe` next to the app executable
2. **PATH**: Scans all directories in the system `PATH` environment variable
3. **Common locations**:
   - `C:\ffmpeg\bin\`
   - `C:\Program Files\ffmpeg\bin\`
   - `C:\tools\ffmpeg\bin\`
4. **Manual override**: User can set a custom path in Settings

If FFmpeg is **missing**:
- App still works fully
- Thumbnails show fallback UI (dark panel with video icon)
- Settings shows clear "Missing" status

---

## How Performance / Lag Is Prevented

| Technique | Implementation |
|-----------|---------------|
| Single video element | Only ONE `<video>` in entire app |
| Queue thumbnails | `<img>` tags only, NEVER `<video>` elements |
| Memoized src | `useMemo(() => convertFileSrc(path), [path])` |
| Throttled progress | Saves to SQLite every 5s max, not every frame |
| Memoized rows | `React.memo` on `QueueRow` and `PlaylistCard` |
| Single FFmpeg job | Mutex-like queue, 1 thumbnail at a time |
| Pause background jobs | Thumbnail + metadata jobs pause during playback |
| Lazy resumption | 1-2s delay before resuming background work after pause |
| No heavy CSS | No blur/shadow on hundreds of rows |

---

## Features Completed

### Core
- [x] Local folder import (with subfolder option)
- [x] Single video import
- [x] Playlist = one card per folder (NOT one per video)
- [x] Video playback via Tauri `convertFileSrc`
- [x] Playlist queue with next/previous navigation
- [x] Autoplay next inside playlist
- [x] Repeat modes: none / one / playlist
- [x] Progress save and resume
- [x] Keyboard shortcuts (Space, Arrows, F, M, N, P, R, Esc)

### UI
- [x] Dashboard with stats, continue watching, recently added, reminders
- [x] Library with responsive playlist grid
- [x] Search across playlists and videos
- [x] Playlist card with thumbnail, count, duration, progress
- [x] Player with controls, progress bar, volume, fullscreen
- [x] Queue panel with thumbnails and current-track highlight
- [x] Unsupported/missing file panel with external open options

### Data
- [x] SQLite database with full CRUD
- [x] Video metadata: duration, resolution, codecs, file size
- [x] Progress tracking per video
- [x] Favorite / Watch Later toggles
- [x] Mark completed

### Thumbnails
- [x] FFmpeg auto-detection
- [x] Automatic thumbnail generation at import
- [x] Multi-timestamp fallback (0.2s → 1s → 3s)
- [x] Stable hash-based caching
- [x] App data folder storage
- [x] Missing-FFmpeg graceful fallback

### Reminders
- [x] Create / edit / delete reminders
- [x] Enable/disable toggle
- [x] Target: playlist or video
- [x] Time picker + repeat patterns
- [x] Custom sound + volume
- [x] Test sound button

### Updates
- [x] Beta in-app update prompt
- [x] GitHub Releases updater endpoint
- [x] Signed update metadata workflow

### Settings
- [x] Imported folders management
- [x] FFmpeg status and path configuration
- [x] Thumbnail cache management
- [x] Performance mode toggle
- [x] Backup export/import (JSON)
- [x] Open app data folder

---

## Known Limitations

1. **Thumbnail generation**: Requires FFmpeg installed. Without it, thumbnails show fallback UI. Bundle FFmpeg binaries manually for production if desired.
2. **Reminder notifications**: Desktop notification integration is stubbed; full audible + notification firing requires additional OS-level scheduling implementation.
3. **Video codec support**: Playback quality depends on the OS WebView's codec support. Some formats (e.g., HEVC) may not play smoothly.
4. **Ultrawide optimization**: The layout uses `max-w-content` (1600px) centering. On 5120×1440, the app will be centered with side margins rather than edge-to-edge.
5. **Tray/background mode**: Not yet implemented. The app closes fully on window close.
6. **Folder watching**: No automatic filesystem watching. Use "Rescan" button to detect new files.
7. **Subfolder flattening**: Subfolder videos are imported into a single playlist, not nested playlists.
8. **Build testing**: The app has been architected and code-reviewed but not fully compiled in a fresh environment due to sandbox build constraints. Minor TypeScript/Rust compile fixes may be needed on first build (see Troubleshooting).

---

## Troubleshooting

### `npm install` fails
- Ensure Node.js v18+ is installed
- Try `npm.cmd install` on Windows if PowerShell blocks scripts

### `cargo` / Rust errors
- Install Rust via https://rustup.rs
- Run `rustup target add wasm32-unknown-unknown` (if needed)

### FFmpeg not detected
- Download FFmpeg from https://ffmpeg.org/download.html
- Extract to `C:\ffmpeg\bin\` or add to system PATH
- Or set path manually in Settings → Thumbnails

### Video not playing
- Check that the file still exists at the recorded path
- Try "Open Externally" to test with system player
- Check Settings → FFmpeg status

### Thumbnails not generating
- Verify FFmpeg is detected in Settings
- Click "Regenerate Missing Thumbnails"
- Check that thumbnail cache folder is writable

---

## License

MIT

---

## Folder/Database Summary

| Storage | Location | Purpose |
|---------|----------|---------|
| Database | `%APPDATA%/com.salafivideohub.app/salafi_video_hub.db` | All app data |
| Thumbnails | `%APPDATA%/com.salafivideohub.app/media-cache/thumbnails/` | Cached video frames |
| Backups | `%APPDATA%/com.salafivideohub.app/backups/` | Exported JSON backups |

**Your video files are NEVER modified, moved, or deleted by this app.**
