import { describe, expect, it } from 'vitest'

import { resolveTheme, isThemeLocked } from '../../engine/src/lib/theme'

import { ENGINE_THEME } from '../../engine/src/types'

const { BOOK, CONSOLE } = ENGINE_THEME

/**
 * The author's locked theme wins over the player's choice; absent, the player's
 * choice stands — the behaviour every pre-feature storyworld already had.
 */
describe('resolveTheme', () => {
  it('lets the player’s choice stand when the world locks nothing', () => {
    expect(resolveTheme(undefined, BOOK)).toBe(BOOK)
    expect(resolveTheme(undefined, CONSOLE)).toBe(CONSOLE)
  })

  it('locks to the world’s theme over the player’s choice', () => {
    expect(resolveTheme(CONSOLE, BOOK)).toBe(CONSOLE)
    expect(resolveTheme(BOOK, CONSOLE)).toBe(BOOK)
  })

  it('returns undefined only when neither is set', () => {
    expect(resolveTheme(undefined, undefined)).toBeUndefined()
  })
})

describe('isThemeLocked', () => {
  it('is true only when the author set a theme', () => {
    expect(isThemeLocked(undefined)).toBe(false)
    expect(isThemeLocked(BOOK)).toBe(true)
    expect(isThemeLocked(CONSOLE)).toBe(true)
  })
})
