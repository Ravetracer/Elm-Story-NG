import { ENGINE_THEME } from '../types'

/**
 * Which base palette the engine paints. The author's locked `World.theme` wins
 * over the player's own choice; absent, the player's choice stands, which is the
 * behaviour every pre-feature storyworld already had. Returns `undefined` only
 * when neither is set yet — the caller waits for the player's settings to load.
 */
export const resolveTheme = (
  worldTheme?: ENGINE_THEME,
  playerTheme?: ENGINE_THEME
): ENGINE_THEME | undefined => worldTheme ?? playerTheme

/** Whether the author has locked the theme, so the player's toggle is hidden. */
export const isThemeLocked = (worldTheme?: ENGINE_THEME): boolean =>
  worldTheme !== undefined
