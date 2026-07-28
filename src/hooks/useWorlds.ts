import { LibraryDatabase } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'

import { StudioId, World, WorldId } from '../data/types'

export enum WORLD_SORT {
  NAME = 'NAME',
  DATE = 'DATE'
}

const useWorlds = (
  studioId: StudioId,
  sortBy?: WORLD_SORT,
  deps?: any[]
): World[] | undefined => {
  const worlds = useLiveQuery(
    () => new LibraryDatabase(studioId).worlds.toArray(),
    deps || [],
    undefined
  )

  if (worlds) {
    switch (sortBy) {
      case WORLD_SORT.DATE:
        worlds.sort((a, b) =>
          a.updated && b.updated && a.updated < b.updated ? 1 : -1
        )
        break
      case WORLD_SORT.NAME:
      default:
        worlds.sort((a, b) => (a.title > b.title ? 1 : -1))
    }
  }

  return worlds
}

// The ids are optional so that callers with nothing selected yet can still call
// this unconditionally. Guarding the call instead changes hook order between
// renders, which is what react-hooks/rules-of-hooks reports.
const useWorld = (
  studioId: StudioId | undefined,
  worldId: WorldId | undefined,
  deps?: any[]
): World | undefined =>
  useLiveQuery(
    async () => {
      if (!studioId || !worldId) return undefined

      return await new LibraryDatabase(studioId).worlds
        .where({ id: worldId })
        .first()
    },
    deps || [],
    undefined
  )

export { useWorld }

export default useWorlds
