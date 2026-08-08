import { v4 as uuid } from 'uuid'

import React, { useContext } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'

import {
  ElementId,
  EVENT_TYPE,
  EngineLiveEventData,
  EngineLiveEventStateCollection,
  ENGINE_LIVE_EVENT_TYPE,
  EngineLiveEventResult
} from '../types'
import {
  AUTO_ENGINE_BOOKMARK_KEY,
  ENGINE_LIVE_EVENT_STORY_OVER_RESULT_VALUE,
  ENGINE_LIVE_EVENT_LOOPBACK_RESULT_VALUE
} from '../lib'

import { getLibraryDatabase } from '../lib/db'

import {
  getEvent,
  getLiveEvent,
  getLiveEventInitial,
  getPathNotification,
  getScene,
  processEffectsByRoute,
  processSceneScopeOnEntry,
  saveBookmarkLiveEvent,
  saveLiveEvent,
  saveLiveEventDate,
  saveLiveEventNext,
  saveLiveEventResult
} from '../lib/api'

import { collectTriggerSounds } from '../lib/state'

import { EngineContext, ENGINE_ACTION_TYPE } from '../contexts/EngineContext'

import Event from './Event'

export type NextLiveEventProcessor = ({
  destinationId,
  liveEventResult,
  originId,
  eventType,
  pathId,
  state
}: {
  destinationId: ElementId
  liveEventResult: EngineLiveEventResult
  originId?: ElementId
  eventType: EVENT_TYPE
  pathId?: ElementId
  state?: EngineLiveEventStateCollection // override of event state for input type
}) => Promise<void>

const LiveEvent: React.FC<{ data: EngineLiveEventData; animated: boolean }> = ({
  data,
  animated
}) => {
  const { engine, engineDispatch } = useContext(EngineContext)

  const { studioId, id: worldId } = engine.worldInfo ?? {}

  const liveEvent = useLiveQuery(async () => {
    if (!studioId) return undefined

    return await getLibraryDatabase(studioId).live_events.get(data.id)
  }, [studioId, data.id])

  const gotoNextLiveEvent: NextLiveEventProcessor = async ({
    destinationId,
    liveEventResult,
    originId,
    eventType,
    pathId,
    state
  }) => {
    if (!studioId || !worldId) return

    try {
      await saveLiveEventResult(studioId, data.id, liveEventResult)

      /*
       * What the player is leaving, read back off the **stored** record rather
       * than off `liveEvent` or `data`.
       *
       * Both of those are render-time snapshots, and this function is reached
       * through a chain of memoized callbacks that can hand back a closure older
       * than the last write: `EventChoice` and `EventPassthroughChoice` both
       * memoize their click handler on `[openPath]` alone, so a fresh
       * `onSubmitPath` only reaches the button when `openPath` changes identity.
       * It does for a choice, whose paths come from a Dexie live query that
       * re-runs on every `liveEvent` change — and it does *not* for a
       * passthrough, whose `openPath` comes from react-query, which hashes its
       * key by value and hands back the cached object when the same paths are
       * looked up again.
       *
       * The symptom was an object picked up and then lost: a take writes its
       * deltas onto this live event, the » arrow copied the pre-take snapshot
       * forward, and the object was in neither the scene nor the inventory. It
       * cost the take's variable effects the same way. Taking something and then
       * clicking an ordinary choice worked, which is what made it look like a
       * problem with the object model rather than with what the arrow copied.
       *
       * `useObjectActions.apply` already reads the stored record for the same
       * reason. Deps are the cheaper fix and the wrong one to rely on alone:
       * this is the write, and a write has no business trusting a snapshot.
       */
      const storedLiveEvent = await getLiveEvent(studioId, data.id)

      const nextLiveEventId = uuid()

      // This live event does not yet exist in the database!
      // useLiveQuery in combination with useQuery for fresh data
      engineDispatch({
        type: ENGINE_ACTION_TYPE.SET_CURRENT_LIVE_EVENT,
        id: nextLiveEventId
      })

      let liveEventType: ENGINE_LIVE_EVENT_TYPE | undefined

      switch (liveEventResult.value) {
        case ENGINE_LIVE_EVENT_STORY_OVER_RESULT_VALUE:
          liveEventType = ENGINE_LIVE_EVENT_TYPE.RESTART
          break
        case ENGINE_LIVE_EVENT_LOOPBACK_RESULT_VALUE:
          liveEventType =
            ENGINE_LIVE_EVENT_TYPE[
              eventType === EVENT_TYPE.CHOICE
                ? 'CHOICE_LOOPBACK'
                : 'INPUT_LOOPBACK'
            ]
          break
        default:
          liveEventType = ENGINE_LIVE_EVENT_TYPE[eventType]
          break
      }

      const initialLiveEventFromRestart =
        liveEventType === ENGINE_LIVE_EVENT_TYPE.RESTART
          ? await getLiveEventInitial(studioId, worldId)
          : undefined

      if (liveEventType && engine.worldInfo) {
        /*
         * Scene-scoped variables reset on the way in, *after* the path's own
         * effects rather than before: an effect on the jump's path is the author
         * saying "this is true as we arrive", and resetting afterwards would throw
         * it away. The reset is a no-op unless the destination is a scene the
         * author actually scoped something to.
         *
         * Hoisted out of the `saveLiveEvent` call below because the path's
         * notification is resolved against this state and has to see the effects
         * the crossing just applied.
         */
        const nextState = await processSceneScopeOnEntry(
          studioId,
          worldId,
          data.destination,
          destinationId,
          initialLiveEventFromRestart?.state ||
            (pathId &&
              (await processEffectsByRoute(
                studioId,
                pathId,
                state || storedLiveEvent?.state || data.state
              ))) ||
            state || // TODO: handles input loopback
            storedLiveEvent?.state ||
            data.state
        )

        /*
         * What the path says as it is crossed, if the author gave it a line.
         *
         * On the **destination** event rather than the one being left, and typed
         * TRANSITION, which is what puts it above that event's prose rather than
         * below it: the line sounded on the way here, so it is read before the
         * place it brought the player to and before anything they then do with an
         * object there. That is also what makes the authoring read straight — the
         * line belongs to the path *leaving* the event it follows, rather than to
         * the path arriving at it one step earlier. A restart reaches this with no
         * `pathId` at all — `restartWorld` submits a result and no path — so it
         * cannot inherit a notification from the choice that ended the story.
         */
        const notification = pathId
          ? await getPathNotification(studioId, pathId, nextState)
          : undefined

        await Promise.all([
          saveLiveEventNext(studioId, data.id, nextLiveEventId),
          saveLiveEvent(studioId, {
            worldId,
            id: nextLiveEventId,
            destination: destinationId,
            origin: originId,
            state: nextState,
            messages: notification ? [notification] : undefined,
            /*
             * Object deltas are carried forward the way variable state is, or the
             * inventory would empty itself on the next choice — every live event
             * carries the whole snapshot, so a field this one omits is a field the
             * player has lost.
             *
             * An explicit ternary rather than the `||` chain above, because an
             * initial live event legitimately has *no* deltas: `undefined || x`
             * would fall through to the carried value and hand a restarted world
             * back the inventory it was supposed to lose.
             */
            objects:
              liveEventType === ENGINE_LIVE_EVENT_TYPE.RESTART
                ? initialLiveEventFromRestart?.objects
                : storedLiveEvent?.objects ?? data.objects,
            prev: data.id,
            type: liveEventType,
            updated: Date.now(),
            version: engine.worldInfo?.version
          })
        ])

        /*
         * Scene triggers: fire a one-shot sound on the rising edge of a variable
         * condition (dev-doc/scene-triggers.md). Evaluated here, at the single
         * transition point, against the departing live event's stored state and
         * the `nextState` this crossing just produced — so the edge is real and a
         * resumed playthrough (which never runs this function) cannot replay it.
         *
         * A RESTART is a fresh start rather than a narrative step, so its triggers
         * are left alone: the ended-story state versus the initial state is not a
         * transition an author reasoned about. A loopback is deliberately *not*
         * excluded — a wrong-input loopback that ticks a counter is a real edge an
         * author would want to catch (the buzzer on the third wrong guess). The
         * `pathId` guard already stands RESTART down, since a restart carries none.
         *
         * The fired sounds go out as a transient dispatch keyed by a fresh id, not
         * a field on the live event — the audio mixer plays them once on that key.
         */
        if (pathId && liveEventType !== ENGINE_LIVE_EVENT_TYPE.RESTART) {
          const [fromEvent, toEvent] = await Promise.all([
            getEvent(studioId, data.destination),
            getEvent(studioId, destinationId)
          ])

          if (toEvent?.sceneId) {
            const scene = await getScene(studioId, toEvent.sceneId),
              triggers = scene?.triggers ?? []

            if (triggers.length) {
              const sounds = collectTriggerSounds(
                triggers,
                storedLiveEvent?.state || data.state,
                nextState,
                toEvent.sceneId !== fromEvent?.sceneId
              )

              if (sounds.length) {
                engineDispatch({
                  type: ENGINE_ACTION_TYPE.PLAY_TRIGGER_SOUNDS,
                  assetIds: sounds,
                  key: uuid()
                })
              }
            }
          }
        }

        const updatedBookmark = await saveBookmarkLiveEvent(
          studioId,
          `${AUTO_ENGINE_BOOKMARK_KEY}${worldId}`,
          nextLiveEventId
        )

        await saveLiveEventDate(
          studioId,
          nextLiveEventId,
          updatedBookmark?.updated
        )

        const nextLiveEvent = await getLiveEvent(studioId, nextLiveEventId)

        if (nextLiveEvent) {
          const currentLiveEvent = await getLiveEvent(studioId, data.id)

          if (currentLiveEvent) {
            // elmstorygames/feedback#214
            // this was at bottom of stack... any side effects?
            // engineDispatch({
            //   type: ENGINE_ACTION_TYPE.SET_CURRENT_LIVE_EVENT,
            //   id: nextLiveEventId
            // })

            setTimeout(() => {
              engineDispatch({
                type: ENGINE_ACTION_TYPE.UPDATE_LIVE_EVENT_IN_STREAM,
                liveEvent: currentLiveEvent
              })

              engineDispatch({
                type: ENGINE_ACTION_TYPE.APPEND_LIVE_EVENTS_TO_STREAM,
                liveEvents: [nextLiveEvent],
                reset: liveEventType === ENGINE_LIVE_EVENT_TYPE.RESTART
              })
            }, 10)
          }
        }
      }
    } catch (error) {
      throw error
    }
  }

  if (!engine.worldInfo) return null

  return (
    <div className={`live-event ${liveEvent?.result ? 'live-event-past' : ''}`}>
      {liveEvent && (
        <>
          <Event
            eventId={data.destination}
            liveEvent={liveEvent}
            animated={animated}
            onPathFound={gotoNextLiveEvent}
          />
        </>
      )}
    </div>
  )
}

LiveEvent.displayName = 'LiveEvent'

export default LiveEvent
