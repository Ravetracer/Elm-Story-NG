# The browser build (TODO §10)

How the editor runs in a plain browser tab, end to end. `CLAUDE.md` has no
dedicated browser-build section yet; this is the flow reference. Gotchas still win
from `CLAUDE.md` where they overlap.

## The one seam

The renderer is reused **100% unchanged**. The only difference between desktop and
web is which module the `electron` import resolves to:

- desktop → `src/lib/electronRenderer.ts` (reads Electron off the global `require`)
- web → `src/lib/electronBrowser.ts` (the browser adapter — no main process)

`vite.web.config.mts` sets the alias. `npm run build:web` emits a static,
relative-pathed `dist-web/` (gitignored, deployable anywhere); `dev:web` /
`preview:web` run it. All run `engine:sync` first, like the desktop `dev`/`build`.
The **desktop build is untouched** — no changes to `electron.vite.config.ts` or any
renderer module.

## What the adapter implements (`electronBrowser.ts`)

- **PLATFORM** — `App` renders nothing until `app.platform` arrives; the adapter
  delivers it to every listener as soon as one registers.
- **Assets** — `SAVE/GET/LIST/REMOVE/REMOVE_ASSETS/RESTORE_ASSET` are backed by
  IndexedDB Blobs (Dexie DB `esg-browser-assets`, `assets` + `trash` tables),
  handed out as `URL.createObjectURL`. Blob URLs are seekable, so the desktop's
  `esg-asset://` range/206/unseekable-MP3 handling has nothing to do here.
- **Window chrome** — quit/minimize/fullscreen are no-ops; `openExternal` opens a
  tab; `setZoomFactor` → CSS `zoom` on the document root.
- **Export/import** — see below.

## Import (`IMPORT_WORLD_GET_JSON` + `IMPORT_WORLD_ASSETS`)

A `<input type=file>` clicked inside the import gesture accepts `.json` (structure
only) or `.zip` (the portable bundle). A `.zip` is unpacked by `lib/worldZip`; its
assets are held in a module-level `pendingImportAssets` and written to the asset
store by `IMPORT_WORLD_ASSETS` once the world exists. The rest of the pipeline
(validate, upgrade chain, create studio, persist) is unchanged.

## Export (`EXPORT_WORLD_START`) — three kinds, all Blob downloads

- **JSON** — a lone `.json`, structure only.
- **ZIP** — the world JSON + its IndexedDB assets via the shared `lib/worldZip`,
  the *same* format the desktop `main.ts` writes, so a bundle round-trips between
  the two builds with media intact.
- **PWA** — a playable app, packed as `<title>_pwa.zip`. This is the interesting
  one; see next section.

## PWA export in the browser — the flow

Goal: the same output `main.ts` produces on the desktop (a built Storyteller engine
with the storyworld injected), but built in the tab and delivered as a `.zip` the
author unzips and serves.

Two halves:

1. **Ship the engine into the web build.** `vite.web.config.mts`'s `shipEngineDist`
   plugin copies `assets/engine-dist` → `dist-web/engine-dist` on `closeBundle` and
   writes a `files.json` index listing every file. In `dev`/`preview` a middleware
   serves the same paths straight from disk. Without this the browser has nothing to
   fetch — the engine is not part of the renderer bundle.
2. **Rewrite it — shared with the desktop.** `src/lib/worldPWA.ts` is the pure
   rewrite, extracted from `main.ts` so the two builds cannot drift (the same
   relationship `lib/worldZip` has for the ZIP format). Given the engine's four text
   files it: injects title/description into `index.html` + web manifest, injects the
   world id and `format(worldData)` into the entry chunk, and patches the Workbox
   precache (`lib/precache`) so a returning visitor is not served the
   pre-injection build (#379, #373). `md5` is **injected**, not imported, so the
   module is environment-agnostic; content-asset revisions are md5s of their bytes,
   which each caller already has.

`electronBrowser.ts`'s `buildWorldPWA(json)` is only the browser I/O around that
pure core:

- `engineDistBase()` resolves `engine-dist/` against `location.href` **minus the
  hash** — a HashRouter path (`/#/composer`) or a subpath deployment must not send
  the fetch to the wrong place.
- fetch `files.json`, `manifest.json` (→ entry chunk filename), and the four text
  files; read the world's assets from IndexedDB (bytes + md5).
- call `rewritePWAFiles(...)`.
- pack with JSZip: every engine file (rewritten four substituted in, `manifest.json`
  and `files.json` dropped — `manifest.json` is the desktop's removed build
  artifact) plus `assets/content/<id>.<ext>`.

`main.ts`'s desktop path now does the same: read files off disk, build the
`contentAssets` list with md5, call `rewritePWAFiles(...)`, write the folder.
`format` and `precache` are imported only inside `worldPWA` now, not `main.ts`.

## What is verified, and what is not

- `worldPWA.rewritePWAFiles` — unit tested (`src/__tests__/worldPWA.test.ts`):
  every placeholder filled, sw revisions are md5s of the *rewritten* files, content
  assets added after the web manifest, precache failure reported not thrown.
- `md5` over `Uint8Array`/`Buffer`/`number[]` is identical (isomorphic lib), so the
  browser byte-hashing matches the desktop.
- Engine fetch layer verified live: all 18 shipped files return 200 from the page
  origin, and the shipped engine carries every placeholder + precache entry the
  rewrite targets.
- **Not driven end to end in CI:** the actual UI click → downloaded zip is the
  maintainer's manual check (he owns PWA-export verification). The pieces beneath it
  are each covered.

## Storage durability (web-only, done v0.53.0)

The desktop app keeps a storyworld in Electron's own persistent storage; the
browser build keeps it in an **origin's** IndexedDB, which the browser evicts
(Safari ~7 idle days, Chromium under pressure) with no warning. Two defences live
in `src/lib/storageDurability.ts` and surface through the web-only bottom bar
`components/StorageBanner`:

1. **`requestPersistentStorage()`** calls `navigator.storage.persist()` once on
   web startup (idempotent — returns early if already persisted). It can be
   declined, so `getStorageStatus()` reads `persisted()` + `estimate()` and the
   banner shows a **persistence warning** with an *Enable persistence* re-request
   while not granted.
2. Because it can be declined, a re-importable export is the real backup. A
   per-world last-export timestamp lives in `localStorage['esg-world-last-export']`
   (`recordWorldExport`/`getWorldLastExport`), written on **JSON/ZIP** export
   (`ExportWorldMenu` and the banner) but **not PWA** (a PWA is a playable app, not
   re-importable). `isBackupStale` (pure, tested) drives a composer **backup
   reminder** — never-exported or >`BACKUP_STALE_MS` (1 day) — with a one-click
   *Export backup ZIP* (`getWorldDataJSON` → `EXPORT_WORLD_START` ZIP, then record).
   No silent downloads (browsers throttle them; unattended files are hostile).

The persistence warning takes precedence over the reminder — one message at a
time. Both banner messages are gated on `app.selectedStudioId`/`selectedWorldId`/
`location` from `AppContext`, which the composer sets (`WorldBox` dispatches
`GAME_SELECT` + pushes `COMPOSER`; `TitleBar` sets `location` from the pathname).

**Web-only via a build-time flag.** `__ESG_WEB__` is a Vite `define` — `true` in
`vite.web.config.mts`, `false` in `electron.vite.config.ts`'s renderer — so
`IS_WEB_BUILD` (a `typeof`-guarded read, safe under Vitest where the define is
absent) compiles the whole feature out of the desktop renderer. Declared in
`src/declaration.d.ts`. App.tsx renders `<StorageBanner />` behind that flag.

Verified live: on the dashboard with `persisted:false` the warning banner renders
(amber border, fixed bottom, usage shown, Enable/Dismiss), Dismiss hides it, and
the flag is inlined (no `__ESG_WEB__` token in the bundle). The composer reminder
is built from already-verified parts (ZIP export, `isBackupStale`) and is the
maintainer's final live check.

## Remaining §10 work (as of 2026-08-08, v0.53.0)

- **Chrome with no browser equivalent.** Hide/drop the inert window controls
  (quit/minimize/fullscreen) and the native menu in the web build. `__ESG_WEB__` is
  now available to gate that too.
- **web→desktop ZIP import (deferred).** Desktop imports `.json` + sibling `assets/`
  only; add ZIP import to `main.ts` for the full 4-way round-trip. Not requested yet.

## Verifying

`npm run build:web && npm run preview:web`, then drive a real browser (Playwright
MCP): navigate, `browser_evaluate` for DOM/IndexedDB/fetch, `browser_file_upload`
for imports. Fixtures must live inside the project root (Playwright allowed-roots);
`.playwright-mcp/` is allowed and gitignored — clean it up after.
