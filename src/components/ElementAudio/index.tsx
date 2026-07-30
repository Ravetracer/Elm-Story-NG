import { ipcRenderer } from 'electron'
import { v4 as uuid } from 'uuid'

import React, { useState } from 'react'

import { ASSET_KIND } from '../../lib/assets'
import { WINDOW_EVENT_TYPE } from '../../lib/events'
import { Event, Scene, StudioId, ELEMENT_TYPE } from '../../data/types'

import AudioProfile from '../AudioProfile'
import { AssetsModal } from '../Modal'

import api from '../../api'

const ElementAudio: React.FC<{
  studioId: StudioId
  elementType: ELEMENT_TYPE
  element: Scene | Event
  className?: string
}> = ({ studioId, elementType, element, className }) => {
  const [choosingAudio, setChoosingAudio] = useState(false)

  let elementSaveEndpoint: (
    studioId: StudioId,
    element: Scene | Event
  ) => Promise<string | Event>

  switch (elementType) {
    case ELEMENT_TYPE.SCENE:
      // @ts-ignore
      elementSaveEndpoint = api().scenes.saveScene
      break
    case ELEMENT_TYPE.EVENT:
      // @ts-ignore
      elementSaveEndpoint = api().events.saveEvent
      break
    default:
      break
  }

  // below the hook, not above it: an early return over a hook changes hook
  // order between renders
  if (!element.id) return null

  return (
    <>
      <AssetsModal
        studioId={studioId}
        worldId={element.worldId}
        subject={element.title}
        visible={choosingAudio}
        selectKind={ASSET_KIND.AUDIO}
        selectedAssetId={element.audio?.[0]}
        onSelect={async (assetId) => {
          /*
           * Only the reference is written. The track this element was playing is
           * left on disk: two events may share one mp3, so whether the old track
           * is now dead is a question for the asset manager.
           */
          await elementSaveEndpoint(studioId, {
            ...element,
            audio: [assetId, element.audio ? element.audio[1] : false]
          })

          setChoosingAudio(false)
        }}
        onCancel={() => setChoosingAudio(false)}
      />

      <div className={className}>
        <AudioProfile
          profile={element.audio}
          info
          onImport={async (audioData) => {
            const assetId = uuid()

            try {
              /*
               * The track being replaced is left on disk. It used to be removed
               * here, outright and without counting: two events may share one
               * mp3, so that took the file out from under the other. Whether the
               * old track is now dead is a question about the whole storyworld,
               * and the asset manager is what answers it.
               */
              await ipcRenderer.invoke(WINDOW_EVENT_TYPE.SAVE_ASSET, {
                studioId,
                worldId: element.worldId,
                id: assetId,
                data: audioData,
                ext: 'mp3'
              })

              await elementSaveEndpoint(studioId, {
                ...element,
                audio: [assetId, element.audio ? element.audio[1] : false]
              })
            } catch (error) {
              throw error
            }
          }}
          onRequestAudioPath={async (assetId) => {
            return await ipcRenderer.invoke(WINDOW_EVENT_TYPE.GET_ASSET, {
              studioId,
              worldId: element.worldId,
              id: assetId,
              ext: 'mp3'
            })
          }}
          onChoose={() => setChoosingAudio(true)}
          onSelect={async (profile) => {
            try {
              await elementSaveEndpoint(studioId, {
                ...element,
                audio: profile
              })
            } catch (error) {
              throw error
            }
          }}
          onRemove={async () => {
            if (!element.audio?.[0]) return

            const assetId = element.audio[0]

            try {
              // the reference is cleared first, because the count that decides
              // whether the file is dead is read back out of the database
              await elementSaveEndpoint(studioId, {
                ...element,
                audio: undefined
              })

              await api().assets.removeAssetIfUnreferenced(
                studioId,
                element.worldId,
                assetId,
                'mp3'
              )
            } catch (error) {
              throw error
            }
          }}
        />
      </div>
    </>
  )
}

ElementAudio.displayName = 'ElementAudio'

export default ElementAudio
