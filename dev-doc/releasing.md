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
   (windows-latest) — that build the Linux AppImage and the Windows installer.
   Each job builds with `electron-builder --publish never` and then uploads its
   artifact with the **`gh` CLI** (see below). The first job to run creates a
   **draft** GitHub release named `v<version>` if none exists.
4. Open **Releases** on GitHub, review the draft (add notes, check the
   `.AppImage` and `.exe` are attached), and click **Publish**. Nothing is
   public until you do.

You can also run the workflow by hand from the **Actions** tab
(`workflow_dispatch`). It takes a `platforms` input (`all` / `linux` /
`windows`) so you can build just one. It uploads to the release matching the
current `package.json` version.

## Why `gh` and not electron-builder's publisher

electron-builder's GitHub publisher always manages a **draft**. Once that draft
is published, a later run finds no draft, **creates a fresh one**, and drops its
artifact into a phantom draft — which does not appear on the public tag page, so
it looks like the upload silently vanished. This actually happened adding the
Windows `.exe` to the already-published `v0.78.6`.

So publishing is done with `gh` instead. Each upload step is:

```bash
TAG="v$(node -p "require('./package.json').version")"
gh release view "$TAG" >/dev/null 2>&1 \
  || gh release create "$TAG" --draft --title "Elm-Story-NG $TAG" --notes "..."
gh release upload "$TAG" release/<artifacts> --clobber
```

`gh release upload <tag>` targets the release that **owns the tag** — draft or
published — so a re-run attaches to the existing release instead of spawning a
new draft. `--clobber` replaces an asset of the same name, making re-runs
idempotent. `gh` uses `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`; with
`permissions: contents: write` the built-in token is enough — **no personal
access token or repo secret to configure.**

The **windows job `needs: appimage`** (with `if: always()`), so the two jobs can
never race to create two competing drafts for one tag. `always()` keeps Windows
running when the Linux job is skipped (a windows-only manual run) or fails.

## Adding a binary to an *existing* release (no new tag)

`gh release upload` hits whatever release owns tag `v<version>` for the current
`package.json` version — **draft or already published**. So to add a missing
binary (e.g. the Windows `.exe` to an already-shipped `v0.78.6`) **without
cutting a new release**:

1. Leave `package.json`'s version at the target version. **Do not bump it** — a
   bump makes the run target a different tag, which has no release, so `gh`
   creates a new draft there instead.
2. Actions tab → **Release** → **Run workflow** on `main`, `platforms: windows`.
3. The `.exe` is uploaded to the existing `v0.78.6` release; its draft/published
   state is left unchanged.

This is the one time the "bump the version on every change" rule is
deliberately skipped: the whole point is to hit the release the current version
already names.

## What the pieces are

- **`build.linux.artifactName` / `build.win.artifactName`** —
  `Elm-Story-NG-${version}.${ext}` and `Elm-Story-NG-${version}-Setup.${ext}`,
  because the `productName` ("Elm Story - NG") has spaces that make an ugly
  filename.
- **`build.publish`** (package.json) — still declares the GitHub provider, but
  the workflow uses `--publish never`, so this block is now unused by CI. It is
  left in place for a local `--publish` run if ever wanted.
- **Per-job steps** — `npm ci` (which runs the app's `postinstall`: engine deps
  + the Electron binary fetch via `scripts/ensure-electron.mjs`), then
  `npm run build && npx electron-builder --<platform> --publish never`, then the
  `gh release upload` step above.

## Gotchas

- **The tag must match `package.json`'s version.** The upload derives the tag
  from `package.json` (`v$(node -p ...)`); trigger with the same tag or the run
  uploads to the wrong one. `npm version` keeps them in step for you.
- **electron-updater side files ride along.** The upload also carries
  `latest-linux.yml` / `latest.yml` — harmless, and what a future in-app
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
- **`engine:install` uses `npm ci`, not `npm install`, and that was a Windows
  fix.** The root `postinstall` installs the engine's deps, and `npm install`
  there hoists `@babel` to the engine's top level and then tries to delete the
  nested copies under `react-error-boundary` / `match-sorter`. On the
  `windows-latest` runner that `rmdir` fails with **EPERM** (file-handle
  locking), npm exits 1, and the whole `npm ci` step fails — Linux allows the
  rmdir, so it only ever broke Windows. `npm ci` wipes `node_modules` once and
  places every package at its lockfile path in a single pass with no
  retire-and-delete step, so the EPERM cannot happen. The cost: **`engine/package-lock.json`
  must stay in sync with `engine/package.json`** — after changing an engine
  dependency, run `npm --prefix ./engine install` once to refresh the lock and
  commit it, or the next root install fails everywhere with npm's
  "can only install packages when your package.json and package-lock.json are
  in sync" error.
- **Local dry run:** `npm run build && npx electron-builder --linux --publish
  never` packs `release/Elm-Story-NG-<version>.AppImage` without uploading, which
  is how the config was validated.
