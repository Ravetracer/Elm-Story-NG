# Releasing a Linux AppImage

The desktop app is published as a **Linux AppImage** attached to a GitHub
release, built in CI so no one has to package locally.

## How to cut a release

1. Land everything on `main` and make sure it is pushed.
2. Bump the version and create the matching tag:

   ```bash
   npm version patch        # or minor / major — edits package.json, makes a v<version> tag
   git push --follow-tags   # pushes main and the tag
   ```

   (Or bump `package.json` by hand, commit, then `git tag v<version> && git push --follow-tags`.)
3. The **Release (Linux AppImage)** workflow (`.github/workflows/release.yml`)
   runs on the `v*.*.*` tag: it builds the AppImage and uploads it to a
   **draft** GitHub release named `v<version>`.
4. Open **Releases** on GitHub, review the draft (add notes, check the
   `.AppImage` is attached), and click **Publish**. Nothing is public until you do.

You can also run the workflow by hand from the **Actions** tab
(`workflow_dispatch`) — it still uploads to the draft for the current
`package.json` version.

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
- **Only Linux is wired to publish.** `mac` (dmg) and `win` (nsis) targets exist
  in `build` but the workflow builds `--linux` only. macOS/Windows would each
  need their own runner (and signing) — add later if wanted.
- **Local dry run:** `npm run build && npx electron-builder --linux --publish
  never` packs `release/Elm-Story-NG-<version>.AppImage` without uploading, which
  is how the config was validated.
