import { LibraryDatabase } from '../db'
import { v4 as uuid } from 'uuid'

import { ElementId, WorldId, StudioId, ObjectCondition } from '../data/types'

export async function getObjectCondition(
  studioId: StudioId,
  conditionId: ElementId
) {
  try {
    return await new LibraryDatabase(studioId).getObjectCondition(conditionId)
  } catch (error) {
    throw error
  }
}

export async function getObjectConditionsByWorldRef(
  studioId: StudioId,
  worldId: WorldId
): Promise<ObjectCondition[]> {
  try {
    return await new LibraryDatabase(studioId).getObjectConditionsByWorldRef(
      worldId
    )
  } catch (error) {
    throw error
  }
}

export async function getObjectConditionsByPathRef(
  studioId: StudioId,
  pathId: ElementId
): Promise<ObjectCondition[]> {
  try {
    return await new LibraryDatabase(studioId).getObjectConditionsByPathRef(
      pathId
    )
  } catch (error) {
    throw error
  }
}

export async function saveObjectCondition(
  studioId: StudioId,
  condition: ObjectCondition
): Promise<ElementId> {
  if (!condition.id) condition.id = uuid()

  try {
    return await new LibraryDatabase(studioId).saveObjectCondition(condition)
  } catch (error) {
    throw error
  }
}

export async function removeObjectCondition(
  studioId: StudioId,
  conditionId: ElementId
) {
  try {
    await new LibraryDatabase(studioId).removeObjectCondition(conditionId)
  } catch (error) {
    throw error
  }
}
