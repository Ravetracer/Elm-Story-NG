import {
  ElementId,
  ELEMENT_TYPE,
  Scene,
  SceneChildRefs,
  StudioId,
  WorldId
} from '../data/types'

import {
  SceneMapClipboardElements,
  SceneMapClipboard,
  collectSceneMapSelection
} from '../lib/sceneMapClipboard'

import api from '.'

/**
 * The database half of scene map cut, copy, paste and duplicate. The rewrite
 * itself is in lib/sceneMapClipboard.ts, which is pure; this reads what a
 * selection owns and writes what a paste produces.
 */

/**
 * Everything in the world that a selection could own. Read whole rather than
 * per-element because a copy needs paths by both of their ends, and Dexie has no
 * index for that — the alternative is a query per node. A storyworld's element
 * count is small enough that reading the seven tables once is cheaper.
 */
export async function copySceneMapSelection(
  studioId: StudioId,
  worldId: WorldId,
  selectedElementIds: ElementId[]
): Promise<SceneMapClipboard> {
  const [events, jumps, paths, choices, inputs, conditions, effects] =
    await Promise.all([
      api().events.getEventsByWorldRef(studioId, worldId),
      api().jumps.getJumpsByWorldRef(studioId, worldId),
      api().paths.getPathsByWorldRef(studioId, worldId),
      api().choices.getChoicesByWorldRef(studioId, worldId),
      api().inputs.getInputsByWorldRef(studioId, worldId),
      api().conditions.getConditionsByWorldRef(studioId, worldId),
      api().effects.getEffectsByWorldRef(studioId, worldId)
    ])

  return collectSceneMapSelection(worldId, selectedElementIds, {
    events,
    jumps,
    paths,
    choices,
    inputs,
    conditions,
    effects
  })
}

/**
 * Writes a remapped clipboard into a scene.
 *
 * The scene's child refs are saved last on purpose: the scene map builds its
 * nodes from `Scene.children`, so nothing appears until that write lands and the
 * paste arrives as one piece rather than as elements referencing each other
 * while half of them are still missing.
 */
export async function pasteSceneMapElements(
  studioId: StudioId,
  scene: Scene,
  elements: SceneMapClipboardElements
): Promise<{ eventIds: ElementId[]; jumpIds: ElementId[] }> {
  if (!scene.id) throw new Error('Unable to paste. Missing scene id.')

  await Promise.all([
    ...elements.choices.map((choice) =>
      api().choices.saveChoice(studioId, choice)
    ),
    ...elements.inputs.map((input) => api().inputs.saveInput(studioId, input)),
    ...elements.events.map((event) => api().events.saveEvent(studioId, event)),
    ...elements.jumps.map((jump) => api().jumps.saveJump(studioId, jump)),
    ...elements.paths.map((path) => api().paths.savePath(studioId, path))
  ])

  // after their paths exist, so a condition or effect never names a path that
  // has not been written
  await Promise.all([
    ...elements.conditions.map((condition) =>
      api().conditions.saveCondition(studioId, condition)
    ),
    ...elements.effects.map((effect) =>
      api().effects.saveEffect(studioId, effect)
    )
  ])

  const eventIds = elements.events
      .map(({ id }) => id)
      .filter((id): id is ElementId => id !== undefined),
    jumpIds = elements.jumps
      .map(({ id }) => id)
      .filter((id): id is ElementId => id !== undefined)

  /*
   * Re-read rather than appending to the caller's `scene.children`. Saving child
   * refs replaces the whole array, so a copy taken when the component rendered
   * would put back anything removed since — which is how a paste after a cut
   * resurrected a child ref pointing at an event that no longer existed, and the
   * world outline builds a tree item per child ref.
   */
  const currentChildRefs = await api().scenes.getChildRefsBySceneRef(
    studioId,
    scene.id
  )

  const childRefs: SceneChildRefs = [
    ...currentChildRefs,
    ...eventIds.map((id): [ELEMENT_TYPE.EVENT, ElementId] => [
      ELEMENT_TYPE.EVENT,
      id
    ]),
    ...jumpIds.map((id): [ELEMENT_TYPE.JUMP, ElementId] => [
      ELEMENT_TYPE.JUMP,
      id
    ])
  ]

  await api().scenes.saveChildRefsToScene(studioId, scene.id, childRefs)

  return { eventIds, jumpIds }
}
