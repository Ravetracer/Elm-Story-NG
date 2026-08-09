import { v4 as uuid } from 'uuid'

import {
  StudioId,
  World,
  ELEMENT_TYPE,
  EVENT_TYPE,
  WORLD_TEMPLATE,
  DEFAULT_WORLD_VERSION
} from '../data/types'

import api from '../api'

/**
 * Creates a new author's storyworld: one scene holding one empty event, and
 * nothing else.
 *
 * This used to seed a "Getting Started" sample world whose prose and structure were
 * authored by Elm Story Games LLC and carried over from upstream. That content is
 * copyrighted by the original authors, so it has been removed — a new storyworld now
 * starts as a blank canvas. The worked example that used to live here has been
 * replaced by the maintainer's own **built-in demo** ("The Jade Idol of K'aal",
 * `lib/demo/saveDemoContent.ts`, loaded on demand from the dashboard), which is what
 * the documentation site's illustrated walkthrough is built around.
 *
 * The single scene/event scaffold is deliberate: `Scene.children[0]` must be an
 * EVENT for the engine to resolve a starting event when `World.jump` is null (see
 * the embedded engine's `findStartingDestinationLiveEvent`), so the author can hit
 * Preview immediately rather than staring at an empty scene map.
 */
export default async ({
  appVersion,
  studioId,
  worldTitle,
  worldDesigner
}: {
  appVersion: string
  studioId: StudioId
  worldTitle: string
  worldDesigner: string
}): Promise<World> => {
  const worldId = uuid(),
    sceneId = uuid(),
    eventId = uuid()

  const [savedWorld] = await Promise.all([
    api().worlds.saveWorld(studioId, {
      children: [[ELEMENT_TYPE.SCENE, sceneId]],
      designer: worldDesigner,
      engine: appVersion,
      id: worldId,
      jump: null,
      // TODO: Enable user-defined once more templates are supported.
      template: WORLD_TEMPLATE.ADVENTURE,
      title: worldTitle,
      tags: [],
      version: DEFAULT_WORLD_VERSION
    }),
    api().scenes.saveScene(studioId, {
      id: sceneId,
      children: [[ELEMENT_TYPE.EVENT, eventId]],
      composer: {
        sceneMapTransformX: 0,
        sceneMapTransformY: 0,
        sceneMapTransformZoom: 1
      },
      parent: [ELEMENT_TYPE.WORLD, null],
      tags: [],
      title: 'Scene 1',
      worldId
    }),
    api().events.saveEvent(studioId, {
      id: eventId,
      characters: [],
      choices: [],
      content: '[{"type":"p","children":[{"text":""}]}]',
      composer: {
        sceneMapPosX: 120,
        sceneMapPosY: 120
      },
      ending: false,
      images: [],
      sceneId,
      tags: [],
      title: 'Untitled Event',
      type: EVENT_TYPE.CHOICE,
      worldId
    })
  ])

  return savedWorld
}
