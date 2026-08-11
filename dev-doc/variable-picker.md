# The `{ }` expression picker and helper

Two menus that make a template expression writable by pointing rather than typing:
a **variable picker** that offers the world's variables, and a type-aware
**expression helper** that recommends how to continue once an operand is placed.
Together they close the follow-up tracked in `dev-doc/scene-triggers.md`. Both are
modelled on the `/` command menu, mirrored rather than generalised — each inserts
differently (a node vs. plain text vs. an operator/skeleton), so a shared surface
would have cost more than three parallel ones.

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
- **`Ctrl+Space`** (`HOTKEY_EXPRESSION.OPEN_EXPRESSION_MENU`), IDE-style. Context
  decides which menu opens: outside an expression it inserts `{  }` (and `onChange`
  opens the picker); inside, it opens the **picker** at an operand position and the
  **helper** just after an operand. No edit happens when it is already inside, so
  `onChange` would not fire — the handler sets the menu props itself. Matched on
  `event.ctrlKey && event.code === 'Space'`; see `dev-doc/keyboard.md`.

## Operand vs. continuation — the routing rule

The split that makes `Ctrl+Space` do the right thing lives in
`src/lib/contentEditor/expressionHelper.ts` (pure, tested):
`classifyExpressionContext` reads the text inside the innermost unclosed `{` up to
the caret and answers **operand** (empty, or ending in an operator / `(` / `,` /
`?` / `:` — a variable or literal is wanted next → the picker) or **continuation**
(ending in a complete identifier / number / string / `)` — the author is choosing
how to continue → the helper). The variable picker's *auto* trigger
(`showVariableMenu`, on every `onChange`) is unchanged and still fires on a
trailing partial identifier, so typing a name keeps filtering the list; the
classifier only governs what `Ctrl+Space` opens.

## The expression helper

`getExpressionSuggestions(type, isVariable)` builds a short menu tailored to the
operand the caret sits after (`inferContinuationOperand` reads its type — a known
variable by lookup, a number/string by its literal, otherwise unknown):

- **BOOLEAN** → just the **condition** skeleton ` ? "" : ""` (caret dropped inside
  the first `""`). This is the standout item — the thing that is a pain to type
  correctly.
- **NUMBER** → arithmetic `+ - * / %`, ordered comparisons `> >= < <=`, equality
  `== !=`, and the condition. Each operator inserts ` OP ` and leaves the caret
  after it (the picker then auto-opens for the right operand).
- **STRING / URL / IMAGE** → the `gameMethods` (`.upper()`, `.lower()`) when the
  operand is a bare variable, `+` (join), equality, and the condition. No ordered
  comparisons — the evaluator only compares NUMBERs with `>`/`<`.
- **unknown** (e.g. after a `)`) → the full set minus methods.

**Sources of truth are imported, not copied**: methods from `gameMethods`,
arithmetic from `SUPPORTED_BINARY_OPERATORS`. Only the comparison/equality
operators are named locally, because they are meaningful to the evaluator *only*
inside a conditional and so have no standalone list. `ExpressionHelperMenu.tsx`
renders it (no text filter — it is a short fixed set), emitting the chosen
`ExpressionSuggestion`; `processHelperMenuOperation` inserts its snippet and, for
the condition, moves the caret back into the first `""`.

It is **guidance, not validation** — nothing stops an author writing cross-type
nonsense that renders an ERROR span. But every snippet it *offers* is a form the
evaluator accepts (see Tests).

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
- **`getTextToCaret(editor)`** in `contentEditor/index.ts` — the leaf text from its
  start to the caret, shared by `showVariableMenu` and the helper's classifier so
  the two read the same string.
- **`EventContent/index.tsx`** wires **three** parallel menu-state triples — the
  command menu's, the variable menu's (`variableMenuProps` /
  `totalVariableMenuItems` / `selectedVariableMenuItem`) and the helper's
  (`helperMenuProps` / `helperSuggestions` / `totalHelperMenuItems` /
  `selectedHelperMenuItem`). Only one is ever shown: `onChange` keeps them
  exclusive (command wins; an open helper survives while the caret stays in a
  continuation spot; otherwise the picker follows the caret). The shared keyboard
  handling (`MENU_UP`/`MENU_DOWN`/`TAB`/`ENTER`/`esc`) grew an `else if` branch per
  menu, and the `onKeyDown` fall-through guard now checks all three are closed.
  `resolveVariableType` (a `useCallback` over `variables`) turns an identifier into
  its declared type for the helper.
- **`useVariables(studioId, event.worldId)`** feeds the list, sorted by title.

## Notes and edges

- The three menus are mutually exclusive by construction; `onChange` enforces it.
- Inserting a title leaves the caret inside the braces (`{ health| }`); `Tab` still
  jumps out of the expression via the existing `HOTKEY_EXPRESSION.EXIT` path.
- The picker does not try to parse the expression — inside `{ }` you are always
  referencing variables, so surfacing the list on any token (even an empty filter)
  is the intended affordance. `Escape` dismisses whichever menu is open, one layer
  before distraction-free mode and the editor.
- A typical build flow: `{` → pick `health` → `Ctrl+Space` → `>` (picker auto-opens
  for the right operand) → pick/type `threshold` → `Ctrl+Space` → **Condition** →
  fill the two branches. Each step is a legal fragment.

## Tests

- `src/__tests__/variableMenu.test.ts` pins `showVariableMenu`: shut in prose and
  after a closed expression, open inside an unclosed one, capturing the partial
  name (including the second-operand case) and targeting exactly that partial
  identifier (an empty range when nothing is typed). It builds a plain Slate
  `createEditor()` and sets `children`/selection directly — `showVariableMenu`
  touches only the Slate model, no DOM.
- `src/__tests__/expressionHelper.test.ts` pins the helper's pure module: the
  caret classifier, the operand-type inference, and the catalogue per type. Its
  load-bearing block iterates the **actual** suggestions for NUMBER/STRING/BOOLEAN,
  composes each into a complete expression, and runs it through the real
  `lib/templates.ts` pipeline — so the catalogue cannot drift into offering a form
  the parser rejects (the same discipline as `variableHelpExamples.test.ts`).
