import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'

import { LibraryDatabase } from '../lib/db'

import {
  ElementId,
  EngineObjectData,
  INVENTORY_LOCATION_KEY
} from '../types'

import {
  COMBINE_OUTCOME,
  displayAssetId,
  displayTitle,
  locationContents,
  type ObjectWorldSnapshot
} from '../lib/objects'

import useObjectActions from '../lib/hooks/useObjectActions'
import useImageLoader from '../lib/hooks/useImageLoader'

import { EngineContext } from '../contexts/EngineContext'

/**
 * What the player is carrying and what is in reach, with take, inspect and
 * combine.
 *
 * It says nothing about what an action *did*. Every sentence an object action
 * produces — the take message, a recipe's message, the refusal when nothing
 * combines — is written onto the live event by `useObjectActions` and rendered in
 * the stream by `Event`. The panel is chrome and the stream is the story; a beat
 * of narration read out of a drawer at the bottom of the window is a beat the
 * player has to look away from the prose to find.
 *
 * **Renders nothing at all when the world has no objects**, which is the whole of
 * how every storyworld written before 0.8.0 keeps the presentation it has today.
 * The panel is not a feature those worlds opted out of; it is one they never
 * mention, and a storyteller that grew an empty drawer would be a regression for
 * all of them.
 *
 * It docks to the bottom of the runtime column rather than sitting beside the
 * stream. `TODO.md` asked for "beside the event stream, centre of the
 * storyteller", and the centre of the storyteller is a 68rem column
 * (`--runtime-width`) — splitting that in two leaves the prose column too narrow
 * to read comfortably, so the panel takes the width and gives up the height. That
 * is a presentation choice rather than a constraint, and it is reversible in
 * `engine.less` alone.
 *
 * Every decision about *what happens* is in `lib/objects.ts` and tested there.
 * This component chooses only what is shown.
 */

const ObjectTile: React.FC<{
  object: EngineObjectData
  count: number
  selected: boolean
  onSelect: () => void
}> = ({ object, count, selected, onSelect }) => {
  const assetId = displayAssetId(object, count)

  /*
   * `eventId` is a correlation token rather than a real event. The composer's
   * GET_ASSET_URL handler resolves purely on the asset's id and extension and
   * echoes this value back so the requesting hook can recognise its own reply, so
   * one token per tile is exactly right. Object images are always webp, per
   * ASSET_KIND.OBJECT_IMAGE.
   *
   * The placeholder is deliberately empty: an object with no image should show no
   * image, not a stand-in, and the hook returns the placeholder verbatim when
   * there is no asset.
   */
  const imageData = useImageLoader({
    eventId: object.id,
    assetId,
    placeholder: '',
    ext: 'webp'
  })

  return (
    <button
      className={`object-tile${selected ? ' object-tile-selected' : ''}`}
      onClick={onSelect}
      // the description is the inspect text; shown in full in the panel footer
      // when this tile is selected, and here for a pointer that never lands
      title={object.description || object.title}
      type="button"
    >
      {imageData && (
        <img
          className="object-tile-image"
          src={imageData}
          alt={displayTitle(object, count)}
        />
      )}

      <span className="object-tile-title">{displayTitle(object, count)}</span>

      {count > 1 && <span className="object-tile-count">×{count}</span>}
    </button>
  )
}

const ObjectPanel: React.FC = () => {
  const { engine } = useContext(EngineContext)

  const { studioId, id: worldId } = engine.worldInfo ?? {}

  const [selection, setSelection] = useState<ElementId[]>([])

  const liveEvent = useLiveQuery(async () => {
    if (!studioId || !engine.currentLiveEvent) return undefined

    return await new LibraryDatabase(studioId).live_events.get(
      engine.currentLiveEvent
    )
  }, [studioId, engine.currentLiveEvent])

  const objects = useLiveQuery(
    async () => {
      if (!studioId || !worldId) return undefined

      return await new LibraryDatabase(studioId).objects
        .where({ worldId })
        .toArray()
    },
    [studioId, worldId],
    undefined
  )

  const world = useLiveQuery(async () => {
    if (!studioId || !worldId) return undefined

    return await new LibraryDatabase(studioId).worlds.get(worldId)
  }, [studioId, worldId])

  // the scene the player is in, which is the scene of the event they are on
  const destinationEvent = useLiveQuery(async () => {
    if (!studioId || !liveEvent?.destination) return undefined

    return await new LibraryDatabase(studioId).events.get(liveEvent.destination)
  }, [studioId, liveEvent?.destination])

  const { takeObject, combineObjects } = useObjectActions(
    // the hook needs a live event; while one is loading the actions are inert
    // rather than the hook being called conditionally, which would change hook
    // order between renders
    liveEvent ?? {
      id: '',
      destination: '',
      state: {},
      type: engine.liveEventsInStream[0]?.type ?? 'INITIAL',
      updated: 0,
      version: '',
      worldId: worldId ?? ''
    }
  )

  const snapshot: ObjectWorldSnapshot | undefined = useMemo(() => {
    if (!objects || !liveEvent) return undefined

    return {
      objects,
      deltas: liveEvent.objects ?? {},
      state: liveEvent.state,
      currentSceneId: destinationEvent?.sceneId,
      noRecipeMessage: world?.objectNoRecipeMessage
    }
  }, [objects, liveEvent, destinationEvent?.sceneId, world])

  const here = useMemo(
    () =>
      snapshot && destinationEvent?.sceneId
        ? locationContents(snapshot, destinationEvent.sceneId)
        : [],
    [snapshot, destinationEvent?.sceneId]
  )

  const carrying = useMemo(
    () => (snapshot ? locationContents(snapshot, INVENTORY_LOCATION_KEY) : []),
    [snapshot]
  )

  const toggle = useCallback((objectId: ElementId) => {
    setSelection((current) =>
      current.includes(objectId)
        ? current.filter((id) => id !== objectId)
        : [...current, objectId]
    )
  }, [])

  /*
   * Neither handler shows what the action said. The take message, a recipe's
   * message and the refusal when nothing combines are all written onto the live
   * event and rendered in the stream, so the player reads them where they are
   * already reading. The results are still awaited, because the *selection* is
   * this component's business and depends on them.
   */
  const onTake = useCallback(
    async (objectId: ElementId) => {
      const result = await takeObject(objectId)

      // the selection refers to counts that just changed, so it is dropped rather
      // than left pointing at a stale stack
      if (result) setSelection([])
    },
    [takeObject]
  )

  const onCombine = useCallback(async () => {
    const result = await combineObjects(selection)

    if (result?.outcome === COMBINE_OUTCOME.APPLIED) setSelection([])
  }, [combineObjects, selection])

  const selectedObjects = useMemo(
    () =>
      (objects ?? []).filter((object) => selection.includes(object.id)),
    [objects, selection]
  )

  /*
   * Tells the layout how much room to leave, rather than the stylesheet guessing.
   *
   * `#live-event-stream` is absolutely positioned to `bottom: 0`, so a panel docked
   * beneath it would cover the newest prose — `#live-events` is `column-reverse`,
   * which puts the current event at the bottom, exactly where the panel sits. The
   * stream reads `--object-panel-height`, which defaults to zero, so a world with
   * no objects is laid out precisely as it is today.
   *
   * A `:has(+ #object-panel)` selector would express the same thing in CSS alone,
   * and was not used: it depends on the panel remaining the stream's immediate
   * sibling, and silently reverts to overlapping prose the day something is
   * rendered between them. The property is set from the one component that knows.
   */
  useEffect(() => {
    const runtime = document.getElementById('runtime')

    if (!runtime || !objects || objects.length === 0) return

    runtime.style.setProperty('--object-panel-height', '15rem')

    // braced: removeProperty returns a string, and an effect cleanup must return
    // nothing
    return () => {
      runtime.style.removeProperty('--object-panel-height')
    }
  }, [objects])

  // Nothing at all for a world without objects. Checked after every hook, so hook
  // order does not change between renders — the rules-of-hooks pattern the editor
  // had to be cleaned of.
  if (!objects || objects.length === 0) return null

  const takeableHere = here.filter(([object]) => object.takeable)

  return (
    <div id="object-panel">
      <div className="object-panel-groups">
        {here.length > 0 && (
          <div className="object-panel-group">
            <h4 className="object-panel-group-title">Here</h4>

            <div className="object-panel-tiles">
              {here.map(([object, count]) => (
                <ObjectTile
                  key={object.id}
                  object={object}
                  count={count}
                  selected={selection.includes(object.id)}
                  onSelect={() => toggle(object.id)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="object-panel-group">
          <h4 className="object-panel-group-title">Carrying</h4>

          {carrying.length === 0 && (
            <p className="object-panel-empty">Nothing yet.</p>
          )}

          <div className="object-panel-tiles">
            {carrying.map(([object, count]) => (
              <ObjectTile
                key={object.id}
                object={object}
                count={count}
                selected={selection.includes(object.id)}
                onSelect={() => toggle(object.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {selectedObjects.length > 0 && (
        <div className="object-panel-detail">
          {selectedObjects.map((object) => (
            <p key={object.id} className="object-panel-description">
              <strong>{object.title}.</strong>{' '}
              {object.description || 'Nothing more to see.'}
            </p>
          ))}
        </div>
      )}

      <div className="object-panel-actions">
        {takeableHere
          .filter(([object]) => selection.includes(object.id))
          .map(([object]) => (
            <button
              key={object.id}
              className="object-panel-btn"
              onClick={() => onTake(object.id)}
              type="button"
            >
              Take {object.title}
            </button>
          ))}

        <button
          className="object-panel-btn"
          disabled={
            selection.length === 0 ||
            // a selection with nothing combineable in it cannot produce a recipe,
            // so the button says so by being unavailable rather than by failing
            !selectedObjects.some((object) => object.combineable)
          }
          onClick={onCombine}
          type="button"
        >
          {selection.length > 1 ? 'Combine' : 'Use'}
        </button>

        {selection.length > 0 && (
          <button
            className="object-panel-btn object-panel-btn-quiet"
            onClick={() => setSelection([])}
            type="button"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

export default ObjectPanel
