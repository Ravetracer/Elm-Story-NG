// upgrades 0.1.3 data to 0.2.0
import { cloneDeep, pick } from 'lodash-es'

// 0.2.0 files name elements GAME, PASSAGE and ROUTE; the current ELEMENT_TYPE
// would write WORLD and EVENT into data no reader of that vintage expects.
import { COMPONENT_TYPE } from '../types/pre-0.6.0'
import { GameDataJSON as GameDataJSON_013 } from '../types/0.1.3'
import {
  FolderCollection,
  GameDataJSON as GameDataJSON_020,
  JumpCollection,
  SceneCollection
} from '../types/0.2.0'
import { ElementId } from '../../../data/types'

export default ({
  _,
  chapters,
  choices,
  conditions,
  effects,
  jumps,
  passages,
  routes,
  scenes,
  variables
}: GameDataJSON_013): GameDataJSON_020 => {
  const clonedChapters = cloneDeep(chapters),
    folders: FolderCollection = {}

  Object.keys(clonedChapters).map((chapterId) => {
    folders[chapterId] = {
      children: clonedChapters[chapterId].scenes.map((sceneId) => [
        COMPONENT_TYPE.SCENE,
        sceneId
      ]),
      parent: [COMPONENT_TYPE.GAME, null],
      ...pick(clonedChapters[chapterId], ['id', 'tags', 'title', 'updated'])
    }
  })

  const upgradedJumps: JumpCollection = {}

  Object.keys(jumps).map((jumpId) => {
    const clonedJump = cloneDeep(jumps[jumpId]),
      route = clonedJump.route

    // A 0.1.3 route leads with a chapter id, which 0.2.0 drops, narrowing the
    // tuple from three entries to two. shift() is kept in preference to
    // destructuring so that a route shorter than three entries stays short
    // rather than gaining explicit undefined members, which would serialize as
    // nulls. The cast is what shift() cannot express to the compiler.
    route.shift()

    upgradedJumps[jumpId] = {
      ...clonedJump,
      route: route as [ElementId?, ElementId?]
    }
  })

  const clonedScenes = cloneDeep(scenes),
    upgradedScenes: SceneCollection = {}

  Object.keys(clonedScenes).map((sceneId) => {
    const clonedScene = clonedScenes[sceneId]

    upgradedScenes[sceneId] = {
      children: clonedScene.passages.map((passageId) => [
        COMPONENT_TYPE.PASSAGE,
        passageId
      ]),
      parent: [COMPONENT_TYPE.FOLDER, clonedScene.chapterId],
      ...pick(clonedScene, [
        'editor',
        'id',
        'jumps',
        'tags',
        'title',
        'updated'
      ])
    }
  })

  return {
    _: {
      children: _.chapters.map((chapterId) => [
        COMPONENT_TYPE.FOLDER,
        chapterId
      ]),
      engine: '0.2.0',
      ...pick(_, [
        'designer',
        'id',
        'jump',
        'schema',
        'studioId',
        'studioTitle',
        'tags',
        'title',
        'updated',
        'version'
      ])
    },
    choices,
    conditions,
    effects,
    folders,
    jumps: upgradedJumps,
    passages,
    routes,
    scenes: upgradedScenes,
    variables
  }
}
