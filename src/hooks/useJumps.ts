import { getLibraryDatabase } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'

import { ElementId, WorldId, StudioId, Jump } from '../data/types'

const useJumps = (
  studioId: StudioId,
  worldId: WorldId,
  deps?: any[]
): Jump[] | undefined => {
  const jumps = useLiveQuery(
    () => getLibraryDatabase(studioId).jumps.where({ worldId }).toArray(),
    deps || [],
    undefined
  )

  return jumps
}

// See the note on useWorld: the ids are optional so callers never have to guard
// the call itself, which would change hook order between renders.
const useJump = (
  studioId: StudioId | undefined,
  jumpId: ElementId | undefined | null,
  deps?: any[]
): Jump | undefined =>
  useLiveQuery(
    async () => {
      if (!studioId || !jumpId) return undefined

      return await getLibraryDatabase(studioId).jumps
        .where({ id: jumpId })
        .first()
    },
    deps || [],
    undefined
  )

const useJumpsBySceneRef = (
  studioId: StudioId,
  sceneId: ElementId,
  deps?: any[]
): Jump[] | undefined =>
  useLiveQuery(
    () => getLibraryDatabase(studioId).jumps.where({ sceneId }).toArray(),
    deps || [],
    undefined
  )

export { useJump, useJumpsBySceneRef }

export default useJumps
