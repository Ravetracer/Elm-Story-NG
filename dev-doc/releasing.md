# Releasing desktop binaries

The desktop app is published as a **Linux AppImage** and a **Windows NSIS
installer** attached to a GitHub release, built in CI so no one has to package
locally. macOS (dmg) is configured in `build` but not wired to a CI runner.

## How to cut a release

1. Land everything on `main` and make sure it is pushed.
2. Bump the version and create the matching tag:

   ```bash
   npm version patch        # or minor / major — edits package.json, makes a v<version> tag
   git push --follow-tags   # pushes main and the tag
   ```

   (Or bump `package.json` by hand, commit, then `git tag v<version> && git push --follow-tags`.)
3. The **Release** workflow (`.github/workflows/release.yml`) runs on the
   `v*.*.*` tag. It has two jobs — `appimage` (ubuntu-latest) and `windows`
   (windows-latest) — that build the Linux AppImage and the Windows installer
   and upload both to a **draft** GitHub release named `v<version>`.
4. Open **Releases** on GitHub, review the draft (add notes, check the
   `.AppImage` and `.exe` are attached), and click **Publish**. Nothing is
   public until you do.

You can also run the workflow by hand from the **Actions** tab
(`workflow_dispatch`). It takes a `platforms` input (`all` / `linux` /
`windows`) so you can build just one. It uploads to the release matching the
current `package.json` version.

## Adding a binary to an *existing* release (no new tag)

electron-builder uploads into whatever release has the tag `v<version>` for the
current `package.json` version — **draft or already published** — and only
creates one if none exists. So to add a missing binary (e.g. the Windows `.exe`
to an already-shipped `v0.78.6`) **without cutting a new release**:

1. Leave `package.json`'s version at the target version. **Do not bump it** — a
   bump would make the run target a different, non-existent release and create a
   new draft instead.
2. Actions tab → **Release** → **Run workflow** on `main`, `platforms: windows`.
3. The `.exe` is attached to the existing `v0.78.6` release; its draft/published
   state is left unchanged.

This is the one time the "bump the version on every change" rule is
deliberately skipped: the whole point is to hit the release the current version
already names.

## What the pieces are

- **`build.publish`** (package.json) — GitHub provider, `owner: Ravetracer`,
  `repo: Elm-Story-NG`, `releaseType: draft`. `draft` is the safety valve: a run
  can never ship anything on its own; you publish the draft yourself.
- **`build.linux.artifactName`** — `Elm-Story-NG-${version}.${ext}`, because the
  `productName` ("Elm Story - NG") has spaces that make an ugly filename.
- **`release` script** — `npm run build && electron-builder --linux --publish
  always`. `build` is `engine:sync && typecheck && electron-vite build`; then
  electron-builder packs `out/` into the AppImage and uploads it.
- **The workflow** — `ubuntu-latest`, Node 22, `npm ci` (which runs the app's
  `postinstall`: engine deps + the Electron binary fetch via
  `scripts/ensure-electron.mjs`), then `npm run release`. It sets
  `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` and `permissions: contents: write` so
  the built-in token can create the release — **no personal access token or
  repo secret to configure.**

## Gotchas

- **The tag must match `package.json`'s version.** electron-builder names the
  release `v<version>` from `package.json`; trigger with the same tag or the tag
  and the release disagree. `npm version` keeps them in step for you.
- **electron-updater side files ride along.** The upload also carries
  `latest-linux.yml` and a `.blockmap` — harmless, and what a future in-app
  auto-update would read (`electron-updater` is already a dependency; wiring
  `autoUpdater` in `src/main.ts` is a separate, not-yet-done step).
- **No native modules, so no `electron-rebuild`** — CI stays a plain
  install + build. If AppImage ever complains about **FUSE**, that is a
  *run* requirement on the user's machine (`libfuse2`), not a build one.
- **Linux and Windows are wired to publish; macOS is not.** The `mac` (dmg)
  target exists in `build` but no CI runner builds it — it would need its own
  `macos-latest` job (and Apple signing/notarization) to ship.
- **The Windows installer is unsigned.** Windows 11 SmartScreen shows a
  "Windows protected your PC" prompt; the user clicks *More info → Run anyway*.
  Removing it needs an Authenticode certificate (OV builds reputation over
  downloads; EV trusts immediately) wired into `build.win` (`certificateFile` /
  signing env vars). Not worth it for a hobby fork.
- **Windows can be cross-built from Linux with Wine**, but CI uses a real
  `windows-latest` runner instead — no Wine setup, no NSIS surprises.
- **Local dry run:** `npm run build && npx electron-builder --linux --publish
  never` packs `release/Elm-Story-NG-<version>.AppImage` without uploading, which
  is how the config was validated.
