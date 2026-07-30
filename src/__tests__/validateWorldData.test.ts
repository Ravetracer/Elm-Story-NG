import { describe, expect, it } from 'vitest'

import validateWorldData from '../lib/transport/validate'
import { WorldDataJSON } from '../lib/transport/types/0.7.0'
import v071Upgrade from '../lib/transport/upgrade/0.7.1'
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
    // the guard this test exists to keep: additionalProperties is false, so a new
    // field on an exported variable has to be added to the schema as well
    const [valid] = validateWorldData(world({ scope: 'GLOBAL' }), '0.7.0')

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
    // registering 0.7.1 must not turn the map into a wildcard
    const [valid, errors] = validateWorldData(world({}, '0.8.0'), '0.8.0')

    expect(valid).toBe(false)
    expect(errors[0].message).toContain("'0.8.0' is not supported")
  })

  it('upgrades 0.7.0 to 0.7.1 without altering a single field', () => {
    // the step exists to keep the chain gapless, not to transform anything. If it
    // ever does transform something, this is where that becomes visible.
    const original = world()

    expect(v071Upgrade(original)).toStrictEqual(original)
  })

  it('stamps exports with a schema version it can itself import', () => {
    // AppContext.version is written into an exported world's `_.engine`, and
    // validate looks that up in a static map. Bumping the one without adding to
    // the other makes the app refuse its own exports.
    const [valid, errors] = validateWorldData(
      world({}, defaultAppState.version),
      defaultAppState.version
    )

    expect(errors).toEqual([])
    expect(valid).toBe(true)
  })
})
