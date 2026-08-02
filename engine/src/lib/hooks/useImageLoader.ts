import { useCallback, useContext, useEffect, useState } from 'react'

import { EngineContext } from '../../contexts/EngineContext'
import {
  EngineDevToolsLiveEvent,
  ENGINE_DEVTOOLS_LIVE_EVENTS,
  ENGINE_DEVTOOLS_LIVE_EVENT_TYPE
} from '../../types'

const getRemoteImageAsDataURL = async (
  src: string
): Promise<string | ArrayBuffer | null> => {
  const response = await fetch(src),
    blob = await response.blob()

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      resolve(reader.result === 'data:' ? null : reader.result)
    }

    reader.onerror = reject

    reader.readAsDataURL(blob)
  })
}

/**
 * Whether a `RETURN_ASSET_URL` reply belongs to this hook.
 *
 * Every mounted image listens on the **same window event**, so each one hears every
 * other one's reply. Answering "not mine" is therefore not the same as answering
 * "there is no asset", and conflating the two is what made an object rail showing
 * two images end up showing one: each reply that arrived wiped every image already
 * loaded, so only the last one to answer kept its picture.
 *
 * Both halves matter. `eventId` says which *hook* asked — one per tile. `assetId`
 * says which *asset* it asked for, which changes under a hook when a stack grows
 * past one and switches to its stacked image, so a reply for the previous asset is
 * stale and must be dropped rather than rendered.
 */
export const isAssetReplyFor = (
  detail: EngineDevToolsLiveEvent,
  eventId: string,
  assetId?: string
): boolean =>
  detail.eventType === ENGINE_DEVTOOLS_LIVE_EVENT_TYPE.RETURN_ASSET_URL &&
  detail.eventId === eventId &&
  detail.asset?.id === assetId

const useImageLoader = ({
  eventId,
  assetId,
  placeholder,
  ext
}: {
  eventId: string
  assetId?: string
  placeholder: string
  ext: 'jpeg' | 'webp'
}) => {
  const { engine } = useContext(EngineContext)

  const [imageData, setImageData] = useState<string | undefined | null>(
    undefined
  )

  const processDevToolsEvent = useCallback(
    async (event: Event) => {
      const { detail } = event as CustomEvent<EngineDevToolsLiveEvent>

      // Somebody else's reply, or one for an asset this hook has moved on from.
      // Ignored rather than treated as an absent asset; see isAssetReplyFor.
      if (!isAssetReplyFor(detail, eventId, assetId)) return

      if (detail.asset?.url) {
        setImageData(
          (await getRemoteImageAsDataURL(
            detail.asset.url.replaceAll('"', '')
          )) as string | null
        )

        return
      }

      // this hook's asset, and the composer had no url for it
      setImageData(assetId ? null : placeholder)
    },
    [eventId, assetId, placeholder, ext]
  )

  useEffect(() => {
    async function getImageUrl() {
      if (!assetId) {
        setImageData(placeholder)

        return
      }

      if (!engine.isComposer && assetId) {
        let imageSrc

        // local development
        // imageSrc = `../../data/0-7-test/assets/${assetId}.${ext}`
        // #PWA
        imageSrc = `./assets/content/${assetId}.${ext}`

        try {
          setImageData(
            (await getRemoteImageAsDataURL(imageSrc)) as string | null
          )
        } catch (error) {
          setImageData(null)
        }

        return
      }

      window.dispatchEvent(
        new CustomEvent<EngineDevToolsLiveEvent>(
          ENGINE_DEVTOOLS_LIVE_EVENTS.ENGINE_TO_COMPOSER,
          {
            detail: {
              eventType: ENGINE_DEVTOOLS_LIVE_EVENT_TYPE.GET_ASSET_URL,
              eventId,
              asset: {
                id: assetId,
                ext
              }
            }
          }
        )
      )
    }

    getImageUrl()
  }, [eventId, assetId, placeholder, ext, engine.devTools])

  useEffect(() => {
    if (engine.isComposer) {
      window.addEventListener(
        ENGINE_DEVTOOLS_LIVE_EVENTS.COMPOSER_TO_ENGINE,
        processDevToolsEvent
      )
    }

    return () => {
      if (engine.isComposer) {
        window.removeEventListener(
          ENGINE_DEVTOOLS_LIVE_EVENTS.COMPOSER_TO_ENGINE,
          processDevToolsEvent
        )
      }
    }
  }, [eventId, assetId, placeholder, ext])

  return imageData
}

export default useImageLoader
