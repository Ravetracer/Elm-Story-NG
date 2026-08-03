import { getLibraryDatabase } from '../db'
import { v4 as uuid } from 'uuid'

import {
  COMPARE_OPERATOR_TYPE,
  ElementId,
  Condition,
  WorldId,
  StudioId
} from '../data/types'

export async function getCondition(studioId: StudioId, conditionId: ElementId) {
  try {
    return await getLibraryDatabase(studioId).getCondition(conditionId)
  } catch (error) {
    throw error
  }
}

export async function getConditionsByWorldRef(
  studioId: StudioId,
  worldId: WorldId
): Promise<Condition[]> {
  try {
    return await getLibraryDatabase(studioId).getConditionsByWorldRef(worldId)
  } catch (error) {
    throw error
  }
}

export async function getConditionsByRouteRef(
  studioId: StudioId,
  pathId: ElementId,
  countOnly?: boolean
): Promise<number | Condition[]> {
  try {
    return await getLibraryDatabase(studioId).getConditionsByPathRef(
      pathId,
      countOnly || false
    )
  } catch (error) {
    throw error
  }
}

export async function getConditionsByVariableRef(
  studioId: StudioId,
  variableId: ElementId
): Promise<Condition[]> {
  try {
    return await getLibraryDatabase(studioId).getConditionsByVariableRef(
      variableId
    )
  } catch (error) {
    throw error
  }
}

export async function saveCondition(
  studioId: StudioId,
  condition: Condition
): Promise<ElementId> {
  if (!condition.id) condition.id = uuid()

  try {
    return await getLibraryDatabase(studioId).saveCondition(condition)
  } catch (error) {
    throw error
  }
}

export async function saveConditionCompareOperatorType(
  studioId: StudioId,
  conditionId: ElementId,
  newCompareOperatorType: COMPARE_OPERATOR_TYPE
) {
  try {
    await getLibraryDatabase(studioId).saveConditionCompareOperatorType(
      conditionId,
      newCompareOperatorType
    )
  } catch (error) {
    throw error
  }
}

export async function saveConditionValue(
  studioId: StudioId,
  conditionId: ElementId,
  newValue: string
) {
  try {
    await getLibraryDatabase(studioId).saveConditionValue(
      conditionId,
      newValue
    )
  } catch (error) {
    throw error
  }
}

export async function removeCondition(
  studioId: StudioId,
  conditionId: ElementId
) {
  try {
    await getLibraryDatabase(studioId).removeCondition(conditionId)
  } catch (error) {
    throw error
  }
}
