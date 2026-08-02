import { useCallback, useContext } from 'react'

import {
  ElementId,
  EngineLiveEventData,
  EngineObjectDeltaCollection,
  EngineLiveEventStateCollection
} from '../../types'

import {
  getLiveEvent,
  getObjectWorldSnapshot,
  getRecipes,
  saveLiveEventObjectOutcome
} from '../api'

import {
  appendMessage,
  combine,
  COMBINE_OUTCOME,
  take,
  type CombineResult,
  type ObjectWorldSnapshot,
  type TakeResult
} from '../objects'

import { EngineContext, ENGINE_ACTION_TYPE } from '../../contexts/EngineContext'

/**
 * Taking and combining, as writes.
 *
 * Both **update the live event the player is on** — its deltas, the variables the
 * action's effects set, and the sentence the storyteller says about it — rather
 * than appending a live event of their own.
 *
 * That reverses `DESIGN.md` §5, so the reasoning it gave is worth answering rather
 * than quietly dropping. It argued a beat has to *be* a live event to appear in the
 * stream, since the stream renders the chain. It does not: `Event` renders
 * `liveEvent.messages` under the prose, which puts the beat exactly where it
 * happened and keeps it in history for good. What the appended event actually
 * produced was worse than nothing, because it carried the **same `destination`**:
 *
 * - the whole event, prose and choices, was drawn a second time; and
 * - the first copy's choices stayed enabled, and taking a path from one is a write
 *   built on that copy's `objects` — so taking something and then clicking the
 *   upper copy of the same choice silently threw the take away. Confirmed in the
 *   running app before this changed.
 *
 * The other reason it gave — that a bookmark resolves unambiguously only while a
 * live event is immutable — does not survive contact either: `result`, `next` and
 * `state` are all already written onto live events after the fact, and resuming a
 * save should hand back the inventory the player earned, which is what reading the
 * current record does.
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

  /**
   * Writes an outcome onto the current live event and tells the stream.
   *
   * The messages are read back off the **stored** record rather than off the
   * `liveEvent` prop, which is a snapshot taken when the panel rendered: two takes
   * in quick succession would otherwise both append to the same one-element array
   * and the first sentence would be lost.
   */
  const apply = useCallback(
    async ({
      objects,
      state,
      message,
      collapseRepeat
    }: {
      objects?: EngineObjectDeltaCollection
      state?: EngineLiveEventStateCollection
      message?: string
      collapseRepeat?: boolean
    }) => {
      if (!studioId || !worldId) return

      const stored = await getLiveEvent(studioId, liveEvent.id)

      if (!stored) return

      const messages = appendMessage(stored.messages, message, collapseRepeat)

      // nothing to say and nothing to change is not a write
      if (!objects && !state && !messages) return

      await saveLiveEventObjectOutcome(studioId, liveEvent.id, {
        objects,
        state,
        messages
      })

      const updated = await getLiveEvent(studioId, liveEvent.id)

      if (!updated) return

      // The 10ms defer matches gotoNextLiveEvent's, which feedback#214 introduced;
      // dispatching synchronously here races the live query that renders the stream.
      setTimeout(
        () =>
          engineDispatch({
            type: ENGINE_ACTION_TYPE.UPDATE_LIVE_EVENT_IN_STREAM,
            liveEvent: updated
          }),
        10
      )
    },
    [studioId, worldId, engineDispatch, liveEvent.id]
  )

  /**
   * Picks an object up, applying the object's take effects and narrating it.
   *
   * Resolves to undefined when there was nothing to take or the object is static,
   * in which case **nothing is written at all** — an action that changed nothing
   * has nothing to record and nothing to say.
   */
  const takeObject = useCallback(
    async (objectId: ElementId): Promise<TakeResult | undefined> => {
      const world = await snapshot()

      if (!world) return undefined

      const result = take(world, objectId)

      if (!result) return undefined

      // the state is passed through even when there are no effects, in which case
      // applyVariableSets returned the same object it was given
      await apply({
        objects: result.deltas,
        state: result.state,
        message: result.message
      })

      return result
    },
    [snapshot, apply]
  )

  /**
   * Combines a selection. Always resolves to a result, because a failed
   * combination still has something to say — silence reads as a broken game.
   *
   * A refusal narrates without changing anything, and collapses against an
   * identical sentence directly above it: four presses of Use against two things
   * that do not combine is one refusal the player made four times, not four beats.
   */
  const combineObjects = useCallback(
    async (selection: ElementId[]): Promise<CombineResult | undefined> => {
      if (!studioId || !worldId) return undefined

      const world = await snapshot()

      if (!world) return undefined

      const result = combine(world, await getRecipes(studioId, worldId), selection)

      await apply(
        result.outcome === COMBINE_OUTCOME.APPLIED
          ? {
              objects: result.deltas,
              state: result.state,
              message: result.message
            }
          : { message: result.message, collapseRepeat: true }
      )

      return result
    },
    [studioId, worldId, snapshot, apply]
  )

  return { takeObject, combineObjects }
}

export default useObjectActions
