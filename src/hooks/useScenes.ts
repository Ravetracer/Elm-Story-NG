import { getLibraryDatabase } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'

import { StudioId, Scene, WorldId, ElementId } from '../data/types'

// See the note on useWorld: the ids are optional so callers never have to guard
// the call itself, which would change hook order between renders.
const useScenes = (
  studioId: StudioId | undefined,
  worldId: WorldId | undefined,
  deps?: any[]
): Scene[] | undefined => {
  const scenes = useLiveQuery(
    async () => {
      if (!studioId || !worldId) return undefined

      return await getLibraryDatabase(studioId).scenes
        .where({ worldId })
        .toArray()
    },
    deps || [],
    undefined
  )

  // TODO: sort by how user has ordered them in the editor?
  // TODO:...or don't sort and let editor track order?
  if (scenes) scenes.sort((a, b) => (a.title > b.title ? 1 : -1))

  return scenes
}

const useScene = (
  studioId: StudioId | undefined,
  sceneId: ElementId | undefined | null,
  deps?: any[]
): Scene | undefined =>
  useLiveQuery(
    async () => {
      if (!studioId) return undefined

      return await getLibraryDatabase(studioId).scenes
        .where({ id: sceneId || '' })
        .first()
    },
    deps || [],
    undefined
  )

export { useScene }

export default useScenes
