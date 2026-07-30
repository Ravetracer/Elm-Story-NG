import { describe, expect, it } from 'vitest'

import validateWorldData from '../lib/transport/validate'
import { WorldDataJSON } from '../lib/transport/types/0.7.0'

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
  variableExtras: Record<string, unknown> = {}
): WorldDataJSON =>
  (({
    _: {
      children: [[ELEMENT_TYPE.SCENE, 'scene-1']],
      copyright: undefined,
      description: undefined,
      designer: 'Christian',
      engine: '0.7.0',
      id: 'world-1',
      jump: null,
      schema: '0.7.0',
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
