# Elm Story

Front-end application for the Elm Story platform: a visual editor for branching
narrative storyworlds.

Copyright (c) 2022 Elm Story Games

This is a revival of the abandoned 0.7.0 release. The build toolchain has been
modernized so the project runs on current Node and Electron; the application
code and its UI dependencies are deliberately unchanged. See
[Dependency policy](#dependency-policy) for why.

## Requirements

- Node.js >= 20.19 (developed against Node 26)
- npm 10+

No native modules are used, so no compiler toolchain or `electron-rebuild` step
is required.

## Setup

```bash
npm install
```

`postinstall` also installs the `engine/` workspace and downloads Electron's
platform binary, which can take a moment on a first install. The binary step is
needed because Electron no longer ships an install script of its own; see
`scripts/ensure-electron.mjs`.

npm 11 refuses to run dependency install scripts until they are listed in
`allowScripts` in `package.json`. The decisions there are deliberate and
annotated, so a warning about pending install scripts means a new dependency
arrived and needs a decision.

## Running

```bash
npm run dev
```

This builds the Storyteller engine, copies it into the renderer, then starts
electron-vite with hot reloading for the renderer and automatic restarts for the
main process.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Sync the engine, then start with hot reloading |
| `npm run dev:noengine` | Start without rebuilding the engine (faster iteration on the editor) |
| `npm run dev:nosandbox` | As `dev`, with the Chromium sandbox disabled (see [Linux](#linux-chromium-sandbox)) |
| `npm run dev:debug` | As `dev:nosandbox`, with a DevTools protocol endpoint on port 9222 (see [Inspecting a running instance](#inspecting-a-running-instance)) |
| `npm run build` | Production build into `out/` |
| `npm run preview` | Run the production build |
| `npm run package` | Build and package a distributable into `release/` |
| `npm run typecheck` | Type-check without emitting (see [Known issues](#known-issues)) |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run lint` | ESLint; exits non-zero on errors, not on warnings |
| `npm run lint:fix` | ESLint with autofix |
| `npm run format` | Format with Prettier |

### Linux: Chromium sandbox

Running unpackaged on Linux may fail with:

```
The SUID sandbox helper binary was found, but is not configured correctly.
```

Electron's `chrome-sandbox` helper has to be owned by root with the setuid bit
set, which npm cannot do at install time. Either fix the permissions once per
install:

```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
```

...or use `npm run dev:nosandbox`, which sets `ELECTRON_DISABLE_SANDBOX=1`.

Note that the renderer already runs with `nodeIntegration: true` and
`contextIsolation: false`, so the Chromium sandbox is not what isolates this
application in either case. Packaged builds are unaffected.

### Inspecting a running instance

The developer tools no longer open on startup; use F12 or Ctrl/Cmd+Shift+I, or
set `OPEN_DEVTOOLS=true`.

For anything to do with why an element is styled or behaving a particular way,
driving the app over the DevTools protocol is considerably faster than reading
stylesheets. Start it with `npm run dev:debug`, then:

```bash
# find the renderer target
curl -s http://localhost:9222/json | grep webSocketDebuggerUrl
```

From there a WebSocket client can call `Runtime.evaluate` to read computed
styles and walk ancestor chains, `Input.dispatchMouseEvent` to click and hover
with real user activation (which `element.click()` does not provide, and which
file inputs require), and `Page.captureScreenshot` to capture the window
independently of which desktop window happens to be in front.

Reading a computed value this way is worth more than inferring one from the
stylesheets. Two of the styling bugs in this repository's history were
misdiagnosed by sampling pixel colours, because a bright emoji or icon inside
the sampled region is indistinguishable from bright text.

## Architecture

Two applications live in this repository.

**The editor** (repository root) is the Electron application. `src/main.ts` is
the main process and `src/index.html` plus `src/index.tsx` are the renderer,
built by `electron.vite.config.ts` into `out/main` and `out/renderer`.

**The Storyteller engine** (`engine/`) is the runtime that plays a storyworld. It
is a standalone Vite application with its own `package.json`, and it is consumed
by the editor in three ways, all driven by `npm run engine:sync`:

1. `engine:build` produces a self-contained PWA in `assets/engine-dist/`, which
   the editor copies when a user exports a storyworld.
2. `engine:styles` copies the engine stylesheets into `src/styles/`.
3. `engine:embed` copies `engine/src` into
   `src/components/Storyteller/embedded/` so the editor can preview a storyworld
   in-place. Both directories are generated, and are not tracked by git.

### The PWA export contract

`src/main.ts` post-processes the built engine when exporting a storyworld, which
couples it to the engine's build output in ways that are easy to break:

- It reads `manifest.json` from the output root to find the entry chunk, so
  `build.manifest` is pinned to that filename. Vite would otherwise write
  `.vite/manifest.json`.
- It string-replaces placeholder tokens (`___worldTitle___`,
  `___storytellerData___` and others) in the HTML, the entry chunk and the web
  manifest. `engine/index.html` therefore produces exactly one entry chunk, and
  the engine's HTML is not minified.
- It rewrites the service worker's precache revisions for the files it modified,
  via `src/lib/precache.ts`.

## Dependency policy

The renderer stays on **React 17** on purpose. `antd` 4, `rc-dock` 3,
`react-flow-renderer` 9, `react-beautiful-dnd` 13, `slate` 0.72, `react-query` 3
and `react-router-dom` 5 each need a breaking migration to move past it, and
`antd` 4 to 5 alone means replacing Less with CSS-in-JS across 68 stylesheets.
Changing those at the same time as the toolchain would have made any failure
impossible to attribute.

Every dependency is pinned to the newest release within its current major.
Packages whose next major requires React 18 are held at their latest
React-17-compatible release. Dexie stays on 3.x rather than 4.x because the app
carries five versioned IndexedDB migrations and Dexie 4 changes transaction
semantics; upgrading it risks existing user data.

`.npmrc` sets `legacy-peer-deps` because no `@atlaskit/tree` release targets
React 17: v8 declares `react@^16.8.0` and v9 declares `^18.2.0`.

## Known issues

- The `engine/` workspace type-checks cleanly. The editor is down from 127 errors
  to 39, so `npm run typecheck` still reports and is deliberately not part of
  `npm run build`. What remains is mostly nullability and third-party type
  drift. Vite strips types without checking them, so none of it affects the
  build. For context, the upstream engine build ran `tsc &&` before `vite build`
  and was already failing at that step, so the project was released in a state
  where its own build could not complete.
- `npm run lint` exits 0 with roughly 800 warnings. They are catalogued rather
  than switched off, with counts recorded in `eslint.config.mjs`. The one worth
  attention is **`react-hooks/rules-of-hooks`: 89 sites across 21 files**, nearly
  all an early `return null` placed above a component's hook calls, which changes
  hook order between renders and can crash React. Most are in `engine/src`.
  Fixing them means restructuring those components.
- `GHSA-mh99-v99m-4gvg` (brace-expansion) is knowingly accepted and is the only
  distinct advisory in either workspace. The fix landed in 5.0.8 and was never
  backported, so no 1.x or 2.x release is clean. Forcing 5.0.8 through
  `overrides` does not work: minimatch 3 and 4 call the module's default export,
  while 5.0.8's CommonJS build exports a named `expand`, which breaks ESLint
  with `expand is not a function`. The affected copies reach the tree only
  through minimatch and glob in build tooling, which never sees anything but
  glob patterns from this repository.
- **Do not run `npm audit fix --force`.** Every remaining fix it proposes is a
  downgrade.
- `engine/assets/*.less` references a `Literata.ttf` that is absent from the
  repository, so that font silently falls back.
- `useAudioMixer` accepts no `onEnd` callback any more; nothing consumed it and
  nothing passed it.
