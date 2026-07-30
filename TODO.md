# Feature TODO

Ordered to keep the expensive, hard-to-reverse work rare rather than to do the
most-wanted thing first. The world object and inventory system is still the
headline; it is just preceded by a design pass and a single migration so it is not
paid for three times.

`ROADMAP.md` holds the per-item grounding — what already exists and what each item
touches. Its *ordering* is superseded by this file.

**Two persisted stores, two migration chains.** The editor's library lives in
`src/db/v*.ts` (currently through v10) and the engine's runtime state in
`engine/src/lib/db/v*.ts` (v6 through v10). Anything stored on a live event, which
includes inventory state, needs an engine migration as well as an editor one.
Every schema change therefore costs: a new transport schema, an
`importWorldData` branch, an export path change, and up to two migrations.

**One class of field is much cheaper than that**, established by adding
`Variable.description`: an optional, unindexed, editor-only field needs no
migration at all. Dexie declares indexes rather than shapes, so an unindexed
property is simply stored; an optional property added to the existing transport
schema leaves older files valid, so no `importWorldData` branch is needed either;
and a field the engine does not read at runtime needs nothing from the engine
chain. All it costs is the export path and one optional property in
`transport/types/0.7.0.ts` and `schema/0.7.0.json` — the latter is mandatory,
because `additionalProperties: false` there turns an unnamed exported field into a
file the app refuses to import. Judge each field below against that before
assuming it has to wait for the batch: a field the **engine** must read, or one
that needs an index, is the expensive kind.

---

## 1. No schema change — safe to start any time

Immediate value, no migration, and it buys thinking time for the design pass
below. The asset manager comes first because objects will mint a lot of images.

- [x] Asset manager
- [x] Variable manager
- [x] UI size picker in the title bar, and the sub-12px type in the authoring
      panels lifted to 12 and 13 — see `CLAUDE.md`, "UI scale". Requested rather
      than roadmapped: the panels needed reading glasses.
- [x] Content Editor: distraction-free mode — see `CLAUDE.md`,
      "Distraction-free mode"
- [x] Scene Map: node and path cut, copy, paste and duplicate — see `CLAUDE.md`,
      "The scene map clipboard". The remapper is `lib/sceneMapClipboard.ts`, pure
      and covered by `src/__tests__/sceneMapClipboard.test.ts`.
- [ ] Scene Map: auto layout
- [ ] Storyworld Map: navigable map of the entire world
- [x] Improve editor performance, if possible. It's currently laggy sometimes when moving around
      a scene
      *(Done for the scene map: the per-gesture stall is gone — zoom p95 60–65ms → 10ms and no
      long tasks, measured. See "Why the scene map stalled while you moved it" at the end of this
      file for the cause, the numbers, two candidates that were ruled out, and what is still open.)*
- [x] Assets: enable asset selection when changing images instead of open the file dialogue.
      Same applies to music. Let manage all assets via the asset manager. It has to be possible
      to upload assets in the asset manager which can be assigned later in all possible locations.
      *(See `CLAUDE.md`, "The asset manager". All four assignment sites offer Choose beside
      Import, the manager imports per kind through the same crop pipelines the slots use, and
      replacing an asset no longer deletes the old file — which it did, unconditionally, in
      three places where two elements may share one id.)*
- [x] ~~Fix the `=/=` inequality operator the archived docs promise but which has
      never parsed~~, and document the working `.upper()` / `.lower()` calls
      *(`=/=` is **dropped, not built**: `!=` already means "not equal", is what the
      parser accepts and is what `COMPARE_OPERATOR_TYPE.NE` uses for conditions, so
      `=/=` would only have been a second spelling of an operator the language has —
      bought by pre-translating expressions before parsing, to keep a promise made
      by a docs site that no longer resolves. The method calls were already
      documented in `VariableManager/VariableHelp.tsx`, which is the reference now
      and says `=/=` is not an operator; `variableHelpExamples.test.ts` holds it to
      that.)*

## 2. Design pass — no code

Settle the shape of **everything** that will ever need a new persisted field, so
the migrations below happen once. Then author three scenarios on paper before
writing any of it: the flashlight, a pile of coins, and a key used repeatedly
without being consumed.

- [ ] Object definitions: name, description shown when inspected, optional image,
      takeable or static, combineable
- [ ] Quantity model — see the note below; this is the one decision that most
      changes the amount of code
- [ ] Scene placement: which scenes an object starts in, and an optional condition
      gating whether it is there at all — see the note on containers below
- [ ] Recipes: inputs each flagged consumed or retained, outputs each destined for
      the inventory or the current scene
- [ ] Whether a recipe can also set a variable. Not required if conditions can
      read object presence, but convenient.
- [ ] What the storyteller says when two objects have no matching recipe. Silence
      reads as broken; a default message, overridable per object, reads as
      deliberate.
- [ ] Inventory state on live events, so rewind, save and load stay correct
- [ ] Conditions on inventory and scene contents: "player has X",
      "scene contains X"
- [ ] Storyworld cover image field
- [ ] Character relationship data
- [ ] Variable scope field
- [ ] Check whether choice modals, storyworld notifications or inline choices need
      a persisted field. If any do, fold them in here so they ride the same
      migration rather than earning their own.

## 3. The migrations — once per chain

Ship the fields before anything uses them. Adding them unused now is far cheaper
than a second migration later; the cost is that the shape has to be right, which
is what section 2 is for.

- [ ] Transport schema `0.8.0`, plus the `importWorldData` branch and the export
      path
- [ ] Editor migration `src/db/v11.ts`
- [ ] Engine migration `engine/src/lib/db/v11.ts` for inventory state

## 4. World objects and inventory

The headline feature. Everything it persists was migrated in section 3, so this
is application code only.

- [ ] World objects
  - [ ] placed on a scene, static or takeable
  - [ ] has a name
  - [ ] has an optional dedicated image
  - [ ] has a description shown when inspected
  - [ ] combineable with other objects, with no limit on how many
- [ ] Combination by recipe
  - [ ] each input is consumed or retained
  - [ ] each output goes to the inventory or to the current scene
  - [ ] decomposition is just a recipe pointing the other way — opening the
        charged flashlight is one input consumed, two outputs
  - [ ] editor: show an object's recipes from either side of the relationship
  - [ ] EXAMPLE: battery + flashlight → charged flashlight, both inputs consumed,
        output to inventory. Opening it: charged flashlight consumed, empty
        flashlight and battery out. The battery is then reusable elsewhere.
- [ ] Character inventory
  - [ ] holds takeable objects from anywhere in the world
  - [ ] objects combine inside the inventory
  - [ ] objects combine with static objects in the current scene
  - [ ] panel beside the event stream, centre of the storyteller, filling as the
        world is played
- [ ] Inventory conditions
  - [ ] paths gated on holding an object, so a charged flashlight can open a dark
        corridor. Without this, objects are scenery: `Condition.compare` tests
        variables only today.

## 4.5 User contributed ideas

Some ideas the developer had between the tasks are land here.

- [ ] Template database: It should be possible to save scenes or events as templates which then can be used
      in other scenes or even other studios and worlds.
      The uses assets should be saved along the template to have a starting point. 
      This is nice if there's a story part which can be reused over and over.

## 5. Save and load

Deliberately after section 4, so the state snapshot already includes objects.
Doing it earlier means building it twice. `EngineBookmarkData` already carries
`id`, `title` and `liveEventId`, and a live event already carries a full state
snapshot, so most of this is UI.

- [ ] Multiple storyworld bookmarks
- [ ] Loading and saving a game state

## 6. Features whose fields section 3 already migrated

- [ ] Character relationship mapping
      *(same shape as object recipes — a graph between entities. Build that
      editing pattern once in section 4, use it again here.)*
- [ ] Storyworld cover image
- [ ] Scoped variables

## 7. Presentation

Depends on nothing above and benefits from there being more to present.

- [ ] Transitions
- [ ] Custom backgrounds and colors
- [ ] Animated images
- [ ] Choice modals
- [ ] Storyworld notifications
- [ ] Inline choices
      *(no migration if an inline choice references an existing Choice element;
      one if it replaces it. Decide in section 2.)*

## 8. Documentation site

After the object system, so there is something new to document. The original was
Docusaurus; VitePress or Astro Starlight fit this Vite-based repo and look better
out of the box.

The source material is the original docs.elmstory.com recovered from archive.org,
kept locally in `Docs/` and **deliberately git-ignored** — reference to mine, not
content to publish. Do not expect much from it: most pages are literal "WIP"
stubs, `expressions.html` documents a `=/=` operator that has never parsed, and it
omits the method calls that do work. Assume the new site is written fresh and
verified against the code rather than ported.

**Every `ElementHelpButton` in the app opens that dead domain**, which is worth
fixing regardless of whether a site is ever built: a `?` that does nothing visible
is worse than no `?`. The variables one is already done — it opens the in-app sheet
in `VariableManager/VariableHelp.tsx`, written against `lib/templates.ts` and held
to it by `src/__tests__/variableHelpExamples.test.ts`. That sheet is also most of
the expressions page below, so a site can lift it rather than start over.

- [ ] Replace the remaining `ElementHelpButton` links with in-app help, or drop
      the buttons. Element types still pointing at the dead domain: character,
      choice, condition, effect, event, folder, input, jump, path, scene and the
      world root, plus the JSON and PWA export entries in `ExportWorldMenu`.
- [ ] Static documentation site
- [ ] A proper expressions page, including arithmetic, the method calls, and a
      correction that `!=` is the inequality operator and `=/=` never was one

## 9. Inherited code TODOs

**104 `TODO` comments across 51 files** left by the original authors, 95 in the
editor and 9 in `engine/src`. None are FIXME/HACK/XXX tags; the word "hack"
appears only inside TODO text. Nothing added since the revival is in here —
`git diff` confirms the working tree adds no new markers — so this is entirely
the 2022 authors' backlog, collected because it is otherwise invisible: they are
scattered comments, not a list, and several are the *only* record of a known
defect.

Collected here rather than promoted into the sections above because most are
maintenance, not features. **This section is an index, not a work plan** — the
grouping is what makes it usable, and the counts are what make it honest.
Regenerate it with:

```bash
grep -rnE 'TODO|FIXME|HACK|XXX' --include='*.ts' --include='*.tsx' --include='*.less' \
  src engine/src | grep -v '^src/components/Storyteller/embedded/'
```

### 9.1 Do not act on these

- **`// TODO: may need to change to tuple with id and type`** appears five times:
  `transport/types/0.5.0.ts:342`, `0.5.1.ts:357`, `0.6.0.ts:478`,
  `0.7.0.ts:526` and `engine/src/types/index.ts:522`. The first three describe
  **JSON already on disk** and must stay wrong-looking forever — see `CLAUDE.md`,
  "The import upgrade chain". Only the last two are live shapes, and changing
  either is a transport schema plus up to two migrations, so it belongs in
  section 2/3 if it is ever wanted at all.
- **`api/studios.ts:24` and `:35`** ("Link studios to cloud accounts", "How does
  this affect cloud accounts?") are dead by decision — the cloud platform is
  under "Not included" below. Worth deleting rather than carrying.
- **`transport/types/0.6.0.ts:327` and `0.7.0.ts:341`**
  (`// TODO: following duped from Storyteller`) are the same frozen-schema case:
  the duplication is deliberate insulation, not an oversight.

### 9.2 Correctness — the ones that can lose or corrupt data

Ranked. These are the reason this section is worth having.

- [ ] **`db/index.ts:330`, `removeCharacter`: `// TODO: consider dependencies
      e.g. passages`.** Deleting a character does *not* cascade, unlike
      `removeVariable`. A character is referenced by `Character.masks[].assetId`
      (asset manager), by `CharacterRefs`, and by character-reference nodes in
      event content — so a deletion can leave content pointing at a character
      that no longer exists. This is the same shape as the dangling-child-ref
      class documented in `CLAUDE.md` and the highest-value item in this section.
      **Partly addressed**: the mask *assets* are now trashed only when nothing
      else names them, and outside the Dexie transaction rather than inside it
      with a `Promise.all` that awaited nothing. The reference cascade — content
      nodes and `CharacterRefs` — is still open.
- [ ] **`db/index.ts:464`, `removeWorld`: `// TODO: replace 'delete' method with
      methods that handle children`.** Drops the whole Dexie database, so it
      happens to be safe today; it stops being safe the moment anything outside
      that database references a world.
- [ ] **`db/index.ts:1176`, `:1401`, `:1560` — `// TODO: #70; async issue`.**
      Three near-identical notes on `removePath` and friends: parallel removes
      that would be correct done in order. This is the same lost-update trap
      `Scene.children` already produced twice — see `CLAUDE.md`, "The scene map
      clipboard". Worth auditing every `Promise.all` over a remove, not just
      these three.
- [ ] **`db/index.ts:848`, `removeJump`: `// TODO: WHY`.** Removing a
      non-existent jump logs an error and resolves rather than throwing. Decide
      which it is; the comment is the author admitting they did not.
- [ ] **`WorldOutline/index.tsx:446`: `// TODO: Move the item back to original
      position?`** A failed drag rethrows with the tree already moved, so the UI
      and the database disagree until a rebuild.
- [ ] **`WorldOutline/index.tsx:1151`: `// TODO: updating DB could fail; cache
      name if need revert on error`.** Same class, for rename.
- [ ] **`main.ts:396`, `:427`, `:469`: `// TODO: return error to app`.** Three
      IPC handlers that swallow failures. `IMPORT_WORLD_ASSETS` doing this is
      already documented in `CLAUDE.md` as a testing hazard.
- [ ] **`Modal/ImportJSONModal.tsx:65`, `:89`, `:180`: `// TODO: handle finish
      errors`** (plus `:66`, `:90` `// TODO: ts errors`). Import is the path that
      "silently rots" — five of these sit on it.

### 9.3 Known-defect notes with issue numbers

Traceable to `elmstorygames/feedback`, which makes them the authors' own triage.

- [ ] **#45** — `SceneMap/index.tsx:730`, `:737`, `:761`: multiple jumps, events
      and choices cannot be removed from the scene map; the node cases are
      commented out and only paths are deleted. **Partly superseded**: the
      clipboard's cut path does remove several elements, sequentially and for the
      documented reason. Re-check what remains before reopening it.
- [ ] **#397** — `EventProperties/index.tsx:270`: `it might be necessary to check
      choices in the future`, on the effect that clears `event.ending`.
- [ ] **#92** — `WorldInspector/index.tsx:156`: `Fire only when tab is active`.
      Adding a variable from an inactive tab still fires.
- [ ] **#132** — `WorldOutline/index.tsx:488`: `stack hack`, a `setTimeout(…, 1)`
      to order two dispatches.
- [ ] **#422** — `engine/src/components/Installer.tsx:79`: `this is set again
      after install`; the world info dispatch is duplicated deliberately.

### 9.4 `setTimeout` ordering hacks

Six sites where a dispatch or a Slate operation is deferred a tick to escape a
render-order problem. They are fragile in the way that only shows up under load,
and they share one root cause worth fixing once rather than six times.

`WorldOutline/index.tsx:488` and `:514` (the second guarding an infinite loop
when selecting into an unselected scene), `ElementEditor/index.tsx:217`,
`EventContent/index.tsx:468` and `:639`, plus
`ImportAndCropImage/index.tsx:137` and `CharacterPersonality.tsx:248`
(both `hack; hook into transition complete` — an antd modal animation raced
instead of awaited).

### 9.5 Performance

- [x] **`SceneMap/index.tsx`: `optimize; this is re-rendering too much`.** Fixed —
      the effect now depends on `scene?.id` rather than the whole scene. See "Why
      the scene map stalled while you moved it" at the end of this file for the
      measurements and for the second, larger cost that this one was hiding.
- [x] `SceneMap/index.tsx`: two × `cache this` in `onSelectionDragStop` — an
      `Array.find` per element inside a `Promise.all` over every dragged node.
      Now one `Map` built in a single pass. This also fixed a real bug on the
      same lines: `Promise.all` over an *array of arrays* resolves without
      awaiting the promises inside them, so those position writes were
      fire-and-forget and the function resolved before any of them landed.
- [x] `EventContent/Tools/CommandMenu.tsx`: `lazy` — not a performance item at
      all. It sat above a `@ts-ignore` inside `if (rect)`, where `rect` is already
      narrowed, so the suppression was dead and is gone.
- [ ] `SceneMap/EventNode.tsx:264`: `this is being processed all the time`.
      Measured and **overstated** — see "Still open" in the note at the end of
      this file.
- [ ] `engine/src/components/EventContent.tsx:242`: image lazy-loading, written
      and commented out.

### 9.6 Duplication the authors flagged themselves

The stylesheet half is mechanical: six `// TODO: combine with duplicates in other
property panels` in `EventProperties/styles.module.less:3`, `:66`, `:89`,
`SceneProperties/styles.module.less:2`, `JumpProperties/styles.module.less:2` and
`EventTypeSelect/styles.module.less:2`, plus `combine with JumpSelect` at
`EventProperties/styles.module.less:28`. One shared partial retires all seven.

The rest, in rough order of what it would buy:

- [ ] **`engine/src/lib/templates.ts:1`: `move to own package`.** The authors'
      own answer to the duplication `CLAUDE.md` warns about under "Template
      expressions": `templates.ts` exists twice and a fix applied to one file
      makes node previews and the storyteller disagree. Sharing it — a package, a
      generated copy, or an import like the two modules that already reach into
      `engine/src` — is the fix, and it is the highest-value item in this group.
- [ ] `lib/contentEditor/index.ts:146` (`dupe code (isAlignActive)`), `:518`
      (`dupe code; breakout filtering`), and `:299`–`:300`
      (`this should return true with / is types`, `reuse match code for other
      symbols like @ and #` — the trigger-character machinery is hardcoded to
      `/`)
- [x] `lib/characters.ts:79`, `:90`: `abstract and move to index` — done. The
      duplicate `createImage`/`getCroppedImageData` are gone; the character mask
      path calls the parameterised pair in `lib/index.ts`, and each slot's
      dimensions and format now live in `ASSET_KINDS` in `lib/assets.ts`.
- [ ] `engine/src/components/LiveEventStream.tsx:110`: `duplicate from API`
- [ ] `WorldLibrary/index.tsx:48`: `dupe from dashboard`
- [ ] `JumpTo/index.tsx:75` (`abstract`), `CharacterInfo.tsx:125` (`breakout`),
      `EventContent/index.tsx:689` (`combine`), `WorldInspector/index.tsx:77`
      (`change to lib method`), `engine/src/components/Event.tsx:48`
      (`move to event`), `lib/saveStarterContent.ts:50`
      (`Move to defines/types` — a hardcoded `'0.0.1'`)

### 9.7 Types

- [ ] `WorldOutline/index.tsx:43`: `build type for item.data` — the outline's tree
      items are untyped, in the file the authors also labelled
      `this is a fucking nightmare lol` (`:161`) and `Can't we do this better?
      *hic*` (`:1242`)
- [ ] `WorldOutline/index.tsx:1495`: `list for checking supported types`, an
      inline `!== ELEMENT_TYPE.CHARACTER`
- [ ] `lib/compiler/format.ts:40`: `fix types`
- [ ] `data/types.ts:192`: `add variable ID` on `Character` — a schema change, so
      section 2/3 if it is ever wanted
- [ ] `SceneMap/index.tsx:1262`: a bare `// TODO` on a node's `data`

### 9.8 Open questions the authors never answered

Cheap to resolve, and each one currently costs a reader time.

- [ ] **`ElementPropertiesView.tsx:58`: `is this dead code?`** Not settled here:
      the outline's own `onSelect` redirects EVENT and JUMP to the parent scene,
      which suggests yes, but `WORLD_OUTLINE_SELECT` is dispatched from 23 sites
      and any one could pass an EVENT. Answer it by logging the reducer, not by
      reading.
- [ ] `SceneProperties/index.tsx:89`: `Is this necessary?` on a dispatch after a
      scene rename
- [ ] `WorldOutline/index.tsx:1286`, `:1336`: `sets tree data twice`
- [ ] `hooks/useVariables.ts`, `useScenes.ts`, `useEvents.ts`, `useFolders.ts`,
      lines 17–18 and 25–26 — the same pair of questions four times: *sort by how
      the user ordered them, or don't sort and let the editor track order?*
      Answer it once. Everything the outline shows is ordered by these hooks.
- [ ] `WorldVariables/index.tsx:171`: `consider preserving the operator in certain
      cases` when a variable is retyped (#314). Now a variable-manager question —
      see `CLAUDE.md`, "The variable manager".
- [ ] `EventContent/index.tsx:583`: `should hide command menu and toolbar
      first...` on Escape. **Answered by distraction-free mode**, which made
      Escape step out one layer at a time; verify and delete the comment.
- [ ] `EventContent/index.tsx:641`, `contentEditor/plugins.ts:239`,
      `ImageElementSelect.tsx:137` (`this doesn't work properly with the cache`),
      `engine/src/components/EventContent.tsx:242`: four blocks of commented-out
      code kept for reference. Either revive or delete — they read as live code
      when grepping.
- [ ] `CharacterElementSelect.tsx:547` and `:1077`: two behaviours left
      deliberately unbuilt pending demand (`unless this gets requested enough`,
      `only if designers decide they want ES to make this choice`). Product
      decisions, not defects.
- [ ] `AudioProfile/Metadata.tsx:107`: mp3 metadata parsed even when the info box
      is collapsed
- [ ] `AlignDropdown.tsx:39`: `handle elements at the end that don't support
      alignment`
- [ ] `lib/serialization.ts:50`: `show missing pic if doesn't exist` — a missing
      asset renders as nothing in a node preview
- [ ] `SceneMap/index.tsx:480`: `Support multiple selected jump and passages?`
- [ ] `saveStarterContent.ts:46`: `Enable user-defined once more templates are
      supported` — the starter world is hardcoded to `ADVENTURE`. Related to the
      template database in section 4.5.
- [ ] `CharacterInfo.tsx:348`: `dominate mask`
- [ ] `TitleBar/index.tsx:120`: not a task — it documents why `isFirstRun` exists
      (preventing a full-screen toggle on a development reload). Keep, reword.
- [ ] `engine/src/components/LiveEvent.tsx:129` (`handles input loopback`),
      `Event.tsx:49` (`only used with EventInput?`),
      `LiveEventStream.tsx:207` (`get specific jump based on type or title`) —
      three engine notes on the live event stream

---

## Note on quantity, and why instances may not be needed

Both worked examples — two batteries becoming a pile, coins accumulating with a
count — are *quantities of the same thing*, not objects with individual histories.
And divergent state is already handled by swapping definitions: a charged
flashlight is a different object from an empty one, not the same object in a
different mood.

So the only thing an "instance" would carry is its location, and two batteries are
interchangeable. That makes this enough:

- an **object definition** — name, description, image, takeable, combineable, plus
  an optional stacked name and image so five coins can read as "a pile of coins"
- a **quantity per location** — how many of that definition are in each scene, and
  how many in the inventory

Coins increment. Batteries sit at two and display as a pile. The flashlight swaps
definitions. No instance ids to allocate, and the live-event snapshot stays a
small map of definition to count, which keeps rewind and save/load trivially
correct.

A charged battery and an empty one are two definitions, not one battery in two
states. That is why you can hold three charged and two empty as two stacks with
two counts, and why using the wrong one in the flashlight does nothing unless a
recipe says otherwise — recipes are keyed to specific definitions, so behaviour is
authored rather than simulated. The cost is authoring effort: several battery
states across several devices means several recipes, which is what makes filtering
in the recipe editor worth building properly.

**No timing, and not only for simplicity.** The engine stores a complete state
snapshot on every live event, which is what keeps rewind and save/load correct.
Anything time-based would need a clock the engine does not have and would desync
from those snapshots. Depletion would also mean two batteries of one definition
holding different charge, which is exactly what forces true instances. Keeping the
model monotonic — objects change only by explicit player action — avoids both.

True instances are only needed if two objects of the same definition must hold
*different* mutable state. Nothing in the spec asks for that. If it ever does,
that is the moment to add instances — and it would be a third migration, so it is
worth being sure.

## Decided: conditional placement, not recursive containers

Objects inside objects — a battery in a locked drawer — is tempting but expensive:
a recursive data model, a recursive UI, and a new "locked" concept. Gating an
object's placement on a condition costs one field and reuses the existing
`Condition` model. **Containers are not being built.**

The drawer works completely without containers:

- the drawer is a static object in the scene, with its own description
- `Key + Drawer → Unlocked Drawer`, with the key retained or consumed as authored
- the battery's placement condition is "scene contains Unlocked Drawer"
- until then the battery is not in the world at all, rather than visible and
  refused

This needs conditions that can read scene contents, which section 4 already
requires for gating a path on a held object. Same mechanism, used twice.

It also generalises well past drawers: objects that appear after an event, only on
a second visit, or only after a conversation. Containers model containers;
conditional placement models revelation, which is the actual goal.

## Not included

- **REST API** and the **cloud app services** from the original GA milestone. Both
  existed to serve a commercial platform that no longer exists.
- **Object variable type.** Dropped. It was ambiguous next to world objects, and
  making variable values structured would destabilise the expression, condition
  and effect code, all of which assume values are strings.
- **Storyworld reverse/rewind.** Not listed, but close to free once inventory is
  in the live-event snapshot: `EngineLiveEventData` already carries `prev`, `next`
  and a full state snapshot per event. Worth reconsidering alongside section 5.
- **Connected storyworlds.** The networked half was part of the dropped cloud
  platform. The local half — jumping between two worlds in one library — remains
  feasible if it is ever wanted.

## Why the scene map stalled while you moved it

**Fixed.** Kept in full because the diagnosis took longer than the fix, because
two of the ranked candidates turned out to be wrong, and because the remaining
work below starts here.

**It was never a frame-rate problem, it was one stall per gesture.** Measured by
sampling `requestAnimationFrame` intervals and `PerformanceObserver` long tasks
inside the page while driving real mouse input through the DevTools protocol, on
the largest scene in the imported test world (*Fr. Wittgenstein*: 27 nodes,
27 edges; the world has 14 scenes, 74 events, 113 paths). Panning was smooth and
hitched once when the gesture ended. Stepped zooming stalled ~60ms on nearly every
tick, which is what read as lag.

`scripts/devtools/scenemap-perf.mjs` is that measurement, kept so it can be
repeated. It reports frame quality **and** counts the editor's own graph rebuilds
from its log output, which is the part a frame counter cannot see.

### The cause

The viewport was persisted *while* the author moved, and the editor's own live
query reacted to that write by rebuilding the scene graph. Four effects fired
exactly once per zoom tick:

1. `onMoveEnd` dispatched `SCENE_MAP_SELECT_CENTER` and called
   `saveSceneViewTransform` — an IndexedDB write per gesture.
2. That write invalidated the `scenes` live query, so `useScene` returned a new
   `scene` object.
3. The elements effect listed `scene` in its dependencies, so it rebuilt all 27
   nodes and 27 edges. This was the line marked
   `// TODO: optimize; this is re-rendering too much`.
4. `setElements` gave every node a new identity, so `memo()` on `EventNode` could
   not hold and all of them re-rendered; `highlightElements` then `cloneDeep`ed
   the 54-element array.

### What was changed

All in `ElementEditor/SceneMap/index.tsx`:

- [x] **The elements effect depends on `scene?.id`, not `scene`.** The only field
      it reads is the id; jumps, events and paths are their own live queries, so
      nothing there needs to watch the scene's other fields. This is the fix for
      the authors' TODO and it fixes the class, not the one case.
- [x] **The viewport write is debounced** (`VIEW_TRANSFORM_SAVE_DELAY`, 500ms),
      with the pending write flushed on unmount so closing a scene mid-debounce
      still persists where it was left.
- [x] **The viewport centre dispatch is debounced** (`CENTER_DISPATCH_DELAY`,
      250ms) — see below; this turned out to be the larger half.
- [x] **`highlightElements` no longer deep-clones.** It copies an element only
      when that element's own `className` or `data.selectedChoice` changes and
      passes everything else through by reference.

### What it bought

Controlled at 35 storyworld-outline rows, zoom, 20 wheel ticks:

| | p95 | worst | frames >32ms | long tasks | graph rebuilds |
| --- | --- | --- | --- | --- | --- |
| before | 60–65ms | 80–85ms | 153–156 | 20, totalling ~1120ms | 20 |
| dep fix + debounced write | 50ms | 60ms | 80–120 | 20, totalling ~1140ms | **0** |
| + debounced centre | **10ms** | 50–55ms | 12–48 | **none** | **0** |

**Read the middle row before trusting any single fix.** Removing the rebuild loop
took graph rebuilds from 20 per 20 ticks to zero and halved the slow frames, and
left the long-task total *unchanged*. There were two independent per-tick costs,
and fixing the documented one did not touch the larger.

### The second cost, and how it hid

`SCENE_MAP_SELECT_CENTER` fan-out. Nothing renders from
`composer.selectedSceneMapCenter` — all four readers take it inside an event
handler, to place a new element at the middle of the view — but it lives in
`ComposerContext`, which 29 components consume, so dispatching it per wheel tick
re-rendered the outline tree and the inspector 20 times per zoom.

**Its cost is proportional to how much of the outline is expanded**, which is why
it hid: measured on the fixed code, the same zoom cost ~300ms of long tasks with
five outline rows open, ~1120ms with 35 and ~2600ms with 70. An early
measurement taken with a collapsed outline made the first two fixes look like they
had solved it. Any future measurement has to state the outline state, and
`scenemap-perf.mjs` prints a `log lines` column as the proxy for this fan-out
because the dispatch itself logs nothing.

### Ruled out, with evidence

- **`onlyRenderVisibleElements` must stay `false`.** Turning it on was ranked
  third here. In react-flow-renderer 9 it **permanently drops nodes**: on this
  scene the DOM went from 27 nodes and 26 edges to 16 and 15, and the missing 11
  did not come back on zooming out or on fit-view, because a node that has never
  rendered has no measured dimensions and so never passes the visibility test.
  That is a correctness regression — an author would see a scene with events
  missing — not a trade-off. Do not re-apply it without replacing the renderer.
- **Moving the centre out of `ComposerContext`** was ranked fourth and is no
  longer needed. Debouncing the dispatch got the whole benefit for a fraction of
  the change, because no consumer renders from the value.

### Still open

- [ ] **`EventNode.tsx:264`, `// TODO: this is being processed all the time`.**
      Overstated: the effect's dependencies are `choiceId` and
      `selectedSceneMapConnectStartData?.choiceId`, both stable while idle, and it
      did not fire at all during the measured pan and zoom. The real cost is that
      every `ChoiceRow` consumes `ComposerContext` and so re-renders on any
      dispatch. Left alone deliberately; measure before touching it.
- [ ] **198 sites construct `new LibraryDatabase(studioId)`** — a fresh Dexie
      instance declaring ten migrations, per query *and* per write. Unrelated to
      this stall, but a tax on every database operation in the app. One instance
      per studio would remove it. Note the obvious shortcut — caching inside the
      constructor — is not safe with a Dexie subclass; it wants a factory and 198
      call-site edits.
- [ ] The scene map still costs 12–48 frames over 32ms per zoom. Nothing in the
      remaining list explains it; react-flow 9's own transform work is the next
      suspect, and replacing that library is out of scope.

Re-measure the same way before and after, on the same scene **and the same
outline state**: numbers from the running app, not from reasoning about the render
tree.
