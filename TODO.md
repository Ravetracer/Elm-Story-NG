# Feature TODO

Ordered to keep the expensive, hard-to-reverse work rare rather than to do the
most-wanted thing first. The world object and inventory system is still the
headline; it is just preceded by a design pass and a single migration so it is not
paid for three times.

`ROADMAP.md` holds the per-item grounding — what already exists and what each item
touches. Its *ordering* is superseded by this file.

**Two persisted stores, two migration chains.** The editor's library lives in
`src/db/v*.ts` (currently through v12) and the engine's runtime state in
`engine/src/lib/db/v*.ts` (v6 through v12). Every schema change therefore costs: a
new transport schema, an `importWorldData` branch, an export path change, and up
to two migrations.

The sentence that used to end that paragraph — "anything stored on a live event,
which includes inventory state, needs an engine migration as well as an editor
one" — was **wrong about the second half**, and section 3 proved it. A live event
gained the inventory delta map with no engine migration at all, because Dexie
declares indexes rather than shapes: an optional unindexed property on an existing
table is simply stored, and a save written before it existed reads as absent.
What needs a migration is a new **table** or a new **index**.

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
- [x] Scene Map: auto layout — see `CLAUDE.md`, "Scene map auto layout". The
      model is `lib/sceneMapLayout.ts`, pure and covered by
      `src/__tests__/sceneMapLayout.test.ts`; **Auto Layout** and **Undo Auto
      Layout (n)** are in the scene map's toolbar.
- [x] Storyworld Map: navigable map of the entire world — see `CLAUDE.md`, "The
      storyworld map". The graph model is `lib/storyworldMap.ts`, pure and covered
      by `src/__tests__/storyworldMap.test.ts`; it opens from the node button in
      the outline's title bar and is laid out by `lib/sceneMapLayout.ts` on every
      open rather than persisted, which is what keeps it clear of a schema change.
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

- [x] Rename the project so there's no confusion. It can happen that users will be confused if the original
      authors are continuing development on this. So the project name/trademark has to be altered a bit to make it
      clear, that this is a continuation of the canceled project.
      All occurrences of "Elm Story" has to be replaced by "Elm Story - NG" (for Next Generation).
      Assets like images and icons are already altered to reflect the new name.
      The title bar icon has to be replaced as well. A new SVG icon is provided in './assets/es_logo_NG_favicon.svg'.
      Extract the info box SVG image so it can be altered by the current dev.
      *(See `CLAUDE.md`, "The rename to Elm Story - NG". Both marks are now editable `.svg`
      files rather than inline React components — `TitleBar/mark.svg` and
      `Modal/ESGModal/banner.svg` — and the info box carries no links at all, since every
      one it had pointed at a dead domain or at an account belonging to the original
      authors. Two things the rename could have broken quietly and did not: Electron
      derives `userData` from the product name, so the directory is pinned in `src/main.ts`
      or every existing storyworld and asset would have been stranded behind an empty
      dashboard, with no error to say so; and
      `engine/public/favicon.svg` shipped live `<text>` in a font that exists only on the
      author's machine, so the copy that goes into an exported PWA is now outlined.)*

## 2. Design pass — no code

Settle the shape of **everything** that will ever need a new persisted field, so
the migrations below happen once. Then author three scenarios on paper before
writing any of it: the flashlight, a pile of coins, and a key used repeatedly
without being consumed.

**Done. `DESIGN.md` is the output** — every field below, the decision that was
taken, the alternatives that were rejected and why, the three scenarios traced as
stored deltas, and a per-file list of what section 3 has to do. Read it before
writing any of section 3; the items below are checked off against it.

- [x] Object definitions: name, description shown when inspected, optional image,
      takeable or static, combineable
      *(`WorldObject`, a new `objects` table. Description is plain text rather
      than a Slate document and still gets template expressions, because
      `getProcessedTemplate` takes a string. `combineable` is deliberately not
      derived from whether a recipe names the object — deriving it would make a
      *failed* combination impossible to author, which is what the no-recipe
      message exists for.)*
- [x] Quantity model — see the note below; this is the one decision that most
      changes the amount of code
      *(Definition plus count per location, no instances, as the note settled. What
      the note left open was how a count is stored: it is **derived on read** from
      authored placement plus one sparse map of signed deltas. Materializing at
      world start or on scene entry were both considered and both break the drawer,
      where the gate turns true while the player is already standing in the scene.)*
- [x] Scene placement: which scenes an object starts in, and an optional condition
      gating whether it is there at all — see the note on containers below
      *(Inline on the object, not a table — owned by one object, referenced by
      nothing, the same reasoning that keeps `Event.images` an array. At most one
      placement per location; gates read variables and objects and reuse the
      existing tuple and `PATH_CONDITIONS_TYPE` rather than declaring parallel
      ones. One location space, with `'___inventory___'` as a sentinel beside
      scene ids, so a starting inventory is an ordinary placement.)*
- [x] Recipes: inputs each flagged consumed or retained, outputs each destined for
      the inventory or the current scene
      *(A `recipes` table, because a recipe relates two or more objects and belongs
      to none of them — which is also what the editor needs to show it from either
      side. `inputs.length >= 1`, so decomposition is the same code path with a
      different affordance: one input is "use", several is "combine". Matching is
      on the exact input set, since subset matching would fire a one-input recipe
      when two objects are combined.)*
- [x] Whether a recipe can also set a variable. Not required if conditions can
      read object presence, but convenient.
      *(Yes — an optional `effects` array reusing `Effect.set`'s tuple inline. Free
      on a table this migration already creates, a whole second migration later.
      The engine consequence is the bigger half: applying a recipe writes a **new
      live event** with the same destination — the stream is the player's visible
      history, so a combination has to be an event to narrate anything, and a
      bookmark naming a live event id only resumes unambiguously while that event
      is immutable. Not for rewind, which is decided against.)*
- [x] What the storyteller says when two objects have no matching recipe. Silence
      reads as broken; a default message, overridable per object, reads as
      deliberate.
      *(Three levels: the object's own `noRecipeMessage`, then a new world-level
      default, then the engine's built-in "Nothing happens." The object that wins
      is the first selected — "use the key on the drawer" applies the key.)*
- [x] Inventory state on live events, so resuming a save stays correct
      *(Was "so rewind, save and load stay correct". Rewind is decided against —
      see "Not included" — and the snapshot is not what it was for.)*
      *(One optional `objects` field on `EngineLiveEventData`, which needs **no
      engine migration** — see the correction in section 3. It does need an object
      clause in `updateEngineDefaultWorldCollectionData`, the one place a save is
      reconciled against a newer world, or a save keeps counts for deleted objects
      and "player has X" answers about a ghost.)*
- [x] Conditions on inventory and scene contents: "player has X",
      "scene contains X"
      *(A distinct `objectConditions` table rather than a variant of `Condition`.
      `isPathOpen` drops a condition whose variable it cannot find, and
      `[].every()` is `true`, so an unrecognised condition **opens** the path —
      making object conditions a variant of the same row means every missed reader
      fails open, in the direction that unlocks content. Count comparisons rather
      than a boolean, which is what the coins need.)*
- [x] Storyworld cover image field
      *(`World.coverAssetId`, plus two asset kinds and two reference types — object
      images are square at 400×400, the cover reuses the event image's pipeline
      under its own kind so the import menu labels it correctly.)*
- [x] Character relationship data
      *(Its own table for the same reason recipes get one, and **editor-only** —
      no engine table, no engine migration, no `format.ts` entry. Anything that
      must be visible at runtime goes through an optional `variableId`: the
      relationship is metadata, the number is a variable the engine already reads.)*
- [x] Variable scope field
      *(Optional `scope` and `scopeId`, defaulting to WORLD. `SCENE` is reserved
      with exactly one meaning — reset to the initial value on entry. Scope changes
      lifetime, **not** namespace: titles stay globally unique, because template
      expressions resolve variables by title.)*
- [x] Check whether choice modals, storyworld notifications or inline choices need
      a persisted field. If any do, fold them in here so they ride the same
      migration rather than earning their own.
      *(Modals: an optional `choicePresentation` on the world and per event.
      Notifications: `Path.notification`, a string. **Inline choices cost nothing
      at all** — the open question from section 7 is decided: an inline choice is a
      void Slate node carrying a `choice_id`, exactly as the image node carries an
      `asset_id`, so `Event.content` stays an opaque string and there is no
      transport change. The cost is bookkeeping — `lib/contentEditor` must diff
      those nodes against `Event.choices` the way it diffs images against
      `Event.images`, and an orphaned choice is worse than an orphaned asset
      because a path still points at it.)*

## 3. The migrations — once per chain

Ship the fields before anything uses them. Adding them unused now is far cheaper
than a second migration later; the cost is that the shape has to be right, which
is what section 2 is for.

**Done.** Four new editor tables, three new engine tables —
`characterRelationships` is editor-only. `DESIGN.md`'s closing per-file list is
what was built; see `CLAUDE.md`, "The 0.8.0 shape", for what is now easy to get
wrong.

- [x] Transport schema `0.8.0`, plus the `importWorldData` branch and the export
      path. Note the chain now ends at 0.7.1, so the new step upgrades from there;
      `types/0.7.1.ts` re-exports 0.7.0 rather than declaring a shape, so `0.8.0`
      is the first file in a while that gets a real declaration of its own. The new
      gate is **appended after** the existing chain, in the shape the 0.7.1 step
      already uses, rather than widening the `< 0.7.0` gate.
      *(The schema JSON was derived from 0.7.0's programmatically and then frozen,
      with a check that every pre-existing collection came out structurally
      identical — the diff is the four collections plus seven optional properties.
      The 0.8.0 step is **idempotent**, unlike 0.7.0's, and a test holds that
      rather than the docstring merely claiming it.)*
- [x] Editor migration `src/db/v12.ts` — **v11 is taken**, by the 0.7.1 schema
      restamp adopted from the 0.7.1 archive
- [x] Engine migration `engine/src/lib/db/v12.ts`, same renumbering. **Not for the
      inventory state** — that was the assumption when this list was written and
      the design pass disproved it. The state is an optional unindexed field on the
      existing `live_events` table, and Dexie declares indexes rather than shapes,
      so it needs no version at all; an old save that lacks it reads as a pristine
      world. What forces the file is the new **definition** tables — `objects`,
      `recipes` and `objectConditions` have to be declared in `.stores()`.

**Three bugs the compiler found here, worth knowing because none was reasoned
out:** `main.ts` typed the PWA export path against 0.7.1 while handing it data
`getWorldDataJSON` had just written, so an export would have packed a world with
the new collections missing — the failure `CLAUDE.md` says only shows up when
someone actually exports, caught at compile time instead. `saveElementTitle` hit
TS2590 once the table count reached 19. And `AssetTile`'s reference-label switch
stopped compiling under `noImplicitReturns` when the asset enum grew, which is the
editor's stricter `tsconfig` catching an exhaustiveness gap the engine's would
have waved through.

**One bug that predated all of this:** `importWorldData` never read
`Variable.description` back, though the exporter has written it since it was
added, so exporting a world and re-importing it silently dropped every variable
note. Fixed in the same pass as `scope` and `scopeId`.

## 4. World objects and inventory

The headline feature. Everything it persists was migrated in section 3, so this
is application code only.

**Usable end to end.** Objects and recipes can be authored, placed, taken and
combined; a path can be gated on holding something. What is left is listed under
"Still open" below — none of it blocks authoring a world with objects in it.

- [x] **The model** — `engine/src/lib/objects.ts`, pure, with the variable
      comparison and assignment rules split into `engine/src/lib/state.ts` so a
      path condition, a placement gate and a recipe effect share one
      implementation. `src/__tests__/objectModel.test.ts` covers both in 49 tests,
      including the drawer scenario end to end, the coin stack, the retained key
      across two drawers, decomposition and the no-recipe message chain.
- [x] **The four runtime items deferred out of section 3** — derivation,
      `isPathOpen` extended for object conditions *including* its
      `totalConditions` count, and the object clause in
      `updateEngineDefaultWorldCollectionData`. The take and combine helpers are
      written and tested as pure functions; **what remains is the caller that
      turns their result into a live event.**

Three things the model turned up that the design pass had not: two objects each
gated on the other's presence is authorable and recursed until the stack gave out
(cycles now resolve to absent); a gate typed ANY with no conditions would have
hidden its object, because `[].some()` is false; and both `isPathOpen` and
`processEffectsByRoute` read a state entry before checking it existed, so a
condition or effect naming a variable missing from a save threw rather than being
skipped.

- [x] **The engine's writers** — `useObjectActions` appends an `OBJECT_TAKE` or
      `OBJECT_COMBINE` live event with the same destination, since neither action
      moves the player. Nothing is written when nothing changed. It also fixed a
      latent bug: `gotoNextLiveEvent` rebuilt every field of the next live event
      but not `objects`, so an inventory would have emptied itself on the next
      choice.
- [x] **The storyteller UI** — `ObjectPanel`, docked to the bottom of the runtime
      column, with take, inspect and combine. Renders **nothing** when the world
      has no objects, which is how every pre-0.8.0 storyworld keeps the
      presentation it has.
- [x] **The editor UI** — `components/ObjectManager`, two tabs. Objects carries
      name, description, takeable, combineable, the stacked name, both image slots
      and the placements; Recipes carries inputs, outputs, the success message and
      variable effects. An object's recipes are listed on the object and open from
      there, which is the "either side of the relationship" requirement.

- [x] **Placement gate conditions and path object conditions have editors.**
      `ObjectManager/PlacementConditions` and
      `ElementProperties/PathProperties/PathObjectConditions`. Both mechanisms were
      already evaluated by the engine and carried by the transport, so a world
      authored by hand worked; what was missing was any way to author one.
- [x] **Object actions narrate in the story stream**, not in the object panel —
      `EngineLiveEventData.messages`, rendered by `Event` between the prose and the
      choices. This reversed `DESIGN.md` §5, which had a take append a live event of
      its own; that event carried the same `destination`, so it drew the whole event
      a second time and left a stale twin whose choices were still clickable and
      whose `objects` predated the take. §5 records the reversal.

**Still open, and none of it blocks authoring:**

1. **`Variable.scope`, `Path.notification` and `choicePresentation` are carried but
   unread.** Fields shipped in section 3 against sections 6 and 7; the engine does
   not act on any of them yet.
**Decided against: a setting for how object text is presented.** It stays a theme
token, changeable by a theme and not by a player. The question was raised as an
accessibility one — whether a reader with a colour vision deficiency could
separate an object's description from the prose — and the treatment answers it
without a setting: prose is upright, a narration is italic, an inspection is
italic *and* indented behind a citation rule, so **nothing rests on colour**
(WCAG 1.4.1). The two greys differ in lightness rather than hue, which no form of
colour blindness collapses, and both clear WCAG AAA for body text — measured
against what the app paints, 7.48:1 for the inspection and 13.38:1 for the
narration on CONSOLE, and 7.07:1 computed for BOOK. A setting would therefore be
a preference rather than access, and the storyteller's Settings panel is not the
place to spend that. Reopen it only if the floor moves, not for taste.

- [x] World objects
  - [x] placed on a scene, static or takeable
  - [x] has a name
  - [x] has an optional dedicated image
  - [x] has a description shown when inspected
  - [x] combineable with another object — a pair at a time, per
        `MAX_RECIPE_INPUTS`; a chain of three is two recipes through an
        intermediate object
- [x] Combination by recipe
  - [x] each input is consumed or retained
  - [x] each output goes to the inventory or to the current scene
  - [x] decomposition is just a recipe pointing the other way — opening the
        charged flashlight is one input consumed, two outputs
  - [x] editor: show an object's recipes from either side of the relationship
  - [ ] EXAMPLE: battery + flashlight → charged flashlight, both inputs consumed,
        output to inventory. Opening it: charged flashlight consumed, empty
        flashlight and battery out. The battery is then reusable elsewhere.
- [x] Character inventory
  - [x] holds takeable objects from anywhere in the world
  - [x] objects combine inside the inventory
  - [x] objects combine with static objects in the current scene
  - [x] panel beside the event stream, centre of the storyteller, filling as the
        world is played — a 12rem rail inside the runtime column, HERE above
        INVENTORY, icon tiles with the name on hover and the description printed
        into the stream on select. An earlier `ObjectPanel` argued this made the
        prose too narrow; that holds for two panes and not for a rail, which takes
        the measure from about 81 characters a line to 69.
- [x] Inventory conditions
  - [x] paths gated on holding an object, so a charged flashlight can open a dark
        corridor. Without this, objects are scenery: `Condition.compare` tests
        variables only today.

## 4.4 The PWA export, verified

Exercised end to end for the first time since the revival: exported the imported
storyworld, served it over HTTP and played it in a real browser.

**The pipeline is healthy.** All four token replacements land (`___worldTitle___`,
`___worldDescription___`, `___worldId___`, `"___storytellerData___"`), ~153KB of
compressed world data reaches the single entry chunk, assets are copied, and the
service worker's precache revisions are rewritten for exactly the two files the
export modifies — `index.html` and the entry chunk — leaving `revision: null` on
the untouched content-hashed assets, where null is correct. Objects, recipes, the
rail, take, inspect and the interface text all work at runtime, and the title
card and settings panel render, which the composer preview cannot show.

**It found one real bug**: both bundled fonts were corrupt and had been since the
initial commit, so every exported storyworld rendered in a system fallback. Fixed
in 0.27.1; see `CLAUDE.md`, "Housekeeping".

Two things to reuse when testing this again:

- The export ends in a native directory dialog, which no CDP client can drive.
  `electron-vite dev --inspect <port>` exposes the **main** process, where
  `require('electron').dialog.showOpenDialog` can be stubbed to return a fixed
  path — leaving the real handler to run.
- **Serve each export from a fresh port.** An exported PWA registers a service
  worker that precaches the CSS and fonts, so a second export on the same origin
  hands back the first one's assets.

## 4.5 User contributed ideas

Some ideas the developer had between the tasks are land here.

- [x] Put the messages for combining and taking objects into the story stream instead of the inventory. It's better
      for the reading flow if it appears there. Done as `EngineLiveEventData.messages`; see section 4 and `DESIGN.md`
      §5. It also removed a data-loss bug the appended live event had introduced.
- [x] Add options for translating some hardcoded strings. E.g. I would like to write "nehmen" instead of "take" for
      objects in German games. All strings should be translatable too which are now hardcoded English and visible to the player.
      Done as `World.interfaceText`, a sparse map keyed by `INTERFACE_TEXT_KEY`, edited from **Interface Text** in the
      storyworld outline's title bar. All 43 player-facing strings are covered; `engine/src/lib/interfaceText.ts` is the one
      declaration of the keys, their English and their grouping, and the editor's manager is generated from it.
      **Per storyworld, with no language picker** — the prose cannot be switched at runtime, so a picker would put German
      chrome around English prose. An author writing in two languages writes two storyworlds.

## 5. Save and load — OBSOLETE

*Nothing to do here. Kept rather than deleted because the numbering is referenced
from `DESIGN.md` and `ROADMAP.md`, and because what was found while closing it is
worth keeping — particularly the last paragraph, if multiple bookmarks are ever
reconsidered.*

**Resume only, and it already works.** Verified end to end in an exported
PWA rather than reasoned about — played, took an object, moved a scene on, reloaded
the page as a player closing the app, and pressed Continue. The scene, its choices,
the carried object with its image, the whole visible stream and the take narration
all came back.

The decision is the one the section was waiting on, and the reasoning that settled
it is that **there was nothing to build**. One automatic bookmark per storyworld is
rewritten on every live event, so the playhead is always current; the title card
reads it and offers Continue instead of Start; and a live event carries the full
variable state, the object deltas and the object messages, so resuming a live event
resumes everything. Two repair paths already exist and needed no work:

- `findLiveEventFromBookmarkWithExistingDestination` walks backwards when a bookmark
  points at an event the author has since deleted.
- `updateEngineDefaultWorldCollectionData` carries a save across an author's version
  bump — it copies the bookmarked live event forward under the new version with
  variables reconciled and deltas for deleted objects pruned, then repoints the
  bookmark. Without it the `version` filter in `getRecentLiveEvents` would strand
  every existing player on update.

- [x] Loading and saving a game state — automatic, forward-only, verified
- [ ] ~~Multiple storyworld bookmarks~~ — **decided against**

**Why multiple bookmarks were dropped, and what it would cost to revisit.** A
reloadable save is a rewind with extra steps, and rewind is refused on principle in
"Not included" below. Named forward-only runs were designed as the compromise —
several playthroughs in parallel, none of them rewindable — and dropped once it was
clear the automatic save already covers the actual want.

If it is ever revisited, the expensive part is **not** the bookmarks table, which
already carries a `title` and already has an unused `getBookmarks`. It is that
**the event stream is not assembled by walking the chain**. `getRecentLiveEvents`
queries `[worldId+updated]` — the world's most recently updated live events — and
slices around the current one; nothing reads `next` at all. Two runs in one world
would therefore interleave in the stream, and it would look plausible while being
wrong. Making them separate needs a `runId` on every live event and a filter in
that query (optional and unindexed, so no migration — absent means the original
run), and then it spreads: `getLiveEventInitial` returns one shared
`___initial___<worldId>` event, so Restart inside a second run lands on the first
run's beginning; a new run needs its own starting event cloned from it; and
`resetWorld` wipes every live event for the world.

## 6. Features whose fields section 3 already migrated

**Done.** All three were fields with no behaviour and no way to set them; none
needed a migration, and the work was interface plus, for scope, the runtime
semantics.

- [x] Character relationship mapping — `components/RelationshipManager`, opened
      from the storyworld outline's title bar. The same two-column shape as the
      recipe editor, which is what `DESIGN.md` §10 asked for: a relationship is a
      labelled edge between two entities that belongs to neither, exactly like a
      recipe. **Editor-only** — never compiled into an exported storyworld — so the
      panel says so, and points at the optional variable as the way to make one
      matter in play. The hook reads both ends, because a relationship names a
      character in `from` or `to` and reading one would show a character half its
      own relationships.
- [x] Storyworld cover image — set from a Cover panel in the storyworld's
      properties, shown on the dashboard card and above the title in the engine.
- [x] Scoped variables — `VARIABLE_SCOPE.SCENE` resets a variable to its initial
      value on entering its scene, set from the variable manager.
      **`DESIGN.md` §11 was wrong about the trigger** and is corrected there: a live
      event's type comes from the destination event's type, so entering a scene is
      not a `JUMP` live event and keying off one reset nothing. The test is that the
      destination's `sceneId` differs from the one just left.

## 7. Presentation

Depends on nothing above and benefits from there being more to present.

**The six items are two groups, and the split decides the order.** Choice modals,
notifications and inline choices already have everything they persist — the first
two from section 3's migration, the third because section 2 established that an
inline choice costs no schema at all — so each is interface work, exactly as all of
section 6 was. Transitions, custom backgrounds and animated images had no fields
anywhere; the design pass they needed disproved the "one shared migration" premise.

**Done, and none of the three needed a migration or even a version bump.** The
design pass turned on one realisation: `esg-asset://`'s protocol handler serves any
path, so the fixed-per-kind extension only matters because callers *build* the URL
from the kind. Keep every new asset WebP and the whole extension invariant holds —
which collapsed the risky asset-model rework the "one migration" plan assumed.
Transitions and custom colours became optional `World` fields extending 0.8.0 the
way `Variable.description` extended 0.7.0; the background became a WebP asset kind
mirroring the cover; and animated images became an import-pipeline change with no
field at all. See `CLAUDE.md`, "Presentation: transitions, colours, background and
animation".

- [x] Transitions — `World.transition` (FADE, SLIDE, NONE), set from a Transitions
      panel in the storyworld's properties. FADE is the default an unset world had;
      NONE is the author's opt-out and a reduced-motion player animates for none of
      them. `engine/src/lib/transition.ts` is the shared resolution, covered by
      `src/__tests__/transition.test.ts`.
- [x] Custom backgrounds and colors — `World.themeColors` ({ background, text,
      accent }) layered over the player's theme as inline custom properties on
      `#runtime` (never a generated stylesheet, per the PWA-export constraint), and
      `World.backgroundAssetId`, a new `WORLD_BACKGROUND` asset kind filled behind
      the reading column. `engine/src/lib/themeColors.ts` derives the properties,
      covered by `src/__tests__/themeColors.test.ts`.
- [x] Animated images — an animated WebP event image skips the cropper and is
      stored as its original bytes rather than flattened to its first frame by the
      canvas re-encode. `isAnimatedWebP` reads the VP8X animation flag, covered by
      `src/__tests__/animatedWebP.test.ts`. GIF and APNG stay out — each would need
      a second extension per kind, which the read-site invariant forbids.
- [x] Choice modals — a **Choices** panel on the storyworld sets the default and one
      on a CHOICE event overrides it, offering List, Row and Modal. See `CLAUDE.md`,
      "How a set of choices is offered".
      *(Interface work only, as section 3 intended. Two things it needed that were
      not obvious: `choicePresentation` was missing from `Installer`'s
      `WORLD_INFO_FIELDS`, so the compiled field never reached a component and the
      storyworld setting did nothing; and the modal is portalled to `#renderer`,
      because absolutely positioned where it is declared it covered only the current
      event's own block. `CHOICE_PRESENTATION.INLINE` is a **row layout for the whole
      set** and is not the inline choices feature — the editor labels it Row.)*
- [x] Storyworld notifications — `Path.notification`, set from the Notification
      panel at the bottom of a path's properties and said in the story stream when
      the path is crossed. See `CLAUDE.md`, "Path notifications".
      *(The presentation question `DESIGN.md` §12 left open — "a transient line" —
      was decided as a line in the stream rather than a toast, so it reuses
      `EngineLiveEventData.messages` and the `NARRATION` styling the object beats
      already have. That is why it cost no new engine state, no theme token and no
      dismissal rule. The engine's own `ErrorNotification` was **not** generalised
      as `ROADMAP.md` proposed: it is gated behind `engine.isComposer` and styled
      only in `engine-editor.less`, so a player in an exported PWA has never seen
      it, and turning a debug affordance into an authoring surface would have meant
      building the player-facing half from nothing.)*
- [x] Inline choices — `/` → **Inline Choice** in the event content editor puts a
      choice inside the prose instead of in the list beneath it. See `CLAUDE.md`,
      "Inline choices".
      *(Costs no schema, as section 2 decided. **The bookkeeping it predicted was
      not needed**: deleting the node un-inlines the choice rather than deleting
      it, so the row stays in `choices`, its id stays in `Event.choices`, the list
      offers it again and its paths still lead somewhere — there is no orphan to
      diff for. What it needed instead was the export path: a choice cannot be
      baked to text the way a character reference is, since whether its path is
      open depends on the state the player arrives with, so it survives export as
      a placeholder span and the engine's player branch of `EventContent` gained
      the `replace` map it had never needed before.)*

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

## 10. The editor in a browser

Serve the whole editor from a URL, so an author can write without installing
anything. Independent of everything above and of any schema change.

This is also the answer to the platform gap rather than a nice-to-have. Windows
builds cross-compile from Linux fine — verified, `npx electron-builder build --win`
drives Wine and produces an NSIS installer, and the only thing that ever blocked it
was `assets/icon.ico` having been regenerated at a single 16x16 (electron-builder
requires 256 and fails *after* packaging succeeds, so it looks like a build bug and
is an asset bug). **macOS is the one that cannot be done from here**: `dmg` needs
macOS-only tooling and notarization needs a submission to Apple, and without
notarization Gatekeeper refuses to open the app at all rather than warning. A
browser build serves mac authors without owning a Mac.

**Two thirds of the work is already done, in two different senses.** The
Storyteller engine in `engine/` is *already* a browser PWA, so the runtime half is
proven. And the library is already **IndexedDB via Dexie** — not files — so the data
layer runs in a browser unchanged. `localStorage` is used for exactly one thing in
this repo (`esg-ui-scale`) and is the wrong home for a storyworld: synchronous,
strings only, ~5 MB.

**There is one seam, and it already exists.** All 25 renderer modules do
`import { ipcRenderer } from 'electron'`, and `electron.vite.config.ts` aliases
`electron` to a single shim, `src/lib/electronRenderer.ts`. A web build swaps that
alias for a browser adapter; the 25 call sites are untouched. The surface it has to
implement is nine functions behind 13 IPC handlers:

| module | what the renderer actually uses |
| --- | --- |
| `ipcRenderer` | `invoke` ×25, `send` ×9, `on` ×8, `removeAllListeners`, `removeListener` |
| `shell` | `openExternal` ×8, `openPath` ×1 |
| `webFrame` | `setZoomFactor` ×3 |
| `clipboard` | `readText` ×1 |

The renderer imports no `fs`, `path` or `os` anywhere — all of that is in
`src/main.ts`. (Mind that most `clipboard.*` hits in a naive grep are the *scene
map* clipboard on `ComposerContext`, not Electron's.)

- [ ] **Browser adapter behind the `electron` alias.** Also has to answer
      `PLATFORM`: `App` gates its entire tree on `app.platform` arriving over IPC,
      so an adapter that does not send it renders a blank page.
- [ ] **Assets as Blobs in IndexedDB**, handed out as `URL.createObjectURL` —
      replacing `SAVE_ASSET`, `GET_ASSET`, `LIST_ASSETS`, `REMOVE_ASSET` and
      `RESTORE_ASSET`. This *deletes* a documented problem: blob URLs are seekable
      because the browser knows the length, so the `Accept-Ranges` / 206 /
      unseekable-MP3 handling described in `CLAUDE.md` has nothing to do here.
- [ ] **Decide the import interchange.** `IMPORT_WORLD_ASSETS` copies from an
      `assets` directory *beside* the chosen JSON, and a browser file input gives
      one file with no siblings. Either `showDirectoryPicker()` (Chromium and Edge
      only — no Firefox, no Safari) or **change the interchange to a single ZIP**.
      The ZIP is the better answer and is better for humans too, but it is a format
      decision and belongs with section 2's thinking rather than being made in
      passing.
- [ ] **Export without a main process.** Both JSON and PWA export currently go
      through `EXPORT_WORLD_START`. JSON becomes a `Blob` plus `<a download>`; PWA
      becomes fetch `engine-dist` as static assets, run the same replacement, emit a
      ZIP. The replacement logic is already near-pure and tested (`lib/precache.ts`,
      `lib/compiler/format`), so this is plumbing rather than rewriting.
- [ ] **Chrome that has no browser equivalent.** Drop the window controls and the
      native menu. For UI scale, CSS `zoom` on `:root` does scale antd's compiled
      pixels — which is precisely what `CLAUDE.md` records a `--ui-scale` custom
      property could *not* do, so the browser gets the thing the desktop build
      could not have.
- [ ] **Storage durability, which is not optional.** Origin storage is *evicted*:
      Safari clears it after roughly seven days without a visit, Chromium evicts
      under pressure. Someone's half-written novel can vanish with no warning and no
      recovery. `navigator.storage.persist()`, a visible "last exported" indicator
      and nagging automatic export are load-bearing features of a browser build, not
      extras. This is also the honest argument for keeping the desktop build the
      recommended one and the browser build the try-it-now door.

**Rejected: a PHP backend with logins.** Considered and dropped. Recorded because
the reasoning outlives the idea: shared PHP hosting cannot hold a WebSocket
(mod_php dies per request), so real-time collaboration was never on the table, and
the useful version was a snapshot store with `If-Match`/409 optimistic
concurrency — which is backup and single-author continuation, not teamwork. Two
findings are worth keeping if it is ever revisited. Scene-level check-out is the
natural lock because a `Path` never crosses a scene boundary and only a `Jump`
does, so two authors in two scenes cannot collide on events, choices, inputs or
paths. But characters, variables and assets are **world**-scoped, which scene locks
would not protect — and a variable rename silently breaks every template
expression written against the old title, because expressions resolve variables by
title rather than by id. Nothing reports that; the prose just renders as an ERROR
span.

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
small map of definition to count, which keeps resuming a save trivially correct.

A charged battery and an empty one are two definitions, not one battery in two
states. That is why you can hold three charged and two empty as two stacks with
two counts, and why using the wrong one in the flashlight does nothing unless a
recipe says otherwise — recipes are keyed to specific definitions, so behaviour is
authored rather than simulated. The cost is authoring effort: several battery
states across several devices means several recipes, which is what makes filtering
in the recipe editor worth building properly.

**No timing, and not only for simplicity.** The engine stores a complete state
snapshot on every live event, which is what makes resuming a save correct.
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
- **Storyworld reverse/rewind. Decided against, not merely unscheduled.** The
  original authors wanted it — `ROADMAP.md` calls it the highest value per hour on
  its page — and it is nearly free, because `EngineLiveEventData` already carries
  `prev`, `next` and a full state snapshot per event. It is still not being built,
  on a design principle rather than a cost estimate: **a decision the player has
  taken is final.** That is how the text adventures this owes its shape to
  behaved, it is what makes a choice worth pausing over, and a world that can be
  un-chosen is a world where nothing was ever really at stake. A mistake ends the
  run and the run starts again.

  This is already the engine's behaviour, not a change to it:
  `ENGINE_LIVE_EVENT_TYPE.GAME_OVER` and `RESTART` exist, and `restartWorld` sits
  next to the loopback button in `EventChoices.tsx`. So there is nothing to
  remove — the item is closed rather than deferred.

  **Do not "simplify" the live event chain on the strength of this.** Three
  shipped things need `prev` and the per-event state snapshot, and none of them is
  rewind:

  - **The loopback button.** `EventChoices.tsx`'s `loopback()` requires
    `liveEvent.prev && liveEvent.origin` to resubmit the origin path. That is an
    *authored* return along a path the author drew (`CHOICE_LOOPBACK`), which is
    the opposite of a rewind: it is a decision, not the undoing of one.
  - **Resuming a save whose destination was deleted.**
    `findLiveEventFromBookmarkWithExistingDestination` (`engine/src/lib/api.ts:293`)
    walks `prev` until it finds an event that still exists, so editing a world does
    not strand a player mid-story.
  - **Patching a save forward on a version bump.**
    `updateEngineDefaultWorldCollectionData` rebuilds live event state from the
    current variables and carries old values across.

  The snapshots were never built *for* rewind; rewind was noticed as cheap
  *because* they exist. See also the note on save/load in section 5, which this
  principle also bears on.
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

## What the 0.7.1 archive contained

A second archive marked 0.7.1 was compared against this repository's initial
commit in full. Recorded here because the answer is mostly "nothing", and that is
worth being able to look up rather than re-derive.

It is a **version-string release**. `schema/0.7.1.json` and `types/0.7.1.ts` are
byte-identical to the 0.7.0 pair; `upgrade/0.7.1.ts` returns its input field for
field. Fourteen of the twenty changed source files are nothing but the
`types/0.7.0` → `types/0.7.1` import path change against that identical file.

### Taken

- `LICENSE`, the full GPLv3 text. This repository had only the copyright line, so
  the license the source is released under was recorded nowhere. Verified verbatim
  FSF text, no project-specific insertions.
- `CREDITS`, naming the founders. Copied unaltered.
- The `RobotSerif.txt` → `roboto-serif-ofl.txt` rename, which also fixes the
  missing "o" and matches `inter-ofl.txt` beside it.
- The 0.7.1 schema version, on both the import and export sides — see
  [The import upgrade chain](CLAUDE.md) for the two places upstream's own
  implementation of it is wrong.

### Deliberately not taken

- **`ErrorModal.tsx`**, the release's only new feature, does not work. It is
  `import React from 'React'`, which does not resolve on a case-sensitive
  filesystem; its antd `Modal` has no `onCancel` or `onOk`, so nothing can dismiss
  it; and **nothing anywhere dispatches `SHOW_ERROR_MODAL`**, so it never appears.
  `AppContext` gained the state and the two actions for it. Unfinished work, not a
  feature — though it does record that the authors intended a global error surface,
  which this app still lacks.
- **Both `v11.ts` files**, as written. See CLAUDE.md: `version(10)` instead of
  `version(11)` replaces v10's migration outright. A corrected `version(11)` is
  what landed here.
- **The widened `< 0.7.1` upgrade gate**, which pushes a 0.7.0 file back through
  the non-idempotent `v070Upgrade`. Also in CLAUDE.md.
- **`.gitattributes`.** Theirs is a strict subset of this repository's, missing
  `*.ttf` and `*.mp3` among others — which is why **their binaries are the
  corrupted ones and ours are intact**, the reverse of what a newer archive
  suggests. `engine/data/0-7-test/assets/b604aaa6-….mp3` is 4 bytes short and is
  exactly ours with CRLF collapsed to LF; `engine/public/fonts/RobotoSerif.ttf` is
  8 bytes short, `0d 0d 0a` here against `0a` there, 14709 CR bytes against 14701.
  Neither file was copied.
- **`CONTRIBUTING`**, whose entire content is the string `WIP`.
- The `AppMenu` deletion was not applied, so that dead `#137` component and the
  `menuOpen`/`modalOpen` state it uses are still here. Harmless, still unrendered
  beyond `App.tsx`, and available as a cleanup.
