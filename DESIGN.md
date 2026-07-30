# Design pass: the 0.8.0 persisted shape

This is `TODO.md` section 2 — the settled shape of **every** field that will need
a new persisted slot, decided in one pass so section 3's migrations happen once.
No code is written here. Section 3 implements exactly what this file says; section
4 and later build on it without touching the schema again.

`CLAUDE.md` is the authority on how the existing model behaves. This file only
adds what is new, and records why each decision went the way it did — including
the ones that were rejected, because "why is this not a table" is the question a
reader will have.

## What a new field actually costs

Established while adding `Variable.description`, and worth restating because it
decides several choices below. **Three tiers, cheapest first:**

| tier | example | cost |
| --- | --- | --- |
| optional, unindexed, engine ignores it | `CharacterRelationship` | transport schema + export/import path. **No Dexie migration in either project.** |
| optional, unindexed, engine reads it | `Variable.scope`, `EngineLiveEventData.objects` | the above, plus `compiler/format.ts`'s pick list. **Still no migration.** |
| a new table, or a new index | `objects`, `recipes` | the above, plus a `.stores()` declaration, which means a new Dexie version in the project that declares it |

Dexie declares indexes, not shapes, so an unindexed property is simply stored.
That is why the list below is deliberately biased toward optional unindexed fields
on tables that already exist, and why only four new tables are proposed.

**`compiler/format.ts` is the trap in tier two.** It `pick`s an explicit property
list per collection, so a field the engine must read is invisible at runtime until
it is named there — `format.ts:110` picks exactly `id, initialValue, title, type`
off a variable, so `Variable.scope` reaches the engine only if it is added to that
list. The field existing in `engine/src/types` is not enough.

**Forward compatibility is not on the table and that simplifies things.**
`transport/validate` looks the file's `_.engine` up in a static map, so a build
that predates 0.8.0 rejects a 0.8.0 file outright rather than reading it partially.
Nothing below needs to degrade gracefully in an older build. It *does* need to
degrade gracefully against an older **save**, which is a different problem and is
handled per field.

---

## 1. Object definitions

A new `objects` table. `Element` already supplies `id`, `title`, `tags`,
`updated`, so `title` is the object's name.

```ts
export interface WorldObject extends Element {
  worldId: WorldId
  description: string          // shown when inspected; may be empty
  assetId?: string             // ASSET_KIND.OBJECT_IMAGE
  takeable: boolean
  combineable: boolean
  stackedTitle?: string        // "a pile of coins", used when count > 1
  stackedAssetId?: string
  noRecipeMessage?: string     // overrides the world default; see 6
  placements: ObjectPlacement[] // see 3
}
```

- **`WorldObject`, not `Object`.** Shadowing the global in a file every module
  imports is not worth the two saved characters. The table and the transport
  collection are both `objects`, matching `World`/`worlds`.
- **Object titles are display names, not identifiers.** Recipes, placements and
  conditions all reference objects by **id**, so renaming an object is safe and
  cascades nowhere. This is deliberately unlike `Variable.title`, which template
  expressions resolve by name and which therefore breaks silently on rename
  (`CLAUDE.md`, "The variable manager"). Nothing about objects should ever be
  keyed on the title.
- **`description` is plain text, not a Slate document.** `Event.content` is a
  serialized Slate document and carries the whole content editor with it — void
  image nodes, character references, the toolbar. An inspect description is a
  sentence or two. Plain text still gets template expressions for free, because
  `getProcessedTemplate(template: string, …)` (`src/lib/templates.ts:633`) takes a
  string rather than a document, so `The lamp holds { charge } charges` works with
  no new parser. Required but possibly empty, so every read site has a string to
  render.
- **`combineable` is not derivable and must not be derived.** It looks redundant —
  an object is combineable if some recipe names it — but deriving it would make a
  *failed* combination impossible to author. A red herring is an object the player
  can try and be told "nothing happens" about, which is exactly what the no-recipe
  message in 6 exists for. Derivation would also mean scanning every recipe to
  decide whether to draw one affordance.
- **`takeable: false` is enforced at take time, and a recipe that outputs a
  static object to the inventory is an authoring error** the editor refuses rather
  than the engine tolerates.

## 2. Quantity: definitions and counts, no instances

`TODO.md`'s "Note on quantity, and why instances may not be needed" already
settled this — a definition plus a count per location, no instance ids, no timing,
no depletion. What follows is only the concrete shape, plus the one thing the note
left open: **how a count is stored so that conditional placement still works.**

Three candidates were considered:

1. **Materialize every placement at world start.** Rejected: a placement gated on
   a condition that only becomes true mid-play — the whole point of conditional
   placement — would never appear.
2. **Materialize a scene's contents on first entry.** Rejected for the drawer
   scenario: the player is already standing in the scene when the drawer is
   unlocked, so first entry has been and gone.
3. **Derive on read from authored placement plus a stored signed delta.**
   Adopted.

So the stored runtime state is one sparse map of deltas, and the current contents
of any location are computed:

```
count(location, object) =
  max(0, placedQuantity(location, object, if its gate passes now) + delta[location][object])
```

An absent key is zero at every level, so a pristine world stores nothing and an
old save with no map at all reads as pristine. A placement whose gate turns true
mid-play appears immediately, with no re-materialization trigger anywhere — which
is what makes the drawer work.

**The one constraint this buys at a discount: placement gates should be
monotonic.** Nothing enforces it, and the clamp keeps a non-monotonic gate from
producing a negative count, but a gate that turns true, then false, then true
again hands the player a second copy of something they already took. That matches
the "keep the model monotonic" principle the quantity note already adopted for
timing, and it is a documentation problem rather than a data-model one.

**One location space, not two.** A location is a `sceneId` or the sentinel
`INVENTORY_LOCATION_KEY = '___inventory___'`, following the engine's existing
`'___initial___'` / `'___auto___'` convention (`engine/src/lib/index.ts:13`).
Scene ids are uuids, so no collision is possible. This is what lets a starting
inventory be authored as an ordinary placement and lets one derivation function
serve both "the player has" and "the scene contains".

## 3. Scene placement

Inline on the object, not a table.

```ts
export interface ObjectPlacement {
  location: ElementId | typeof INVENTORY_LOCATION_KEY
  quantity: number                        // >= 1
  conditionsType?: PATH_CONDITIONS_TYPE   // default ALL
  variableConditions?: VariableCompare[]  // the existing Condition.compare tuple
  objectConditions?: ObjectCompare[]      // see 8
}
```

- **Inline because a placement is owned by exactly one object**, has no
  independent identity and is referenced by nothing — the same reasoning that
  keeps `Event.images` an array rather than a table. A table would buy a join and
  a cascade for no query anyone needs.
- **At most one placement per location.** Two placements in one scene would have
  to be summed or shadowed; `quantity` already expresses multiplicity. The editor
  enforces uniqueness.
- **Gates reuse existing declarations rather than inventing parallel ones.**
  `PATH_CONDITIONS_TYPE` for ALL/ANY, and the variable side is literally
  `Condition.compare`'s tuple type. Two separately declared enums with identical
  members are not assignable to one another in TypeScript, which is the lesson
  `CLAUDE.md` records about the transport types; the same applies here.
- **A gate can read variables and objects.** The drawer needs the object side;
  "only if the player already spoke to the innkeeper" needs the variable side and
  costs nothing once the tuple is reused.

## 4. Recipes

A new `recipes` table.

```ts
export enum RECIPE_OUTPUT_DESTINATION {
  INVENTORY = 'INVENTORY',
  CURRENT_SCENE = 'CURRENT_SCENE'
}

export interface RecipeInput {
  objectId: ElementId
  quantity: number     // >= 1
  consumed: boolean
}

export interface RecipeOutput {
  objectId: ElementId
  quantity: number
  destination: RECIPE_OUTPUT_DESTINATION
}

export interface Recipe extends Element {
  worldId: WorldId
  inputs: RecipeInput[]     // >= 1
  outputs: RecipeOutput[]
  effects?: VariableSet[]   // the existing Effect.set tuple; see 5
  message?: string          // what the storyteller says on success
}
```

- **A table, unlike placements, because a recipe has no single owner.** It relates
  two or more objects, and `TODO.md` requires the editor to show it "from either
  side of the relationship". Hanging it off one input object would make the other
  side a reverse scan and make deletion ambiguous.
- **Inputs and outputs stay inline** for the same reason placements do: owned, no
  identity, referenced by nothing.
- **No `inputObjectIds` index.** The obvious optimisation is a derived array of
  input ids indexed `*inputObjectIds`, because Dexie's multi-entry index cannot
  index ids inside an array of objects. It is not worth it: recipe counts are in
  the tens, the engine already does in-memory reference counting for `Event.audio`
  for exactly this reason, and a derived duplicate of authored data is a
  consistency trap. Query by `worldId` and filter in memory. If a world ever
  carries thousands of recipes, add the index then — it is an index, not a shape,
  so it costs one Dexie version and nothing else.
- **`inputs.length >= 1`, which gives decomposition for free.** A single-input
  recipe is the "use" affordance and a multi-input recipe is "combine" — one code
  path, two affordances. `TODO.md`'s own worked example needs this: opening the
  charged flashlight consumes one input and yields two outputs.
- **Matching is on the exact input set, with quantities at least the recipe's.**
  Subset matching would let combining A and B fire a recipe for A alone. Two
  recipes sharing an input set are an authoring error the editor warns about; the
  engine resolves ties by sorted id rather than insertion order, for the same
  determinism reason `sceneMapLayout` sorts before handing nodes to dagre.
- **Inputs resolve from the inventory first, then the current scene.** A static
  object can only ever be satisfied from the scene, since it cannot be in the
  inventory. This is what "objects combine with static objects in the current
  scene" means concretely.

## 5. Yes, a recipe can set a variable

Adopted, as the optional `effects` array above, reusing `Effect.set`'s tuple
inline rather than as rows in the `effects` table — that table is keyed by
`pathId` and a recipe has no path.

`TODO.md` called this "not required … but convenient". It is worth taking now
because of the asymmetry in cost: an optional array on a table this migration is
already creating is nearly free, and adding it later is a whole second migration.
Without it, an author who wants "combining these advances the quest counter" has
to invent a path whose only purpose is to carry the effect, for a state change
that has nothing to do with movement.

**The engine consequence is the important half.** A recipe application must
produce a **new live event**, not mutate the current one:

```ts
// additions to ENGINE_LIVE_EVENT_TYPE
OBJECT_TAKE = 'OBJECT_TAKE',
OBJECT_COMBINE = 'OBJECT_COMBINE'
```

with the same `destination` as the event it follows, carrying the updated `state`
and object deltas, chained through the existing `prev`/`next`.

Two reasons, and **neither of them is rewind** — that feature is decided against
on principle, per `TODO.md`'s "Not included", so nobody should reach for it to
justify anything here, and nobody should mutate the live event in place on the
grounds that "we do not rewind anyway":

- **The live event stream is the player's visible history.** `getRecentLiveEvents`
  renders the chain, so a combination has to *be* an event to appear as a beat in
  the prose. That is where `Recipe.message` is rendered. Mutating the current
  event would apply the effect and narrate nothing.
- **A bookmark names a live event id.** Resuming is unambiguous only while a live
  event is immutable — an event that can change after a bookmark points at it
  means the same saved id yields different state depending on when it is read.

Inspecting an object changes no state and writes no live event.

`ENGINE_LIVE_EVENT_TYPE` is persisted in `EngineLiveEventData.type`, but new
members are purely additive — no existing save contains them — so this needs no
migration. Dropping an object is deliberately **not** modelled: nothing asks for
it, and a recipe that outputs to `CURRENT_SCENE` covers "put it down" wherever an
author wants it.

## 6. What the storyteller says when nothing matches

Silence reads as broken, so there is always a sentence. Three levels, most
specific first:

1. `WorldObject.noRecipeMessage` of the object the player combined **from**
2. `World.objectNoRecipeMessage`, a new optional world-level default
3. the engine's built-in fallback, `"Nothing happens."`

"From" means the first-selected object: "use the key on the drawer" applies the
key, so the key's message wins. The default is deliberately vague rather than
mechanical — `"Those don't combine."` leaks the existence of the recipe system
into prose that is meant to read as narration. Authors who want the clearer
phrasing set it at the world level once.

Success needs no default message: the inventory visibly changes, so
`Recipe.message` stays optional.

## 7. Inventory state on live events

One optional field, and **it needs no engine migration**:

```ts
// EngineLiveEventData
objects?: EngineObjectDeltaCollection

export interface EngineObjectDeltaCollection {
  // location -> objectId -> signed delta
  [location: string]: { [objectId: ElementId]: number }
}
```

`TODO.md` section 3 lists "Engine migration `engine/src/lib/db/v12.ts` for
inventory state". **That is the wrong reason for the right file.** The state field
itself is optional and unindexed on a table that already exists, so it costs no
version bump, and an old save that lacks it reads as a pristine world. What
actually forces `engine/src/lib/db/v12.ts` is the new **definition** tables —
`objects`, `recipes` and `objectConditions` have to be declared in `.stores()`,
and that is what needs the version.

**`updateEngineDefaultWorldCollectionData` needs an object clause.** That function
(`engine/src/lib/api.ts:311`) is the single place a saved game is reconciled
against a newer world: it rebuilds live event state from the current variables and
carries forward the old value for any variable that still exists. Objects need the
mirror of that — **drop deltas naming an object that no longer exists, keep the
rest.** Without it a save holds counts for deleted objects forever and a "player
has" query answers about a ghost.

## 8. Conditions on inventory and scene contents

Today a condition is a row in `conditions` whose `compare` is
`[variableId, COMPARE_OPERATOR_TYPE, string, VARIABLE_TYPE]` — a strict 4-tuple in
the transport schema (`prefixItems`, `items: false`, min and max 4).

**Extending that tuple was rejected.** `isPathOpen` (`engine/src/lib/api.ts:1189`)
looks the variable up by `compare[0]` and, if it finds nothing, pushes nothing
into `isOpenAgg` — and since `[].every() === true` under
`PATH_CONDITIONS_TYPE.ALL`, an unrecognised condition **opens the path**. Making
object conditions a variant of the same row means every existing reader
(`isPathOpen`, `variableUsage`, `removeVariable`'s cascade, the condition editor)
needs a new guard, and any reader that is missed fails open — silently, and in the
direction that unlocks content.

So object conditions are a distinct concept with a distinct evaluator that has to
be called explicitly, and therefore cannot silently no-op:

```ts
export enum OBJECT_LOCATION_TYPE {
  INVENTORY = 'INVENTORY',
  CURRENT_SCENE = 'CURRENT_SCENE',
  SCENE = 'SCENE'
}

// the evaluable core, reused in two places
export type ObjectCompare = {
  objectId: ElementId
  location: OBJECT_LOCATION_TYPE
  sceneId?: ElementId                      // required when location is SCENE
  compare: [COMPARE_OPERATOR_TYPE, number] // count comparison; default [GTE, 1]
}

// a path gate: its own table, because it is queried by pathId
export interface ObjectCondition extends Element, ObjectCompare {
  worldId: WorldId
  pathId: ElementId
}
```

- **The core is separate from the record** so a placement gate (3) can hold an
  `ObjectCompare` inline while a path gate is a row queried by `pathId`, mirroring
  how `Condition.compare` is the reusable part of a condition row. One evaluator
  serves both.
- **Quantity-aware from the start**, reusing `COMPARE_OPERATOR_TYPE`. `[GTE, 1]`
  is "has one", `[GTE, 5]` is the coin gate, `[EQ, 0]` is absence. A boolean
  "has/hasn't" would have needed widening for the coins, which are one of the
  three scenarios this pass had to satisfy.
- **`CURRENT_SCENE` is the default and the interesting one.** It is what makes
  "scene contains Unlocked Drawer" work in whichever scene the player unlocked,
  which is precisely why conditional placement replaces containers.
- **Two things must change in `isPathOpen`, not one.** Its booleans go into the
  same `isOpenAgg` so ALL/ANY still composes across both kinds; and the
  `totalConditions` count it returns must include object conditions, or a path
  gated *only* on objects loses the feedback#105 preference that favours
  conditional paths over unconditional ones.

## 9. Storyworld cover image

`World.coverAssetId?: string`, plus two entries in the asset tables — because
`CLAUDE.md` is explicit that a fifth place a storyworld names an asset belongs in
`collectAssetReferences`, and objects add one too:

| new | kind | pipeline |
| --- | --- | --- |
| `ASSET_REFERENCE_TYPE.OBJECT_IMAGE` | `ASSET_KIND.OBJECT_IMAGE` | 1:1, 400×400, WebP q0.8 |
| `ASSET_REFERENCE_TYPE.WORLD_COVER` | `ASSET_KIND.WORLD_COVER` | 16:9, 1310×736, WebP q0.7 |

- **Object images are square** because one asset has to serve both an inventory
  tile and the inspect panel; a 16:9 crop in a tile is mostly padding.
- **The cover's pipeline is deliberately identical to the event image's.** It
  still gets its own `ASSET_KIND` so the import menu can label it correctly —
  the menu asks which kind rather than inferring one, since nothing on disk
  distinguishes intent. Sharing the numbers is not the "nearly right" failure
  `CLAUDE.md` warns about; that warning is about assets processed *differently*
  from what a read site expects. Two kinds with byte-identical processing are
  interchangeable by construction, and the picker filters on extension anyway, so
  an event image may be chosen as a cover. That is a convenience, not a bug.
- Both are clearable single fields, so both are `isReferenceClearable` — unlike
  `EVENT_IMAGE`, whose id lives in a Slate document as well.

## 10. Character relationship data

Its own table, and **editor-only**:

```ts
export interface CharacterRelationship extends Element {
  worldId: WorldId
  from: ElementId          // characterId
  to: ElementId            // characterId
  directed: boolean        // false = mutual
  description?: string
  variableId?: ElementId   // optional: a variable tracking strength at runtime
}
```

`Element.title` is the label — "sister of", "distrusts".

- **A table for the same reason recipes are**: a relationship relates two
  characters and belongs to neither, and `TODO.md` section 6 already notes it is
  "the same shape as object recipes — a graph between entities". Building that
  editing pattern once in section 4 and reusing it here is the point.
- **Not compiled into the engine collection.** It is authoring metadata, so it
  gets no engine table, no engine migration and no `format.ts` entry — the
  cheapest tier in the table at the top. Anything that must be visible at runtime
  goes through the optional `variableId`: the *relationship* is metadata, the
  *number* is a variable the engine already understands. It still rides the
  transport schema so that exporting and re-importing a world preserves it.

## 11. Variable scope

```ts
// on Variable, and passed through format.ts's pick list
scope?: VARIABLE_SCOPE   // default WORLD when absent
scopeId?: ElementId      // the scene, when scope is SCENE

export enum VARIABLE_SCOPE {
  WORLD = 'WORLD',
  SCENE = 'SCENE'
}
```

**`SCENE` means exactly one thing: the variable resets to its initial value when
the player enters that scene.** Per-scene scratch state, reset by the engine on a
`JUMP` live event. That is the only semantic being reserved, stated so nobody has
to guess later; the enum takes another member without a migration if section 6
wants character or event scope.

**Scope changes lifetime, not namespace.** Variable titles stay globally unique
regardless of scope, because `EventSnippet` and the engine both build their
template-expression variable map keyed on `variable.title` — two scene-scoped
variables in different scenes sharing a title would be ambiguous, with whichever
the map saw last winning, which is the trap `CLAUDE.md` already documents for
renames. The variable manager keeps enforcing uniqueness across the world.

Both fields are optional and unindexed, so this is tier two: no migration, but
`format.ts:110`'s pick list must name `scope` and `scopeId` or the engine never
sees them.

## 12. Presentation features that would otherwise earn their own migration

Section 2 asks whether choice modals, notifications or inline choices need a
persisted field, so that any that do ride this migration. All three are answered
minimally — the goal is to reserve the slot, not to design section 7.

- **Choice modals — one enum, two optional fields.**
  `CHOICE_PRESENTATION = { INLINE, LIST, MODAL }`, as
  `World.choicePresentation?` for the default and `Event.choicePresentation?` for
  a per-event override. Both optional and unindexed; the engine reads them, so
  both belong in `format.ts`'s pick lists.
- **Storyworld notifications — `Path.notification?: string`.** A transient line
  shown when a path is taken, template expressions included since
  `getProcessedTemplate` takes a string. A new element type was rejected as far
  too much for "You hear a door slam."; if section 7 later wants rich
  notifications, the string becomes a reference and that is a change to a field
  that already exists.
- **Inline choices — reference an existing `Choice`, and so cost nothing.**
  `TODO.md` left this open and asked section 2 to decide. An inline choice is a
  void Slate node in `Event.content` carrying a `choice_id`, exactly as the image
  node carries an `asset_id`. `Event.content` is already an opaque string in the
  schema, so there is **no transport change and no migration at all**, and the
  choice stays in the `choices` table where paths already reference it.

  The consequence is bookkeeping, not schema: `lib/contentEditor` must diff
  inline choice nodes against `Event.choices` the way it already diffs image nodes
  against `Event.images`, or a deleted node leaves an orphaned choice — and an
  orphaned choice is worse than an orphaned asset, because a path still points at
  it.

---

## Three scenarios, on paper

The point of writing these out is that each one exercises a decision that would
otherwise only be tested after the migration shipped.

### A. The flashlight — swapping definitions, and a gated path

Three definitions, all takeable and combineable: **Flashlight (empty)**,
**Battery**, **Flashlight (charged)**. A charged flashlight is a different object
from an empty one, not the same object in a different mood.

| | |
| --- | --- |
| placement | Flashlight (empty) → *Kitchen*, qty 1 |
| placement | Battery → *Study*, qty 1, gated `objectConditions: [{ Unlocked Drawer, CURRENT_SCENE, [GTE, 1] }]` |
| recipe R1 | in: Battery ×1 consumed, Flashlight (empty) ×1 consumed → out: Flashlight (charged) ×1 → INVENTORY. message: "You snap the battery into the flashlight." |
| recipe R2 | in: Flashlight (charged) ×1 consumed → out: Flashlight (empty) ×1 → INVENTORY, Battery ×1 → INVENTORY |
| path gate | the dark corridor path carries `ObjectCondition { Flashlight (charged), INVENTORY, [GTE, 1] }` |

Play trace, as stored deltas:

1. take the flashlight → `OBJECT_TAKE`, delta
   `{ ___inventory___: { flash_empty: +1 }, kitchen: { flash_empty: -1 } }`.
   Kitchen derives `1 + (-1) = 0`; inventory derives `0 + 1 = 1`.
2. the drawer is unlocked in the Study (scenario C) → the Battery's gate passes
   and it **appears**, with no write of any kind. Deriving on read is what makes
   this free.
3. take the battery, then combine → `OBJECT_COMBINE`, delta on the inventory
   `{ battery: -1, flash_empty: -1, flash_charged: +1 }`, and the corridor path
   opens.
4. R2 reverses it, and the battery is reusable elsewhere — which is the whole
   reason inputs are flagged individually rather than the recipe being
   consuming or not.

**What this exercises:** single-input recipes as decomposition, the
`CURRENT_SCENE` default on a placement gate, and a path gated on the inventory.

### B. A pile of coins — one definition, many counts

One definition, **Coin**, with `stackedTitle: "a pile of coins"` and a
`stackedAssetId` of a pile. Placements: *Alley* qty 1, *Cellar* qty 3, *Fountain*
qty 5. A recipe consumes Coin ×5 → **Bus Ticket** → INVENTORY.

The inventory reads "a pile of coins ×9" once the count exceeds one, and the
ticket recipe demonstrates quantity on the input side. A path gated
`[GTE, 5]` is open before the purchase and closed after it.

**One decision this forced: taking a stack takes all of it.** The alternative is
a per-take quantity control in the storyteller, for a model where quantity per
location is authored rather than emergent. Taking the Fountain's coins is one
action and one delta of `-5`. If an author wants them collected one at a time,
that is five scenes or five definitions — which is honest, because "some of a
pile" is state the model deliberately does not carry.

**What this exercises:** the stacked name and image, quantity on a recipe input,
and quantity in a condition — the reason `ObjectCompare.compare` is a count
comparison rather than a boolean.

### C. The key, used repeatedly — retained inputs and no containers

**Key** takeable. **Drawer** and **Unlocked Drawer** static and combineable.

| recipe R3 | in: Key ×1 **retained**, Drawer ×1 consumed → out: Unlocked Drawer ×1 → CURRENT_SCENE |
| --- | --- |

With two drawers in two scenes, each scene has its own Drawer placement of qty 1.
Unlocking in the Study writes `{ study: { drawer: -1, unlocked_drawer: +1 } }`, so
the Study derives zero drawers and one unlocked drawer while the other scene is
untouched. The key stays in the inventory and works on the second drawer, because
its input is retained.

The Battery's placement gate from scenario A then passes **in the Study only** —
so the battery is revealed exactly where the drawer was opened, with no container
model, no recursion and no "locked" concept. Until then the battery is not in the
world at all, rather than visible and refused.

**What this exercises:** per-input `consumed`, outputs to `CURRENT_SCENE`, the
definition-swap idiom on a static object, and the claim in `TODO.md` that
conditional placement models revelation better than containers model it.

---

## What section 3 has to do

The precise cost, now that the shape is settled. **Four new editor tables, three
new engine tables** — `characterRelationships` is editor-only.

**Editor**

- `src/data/types.ts` — `WorldObject`, `ObjectPlacement`, `ObjectCompare`,
  `ObjectCondition`, `Recipe`, `RecipeInput`, `RecipeOutput`,
  `CharacterRelationship`; the enums `OBJECT_LOCATION_TYPE`,
  `RECIPE_OUTPUT_DESTINATION`, `VARIABLE_SCOPE`, `CHOICE_PRESENTATION`; new
  `ELEMENT_TYPE` members `OBJECT` and `RECIPE`; new fields on `World`,
  `Variable`, `Event` and `Path`
- `src/db/v12.ts` — `.stores()` for `objects`, `recipes`, `objectConditions`,
  `characterRelationships`. Indexes `&id,worldId,title,*tags,updated`, plus
  `pathId` on `objectConditions`. **v11 is taken** by the 0.7.1 restamp
- `src/db/index.ts` — four `LIBRARY_TABLE` members, CRUD, and a `removeObject`
  cascade that deletes recipes naming the object and object conditions naming it,
  stating its consequences the way `confirmRemoveVariable` does
- `src/api/index.ts` — the new surfaces
- `src/lib/transport/types/0.8.0.ts` — a real declaration, not a re-export;
  `schema/0.8.0.json` with the four collections added to the top-level `required`
  list, which is `additionalProperties: false`; a `validate/index.ts` map entry;
  `upgrade/0.8.0.ts`
- `src/lib/importWorldData.ts` — a `< 0.8.0` gate **appended after** the existing
  chain, in the shape the 0.7.1 step already uses, plus save loops
- `src/lib/getWorldDataJSON.ts` — four collections and the new `_` fields
- `src/lib/compiler/format.ts` — `objects`, `recipes`, `objectConditions`, and
  `scope`/`scopeId`/`choicePresentation` added to the existing pick lists
- `src/lib/assets.ts` — two `ASSET_KIND`s, two `ASSET_REFERENCE_TYPE`s, and both
  new writers in `collectAssetReferences`
- `AppContext`'s `defaultAppState.version` → `0.8.0`, which only moves alongside
  the schema and upgrade entries above

**Engine**

- `engine/src/types/index.ts` — the `Engine*` mirrors, three new
  `ESGEngineCollectionData` keys, `EngineLiveEventData.objects`, and the two new
  `ENGINE_LIVE_EVENT_TYPE` members
- `engine/src/lib/db/v12.ts` — `.stores()` for the three tables. **This file
  exists for the definition tables, not for the inventory state**, which is an
  optional unindexed field and needs no version
- `engine/src/lib/db/index.ts` — tables and save methods
- `engine/src/lib/api.ts` — the derivation function, `isPathOpen` extended for
  object conditions **including its `totalConditions` count**, the take and
  combine writers, and the object clause in
  `updateEngineDefaultWorldCollectionData`

Sections 4 to 7 then add UI against fields that already exist. Nothing in that
list is a second migration, which was the point of doing this pass first.
