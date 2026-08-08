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

  // Sorted by title for the flat lists and pickers that read this (element
  // dropdowns, the managers). The storyworld outline does NOT use this order:
  // createWorldOutlineTreeData builds each node's children from the stored
  // `children` arrays — the author's manual arrangement — so this sort neither
  // sets nor fights outline order.
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
