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

---

## 1. No schema change — safe to start any time

Immediate value, no migration, and it buys thinking time for the design pass
below. The asset manager comes first because objects will mint a lot of images.

- [ ] Asset manager
- [ ] Variable manager
- [ ] Content Editor: distraction-free mode
- [ ] Scene Map: node and path cut, copy, paste and duplicate
      *(the work is id remapping — a pasted subtree needs fresh ids and its paths
      rewritten to point at them; worth unit testing the remapper)*
- [ ] Scene Map: auto layout
- [ ] Storyworld Map: navigable map of the entire world
- [ ] Fix the `=/=` inequality operator the archived docs promise but which has
      never parsed, and document the working `.upper()` / `.lower()` calls

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
out of the box. The archived pages in `Docs/` are mostly literal "WIP" stubs, so
most content is written fresh rather than ported.

- [ ] Static documentation site
- [ ] A proper expressions page, including arithmetic and the `=/=` correction

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

## Note on containers, and why conditional placement is better

Objects inside objects — a battery in a locked drawer — is tempting but expensive:
a recursive data model, a recursive UI, and a new "locked" concept. Gating an
object's placement on a condition costs one field and reuses the existing
`Condition` model.

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
