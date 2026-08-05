import React, { useCallback, useContext, useEffect } from 'react'
import { usePageVisibility } from 'react-page-visibility'
import { useQuery } from 'react-query'

import { EngineContext, ENGINE_ACTION_TYPE } from '../contexts/EngineContext'

import {
  getBookmarkAuto,
  saveBookmarkLiveEvent,
  saveLiveEventDate
} from '../lib/api'

import {
  AUTO_ENGINE_BOOKMARK_KEY,
  INITIAL_LIVE_ENGINE_EVENT_ORIGIN_KEY
} from '../lib'

import TitleCard from './TitleCard'
import AudioMixer from './AudioMixer'
import EventStreamTitleBar from './LiveEventStreamTitleBar'
import LiveEventStream from './LiveEventStream'

import EventXRay, { ENGINE_XRAY_CONTAINER_HEIGHT } from './EventXRay'
import ErrorNotification from './ErrorNotification'
import ObjectPanel from './ObjectPanel'

import useImageLoader from '../lib/hooks/useImageLoader'

const Renderer: React.FC = React.memo(() => {
  const { engine, engineDispatch } = useContext(EngineContext)

  // elmstorygames/feedback#268
  const visible = usePageVisibility()

  const { data: autoBookmark } = useQuery(
    'autoBookmark',
    async () =>
      engine.worldInfo &&
      (await getBookmarkAuto(engine.worldInfo.studioId, engine.worldInfo.id))
  )

  const startWorld = useCallback(async () => {
    if (engine.worldInfo) {
      const updatedBookmark = await saveBookmarkLiveEvent(
        engine.worldInfo.studioId,
        `${AUTO_ENGINE_BOOKMARK_KEY}${engine.worldInfo.id}`,
        `${INITIAL_LIVE_ENGINE_EVENT_ORIGIN_KEY}${engine.worldInfo.id}`
      )

      updatedBookmark &&
        (await saveLiveEventDate(
          engine.worldInfo.studioId,
          `${INITIAL_LIVE_ENGINE_EVENT_ORIGIN_KEY}${engine.worldInfo.id}`,
          updatedBookmark.updated
        ))

      engineDispatch({
        type: ENGINE_ACTION_TYPE.PLAY,
        fromEvent: `${INITIAL_LIVE_ENGINE_EVENT_ORIGIN_KEY}${engine.worldInfo.id}`
      })
    }
  }, [engine.worldInfo])

  const continueWorld = useCallback(() => {
    autoBookmark &&
      engineDispatch({
        type: ENGINE_ACTION_TYPE.PLAY,
        fromEvent: autoBookmark.liveEventId
      })
  }, [autoBookmark])

  useEffect(() => {
    if (engine.worldInfo && engine.isComposer) {
      autoBookmark?.liveEventId ? continueWorld() : startWorld()
    }
  }, [engine.worldInfo, engine.isComposer])

  useEffect(() => {
    engineDispatch({ type: ENGINE_ACTION_TYPE.SET_VISIBLE, visible })
  }, [visible])

  // The storyworld's background, filled behind the reading column and shown in
  // the window's gutters around it. The reply guard keys on both ids, so this and
  // the title card's cover (both correlated on the world id) do not answer each
  // other. Empty placeholder: a world with no background shows none, which is how
  // every pre-0.8.0 storyworld keeps the presentation it has.
  const backgroundData = useImageLoader({
    eventId: engine.worldInfo?.id ?? '',
    assetId: engine.worldInfo?.backgroundAssetId,
    placeholder: '',
    ext: 'webp'
  })

  return (
    <div id="renderer">
      {engine.worldInfo && (
        <>
          {backgroundData && (
            <div
              id="world-background"
              style={{ backgroundImage: `url(${backgroundData})` }}
            />
          )}

          <AudioMixer />

          {!engine.playing && !engine.isComposer && (
            <TitleCard
              onStartWorld={startWorld}
              onContinueWorld={continueWorld}
            />
          )}

          {engine.playing && (
            <>
              {!engine.isComposer && <EventStreamTitleBar />}
              <LiveEventStream />

              {/*
                Renders nothing when the world has no objects, which is how every
                storyworld written before 0.8.0 keeps exactly the presentation it
                has today. Mounted outside the composer branch because it belongs
                to the played world rather than to the preview.
              */}
              <ObjectPanel />

              {engine.isComposer && (
                <>
                  {engine.worldInfo && engine.devTools.xrayVisible && (
                    <div
                      style={{
                        height: ENGINE_XRAY_CONTAINER_HEIGHT
                      }}
                      id="engine-xray-wrapper"
                    >
                      {engine.liveEventsInStream.length > 0 && (
                        <EventXRay event={engine.liveEventsInStream[0]} />
                      )}
                    </div>
                  )}

                  <ErrorNotification />
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
})

Renderer.displayName = 'Renderer'

export default Renderer
