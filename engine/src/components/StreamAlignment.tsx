import React, { useContext, useEffect } from 'react'

import { EngineContext } from '../contexts/EngineContext'

import { resolveStreamAlignment } from '../lib/streamAlignment'

/**
 * Stamps the author's reading-column alignment onto the engine's `#runtime` root
 * as `data-stream-alignment`, which `base.less` reads to place the column left,
 * centre or right on a wide screen.
 *
 * Split out for the same reason as `ThemeColors`: `Presentation` is mounted only
 * in an exported PWA, but alignment is a *world* setting an author changes in the
 * composer, so this component is mounted in both branches of `Runtime` and the
 * attribute goes on `#runtime` rather than the document element — it must not
 * reach the editor's own root in the preview. CENTER is the unset default, so a
 * storyworld that never set it lays out exactly as it did.
 */
const StreamAlignment: React.FC = () => {
  const { engine } = useContext(EngineContext)

  const alignment = resolveStreamAlignment(engine.worldInfo?.streamAlignment)

  useEffect(() => {
    const runtime = document.getElementById('runtime')

    if (runtime) runtime.setAttribute('data-stream-alignment', alignment)
  }, [alignment])

  return null
}

StreamAlignment.displayName = 'StreamAlignment'

export default StreamAlignment
