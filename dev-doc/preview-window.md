# Design plan: the standalone preview window

> **Status: plan, not built.** The design and the reasoning; implementation
> follows. Companion to `dev-doc/theming-and-skins.md` — it exists because phases
> 1 and 2 of that plan (alignment, theme lock) are visible only in the
> full-window player, not the composer dock preview, and every later phase
> (inventory, skins, wearables) will be the same. The preview window is what lets
> an author *see* those without exporting a PWA.

## The problem it solves

The composer's dock preview cannot show alignment, theme, background or skin, and
it is not a matter of a missing feature — it is structural:

- **`engine-editor.less` pins the preview's palette and layout.** Its `#runtime`
  block hardcodes `--background-color`/`--text-color` and does not centre
  `#runtime` at a measure, so there is no theme to switch and no slack to shift.
- **`base.less` — which centres `#runtime`, paints the theme and reads
  `data-stream-alignment` — is loaded only by the standalone engine
  (`engine/index.html`), never in the editor bundle** (`App.global.less` imports
  `engine.less` + `engine-editor.less` only).
- **`Presentation` — which sets `data-theme`/`data-size`/`data-font` and so
  *enables* alignment and theme — is mounted only in the exported player**
  (`Runtime`'s `!isComposer` branch).

So the author's presentation choices are real and correct; the dock preview is
simply the wrong surface to view them on. Confirmed acceptable by the maintainer;
the answer is a second surface, not a rebuild of the first.

## The coupling that shapes the whole design

**`isComposer = studioId ? true : false`** (`engine/src/Runtime.tsx`). Reading
the *live* Dexie database and rendering *as the composer* are the same switch, and
`isComposer` drives roughly twenty behaviours — the install strategy
(`Installer`: `!isComposer && data` installs baked data into a library DB, while
`isComposer` reads the live world through a live query and `resetWorld`s), audio
muting (`devTools.muted` vs `settings.muted`), the XRay overlay, the stream title
bar, in-place event editing, the Renderer's title card, and more.

The consequence: **"open the composer preview in its own window" does not work.**
Keeping `isComposer` true keeps the pinned palette and keeps `Presentation`
unmounted, so alignment and theme still would not show — the exact failure the
dock preview already has. Decoupling `isComposer` from `studioId` would mean
untangling all twenty behaviours, in the direction of a rendering mode that has
never existed. Rejected.

## The approach: bake a snapshot, run the real player

Reuse the **export player**, which already does everything right — mounts
`Presentation`, sets the data attributes, loads `base.less`, paints the theme,
honours alignment and background. The preview window *is* the exported player,
pointed at a fresh in-memory snapshot instead of a shipped file.

1. **The editor bakes a snapshot** of the live world the same way export does —
   `getWorldDataJSON` + the `format()` compile — producing packed
   `ESGEngineCollectionData`. This already runs in the renderer for export, so it
   is a call, not new machinery.
2. **A dedicated renderer entry (`preview.html` / `preview.tsx`)** loads the
   *standalone* engine styles and mounts `<Runtime world={{ id, data, packed:
   true }} />` **with no `studioId`** — so `isComposer` is false and the player
   branch runs, identically to a shipped export.
3. **Opened in a new window / tab.** Desktop: a `BrowserWindow` created in the
   main process. Web: `window.open`. Same origin either way.
4. **Reload = re-bake.** Clicking Preview again bakes a fresh snapshot and
   reloads the window. This is exactly the "reload to refresh" model chosen for
   v1 — no cross-window live-sync bridge, and the author sees precisely what a
   player will get, because it is the player.

**Why a snapshot rather than reading live Dexie in the window.** Reading live
Dexie is `isComposer` territory (see above); the player branch installs *baked
data*. A snapshot keeps the preview on the well-tested export path and gives
reload-to-refresh its natural meaning. The cost — the preview is a moment-in-time,
not live — is the semantics the maintainer picked.

## The data channel

The packed snapshot is produced in the editor renderer and consumed in the
preview renderer. **`localStorage`, keyed `esg-preview-<worldId>`**, is the single
path that works in both targets: a second `BrowserWindow` shares the origin's
`localStorage` in Electron, and `window.open` shares it across tabs on the web.
The editor writes the key before opening; `preview.tsx` reads it on mount and may
clear it after. (The engine already uses `localStorage` for `worldMeta`, so this
is an established channel, not a new dependency.)

- **Size is the one caveat.** The payload is LZW-packed, so the playground world
  is trivial and the imported world is well within the ~5 MB budget, but a guard
  and a clear message beat a silent quota throw. Noted for implementation.
- **Not IPC.** An IPC round-trip through the main process would work on desktop
  but not on the web build, and `localStorage` avoids the `__ESG_WEB__` split for
  the *data*. The split stays only where it must — *opening* the window.

## The desktop / web split

Only the **opening** of the window differs, and it is the existing `__ESG_WEB__`
seam:

- **Desktop:** a renderer→main event (a new `WINDOW_EVENT_TYPE.OPEN_PREVIEW`
  carrying `{ studioId, worldId }`) → the main process creates a `BrowserWindow`
  and loads the preview entry — dev: `${ELECTRON_RENDERER_URL}/preview.html?…`,
  packaged: `loadFile('../renderer/preview.html', { search })`, mirroring
  `createWindow`'s dev-URL-vs-`loadFile` split. `frame: true` (a normal,
  resizable OS window — the editor's frameless custom title bar is not wanted
  here), same `webPreferences` as the main window.
- **Web:** `window.open('preview.html?worldId=…', …)` directly; no main process.

## Build configuration

`electron.vite.config.ts`'s renderer `rollupOptions.input` is a single
`src/index.html` today; it becomes an object with `index` and `preview` entries.
The web build (`vite.web.config.mts`) needs the same second entry. **This is the
part that fails only at package/export time**, so it is exercised deliberately:
build the app, open the preview from a packaged build, confirm `preview.html`
resolves from `out/renderer`.

## Integration risks, named

- **Fonts and asset URLs in the standalone styles.** `preview.tsx` must load
  `base.less` + `variables.less` + `engine.less` with working `@font-face` and
  `esg-asset://` resolution. `esg-asset://` is served by `protocol.handle` in any
  same-session window, so images are fine; the **font paths in `base.less` are
  the fiddly bit** and are the first thing to verify in the running preview. This
  is the single most likely thing to look right in code and render wrong.
- **No service worker.** SW registration lives in the engine's `main.tsx`, not in
  `Runtime`, so a preview mounting `Runtime` never registers one — which is
  correct; a preview must not precache anything. Do not add `ServiceWorker` to
  the preview entry.
- **The snapshot must be complete.** It goes through the same `format()` pick
  lists as export, so any field missing there is missing here too — which makes
  the preview a genuine early-warning for the export contract, not a parallel
  path that can drift.

## The trigger

A **Preview in window** button in the world outline's title-bar tools row, beside
the asset-manager / storyworld-map / interface-text actions — a world-level
action, available whenever a world is open, which is where those live now (and
the row already wraps, so a new tool costs no arithmetic — see `CLAUDE.md`, the
UI-scale section). It bakes, writes the `localStorage` key, and opens (or focuses
and reloads) the window.

## Scope for v1

- One preview window; reopening re-bakes and reloads it rather than stacking
  windows.
- Reload-to-refresh only; no live sync.
- Desktop and web both, since the data channel is shared and only the open call
  splits.
- Verified in the running app *and* a packaged build (the build-config change is
  the risk), on both the playground and the imported world.
