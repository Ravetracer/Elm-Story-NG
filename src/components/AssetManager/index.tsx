import { ipcRenderer } from 'electron'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { StudioId, WorldId } from '../../data/types'
import { WINDOW_EVENT_TYPE } from '../../lib/events'
import {
  ASSET_MEDIA,
  ASSET_REFERENCE_TYPE,
  assetMedia,
  AssetFile,
  collateAssets,
  formatAssetBytes,
  isAssetUnused,
  ManagedAsset,
  totalAssetBytes
} from '../../lib/assets'

import { useCharacters, useEvents, useScenes } from '../../hooks'

import { Button, Popconfirm, Radio } from 'antd'
import {
  DeleteOutlined,
  PictureOutlined,
  SoundOutlined,
  WarningOutlined
} from '@ant-design/icons'

import AssetTile from './AssetTile'

import api from '../../api'

import styles from './styles.module.less'

enum ASSET_FILTER {
  ALL = 'ALL',
  IMAGES = 'IMAGES',
  AUDIO = 'AUDIO',
  UNUSED = 'UNUSED'
}

const matchesFilter = (asset: ManagedAsset, filter: ASSET_FILTER): boolean => {
  switch (filter) {
    case ASSET_FILTER.IMAGES:
      return assetMedia(asset) === ASSET_MEDIA.IMAGE
    case ASSET_FILTER.AUDIO:
      return assetMedia(asset) === ASSET_MEDIA.AUDIO
    case ASSET_FILTER.UNUSED:
      return isAssetUnused(asset)
    case ASSET_FILTER.ALL:
    default:
      return true
  }
}

const AssetManager: React.FC<{
  studioId: StudioId
  worldId: WorldId
}> = ({ studioId, worldId }) => {
  const characters = useCharacters(studioId, worldId, [worldId]),
    events = useEvents(studioId, worldId, [worldId]),
    scenes = useScenes(studioId, worldId, [worldId])

  const [files, setFiles] = useState<AssetFile[] | undefined>(undefined),
    [filter, setFilter] = useState<ASSET_FILTER>(ASSET_FILTER.ALL),
    [working, setWorking] = useState(false)

  // returns rather than sets, so the deletion handlers below can await a fresh
  // listing without racing the effect
  const readAssetFiles = useCallback(
    (): Promise<AssetFile[]> =>
      ipcRenderer.invoke(WINDOW_EVENT_TYPE.LIST_ASSETS, { studioId, worldId }),
    [studioId, worldId]
  )

  useEffect(() => {
    let stale = false

    readAssetFiles().then((foundFiles) => !stale && setFiles(foundFiles))

    // the modal is destroyOnClose, so this can resolve after unmount
    return () => {
      stale = true
    }
  }, [readAssetFiles])

  const assets = useMemo(
    () =>
      files ? collateAssets(files, { characters, events, scenes }) : undefined,
    [files, characters, events, scenes]
  )

  const unusedAssets = useMemo(
    () => assets?.filter(isAssetUnused) || [],
    [assets]
  )

  const visibleAssets = useMemo(
    () => assets?.filter((asset) => matchesFilter(asset, filter)),
    [assets, filter]
  )

  /**
   * Points the storyworld away from an asset before its file is trashed, for the
   * references that are a single value. An event content image is not one of
   * those — see isReferenceClearable — so those assets are not offered for
   * removal at all.
   *
   * Sequential rather than concurrent: two masks on one character can name the
   * same asset, and a concurrent read-modify-write of that character would lose
   * one of the two edits.
   */
  const clearReferences = async (asset: ManagedAsset) => {
    for (const reference of asset.references) {
      switch (reference.type) {
        case ASSET_REFERENCE_TYPE.CHARACTER_MASK: {
          const character = await api().characters.getCharacter(
            studioId,
            reference.elementId
          )

          if (!character) break

          await api().characters.saveCharacter(studioId, {
            ...character,
            masks: character.masks.map((mask) =>
              mask.assetId === asset.id ? { ...mask, assetId: undefined } : mask
            )
          })

          break
        }
        case ASSET_REFERENCE_TYPE.EVENT_AUDIO: {
          const event = await api().events.getEvent(
            studioId,
            reference.elementId
          )

          if (event?.audio?.[0] !== asset.id) break

          await api().events.saveEvent(studioId, {
            ...event,
            audio: undefined
          })

          break
        }
        case ASSET_REFERENCE_TYPE.SCENE_AUDIO: {
          const scene = await api().scenes.getScene(
            studioId,
            reference.elementId
          )

          if (scene?.audio?.[0] !== asset.id) break

          await api().scenes.saveScene(studioId, {
            ...scene,
            audio: undefined
          })

          break
        }
        default:
          break
      }
    }
  }

  // trash rather than remove, so REMOVE_ASSET's existing restore path still
  // applies; the file lands in userData/.trash
  const trashFile = async ({ id, ext }: ManagedAsset) =>
    ipcRenderer.invoke(WINDOW_EVENT_TYPE.REMOVE_ASSET, {
      studioId,
      worldId,
      id,
      ext,
      trash: true
    })

  const removeAsset = async (asset: ManagedAsset) => {
    setWorking(true)

    try {
      await clearReferences(asset)

      // a missing asset has no file to trash, and REMOVE_ASSET returns early
      // rather than failing, so this needs no guard
      await trashFile(asset)
    } finally {
      setFiles(await readAssetFiles())

      setWorking(false)
    }
  }

  const removeUnusedAssets = async () => {
    setWorking(true)

    try {
      // no references by definition, so nothing to serialize on
      await Promise.all(unusedAssets.map(trashFile))
    } finally {
      setFiles(await readAssetFiles())

      setWorking(false)
    }
  }

  return (
    <div className={styles.AssetManager}>
      <div className={styles.toolbar}>
        <Radio.Group
          value={filter}
          size="small"
          buttonStyle="solid"
          onChange={(event) => setFilter(event.target.value)}
        >
          <Radio.Button value={ASSET_FILTER.ALL}>All</Radio.Button>
          <Radio.Button value={ASSET_FILTER.IMAGES}>
            <PictureOutlined /> Images
          </Radio.Button>
          <Radio.Button value={ASSET_FILTER.AUDIO}>
            <SoundOutlined /> Audio
          </Radio.Button>
          <Radio.Button value={ASSET_FILTER.UNUSED}>Unused</Radio.Button>
        </Radio.Group>

        <Popconfirm
          title={`Move ${unusedAssets.length} unused ${
            unusedAssets.length === 1 ? 'asset' : 'assets'
          } to the trash?`}
          okText="Move to Trash"
          cancelText="Cancel"
          disabled={unusedAssets.length === 0 || working}
          onConfirm={removeUnusedAssets}
        >
          <Button
            size="small"
            danger
            disabled={unusedAssets.length === 0 || working}
            loading={working}
          >
            <DeleteOutlined /> Delete Unused ({unusedAssets.length})
          </Button>
        </Popconfirm>
      </div>

      <div className={styles.grid}>
        {visibleAssets?.map((asset) => (
          <AssetTile
            key={`${asset.id}.${asset.ext}`}
            studioId={studioId}
            worldId={worldId}
            asset={asset}
            working={working}
            onRemove={() => removeAsset(asset)}
          />
        ))}

        {visibleAssets?.length === 0 && (
          <div className={styles.empty}>
            {assets?.length === 0
              ? 'This storyworld has no assets. Images and audio imported in the composer appear here.'
              : 'No assets match this filter.'}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        {assets && (
          <>
            <span>
              {assets.length} {assets.length === 1 ? 'asset' : 'assets'}
            </span>
            <span>{unusedAssets.length} unused</span>
            {assets.some(({ missing }) => missing) && (
              <span className={styles.missing}>
                <WarningOutlined />{' '}
                {assets.filter(({ missing }) => missing).length} missing
              </span>
            )}
            <span className={styles.total}>
              {formatAssetBytes(totalAssetBytes(assets))} on disk
            </span>
          </>
        )}
      </div>
    </div>
  )
}

AssetManager.displayName = 'AssetManager'

export default AssetManager
