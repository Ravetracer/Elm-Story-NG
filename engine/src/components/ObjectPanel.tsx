import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
 * **It is a rail beside the stream, not a drawer under it**, which is what
 * `TODO.md` §4 asked for and what an earlier version of this file argued against.
 * The argument was that the centre of the storyteller is a 68rem column
 * (`--runtime-width`) and splitting it in two leaves the prose too narrow. That
 * holds for two panes and not for a rail: at `--object-panel-width` the prose goes
 * from roughly 81 characters a line to 69, which is a *better* measure rather than
 * a worse one. The rail sits inside the column rather than out in the margin
 * beside it, because below 43em there is no margin — `#runtime` is the whole
 * window — and a rail that disappears at small sizes takes the inventory with it.
 *
 * The tiles are images alone. A title would set the rail's width from the longest
 * object name in the world, and "Buch über alte Schriften" is not a column width;
 * the name is a tooltip on hover and the description prints into the stream on
 * select.
 *
 * Every decision about *what happens* is in `lib/objects.ts` and tested there.
 * This component chooses only what is shown.
 */

/**
 * One object as an image, or as its initials when it has none.
 *
 * The initials are not decoration standing in for a missing asset — with no title
 * beside it, a tile with no image would be an empty square, which is unusable
 * rather than merely plain. It is deliberately still obvious that no image was
 * authored.
 */
const ObjectTile: React.FC<{
  object: EngineObjectData
  count: number
  selected: boolean
  onSelect: () => void
  onHover: (title: string | undefined, element: HTMLElement | null) => void
}> = ({ object, count, selected, onSelect, onHover }) => {
  const assetId = displayAssetId(object, count),
    title = displayTitle(object, count)

  /*
   * `eventId` is a correlation token rather than a real event. The composer's
   * GET_ASSET_URL handler resolves purely on the asset's id and extension and
   * echoes this value back so the requesting hook can recognise its own reply, so
   * one token per tile is exactly right. Object images are always webp, per
   * ASSET_KIND.OBJECT_IMAGE.
   *
   * The placeholder is deliberately empty; the initials below stand in instead.
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
      onBlur={() => onHover(undefined, null)}
      onClick={onSelect}
      onFocus={(event) => onHover(title, event.currentTarget)}
      onMouseEnter={(event) => onHover(title, event.currentTarget)}
      onMouseLeave={() => onHover(undefined, null)}
      // the accessible name, and the fallback for anyone the hover tooltip does
      // not reach — a touch screen, or a reader
      aria-label={title}
      type="button"
    >
      {imageData ? (
        <img className="object-tile-image" src={imageData} alt="" />
      ) : (
        <span className="object-tile-initials" aria-hidden="true">
          {initialsOf(title)}
        </span>
      )}

      {count > 1 && <span className="object-tile-count">{count}</span>}
    </button>
  )
}

/**
 * How much of the runtime column the rail takes.
 *
 * Declared here rather than only in `engine.less` because the component is what
 * sets it on `#runtime`; the stylesheet's `--object-panel-width: 0rem` is the
 * default for a world with no objects, not this value. It fits two 4.4rem tiles
 * across, which is the minimum interaction height and therefore the smallest tile
 * a finger can reliably hit.
 */
const OBJECT_RAIL_WIDTH = '12rem'

/** Up to two initials from an object's title, for a tile with no image. */
const initialsOf = (title: string): string =>
  title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')

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

  const { takeObject, combineObjects, inspectObject } = useObjectActions(
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

  /*
   * Selecting a tile also prints what the object is into the stream; deselecting
   * prints nothing, or a player picking two things apart to combine them would
   * read each description twice. `inspectObject` collapses a repeat against the
   * line directly above it, which covers selecting the same tile twice in a row.
   */
  const toggle = useCallback(
    (objectId: ElementId) => {
      /*
       * Read off `selection` rather than out of a `setSelection` updater. An
       * updater does not run when it is called — React defers it to render — so a
       * flag assigned inside one is still false on the next line, and the
       * inspection never printed. A tile click is a discrete user event, so the
       * captured `selection` is current.
       */
      const selecting = !selection.includes(objectId)

      setSelection(
        selecting
          ? [...selection, objectId]
          : selection.filter((id) => id !== objectId)
      )

      if (!selecting) return

      const object = (objects ?? []).find(
        (candidate) => candidate.id === objectId
      )

      // an object with no description has nothing to inspect, and a blank line in
      // the stream is worse than none
      if (object?.description) inspectObject(object.description)
    },
    [selection, objects, inspectObject]
  )

  /*
   * Neither handler shows what the action said. The take message, a recipe's
   * message and the refusal when nothing combines are all written onto the live
   * event and rendered in the stream, so the player reads them where they are
   * already reading. The results are still awaited, because the *selection* is
   * this component's business and depends on them.
   */
  const onTake = useCallback(async () => {
    /*
     * Sequential, not `Promise.all`. Each take is a read-modify-write of the same
     * live event record — the deltas, the state and the messages all accumulate on
     * it — so taking two things at once would have the second write clobber the
     * first, exactly as a multi-element cut does to `Scene.children` in the editor.
     */
    let took = false

    for (const objectId of selection) {
      if (await takeObject(objectId)) took = true
    }

    // the selection refers to counts that just changed, so it is dropped rather
    // than left pointing at a stale stack
    if (took) setSelection([])
  }, [selection, takeObject])

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
   * The hovered tile's name, and where to draw it.
   *
   * Positioned from JavaScript rather than by CSS because the rail scrolls: a
   * `::after` on the tile is clipped by the scroll container the moment it reaches
   * past the rail's edge, which is every time, since the tooltip's whole job is to
   * be wider than the rail. The offset is measured against the rail so the tooltip
   * scrolls with its tile.
   */
  const [tooltip, setTooltip] = useState<
    { title: string; top: number } | undefined
  >(undefined)

  const railRef = useRef<HTMLDivElement>(null)

  const onHover = useCallback(
    (title: string | undefined, element: HTMLElement | null) => {
      if (!title || !element || !railRef.current)
        return setTooltip(undefined)

      const tile = element.getBoundingClientRect(),
        rail = railRef.current.getBoundingClientRect()

      setTooltip({ title, top: tile.top - rail.top + tile.height / 2 })
    },
    []
  )

  /*
   * Tells the layout how much room to leave, rather than the stylesheet guessing.
   *
   * `#live-event-stream` is absolutely positioned to `right: 0`, so the rail would
   * sit on top of the prose without this. The stream reads `--object-panel-width`,
   * which defaults to zero, so a world with no objects is laid out precisely as it
   * was before 0.8.0.
   *
   * A `:has(+ #object-panel)` selector would express the same thing in CSS alone,
   * and was not used: it depends on the rail remaining the stream's immediate
   * sibling, and silently reverts to overlapping prose the day something is
   * rendered between them. The property is set from the one component that knows.
   */
  useEffect(() => {
    const runtime = document.getElementById('runtime')

    if (!runtime || !objects || objects.length === 0) return

    runtime.style.setProperty('--object-panel-width', OBJECT_RAIL_WIDTH)

    // braced: removeProperty returns a string, and an effect cleanup must return
    // nothing
    return () => {
      runtime.style.removeProperty('--object-panel-width')
    }
  }, [objects])

  // Nothing at all for a world without objects. Checked after every hook, so hook
  // order does not change between renders — the rules-of-hooks pattern the editor
  // had to be cleaned of.
  if (!objects || objects.length === 0) return null

  // one Take for the whole selection rather than one per object: "Take Buch über
  // alte Schriften" does not fit a 12rem rail, and a button per selected object
  // would stack them
  const takeableSelected = here.some(
    ([object]) => object.takeable && selection.includes(object.id)
  )

  const group = (title: string, contents: typeof here) => (
    <div className="object-panel-group">
      <h4 className="object-panel-group-title">{title}</h4>

      <div className="object-panel-tiles">
        {contents.map(([object, count]) => (
          <ObjectTile
            key={object.id}
            object={object}
            count={count}
            selected={selection.includes(object.id)}
            onSelect={() => toggle(object.id)}
            onHover={onHover}
          />
        ))}
      </div>
    </div>
  )

  return (
    <div
      id="object-panel"
      ref={railRef}
      // The stylesheet clears the title bar; the composer has no title bar and
      // LiveEventStream overrides its own `top` the same way. Without the mirror
      // the rail starts 4.4rem below the prose it sits beside.
      style={{ top: engine.isComposer ? 0 : '' }}
    >
      <div className="object-panel-groups">
        {here.length > 0 && group('Here', here)}

        {group('Inventory', carrying)}

        {carrying.length === 0 && (
          <p className="object-panel-empty">Nothing yet.</p>
        )}
      </div>

      <div className="object-panel-actions">
        <button
          className="object-panel-btn"
          disabled={!takeableSelected}
          onClick={onTake}
          type="button"
        >
          Take
        </button>

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

      {/*
        Drawn outside the scrolling groups so it can overhang the rail's left edge
        into the stream, which is the only direction there is room in.
      */}
      {tooltip && (
        <span className="object-tile-tooltip" style={{ top: tooltip.top }}>
          {tooltip.title}
        </span>
      )}
    </div>
  )
}

export default ObjectPanel
