import { LibraryDatabase, LIBRARY_TABLE } from '../db'
import { v4 as uuid } from 'uuid'

import {
  ElementId,
  WorldId,
  StudioId,
  WorldObject,
  ObjectPlacement
} from '../data/types'

export async function getObject(studioId: StudioId, objectId: ElementId) {
  try {
    return await new LibraryDatabase(studioId).getObject(objectId)
  } catch (error) {
    throw error
  }
}

export async function getObjectsByWorldRef(
  studioId: StudioId,
  worldId: WorldId
): Promise<WorldObject[]> {
  try {
    return await new LibraryDatabase(studioId).getObjectsByWorldRef(worldId)
  } catch (error) {
    throw error
  }
}

export async function saveObject(
  studioId: StudioId,
  object: WorldObject
): Promise<ElementId> {
  if (!object.id) object.id = uuid()

  try {
    return await new LibraryDatabase(studioId).saveObject(object)
  } catch (error) {
    throw error
  }
}

/**
 * Removes the object and everything naming it — recipes, object conditions, and
 * placement gates on other objects. The editor states those consequences before
 * calling this, the way it does for a variable.
 */
export async function removeObject(studioId: StudioId, objectId: ElementId) {
  try {
    await new LibraryDatabase(studioId).removeObject(objectId)
  } catch (error) {
    throw error
  }
}

export async function saveObjectTitle(
  studioId: StudioId,
  objectId: ElementId,
  title: string
) {
  try {
    await new LibraryDatabase(studioId).saveElementTitle(
      objectId,
      LIBRARY_TABLE.OBJECTS,
      title
    )
  } catch (error) {
    throw error
  }
}

/**
 * Replaces the whole array, because a placement has no id to address it by. The
 * caller reads, edits and passes the full set — the same contract as
 * `Scene.children`, and the same lost-update hazard: two concurrent edits of one
 * object's placements will have the last write win.
 */
export async function saveObjectPlacements(
  studioId: StudioId,
  objectId: ElementId,
  placements: ObjectPlacement[]
) {
  try {
    const database = new LibraryDatabase(studioId),
      object = await database.getObject(objectId)

    return await database.saveObject({ ...object, placements })
  } catch (error) {
    throw error
  }
}
