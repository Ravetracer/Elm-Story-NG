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

## Related: starter content no longer ships a sample story

`src/lib/saveStarterContent.ts` used to seed a "Getting Started" world whose prose
and structure were authored by Elm Story Games LLC. That content is the original
authors' copyright and has been removed — a new storyworld now starts as a blank
one-scene / one-event canvas. The demo replaces it as the product's worked example.
