import { describe, expect, it } from 'vitest'

import { resolveStreamAlignment } from '../../engine/src/lib/streamAlignment'

import { STREAM_ALIGNMENT } from '../../engine/src/types'

const { LEFT, CENTER, RIGHT } = STREAM_ALIGNMENT

/**
 * Where the reading column sits on a wide screen. The case that matters most is
 * the unset one — every storyworld written before the field existed, which has
 * to keep laying out centred exactly as it did.
 */
describe('resolveStreamAlignment', () => {
  it('defaults an unset alignment to CENTER', () => {
    expect(resolveStreamAlignment(undefined)).toBe(CENTER)
  })

  it('returns the author’s alignment unchanged when set', () => {
    expect(resolveStreamAlignment(LEFT)).toBe(LEFT)
    expect(resolveStreamAlignment(CENTER)).toBe(CENTER)
    expect(resolveStreamAlignment(RIGHT)).toBe(RIGHT)
  })
})
