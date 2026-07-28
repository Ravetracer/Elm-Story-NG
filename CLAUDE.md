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

## Bug classes that have already bitten

Most breakage since the revival is one of these four. Check them first.

**1. rc-dock's light-theme colour leaking in.** `rc-dock.css` sets
`.dock-panel { color: rgba(0, 0, 0, 0.85) }`. Anything inside a dock panel that
does not set its own colour inherits black against this dark UI. It has already
caused invisible storyteller body copy (fixed by giving `#runtime` a colour in
`engine-editor.less`) and invisible inactive dock tab labels (fixed in
`routes/Composer/styles.module.less`). Headings often escape because antd's dark
theme colours `h1`–`h6` explicitly, which makes the symptom masquerade as a
heading-versus-paragraph problem. **A black-on-black report is probably this.**

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

- Type checking reports ~127 errors and is deliberately **not** in the build
  path. Most are unused locals and third-party typing drift; the upstream engine
  build already failed its own `tsc` step before abandonment. Vite strips types
  without checking them. Do not add `tsc` to `build` without fixing them first.
- There is no linter and no test runner. Both were removed rather than left
  reporting success without running.
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
