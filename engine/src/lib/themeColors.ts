import { WorldThemeColors } from '../types'

/**
 * The custom properties the theme-colour overrides manage. Fixed so the applier
 * can clear the ones an author has not set, reverting them to the player's
 * chosen theme rather than leaving a stale override behind.
 */
export const THEME_COLOR_PROPERTIES = [
  '--background-color',
  '--text-color',
  '--primary-color',
  '--primary-color-brighter',
  '--primary-color-darker',
  '--primary-color-darkest'
] as const

/**
 * The inline custom properties for an author's colour overrides. Only the
 * fields the author actually set appear, so an unset colour keeps the theme's
 * token. `accent` drives the primary colour and its hover shades, derived with
 * `color-mix` so the author supplies one colour rather than four — the base
 * theme declares the shades as separate literals, which a single `--primary-color`
 * override would otherwise leave mismatched.
 */
export const buildThemeColorProperties = (
  colors?: WorldThemeColors
): Record<string, string> => {
  const properties: Record<string, string> = {}

  if (!colors) return properties

  if (colors.background) properties['--background-color'] = colors.background
  if (colors.text) properties['--text-color'] = colors.text

  if (colors.accent) {
    properties['--primary-color'] = colors.accent
    properties['--primary-color-brighter'] =
      `color-mix(in srgb, ${colors.accent}, white 12%)`
    properties['--primary-color-darker'] =
      `color-mix(in srgb, ${colors.accent}, black 12%)`
    properties['--primary-color-darkest'] =
      `color-mix(in srgb, ${colors.accent}, black 40%)`
  }

  return properties
}

/**
 * Sets the overridden properties on the element and clears every managed one the
 * author did not set, so removing a colour reverts it to the player's theme
 * rather than stranding the last value. The element is the engine's `#runtime`
 * mount — the same one the object rail writes its width to — so the overrides
 * cascade over the inherited `html[data-theme]` tokens in both an exported PWA
 * and the composer preview, without touching the editor's own root.
 */
export const applyThemeColorProperties = (
  element: HTMLElement,
  colors?: WorldThemeColors
): void => {
  const properties = buildThemeColorProperties(colors)

  for (const property of THEME_COLOR_PROPERTIES) {
    const value = properties[property]

    if (value) element.style.setProperty(property, value)
    else element.style.removeProperty(property)
  }
}
