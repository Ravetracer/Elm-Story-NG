import React, { useCallback, useContext } from 'react'

import { resetWorld, savePresentationSettings } from '../lib/api'

import { ENGINE_MOTION, ENGINE_FONT, ENGINE_SIZE, ENGINE_THEME } from '../types'

import { EngineContext } from '../contexts/EngineContext'
import {
  SettingsContext,
  SETTINGS_ACTION_TYPE
} from '../contexts/SettingsContext'

import useInterfaceText from '../lib/hooks/useInterfaceText'
import { INTERFACE_TEXT_KEY } from '../lib/interfaceText'

import SettingsTitleBar from './SettingsTitleBar'

const Settings: React.FC = () => {
  const t = useInterfaceText()

  const { engine } = useContext(EngineContext),
    { settings, settingsDispatch } = useContext(SettingsContext)

  const studioId = engine.worldInfo?.studioId,
    worldId = engine.worldInfo?.id

  const { theme, font, motion, muted, size } = settings

  const setTheme = useCallback(
    async (selectedTheme: ENGINE_THEME) => {
      if (!studioId || !worldId) return

      settingsDispatch({
        type: SETTINGS_ACTION_TYPE.SET_THEME,
        theme: selectedTheme,
        closeSettings: false
      })

      await savePresentationSettings(studioId, worldId, {
        theme: selectedTheme,
        font,
        motion,
        size,
        muted
      })
    },
    [studioId, worldId, theme, font, motion, muted, size]
  )

  const setFont = useCallback(
    async (selectedFont: ENGINE_FONT) => {
      if (!studioId || !worldId) return

      settingsDispatch({
        type: SETTINGS_ACTION_TYPE.SET_FONT,
        font: selectedFont,
        closeSettings: false
      })

      await savePresentationSettings(studioId, worldId, {
        theme,
        font: selectedFont,
        motion,
        muted,
        size: size
      })
    },
    [studioId, worldId, theme, font, motion, muted, size]
  )

  const setSize = useCallback(
    async (selectedSize: ENGINE_SIZE) => {
      if (!studioId || !worldId) return

      settingsDispatch({
        type: SETTINGS_ACTION_TYPE.SET_SIZE,
        size: selectedSize,
        closeSettings: false
      })

      await savePresentationSettings(studioId, worldId, {
        theme,
        font,
        motion,
        muted,
        size: selectedSize
      })
    },
    [studioId, worldId, theme, font, motion, muted, size]
  )

  const setMotion = useCallback(
    async (selectedMotion: ENGINE_MOTION) => {
      if (!studioId || !worldId) return

      settingsDispatch({
        type: SETTINGS_ACTION_TYPE.SET_MOTION,
        motion: selectedMotion,
        closeSettings: false
      })

      await savePresentationSettings(studioId, worldId, {
        theme,
        font,
        motion: selectedMotion,
        muted,
        size
      })
    },
    [studioId, worldId, theme, font, motion, muted, size]
  )

  if (!engine.worldInfo) return null

  const {
    copyright,
    description,
    designer,
    studioTitle,
    title,
    version,
    website
  } = engine.worldInfo

  if (!settings.open) return null

  return (
    <>
      <div id="settings">
        <SettingsTitleBar />

        <div id="settings-content">
          <section>
            <h1>{t(INTERFACE_TEXT_KEY.SETTINGS_PRESENTATION)}</h1>

            {/*
             * The theme toggle is hidden when the author has locked the
             * storyworld to a theme — the setting would be stored and never
             * applied, since `Presentation` resolves the world's theme over the
             * player's. A control that does nothing is worse than an absent one.
             */}
            {!engine.worldInfo?.theme && (
              <div>
                <h2>{t(INTERFACE_TEXT_KEY.SETTINGS_THEME)}</h2>
                <p>
                  <a
                    className={
                      settings.theme === ENGINE_THEME.CONSOLE
                        ? 'settings-active'
                        : ''
                    }
                    onClick={() => setTheme(ENGINE_THEME.CONSOLE)}
                  >
                    {t(INTERFACE_TEXT_KEY.SETTINGS_THEME_DARK)}
                  </a>{' '}
                  <span>|</span>{' '}
                  <a
                    className={
                      settings.theme === ENGINE_THEME.BOOK
                        ? 'settings-active'
                        : ''
                    }
                    onClick={() => setTheme(ENGINE_THEME.BOOK)}
                  >
                    {t(INTERFACE_TEXT_KEY.SETTINGS_THEME_LIGHT)}
                  </a>
                </p>
              </div>
            )}

            <div>
              <h2>{t(INTERFACE_TEXT_KEY.SETTINGS_FONT)}</h2>
              <p>
                <a
                  className={
                    settings.font === ENGINE_FONT.SERIF ? 'settings-active' : ''
                  }
                  onClick={() => setFont(ENGINE_FONT.SERIF)}
                >
                  {t(INTERFACE_TEXT_KEY.SETTINGS_FONT_SERIF)}
                </a>{' '}
                <span>|</span>{' '}
                <a
                  className={
                    settings.font === ENGINE_FONT.SANS ? 'settings-active' : ''
                  }
                  onClick={() => setFont(ENGINE_FONT.SANS)}
                >
                  {t(INTERFACE_TEXT_KEY.SETTINGS_FONT_SANS)}
                </a>
              </p>
            </div>

            <div>
              <h2>{t(INTERFACE_TEXT_KEY.SETTINGS_SIZE)}</h2>
              <p>
                <a
                  className={
                    settings.size === ENGINE_SIZE.DEFAULT
                      ? 'settings-active'
                      : ''
                  }
                  onClick={() => setSize(ENGINE_SIZE.DEFAULT)}
                >
                  {t(INTERFACE_TEXT_KEY.SETTINGS_SIZE_DEFAULT)}
                </a>{' '}
                <span>|</span>{' '}
                <a
                  className={
                    settings.size === ENGINE_SIZE.LARGE ? 'settings-active' : ''
                  }
                  onClick={() => setSize(ENGINE_SIZE.LARGE)}
                >
                  {t(INTERFACE_TEXT_KEY.SETTINGS_SIZE_LARGE)}
                </a>
              </p>
            </div>

            <div>
              <h2>{t(INTERFACE_TEXT_KEY.SETTINGS_MOTION)}</h2>
              <p>
                <a
                  className={
                    settings.motion === ENGINE_MOTION.FULL
                      ? 'settings-active'
                      : ''
                  }
                  onClick={() => setMotion(ENGINE_MOTION.FULL)}
                >
                  {t(INTERFACE_TEXT_KEY.SETTINGS_MOTION_FULL)}
                </a>{' '}
                <span>|</span>{' '}
                <a
                  className={
                    settings.motion === ENGINE_MOTION.REDUCED
                      ? 'settings-active'
                      : ''
                  }
                  onClick={() => setMotion(ENGINE_MOTION.REDUCED)}
                >
                  {t(INTERFACE_TEXT_KEY.SETTINGS_MOTION_REDUCED)}
                </a>
              </p>
            </div>
          </section>

          <section>
            <h1>{t(INTERFACE_TEXT_KEY.SETTINGS_WORLD)}</h1>

            <div>
              <h2>{t(INTERFACE_TEXT_KEY.SETTINGS_WORLD_TITLE)}</h2>
              <p>{title}</p>
            </div>

            {description && (
              <div>
                <h2>{t(INTERFACE_TEXT_KEY.SETTINGS_WORLD_DESCRIPTION)}</h2>
                <p>{description}</p>
              </div>
            )}

            <div>
              <h2>{t(INTERFACE_TEXT_KEY.SETTINGS_WORLD_STUDIO)}</h2>
              <p>{studioTitle}</p>
            </div>

            <div>
              <h2>{t(INTERFACE_TEXT_KEY.SETTINGS_WORLD_DESIGNER)}</h2>
              <p>{designer}</p>
            </div>

            <div>
              <h2>{t(INTERFACE_TEXT_KEY.SETTINGS_WORLD_VERSION)}</h2>
              <p>{version}</p>
            </div>

            {copyright && (
              <div>
                <h2>{t(INTERFACE_TEXT_KEY.SETTINGS_WORLD_COPYRIGHT)}</h2>
                <p>{copyright}</p>
              </div>
            )}

            {website && (
              <div>
                <h2>{t(INTERFACE_TEXT_KEY.SETTINGS_WORLD_WEBSITE)}</h2>
                <p>
                  <a href={website} target="_blank" rel="noreferrer">
                    {website}
                  </a>
                </p>
              </div>
            )}

            {import.meta.env.MODE === 'development' && (
              <div>
                <h2>Storyteller Mode</h2>
                <p>{import.meta.env.MODE}</p>
              </div>
            )}

            <div>
              <h2>{t(INTERFACE_TEXT_KEY.SETTINGS_TOOLS)}</h2>
              <p>
                <a
                  onClick={async () => {
                    if (studioId && worldId) {
                      await resetWorld(studioId, worldId)
                      location.reload()
                    }
                  }}
                >
                  {t(INTERFACE_TEXT_KEY.SETTINGS_RESET_WORLD)}
                </a>
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

Settings.displayName = 'Settings'

export default Settings
