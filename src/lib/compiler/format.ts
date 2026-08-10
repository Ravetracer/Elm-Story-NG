import { cloneDeep, Many, pick } from 'lodash'
// @ts-ignore
import lzwCompress from 'lzwcompress'

import {
  ELEMENT_TYPE,
  WorldDataJSON,
  ESGEngineCollectionData
} from '../transport/types/0.8.0'

function filterCollectionChildProps<T extends object, U extends keyof T>(
  collectionToFilter: { [ElementId: string]: T },
  props: Many<U>
) {
  const filteredCollection: { [ElementId: string]: Pick<T, U> } = {}

  Object.keys(collectionToFilter).map(
    (objectId) =>
      (filteredCollection[objectId] = pick(collectionToFilter[objectId], props))
  )

  return filteredCollection
}

/**
 * Packs a storyworld into what the Storyteller actually loads.
 *
 * **The pick lists below are the contract, not a convenience.** A field declared
 * on both the transport type and the engine type is still invisible at runtime
 * until it is named here, which makes this the easiest place in the repository to
 * add a field and believe it works. `characterRelationships` is the one collection
 * deliberately not passed through: it is authoring metadata, and anything of it
 * that must reach the engine goes through its optional `variableId`.
 */
function format(worldData: WorldDataJSON): string {
  const {
    _,
    characters,
    choices,
    conditions,
    effects,
    events,
    inputs,
    jumps,
    objectConditions,
    objects,
    paths,
    recipes,
    scenes,
    variables
  }: WorldDataJSON = cloneDeep(worldData)

  // TODO: fix types
  // @ts-ignore
  return lzwCompress.pack({
    _: {
      children: worldData._.children
        .filter((child) => child[0] === ELEMENT_TYPE.SCENE)
        .map((child) => child),
      ...pick(_, [
        'choicePresentation',
        'transition',
        'streamAlignment',
        'theme',
        'themeColors',
        'copyright',
        'coverAssetId',
        'backgroundAssetId',
        'description',
        'designer',
        'engine',
        'id',
        'interfaceText',
        'jump',
        'objectNoRecipeMessage',
        'schema',
        'studioId',
        'studioTitle',
        'tags',
        'title',
        'updated',
        'version',
        'website'
      ])
    },
    characters: filterCollectionChildProps(characters, [
      'id',
      'masks',
      'refs',
      'title'
    ]),
    choices: filterCollectionChildProps(choices, ['id', 'eventId', 'title']),
    // @ts-ignore
    conditions: filterCollectionChildProps(conditions, [
      'compare',
      'id',
      'pathId',
      'variableId'
    ]),
    // @ts-ignore
    effects: filterCollectionChildProps(effects, [
      'id',
      'pathId',
      'set',
      'variableId'
    ]),
    events: filterCollectionChildProps(events, [
      'audio',
      'choicePresentation',
      'choices',
      'content',
      'ending',
      'id',
      'input',
      'persona',
      'sceneId',
      'type'
    ]),
    inputs: filterCollectionChildProps(inputs, ['id', 'eventId', 'variableId']),
    jumps: filterCollectionChildProps(jumps, ['id', 'path', 'sceneId']),
    // @ts-ignore
    objectConditions: filterCollectionChildProps(objectConditions, [
      'compare',
      'id',
      'location',
      'objectId',
      'pathId',
      'sceneId'
    ]),
    objects: filterCollectionChildProps(objects, [
      'assetId',
      'combineable',
      'description',
      'id',
      'noRecipeMessage',
      'placements',
      'stackedAssetId',
      'stackedTitle',
      'takeable',
      'takeEffects',
      'takeMessage',
      'wearable',
      'wearEffects',
      'removeEffects',
      'wearMessage',
      'removeMessage',
      'title'
    ]),
    paths: filterCollectionChildProps(paths, [
      'choiceId',
      'conditionsType',
      'destinationId',
      'destinationType',
      'id',
      'inputId',
      'notification',
      'originId',
      'originType',
      'sceneId'
    ]),
    // @ts-ignore
    recipes: filterCollectionChildProps(recipes, [
      'effects',
      'id',
      'inputs',
      'message',
      'outputs'
    ]),
    scenes: filterCollectionChildProps(scenes, [
      'audio',
      'children',
      'id',
      'triggers'
    ]),
    variables: filterCollectionChildProps(variables, [
      'id',
      'initialValue',
      'scope',
      'scopeId',
      'title',
      'type'
    ]),
    worlds: {}
  } as ESGEngineCollectionData)
}

export default format
