import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
import useInterfaceText from '../lib/hooks/useInterfaceText'

import { INTERFACE_TEXT_KEY } from '../lib/interfaceText'
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
  open: boolean
  onOpen: (element: HTMLElement) => void
  onHover: (title: string | undefined, element: HTMLElement | null) => void
}> = ({ object, count, selected, open, onOpen, onHover }) => {
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
      className={`object-tile${selected ? ' object-tile-selected' : ''}${
        open ? ' object-tile-open' : ''
      }`}
      onBlur={() => onHover(undefined, null)}
      onClick={(event) => onOpen(event.currentTarget)}
      onFocus={(event) => onHover(title, event.currentTarget)}
      onMouseEnter={(event) => onHover(title, event.currentTarget)}
      onMouseLeave={() => onHover(undefined, null)}
      // the accessible name, and the fallback for anyone the hover tooltip does
      // not reach — a touch screen, or a reader
      aria-label={title}
      aria-haspopup="menu"
      aria-expanded={open}
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

/** How close the verb menu may come to the rail's top and bottom edges, in px. */
const MENU_MARGIN = 4

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

  const t = useInterfaceText()

  const { studioId, id: worldId } = engine.worldInfo ?? {}

  /*
   * The object the player has picked up *for combining*, if any. One, not a list:
   * `MAX_RECIPE_INPUTS` is two, so a combination is always this object and the one
   * whose menu is used next. It is not "the highlighted tile" — a tile's own verbs
   * come from the menu that opens on it, and this exists only because the second
   * half of a pair has to be chosen somewhere.
   */
  const [combining, setCombining] = useState<ElementId | undefined>(undefined),
    [menu, setMenu] = useState<{ objectId: ElementId; top: number } | undefined>(
      undefined
    )

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

  const railRef = useRef<HTMLDivElement>(null)

  const closeMenu = useCallback(() => setMenu(undefined), [])

  /**
   * Opens the verb menu on a tile, or closes it if it was already open.
   *
   * The offset is measured against the rail so the menu travels with its tile when
   * the groups scroll, the same reason the tooltip is positioned this way.
   */
  const openMenu = useCallback(
    (objectId: ElementId, element: HTMLElement) => {
      if (!railRef.current) return

      const tile = element.getBoundingClientRect(),
        rail = railRef.current.getBoundingClientRect()

      setMenu((current) =>
        current?.objectId === objectId
          ? undefined
          : { objectId, top: tile.top - rail.top }
      )
    },
    []
  )

  /*
   * None of these show what the action said. The take message, a recipe's message,
   * a description and the refusal when nothing combines are all written onto the
   * live event and rendered in the stream, so the player reads them where they are
   * already reading.
   */
  const onLookAt = useCallback(
    (object: EngineObjectData) => {
      closeMenu()

      if (object.description) inspectObject(object.description)
    },
    [closeMenu, inspectObject]
  )

  const onTake = useCallback(
    async (objectId: ElementId) => {
      closeMenu()

      await takeObject(objectId)
    },
    [closeMenu, takeObject]
  )

  /**
   * Uses or combines, which are one call apart: a selection of one is "use" and a
   * selection of several is "combine". The pending selection is dropped only when a
   * recipe actually fired — a refusal leaves it alone, so the player can try the
   * same things against something else without picking them all again.
   */
  const onCombine = useCallback(
    async (objectIds: ElementId[]) => {
      closeMenu()

      const result = await combineObjects(objectIds)

      if (result?.outcome === COMBINE_OUTCOME.APPLIED) setCombining(undefined)
    },
    [closeMenu, combineObjects]
  )

  const onSelectForCombining = useCallback(
    (objectId: ElementId) => {
      closeMenu()

      setCombining(objectId)
    },
    [closeMenu]
  )

  const onClearCombining = useCallback(() => {
    closeMenu()

    setCombining(undefined)
  }, [closeMenu])

  /*
   * An object the player picked for combining can stop being reachable — taken into
   * a scene they leave, or consumed by a recipe that fired without it. Dropping it
   * here rather than at the point of every write keeps one rule: the selection only
   * ever names things that are still in front of the player.
   */
  const reachable = useMemo(
    () => new Set([...here, ...carrying].map(([object]) => object.id)),
    [here, carrying]
  )

  useEffect(() => {
    setCombining((current) =>
      current && !reachable.has(current) ? undefined : current
    )
  }, [reachable])

  // the open menu's tile can disappear the same way
  useEffect(() => {
    if (menu && !reachable.has(menu.objectId)) setMenu(undefined)
  }, [menu, reachable])

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
   * A click anywhere else closes the menu, and so does escape.
   *
   * `mousedown` rather than `click`: a `click` listener on the document fires for
   * the very press that opened the menu, in the same tick, and closed it again. The
   * tile is excluded by asking whether the press landed inside the rail's menu or on
   * a tile, because the tile's own handler already toggles.
   */
  useEffect(() => {
    if (!menu) return

    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null

      if (target?.closest('.object-tile-menu, .object-tile')) return

      setMenu(undefined)
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(undefined)
    }

    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  /*
   * Keeps the menu inside the rail.
   *
   * Its height is not known until it has rendered — it varies with how many verbs
   * apply — so this measures after layout and nudges it up if it would hang off the
   * bottom. Written straight onto the element rather than into state, because state
   * would re-render, re-measure and re-write forever.
   */
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = menuRef.current,
      rail = railRef.current

    if (!menu || !element || !rail) return

    const overflow =
      menu.top + element.offsetHeight - (rail.clientHeight - MENU_MARGIN)

    element.style.top = `${Math.max(
      MENU_MARGIN,
      overflow > 0 ? menu.top - overflow : menu.top
    )}px`
  }, [menu])

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

  const group = (title: string, contents: typeof here) => (
    <div className="object-panel-group">
      <h4 className="object-panel-group-title">{title}</h4>

      <div className="object-panel-tiles">
        {contents.map(([object, count]) => (
          <ObjectTile
            key={object.id}
            object={object}
            count={count}
            selected={combining === object.id}
            open={menu?.objectId === object.id}
            onOpen={(element) => openMenu(object.id, element)}
            onHover={onHover}
          />
        ))}
      </div>
    </div>
  )

  const menuObject = menu
      ? objects.find((object) => object.id === menu.objectId)
      : undefined,
    combiningObject = combining
      ? objects.find((object) => object.id === combining)
      : undefined

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
        {here.length > 0 &&
          group(t(INTERFACE_TEXT_KEY.OBJECT_HERE), here)}

        {group(t(INTERFACE_TEXT_KEY.OBJECT_INVENTORY), carrying)}

        {carrying.length === 0 && (
          <p className="object-panel-empty">
            {t(INTERFACE_TEXT_KEY.OBJECT_EMPTY)}
          </p>
        )}
      </div>

      {/*
        Says what the rings on the tiles mean. Passive: every action including
        clearing is in the menu, so nothing here has to be travelled to — which is
        the whole point of the menu replacing the old button row.
      */}
      {combiningObject && (
        <p className="object-panel-selection">
          {t(INTERFACE_TEXT_KEY.OBJECT_COMBINING)}:{' '}
          <span className="object-panel-selection-name">
            {combiningObject.title}
          </span>
        </p>
      )}

      {/*
        Both drawn outside the scrolling groups so they can overhang the rail's left
        edge into the stream, which is the only direction there is room in. The menu
        wins when both would show, since it carries the title itself.
      */}
      {menuObject && menu && (
        <ObjectMenu
          object={menuObject}
          combiningObject={combiningObject}
          takeable={here.some(
            ([candidate]) => candidate.id === menuObject.id && candidate.takeable
          )}
          top={menu.top}
          menuRef={menuRef}
          t={t}
          onLookAt={onLookAt}
          onTake={onTake}
          onCombine={onCombine}
          onSelectForCombining={onSelectForCombining}
          onClearCombining={onClearCombining}
        />
      )}

      {tooltip && !menu && (
        <span className="object-tile-tooltip" style={{ top: tooltip.top }}>
          {tooltip.title}
        </span>
      )}
    </div>
  )
}

/**
 * The verbs that apply to one object, at the object.
 *
 * Replaces a row of buttons at the foot of the rail. The verbs were the same there,
 * but reaching them meant clicking a tile at the top and then travelling the height
 * of the rail, and they had to be *disabled* rather than absent — a permanent
 * greyed-out **Take** beside something already in the player's pocket. Here a verb
 * that does not apply is simply not listed.
 *
 * **Only `Look at` is unconditional**, because an object with no description still
 * answers "there is nothing more to see" more usefully than an empty menu.
 *
 * Combining is a **pair**, per `MAX_RECIPE_INPUTS`, so the menu never accumulates:
 * `Combine…` picks this object up and the next tile's menu offers `Combine with
 * <it>`. A chain of three is authored as two recipes through an intermediate
 * object rather than performed as one gesture.
 */
const ObjectMenu: React.FC<{
  object: EngineObjectData
  combiningObject?: EngineObjectData
  takeable: boolean
  top: number
  menuRef: React.RefObject<HTMLDivElement>
  t: (key: INTERFACE_TEXT_KEY) => string
  onLookAt: (object: EngineObjectData) => void
  onTake: (objectId: ElementId) => void
  onCombine: (objectIds: ElementId[]) => void
  onSelectForCombining: (objectId: ElementId) => void
  onClearCombining: () => void
}> = ({
  object,
  combiningObject,
  takeable,
  top,
  menuRef,
  t,
  onLookAt,
  onTake,
  onCombine,
  onSelectForCombining,
  onClearCombining
}) => {
  const isPending = combiningObject?.id === object.id

  return (
    <div
      className="object-tile-menu"
      ref={menuRef}
      role="menu"
      style={{ top }}
      // the rail's own dismiss listener asks whether a press landed in here
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="object-tile-menu-title">{object.title}</div>

      <div className="object-tile-menu-verbs">
        <MenuItem onSelect={() => onLookAt(object)}>
          {t(INTERFACE_TEXT_KEY.OBJECT_LOOK_AT)}
        </MenuItem>

        {takeable && (
          <MenuItem onSelect={() => onTake(object.id)}>
            {t(INTERFACE_TEXT_KEY.OBJECT_TAKE)}
          </MenuItem>
        )}

        {object.combineable && !combiningObject && (
          <>
            <MenuItem onSelect={() => onCombine([object.id])}>
              {t(INTERFACE_TEXT_KEY.OBJECT_USE)}
            </MenuItem>

            <MenuItem onSelect={() => onSelectForCombining(object.id)}>
              {t(INTERFACE_TEXT_KEY.OBJECT_COMBINE_START)}
            </MenuItem>
          </>
        )}

        {/*
          The other half of a pair. Named rather than called "the selected one",
          because the tile carrying it may be scrolled out of sight — the ring on it
          is not enough on its own.
        */}
        {combiningObject && !isPending && object.combineable && (
          <MenuItem onSelect={() => onCombine([combiningObject.id, object.id])}>
            {t(INTERFACE_TEXT_KEY.OBJECT_COMBINE_WITH)} {combiningObject.title}
          </MenuItem>
        )}

        {combiningObject && (
          <MenuItem quiet onSelect={onClearCombining}>
            {t(INTERFACE_TEXT_KEY.OBJECT_CLEAR)}
          </MenuItem>
        )}
      </div>
    </div>
  )
}


const MenuItem: React.FC<{ quiet?: boolean; onSelect: () => void }> = ({
  children,
  quiet,
  onSelect
}) => (
  <button
    className={`object-tile-menu-item${
      quiet ? ' object-tile-menu-item-quiet' : ''
    }`}
    role="menuitem"
    onClick={onSelect}
    type="button"
  >
    {children}
  </button>
)

ObjectMenu.displayName = 'ObjectMenu'

export default ObjectPanel
