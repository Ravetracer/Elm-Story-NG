import { ipcRenderer } from 'electron'

import React, { useEffect, useState } from 'react'

import { StudioId, WorldId } from '../../data/types'
import { WINDOW_EVENT_TYPE } from '../../lib/events'
import { ASSET_KIND, ASSET_KINDS } from '../../lib/assets'

import { PictureOutlined } from '@ant-design/icons'

import styles from './styles.module.less'

/**
 * Any image asset, as a thumbnail.
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
 *
 * **The extension comes from the kind**, which is what makes this reusable: every
 * read site asks for the extension its kind was processed as, and the picker filters
 * on the same, so an asset offered for a slot is always fetchable in it. Getting
 * that wrong fetches a file that comes back missing — the failure `CLAUDE.md`
 * records for character masks.
 */
const AssetThumbnail: React.FC<{
  studioId: StudioId
  worldId: WorldId
  kind: ASSET_KIND
  assetId?: string
  /** sizing is the caller's, since a 32px row and a 16:9 cover want different boxes */
  className?: string
}> = ({ studioId, worldId, kind, assetId, className }) => {
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
        { studioId, worldId, id: assetId, ext: ASSET_KINDS[kind].ext }
      )

      // a list re-renders as its rows are edited, so a resolved URL can arrive
      // after this one has moved on to another asset
      if (!stale) setQuotedUrl(exists ? url : undefined)
    }

    getAssetUrl()

    return () => {
      stale = true
    }
  }, [studioId, worldId, kind, assetId])

  return (
    <div
      className={`${styles.thumbnail} ${className ?? ''}`}
      style={quotedUrl ? { backgroundImage: `url(${quotedUrl})` } : undefined}
    >
      {!quotedUrl && <PictureOutlined className={styles.thumbnailEmpty} />}
    </div>
  )
}

AssetThumbnail.displayName = 'AssetThumbnail'

export default AssetThumbnail
