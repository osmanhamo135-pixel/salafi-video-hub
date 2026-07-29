# Ownership, privacy, and the path to a private repository

The owner's requirements: the code must not be stealable, must never be open
source, and must not be usable in ways contrary to Islam.

## What is already done

- **LICENSE.md** at the repo root: proprietary, all rights reserved, with
  explicit conditions of use (no redistribution, no resale, no derivative
  apps, no un-Islamic use). Applies to every release from 1.45.0 onward.
  Legal honesty: a licence deters and gives standing; it cannot physically
  stop a bad actor who already cloned the code while the repo was public.
- **The updater already knows its future home.** `tauri.conf.json` lists TWO
  updater endpoints, in order:
  1. `salafi-video-hub-releases` (does not exist yet — returns 404 today, and
     the updater silently falls through to the next endpoint)
  2. `salafi-video-hub` (the current, working endpoint)
  Every client from 1.45.0 onward therefore polls the future public releases
  repo first. The moment it exists and carries a release, clients migrate to
  it with no further work.

## What only the owner can do (in order, when ready)

1. **Create the public releases repository**: GitHub → New repository →
   name `salafi-video-hub-releases`, PUBLIC, empty. It will hold installers
   and `latest.json` only — never source.
2. **Create a Personal Access Token** with `contents: write` on that repo,
   and add it to THIS repo's secrets as `RELEASES_REPO_TOKEN`.
3. Say the word, and the release workflow gets a final job that copies each
   release's assets (installers, signatures, `latest.json`) into the public
   releases repo.
4. **Wait** until the userbase has updated to ≥ 1.45.0 (check the release
   download counts), because older installs only know the old endpoint and
   will be stranded when step 5 happens. They can always reinstall manually.
5. **Flip this repository to Private**: Settings → General → Danger Zone →
   Change visibility. From that moment the source is unreadable to the
   public, and updates flow through the public releases repo.

## Notes

- The updater signing key never changes in any of this. Do not touch it.
- The KFGQPC fonts and Qur'an text remain under their own licences; ours
  cannot and does not override them.
