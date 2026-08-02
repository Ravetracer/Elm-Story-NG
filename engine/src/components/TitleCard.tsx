import React, { useContext } from 'react'
import { useQuery } from 'react-query'

import { getBookmarkAuto } from '../lib/api'

import {
  SettingsContext,
  SETTINGS_ACTION_TYPE
} from '../contexts/SettingsContext'
import useImageLoader from '../lib/hooks/useImageLoader'
import useInterfaceText from '../lib/hooks/useInterfaceText'
import { INTERFACE_TEXT_KEY } from '../lib/interfaceText'

import { EngineContext } from '../contexts/EngineContext'

const TitleCard: React.FC<{
  onStartWorld: () => void
  onContinueWorld: () => void
}> = ({ onStartWorld, onContinueWorld }) => {
  const { settingsDispatch } = useContext(SettingsContext),
    { engine } = useContext(EngineContext)

  const t = useInterfaceText()

  /*
   * The storyworld's cover, behind the title. `eventId` is a correlation token
   * rather than a real event — the composer's GET_ASSET_URL handler resolves on the
   * asset's id and echoes this back so the requesting hook recognises its own reply
   * — so the world's id serves, there being exactly one cover.
   *
   * The placeholder is empty: a world with no cover shows no cover, which is how
   * every storyworld written before this keeps the title card it has.
   */
  const coverData = useImageLoader({
    eventId: engine.worldInfo?.id ?? '',
    assetId: engine.worldInfo?.coverAssetId,
    placeholder: '',
    ext: 'webp'
  })

  const { studioId, id: worldId } = engine.worldInfo ?? {}

  const autoBookmark = useQuery(
    'autoBookmark',
    async () => {
      if (!studioId || !worldId) return null

      return await getBookmarkAuto(studioId, worldId)
    },
    { enabled: !!studioId && !!worldId }
  )

  return (
    <>
      {engine.worldInfo && autoBookmark.data && (
        <div id="title-card">
          {coverData && (
            <div
              id="title-card-cover"
              style={{ backgroundImage: `url(${coverData})` }}
            />
          )}

          <div id="title-card-studio-title">
            {engine.worldInfo.studioTitle} presents...
          </div>

          <div id="title-card-world-title">{engine.worldInfo.title}</div>

          <div id="title-card-world-version">v{engine.worldInfo.version}</div>

          {/* <div id="title-card-world-designer">
            designed by {engine.worldInfo.designer}
          </div> */}

          <div id="title-card-btns">
            <button
              id="title-card-start-btn"
              onClick={
                !autoBookmark.data.liveEventId ? onStartWorld : onContinueWorld
              }
            >
              <span className="event-content-choice-icon">&raquo;</span>
              {t(
                autoBookmark.data.liveEventId
                  ? INTERFACE_TEXT_KEY.TITLE_CARD_CONTINUE
                  : INTERFACE_TEXT_KEY.TITLE_CARD_START
              )}
            </button>

            <button
              id="title-card-settings-btn"
              onClick={() =>
                settingsDispatch({ type: SETTINGS_ACTION_TYPE.OPEN })
              }
            >
              <span className="event-content-choice-icon">&raquo;</span>
              {t(INTERFACE_TEXT_KEY.TITLE_CARD_SETTINGS)}
            </button>
          </div>

          {/* Plain text rather than the link this was: it pointed at
              elmstory.com, which no longer resolves, and this footer ships inside
              every exported storyworld — where a broken link is the first thing a
              player sees. */}
          <div id="title-card-footer">made with Elm Story - NG</div>
        </div>
      )}
    </>
  )
}

TitleCard.displayName = 'TitleCard'

export default TitleCard
