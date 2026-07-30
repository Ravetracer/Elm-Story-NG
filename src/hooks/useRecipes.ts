import { LibraryDatabase } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'

import { ElementId, WorldId, StudioId, Recipe } from '../data/types'

const useRecipes = (
  studioId: StudioId,
  worldId: WorldId,
  deps?: any[]
): Recipe[] | undefined => {
  const recipes = useLiveQuery(
    () => new LibraryDatabase(studioId).recipes.where({ worldId }).toArray(),
    deps || [],
    undefined
  )

  if (recipes) recipes.sort((a, b) => (a.title > b.title ? 1 : -1))

  return recipes
}

/**
 * Every recipe naming an object, on **either** side.
 *
 * Filtered in memory rather than by index: a recipe's inputs and outputs are
 * arrays of objects, which a Dexie multi-entry index cannot reach into, and a
 * derived array of ids kept beside them would be a duplicate of authored data.
 * Recipe counts are in the tens.
 */
const useRecipesByObjectRef = (
  studioId: StudioId,
  worldId: WorldId,
  objectId?: ElementId,
  deps?: any[]
): Recipe[] | undefined => {
  const recipes = useRecipes(studioId, worldId, deps)

  if (!recipes || !objectId) return undefined

  return recipes.filter(
    (recipe) =>
      recipe.inputs.some((input) => input.objectId === objectId) ||
      recipe.outputs.some((output) => output.objectId === objectId)
  )
}

export { useRecipesByObjectRef }

export default useRecipes
