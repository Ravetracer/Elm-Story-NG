import { getLibraryDatabase } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'

import { ElementId, WorldId, StudioId, WorldObject } from '../data/types'

const useObjects = (
  studioId: StudioId,
  worldId: WorldId,
  deps?: any[]
): WorldObject[] | undefined => {
  const objects = useLiveQuery(
    () => getLibraryDatabase(studioId).objects.where({ worldId }).toArray(),
    deps || [],
    undefined
  )

  if (objects) objects.sort((a, b) => (a.title > b.title ? 1 : -1))

  return objects
}

// takes an optional id and returns undefined for an absent one, so a component
// can call it above an early return without changing hook order
const useObject = (
  studioId: StudioId,
  objectId?: ElementId,
  deps?: any[]
): WorldObject | undefined =>
  useLiveQuery(
    () =>
      getLibraryDatabase(studioId).objects
        .where({ id: objectId || '' })
        .first(),
    deps || [],
    undefined
  )

export { useObject }

export default useObjects
