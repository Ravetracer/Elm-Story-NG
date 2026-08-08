# Keyboard handling and the layout trap

How key events are handled across the editor, and the one class of bug that keeps
biting: matching a **physical key** when the intent is a **character**.

## `is-hotkey` matches by keyCode, not by character

`is-hotkey` (used by the content editor's `HOTKEYS` map and the scene map's
`CLIPBOARD_HOTKEYS`) matches by `event.which`/`keyCode` **by default**. A keyCode
identifies a physical key position, which is only the same character on the layout
the binding was written for (US QWERTY here).

This is correct for control combinations — `mod+b`, `Ctrl+C`, arrows, Enter — where
the *position* is what the user means and the modifier disambiguates. It is wrong
for any binding that stands in for a **printable character**, because the same
physical position produces a different character on another layout.

### The bug it caused: a German keyboard could not type `?`

The content editor bound the template-expression trigger as:

```
'shift+[': OPEN_BRACKET   // US: Shift+[ is {
'shift+]': CLOSE_BRACKET  // US: Shift+] is }
```

On a **German (QWERTZ)** layout:

- `?` is **Shift+ß**, and the `ß` key sits at **keyCode 219** — the same code US
  uses for `[`. So `is-hotkey('shift+[', event)` matched a press of `?`, the
  handler called `preventDefault()` (killing the `?`) and inserted `{  }`.
- `` ` `` is **Shift+´** at **keyCode 221** (US `]`), so `'shift+]'` swallowed it.
- Worse, the *real* German `{` is **AltGr+7** (keyCode 55), which did **not** match
  `'shift+[']`, so `{` never auto-paired. The feature was backwards: `?` inserted
  braces, `{` inserted a bare brace.

It also read as **"letters get deleted while typing"**: a `?` mid-sentence yanked
the caret inside a fresh `{  }`, so the next keystrokes landed in the wrong place.

### The fix: match the produced character

The `{` trigger is detected in `EventContent`'s `onKeyDown` by
`event.key === '{'` — `event.key` is the resolved character on every layout, so
`{` auto-pairs everywhere and `?`/`` ` ``/`}` type normally. `'shift+['` and
`'shift+]'` were removed from `HOTKEYS` (`src/data/eventContentTypes.ts`); the
`CLOSE_BRACKET` handler was a no-op and is gone, so a literal `}` now types.

**Rule of thumb:** if a binding represents a character a user would *type*
(`{`, `}`, `?`, `@`, `#`…), match `event.key`. Reserve `is-hotkey`/keyCode for
`mod`/`Ctrl`/`Alt` combinations and named keys (Enter, Tab, arrows, Escape).

## The other layout collision: menu accelerators vs. AltGr

`src/menu.ts` registers the UI-zoom accelerators `CmdOrCtrl+Alt+=`, `CmdOrCtrl+Alt+-`
and **`CmdOrCtrl+Alt+0`**. On Linux/Windows **AltGr == Ctrl+Alt**, and on a German
layout **`}` is AltGr+0** — i.e. `Ctrl+Alt+0` — so typing `}` can trigger
zoom-reset instead of inserting the brace. The window is frameless so the menu is
never drawn, but `setApplicationMenu` still registers the accelerators.

This is **not yet fixed** (dated 2026-08-08). It matters less than it looks because
the `{` trigger auto-pairs the closing brace (`{  }`), so an author writing an
expression rarely types `}` by hand. A proper fix would drop the accelerators from
the application menu on non-macOS (the picker in the title bar already owns UI
scale via `WINDOW_EVENT_TYPE.ZOOM_UI`, and the frameless window never shows the
menu), leaving `Ctrl+Alt+0` free for `}`. Verify against a German layout before and
after.

## Where key events are handled

- **Content editor** — `EventContent`'s `<Editable onKeyDown>` plus the `HOTKEYS`
  map in `src/data/eventContentTypes.ts`, dispatched through `processHotkey`. The
  `/` command menu is triggered by a content regex (`showCommandMenu`), not a
  keydown.
- **Scene map clipboard** — `SceneMap`'s `keydown` listener matches
  `CLIPBOARD_HOTKEYS` (Ctrl/Cmd+X/C/V/D) and **stands down inside any
  input/textarea/contentEditable and while a text selection is non-collapsed**, so
  it does not fight the editors. These are control combos, so keyCode matching is
  appropriate.
- **Menu accelerators** — `src/menu.ts`; the frameless window never renders the
  menu, so accelerators are the only way these fire (and the title-bar picker is
  the only place UI-scale ones are written down).
