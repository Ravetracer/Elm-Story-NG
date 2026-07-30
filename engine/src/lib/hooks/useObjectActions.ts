import { v4 as uuid } from 'uuid'

import { useCallback, useContext } from 'react'

import {
  ElementId,
  EngineLiveEventData,
  EngineObjectDeltaCollection,
  EngineLiveEventStateCollection,
  ENGINE_LIVE_EVENT_TYPE
} from '../../types'

import { AUTO_ENGINE_BOOKMARK_KEY } from '..'

import {
  getLiveEvent,
  getObjectWorldSnapshot,
  getRecipes,
  saveBookmarkLiveEvent,
  saveLiveEvent,
  saveLiveEventDate,
  saveLiveEventNext
} from '../api'

import {
  combine,
  COMBINE_OUTCOME,
  take,
  type CombineResult,
  type ObjectWorldSnapshot
} from '../objects'

import { EngineContext, ENGINE_ACTION_TYPE } from '../../contexts/EngineContext'

/**
 * Taking and combining, as writes.
 *
 * Both **append a live event** rather than editing the current one, which is the
 * decision `DESIGN.md` settled and the reason is worth keeping in view: the live
 * event stream is the player's visible history, so a combination has to *be* an
 * event to narrate anything at all, and a bookmark names a live event id, which
 * only resumes unambiguously while that event is immutable. It is not for rewind —
 * that feature is refused on principle.
 *
 * The new event keeps the **same destination**, because neither action moves the
 * player. That is what distinguishes it from `gotoNextLiveEvent`, which this
 * otherwise mirrors: same `prev`/`next` chaining, same bookmark update, same
 * stream dispatch.
 *
 * The decisions all live in `lib/objects.ts` and are tested there. This hook is
 * only the persistence and the dispatch.
 */
const useObjectActions = (liveEvent: EngineLiveEventData) => {
  const { engine, engineDispatch } = useContext(EngineContext)

  const { studioId, id: worldId } = engine.worldInfo ?? {}

  const snapshot = useCallback(async (): Promise<
    ObjectWorldSnapshot | undefined
  > => {
    if (!studioId || !worldId) return undefined

    return await getObjectWorldSnapshot(
      studioId,
      worldId,
      liveEvent.state,
      liveEvent
    )
  }, [studioId, worldId, liveEvent])

  const append = useCallback(
    async (
      type: ENGINE_LIVE_EVENT_TYPE,
      objects: EngineObjectDeltaCollection,
      state?: EngineLiveEventStateCollection
    ) => {
      if (!studioId || !worldId || !engine.worldInfo) return

      const nextLiveEventId = uuid()

      engineDispatch({
        type: ENGINE_ACTION_TYPE.SET_CURRENT_LIVE_EVENT,
        id: nextLiveEventId
      })

      await Promise.all([
        saveLiveEventNext(studioId, liveEvent.id, nextLiveEventId),
        saveLiveEvent(studioId, {
          worldId,
          id: nextLiveEventId,
          // unchanged: taking and combining do not move the player
          destination: liveEvent.destination,
          origin: liveEvent.origin,
          state: state ?? liveEvent.state,
          objects,
          prev: liveEvent.id,
          type,
          updated: Date.now(),
          version: engine.worldInfo.version
        })
      ])

      const updatedBookmark = await saveBookmarkLiveEvent(
        studioId,
        `${AUTO_ENGINE_BOOKMARK_KEY}${worldId}`,
        nextLiveEventId
      )

      await saveLiveEventDate(studioId, nextLiveEventId, updatedBookmark?.updated)

      const [nextLiveEvent, currentLiveEvent] = await Promise.all([
        getLiveEvent(studioId, nextLiveEventId),
        getLiveEvent(studioId, liveEvent.id)
      ])

      if (!nextLiveEvent || !currentLiveEvent) return

      // The 10ms defer matches gotoNextLiveEvent's, which feedback#214 introduced;
      // dispatching synchronously here races the live query that renders the stream.
      setTimeout(() => {
        engineDispatch({
          type: ENGINE_ACTION_TYPE.UPDATE_LIVE_EVENT_IN_STREAM,
          liveEvent: currentLiveEvent
        })

        engineDispatch({
          type: ENGINE_ACTION_TYPE.APPEND_LIVE_EVENTS_TO_STREAM,
          liveEvents: [nextLiveEvent],
          reset: false
        })
      }, 10)
    },
    [studioId, worldId, engine.worldInfo, engineDispatch, liveEvent]
  )

  /**
   * Picks an object up. Resolves to false when there was nothing to take or the
   * object is static, in which case **no live event is written at all** — an event
   * that changes nothing is noise in the stream and a bookmark pointing at it says
   * the player did something they did not.
   */
  const takeObject = useCallback(
    async (objectId: ElementId): Promise<boolean> => {
      const world = await snapshot()

      if (!world) return false

      const deltas = take(world, objectId)

      if (!deltas) return false

      await append(ENGINE_LIVE_EVENT_TYPE.OBJECT_TAKE, deltas)

      return true
    },
    [snapshot, append]
  )

  /**
   * Combines a selection. Always resolves to a result, because a failed
   * combination still has something to say — silence reads as a broken game.
   *
   * A live event is written only when a recipe actually fired. A refusal is
   * returned to the caller to show transiently rather than recorded as history,
   * since nothing about the world changed.
   */
  const combineObjects = useCallback(
    async (selection: ElementId[]): Promise<CombineResult | undefined> => {
      if (!studioId || !worldId) return undefined

      const world = await snapshot()

      if (!world) return undefined

      const result = combine(world, await getRecipes(studioId, worldId), selection)

      if (result.outcome === COMBINE_OUTCOME.APPLIED)
        await append(
          ENGINE_LIVE_EVENT_TYPE.OBJECT_COMBINE,
          result.deltas,
          result.state
        )

      return result
    },
    [studioId, worldId, snapshot, append]
  )

  return { takeObject, combineObjects }
}

export default useObjectActions
