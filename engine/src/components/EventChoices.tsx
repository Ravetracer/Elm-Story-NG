import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useQuery } from 'react-query'
import { useSpring } from 'react-spring'

import { LibraryDatabase } from '../lib/db'
import { findOpenPath, getChoicesFromEventWithOpenPath } from '../lib/api'

import {
  ENGINE_LIVE_EVENT_LOOPBACK_RESULT_VALUE,
  ENGINE_EVENT_PASSTHROUGH_RESULT_VALUE,
  ENGINE_LIVE_EVENT_STORY_OVER_RESULT_VALUE,
  INITIAL_LIVE_ENGINE_EVENT_ORIGIN_KEY,
  getChoiceIdsFromEventContent
} from '../lib'
import {
  ElementId,
  EngineChoiceData,
  EngineLiveEventData,
  EngineEventData,
  EnginePathData,
  EngineLiveEventResult,
  ENGINE_MOTION
} from '../types'
import useInterfaceText from '../lib/hooks/useInterfaceText'
import { INTERFACE_TEXT_KEY } from '../lib/interfaceText'

import { PathProcessor, translateLiveEventResultValue } from './Event'

import { EngineContext, ENGINE_ACTION_TYPE } from '../contexts/EngineContext'

import LiveEventLoopbackButton from './LiveEventLoopbackButton'
import AcceleratedDiv from './AcceleratedDiv'
import useResizeObserver from '@react-hook/resize-observer'
import { SettingsContext } from '../contexts/SettingsContext'

export const PassthroughIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="100%"
    height="3.2rem"
    fill="currentColor"
    viewBox="0 0 16 16"
  >
    <path
      fillRule="evenodd"
      d="M8 4a.5.5 0 0 1 .5.5v5.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 10.293V4.5A.5.5 0 0 1 8 4z"
    />
  </svg>
)

const EventPassthroughChoice: React.FC<{
  paths: EnginePathData[]
  liveEvent: EngineLiveEventData
  onSubmitPath: PathProcessor
  originId?: ElementId
}> = React.memo(
  ({ paths: routes, liveEvent: event, onSubmitPath, originId }) => {
    const { engine } = useContext(EngineContext),
      { settings } = useContext(SettingsContext)

    const t = useInterfaceText()

    const { studioId, id: worldId } = engine.worldInfo ?? {}

    const conditions = useLiveQuery(async () => {
      if (!studioId || !worldId) return undefined

      return await new LibraryDatabase(studioId).conditions
        .where({ worldId })
        .toArray()
    }, [studioId, worldId])

    const variables = useLiveQuery(async () => {
      if (!studioId || !worldId) return undefined

      return await new LibraryDatabase(studioId).variables
        .where({ worldId })
        .toArray()
    }, [studioId, worldId])

    const { data: openPath, isLoading: openRouteIsLoading } = useQuery(
      [`passthrough-${event.id}`, routes, conditions, variables],
      async () => {
        if (!studioId) return undefined

        return await findOpenPath(
          studioId,
          routes,
          event.state,
          worldId ? { worldId, liveEvent: event } : undefined
        )
      },
      { enabled: !!studioId }
    )

    /*
     * `onSubmitPath` is a dependency, and leaving it out was a bug rather than an
     * oversight that happened to be harmless.
     *
     * It is rebuilt whenever the live event changes, and it carries the record the
     * next live event's state and object deltas are copied from. `openPath` alone
     * does not stand in for it here: this one comes from react-query, which hashes
     * its key by value, so looking the same paths up again returns the *cached*
     * object and this callback is never rebuilt. `EventChoice` below took its
     * `openPath` from a Dexie live query instead, got a new object each run and so
     * hid the same mistake — which is why picking an object up and continuing
     * through a choice worked while continuing through this arrow silently threw
     * the object away.
     */
    const submitChoice = useCallback(
      async () =>
        openPath &&
        !openRouteIsLoading &&
        (await onSubmitPath({
          originId,
          path: openPath,
          result: {
            value: ENGINE_EVENT_PASSTHROUGH_RESULT_VALUE
          }
        })),
      [openPath, openRouteIsLoading, onSubmitPath, originId]
    )

    const passthroughRef = useRef<HTMLDivElement>(null)

    const [height, setHeight] = useState(
      event.result?.value === ENGINE_EVENT_PASSTHROUGH_RESULT_VALUE ? -1 : 0
    )

    const [styles, springApi] = useSpring(
      () => ({
        immediate: settings.motion === ENGINE_MOTION.REDUCED,
        height,
        opacity: 1,
        overflow: 'hidden',
        config: {
          clamp: true
        },
        onRest: () => {
          event.result?.value === ENGINE_EVENT_PASSTHROUGH_RESULT_VALUE &&
            setHeight(-1)
        }
      }),
      [height, event.result?.value]
    )

    useEffect(() => {
      engine.currentLiveEvent !== event.result?.id &&
        event.result?.value === ENGINE_EVENT_PASSTHROUGH_RESULT_VALUE &&
        springApi.start({
          delay: 600,
          height: -1,
          opacity: 0,
          immediate: settings.motion === ENGINE_MOTION.REDUCED
        })
    }, [event.result?.value])

    useEffect(() => {
      passthroughRef.current &&
        setHeight(passthroughRef.current.getBoundingClientRect().height)
    }, [passthroughRef.current])

    // event.result?.value === ENGINE_EVENT_PASSTHROUGH_RESULT_VALUE
    if (!engine.worldInfo) return null

    return (
      <>
        {height !== -1 && (
          <AcceleratedDiv style={styles}>
            <div
              ref={passthroughRef}
              className={`event-content-choice ${
                event.result?.value === ENGINE_EVENT_PASSTHROUGH_RESULT_VALUE
                  ? 'event-content-choice-result'
                  : ''
              }`}
            >
              <button
                onClick={submitChoice}
                disabled={
                  event.result || (!openPath && !openRouteIsLoading)
                    ? true
                    : false
                }
                className={`event-content-choice-passthrough
                  ${
                    !event.result && !openPath && !openRouteIsLoading
                      ? 'closed-route'
                      : ''
                  }
                `}
              >
                {event.result?.value ===
                ENGINE_EVENT_PASSTHROUGH_RESULT_VALUE ? (
                  <>{PassthroughIcon}</>
                ) : engine.currentLiveEvent === event.id &&
                  !openPath &&
                  !openRouteIsLoading ? (
                  t(INTERFACE_TEXT_KEY.STREAM_NO_OPEN_PATH)
                ) : (
                  <>{PassthroughIcon}</>
                )}
              </button>
            </div>
          </AcceleratedDiv>
        )}
      </>
    )
  }
)

EventPassthroughChoice.displayName = 'EventPassthroughChoice'

const EventChoice: React.FC<{
  data: EngineChoiceData
  liveEventResult?: EngineLiveEventResult
  onSubmitPath: PathProcessor
  openPath: EnginePathData
  originId?: ElementId
}> = React.memo(
  ({
    data,
    liveEventResult: eventResult,
    onSubmitPath,
    openPath,
    originId
  }) => {
    // this hides the other choices
    // if (eventResult && eventResult?.id !== data.id) return null

    const { engine } = useContext(EngineContext),
      { settings } = useContext(SettingsContext)

    // see EventPassthroughChoice: this one survived on the identity of `openPath`
    // changing for unrelated reasons, which is not a guarantee
    const submitChoice = useCallback(
      async () =>
        openPath &&
        (await onSubmitPath({
          originId,
          path: openPath,
          result: {
            id: data.id,
            value: data.title
          }
        })),
      [openPath, onSubmitPath, originId, data.id, data.title]
    )

    const choiceWrapperRef = useRef<HTMLDivElement>(null),
      choiceRef = useRef<HTMLDivElement>(null)

    const [height, setHeight] = useState(
      eventResult && eventResult?.id !== data.id ? -1 : 0
    )

    const [styles, springApi] = useSpring(
      () => ({
        immediate: settings.motion === ENGINE_MOTION.REDUCED,
        height,
        opacity: 1,
        overflow: 'hidden',
        config: {
          clamp: true
        },
        onRest: () =>
          eventResult && eventResult?.id !== data.id && setHeight(-1)
      }),
      [height, eventResult?.id, data.id]
    )

    useEffect(() => {
      engine.currentLiveEvent !== eventResult?.id &&
        eventResult &&
        eventResult?.id !== data.id &&
        springApi.start({
          immediate: settings.motion === ENGINE_MOTION.REDUCED,
          delay: 600,
          height: 0,
          opacity: 0
        })
    }, [eventResult?.id, data.id])

    useEffect(() => {
      if (choiceRef.current) {
        height !== -1 &&
          setHeight(choiceRef.current.getBoundingClientRect().height)
      }
    }, [height, choiceRef.current])

    useResizeObserver(choiceRef, () => {
      if (choiceRef.current) {
        springApi.start({
          height: choiceRef.current.getBoundingClientRect().height,
          immediate: true
        })
      }
    })

    return (
      <>
        {height !== -1 && (
          <AcceleratedDiv style={styles} ref={choiceWrapperRef}>
            {(!eventResult || openPath) && (
              <div
                ref={choiceRef}
                className={`event-content-choice ${
                  eventResult?.id === data.id
                    ? 'event-content-choice-result'
                    : ''
                }`}
              >
                <button
                  onClick={
                    eventResult?.id !== data.id ? submitChoice : undefined
                  }
                  disabled={eventResult || !openPath ? true : false}
                  className={!openPath ? 'closed-route' : ''}
                >
                  <span
                    style={{
                      filter:
                        eventResult && eventResult.id !== data.id
                          ? 'blur(0.3rem)'
                          : 'unset'
                    }}
                  >
                    <span className="event-content-choice-icon">&raquo;</span>
                    <span>{data.title}</span>
                  </span>
                </button>
              </div>
            )}
          </AcceleratedDiv>
        )}
      </>
    )
  }
)

EventChoice.displayName = 'EventChoice'

const EventChoices: React.FC<{
  event: EngineEventData
  liveEvent: EngineLiveEventData
  onSubmitPath: PathProcessor
}> = React.memo(({ event, liveEvent, onSubmitPath }) => {
  const eventChoicesRef = useRef<HTMLDivElement>(null)

  const { engine, engineDispatch } = useContext(EngineContext)

  const t = useInterfaceText()

  const { studioId, id: worldId } = engine.worldInfo ?? {}

  /*
   * The choices this event's prose already offers, which the list must not offer a
   * second time — inlining a choice moves it into the sentence rather than adding a
   * second way to take it.
   *
   * Read from the content itself rather than from a field on the event, because
   * there is no field: an inline choice is a node in the document, which is what
   * makes the whole feature cost no schema. `getChoiceIdsFromEventContent` reads
   * both shapes that document takes — see it for why there are two.
   */
  const inlinedChoiceIds = useMemo(
    () => getChoiceIdsFromEventContent(event.content),
    [event.content]
  )

  const choices = useLiveQuery(async () => {
    if (!studioId) return undefined

    const foundChoices = (
      await new LibraryDatabase(studioId).choices
        .where({ eventId: event.id })
        .toArray()
    ).filter((choice) => !inlinedChoiceIds.includes(choice.id))

    try {
      if (foundChoices) {
        const { filteredChoices, openPaths } = await Promise.resolve(
          getChoicesFromEventWithOpenPath(
            studioId,
            foundChoices,
            liveEvent.state,
            engine.devTools.blockedChoicesVisible ? true : false,
            worldId ? { worldId, liveEvent } : undefined
          )
        )

        return filteredChoices
          .sort(
            (a, b) =>
              event.choices.findIndex((choiceId) => a.id === choiceId) -
              event.choices.findIndex((choiceId) => b.id === choiceId)
          )
          .map((filteredChoice) => {
            return {
              data: filteredChoice,
              openPath: openPaths[filteredChoice.id]
            }
          })
      }

      return []
    } catch (error) {
      throw error
    }
  }, [
    studioId,
    event,
    liveEvent,
    engine.devTools.blockedChoicesVisible,
    inlinedChoiceIds
  ])

  /*
   * How many of the prose's choices the player can still take.
   *
   * Only the dead-end fallback below needs this, and it needs it badly: that block
   * offers the Return button when an event has no choices and no passthrough, and
   * an event whose choices have all moved into its sentences looks exactly like a
   * dead end from the list's point of view. A blocked inline choice is *not*
   * counted, because `EventInlineChoice` renders one as plain prose — if the only
   * way on is shut, the event really is a dead end and Return is the right offer.
   */
  const openInlineChoiceCount = useLiveQuery(
    async () => {
      if (!studioId || inlinedChoiceIds.length === 0) return 0

      const inlinedChoices = (
        await new LibraryDatabase(studioId).choices.bulkGet(inlinedChoiceIds)
      ).filter((choice): choice is EngineChoiceData => choice !== undefined)

      const { filteredChoices } = await getChoicesFromEventWithOpenPath(
        studioId,
        inlinedChoices,
        liveEvent.state,
        engine.devTools.blockedChoicesVisible ? true : false,
        worldId ? { worldId, liveEvent } : undefined
      )

      return filteredChoices.length
    },
    [
      studioId,
      worldId,
      inlinedChoiceIds,
      liveEvent,
      engine.devTools.blockedChoicesVisible
    ],
    0
  )

  const pathPassthroughs = useLiveQuery(async () => {
    if (!studioId) return undefined

    const foundPaths = await new LibraryDatabase(studioId).paths
      .where({ originId: event.id })
      .toArray()

    return foundPaths.filter((foundRoute) => foundRoute.choiceId === undefined)
  }, [studioId, event, liveEvent, engine.devTools.blockedChoicesVisible])

  const loopback = useCallback(async () => {
    if (liveEvent.prev && liveEvent.origin) {
      await onSubmitPath({
        originId: liveEvent.origin,
        result: { value: ENGINE_LIVE_EVENT_LOOPBACK_RESULT_VALUE }
      })
    } else {
      !engine.isComposer &&
        console.error('[STORYTELLER] Unable to return. Missing path.')

      engine.isComposer &&
        engineDispatch({
          type: ENGINE_ACTION_TYPE.SHOW_ERROR_NOTIFICATION,
          message: 'Unable to return. Missing path.'
        })
    }
  }, [liveEvent])

  const restartWorld = useCallback(async () => {
    onSubmitPath({
      result: { value: ENGINE_LIVE_EVENT_STORY_OVER_RESULT_VALUE }
    })
  }, [liveEvent])

  if (!engine.worldInfo) return null

  return (
    <div className="event-content-choices" ref={eventChoicesRef}>
      {!event.ending && choices && pathPassthroughs && (
        <>
          {pathPassthroughs.length > 0 && (
            <>
              <EventPassthroughChoice
                paths={pathPassthroughs}
                liveEvent={liveEvent}
                onSubmitPath={onSubmitPath}
                originId={liveEvent.origin}
              />
            </>
          )}

          {pathPassthroughs.length === 0 && (
            <>
              {choices.map(({ data, openPath }) => (
                <EventChoice
                  key={data.id}
                  data={data}
                  liveEventResult={liveEvent.result}
                  onSubmitPath={onSubmitPath}
                  openPath={openPath}
                  originId={liveEvent.origin}
                />
              ))}
            </>
          )}

          {choices.length === 0 &&
            pathPassthroughs.length === 0 &&
            openInlineChoiceCount === 0 && (
            <div className="event-content-choice">
              <div>
                {engine.currentLiveEvent !==
                  `${INITIAL_LIVE_ENGINE_EVENT_ORIGIN_KEY}${worldId}` && (
                  <>
                    {(!liveEvent.result ||
                      liveEvent.result.value ===
                        ENGINE_LIVE_EVENT_LOOPBACK_RESULT_VALUE) && (
                      <LiveEventLoopbackButton
                        onClick={loopback}
                        liveEventResult={liveEvent.result}
                      />
                    )}

                    {liveEvent.result?.value ===
                      ENGINE_EVENT_PASSTHROUGH_RESULT_VALUE && (
                      <EventPassthroughChoice
                        paths={pathPassthroughs}
                        liveEvent={liveEvent}
                        onSubmitPath={onSubmitPath}
                        originId={liveEvent.origin}
                      />
                    )}
                  </>
                )}

                {engine.currentLiveEvent ===
                  `${INITIAL_LIVE_ENGINE_EVENT_ORIGIN_KEY}${worldId}` && (
                  <button disabled={true} className="closed-route">
                    Open path not found...
                  </button>
                )}
              </div>
            </div>
          )}

          {!choices &&
            event.choices.map((choiceId) => (
              <div className="event-content-choice" key={choiceId}>
                <button style={{ opacity: 0 }}>-</button>
              </div>
            ))}
        </>
      )}

      {event.ending && (
        <>
          <div className="event-content-choice">
            <button
              onClick={restartWorld}
              disabled={liveEvent.result ? true : false}
            >
              {liveEvent.result?.value ? (
                translateLiveEventResultValue(liveEvent.result?.value, t)
              ) : (
                <>
                  <span className="event-content-choice-icon">&raquo;</span>{' '}
                  <span>{t(INTERFACE_TEXT_KEY.STREAM_RESTART)}</span>
                </>
              )}
            </button>
          </div>

          {!engine.isComposer && (
            <div className="event-content-choice">
              <div></div>
              <button
                onClick={() =>
                  engineDispatch({ type: ENGINE_ACTION_TYPE.STOP })
                }
                disabled={liveEvent.result ? true : false}
              >
                <>
                  <span className="event-content-choice-icon">&raquo;</span>{' '}
                  <span>{t(INTERFACE_TEXT_KEY.STREAM_TITLE_SCREEN)}</span>
                </>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
})

EventChoices.displayName = 'EventChoices'

export default EventChoices
