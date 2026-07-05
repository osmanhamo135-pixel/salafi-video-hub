# Salafi Video Hub Auto Updates

This app is wired for free in-app updates through GitHub Releases.

## How It Works

1. The installed app checks `latest.json` from GitHub Releases.
2. If a newer version exists, the app shows an update card.
3. The user clicks `Download update`.
4. Tauri downloads the signed Windows installer, installs it, and asks for restart.

## One-Time Setup

1. Create a public GitHub repository for this project.
2. The updater endpoint is configured for this repository:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-updater-repo.ps1 -Repository "osmanhamo135-pixel/salafi-video-hub"
```

3. Add the updater private key as a GitHub Actions secret:

Secret name:

```text
TAURI_SIGNING_PRIVATE_KEY
```

Secret source file:

```text
C:\Users\osman\Desktop\Salafi Video Hub Update Keys\salafi-video-hub-update.key
```

Open that file locally and paste the full key text into the GitHub secret value. Do not commit it.

This local key was generated without a password, so no password secret is needed.

## Publishing A New Update

1. Bump the app version in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
2. Push to GitHub.
3. Run the `Publish beta update` workflow from GitHub Actions, or push a tag like `v1.4.1`.
4. GitHub will create a release with the installer and `latest.json`.

Users who already installed the updater-enabled app will see the update prompt on next app launch.

## Important

Keep this private key safe:

```text
C:\Users\osman\Desktop\Salafi Video Hub Update Keys\salafi-video-hub-update.key
```

If it is lost, future updates cannot be trusted by already-installed apps.
