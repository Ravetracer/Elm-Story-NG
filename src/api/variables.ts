import { LIBRARY_TABLE, getLibraryDatabase } from '../db'
import { v4 as uuid } from 'uuid'

import {
  ElementId,
  WorldId,
  StudioId,
  Variable,
  VARIABLE_TYPE,
  VARIABLE_SCOPE
} from '../data/types'

export async function getVariable(studioId: StudioId, variableId: ElementId) {
  try {
    return await getLibraryDatabase(studioId).getVariable(variableId)
  } catch (error) {
    throw error
  }
}

export async function getVariablesByWorldRef(
  studioId: StudioId,
  worldId: WorldId
): Promise<Variable[]> {
  try {
    return await getLibraryDatabase(studioId).getVariablesByWorldRef(worldId)
  } catch (error) {
    throw error
  }
}

export async function saveVariable(
  studioId: StudioId,
  variable: Variable
): Promise<ElementId> {
  if (!variable.id) variable.id = uuid()

  try {
    return await getLibraryDatabase(studioId).saveVariable(variable)
  } catch (error) {
    throw error
  }
}

export async function removeVariable(
  studioId: StudioId,
  variableId: ElementId
) {
  try {
    await getLibraryDatabase(studioId).removeVariable(variableId)
  } catch (error) {
    throw error
  }
}

export async function saveVariableTitle(
  studioId: StudioId,
  variableId: ElementId,
  title: string
) {
  try {
    await getLibraryDatabase(studioId).saveElementTitle(
      variableId,
      LIBRARY_TABLE.VARIABLES,
      title
    )
  } catch (error) {
    throw error
  }
}

export async function saveVariableType(
  studioId: StudioId,
  variableId: ElementId,
  type: VARIABLE_TYPE
) {
  try {
    return await getLibraryDatabase(studioId).saveVariableType(
      variableId,
      type
    )
  } catch (error) {
    throw error
  }
}

export async function saveVariableScope(
  studioId: StudioId,
  variableId: ElementId,
  scope: VARIABLE_SCOPE,
  scopeId: ElementId | undefined
) {
  try {
    return await getLibraryDatabase(studioId).saveVariableScope(
      variableId,
      scope,
      scopeId
    )
  } catch (error) {
    throw error
  }
}

export async function saveVariableDescription(
  studioId: StudioId,
  variableId: ElementId,
  description: string | undefined
) {
  try {
    return await getLibraryDatabase(studioId).saveVariableDescription(
      variableId,
      description
    )
  } catch (error) {
    throw error
  }
}

export async function saveVariableInitialValue(
  studioId: StudioId,
  variableId: ElementId,
  initialValue: string
) {
  try {
    return await getLibraryDatabase(studioId).saveVariableInitialValue(
      variableId,
      initialValue
    )
  } catch (error) {
    throw error
  }
}
