import logger from '../../logger'

import AJV, { Schema } from 'ajv/dist/2020'

import { GameDataJSON as GameDataJSON_013 } from '../types/0.1.3'
import { GameDataJSON as GameDataJSON_020 } from '../types/0.2.0'
import { GameDataJSON as GameDataJSON_030 } from '../types/0.3.0'
import { GameDataJSON as GameDataJSON_031 } from '../types/0.3.1'
import { GameDataJSON as GameDataJSON_040 } from '../types/0.4.0'
import { GameDataJSON as GameDataJSON_050 } from '../types/0.5.0'
import { GameDataJSON as GameDataJSON_051 } from '../types/0.5.1'
import { WorldDataJSON as WorldDataJSON_060 } from '../types/0.6.0'
import { WorldDataJSON as WorldDataJSON_070 } from '../types/0.7.0'

import schema013 from '../schema/0.1.3.json'
import schema020 from '../schema/0.2.0.json'
import schema030 from '../schema/0.3.0.json'
import schema031 from '../schema/0.3.1.json'
import schema040 from '../schema/0.4.0.json'
import schema050 from '../schema/0.5.0.json'
import schema051 from '../schema/0.5.1.json'
import schema060 from '../schema/0.6.0.json'
import schema070 from '../schema/0.7.0.json'

/**
 * Keyed by the `_.engine` value of an incoming file.
 *
 * These were previously loaded with `require(`../schema/${version}.json`)`, which
 * only worked under webpack: a template-string require made it bundle the whole
 * directory as a context module. Vite leaves the call alone, so at runtime
 * Electron's CommonJS resolver saw a relative path with no module to resolve it
 * against and failed with "Cannot find module '../schema/0.7.0.json'", require
 * stack `electron/js2c/renderer_init`. Every version failed, and because the
 * failure was caught and reported as an unsupported schema, it read as though the
 * file itself were too new.
 *
 * Static imports also mean the schemas are bundled rather than read from disk,
 * which is what a packaged build needs: nothing resolves `src/lib/transport/schema`
 * at that point.
 */
const SCHEMAS: { [version: string]: Schema } = {
  '0.1.3': schema013,
  '0.2.0': schema020,
  '0.3.0': schema030,
  '0.3.1': schema031,
  '0.4.0': schema040,
  '0.5.0': schema050,
  '0.5.1': schema051,
  '0.6.0': schema060,
  '0.7.0': schema070
}

export type ValidationError = {
  path?: string
  message: string
  params?: { [key: string]: {} }
}

function isValidData(data: any, schema: Schema): [boolean, ValidationError[]] {
  const ajv = new AJV({ allErrors: true, strict: 'log' }),
    validate = ajv.compile(schema)

  const valid = validate(data),
    errors: ValidationError[] = []

  validate.errors?.map((error) => {
    errors.push({
      path: error.instancePath,
      message: error.message || 'Unknown error',
      params: error.params
    })
  })

  return valid && errors.length === 0 ? [true, []] : [false, errors]
}

export default (
  worldData:
    | GameDataJSON_013
    | GameDataJSON_020
    | GameDataJSON_030
    | GameDataJSON_031
    | GameDataJSON_040
    | GameDataJSON_050
    | GameDataJSON_051
    | WorldDataJSON_060
    | WorldDataJSON_070,
  version: string
): [boolean, ValidationError[]] => {
  const schema = SCHEMAS[version]

  if (!schema)
    return [
      false,
      [
        {
          message: `Unable to validate storyworld data. Schema '${version}' is not supported.`
        }
      ]
    ]

  try {
    return isValidData(worldData, schema)
  } catch (error) {
    logger.error(`Unable to validate storyworld data against '${version}'.`)
    logger.error(error)

    // Distinguished from an absent schema above: the schema is known, but
    // compiling or running it failed.
    return [
      false,
      [
        {
          message: `Unable to validate storyworld data against schema '${version}'.`
        }
      ]
    ]
  }
}
