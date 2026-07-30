import React, { useContext } from 'react'
import { useQuery } from 'react-query'

import { getBookmarkAuto } from '../lib/api'

import {
  SettingsContext,
  SETTINGS_ACTION_TYPE
} from '../contexts/SettingsContext'
import { EngineContext } from '../contexts/EngineContext'

const TitleCard: React.FC<{
  onStartWorld: () => void
  onContinueWorld: () => void
}> = ({ onStartWorld, onContinueWorld }) => {
  const { settingsDispatch } = useContext(SettingsContext),
    { engine } = useContext(EngineContext)

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
              {!autoBookmark.data.liveEventId ? 'Start' : 'Continue'}
            </button>

            <button
              id="title-card-settings-btn"
              onClick={() =>
                settingsDispatch({ type: SETTINGS_ACTION_TYPE.OPEN })
              }
            >
              <span className="event-content-choice-icon">&raquo;</span>
              Settings
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
