import { v4 as uuid } from 'uuid'

import {
  Choice,
  Condition,
  Effect,
  ElementId,
  Event,
  Input,
  Jump,
  Path,
  WorldId
} from '../data/types'

/**
 * Cut, copy, paste and duplicate for the scene map.
 *
 * The elements a scene map draws are only the visible half of what a selection
 * owns: an event carries its choices and its input, a path carries its
 * conditions and effects, and all of them reference each other by id. Pasting is
 * therefore not a copy but a rewrite — every id is minted fresh and every
 * reference to a copied element is repointed at the copy.
 *
 * Kept pure and free of the database so the rewrite can be tested directly,
 * which is the part with somewhere to hide: a reference missed here produces a
 * paste that looks right on the map and is wrong underneath.
 *
 * Three rules decide what travels:
 *
 * - **Nodes drive the copy.** Events and jumps are taken from the selection;
 *   paths are derived from it. A path cannot exist without both of its ends, so
 *   selecting one on its own copies nothing.
 * - **Only paths with both ends inside the selection are copied**, and the rest
 *   are counted rather than dropped silently. A path leaving the selection has a
 *   destination that need not exist in the scene being pasted into.
 * - **World-scoped references are kept, not remapped.** Characters, variables and
 *   assets belong to the storyworld rather than to the scene, so a paste within
 *   one world leaves them resolving as they did. This is why a clipboard records
 *   the world it was copied from.
 */
export interface SceneMapClipboardElements {
  events: Event[]
  jumps: Jump[]
  paths: Path[]
  choices: Choice[]
  inputs: Input[]
  conditions: Condition[]
  effects: Effect[]
}

export interface SceneMapClipboard extends SceneMapClipboardElements {
  worldId: WorldId
  /**
   * Paths with exactly one end in the selection, counted where the information
   * still exists so a paste can say what it left behind.
   */
  droppedPaths: number
}

/** What a paste needs to place the copy somewhere sensible. */
export interface SceneMapPasteOptions {
  sceneId: ElementId
  offset: { x: number; y: number }
  /** Injected so a test can assert on the rewrite rather than on uuids. */
  mintId?: () => ElementId
}

/**
 * What the tools menu, the keyboard and any future context menu ask for. The
 * scene map performs them, because cutting reuses its element-removal path and
 * pasting needs its viewport centre; everything else can only ask.
 * `centeredSceneMapSelection` in ComposerContext works the same way.
 */
export enum SCENE_MAP_CLIPBOARD_COMMAND {
  CUT = 'CUT',
  COPY = 'COPY',
  PASTE = 'PASTE',
  DUPLICATE = 'DUPLICATE'
}

export const isSceneMapClipboardEmpty = (
  clipboard: SceneMapClipboard | null
): boolean =>
  !clipboard || (clipboard.events.length === 0 && clipboard.jumps.length === 0)

const positionOf = (element: Event | Jump) => ({
  x: element.composer?.sceneMapPosX ?? 0,
  y: element.composer?.sceneMapPosY ?? 0
})

/**
 * The top left of the selection's bounding box, which is what a paste positions
 * against so the copy keeps its shape wherever it lands.
 */
export const sceneMapSelectionOrigin = (
  clipboard: SceneMapClipboard
): { x: number; y: number } => {
  const positions = [...clipboard.events, ...clipboard.jumps].map(positionOf)

  if (positions.length === 0) return { x: 0, y: 0 }

  return {
    x: Math.min(...positions.map(({ x }) => x)),
    y: Math.min(...positions.map(({ y }) => y))
  }
}

export const collectSceneMapSelection = (
  worldId: WorldId,
  selectedElementIds: ElementId[],
  world: SceneMapClipboardElements
): SceneMapClipboard => {
  const selected = new Set(selectedElementIds)

  const events = world.events.filter(({ id }) => id && selected.has(id)),
    jumps = world.jumps.filter(({ id }) => id && selected.has(id))

  const nodeIds = new Set<ElementId>(
    [...events, ...jumps]
      .map(({ id }) => id)
      .filter((id): id is ElementId => id !== undefined)
  )

  // a path is copied when the copy can draw it, which means owning both ends
  const paths = world.paths.filter(
      ({ originId, destinationId }) =>
        nodeIds.has(originId) && nodeIds.has(destinationId)
    ),
    droppedPaths = world.paths.filter(
      ({ originId, destinationId }) =>
        nodeIds.has(originId) !== nodeIds.has(destinationId)
    ).length

  const eventIds = new Set(events.map(({ id }) => id)),
    pathIds = new Set(paths.map(({ id }) => id))

  return {
    worldId,
    events,
    jumps,
    paths,
    choices: world.choices.filter(({ eventId }) => eventIds.has(eventId)),
    inputs: world.inputs.filter(({ eventId }) => eventIds.has(eventId)),
    conditions: world.conditions.filter(({ pathId }) => pathIds.has(pathId)),
    effects: world.effects.filter(({ pathId }) => pathIds.has(pathId)),
    droppedPaths
  }
}

/**
 * Mints an id for every copied element and repoints every reference between
 * them. References out of the selection — variables, characters, assets, and a
 * jump aimed somewhere else in the world — are left alone.
 */
export const remapSceneMapClipboard = (
  clipboard: SceneMapClipboard,
  { sceneId, offset, mintId = uuid }: SceneMapPasteOptions
): SceneMapClipboardElements => {
  const ids = new Map<ElementId, ElementId>()

  const mint = (id: ElementId | undefined): ElementId | undefined => {
    if (!id) return undefined

    const minted = ids.get(id) ?? mintId()

    ids.set(id, minted)

    return minted
  }

  // every id is minted before anything is rewritten, so a reference does not
  // depend on the order the elements happen to be in
  ;[
    ...clipboard.events,
    ...clipboard.jumps,
    ...clipboard.paths,
    ...clipboard.choices,
    ...clipboard.inputs,
    ...clipboard.conditions,
    ...clipboard.effects
  ].forEach(({ id }) => mint(id))

  const remapped = (id: ElementId | undefined): ElementId | undefined =>
    id === undefined ? undefined : ids.get(id)

  const move = (element: Event | Jump) => {
    const { x, y } = positionOf(element)

    return {
      ...element.composer,
      sceneMapPosX: x + offset.x,
      sceneMapPosY: y + offset.y
    }
  }

  return {
    events: clipboard.events.map((event) => ({
      ...event,
      id: remapped(event.id),
      sceneId,
      // a choice or input belongs to exactly one event, so an unmapped id here
      // would mean the collector and this function disagree
      choices: event.choices
        .map((choiceId) => remapped(choiceId))
        .filter((choiceId): choiceId is ElementId => choiceId !== undefined),
      input: remapped(event.input),
      composer: move(event)
    })),
    jumps: clipboard.jumps.map((jump) => {
      const [targetSceneId, targetEventId] = jump.path,
        copiedTarget = remapped(targetEventId)

      return {
        ...jump,
        id: remapped(jump.id),
        sceneId,
        // a jump into the selection follows the copy; one aimed anywhere else in
        // the world still resolves, so it is left pointing where it pointed
        path: copiedTarget
          ? [sceneId, copiedTarget]
          : [targetSceneId, targetEventId],
        composer: move(jump)
      }
    }),
    paths: clipboard.paths.map((path) => ({
      ...path,
      id: remapped(path.id),
      sceneId,
      originId: remapped(path.originId) as ElementId,
      destinationId: remapped(path.destinationId) as ElementId,
      choiceId: remapped(path.choiceId),
      inputId: remapped(path.inputId)
    })),
    choices: clipboard.choices.map((choice) => ({
      ...choice,
      id: remapped(choice.id),
      eventId: remapped(choice.eventId) as ElementId
    })),
    inputs: clipboard.inputs.map((input) => ({
      ...input,
      id: remapped(input.id),
      eventId: remapped(input.eventId) as ElementId
    })),
    conditions: clipboard.conditions.map((condition) => ({
      ...condition,
      id: remapped(condition.id),
      pathId: remapped(condition.pathId) as ElementId
    })),
    effects: clipboard.effects.map((effect) => ({
      ...effect,
      id: remapped(effect.id),
      pathId: remapped(effect.pathId) as ElementId
    }))
  }
}

/**
 * "2 events, 1 path" and so on, for the message a paste reports. Built here
 * rather than in the component so what a paste claims to have done is checked by
 * the same tests as what it did.
 */
export const describeSceneMapClipboard = (
  elements: SceneMapClipboardElements
): string => {
  const counts: [number, string][] = [
    [elements.events.length, 'event'],
    [elements.jumps.length, 'jump'],
    [elements.paths.length, 'path']
  ]

  const described = counts
    .filter(([total]) => total > 0)
    .map(([total, noun]) => `${total} ${noun}${total === 1 ? '' : 's'}`)

  return described.length === 0 ? 'nothing' : described.join(', ')
}
