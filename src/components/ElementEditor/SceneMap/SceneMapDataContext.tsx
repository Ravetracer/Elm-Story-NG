/**
 * Scene-wide data shared by every node and edge in a SceneMap.
 *
 * Before this, each of a scene's event nodes independently subscribed to the
 * whole scene's paths (`usePathsBySceneRef`), the whole world's variables and
 * characters (`useVariables`/`useCharacters`) and re-fetched its own event
 * (`useEvent`) — data the SceneMap had already loaded once. On the imported
 * world's 27-node scene that was ~130 redundant Dexie live queries per open.
 *
 * The SceneMap now runs each of those queries once and publishes the result
 * here. The value is memoised on the query results (not on the SceneMap's
 * render), because the SceneMap re-renders on every zoom, pan and selection —
 * an unmemoised value would re-render every consuming node on every wheel tick,
 * which is worse than the per-node queries it replaces.
 */
import { createContext, useContext } from 'react'

import { Character, ElementId, Event, Path, Variable } from '../../../data/types'

export interface SceneMapData {
  // scene-wide, keyed by the SceneMap's sceneId. Defaulted to [] like the
  // per-node usePathsBySceneRef(...) || [] it replaces.
  scenePaths: Path[]
  // World-scoped, identical for every node in the scene. Left undefined while
  // loading — EventSnippet gates its preview on this exactly as it did when it
  // ran the queries itself, so it does not build a preview against empty state.
  variables: Variable[] | undefined
  characters: Character[] | undefined
  // the scene's events, by id — replaces the per-node useEvent. A missing entry
  // is undefined, matching useEvent's loading value.
  eventsById: Record<ElementId, Event>
}

const emptySceneMapData: SceneMapData = {
  scenePaths: [],
  variables: undefined,
  characters: undefined,
  eventsById: {}
}

export const SceneMapDataContext = createContext<SceneMapData>(
  emptySceneMapData
)

SceneMapDataContext.displayName = 'SceneMapDataContext'

export const useSceneMapData = (): SceneMapData =>
  useContext(SceneMapDataContext)

export default SceneMapDataContext
