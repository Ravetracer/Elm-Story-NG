import { LibraryDatabase, LIBRARY_TABLE } from '../db'
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
    return await new LibraryDatabase(studioId).getVariable(variableId)
  } catch (error) {
    throw error
  }
}

export async function getVariablesByWorldRef(
  studioId: StudioId,
  worldId: WorldId
): Promise<Variable[]> {
  try {
    return await new LibraryDatabase(studioId).getVariablesByWorldRef(worldId)
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
    return await new LibraryDatabase(studioId).saveVariable(variable)
  } catch (error) {
    throw error
  }
}

export async function removeVariable(
  studioId: StudioId,
  variableId: ElementId
) {
  try {
    await new LibraryDatabase(studioId).removeVariable(variableId)
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
    await new LibraryDatabase(studioId).saveElementTitle(
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
    return await new LibraryDatabase(studioId).saveVariableType(
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
    return await new LibraryDatabase(studioId).saveVariableScope(
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
    return await new LibraryDatabase(studioId).saveVariableDescription(
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
    return await new LibraryDatabase(studioId).saveVariableInitialValue(
      variableId,
      initialValue
    )
  } catch (error) {
    throw error
  }
}
