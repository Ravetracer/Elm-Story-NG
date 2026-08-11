import { describe, expect, it } from 'vitest'

import validateWorldData from '../lib/transport/validate'
import { WorldDataJSON } from '../lib/transport/types/0.7.0'
import { WorldDataJSON as WorldDataJSON_080 } from '../lib/transport/types/0.8.0'
import v071Upgrade from '../lib/transport/upgrade/0.7.1'
import v080Upgrade from '../lib/transport/upgrade/0.8.0'
import { defaultAppState } from '../contexts/AppContext'

import { ELEMENT_TYPE, VARIABLE_TYPE } from '../data/types'

/**
 * The 0.7.0 transport schema, exercised where a field was added to it.
 *
 * `variables` sets `additionalProperties: false`, so exporting a property the
 * schema does not name produces a file this app refuses to import — reported as
 * an unsupported schema rather than as a bad field. Nothing else catches that:
 * the export and import paths only run when someone actually exports or imports.
 *
 * `description` was added to a variable as an optional property, which has to
 * hold in both directions: a file written before it existed must still validate,
 * and a file written now with one must validate too.
 */
const world = (
  variableExtras: Record<string, unknown> = {},
  version = '0.7.0'
): WorldDataJSON =>
  (({
    _: {
      children: [[ELEMENT_TYPE.SCENE, 'scene-1']],
      copyright: undefined,
      description: undefined,
      designer: 'Christian',
      engine: version,
      id: 'world-1',
      jump: null,
      schema: version,
      studioId: 'studio-1',
      studioTitle: 'Ravetracer',
      tags: [],
      title: 'Archiv',
      updated: 1666363452183,
      version: '0.0.1',
      website: undefined
    },
    characters: {},
    choices: {},
    conditions: {},
    effects: {},
    events: {},
    folders: {},
    inputs: {},
    jumps: {},
    paths: {},
    scenes: {},
    variables: {
      'variable-1': {
        id: 'variable-1',
        initialValue: 'false',
        tags: [],
        title: 'bookTaken',
        type: VARIABLE_TYPE.BOOLEAN,
        updated: 1666363452183,
        ...variableExtras
      }
    }
  } as unknown) as WorldDataJSON)

describe('0.7.0 variable schema', () => {
  it('validates a variable with no description, as every original 0.7.0 file has', () => {
    const [valid, errors] = validateWorldData(world(), '0.7.0')

    expect(errors).toEqual([])
    expect(valid).toBe(true)
  })

  it('validates a variable carrying a description', () => {
    const [valid, errors] = validateWorldData(
      world({ description: 'Set once the player picks the book up.' }),
      '0.7.0'
    )

    expect(errors).toEqual([])
    expect(valid).toBe(true)
  })

  it('still refuses a property the schema does not name', () => {
    // The guard this test exists to keep: additionalProperties is false, so a new
    // field on an exported variable has to be added to the schema as well.
    //
    // `scope` is a real variable property as of 0.8.0, which makes this the
    // sharper version of the same check — the identical object is valid against
    // 0.8.0 and invalid against 0.7.0, because these schemas describe bytes
    // written by a particular version rather than "a storyworld" in general.
    const [valid] = validateWorldData(world({ scope: 'SCENE' }), '0.7.0')

    expect(valid).toBe(false)
  })
})

/**
 * 0.7.1 describes the same bytes as 0.7.0 — upstream's `schema/0.7.1.json` and
 * `types/0.7.1.ts` are byte-identical to the 0.7.0 pair and its upgrade step
 * returns its input field for field — but a version absent from the schema map in
 * `validate/index.ts` is rejected outright. So a storyworld exported by a real
 * 0.7.1 build used to fail to import here, reported as an unsupported schema,
 * with nothing wrong with the file.
 */
describe('0.7.1 schema', () => {
  it('validates a file stamped 0.7.1, which was rejected as unsupported before', () => {
    const [valid, errors] = validateWorldData(world({}, '0.7.1'), '0.7.1')

    expect(errors).toEqual([])
    expect(valid).toBe(true)
  })

  it('applies 0.7.0 field rules to a 0.7.1 file, rather than waving it through', () => {
    // sharing the 0.7.0 schema must not become "0.7.1 is unvalidated": the
    // additionalProperties guard above has to hold for 0.7.1 too
    const [valid] = validateWorldData(
      world({ scope: 'GLOBAL' }, '0.7.1'),
      '0.7.1'
    )

    expect(valid).toBe(false)
  })

  it('still rejects a version it has no schema for', () => {
    // registering a version must not turn the map into a wildcard
    const [valid, errors] = validateWorldData(world({}, '0.9.0'), '0.9.0')

    expect(valid).toBe(false)
    expect(errors[0].message).toContain("'0.9.0' is not supported")
  })

  it('upgrades 0.7.0 to 0.7.1 without altering a single field', () => {
    // the step exists to keep the chain gapless, not to transform anything. If it
    // ever does transform something, this is where that becomes visible.
    const original = world()

    expect(v071Upgrade(original)).toStrictEqual(original)
  })
})

/**
 * 0.8.0 adds four collections — objects, recipes, objectConditions and
 * characterRelationships — and a handful of optional fields on elements that
 * already existed. The collections are the only reason it is a new version: the
 * top-level object is `additionalProperties: false` with a `required` list, so a
 * new collection cannot ride along the way an optional field can.
 */
const world080 = (
  extras: Partial<Record<string, unknown>> = {}
): WorldDataJSON_080 =>
  (({
    ...world({}, '0.8.0'),
    characterRelationships: {},
    objectConditions: {},
    objects: {},
    recipes: {},
    ...extras
  } as unknown) as WorldDataJSON_080)

describe('0.8.0 schema', () => {
  it('validates a world carrying the four new collections, empty', () => {
    const [valid, errors] = validateWorldData(world080(), '0.8.0')

    expect(errors).toEqual([])
    expect(valid).toBe(true)
  })

  it('requires each new collection to be present', () => {
    // an absent collection is what an unupgraded 0.7.x file looks like, and it has
    // to fail rather than validate with a hole in it
    for (const collection of [
      'characterRelationships',
      'objectConditions',
      'objects',
      'recipes'
    ]) {
      const incomplete = world080()
      delete ((incomplete as unknown) as Record<string, unknown>)[collection]

      const [valid] = validateWorldData(incomplete, '0.8.0')

      expect(valid, `${collection} should be required`).toBe(false)
    }
  })

  it('validates a fully populated object, recipe, gate and relationship', () => {
    const [valid, errors] = validateWorldData(
      world080({
        objects: {
          'object-1': {
            assetId: 'asset-1',
            combineable: true,
            description: 'A dented brass flashlight.',
            id: 'object-1',
            noRecipeMessage: 'Nothing happens.',
            placements: [
              {
                location: 'scene-1',
                quantity: 1,
                conditionsType: 'ALL',
                variableConditions: [['variable-1', '=', 'true', 'BOOLEAN']],
                objectConditions: [
                  {
                    objectId: 'object-2',
                    location: 'CURRENT_SCENE',
                    compare: ['>=', 1]
                  }
                ]
              }
            ],
            stackedAssetId: 'asset-2',
            stackedTitle: 'a pile of coins',
            tags: [],
            takeable: true,
            title: 'Flashlight',
            updated: 1666363452183
          }
        },
        recipes: {
          'recipe-1': {
            effects: [['variable-1', '=', 'true', 'BOOLEAN']],
            id: 'recipe-1',
            inputs: [{ objectId: 'object-1', quantity: 1, consumed: true }],
            message: 'You snap the battery into the flashlight.',
            outputs: [
              {
                objectId: 'object-2',
                quantity: 1,
                destination: 'INVENTORY'
              }
            ],
            tags: [],
            title: 'Charge the flashlight',
            updated: 1666363452183
          }
        },
        objectConditions: {
          'gate-1': {
            compare: ['>=', 1],
            id: 'gate-1',
            location: 'INVENTORY',
            objectId: 'object-2',
            pathId: 'path-1',
            tags: [],
            title: 'holds a charged flashlight',
            updated: 1666363452183
          }
        },
        characterRelationships: {
          'rel-1': {
            description: undefined,
            directed: false,
            from: 'character-1',
            id: 'rel-1',
            tags: [],
            title: 'sister of',
            to: 'character-2',
            updated: 1666363452183,
            variableId: 'variable-1'
          }
        }
      }),
      '0.8.0'
    )

    expect(errors).toEqual([])
    expect(valid).toBe(true)
  })

  it('validates the optional fields added to existing elements', () => {
    // all five in one file: the root's three, a path's notification, and a
    // variable's scope pair
    const base = world({ scope: 'SCENE', scopeId: 'scene-1' }, '0.8.0')

    const [valid, errors] = validateWorldData(
      world080({
        _: {
          ...base._,
          choicePresentation: 'MODAL',
          coverAssetId: 'asset-3',
          currencyVariableId: 'variable-1',
          currencyLabel: 'Credits',
          objectNoRecipeMessage: 'Nothing happens.'
        },
        variables: base.variables,
        paths: {
          'path-1': {
            conditionsType: 'ALL',
            destinationId: 'event-2',
            destinationType: ELEMENT_TYPE.EVENT,
            id: 'path-1',
            notification: 'You hear a door slam.',
            originId: 'event-1',
            originType: ELEMENT_TYPE.EVENT,
            sceneId: 'scene-1',
            tags: [],
            title: 'onward',
            updated: 1666363452183
          }
        }
      }),
      '0.8.0'
    )

    expect(errors).toEqual([])
    expect(valid).toBe(true)
  })

  it('accepts a storyworld that has translated the interface', () => {
    // `_` is additionalProperties: false, so a field the schema does not name is
    // one the app writes on export and then refuses to import
    const [valid, errors] = validateWorldData(
      world080({
        _: {
          ...world({}, '0.8.0')._,
          interfaceText: { OBJECT_TAKE: 'nehmen', OBJECT_INVENTORY: 'Inventar' }
        }
      }),
      '0.8.0'
    )

    expect(errors).toEqual([])
    expect(valid).toBe(true)
  })

  it('refuses a translation that is not a string', () => {
    const [valid] = validateWorldData(
      world080({
        _: {
          ...world({}, '0.8.0')._,
          // the schema is what rejects this, not the type
          interfaceText: { OBJECT_TAKE: 3 as unknown as string }
        }
      }),
      '0.8.0'
    )

    expect(valid).toBe(false)
  })

  it('refuses a property the new collections do not name', () => {
    // the additionalProperties guard has to hold for the new collections too, or
    // the app exports objects it then refuses to import
    const [valid] = validateWorldData(
      world080({
        objects: {
          'object-1': {
            combineable: true,
            description: '',
            id: 'object-1',
            placements: [],
            tags: [],
            takeable: true,
            title: 'Flashlight',
            updated: 1666363452183,
            charge: 3
          }
        }
      }),
      '0.8.0'
    )

    expect(valid).toBe(false)
  })

  it('upgrades 0.7.1 to 0.8.0 by adding the collections and nothing else', () => {
    const original = world({}, '0.7.1'),
      upgraded = v080Upgrade(original)

    expect(upgraded.objects).toEqual({})
    expect(upgraded.recipes).toEqual({})
    expect(upgraded.objectConditions).toEqual({})
    expect(upgraded.characterRelationships).toEqual({})

    // every pre-existing collection passes through untouched
    expect(upgraded._).toStrictEqual(original._)
    expect(upgraded.events).toStrictEqual(original.events)
    expect(upgraded.variables).toStrictEqual(original.variables)
    expect(upgraded.paths).toStrictEqual(original.paths)
    expect(upgraded.scenes).toStrictEqual(original.scenes)
  })

  it('is idempotent, unlike the 0.7.0 step', () => {
    /*
     * `upgrade/0.7.0.ts` is destructive when run twice — it resets event
     * characters and images, appends a variable type onto every condition and
     * effect again, and re-pushes jump child refs — which is why importWorldData
     * gates it on `< 0.7.0` and never widens that gate. This step claims to be
     * safe either way in its own docstring, so the claim is held here rather than
     * trusted.
     */
    const once = v080Upgrade(world({}, '0.7.1')),
      twice = v080Upgrade((once as unknown) as WorldDataJSON)

    expect(twice).toStrictEqual(once)
  })

  it('stamps exports with a schema version it can itself import', () => {
    // AppContext.version is written into an exported world's `_.engine`, and
    // validate looks that up in a static map. Bumping the one without adding to
    // the other makes the app refuse its own exports.
    //
    // The fixture is the current schema's shape on purpose: when the version moves
    // again, this fails until a matching fixture exists, which is the reminder that
    // a bump is a schema entry plus an upgrade step and not just a string.
    const [valid, errors] = validateWorldData(
      world080(),
      defaultAppState.version
    )

    expect(defaultAppState.version).toBe('0.8.0')
    expect(errors).toEqual([])
    expect(valid).toBe(true)
  })
})
