import { useCallback, useContext } from 'react'

import { EngineContext } from '../../contexts/EngineContext'

import {
  interfaceText,
  INTERFACE_TEXT_KEY,
  type InterfaceTextOverrides
} from '../interfaceText'

/**
 * The storyworld's word for one of the engine's own, or the English.
 *
 * ```tsx
 * const t = useInterfaceText()
 * <button>{t(INTERFACE_TEXT_KEY.OBJECT_TAKE)}</button>
 * ```
 *
 * Reads the overrides off `EngineContext` rather than the database, so it costs
 * nothing per label — see the note on `worldInfo.interfaceText` for why they are
 * carried there. Before the world is installed there are no overrides and every
 * key resolves to its English, which is also what a world that translated nothing
 * gets, so there is no loading state to render around.
 */
const useInterfaceText = (): ((key: INTERFACE_TEXT_KEY) => string) => {
  const { engine } = useContext(EngineContext)

  const overrides: InterfaceTextOverrides | undefined =
    engine.worldInfo?.interfaceText

  return useCallback(
    (key: INTERFACE_TEXT_KEY) => interfaceText(overrides, key),
    [overrides]
  )
}

export default useInterfaceText
