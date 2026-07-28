import { LibraryDatabase } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'

import { ElementId, Condition, WorldId, StudioId } from '../data/types'

const usePathConditions = (
  studioId: StudioId,
  worldId: WorldId,
  deps?: any[]
): Condition[] | undefined => {
  const conditions = useLiveQuery(
    () => new LibraryDatabase(studioId).conditions.where({ worldId }).toArray(),
    deps || [],
    undefined
  )

  return conditions
}

const usePathCondition = (
  studioId: StudioId,
  conditionId: ElementId,
  deps?: any[]
): Condition | undefined =>
  useLiveQuery(
    () =>
      new LibraryDatabase(studioId).conditions
        .where({ id: conditionId })
        .first(),
    deps || [],
    undefined
  )

const usePathConditionsByPathRef = (
  studioId: StudioId,
  pathId: ElementId,
  deps?: any[]
): Condition[] | undefined =>
  useLiveQuery(
    () => new LibraryDatabase(studioId).conditions.where({ pathId }).toArray(),
    deps || [],
    undefined
  )

const usePathConditionsByPathRefs = (
  studioId: StudioId,
  routeIds: ElementId[],
  deps?: any[]
): Condition[] | undefined =>
  useLiveQuery(
    () =>
      new LibraryDatabase(studioId).conditions
        .where('routeId')
        .anyOf(routeIds)
        .toArray(),
    deps || [],
    undefined
  )

// See the note on useWorld: the ids are optional so callers never have to guard
// the call itself, which would change hook order between renders.
const usePathConditionsCountByPathRef = (
  studioId: StudioId | undefined,
  pathId: ElementId | undefined,
  deps?: any[]
): number | undefined =>
  useLiveQuery(
    async () => {
      if (!studioId || !pathId) return undefined

      return await new LibraryDatabase(studioId).conditions
        .where({ pathId })
        .count()
    },
    deps || [],
    undefined
  )

export {
  usePathCondition,
  usePathConditionsByPathRef,
  usePathConditionsByPathRefs,
  usePathConditionsCountByPathRef
}

export default usePathConditions
