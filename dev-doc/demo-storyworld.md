# The built-in demo storyworld

*The Jade Idol of K'aal* is a small, complete adventure that exercises every core
mechanic once. It ships two ways: as a **one-click demo** an author can load from
the dashboard, and as the worked example the documentation site's illustrated
walkthrough (`/walkthrough`) is built around. The two are the same world — every
screenshot on the walkthrough page is reproducible click-for-click from the button.

## What it covers

Branching with loop-backs · character masks and dialog (persona) · inline choices
and list choices · variables · path conditions, effects and notifications · objects
and the inventory · gated object placements · a combine recipe · take-effects ·
template expressions in prose · an object-presence path gate · a win and a lose
ending.

Seven scenes: the Classroom (the call), Finch's Study (research), the Market
(supplies + the guide), the Temple Entrance (light the torch), the Labyrinth
(branching + a losing ending), the Idol Chamber (take the idol), the Museum (win).

## The seeder — `src/lib/demo/saveDemoContent.ts`

Builds the whole world directly through the `api` layer, the same shape as
`saveStarterContent`. Every element id is generated up front, so choices, paths,
conditions, effects and object conditions can all reference one another. Notable
data choices, each load-bearing:

- **`World.jump` is null.** The engine's `findStartingDestinationLiveEvent` falls
  back to the first scene's first EVENT child, so the Classroom's first event is the
  start. No opening Jump element is needed.
- **Cross-scene transitions are JUMP elements**, one per origin scene, targeted by a
  choice's path (`destinationType: JUMP`). A `Path` only ever joins events *within*
  one scene.
- **The combine**: `Torch + Flint & Steel → Lit Torch`, both consumed, output to the
  inventory, with a recipe `effects` entry setting `torchLit`. Both inputs are
  `combineable: true` or the "Combine with…" verb never appears. The Lit Torch is
  `takeable: true` because a recipe output to the inventory is treated as a take.
- **The labyrinth gate is an object condition**, not a variable: the "Step into the
  labyrinth" path carries an `ObjectCondition` (`Lit Torch`, INVENTORY, `>= 1`).
  Object conditions fail *closed* when unevaluable, which is exactly what keeps the
  path shut until the torch is lit.
- **The flint is a gated placement**: present in the Market only while
  `metGuide == true`, which talking to Itzel sets.
- **Wrong turns branch on state**: one choice carries two paths, gated
  `torchFuel > 1` (loop back, −1) and `torchFuel <= 1` (→ the losing ending, −1). The
  engine takes whichever is open.
- **Personas** set `Event.persona = [characterId, MASK, undefined]` and each speaking
  character has a mask of that type carrying an `assetId`. The default NEUTRAL mask
  has no image, so a non-neutral mood mask holds the portrait.
- **`funds` is the world's currency** (`World.currencyVariableId = vFunds`, label
  "Dollars"), so it shows below the inventory with a coin and moves as the grant is
  taken (+300) and supplies are bought (−100). This is only a designation over the
  existing NUMBER variable — see `dev-doc/currency.md`.

## No gated choice is ever a silent dead end

The first cut of this world gated three choices and put nothing behind them, which
read as broken rather than as locked: the departure from the market simply did
nothing, and entering the temple unlit produced the engine's bare
**"Unable to return. Missing path."** Every gate now comes in a pair — the open path,
and a fallback carrying the *inverse* conditions that leads somewhere explaining
what is missing and offering the way back:

| choice | open when | otherwise |
| --- | --- | --- |
| Set out for the temple | ALL: `clues>=2`, `hasMap`, `hasTorch`, `hasFlint` | ANY of those unmet → **Not Yet Ready**, a live checklist |
| Step into the labyrinth | object condition: Lit Torch in inventory | `torchLit == false` → **Not Without Light** |

The fallback uses `PATH_CONDITIONS_TYPE.ANY` over the negated conditions, which is
how "not (a and b and c)" is expressed with the condition model as it stands.

**The checklist is why the market gate reads variables rather than object
conditions.** A template expression can only see variables, so the torch, flint and
map each set a boolean through `takeEffects` (`hasTorch`, `hasFlint`, `hasMap`) and
*Not Yet Ready* prints `{ hasTorch ? … : … }` per line. The lit-torch gate stays an
object condition so the world still demonstrates one.

Two more rules the same pass established:

- **Ask-once conversations close themselves.** Talking to Itzel, asking Finch and
  buying supplies each set a boolean and carry the matching `== false` condition, so
  the choice disappears once used instead of repeating with no effect. Finch's answer
  is a real event (`What Finch Knows`) rather than a loop back onto his opening line.
- **A `Choice` belongs to exactly one event.** `EventChoices` looks choices up with
  `.where({ eventId })`, so an option offered from two events needs **one row per
  event**. Reusing a single choice id across two events makes it render on the owner
  and silently vanish on the other — which is what happened to "Return to the
  market" on the unlit-entry event.

## Getting back to what you skipped

Scene transitions used to be one-way, so a player who left Finch's study without the
codex could never satisfy the departure gate. Two jumps exist purely to undo that:
`jBackToStudy` (market → study) and `jBackToMarket` (temple entrance → market, also
offered from *Not Without Light*). Anything the world requires must stay reachable
from wherever the requirement is discovered.

## The art — `src/lib/demo/media.ts` (generated)

Three character portraits and five object icons are **base64-embedded** in
`media.ts` so the seeder needs no filesystem or network access in either the
Electron or browser build. The source art lives beside it under `media/`;
regenerate `media.ts` by reading those files and emitting one `data:<mime>;base64,`
string per key (portraits are JPEG-stored as character masks, object icons stored as
object images).

Assets are written through the normal `SAVE_ASSET` IPC to
`userData/assets/<studio>/<world>/<id>.<ext>` — character masks under `.jpeg`, object
images under `.webp`. The bytes are stored as imported (a JPEG under a `.webp` name,
say); every read site loads assets through an `<img>`/`background-image`, which
sniffs the content, so the picture renders while the extension stays the one the
read site asks for. This sidesteps the DOM/canvas re-encode path entirely.

## The dashboard button — `src/routes/Dashboard/index.tsx`

"New here? Load the demo storyworld" builds the world on demand into a dedicated
**"Elm Story - NG Demos"** studio, reused across clicks, and selects it. Nothing is
created until the button is pressed, so an author's own libraries are never touched.

## Updating an installed demo

The dashboard button is context-aware. With no demo present it reads **"New here?
Load the demo storyworld"** and seeds one. Once a demo world exists in the demo
studio it reads **"Update the demo storyworld"** and, on click, confirms first —
updating removes the installed demo world(s) and re-seeds the current bundled
version, so any changes an author made to the demo are overwritten (their own
storyworlds are untouched). This is how a player who installed an older demo picks
up later fixes (e.g. the mask's equip slot moving from the removed FACE to HEAD)
without hunting for the change by hand. The removals are sequential, not
`Promise.all`, because each rewrites the studio's shared `worlds` array. Detection
is a live query on the demo studio's `worlds` table, so the label flips the moment a
demo is added or removed.

## Related: starter content no longer ships a sample story

`src/lib/saveStarterContent.ts` used to seed a "Getting Started" world whose prose
and structure were authored by Elm Story Games LLC. That content is the original
authors' copyright and has been removed — a new storyworld now starts as a blank
one-scene / one-event canvas. The demo replaces it as the product's worked example.
