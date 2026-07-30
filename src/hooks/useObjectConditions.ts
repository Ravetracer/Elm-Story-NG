import { LibraryDatabase } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'

import { ElementId, StudioId, ObjectCondition } from '../data/types'

/**
 * The object gates on a path.
 *
 * A separate collection from `conditions` rather than a variant row in it, because
 * `isPathOpen` drops a condition it cannot resolve and `[].every()` is true — so a
 * shared row shape would have every reader that missed it *open* the path. See
 * `DESIGN.md`.
 */
const useObjectConditionsByPathRef = (
  studioId: StudioId,
  pathId?: ElementId,
  deps?: any[]
): ObjectCondition[] | undefined =>
  useLiveQuery(
    () =>
      new LibraryDatabase(studioId).objectConditions
        .where({ pathId: pathId || '' })
        .toArray(),
    deps || [],
    undefined
  )

export { useObjectConditionsByPathRef }

export default useObjectConditionsByPathRef
