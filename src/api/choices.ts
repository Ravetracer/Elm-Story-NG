import { v4 as uuid } from 'uuid'

import { getLibraryDatabase } from '../db'

import { Choice, ElementId, WorldId, StudioId } from '../data/types'

export async function getChoice(studioId: StudioId, choiceId: ElementId) {
  try {
    return await getLibraryDatabase(studioId).getChoice(choiceId)
  } catch (error) {
    throw error
  }
}

export async function getChoicesByWorldRef(
  studioId: StudioId,
  worldId: WorldId
): Promise<Choice[]> {
  try {
    return await getLibraryDatabase(studioId).getChoicesByWorldRef(worldId)
  } catch (error) {
    throw error
  }
}

export async function saveChoice(studioId: StudioId, choice: Choice) {
  if (!choice.id) choice.id = uuid()

  try {
    return await getLibraryDatabase(studioId).saveChoice(choice)
  } catch (error) {
    throw error
  }
}

export async function removeChoice(studioId: StudioId, choiceId: ElementId) {
  try {
    await getLibraryDatabase(studioId).removeChoice(choiceId)
  } catch (error) {
    throw error
  }
}
