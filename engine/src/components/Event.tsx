import React, { useCallback, useContext, useRef, useState } from 'react'
import useResizeObserver from '@react-hook/resize-observer'
import { useSpring } from 'react-spring'
import { useLiveQuery } from 'dexie-react-hooks'

import { findDestinationEvent, getLiveEventInitial, getEvent } from '../lib/api'
import { getLibraryDatabase } from '../lib/db'

import { partitionLiveEventMessages } from '../lib/state'

import {
  ElementId,
  ELEMENT_TYPE,
  EVENT_TYPE,
  EngineLiveEventData,
  EngineLiveEventMessageData,
  EngineLiveEventStateCollection,
  EngineEventData,
  EnginePathData,
  EngineLiveEventResult,
  ENGINE_LIVE_EVENT_MESSAGE_TYPE
} from '../types'
import {
  ENGINE_LIVE_EVENT_STORY_OVER_RESULT_VALUE,
  ENGINE_LIVE_EVENT_LOOPBACK_RESULT_VALUE,
  ENGINE_EVENT_PASSTHROUGH_RESULT_VALUE
} from '../lib'
import { INTERFACE_TEXT_KEY } from '../lib/interfaceText'

import { NextLiveEventProcessor } from './LiveEvent'

import { EngineContext, ENGINE_ACTION_TYPE } from '../contexts/EngineContext'

import EventCharacterMask from './EventCharacterMask'
import EventContent from './EventContent'
import EventChoices, { PassthroughIcon } from './EventChoices'
import EventInput from './EventInput'
import AcceleratedDiv from './AcceleratedDiv'
import { isTransitionImmediate } from '../lib/transition'
import { SettingsContext } from '../contexts/SettingsContext'

export type PathProcessor = ({
  originId,
  result,
  path,
  state
}: {
  originId?: ElementId
  result: EngineLiveEventResult
  path?: EnginePathData
  state?: EngineLiveEventStateCollection
}) => Promise<void>

/*
 * Takes `t` rather than calling useInterfaceText itself: it is a function that
 * returns JSX rather than a component, so it has no hook context of its own, and
 * both call sites are components that already have one.
 *
 * Only STORY_OVER is translated. The other values are either an icon or the text
 * the player themselves chose — a choice title, or their own typed input — and
 * none of those are the engine's words to change.
 */
export function translateLiveEventResultValue(
  value: string,
  t: (key: INTERFACE_TEXT_KEY) => string
) {
  let finalValue: JSX.Element

  switch (value) {
    case ENGINE_EVENT_PASSTHROUGH_RESULT_VALUE:
      finalValue = <>{PassthroughIcon}</>
      break
    case ENGINE_LIVE_EVENT_LOOPBACK_RESULT_VALUE:
      finalValue = <>{PassthroughIcon}</>
      break
    case ENGINE_LIVE_EVENT_STORY_OVER_RESULT_VALUE:
      finalValue = <>{t(INTERFACE_TEXT_KEY.STREAM_RESTART)}</>
      break
    default:
      finalValue = <>{value}</>
      break
  }

  return (
    <>
      <span className="event-content-choice-icon">&raquo;</span>
      <span>{finalValue}</span>
    </>
  )
}

export const Event: React.FC<{
  eventId: ElementId
  liveEvent: EngineLiveEventData
  animated: boolean
  onPathFound: NextLiveEventProcessor
}> = React.memo(({ eventId, liveEvent, animated, onPathFound }) => {
  const { engine, engineDispatch } = useContext(EngineContext),
    { settings } = useContext(SettingsContext)

  const eventRef = useRef<HTMLDivElement>(null)

  const [introDone, setIntroDone] = useState(false)

  const { studioId, id: worldId } = engine.worldInfo ?? {}

  const event = useLiveQuery(
    async () => {
      if (!studioId) return undefined

      const foundEvent = await getLibraryDatabase(studioId).events.get(eventId)

      return foundEvent || null
    },
    [studioId, eventId],
    undefined
  )

  const processPath: PathProcessor = useCallback(
    async ({ originId, result, path, state }) => {
      if (!studioId || !worldId) return

      try {
        let foundEvent: EngineEventData | undefined

        if (path) {
          const foundDestinationEvent = await findDestinationEvent(
            studioId,
            path.destinationId,
            path.destinationType
          )

          if (foundDestinationEvent) {
            foundEvent = await getEvent(studioId, foundDestinationEvent)
          }
        }

        if (!path) {
          if (
            result.value !== ENGINE_LIVE_EVENT_STORY_OVER_RESULT_VALUE &&
            originId
          ) {
            foundEvent = await getEvent(studioId, originId)
          }

          if (result.value === ENGINE_LIVE_EVENT_STORY_OVER_RESULT_VALUE) {
            const initialEvent = await getLiveEventInitial(studioId, worldId)

            if (initialEvent) {
              foundEvent = await getEvent(studioId, initialEvent.destination)
            }
          }
        }

        if (foundEvent) {
          onPathFound({
            destinationId: foundEvent.id,
            liveEventResult: result,
            originId:
              path?.destinationType === ELEMENT_TYPE.EVENT
                ? originId || liveEvent.destination
                : undefined,
            eventType: foundEvent.type,
            pathId: path?.id,
            state
          })
        } else {
          !engine.isComposer &&
            console.error(
              '[STORYTELLER] Unable to process path. Could not find event.'
            )

          engine.isComposer &&
            engineDispatch({
              type: ENGINE_ACTION_TYPE.SHOW_ERROR_NOTIFICATION,
              message:
                'Unable to process path. This can happen when jumping to a scene that does not contain a child choice or input event.'
            })
        }
      } catch (error) {
        throw error
      }
    },
    [event, liveEvent, studioId, worldId]
  )

  // A NONE transition unfolds the event's height immediately, like a
  // reduced-motion player, so the author's opt-out reaches the layout spring as
  // well as the entry fade/slide in LiveEventStream. See `lib/transition`.
  const noMotion = isTransitionImmediate(
    engine.worldInfo?.transition,
    settings.motion
  )

  const [styles, api] = useSpring(() => ({
    height: 0,
    config: { clamp: true },
    overflow: 'hidden',
    immediate: !animated || introDone || noMotion
  }))

  useResizeObserver(eventRef, () => {
    if (eventRef.current) {
      api.start({
        immediate: !animated || introDone || noMotion,
        height: eventRef.current.getBoundingClientRect().height + 1, // handles border bottom change,
        onRest: () => setIntroDone(true)
      })
    }
  })

  if (!studioId || !worldId) return null

  // which side of the prose each message is read on; see
  // `partitionLiveEventMessages`
  const { beforeProse, afterProse } = partitionLiveEventMessages(
    liveEvent.messages
  )

  /**
   * One message, wherever it is read.
   *
   * Takes the index it had in `liveEvent.messages` rather than its position in
   * whichever group it was rendered with, so the two groups cannot collide on a
   * key.
   */
  const renderMessage = (
    message: EngineLiveEventMessageData,
    index: number
  ) => {
    const inspection =
      message.type === ENGINE_LIVE_EVENT_MESSAGE_TYPE.INSPECTION

    return (
      <p
        className={
          inspection
            ? 'event-content-object-inspection'
            : message.type === ENGINE_LIVE_EVENT_MESSAGE_TYPE.TRANSITION
            ? 'event-content-transition'
            : 'event-content-object-message'
        }
        key={`${liveEvent.id}-message-${index}`}
        // an inspection is ancillary to the story rather than part of it, which
        // `note` says and `<cite>` — the title of a work — would not
        role={inspection ? 'note' : undefined}
      >
        {message.text}
      </p>
    )
  }

  return (
    <AcceleratedDiv style={{ ...styles, transform: 'translate3d(0,0,0)' }}>
      <div
        className="event-content"
        style={{
          borderBottom:
            liveEvent.id === engine.currentLiveEvent
              ? 'none'
              : 'var(--event-content-bottom-border)'
        }}
        ref={eventRef}
      >
        {event?.id && (
          <>
            {/*
              TRANSITION

              What the path said as it was crossed, read **before** the prose of
              the event it arrived at, because that is when it happened: the
              player left somewhere, the line sounded on the way, and this is
              where they came to. Read after the prose it would report the
              journey from the far end of it — "the butler says follow me" and
              only then "the door closes behind you", with the author forced to
              hang the line off the *incoming* path of the event before it to get
              the order right.

              This is the one thing about the message column that is not "between
              the prose and the choices", and the reason it earns
              `ENGINE_LIVE_EVENT_MESSAGE_TYPE.TRANSITION`: a live event saved
              before that member existed stores its notification as NARRATION and
              goes on reading below the prose, which is the old order and only
              ever visible in a playthrough already in progress.
            */}
            {beforeProse.map(({ message, index }) =>
              renderMessage(message, index)
            )}

            <div
              style={{
                display: event.persona ? 'grid' : 'unset',
                gridTemplateColumns: event.persona ? '20% auto' : 'unset',
                paddingLeft: event.persona ? '1.4rem' : 'unset'
              }}
              className={`${event.persona ? 'event-content-with-persona' : ''}`}
            >
              {event.persona && (
                <EventCharacterMask eventId={eventId} persona={event.persona} />
              )}

              <EventContent
                studioId={studioId}
                worldId={worldId}
                eventId={event.id}
                content={event.content}
                persona={event.persona}
                state={liveEvent.state}
                liveEvent={liveEvent}
                // the same processor the choice list is given, so an inline choice
                // and a listed one take a path by exactly one route
                onSubmitPath={processPath}
              />
            </div>

            {/*
              What was said that the author did not write into the prose, in the
              order it was said, between the prose and the choices — which is where
              the player is looking and is why none of it is in the object rail.
              The rail is chrome; this is the story. See useObjectActions for why
              an object beat is a line on this event rather than a live event of
              its own.

              Everything the player did once they were here, which is everything
              except the transition that brought them — that is rendered above.

              The two kinds are styled apart because they are read differently: a
              narration is a beat of the story, an inspection is the player turning
              something over in their hands.
            */}
            {afterProse.map(({ message, index }) =>
              renderMessage(message, index)
            )}

            {event.type === EVENT_TYPE.CHOICE && (
              <EventChoices
                event={event}
                liveEvent={liveEvent}
                onSubmitPath={processPath}
              />
            )}

            {event.type === EVENT_TYPE.INPUT && (
              <EventInput
                event={event}
                liveEvent={liveEvent}
                onSubmitPath={processPath}
              />
            )}
          </>
        )}
        {event === null && (
          <div
            className="engine-warning-message"
            style={{ padding: '1.4rem', paddingTop: 0 }}
          >
            Event missing or has been removed.{' '}
            <a
              onClick={async () => {
                engineDispatch({
                  type: ENGINE_ACTION_TYPE.SET_INSTALLED,
                  installed: false
                })

                setTimeout(
                  () =>
                    engineDispatch({
                      type: ENGINE_ACTION_TYPE.DEVTOOLS_RESET,
                      reset: true
                    }),
                  1
                )
              }}
            >
              Refresh
            </a>{' '}
            event stream.
          </div>
        )}
      </div>
    </AcceleratedDiv>
  )
})

Event.displayName = 'Event'

export default Event
