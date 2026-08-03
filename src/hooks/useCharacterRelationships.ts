import { getLibraryDatabase } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'

import {
  CharacterRelationship,
  ElementId,
  StudioId,
  WorldId
} from '../data/types'

const useCharacterRelationships = (
  studioId: StudioId,
  worldId: WorldId,
  deps?: any[]
): CharacterRelationship[] | undefined => {
  const relationships = useLiveQuery(
    () =>
      getLibraryDatabase(studioId).characterRelationships
        .where({ worldId })
        .toArray(),
    deps || [],
    undefined
  )

  if (relationships) relationships.sort((a, b) => (a.title > b.title ? 1 : -1))

  return relationships
}

/**
 * Every relationship touching one character, from **either** end.
 *
 * Two queries rather than one, because `from` and `to` are separate indexes and a
 * relationship names the character in exactly one of them. Reading only `from`
 * would show a character half its own relationships — the half an author happened
 * to enter in that direction — which is the "either side of the relationship"
 * requirement `TODO.md` set for object recipes and which applies here for the same
 * reason.
 */
const useCharacterRelationshipsByCharacter = (
  studioId: StudioId,
  characterId?: ElementId,
  deps?: any[]
): CharacterRelationship[] | undefined =>
  useLiveQuery(
    async () => {
      if (!characterId) return undefined

      const database = getLibraryDatabase(studioId)

      const [from, to] = await Promise.all([
        database.characterRelationships.where({ from: characterId }).toArray(),
        database.characterRelationships.where({ to: characterId }).toArray()
      ])

      // a relationship from a character to itself is authorable and would
      // otherwise appear twice
      const seen = new Set<ElementId>()

      return [...from, ...to]
        .filter((relationship) =>
          seen.has(relationship.id as ElementId)
            ? false
            : seen.add(relationship.id as ElementId)
        )
        .sort((a, b) => (a.title > b.title ? 1 : -1))
    },
    deps || [],
    undefined
  )

export { useCharacterRelationshipsByCharacter }

export default useCharacterRelationships
