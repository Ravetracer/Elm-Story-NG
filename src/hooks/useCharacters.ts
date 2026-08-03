import { getLibraryDatabase } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'

import { WorldId, StudioId, Character, ElementId, Event } from '../data/types'

const useCharacters = (
  studioId: StudioId,
  worldId: WorldId,
  deps?: any[]
): Character[] | undefined => {
  const characters = useLiveQuery(
    () => getLibraryDatabase(studioId).characters.where({ worldId }).toArray(),
    deps || [],
    undefined
  )

  if (characters) characters.sort((a, b) => (a.title > b.title ? 1 : -1))

  return characters
}

const useCharacter = (
  studioId: StudioId,
  characterId: ElementId | undefined | null, // undefined: loading, null: does not exist
  deps?: any[]
): Character | undefined | null =>
  useLiveQuery(
    async () =>
      (await getLibraryDatabase(studioId).characters.get(characterId || '')) ||
      null,
    deps || [],
    undefined
  )

const useCharacterEvents = (
  studioId: StudioId,
  characterId: ElementId | undefined | null,
  deps?: any[]
): Event[] | undefined =>
  useLiveQuery(
    async () => {
      const personaEvents = await getLibraryDatabase(studioId).events
        .where('persona')
        .equals(characterId || '')
        .toArray()

      const referenceEvents = await getLibraryDatabase(studioId).events
        .where('characters')
        .equals(characterId || '')
        .toArray()

      // elmstorygames/feedback#199
      const mergedEvents = [...personaEvents, ...referenceEvents],
        mergedEventIds = mergedEvents.map(({ id }) => id)

      return mergedEvents.filter(
        ({ id }, index) => !mergedEventIds.includes(id, index + 1)
      )
    },
    deps || [],
    undefined
  )

export { useCharacter, useCharacterEvents }

export default useCharacters
