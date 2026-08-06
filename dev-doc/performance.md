# Performance — scene loading

Measured cost of opening the largest scene, the root cause, and ranked fixes.
Companion to [scene-loading.md](scene-loading.md), which has the code anchors.

## How to reproduce the measurement

1. Start clean: `NO_DEVTOOLS_EXTENSION=true npm run dev:debug`
   (the DevTools extension puts a second retention leak on top of any
   measurement — `CLAUDE.md`, "Debug by reading the DOM").
2. Navigate: studio **Indie** → world **Das Archiv der Erinnerungen** →
   Composer. IDs: studio `2ad64925-…`, world `0d7e0598-…`, scene
   **Fr. Wittgenstein** `e0e5e271-…` (27 events / 28 edges — the largest).
3. The scratchpad profilers (session 2026-08-06) drive it over CDP:
   `scene-open-perf.mjs` (single cold open), `reopen.mjs` (close/open ×N),
   `open-trend.mjs`, `switch2.mjs`. They live in the session scratchpad, not the
   repo; `scripts/devtools/scenemap-perf.mjs` is the committed pan/zoom one.

**Outline caveat:** rows carry no element id in the DOM and scene names collide
with their parent folder (a folder "Fr. Wittgenstein" holds a scene
"Fr. Wittgenstein"). The scene row is the one bearing the child-count badge / a
caret whose children are events. Coordinate-clicking is fragile — clicks land on
the expand caret and toggle folders. Prefer the badge/caret disambiguation.

## Measured (2026-08-06, dev, clean app)

**Cold open of Fr. Wittgenstein:**

| metric | value |
| --- | --- |
| time to first node | ~314 ms |
| time to settle (27 nodes, quiet) | ~1.8 s |
| main-thread block (long tasks) | **~1060 ms** across 3 long tasks |
| **logger calls emitted** | **~2,200 per open** |
| graph rebuilds (elements effect) | 2 |
| highlightElements runs | 5 |

**Close/reopen ×5** (`reopen.mjs`): open-block **134 → 65 → 0 → 0 → 0 ms** — no
block-time degradation; opens get *cheaper* as IndexedDB warms. But **~2,200
logger calls fire on every open** regardless, and heap drifts **98 → 184 MB**
across the five cycles (retention, consistent with the rc-dock tab cache below).

## What the numbers mean

- **The ~2,200 logger calls are dev-only.** `src/lib/logger.ts:19`
  (`silent = process.env.NODE_ENV === 'production'`) silences all `logger.*` in
  packaged builds. So the console storm inflates the **dev** experience (and every
  CDP-attached measurement) but not the shipped PWA. It is nonetheless a faithful
  **proxy** for the re-render/query fan-out: ~2,200 log-emitting operations run on
  *every* open, warm or cold.
- **The real (prod-relevant) cost is the ~1 s main-thread block on a cold open**,
  caused by the N+1 fan-out and per-node work, not by logging.
- **The 4 s from the prior session** is consistent with dev + the DevTools
  extension leak + an app that had accumulated open scene tabs (see compounding).

## Root cause (code-confirmed — see scene-loading.md for anchors)

1. **N+1 Dexie live-query fan-out** — ~220–350 concurrent live queries for one
   27-node scene. Per-node redundancy dominates:
   - `EventNode.tsx:607` `usePathsBySceneRef` — the whole scene's paths re-queried
     **per node** (×27), duplicating the one scene-level query at `index.tsx:536`.
   - `EventSnippet.tsx:93-94` `useVariables` + `useCharacters` — the full
     world-scoped lists fetched **per node** (×54 total).
   - `EventNode.tsx:577` redundant per-node `useEvent` (data already in the
     scene-level `useEventsBySceneRef`).
   - `PathEdge.tsx:96-105` — 2 count queries per edge (×54).
2. **Per-node serialization storm** — `EventSnippet.tsx:104` debounced preview is
   `leading:true`, so on mount **all 27 nodes serialize at once**
   (`lib/serialization.ts`), each issuing async IPC per embedded node:
   `GET_ASSET` per image (`:52`), `getCharacter` (`:67`), `getChoice` (`:98`).
3. **react-flow render amplifier** — every `EventNode` subscribes to the entire
   `state.nodes` (`EventNode.tsx:582`,`:609`); react-flow's size measurement
   mutates it, re-rendering all 27 nodes together, each re-spawning its query set.
4. **The elements effect replaces the whole `elements` array** on any
   `events`/`paths`/`jumps` emission (`index.tsx:1649`), remounting every node;
   `useEvents.ts:19` re-sorts by title and churns the array reference.

## Compounding with open tabs (the "gets slower the longer I work" symptom)

rc-dock uses `cached: true` (`ElementEditor/index.tsx:382`), so **every scene
ever opened stays mounted** behind its tab and re-renders on selection. Prior
investigation (recorded in `CLAUDE.md`, "A Dexie instance is a connection"):
**18 panes open → one outline click blocks ~1330 ms, vs ~340 ms with tabs
closed.** This session's heap drift across reopen cycles is consistent with that
retention. Closing tabs recovers the cost. *(Not cleanly re-derived to a 12-tab
number this session — UI automation of the nested outline proved too fragile;
the mechanism and the prior number stand.)*

## Ranked fixes (cheapest win first — none applied yet, 2026-08-06)

1. **Lift the world-scoped queries out of `EventSnippet`.** `useVariables` /
   `useCharacters` return identical data for all 27 nodes — query once in
   `SceneMap` and pass down (context or prop). Removes ~54 live queries. Low risk.
2. **Drop the per-node `usePathsBySceneRef`** (`EventNode.tsx:607`); the scene's
   paths are already loaded once at `index.tsx:536` — thread them down. Removes
   ~27 whole-scene path queries.
3. **Remove the redundant per-node `useEvent`** (`EventNode.tsx:577`); use the
   event object already in the scene-level array. Removes ~27 queries.
4. **Make inactive cached SceneMap tabs bail out of rendering** (or unmount them)
   — the single biggest win for the compounding symptom, and the "next real win"
   already flagged in `CLAUDE.md`.
5. **Stagger / cap the per-node serialization** (drop `leading:true`, or batch the
   IPC) so 27 nodes don't hit the asset/character/choice IPC simultaneously.

Verify each with a before/after `scene-open-perf.mjs` run on the same scene, same
outline expansion. Numbers from the running app, not from reasoning.
