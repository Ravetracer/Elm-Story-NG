# DevTools protocol helpers

Small, dependency-free scripts for driving and inspecting the running editor.
They exist because reading a computed value out of the live app is far more
reliable than inferring one from the stylesheets, and because several bugs in
this project's history were misdiagnosed by sampling pixel colours from
screenshots. See CLAUDE.md.

Start the app with a protocol endpoint first:

```bash
npm run dev:debug          # electron-vite dev --noSandbox --remoteDebuggingPort 9222
```

All four attach to the first non-devtools page target on port 9222 and use
Node's global `WebSocket`, so there is nothing to install.

| Script | Use |
| --- | --- |
| `eval.mjs '<expr>'` | Evaluate an expression in the renderer and print the result |
| `watch.mjs '<expr>' [ms]` | As above, then report console output and uncaught exceptions for `ms` |
| `click.mjs '<expr>' [ms]` | Click the element the expression returns, using real mouse events |
| `screenshot.mjs <out.png>` | Capture the window, independent of desktop stacking |
| `scenemap-perf.mjs [--pan N] [--zoom N]` | Measure a pan and a stepped zoom on the open scene map |

```bash
# what colour is this actually rendering, and where does it come from?
node scripts/devtools/eval.mjs 'getComputedStyle(document.querySelector(".dock-tab")).color'

# walk the ancestor chain to find where a colour turns black
node scripts/devtools/eval.mjs 'JSON.stringify((()=>{
  const chain=[]; let el=document.querySelector("#runtime p");
  for(; el; el=el.parentElement) chain.push([el.className||el.tagName, getComputedStyle(el).color]);
  return chain })())'

# catch the exception behind a blank panel
node scripts/devtools/watch.mjs 'document.querySelector(".dock-tab-btn").click()' 4000

# did that change actually make the scene map faster? (open a scene first)
node scripts/devtools/scenemap-perf.mjs
```

`scenemap-perf.mjs` reports frame quality **and** counts the editor's own graph
rebuilds out of its log output, which is what a frame counter cannot see. Its
numbers depend on how much of the storyworld outline is expanded, because the
viewport-centre dispatch re-renders every `ComposerContext` consumer — collapse or
expand the tree the same way on both sides of a comparison. See `TODO.md`, "Why the
scene map stalled while you moved it".

Two things worth remembering:

- `element.click()` does **not** grant user activation. Anything ending in a
  file picker needs `click.mjs`, which dispatches real mouse events.
- `screenshot.mjs` goes through the protocol rather than the X server, so it
  captures the app even when another window is in front. An `import -window
  root` screenshot will happily photograph whatever is on top instead.
