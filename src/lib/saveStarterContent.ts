import { v4 as uuid } from 'uuid'

import {
  StudioId,
  ElementId,
  World,
  ELEMENT_TYPE,
  Event,
  EVENT_TYPE,
  WORLD_TEMPLATE,
  PATH_CONDITIONS_TYPE
} from '../data/types'

import api from '../api'

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
    introEventId = uuid(),
    resourcesEventId = uuid(),
    connectingPathId = uuid()

  const promises: [
    Promise<World>, // world data
    Promise<ElementId>, // base scene id
    Promise<Event>, // intro event data
    Promise<Event>, // resources event data
    Promise<ElementId> // connecting path id
  ] = [
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
      // TODO: Move to defines/types.
      version: '0.0.1'
    }),
    api().scenes.saveScene(studioId, {
      id: sceneId,
      children: [
        [ELEMENT_TYPE.EVENT, introEventId],
        [ELEMENT_TYPE.EVENT, resourcesEventId]
      ],
      composer: {
        sceneMapTransformX: -158.6576402321083,
        sceneMapTransformY: -117.9864603481625,
        sceneMapTransformZoom: 1.4622823984526112
      },
      parent: [ELEMENT_TYPE.WORLD, null],
      tags: [],
      title: 'Getting Started with Elm Story - NG',
      worldId
    }),
    api().events.saveEvent(studioId, {
      id: introEventId,
      characters: [],
      choices: [],
      content:
        '[{"type":"h1","children":[{"text":"Welcome to Elm Story - NG"}]},{"type":"p","children":[{"text":"...and your new storyworld!"}]},{"type":"p","children":[{"text":"We\'ve generated this sample content to help you get started."}]},{"type":"p","children":[{"text":"Click the arrow below to view available resources."}]}]',
      composer: {
        sceneMapPosX: 132,
        sceneMapPosY: 192
      },
      ending: false,
      images: [],
      sceneId,
      tags: [],
      title: 'Introduction',
      type: EVENT_TYPE.CHOICE,
      worldId
    }),
    api().events.saveEvent(studioId, {
      id: resourcesEventId,
      characters: [],
      choices: [],
      /**
       * Every external link this used to carry pointed at elmstory.com — its
       * tutorials, Discord, Twitter, community, donation and Patreon pages. That
       * domain no longer resolves, so a new author's very first storyworld
       * shipped six dead links, and the two accounts that do still answer belong
       * to the original authors rather than to this project. Replaced with the
       * two authoring affordances that have no visible affordance of their own
       * (the `/` and `{` triggers) and a pointer at the in-app expression help,
       * which is where the accurate documentation actually lives.
       */
      content:
        '[{"type":"h2","children":[{"text":"Helpful Resources"}]},{"type":"p","children":[{"text":"Type / in an event\'s content to open the command menu: headings, quotes, lists, character references and images."}]},{"type":"p","children":[{"text":"Type { to start a template expression, which reads a variable by its title. The ❔ beside the Variables tab explains the whole expression language."}]},{"type":"blockquote","children":[{"text":"Elm Story - NG is a continuation of Elm Story, which its original authors stopped developing at 0.7.0 in April 2022. The help buttons and documentation links they left behind point at a site that no longer exists."}]},{"type":"p","children":[{"text":"Ctrl/Cmd+Shift+F hides everything but the writing column. Ctrl/Cmd+X, C, V and D cut, copy, paste and duplicate scene map selections."}]}]',
      composer: {
        sceneMapPosX: 400,
        sceneMapPosY: 192
      },
      ending: true,
      images: [],
      sceneId,
      tags: [],
      title: 'Resources',
      type: EVENT_TYPE.CHOICE,
      worldId
    }),
    api().paths.savePath(studioId, {
      conditionsType: PATH_CONDITIONS_TYPE.ALL,
      destinationId: resourcesEventId,
      destinationType: ELEMENT_TYPE.EVENT,
      id: connectingPathId,
      originId: introEventId,
      originType: EVENT_TYPE.CHOICE,
      sceneId,
      tags: [],
      title: 'Connecting Path',
      worldId
    })
  ]

  try {
    const [savedWorld] = await Promise.all(promises)

    return savedWorld
  } catch (error) {
    throw error
  }
}
