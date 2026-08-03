import { getAppDatabase } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'

import { Studio, StudioId } from '../data/types'

const useStudios = (deps?: any[]): Studio[] | undefined => {
  const studios = useLiveQuery(
    () => getAppDatabase().studios.toArray(),
    deps || [],
    undefined
  )

  // sort alphabetical by studio title
  if (studios) studios.sort((a, b) => (a.title > b.title ? 1 : -1))

  return studios
}

const useStudio = (studioId: StudioId, deps?: any[]): Studio | undefined =>
  useLiveQuery(
    () => getAppDatabase().studios.where({ id: studioId }).first(),
    deps || [],
    undefined
  )

export { useStudio }

export default useStudios
