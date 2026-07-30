import { ipcRenderer } from 'electron'

import React, { useEffect, useState } from 'react'

import { StudioId, WorldId } from '../../data/types'
import { WINDOW_EVENT_TYPE } from '../../lib/events'
import { ASSET_KIND, ASSET_KINDS } from '../../lib/assets'

import { PictureOutlined } from '@ant-design/icons'

import styles from './styles.module.less'

/**
 * An object's image in the list, so a list of names is also a list of things.
 *
 * The URL comes from the `GET_ASSET` IPC rather than a filesystem path: user
 * assets live under `userData`, outside the bundle, and the renderer is served over
 * http in development and from `file://` when packaged, so a path is not a usable
 * URL in either. The handler returns an `esg-asset://` URL **wrapped in double
 * quotes**, because most callers interpolate it straight into a CSS `url()` — which
 * is what this does too.
 *
 * A placeholder is shown rather than nothing when there is no image or the file has
 * gone missing, so a row keeps its shape and an absent image is visible as absent.
 */
const ObjectThumbnail: React.FC<{
  studioId: StudioId
  worldId: WorldId
  assetId?: string
}> = ({ studioId, worldId, assetId }) => {
  const [quotedUrl, setQuotedUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    let stale = false

    async function getAssetUrl() {
      if (!assetId) {
        setQuotedUrl(undefined)

        return
      }

      const [url, exists]: [string, boolean] = await ipcRenderer.invoke(
        WINDOW_EVENT_TYPE.GET_ASSET,
        {
          studioId,
          worldId,
          id: assetId,
          ext: ASSET_KINDS[ASSET_KIND.OBJECT_IMAGE].ext
        }
      )

      // the list re-renders as objects are edited, so a resolved URL can arrive
      // after this row has moved on to another asset
      if (!stale) setQuotedUrl(exists ? url : undefined)
    }

    getAssetUrl()

    return () => {
      stale = true
    }
  }, [studioId, worldId, assetId])

  return (
    <div
      className={styles.thumbnail}
      style={
        quotedUrl ? { backgroundImage: `url(${quotedUrl})` } : undefined
      }
    >
      {!quotedUrl && <PictureOutlined className={styles.thumbnailEmpty} />}
    </div>
  )
}

ObjectThumbnail.displayName = 'ObjectThumbnail'

export default ObjectThumbnail
