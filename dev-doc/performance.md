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

## Ranked fixes

### Done — 0.43.4 (commit `38b68bf`): fixes 1–3 in one change

`SceneMapDataContext.tsx` — the SceneMap runs the scene's path query, the world's
variable and character queries, and builds an events-by-id map **once**, and
publishes them. `EventNode` and `EventSnippet` consume the context instead of:
- `EventSnippet` `useVariables` + `useCharacters` (×27 → ×1 each)
- `EventNode` `usePathsBySceneRef` (×27 → 0; reuses the scene-level query)
- `EventNode` `useEvent` (×27 → 0; reads the events-by-id map)

The context value is memoised on `[paths, variables, characters, events]`, **not**
on the SceneMap's render, because the SceneMap re-renders on every zoom/pan/
selection (it subscribes to the react-flow store) — an unmemoised value would
re-render every consuming node on every wheel tick, worse than the queries it
replaces.

**Measured (same 27-node scene, cold):** per-open logger/render fan-out
**2204 → 170 lines (≈13×)**. Verified the scene still renders correctly — 27
nodes, portraits, character references, prose previews, choices all intact.

**Cold-open block time unchanged (~1060 ms).** This is the key finding: the block
is **not** the live-query fan-out. Removing ~130 live queries left the block
identical, so it is dominated by **react-flow initial node measurement + per-node
content serialization**, not data loading. What fixes 1–3 buy is far fewer live
queries and re-renders **per cached tab**, which is exactly what compounds as
scene tabs accumulate (compounding cost = per-tab work × open tabs).

### Open — the block-time levers (need react-flow work, do with live verification)

4. **The react-flow measurement amplifier — DONE in 0.43.5.** `EventNode.tsx`
   subscribed to the entire `state.nodes` twice (`useStoreState`, for `events` and
   `nodes`), used **only** inside event handlers (`validateConnection`, choice
   `onSelect`, add-choice). On mount, react-flow measures 27 nodes and mutates
   `state.nodes` each time, so every node re-rendered on every measurement — up to
   ~27×27 renders — each re-render re-firing that node's own effects
   (`choicesByEventRef` live query, `updateNodeInternals`). The fix: read the node
   list on demand instead of subscribing.

   - **The store is redux + react-redux, not easy-peasy/zustand** (the earlier note
     was wrong). react-flow-renderer 9.7.4 exports `useStore()`, which returns the
     redux `Store` instance and — being react-redux's `useStore` — **never
     subscribes and never re-renders**. Both subscriptions collapse to one
     `const store = useStore()`; the handlers read `store.getState().nodes` at call
     time. Reading fresh also drops a latent staleness the old code had
     (`nodes` was never in `validateConnection`'s dep array).
   - **Measured live** (Fr. Wittgenstein, close→reopen cold, dev, ×3–4 each; wall =
     time from outline click to 27 nodes in the DOM):

     | version | wall to 27 nodes | long-task ms |
     | --- | --- | --- |
     | old (subscription) | **~1465–1803 ms** | ~176–356 |
     | new (on-demand read) | **~677–1077 ms** | ~78–265 |

     Every new run beat every old run — a **~35–50 % (≈500–700 ms) drop in
     time-to-rendered-scene**. Long-task (main-thread block) time overlaps and is
     *not* a clean win: the block is dominated by react-flow's own node measurement
     and per-node serialization (#5), as this doc predicted. What the amplifier cost
     was **settling time** — spurious re-renders re-triggering per-node effects and
     Dexie round-trips, each below the 50 ms long-task threshold but serializing to
     push out convergence.
   - **Correctness verified live**: 27/27 nodes render (no dropped nodes — the
     `onlyRenderVisibleElements`/measurement regression class), and the changed
     handler path works end-to-end (clicking a choice row selects its node via
     `store.getState().nodes`, no exception).
5. **Stagger / cap the per-node serialization.** `EventSnippet` preview is
   `leading:true` so all 27 serialize on mount (`lib/serialization.ts`, per-node
   IPC). Spreading it across frames would break up the long task. Only worth it if
   profiling attributes a meaningful slice of the block to serialization vs
   measurement — confirm first (measure a small scene vs the big one; the block is
   per-node, so it scales with node count either way).

### Inactive-tab bailout — investigated and decided against (2026-08-08)

rc-dock keeps every opened scene tab mounted (`cached: true`), so a hidden SceneMap
re-renders on every `ComposerContext` dispatch. This was flagged as the "next real
win". It was measured after fixes 1–4 and the conclusion is **not worth the
trade-off at current cost** — recorded here so it is not re-investigated.

**Measured** (imported world, active scene Fr. Wittgenstein, a burst of 12 event
selections; each selection is a `ComposerContext` dispatch that fans out to every
mounted SceneMap). Long-task ms over the burst:

| open scene tabs | long-task ms / 12 selections |
| --- | --- |
| 1 | ~1383–1448 |
| 3 | ~1650–1743 |

So the **per-hidden-tab cost is ~10–15 ms per dispatch** (≈125–175 ms for 2 extra
tabs over 12 clicks). Fixes 1–4 already brought it down from the pre-optimization
~1330 ms/click era; it only becomes noticeable at high tab counts (~200 ms/dispatch
at ~18 tabs), and closing unused tabs already recovers it. Note the **dominant
cost is the active tab + outline fan-out** (~1400 ms / 12 selections with a *single*
tab), not the hidden tabs.

**Why the cheap "bail out but stay mounted" fix does not work.** The obvious
approach — return the same element reference for the react-flow subtree while
hidden so React skips reconciling it — does **not** stop the cost. The ~10–15 ms is
almost entirely `EventNode`/`ChoiceRow`/`JumpNode` re-rendering, and each of those
calls `useContext(ComposerContext)` directly (`EventNode.tsx:598`,
`EventNode.tsx:229`, …). React context propagation re-renders **every mounted
consumer** on every dispatch and **bypasses element-identity and `React.memo`
bailouts** — so freezing an ancestor element changes nothing for the deep
consumers. The only mechanisms that actually remove the cost are:

- **Unmount each hidden tab's react-flow view** (placeholder when
  `composer.selectedWorldOutlineElement.id !== sceneId` — a reliable "not the front
  tab" signal, since `ElementEditor.onLayoutChange:285-299` syncs the outline
  selection to the active dock tab both ways). Kills the per-tab cost, but switching
  back re-mounts react-flow and re-measures the graph — a few hundred ms instead of
  today's instant switch. A poor trade for a frequent action to save ~10–15 ms on
  another frequent action.
- **Split `ComposerContext`** so nodes subscribe only to the fields they need.
  Large, cross-cutting (29 consumers), and it barely helps: the fields nodes read
  are *selection* state, which changes on exactly the frequent dispatches.

**Decision: leave it.** Closing unused tabs (already the `CLAUDE.md` guidance) is the
pragmatic recovery. The performance case is closed at 0.43.5; reopen only if a real
workload makes the tab fan-out hurt.

Verify any future work with a before/after run on the same scene, same outline
expansion. Numbers from the running app, not from reasoning.
