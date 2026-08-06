# Scene loading — click to render

How opening a scene in the Composer turns into a populated SceneMap, and where
the per-element cost multiplies. Verified against the code at the anchors below
(2026-08-06). See [performance.md](performance.md) for measured costs.

## The click-to-render chain

1. **Outline select** — `src/components/WorldOutline/index.tsx:457` `onSelect`
   (wired at `:1597`). A scene row (not event/jump) hits the branch at `:537`
   and dispatches `WORLD_OUTLINE_SELECT` (`:552-561`), setting
   `composer.selectedWorldOutlineElement` to the scene id.
2. **ElementEditor opens a tab** — `src/components/ElementEditor/index.tsx:329-412`.
   Effect keyed on `composer.selectedWorldOutlineElement.id` (`:412`) runs
   `findTabAndOpen()`. No existing tab for the scene → `dockLayout.dockMove(...)`
   (`:352`) with `content: getTabContent(studioId, sceneId, ELEMENT_TYPE.SCENE)`.
   **rc-dock uses `cached: true` (`:382`)** — every scene ever opened stays
   mounted behind its tab, keeping its live queries alive. This is the
   `CLAUDE.md` "cost rather than a leak" for inactive tabs.
3. **Tab mounts SceneMap** — `getTabContent` renders `<SceneMap studioId sceneId>`
   at `index.tsx:103` (toolbar `<SceneMapTools>` at `:100`).
4. **SceneMap** — `src/components/ElementEditor/SceneMap/index.tsx:518`. Scene-level
   hooks fire (`:534-537`), then the **elements effect** (`:1544`) builds
   react-flow nodes/edges and `setElements(...)` (`:1649`), mounting one
   `EventNode`/`JumpNode` per node and one `PathEdge` per edge.

## Data hooks (all Dexie `useLiveQuery`)

### Scene-level — fire once per SceneMap (`index.tsx:534-537`) — correct bulk queries
- `useJumpsBySceneRef` (`useJumps.ts:39`) — `jumps.where({sceneId})`
- `useScene` (`useScenes.ts:32`) — and again in `SceneMapTools` (`index.tsx:174`)
- `usePathsBySceneRef` (`usePaths.ts:31`) — all scene paths
- `useEventsBySceneRef` (`useEvents.ts:26`) — all scene events (**re-sorts by title
  every emission**, `useEvents.ts:19` → churns the array reference)

### The N+1 explosion — below, inside each node/edge

| component | ×count | queries | notes |
| --- | --- | --- | --- |
| `EventNode` | ×27 | `useEvent` `:577`, `useChoicesByEventRef` `:578`, `usePathsBySceneRef` `:607` | `useEvent` re-fetches data already in the scene-level query; `usePathsBySceneRef` re-queries **all 27 scene paths per node** |
| `EventSnippet` | ×27 | `useVariables` `:93`, `useCharacters` `:94` | full **world-scoped** collections, once per node |
| `EventPersonaPane` | ×≤27 | `useCharacter` `:22` | when persona set |
| `ChoiceRow` | ×choices | `useChoice` `:226`, `usePathsByChoiceRef` `:227` | 2/choice |
| `PathEdge` | ×27 | `usePathConditionsCountByPathRef`, `usePathEffectsCountByPathRef` `:96-105` | 2 count queries/edge = 54 |
| `EventCharacterRefGrid`/`CharacterPortrait` | ×refs | `useCharacter` `:22` | 1/character-ref |
| `InputRow` | ×inputs | `useInput`, `useVariable` `:463-464` | input events only |

**Rough total for a 27-event / 27-edge scene: ~220–350+ concurrent live
queries.** Three per-node offenders dominate:
- `EventNode.tsx:607` `usePathsBySceneRef` — 27 duplicate scene-wide path queries
- `EventSnippet.tsx:93-94` `useVariables` + `useCharacters` — 54 full-collection queries
- `EventSnippet.tsx:104-117` + `src/lib/serialization.ts` — per-node async
  content serialization (see below)

## The elements effect (`index.tsx:1544-1663`)

- **Guard** `:1547` — waits for `jumps && scene && events && paths`.
- **Deps** `:1651-1663` — `[jumps, scene?.id, events, paths, ready]`. `scene?.id`
  (not `scene`) is deliberate (`:1653-1658`) so viewport-transform writes don't
  rebuild the graph. But any change to the `events`/`paths`/`jumps` arrays
  rebuilds **all** nodes/edges.
- **Body** — `jumps.map` (`:1556`), `events.map` (`:1577`, reads
  `event.choices.length` `:1589`), `paths.map` (`:1626`), then one
  `setElements([...nodes, ...edges])` (`:1649`).
- **Cost** — the body is plain mapping; the expense is that it replaces the whole
  `elements` array identity on every emission, **remounting/re-rendering all 27
  EventNodes + 27 PathEdges**, each of which re-spawns its ~6-query fan-out. And
  `useEvents.ts:19` re-sorts → churns the `events` reference each time.

## Per-node render amplifier (react-flow)

`EventNode.tsx:582` and `:609` — **every EventNode subscribes to the entire
react-flow `state.nodes`** via `useStoreState`. When react-flow measures node
sizes on mount it mutates `state.nodes`, so all 27 nodes re-render together,
multiplying against each node's live-query set. Choices effect `:716-743` depends
on `scenePaths` which is a fresh `|| []` array each render (`:607`), so it re-runs
often.

## Per-node serialization (`EventSnippet.tsx` + `lib/serialization.ts`)

- `debouncedContentPreview` (`EventSnippet.tsx:104`, 1000ms, **`leading:true`**)
  → `eventContentToPreview` (`serialization.ts:128`) → `serializeDescendantToText`
  (`:18`) recursively over the slate content.
- Per node: `JSON.parse(content)` (`:133`), plus **async IPC/DB per embedded
  node**: `ipcRenderer.invoke(GET_ASSET)` per image (`:52`),
  `api().characters.getCharacter` per character node (`:67`),
  `api().choices.getChoice` per inline choice (`:98`).
- `leading:true` means the first call runs **immediately on mount for all 27
  nodes at once**, then `parseToHTML` (`EventSnippet.tsx:168`) parses the HTML.

## Not on the scene-open path

The slate `EventContent` editor (`index.tsx:89`) only mounts when
`editorTab.eventForEditing.visible` — opening an event for editing, not opening a
scene. Not part of the 4s unless the author is editing.

## Candidate fixes (unverified — measure first)

1. Drop the 27× `usePathsBySceneRef` in `EventNode` — pass scene paths down from
   the one scene-level query, or a context.
2. Drop the 54× `useVariables`/`useCharacters` in `EventSnippet` — the world's
   variable/character lists are identical for every node; lift to one query.
3. Remove the redundant per-node `useEvent` (`:577`).
4. Avoid full-array `state.nodes` subscription in `EventNode`.
5. Batch/limit the per-node serialization IPC storm on mount.
