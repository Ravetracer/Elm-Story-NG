import { getLibraryDatabase } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'

import { ElementId, WorldId, StudioId, Variable } from '../data/types'

const useVariables = (
  studioId: StudioId,
  worldId: WorldId,
  deps?: any[]
): Variable[] | undefined => {
  const variables = useLiveQuery(
    () => getLibraryDatabase(studioId).variables.where({ worldId }).toArray(),
    deps || [],
    undefined
  )

  // Sorted by title for the variable manager's list and the condition/effect
  // pickers. There is no manual variable order to preserve, so alphabetical is
  // the order everywhere variables are listed.
  if (variables) variables.sort((a, b) => (a.title > b.title ? 1 : -1))

  return variables
}

const useVariable = (
  studioId: StudioId,
  variableId?: ElementId,
  deps?: any[]
): Variable | undefined =>
  useLiveQuery(
    () =>
      getLibraryDatabase(studioId).variables
        .where({ id: variableId || '' })
        .first(),
    deps || [],
    undefined
  )

export { useVariable }

export default useVariables
