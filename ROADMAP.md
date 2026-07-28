# Roadmap

The original authors' plan, from `Docs/roadmap.html` (archive.org capture, July
2022), re-grounded against the code as it actually stands. Their milestone names
are kept so the archived docs stay readable next to this file, but the ordering
within each group is by what the codebase makes cheap, not by their dates.

Each item records **what already exists**, since a surprising number are closer to
finished than the roadmap implies, and **what it touches**, since a few are gated
behind the two things in this repository that are expensive to change: the frozen
transport schemas (`src/lib/transport/types/*`, one per released version) and the
versioned IndexedDB migrations (`src/db/v*.ts`). Anything needing a new field on a
persisted element needs both, plus a new schema file and a new `v11`.

Read `CLAUDE.md` before starting any of these.

## Not planned

**REST API** and the **cloud app services** behind the original `1.0.0 — GA
Launch` are dropped. They existed to serve Elm Story Games' commercial platform;
that company is gone, and a private local-first Electron app has no client to
serve. **Connected storyworlds** is kept below but flagged, because the useful
half of it does not need a server.

## Corrections to the archived docs

These are wrong or stale relative to the code, and are cheap to settle.

- [ ] **`Docs/expressions.html` documents `=/=` as the inequality operator.** It
      has never worked: expressions are parsed with acorn, and `a =/= b` fails as
      an unterminated regular expression. The code only accepts `!=`. Either
      pre-translate `=/=` to `!=` before parsing, which is what the docs promise
      authors, or accept that `!=` is the syntax. Roughly an hour either way.
      Worth doing because a documented operator silently rendering as `ERROR` is
      the least forgivable kind of bug.
- [ ] **`Docs/expressions.html` omits method calls.** `{ name.upper() }` and
      `.lower()` work today via `gameMethods` in `lib/templates.ts` but are
      undocumented.
- [x] **Arithmetic in expressions.** `{ health + bonus * 2 }` with `+ - * / %`,
      nesting and parentheses. Was the `BinaryExpression` branch reporting
      "planned for a future release". Done; see `src/__tests__/templates.test.ts`.

## 0.8.0 — Storyteller Style

Presentation. The engine already owns a theme system (`ENGINE_THEME`, currently
`BOOK` and `CONSOLE`) and animates with react-spring, so most of this extends
machinery that is present rather than adding new machinery.

- [ ] **Transitions.** Cheapest item in this group. react-spring is already
      wired through `AcceleratedDiv`, and `useSpring` drives event and choice
      entry. This is exposing author-facing options for what is already animated,
      plus honouring `ENGINE_MOTION.REDUCED`, which the engine already threads
      everywhere.
- [ ] **Custom backgrounds and colors.** Extends `ENGINE_THEME` and the Less
      variables in `engine/assets/`. Watch the PWA export: `engine.less` and
      `engine-editor.less` are copied into `src/styles/` by `engine:sync` and are
      git-ignored, so author-chosen colours have to arrive as CSS custom
      properties set at runtime, not as generated stylesheets.
- [ ] **Storyworld cover image.** Needs a new field on `World`, which means a new
      transport schema, a `v11` migration and an `importWorldData` branch.
      Assets themselves are already handled: they live under `userData`, are
      served over `esg-asset://`, and are copied on import and export.
- [ ] **Animated images.** Assets are currently fixed to `.jpeg` for masks and
      `.webp` for content images, hardcoded in `GET_ASSET` and in the engine's
      URL building. Animated WebP would mostly work already; GIF would need the
      extension plumbing widened.
- [ ] **Inline videos.** A new content element in the Slate schema
      (`EventContentElement`), a new `ELEMENT_FORMATS` member, serialization in
      `lib/serialization.ts`, and asset handling for a new extension. Larger than
      the rest of this group.
- [ ] **Asset manager.** No UI exists; assets are only reachable by
      right-clicking a character mask. Needs a listing of what is under
      `userData/assets/<studioId>/<worldId>`, orphan detection against what the
      storyworld references, and deletion. Self-contained, no schema change.

## 0.9.0 — Smart Composition

Productivity. All three are editor-only, touch no persisted schema, and are
therefore unusually safe.

- [ ] **Content Editor: distraction-free mode.** Smallest item on this page. The
      content editor is already an absolutely positioned overlay
      (`.EventContent`), so this is largely hiding the surrounding dock panels.
- [ ] **Scene Map: cut, copy, paste, duplicate.** Operates on `events`, `paths`,
      `choices`, `inputs` and `conditions`/`effects` hanging off paths. The real
      work is id remapping: a pasted subtree needs fresh ids everywhere, and
      paths must be rewritten to point at the new ids rather than the originals.
      Straightforward but detail-heavy, and worth unit testing the remapper.
- [ ] **Scene Map: auto layout.** react-flow-renderer 9 has no built-in layout.
      Needs a layout pass (dagre or elk) writing back to each event's
      `composer.sceneMapPosX/Y`. Note `react-flow-renderer` is pinned at 9 by the
      React 17 constraint, so check any layout helper's peer requirements.
- [ ] **Storyworld Map.** A navigable view of folders, scenes and jumps above the
      Scene Map. New route and view; reuses `useFolders`/`useScenes`/`useJumps`.

## 1.X.0

Mixed. Two of these are much cheaper than their placement suggests, and two are
gated behind schema changes.

- [ ] **Storyworld reverse/rewind.** Far cheaper than it looks, and the highest
      value per hour on this page. `EngineLiveEventData` already carries `prev`,
      `next` and a **complete `state` snapshot per live event**, and the engine
      already renders a stream of past events with a loopback button. Stepping
      backwards is restoring a previous event's state and resetting
      `currentLiveEvent` — no schema change, no new persistence.
- [ ] **Multiple storyworld bookmarks.** The `bookmarks` table exists and is
      already keyed per world; today only one automatic bookmark is written, via
      `AUTO_ENGINE_BOOKMARK_KEY`. Needs named bookmarks and UI, not new storage.
- [ ] **Variable manager.** `WorldVariables` already lists, renames, retypes and
      sets initial values. This is search, filtering, usage counts and safe
      deletion. Note the existing type-change path already rewrites related
      conditions and effects (`db/index.ts` resets initial values per type), so
      follow that precedent rather than inventing a second one.
- [ ] **Storyworld notifications.** The engine has `ErrorNotification` and a
      `SHOW_ERROR_NOTIFICATION` action. This is generalising it to author-authored
      messages.
- [ ] **Inline choices.** Choices are separate elements rendered below event
      content. Inline means representing a choice inside the Slate document, so:
      a new content element, serialization, and a decision about whether the
      choice element owns the path or merely references an existing one. Design
      first, then implement.
- [ ] **Choice modals.** Presentation on top of the existing choice model.
      Depends on the transitions work above being in place first.
- [ ] **Character relationship mapping.** Characters already have `masks` and
      `refs`. Relationships between characters are new persisted data, so: new
      schema, `v11`, import branch. Design the shape before writing any of it,
      since it is the kind of model that is painful to change once storyworlds
      contain it.
- [ ] **Character inventory.** Overlaps heavily with **object variable type** and
      **scoped variables** below; doing inventory first would likely mean building
      a bespoke version of all three. Sequence it last of the four.
- [ ] **Scoped variables.** Variables are world-scoped today. Scoping them to a
      scene or an event means a scope field on the variable plus resolution rules
      wherever `WorldState` is assembled — which is the engine, the editor's
      expression evaluation, and `EventSnippet`. Schema change and migration.
- [ ] **Object variable type.** A new `VARIABLE_TYPE` member. The enum already has
      `STRING`, `NUMBER`, `BOOLEAN`, `IMAGE` and `URL`, but variable values are
      persisted as **strings** throughout, and the expression evaluator, the
      conditions comparison logic and the effects logic all assume that. An object
      type means either a serialization convention or widening the value type
      everywhere it is read. The largest single item on this page.
- [ ] **Connected storyworlds.** The half that works locally — jumping between two
      storyworlds in the same library — is feasible: jumps already carry a
      `[sceneId, eventId]` path and would need a world id. The half the original
      roadmap intended, worlds connected across the network, is part of the
      dropped cloud platform. Scope explicitly to the local half.

## Suggested order

If the aim is visible progress with the least risk of stranding the codebase
mid-change:

1. The two documentation corrections above, and distraction-free mode. Hours, not
   days.
2. Reverse/rewind, then multiple bookmarks. Both exploit data that is already
   persisted, and both are user-visible immediately.
3. Transitions, then custom backgrounds and colours. Extends existing machinery.
4. Scene Map copy/paste and auto layout. Editor-only, no schema risk, but the id
   remapper deserves tests.
5. Asset manager. Self-contained, and useful before any of the media features.
6. Anything requiring a `v11` migration, in one batch rather than one at a time:
   cover image, character relationships, scoped variables. Batching means one
   migration and one transport schema instead of three.
7. Object variable type and character inventory last, after scoped variables has
   settled how variable resolution works.
