import React, { useContext, useEffect } from 'react'

import { EngineContext } from '../contexts/EngineContext'

import { applyThemeColorProperties } from '../lib/themeColors'

/**
 * Applies the author's colour overrides to the engine's `#runtime` root.
 *
 * Split out of `Presentation` because `Presentation` is mounted only in an
 * exported PWA — the composer preview renders `Renderer` without it — so the
 * overrides were never applied in the editor, where an author sets them. This
 * component is mounted in *both* branches of `Runtime`, so the colours cascade
 * over the theme's tokens in the preview and the export alike.
 *
 * The overrides go on `#runtime` rather than the document element the player's
 * theme uses, so they do not reach the editor's own root in the composer preview.
 * Keyed on the serialized colours because the object's identity changes on every
 * `worldInfo` dispatch. See `lib/themeColors`.
 */
const ThemeColors: React.FC = () => {
  const { engine } = useContext(EngineContext)

  const themeColors = engine.worldInfo?.themeColors

  useEffect(() => {
    const runtime = document.getElementById('runtime')

    if (runtime) applyThemeColorProperties(runtime, themeColors)
  }, [JSON.stringify(themeColors ?? null)])

  return null
}

ThemeColors.displayName = 'ThemeColors'

export default ThemeColors
