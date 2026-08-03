import { v4 as uuid } from 'uuid'

import { getLibraryDatabase } from '../db'

import { Character, ElementId, StudioId, WorldId } from '../data/types'

export async function getCharacter(studioId: StudioId, characterId: ElementId) {
  try {
    return await getLibraryDatabase(studioId).getCharacter(characterId)
  } catch (error) {
    throw error
  }
}

export async function getCharactersByWorldRef(
  studioId: StudioId,
  worldId: WorldId
): Promise<Character[]> {
  try {
    return await getLibraryDatabase(studioId).getCharactersByWorldRef(worldId)
  } catch (error) {
    throw error
  }
}

export async function saveCharacter(studioId: StudioId, character: Character) {
  if (!character.id) character.id = uuid()

  try {
    return await getLibraryDatabase(studioId).saveCharacter(character)
  } catch (error) {
    throw error
  }
}

export async function removeCharacter(
  studioId: StudioId,
  characterId: ElementId
) {
  try {
    await getLibraryDatabase(studioId).removeCharacter(studioId, characterId)
  } catch (error) {
    throw error
  }
}
