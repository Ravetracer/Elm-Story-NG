import { LibraryDatabase } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'

import { Choice, ElementId, WorldId, StudioId } from '../data/types'

const useChoices = (
  studioId: StudioId,
  worldId: WorldId,
  deps?: any[]
): Choice[] | undefined => {
  const choices = useLiveQuery(
    () => new LibraryDatabase(studioId).choices.where({ worldId }).toArray(),
    deps || [],
    undefined
  )

  return choices
}

// the id is optional, as every other hook here takes it: a component cannot call
// this one conditionally, so an absent id has to be an answer of `undefined` rather
// than a reason not to ask. An inline choice element is the first caller that can
// legitimately have none.
const useChoice = (
  studioId: StudioId,
  choiceId?: ElementId,
  deps?: any[]
): Choice | undefined => {
  const choice = useLiveQuery(
    () =>
      choiceId
        ? new LibraryDatabase(studioId).choices.where({ id: choiceId }).first()
        : undefined,
    deps || [],
    undefined
  )

  return choice
}

const useChoicesByEventRef = (
  studioId: StudioId,
  eventId?: ElementId,
  deps?: any[]
): Choice[] | undefined => {
  const choices = useLiveQuery(
    () => new LibraryDatabase(studioId).choices.where({ eventId }).toArray(),
    deps || [],
    undefined
  )

  return choices
}

export { useChoice, useChoicesByEventRef }

export default useChoices
