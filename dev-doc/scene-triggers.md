# Scene triggers — spec (not yet built)

**Status: design.** Nothing in this document is implemented yet. It is the plan
to review before any code is written, in the same spirit as `DESIGN.md`: decide
the shape here, then build against it.

## What it is

A **scene trigger** fires an action the moment a variable condition becomes true,
without the player taking a specific path. v1 has exactly one action — **play a
one-shot sound** — because that is the capability the engine does not already
have. Setting a variable, jumping, and ending are all expressible today with a
conditional path; a sound fired reactively is not.

The motivating case: a `moves` counter incremented `+1` on each movement path in
an office scene. After enough moves the author already shows "the phone is
ringing" text and offers an "answer" choice (variable condition on an event
variant). A trigger adds the missing half — a bell actually rings once, for
immersion — and stops when the player answers.

## The core insight: edge-triggered, and the state is already persisted

A variable in this engine only ever changes because a path was crossed (path
effects) or an object was taken/combined. Both funnel through `applyVariableSets`
(`engine/src/lib/state.ts:120`), which runs inside `gotoNextLiveEvent`. **A
variable cannot cross a threshold between live events**, so a trigger never needs
a polling watcher — it is evaluated once per transition, at the same point the
scene-scope reset and path notification already run
(`engine/src/components/LiveEvent.tsx:155-187`).

A trigger fires on the **rising edge** of its condition — false last event,
true now — not on every event while the condition holds. This single rule
delivers both things the author asked for:

- **Plays once.** It does not re-ring while `moves >= 6` stays true.
- **Resettable, for free.** Author gates the condition the same way the
  disappearing text is gated — `moves >= 6 && phoneAnswered == false`. Answering
  sets `phoneAnswered = true`, the condition falls to false, and any later design
  that makes it rise again (a second call) rings again. **No explicit reset
  action, no "played" flag to manage** — the author writes a condition, exactly
  like the conditional text they already write.

The edge needs the previous truth value. **That value is already on disk:** every
live event persists its post-effect variable state
(`EngineLiveEventData.state`, `engine/src/types/index.ts:750`). Evaluation reads
the departing live event's stored `state` (re-read at
`engine/src/components/LiveEvent.tsx:108`) for the "before", and the freshly
computed `nextState` for the "after". **No new persisted field, no Dexie
migration for the edge state.** The only thing that needs storing is the trigger
definitions themselves.

## Data model

Triggers are an inline array on the scene — like recipe effects and object
placements, an unindexed property, so **no Dexie version bump** (the v12 note in
`engine/src/lib/db/v12.ts:11-18`: Dexie declares indexes, not shapes).

```ts
// reuse the existing condition tuple — VariableCompare, engine/src/types/index.ts:550
//   [variableId, COMPARE_OPERATOR_TYPE, value, VARIABLE_TYPE]
export interface TriggerData {
  id: ElementId
  compare: VariableCompare   // the "when"
  sound: ElementId           // mp3 asset id — the "do" (one action, v1)
}

// on Scene / SceneData / EngineSceneData:
triggers?: TriggerData[]
```

One condition per trigger in v1 (no `ALL`/`ANY` group — that is a path concept
and a trigger with two conditions can be split into two triggers, or deferred).

## The seams (add the field five places)

Adding an engine-visible field to the scene, following the `Variable.description`
precedent (optional field, no schema version bump):

| seam | file | change |
| --- | --- | --- |
| editor type | `src/data/types.ts:283` (`Scene`) | add `triggers?: TriggerData[]` |
| engine authoring type | `engine/src/types/index.ts:360` (`SceneData`) | add `triggers?` |
| **engine runtime type** | `engine/src/types/index.ts:801` (`EngineSceneData`) | add `triggers?` — the runtime shape, easy to miss |
| **compiler pick** | `src/lib/compiler/format.ts:162` | `['audio', 'children', 'id']` → add `'triggers'`, or the field never reaches the engine |
| transport type | `src/lib/transport/types/0.8.0.ts` (`SceneData`) | add optional `triggers?` |
| transport schema | `src/lib/transport/schema/0.8.0.json:688` (`scenes` block) | add optional `triggers` array; **the `_` block is `additionalProperties: false`, so an unnamed exported field makes the app refuse to import its own export** |

The schema `TriggerData` mirrors the `conditions` entry's `compare` (a 4-tuple,
`prefixItems`) plus a `sound` string and an `id` string. `triggers` is optional,
so worlds written before the field import unchanged. Add coverage to
`src/__tests__/validateWorldData.test.ts` (a named-and-valid trigger imports; an
unknown extra property is still rejected).

**No schema version bump.** 0.8.0 stays 0.8.0 — same call the description field
made. `AppContext.version` does not move.

## Evaluation (runtime)

In `gotoNextLiveEvent` (`engine/src/components/LiveEvent.tsx:69-263`), after
`nextState` is computed (post effects + scene reset, `:155-170`) and before/at
the point the new live event is saved (`:191-217`):

1. Resolve the **destination event's scene** and read its `triggers` (compiled
   into `EngineSceneData`). Only that scene's triggers evaluate — this is a
   *scene* feature, active while the player is in it.
2. `prevState` = the departing live event's stored `state` (already re-read at
   `:108`). `nextState` = the value just computed.
3. For each trigger, evaluate its `compare` against both with the existing pure
   evaluator `variableCompareHolds` (`engine/src/lib/state.ts:57`). Treat its
   three-valued result — `boolean | undefined` — as: `undefined` → **not** true.
4. **Rising edge** = `nextHolds === true && prevHolds !== true` → collect
   `trigger.sound`.
5. Hand the collected sound ids to the mixer as a **transient** signal (below).

`variableCompareHolds` is currently only called from `isPathOpen`
(`engine/src/lib/api.ts:1497`), i.e. reactively to a path crossing. This adds a
second caller; the evaluator itself is unchanged.

### Scene-entry semantics (a known, accepted edge)

Rising edge is evaluated across the transition regardless of scene boundary. If
the player **enters** the office with the condition already true (e.g. a non-scene
counter already past threshold), `prevHolds` is true, so **no rising edge, no
fire**. For a `SCENE`-scoped counter this never arises — the counter resets to 0
on entry (`resetSceneScopedVariables`, `engine/src/lib/state.ts:193`), the
condition is false on the entering event, and the first qualifying move inside the
scene is the rising edge. v1 documents this rather than special-casing "fire on
entry".

## Playback (the one genuinely new runtime primitive)

The mixer (`engine/src/lib/hooks/useAudioMixer.ts`) runs two persistent,
cross-fading tracks — SCENE and EVENT (`:421-458`) — each driven by an
`AudioProfile` (`[assetId, looping]`). It has **no API for an arbitrary one-shot**
independent of scene/event audio. That is the work.

A trigger sound is a **fire-and-forget parallel `Howl`**: howler/WebAudio mixes
any number of sources, so the bell plays *over* the ambient and event tracks with
no interaction between them. Design:

- On the transient fire signal, for each sound id: create
  `new Howl({ src, autoplay: true, html5: false })` and let it self-dispose on
  `'end'` / `'stop'`.
- **It MUST go through `resumeAudioContext()` first** (`:54-78`). This is bug
  class 5: a `play()`/`fade()` issued against a suspended context reports success
  and produces silence forever. The existing tracks all resume before playing
  (`:185`, `:226`, `:249`); the one-shot has to as well.
- **URL resolution differs by target** and is why the one-shot player belongs
  *inside* or beside `useAudioMixer`, where the resolver already lives:
  - **Exported PWA:** synchronous — `assets/content/${id}.mp3` (`:428-432`).
  - **Composer preview:** the async devtools round-trip — dispatch
    `GET_ASSET_URL` and play on the `RETURN_ASSET_URL` reply
    (`:353-401`, `:317-351`). Same machinery scene/event audio already uses.
- **Ducking is out of scope for v1** — the bell plays at full volume over the
  scene rather than ducking it. The `onEnd`/duck plumbing (`:300-315`, `:457`)
  exists if a later version wants the scene to dip while the bell rings.

### Why the fire signal is transient, not a live-event field

If the fired sounds were stored on the live event and played on render, a
**resume** would re-ring the bell — the bookmarked live event is re-rendered on
reload, and a fresh install does not run `gotoNextLiveEvent`. So the sound ids are
a transient in-memory signal (engine context state, or a one-shot event on the
existing engine↔composer bus), consumed once and cleared. `gotoNextLiveEvent`
only runs on a real transition, so a resume stays silent while the persisted
`state` still drives correct edge detection for the *next* transition.

## Editor UI (scope for v1)

- A **Triggers** panel in the **scene's** properties (where scene `audio` is
  edited today). Per trigger: a condition row (reuse the condition builder from
  `ElementProperties/PathProperties`) plus a sound picker.
- The sound picker is the audio `AssetsModal` (the same picker behind scene/event
  audio), storing **only** the asset id — no looping flag; a trigger sound is
  always a one-shot.
- Deleting a variable must cascade into scene triggers that reference it, the
  same way `removeVariable` already clears conditions/effects/inputs
  (`CLAUDE.md`, variable manager section). A trigger's `compare.variableId` is a
  fifth writer of a variable id — it belongs in that cascade.

## Explicitly out of scope for v1

- **World-scoped triggers.** Scene-scoped only, per the counter use case.
- **Other actions** (set variable / jump / end game). Cheap follow-ons, but each
  is already expressible with a conditional path, so deferred. If added later,
  the runtime primitives exist: `applyVariableSets` (set), `findDestinationEvent`
  + `gotoNextLiveEvent` (jump), the `ending`/STORY_OVER path (end).
- **Multi-condition triggers** (`ALL`/`ANY`). One condition each for now.
- **Scene ducking** while a trigger sound plays.

## Test plan

- **Pure:** rising-edge detection — `false→true` fires, `true→true` does not,
  `true→false` re-arms, `false→false` silent; `undefined` compare (ordering op on
  a STRING) treated as not-true. A NUMBER holding `0` handled correctly (the
  falsy-substitution family of bugs). New `src/__tests__/sceneTriggers.test.ts`.
- **Transport:** a scene with a trigger round-trips export→import; the schema
  rejects an unknown extra property (`validateWorldData.test.ts`).
- **Runtime (must be an exported PWA — the composer reinstalls on open):** the
  bell rings once when the counter crosses; stays silent while held; rings again
  after the condition falls and rises; a resume of a bookmarked playthrough does
  **not** re-ring. Verify audio actually advances (`Howler.ctx.state`,
  `_howls[…].seek()`), not just that `play()` returned — bug class 5.

## Open decisions for review

1. **Fire signal transport** — engine-context state vs. reusing the
   `ENGINE_DEVTOOLS_LIVE_EVENTS` bus. Context is simpler and works identically in
   PWA and composer; the bus is composer-only. Leaning context.
2. **Multiple sounds in one transition** — if two triggers rise on the same
   event, play both in parallel (WebAudio allows it) vs. cap at one. Leaning
   "play both".
3. **Sound picker reuse** — confirm the audio `AssetsModal` can return a bare
   asset id without the looping-flag wrapper, or whether a thin variant is needed.
