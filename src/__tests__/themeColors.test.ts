import { describe, expect, it } from 'vitest'

import {
  buildThemeColorProperties,
  THEME_COLOR_PROPERTIES
} from '../../engine/src/lib/themeColors'

/**
 * The author's colour overrides, turned into the inline custom properties the
 * engine sets on `#runtime`. The case that matters most is the empty one — every
 * storyworld written before the field existed, which must produce no overrides
 * so the player's theme stands as it always did.
 */
describe('buildThemeColorProperties', () => {
  it('produces nothing for an unset or empty override', () => {
    expect(buildThemeColorProperties(undefined)).toEqual({})
    expect(buildThemeColorProperties({})).toEqual({})
  })

  it('only sets the tokens the author actually overrode', () => {
    expect(buildThemeColorProperties({ background: '#000' })).toEqual({
      '--background-color': '#000'
    })
    expect(buildThemeColorProperties({ text: '#fff' })).toEqual({
      '--text-color': '#fff'
    })
  })

  it('derives the accent hover shades from the one accent colour', () => {
    const props = buildThemeColorProperties({ accent: '#7c4dff' })

    expect(props['--primary-color']).toBe('#7c4dff')
    expect(props['--primary-color-brighter']).toBe(
      'color-mix(in srgb, #7c4dff, white 12%)'
    )
    expect(props['--primary-color-darker']).toBe(
      'color-mix(in srgb, #7c4dff, black 12%)'
    )
    expect(props['--primary-color-darkest']).toBe(
      'color-mix(in srgb, #7c4dff, black 40%)'
    )
  })

  it('only ever writes properties from the managed list', () => {
    const props = buildThemeColorProperties({
      background: '#000',
      text: '#fff',
      accent: '#7c4dff'
    })

    for (const property of Object.keys(props)) {
      expect(THEME_COLOR_PROPERTIES).toContain(property)
    }
  })
})
