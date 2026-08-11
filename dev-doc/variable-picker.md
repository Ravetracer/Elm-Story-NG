# The variable picker (`{ }` autocomplete)

A dropdown that offers the world's variables inside a template expression, so an
author names one by picking rather than by typing its title exactly. This closes
the follow-up tracked in `dev-doc/scene-triggers.md`. It is the `{ }` analog of
the `/` command menu, built by mirroring it rather than generalising it — the two
insert differently (a node vs. plain text), so a shared surface would have cost
more than a parallel one.

## Why it earns its keep

A template expression resolves a variable **by title, not by id** (see the
"Template expressions" section of `CLAUDE.md`). So a mistyped or renamed title
does not fail anywhere a build would notice — it renders as an ERROR span. Picking
the title from a list is the one place the editor can keep the expression and the
variable in step at authoring time.

## Two ways in

- **Typing `{`** auto-pairs to `{  }` and drops the caret inside (existing
  behaviour, `HOTKEY_EXPRESSION.OPEN_BRACKET`). The resulting selection change runs
  through `onChange`, and the picker opens on an empty filter listing every
  variable.
- **`Alt+Space`** (`HOTKEY_EXPRESSION.OPEN_VARIABLE_MENU`), IDE-style. If the caret
  is already inside an expression it opens the picker at the caret directly (no
  edit happens, so `onChange` would not fire — the handler sets the menu props
  itself). Otherwise it inserts `{  }` exactly as `{` does and lets `onChange` open
  it. Matched on `event.code === 'Space'`; see `dev-doc/keyboard.md`.

## The moving parts

- **`showVariableMenu(editor)`** in `src/lib/contentEditor/index.ts` — the `{ }`
  twin of `showCommandMenu`. It returns `[show, filter, targetRange]`. It fires
  only when the caret sits inside an **unclosed** `{` on the current leaf
  (`/{[^{}]*$/` on the text from leaf-start to caret — the auto-paired `}` is
  *ahead* of the caret, so it is not scanned). The filter is the trailing partial
  identifier (`/(\w*)$/`), which also means the picker offers a variable for the
  **second operand** of an expression like `{ health > ar`, not just the first
  token. `targetRange` spans **only** that partial identifier (an empty range at
  the caret when nothing is typed yet) — never the brace or a preceding operator,
  because the caller replaces it with the chosen title.
- **`VariableMenu.tsx`** (`EventContent/Tools/`) — mirrors `CommandMenu`: a
  `Portal`, positioned from `ReactEditor.toDOMRange(target)`, filtered by substring
  on `variable.title`, single "Variables" section, each row showing the title and a
  dimmed type. It emits the **title** on select/click. Empty-state copy
  distinguishes "No variables yet…" from "No matches…".
- **`EventContent/index.tsx`** wires a parallel `variableMenuProps` /
  `totalVariableMenuItems` / `selectedVariableMenuItem` triple next to the command
  menu's. `onChange` computes the two menus mutually exclusively (command menu
  wins). `processVariableMenuOperation` deletes `target` and inserts the title.
  The shared keyboard handling (`MENU_UP`/`MENU_DOWN`/`TAB`/`ENTER`/`esc`) grew an
  `else if` branch for the variable menu, and the `onKeyDown` guard that lets those
  keys fall through to prose now also checks the variable menu is closed.
- **`useVariables(studioId, event.worldId)`** feeds the list, sorted by title.

## Notes and edges

- The two menus can never both match at one caret (`/` vs. an unclosed `{`), but
  `onChange` keeps them exclusive anyway.
- Inserting a title leaves the caret inside the braces (`{ health| }`); `Tab` still
  jumps out of the expression via the existing `HOTKEY_EXPRESSION.EXIT` path.
- The picker does not try to parse the expression — inside `{ }` you are always
  referencing variables, so surfacing the list on any token (even an empty filter)
  is the intended affordance. `Escape` dismisses it.

## Tests

`src/__tests__/variableMenu.test.ts` pins `showVariableMenu`: it stays shut in
prose and after a closed expression, opens inside an unclosed one, captures the
partial name (including the second-operand case), and targets exactly the partial
identifier (an empty range when nothing is typed). It builds a plain Slate
`createEditor()` and sets `children`/selection directly — `showVariableMenu`
touches only the Slate model, no DOM.
