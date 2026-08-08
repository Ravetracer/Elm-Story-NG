import { getLibraryDatabase } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'

import { StudioId, Event, WorldId, ElementId } from '../data/types'

const useEvents = (
  studioId: StudioId,
  worldId: WorldId,
  deps?: any[]
): Event[] | undefined => {
  const events = useLiveQuery(
    () => getLibraryDatabase(studioId).events.where({ worldId }).toArray(),
    deps || [],
    undefined
  )

  // Sorted by title for the flat lists and pickers that read this (element
  // dropdowns, the managers). The storyworld outline does NOT use this order:
  // createWorldOutlineTreeData builds each node's children from the stored
  // `children` arrays — the author's manual arrangement — so this sort neither
  // sets nor fights outline order.
  if (events) events.sort((a, b) => (a.title > b.title ? 1 : -1))

  return events
}

// See the note on useWorld: the ids are optional so callers never have to guard
// the call itself, which would change hook order between renders.
const useEventsBySceneRef = (
  studioId: StudioId | undefined,
  sceneId: ElementId | undefined | null,
  deps?: any[]
): Event[] | undefined => {
  const events = useLiveQuery(
    async () => {
      if (!studioId || !sceneId) return undefined

      return await getLibraryDatabase(studioId).events
        .where({ sceneId })
        .toArray()
    },
    deps || [],
    undefined
  )

  return events
}

const useEvent = (
  studioId: StudioId | undefined,
  eventId: ElementId | undefined | null,
  deps?: any[]
): Event | undefined =>
  useLiveQuery(
    async () => {
      if (!studioId) return undefined

      return await getLibraryDatabase(studioId).events
        .where({ id: eventId || '' })
        .first()
    },
    deps || [],
    undefined
  )

export { useEventsBySceneRef, useEvent }

export default useEvents
