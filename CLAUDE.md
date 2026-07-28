# Working on Elm Story

A visual editor for branching narrative storyworlds. Abandoned by its authors at
0.7.0 (April 2022); the build toolchain has been modernized, the application
code has not. Read `README.md` first for setup and scripts — this file covers
what is easy to get wrong.

## Two applications, one repository

**The editor** is the Electron app at the repository root. `src/main.ts` is the
main process, `src/index.html` plus `src/index.tsx` the renderer, built by
`electron.vite.config.ts` into `out/main` and `out/renderer`.

**The Storyteller engine** in `engine/` is the runtime that plays a storyworld.
It has its own `package.json` and `node_modules`, and is consumed three ways via
`npm run engine:sync`:

| output | consumer |
| --- | --- |
| `assets/engine-dist/` | copied verbatim when a user exports a storyworld as a PWA |
| `src/styles/engine.less`, `engine-editor.less` | imported by `src/App.global.less` |
| `src/components/Storyteller/embedded/` | imported by the renderer for in-editor preview |

**All three are generated and git-ignored. `engine/assets` and `engine/src` are
the source of truth.** Editing `src/styles/engine-editor.less` looks like it
works and is silently overwritten on the next build.

Two editor modules also import from `engine/src` directly
(`ElementEditor/SceneMap/EventSnippet.tsx`, `lib/serialization.ts`), which is
inconsistent with the embedded copy but works.

## Do not upgrade React

The renderer is on **React 17** deliberately. `antd` 4, `rc-dock` 3,
`react-flow-renderer` 9, `react-beautiful-dnd` 13, `slate` 0.72, `react-query` 3
and `react-router-dom` 5 each need a breaking migration, and `antd` 4 to 5 alone
means replacing Less with CSS-in-JS across 68 stylesheets. Everything is pinned
to the newest release inside its current major, so those upgrades are
individually pickable. Packages whose next major needs React 18 are held at
their latest React-17-compatible release.

`dexie` stays on 3.x. The engine carries five versioned IndexedDB migrations
(`engine/src/lib/db/v6`–`v10`) and Dexie 4 changes transaction semantics;
upgrading risks existing user data.

`.npmrc` sets `legacy-peer-deps` because no `@atlaskit/tree` release targets
React 17 (v8 declares `^16.8.0`, v9 declares `^18.2.0`).

**Never run `npm audit fix --force`.** Every fix it proposes here is a
downgrade (`electron-builder` to 22, `react-query` to 3.10, `copyfiles` to 1.0).
The 19 reported vulnerabilities are 3 distinct advisories fanned out
transitively.

## Debug by reading the DOM, not by inferring

`npm run dev:debug` exposes the DevTools protocol on port 9222.

```bash
curl -s http://localhost:9222/json | grep webSocketDebuggerUrl
```

A WebSocket client can then use `Runtime.evaluate` for computed styles and
ancestor walks, `Input.dispatchMouseEvent` for clicks and hovers with real user
activation (`element.click()` does not provide it, and file inputs require it),
and `Page.captureScreenshot` to capture the window regardless of which desktop
window is in front.

**This is not optional advice.** Two styling bugs here were misdiagnosed by
sampling pixel luminance from screenshots, because a bright emoji or icon inside
the sampled region is indistinguishable from bright text. One query for a
computed `color` settled in seconds what two rounds of pixel measurement got
wrong. When a harness disagrees with the running app, believe the app.

### Reaching the interesting screens

The app opens on the dashboard with nothing selected. To get to the Composer:

1. **Select studio…** → **Ravetracer**
2. Click the storyworld (**Archiv der Erinnerungen**)
3. Click the first entry in the left-hand outline

That last click lands on a SceneMap with event nodes, which is where rc-dock,
react-flow-renderer and slate are all exercised at once. Characters open as a
modal from the bottom-left panel; character mask images are changed by
**right-clicking** a mask tile, not from a visible button.

`element.click()` from `Runtime.evaluate` is enough for most of this.
`Input.dispatchMouseEvent` is needed wherever user activation matters, which
includes anything that ends in a file picker.

## Bug classes that have already bitten

Most breakage since the revival is one of these five. Check them first.

**1. rc-dock's light-theme colour leaking in.** `rc-dock.css` sets
`.dock-panel { color: rgba(0, 0, 0, 0.85) }`. Anything inside a dock panel that
does not set its own colour inherits black against this dark UI. It has caused
this four times already:

| symptom | fixed in |
| --- | --- |
| invisible storyteller body copy | `#runtime` colour in `engine-editor.less` |
| invisible inactive dock tab labels | `routes/Composer/styles.module.less` |
| invisible SceneMap event node previews | `.EventSnippet` in `SceneMap/styles.module.less` |
| invisible event content while editing | `.EventContent` in `EventContent/styles.module.less` |

Headings often escape because antd's dark theme colours `h1`–`h6` explicitly,
which makes the symptom masquerade as a heading-versus-paragraph problem. It bites
hardest where the markup is generated without classes, as `lib/serialization.ts`
does for node previews. **A black-on-black report is probably this**: check the
computed `color` and walk the ancestor chain to find where it turns black.

**2. antd 4 class components that became forwardRef components.** `Input` was a
class holding `state.focused`; it is now built on `rc-input` and its ref exposes
`focus()`, `blur()`, `select()` and `input`, with no `state`. Reading
`ref.current?.state.focused` threw inside an effect and unmounted the whole
Variables panel, which presented as a blank screen. Note `Input` wants an
`InputRef` while `InputNumber` wants a `Ref<HTMLInputElement>`; a single ref
cannot serve both. `useRef<Input>` anywhere is a leftover from the class era.

**3. `electron-context-menu` preempting the app's own menus.** Four surfaces use
antd `Dropdown` with `trigger={['contextMenu']}`: `WorldOutline/ContextMenu.tsx`,
`CharacterManager/CharacterMask.tsx`, `ElementEditor/SceneMap/EventNode.tsx`,
`EventContent/Tools/CharacterElementSelect.tsx`. The native menu only appears
when it has applicable entries, so anything that adds a default entry makes it
appear everywhere and swallow those right-click menus. That is why
`showSelectAll: false` is set in `src/main.ts`; without it, adding a character
image silently does nothing.

**4. Asset URLs.** User assets live under `userData`, outside the bundle. The
renderer is served over **http** in development and loaded from **file://** when
packaged, so a filesystem path cannot be used as a URL. `GET_ASSET` returns an
`esg-asset://` URL served by `protocol.handle` in `src/main.ts`. If images go
blank, check the computed `background-image`: a `http://localhost:5173/home/...`
value means something reintroduced a raw path.

That handler also honours byte ranges, which is not decoration: **media served
without `Accept-Ranges`, `Content-Length` and a 206 for `Range` requests is not
seekable.** Chromium treats it as a stream of unknown length, `seekable` comes
back empty and assigning to an `<audio>` element's `currentTime` silently does
nothing, which is how imported MP3s came to play but refuse to scrub. `net.fetch`
does forward a `range` header to `file://`, so the slicing is delegated to it.
Verify with a `fetch(url, { headers: { Range: 'bytes=0-99' } })` from the
renderer and check for a 206 with 100 bytes, not by listening.

**5. The shared AudioContext going silent.** Chromium suspends it on its own,
under the autoplay policy and whenever the renderer is backgrounded or the
preview sits behind another dock tab. Howler tracks only its own `Howler.state`
and never observes the context, so the two desync; because
`Howler._autoResume()` resumes only when `Howler.state` itself reads
`'suspended'`, that desync is permanent. The tell is that `play()` succeeds and
`playing()` returns **true** while `seek()` stays at **0** — gain ramps scheduled
by `fade()` are pinned to a clock that never advances. `useAudioMixer.ts` mirrors
the context's state onto Howler, disables Howler's idle suspension and awaits a
resume before any play or fade. Diagnose it by reading
`Howler.state`, `Howler.ctx.state` and `_howls[0].seek()` together; either one
alone is misleading. Note also that the preview's mute defaults to **on**
(`devTools.muted`), which is a far more common reason for hearing nothing.

## The PWA export contract

`src/main.ts` post-processes the built engine when exporting a storyworld. It is
coupled to the engine's build output in ways that break quietly:

- It reads `manifest.json` from the output root, so `build.manifest` is pinned to
  that filename in `engine/vite.config.mts`. Vite would otherwise emit
  `.vite/manifest.json`.
- It string-replaces `___worldTitle___`, `___worldDescription___`,
  `___worldId___` and `"___storytellerData___"` in the HTML, the entry chunk and
  the web manifest. **`engine/index.html` must produce exactly one entry chunk**,
  which is why `main()` is invoked from `main.tsx` rather than from an inline
  script, and why the engine's HTML is not minified.
- It rewrites the service worker's precache revisions via `src/lib/precache.ts`.
  Workbox emits `revision:null` for content-hashed filenames; the original code
  assumed a quoted revision and spliced an md5 into arbitrary bytes of `sw.js`.

Changes here fail only when someone actually exports a storyworld, so exercise
that path.

## Housekeeping

- Type checking is deliberately **not** in the build path. `engine/` is clean;
  the editor is at 39 errors, down from 127. Vite strips types without checking
  them, so nothing here blocks a build. Do not add `tsc` to `build` until the
  editor is clean too.
- `npm run lint` exits 0 with ~730 catalogued warnings, counts recorded in
  `eslint.config.mjs`. `react-hooks/rules-of-hooks` was 89 sites across 21
  files and is now **0 and set to `error`**, so it gates. The pattern it caught
  was an early `return null` above a component's hooks, which changes hook order
  between renders. If you need a guard, put it *below* every hook and let the
  hook bodies tolerate the absent value — the data hooks in `src/hooks` and the
  engine's `useLiveQuery` callbacks all take optional ids and return `undefined`
  for exactly this reason. `exhaustive-deps` (148) and `set-state-in-effect`
  (55) are still real risks, just too widespread to gate on.
- `npm test` runs Vitest. `vitest.config.ts` mirrors the renderer's `electron`
  alias onto a stub in `src/__tests__/stubs/`, and `setup.ts` supplies the
  browser APIs jsdom lacks but antd, rc-dock and react-flow touch on mount.
- Never run `npm audit fix --force`; every remaining fix it offers is a
  downgrade. `GHSA-mh99-v99m-4gvg` (brace-expansion) is knowingly accepted and
  documented in both package.json files. Do **not** try to fix it with an
  `overrides` entry: 5.0.8's CommonJS build exports a named `expand` while
  minimatch 3 and 4 call the default export, which breaks ESLint outright. That
  was tried and reverted.
- No native modules, so no `electron-rebuild`.
- Electron 43 declares no install script, so `scripts/ensure-electron.mjs`
  fetches its binary from `postinstall`. npm 11 also gates dependency install
  scripts behind `allowScripts` in `package.json`.
- On Linux, unpackaged runs need `npm run dev:nosandbox` or a one-time
  `chown root` + `chmod 4755` on `node_modules/electron/dist/chrome-sandbox`.
- `.gitattributes` had a global `text eol=lf` with almost no binary
  declarations, which corrupted a `.mp3` and a `.ttf`. Declare new binary
  extensions there.

## A shell gotcha that wasted real time

`pgrep -f electron/dist/electron` matches **its own shell's** command line, so it
always reports a match and `kill $(pgrep -f ...)` kills the calling shell —
which surfaces as a confusing exit code 144. Use a bracket to break the
self-match:

```bash
pgrep -f "dist/electro[n]"
```
