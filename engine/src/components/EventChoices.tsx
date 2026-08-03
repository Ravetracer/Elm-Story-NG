import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'
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
  getChoiceIdsFromEventContent,
  resolveChoicePresentation
} from '../lib'
import {
  CHOICE_PRESENTATION,
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

  const [choicesModalOpen, setChoicesModalOpen] = useState(true)

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

  /*
   * How this set is offered. Resolved here rather than in the components below,
   * because it is a property of the *set* — the modal holds all of them at once and
   * the inline row lays them out against each other.
   */
  const presentation = resolveChoicePresentation(
    event.choicePresentation,
    engine.worldInfo?.choicePresentation
  )

  /*
   * A modal is only ever the presentation of the event the player is *on*.
   *
   * Everything above it is a log of what already happened, and a log does not
   * interrupt: the choices of a past event stay in the column, disabled, exactly as
   * LIST draws them. That also settles what the modal does about history — nothing,
   * because it is never asked to draw any.
   *
   * **"The player is on it" is `!liveEvent.result`, not
   * `engine.currentLiveEvent === liveEvent.id`.** Both are true in ordinary play —
   * every event behind the newest carries the result that led out of it — but the
   * engine's own pointer lags a reinstall, which the composer does on every open.
   * Read off the running app: with the preview already sitting on an event, setting
   * that event to MODAL left it in the column, and it only became a modal after
   * playing away and back. An author changing a setting has to see it, which is the
   * same argument that put `Installer` on a live query.
   *
   * An ending is excluded because its "choices" are Restart and Title Screen. Those
   * are the way out of the story, not a decision inside it, and a modal over the
   * last page is a door in front of the exit.
   */
  const asModal =
    presentation === CHOICE_PRESENTATION.MODAL &&
    !liveEvent.result &&
    !event.ending

  // Dismissable, so the player can go back and read the prose the modal covers; the
  // Choose button below is how it comes back. Keyed off the live event so moving on
  // opens the next one rather than inheriting this one's dismissal.
  useEffect(() => setChoicesModalOpen(true), [liveEvent.id])

  // Escape, which is the other half of what a `<dialog>` would have given. Bound
  // only while this event's modal is actually showing, so the composer's own Escape
  // handling is untouched the rest of the time.
  useEffect(() => {
    if (!asModal || !choicesModalOpen) return

    const onKeyDown = (keyEvent: KeyboardEvent) =>
      keyEvent.key === 'Escape' && setChoicesModalOpen(false)

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [asModal, choicesModalOpen])

  if (!engine.worldInfo) return null

  const choicesBody = (
    <div
      className={`event-content-choices${
        presentation === CHOICE_PRESENTATION.INLINE
          ? ' event-content-choices-inline'
          : ''
      }`}
      ref={eventChoicesRef}
    >
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

  if (!asModal) return choicesBody

  /*
   * The modal. A `<dialog>` would bring the focus trap and Escape for free, but the
   * engine ships into an exported PWA where `showModal()` on a nested dialog is one
   * more thing to get wrong across browsers, and this has to sit inside the engine's
   * own box rather than in the top layer above everything. So it is an overlay with
   * the two behaviours written out.
   *
   * **Portalled to `#renderer`, and that was measured rather than assumed.** Left
   * where it is declared, `position: absolute` resolves against `.event-content` —
   * every ancestor up to the stream is `position: relative` — so the "modal" covered
   * only the current event's own block, 229px of a 1046px column, and grew and shrank
   * with the prose. `#renderer` is the reading area and sits *outside*
   * `#live-event-stream`, which is the scroll container, so the overlay also stays
   * put instead of scrolling away with the story behind it.
   */
  const modal = (
    <>
      {!choicesModalOpen && (
        <div className="event-content-choices">
          <div className="event-content-choice">
            <button onClick={() => setChoicesModalOpen(true)}>
              <span className="event-content-choice-icon">&raquo;</span>{' '}
              <span>{t(INTERFACE_TEXT_KEY.STREAM_CHOICES_OPEN)}</span>
            </button>
          </div>
        </div>
      )}

      {choicesModalOpen && (
        <div
          className="event-content-choices-modal-backdrop"
          // the backdrop dismisses, as a modal's does; the panel stops the click so
          // choosing inside it is not also a dismissal
          onClick={() => setChoicesModalOpen(false)}
        >
          <div
            className="event-content-choices-modal"
            role="dialog"
            aria-modal="true"
            onClick={(clickEvent) => clickEvent.stopPropagation()}
          >
            {choicesBody}

            <div className="event-content-choices-modal-close">
              <button onClick={() => setChoicesModalOpen(false)}>
                {t(INTERFACE_TEXT_KEY.STREAM_CHOICES_CLOSE)}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  const rendererRoot =
    typeof document === 'undefined'
      ? null
      : document.getElementById('renderer')

  // rendered in place if the mount point is missing rather than throwing: nothing
  // about a choice should depend on a div existing
  return rendererRoot ? createPortal(modal, rendererRoot) : modal
})

EventChoices.displayName = 'EventChoices'

export default EventChoices
