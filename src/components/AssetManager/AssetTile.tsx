import { ipcRenderer } from 'electron'

import React, { useEffect, useState } from 'react'

import { StudioId, WorldId } from '../../data/types'
import { WINDOW_EVENT_TYPE } from '../../lib/events'
import {
  ASSET_MEDIA,
  ASSET_REFERENCE_TYPE,
  assetMedia,
  AssetReference,
  isAssetUnused,
  isReferenceClearable,
  formatAssetBytes,
  ManagedAsset
} from '../../lib/assets'

import { Button, Popconfirm, Tooltip } from 'antd'
import {
  DeleteOutlined,
  DisconnectOutlined,
  FileUnknownOutlined,
  SoundOutlined,
  WarningOutlined
} from '@ant-design/icons'

import styles from './styles.module.less'

const referenceLabel = ({
  type,
  elementTitle,
  detail
}: AssetReference): string => {
  switch (type) {
    case ASSET_REFERENCE_TYPE.CHARACTER_MASK:
      return `Character '${elementTitle}'${
        detail ? ` (${detail.toLowerCase()})` : ''
      }`
    case ASSET_REFERENCE_TYPE.EVENT_IMAGE:
      return `Event '${elementTitle}' content`
    case ASSET_REFERENCE_TYPE.EVENT_AUDIO:
      return `Event '${elementTitle}' audio`
    case ASSET_REFERENCE_TYPE.OBJECT_IMAGE:
      return `Object '${elementTitle}'`
    case ASSET_REFERENCE_TYPE.OBJECT_STACKED_IMAGE:
      return `Object '${elementTitle}' (stacked)`
    case ASSET_REFERENCE_TYPE.SCENE_AUDIO:
      return `Scene '${elementTitle}' audio`
    case ASSET_REFERENCE_TYPE.WORLD_COVER:
      return `Storyworld '${elementTitle}' cover`
    case ASSET_REFERENCE_TYPE.WORLD_BACKGROUND:
      return `Storyworld '${elementTitle}' background`
  }
}

const VISIBLE_REFERENCES = 2

const AssetTile: React.FC<{
  studioId: StudioId
  worldId: WorldId
  asset: ManagedAsset
  working: boolean
  onRemove: () => Promise<void>
  /**
   * Set when the manager is being used to choose an asset rather than to tidy
   * one up. The tile becomes the control, and the removal affordance goes: a
   * grid where one click assigns and a neighbouring one trashes is a grid where
   * the wrong click is expensive.
   */
  onSelect?: () => void
  selected?: boolean
}> = ({
  studioId,
  worldId,
  asset,
  working,
  onRemove,
  onSelect,
  selected
}) => {
  // GET_ASSET returns the URL wrapped in double quotes, because most callers
  // interpolate it straight into a CSS url(). An <audio> src needs it bare.
  const [quotedUrl, setQuotedUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    async function getAssetUrl() {
      if (asset.missing) {
        setQuotedUrl(undefined)

        return
      }

      const [url, exists]: [string, boolean] = await ipcRenderer.invoke(
        WINDOW_EVENT_TYPE.GET_ASSET,
        { studioId, worldId, id: asset.id, ext: asset.ext }
      )

      setQuotedUrl(exists ? url : undefined)
    }

    getAssetUrl()
  }, [studioId, worldId, asset.id, asset.ext, asset.missing])

  const media = assetMedia(asset),
    unused = isAssetUnused(asset),
    clearable = asset.references.every(({ type }) =>
      isReferenceClearable(type)
    ),
    hiddenReferenceCount = asset.references.length - VISIBLE_REFERENCES

  let confirmTitle: string

  if (unused) {
    confirmTitle = 'Move this asset to the trash?'
  } else if (asset.missing) {
    confirmTitle = `Remove the reference from ${asset.references.length} ${
      asset.references.length === 1 ? 'element' : 'elements'
    }?`
  } else {
    confirmTitle = `Remove from ${asset.references.length} ${
      asset.references.length === 1 ? 'element' : 'elements'
    } and move the asset to the trash?`
  }

  // no `danger`: App.global.less forces a red border on .ant-btn-dangerous with
  // !important, which is meant for bordered buttons and boxes in an icon-only
  // link button. The Popconfirm is what guards the action.
  const removeButton = (
    <Button
      size="small"
      type="link"
      disabled={!clearable || working}
      className={styles.removeButton}
    >
      {asset.missing ? <DisconnectOutlined /> : <DeleteOutlined />}
    </Button>
  )

  return (
    <div
      className={[
        styles.AssetTile,
        asset.missing ? styles.isMissing : '',
        onSelect ? styles.selectable : '',
        selected ? styles.selected : ''
      ]
        .filter(Boolean)
        .join(' ')}
      // a missing asset has no file to assign, so it stays inert
      onClick={onSelect && !asset.missing ? onSelect : undefined}
    >
      <div className={styles.preview}>
        {asset.missing && (
          <div className={styles.previewPlaceholder}>
            <WarningOutlined />
          </div>
        )}

        {!asset.missing && media === ASSET_MEDIA.IMAGE && (
          <div
            className={styles.previewImage}
            style={{
              backgroundImage: quotedUrl ? `url(${quotedUrl})` : undefined
            }}
          />
        )}

        {!asset.missing && media === ASSET_MEDIA.AUDIO && (
          <div className={styles.previewAudio}>
            <SoundOutlined />

            {quotedUrl && (
              <audio
                controls
                src={quotedUrl.replace(/^"|"$/g, '')}
                // scrubbing a track is not choosing it
                onClick={(event) => event.stopPropagation()}
              />
            )}
          </div>
        )}

        {!asset.missing && media === ASSET_MEDIA.OTHER && (
          <div className={styles.previewPlaceholder}>
            <FileUnknownOutlined />
          </div>
        )}
      </div>

      <div className={styles.meta}>
        <Tooltip title={`${asset.id}.${asset.ext}`} mouseEnterDelay={0.5}>
          <span className={styles.id}>{asset.id.substring(0, 8)}</span>
        </Tooltip>

        <span className={styles.size}>
          {asset.missing
            ? 'file missing'
            : // a file with no extension at all reads as just its size
              [asset.ext, formatAssetBytes(asset.bytes)]
                .filter(Boolean)
                .join(' · ')}
        </span>

        {onSelect ? null : clearable ? (
          <Popconfirm
            title={confirmTitle}
            okText={asset.missing ? 'Remove Reference' : 'Move to Trash'}
            cancelText="Cancel"
            disabled={working}
            onConfirm={onRemove}
          >
            {removeButton}
          </Popconfirm>
        ) : (
          // a disabled button swallows its own mouse events, so the tooltip has
          // to hang off a wrapper
          <Tooltip
            title="Used by event content. Remove the image in the event's content editor first."
            mouseEnterDelay={0.5}
          >
            <span>{removeButton}</span>
          </Tooltip>
        )}
      </div>

      <div className={styles.usage}>
        {unused && <span className={styles.unused}>unused</span>}

        {asset.references.slice(0, VISIBLE_REFERENCES).map((reference) => (
          <span
            className={styles.reference}
            key={`${reference.type}-${reference.elementId}-${
              reference.detail || ''
            }`}
          >
            {referenceLabel(reference)}
          </span>
        ))}

        {hiddenReferenceCount > 0 && (
          <Tooltip
            title={asset.references.map(referenceLabel).join(', ')}
            mouseEnterDelay={0.5}
          >
            <span className={styles.moreReferences}>
              +{hiddenReferenceCount} more
            </span>
          </Tooltip>
        )}
      </div>
    </div>
  )
}

AssetTile.displayName = 'AssetTile'

export default AssetTile
