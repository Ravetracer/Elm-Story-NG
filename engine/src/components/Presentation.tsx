import React, { useContext, useEffect } from 'react'
import { useQuery } from 'react-query'

import {
  SettingsContext,
  SETTINGS_ACTION_TYPE
} from '../contexts/SettingsContext'

import { EngineContext } from '../contexts/EngineContext'

import { getPresentationSettings } from '../lib/api'

import { resolveTheme } from '../lib/theme'

const Presentation: React.FC = ({ children }) => {
  const { engine } = useContext(EngineContext),
    { settings, settingsDispatch } = useContext(SettingsContext)

  const { data: presentationSettings } = useQuery(
    ['presentation', engine],
    async () => {
      if (!engine.worldInfo) return

      const { studioId, id: worldId } = engine.worldInfo

      return await getPresentationSettings(studioId, worldId)
    }
  )

  useEffect(() => {
    presentationSettings?.theme &&
      settingsDispatch({
        type: SETTINGS_ACTION_TYPE.SET_THEME,
        theme: presentationSettings.theme,
        closeSettings: true
      })
  }, [presentationSettings?.theme])

  useEffect(() => {
    presentationSettings?.font &&
      settingsDispatch({
        type: SETTINGS_ACTION_TYPE.SET_FONT,
        font: presentationSettings.font,
        closeSettings: true
      })
  }, [presentationSettings?.font])

  useEffect(() => {
    presentationSettings?.motion &&
      settingsDispatch({
        type: SETTINGS_ACTION_TYPE.SET_MOTION,
        motion: presentationSettings.motion,
        closeSettings: true
      })
  }, [presentationSettings?.motion])

  useEffect(() => {
    presentationSettings?.muted &&
      settingsDispatch({
        type: SETTINGS_ACTION_TYPE.SET_MUTED,
        muted: presentationSettings.muted,
        closeSettings: true
      })
  }, [presentationSettings?.muted])

  useEffect(() => {
    presentationSettings?.size &&
      settingsDispatch({
        type: SETTINGS_ACTION_TYPE.SET_SIZE,
        size: presentationSettings.size,
        closeSettings: true
      })
  }, [presentationSettings?.size])

  // The author's locked theme wins over the player's own choice. Absent, the
  // player's choice stands. `resolveTheme` is the one rule; `Settings` hides the
  // player's toggle when the world locks it, so the two cannot disagree.
  const theme = resolveTheme(engine.worldInfo?.theme, settings.theme)

  useEffect(() => {
    theme && document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    settings.font &&
      document.documentElement.setAttribute('data-font', settings.font)
  }, [settings.font])

  useEffect(() => {
    settings.motion &&
      document.documentElement.setAttribute('data-motion', settings.motion)
  }, [settings.motion])

  useEffect(() => {
    settings.size &&
      document.documentElement.setAttribute('data-size', settings.size)
  }, [settings.size])

  // The author's colour overrides moved to `ThemeColors`, which is mounted in
  // both the composer preview and an exported PWA — this component is only in the
  // export, so the overrides never reached the editor from here.

  return (
    <>
      {theme &&
        settings.font &&
        settings.motion &&
        settings.size &&
        children}
    </>
  )
}

Presentation.displayName = 'Presentation'

export default Presentation
