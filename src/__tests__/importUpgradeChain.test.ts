import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'

import v070Upgrade from '../lib/transport/upgrade/0.7.0'
import v071Upgrade from '../lib/transport/upgrade/0.7.1'
import validateWorldData from '../lib/transport/validate'
import { WorldDataJSON } from '../lib/transport/types/0.7.1'

/**
 * The upgrade chain in `importWorldData` runs only when someone actually imports a
 * file, so nothing else notices when it rots. These run the real steps over
 * `engine/data/0-7-test/0-7-test.json` — the authors' own 0.7.0 export, 22 events
 * and 31 conditions across 4 scenes — rather than a synthetic fixture, because the
 * failure mode below is about accumulated real references.
 *
 * The gates in `importWorldData` cannot be tested directly: that module reaches
 * for `electron` and `api()` at import time. So these pin the *property* the gates
 * exist to respect, and the comment on each gate names this file.
 */
const realWorld = (): WorldDataJSON =>
  JSON.parse(readFileSync('engine/data/0-7-test/0-7-test.json', 'utf8'))

describe("the authors' real 0.7.0 export", () => {
  it('is what it claims to be', () => {
    const world = realWorld()

    expect(world._.engine).toBe('0.7.0')
    expect(Object.keys(world.events)).toHaveLength(22)
  })

  it('validates as 0.7.0', () => {
    const [valid, errors] = validateWorldData(realWorld(), '0.7.0')

    expect(errors).toEqual([])
    expect(valid).toBe(true)
  })

  it('validates as 0.7.1 once restamped, which is what export now writes', () => {
    const world = realWorld()

    world._.engine = '0.7.1'
    world._.schema = '0.7.1'

    const [valid, errors] = validateWorldData(world, '0.7.1')

    expect(errors).toEqual([])
    expect(valid).toBe(true)
  })

  it('passes through the 0.7.1 upgrade step unchanged', () => {
    const world = realWorld()

    expect(JSON.stringify(v071Upgrade(world))).toBe(JSON.stringify(realWorld()))
  })
})

/**
 * Why `importWorldData`'s 0.6.0-to-0.7.0 gate stays at `< 0.7.0` rather than being
 * widened to `< 0.7.1` as upstream's 0.7.1 did.
 *
 * `v070Upgrade` is not idempotent, and re-running it over data that is already
 * 0.7.0 is silently destructive. Nothing about the resulting file looks wrong
 * until the outline dereferences the duplicated child refs and takes the renderer
 * with it. This holds the specific damage so that anyone widening that gate has to
 * delete a test that says why not.
 */
describe('v070Upgrade is not safe to run twice', () => {
  const before = realWorld()
  // deliberately feeding already-0.7.0 data to the 0.6.0-to-0.7.0 step
  const after = v070Upgrade(before as never) as WorldDataJSON

  it('duplicates a scene jump child ref, which is fatal on next open', () => {
    const duplicated = Object.keys(before.scenes).filter(
      (id) => after.scenes[id].children.length > before.scenes[id].children.length
    )

    expect(duplicated).toHaveLength(3)
  })

  it('appends the variable type onto every condition compare a second time', () => {
    const grown = Object.keys(before.conditions).filter(
      (id) =>
        after.conditions[id].compare.length >
        before.conditions[id].compare.length
    )

    expect(grown).toHaveLength(31)
  })

  it('wipes character references and images off events that had them', () => {
    const lostCharacters = Object.keys(before.events).filter(
      (id) =>
        before.events[id].characters.length > 0 &&
        after.events[id].characters.length === 0
    )
    const lostImages = Object.keys(before.events).filter(
      (id) =>
        before.events[id].images.length > 0 &&
        after.events[id].images.length === 0
    )

    expect(lostCharacters).toHaveLength(2)
    expect(lostImages).toHaveLength(1)
  })
})
