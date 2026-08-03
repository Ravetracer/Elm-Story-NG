import { LIBRARY_TABLE, getLibraryDatabase } from '../db'
import { v4 as uuid } from 'uuid'

import { ElementId, WorldId, StudioId, Recipe } from '../data/types'

export async function getRecipe(studioId: StudioId, recipeId: ElementId) {
  try {
    return await getLibraryDatabase(studioId).getRecipe(recipeId)
  } catch (error) {
    throw error
  }
}

export async function getRecipesByWorldRef(
  studioId: StudioId,
  worldId: WorldId
): Promise<Recipe[]> {
  try {
    return await getLibraryDatabase(studioId).getRecipesByWorldRef(worldId)
  } catch (error) {
    throw error
  }
}

/**
 * Every recipe in the world that names this object on either side.
 *
 * Filtered in memory rather than through an index. A recipe's inputs and outputs
 * are arrays of objects, which Dexie's multi-entry index cannot reach into, and a
 * derived array of ids kept alongside them would be a duplicate of authored data.
 * Recipe counts are in the tens; if that ever stops being true, an index costs one
 * Dexie version and no shape change.
 */
export async function getRecipesByObjectRef(
  studioId: StudioId,
  worldId: WorldId,
  objectId: ElementId
): Promise<Recipe[]> {
  try {
    const recipes = await getLibraryDatabase(studioId).getRecipesByWorldRef(
      worldId
    )

    return recipes.filter(
      (recipe) =>
        recipe.inputs.some((input) => input.objectId === objectId) ||
        recipe.outputs.some((output) => output.objectId === objectId)
    )
  } catch (error) {
    throw error
  }
}

export async function saveRecipe(
  studioId: StudioId,
  recipe: Recipe
): Promise<ElementId> {
  if (!recipe.id) recipe.id = uuid()

  try {
    return await getLibraryDatabase(studioId).saveRecipe(recipe)
  } catch (error) {
    throw error
  }
}

export async function removeRecipe(studioId: StudioId, recipeId: ElementId) {
  try {
    await getLibraryDatabase(studioId).removeRecipe(recipeId)
  } catch (error) {
    throw error
  }
}

export async function saveRecipeTitle(
  studioId: StudioId,
  recipeId: ElementId,
  title: string
) {
  try {
    await getLibraryDatabase(studioId).saveElementTitle(
      recipeId,
      LIBRARY_TABLE.RECIPES,
      title
    )
  } catch (error) {
    throw error
  }
}
