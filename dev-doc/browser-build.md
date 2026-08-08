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
   while not granted. **Chrome declines silently** — `persist()` resolves `false`
   with no prompt unless the origin has site engagement / is installed / has
   notifications — so *Enable persistence* looked like it did nothing. The banner
   now detects the `false` and swaps to an explanation (Chrome grants it with use or
   on install; export backups meanwhile) rather than appearing broken.
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

## Window chrome + the CSS-zoom popover trap (web-only, done v0.54.0)

- **Inert window controls dropped.** `TitleBar` builds its button list with the
  quit/minimize/fullscreen controls only when `!IS_WEB_BUILD` — they drive the
  Electron window and do nothing in a browser tab, which has its own controls. The
  web build keeps UI Size and Help. (No native menu to drop: Electron's `Menu` is
  never created in the browser adapter.)
- **UI scaling uses `transform: scale()`, NOT CSS `zoom`.** This is the crux and
  was found empirically. antd positions every popup with `dom-align`, which
  **understands a transformed ancestor but has no handling for CSS `zoom`** — under
  `zoom` it writes layout-space `left/top` against zoom-scaled rects and every
  dropdown/select lands off-screen (measured: the studio Select dropdown at x≈918 in
  a 913-wide viewport at zoom 1.5; no `getPopupContainer` — body, parentElement,
  `#root` — fixes it). Switching the browser's `webFrame.setZoomFactor` stand-in to
  `transform: scale(factor)` on `#root` fixed it: the same dropdown then landed
  right under its selector. The UI Size control's own CSS popover (below) predates
  this and still works; it did not need reverting.
  - **`#root` setup (in `electronBrowser.ts`'s `webFrame`):** while scaled, `#root`
    is `position: fixed; top/left: 0` (the global `div { position: relative }` rule
    otherwise leaves it offset in flow, and since it is the containing block for the
    fixed title bar and durability banner, that offset pushed both off their edges),
    `transform-origin: top left`, `width/height: calc(100vw|100vh / factor)` so it
    fills the viewport once scaled, and html/body `overflow: hidden` while scaled.
  - **Popups render at 1:1 in `<body>` (outside the scaled `#root`), so they are
    scaled in place.** dom-align only positions correctly when the popup's
    offsetParent is *unscaled* (verified: scaling `body` instead of `#root`
    mis-aligned everything). So popups stay in body — positioned correctly — and a
    small injected stylesheet (`#esg-popup-scale`) scales them from their top-left
    corner via `transform: scale(var(--esg-ui-scale)) !important`, matching the app
    size while keeping dom-align's placement. `--esg-ui-scale` is set on the (unscaled)
    document root. `!important` beats antd's inline animation transform.
  - **Modals scale from their centre.** The same stylesheet scales `.ant-modal`
    with `transform-origin: top center`, and `center center` under
    `.ant-modal-centered` (antd's vertical-centre mode), so a modal grows about its
    own centre and stays centred rather than drifting. Verified live at 1.5 (About
    box + New Studio/World dialogs centred and scaled). A very wide modal at Huge can
    exceed the viewport width — transform adds no scrollbar — so pick a smaller size
    for those.
  - **react-flow is fine under the transform** (the real worry): measured live, a
    150px node drag at scale 1.5 moved the node 156 visual px — 1:1 with the cursor,
    not amplified. Nodes render, hit-test and drag correctly.
  - Verified live at Largest: dashboard (studio Select aligned + scaled, title bar
    at top, banner at the viewport bottom, no scrollbar) and composer (three-panel
    rc-dock layout scaled, scene map nodes render + drag correctly).
- **The UI Size menu is a CSS popover, not an antd Dropdown** (`.uiScalePopover`,
  closed on outside-click/Escape). It is our own chrome and positions with plain
  CSS, so it was immune to the popup bug even before the transform switch.

## Remaining §10 work (as of 2026-08-08, v0.54.0)

- **web→desktop ZIP import (deferred).** Desktop imports `.json` + sibling `assets/`
  only; add ZIP import to `main.ts` for the full 4-way round-trip. Not requested yet.

## Verifying

`npm run build:web && npm run preview:web`, then drive a real browser (Playwright
MCP): navigate, `browser_evaluate` for DOM/IndexedDB/fetch, `browser_file_upload`
for imports. Fixtures must live inside the project root (Playwright allowed-roots);
`.playwright-mcp/` is allowed and gitignored — clean it up after.
