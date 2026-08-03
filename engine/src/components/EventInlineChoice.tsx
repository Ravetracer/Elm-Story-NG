import React, { useCallback, useContext } from 'react'

import { useLiveQuery } from 'dexie-react-hooks'

import {
  ElementId,
  EngineLiveEventData,
  EngineLiveEventResult,
  StudioId
} from '../types'

import { LibraryDatabase } from '../lib/db'
import { getChoicesFromEventWithOpenPath } from '../lib/api'

import { EngineContext } from '../contexts/EngineContext'

import { PathProcessor } from './Event'

/**
 * A choice offered inside the prose — the same choice the list beneath it would
 * have offered, said as part of the sentence.
 *
 * It resolves its own title and its own open path rather than being handed them by
 * `EventChoices`, which is a deliberate duplication of one lookup: this is rendered
 * from inside `EventContent`'s html-react-parser `replace` callback, several layers
 * below and with no way to receive the sibling's live query result. One choice is a
 * cheap query, and the alternative is threading state through the parser.
 *
 * Three states, and only the first is clickable:
 *
 * - **open** — the choice has a path whose conditions hold. A `<button>`, not a
 *   styled span, because it is one: it takes focus and answers the keyboard for
 *   free, which a clickable span in the middle of a paragraph would not.
 * - **closed** — no open path. Rendered as plain prose rather than a dead link, so
 *   the sentence still reads. `blockedChoicesVisible` in the composer is the one
 *   exception, since an author asking to see blocked choices means it.
 * - **past** — this live event already has a result, so the reader is looking at
 *   history. Nothing in the stream's past is clickable.
 *
 * A choice that has been deleted renders as nothing at all. Deleting a choice does
 * not reach into the document that mentions it — see `serializeDescendantToText`
 * in the editor's `lib/serialization.ts` for why the repair is not attempted.
 */
const EventInlineChoice: React.FC<{
  studioId: StudioId
  choiceId?: ElementId
  liveEvent: EngineLiveEventData
  liveEventResult?: EngineLiveEventResult
  onSubmitPath?: PathProcessor
}> = ({
  studioId,
  choiceId,
  liveEvent,
  liveEventResult,
  onSubmitPath
}) => {
  const { engine } = useContext(EngineContext)

  const { id: worldId } = engine.worldInfo ?? {}

  const choiceWithOpenPath = useLiveQuery(async () => {
    if (!choiceId) return undefined

    const choice = await new LibraryDatabase(studioId).choices.get(choiceId)

    if (!choice) return null

    const { openPaths } = await getChoicesFromEventWithOpenPath(
      studioId,
      [choice],
      liveEvent.state,
      // an author who has asked to see blocked choices has asked to see this one
      engine.devTools.blockedChoicesVisible ? true : false,
      worldId ? { worldId, liveEvent } : undefined
    )

    return { choice, openPath: openPaths[choice.id] }
  }, [studioId, choiceId, liveEvent, engine.devTools.blockedChoicesVisible])

  const submitChoice = useCallback(async () => {
    const openPath = choiceWithOpenPath?.openPath

    if (!openPath || !onSubmitPath || !choiceWithOpenPath) return

    await onSubmitPath({
      originId: liveEvent.origin,
      path: openPath,
      result: {
        id: choiceWithOpenPath.choice.id,
        value: choiceWithOpenPath.choice.title
      }
    })
  }, [choiceWithOpenPath, onSubmitPath, liveEvent.origin])

  // undefined is "still loading" and null is "no such choice"; neither has a title
  // to put in the sentence, and a placeholder would be a hole in the prose
  if (!choiceWithOpenPath) return null

  const { choice, openPath } = choiceWithOpenPath

  const past = liveEventResult !== undefined,
    open = openPath !== undefined && !past

  if (!open)
    return (
      <span
        className={`event-content-inline-choice event-content-inline-choice-closed${
          past ? ' event-content-inline-choice-past' : ''
        }`}
      >
        {choice.title}
      </span>
    )

  return (
    <button className="event-content-inline-choice" onClick={submitChoice}>
      {choice.title}
    </button>
  )
}

EventInlineChoice.displayName = 'EventInlineChoice'

export default EventInlineChoice
