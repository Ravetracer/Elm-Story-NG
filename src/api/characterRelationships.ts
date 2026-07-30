import { LibraryDatabase, LIBRARY_TABLE } from '../db'
import { v4 as uuid } from 'uuid'

import {
  ElementId,
  WorldId,
  StudioId,
  CharacterRelationship
} from '../data/types'

export async function getCharacterRelationship(
  studioId: StudioId,
  relationshipId: ElementId
) {
  try {
    return await new LibraryDatabase(studioId).getCharacterRelationship(
      relationshipId
    )
  } catch (error) {
    throw error
  }
}

export async function getCharacterRelationshipsByWorldRef(
  studioId: StudioId,
  worldId: WorldId
): Promise<CharacterRelationship[]> {
  try {
    return await new LibraryDatabase(
      studioId
    ).getCharacterRelationshipsByWorldRef(worldId)
  } catch (error) {
    throw error
  }
}

export async function getCharacterRelationshipsByCharacterRef(
  studioId: StudioId,
  characterId: ElementId
): Promise<CharacterRelationship[]> {
  try {
    return await new LibraryDatabase(
      studioId
    ).getCharacterRelationshipsByCharacterRef(characterId)
  } catch (error) {
    throw error
  }
}

export async function saveCharacterRelationship(
  studioId: StudioId,
  relationship: CharacterRelationship
): Promise<ElementId> {
  if (!relationship.id) relationship.id = uuid()

  try {
    return await new LibraryDatabase(studioId).saveCharacterRelationship(
      relationship
    )
  } catch (error) {
    throw error
  }
}

export async function removeCharacterRelationship(
  studioId: StudioId,
  relationshipId: ElementId
) {
  try {
    await new LibraryDatabase(studioId).removeCharacterRelationship(
      relationshipId
    )
  } catch (error) {
    throw error
  }
}

export async function saveCharacterRelationshipTitle(
  studioId: StudioId,
  relationshipId: ElementId,
  title: string
) {
  try {
    await new LibraryDatabase(studioId).saveElementTitle(
      relationshipId,
      LIBRARY_TABLE.CHARACTER_RELATIONSHIPS,
      title
    )
  } catch (error) {
    throw error
  }
}
