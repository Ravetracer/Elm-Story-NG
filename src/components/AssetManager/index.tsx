import { ipcRenderer } from 'electron'
import { v4 as uuid } from 'uuid'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { StudioId, WorldId } from '../../data/types'
import { WINDOW_EVENT_TYPE } from '../../lib/events'
import {
  ASSET_KIND,
  ASSET_KINDS,
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

import {
  useCharacters,
  useEvents,
  useObjects,
  useScenes,
  useWorld
} from '../../hooks'

import { Button, Dropdown, Menu, Popconfirm, Radio } from 'antd'
import {
  DeleteOutlined,
  ImportOutlined,
  PictureOutlined,
  SoundOutlined,
  WarningOutlined
} from '@ant-design/icons'

import ImportAndCropImage from '../ImportAndCropImage'
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
  /**
   * Set to turn the manager into a picker for one kind of asset.
   *
   * The kind, not a media filter: assets are stored flat as `<id>.<ext>` and
   * every read site asks for the extension it expects rather than reading disk,
   * so offering a `.png` for a character mask would produce an assignment that
   * resolves to nothing — and `CharacterMask` reacts to a missing file by
   * silently clearing the assignment again. Restricting to the kind's own
   * extension is what makes every offered asset actually assignable.
   */
  selectKind?: ASSET_KIND
  onSelect?: (assetId: string) => void
  selectedAssetId?: string
}> = ({ studioId, worldId, selectKind, onSelect, selectedAssetId }) => {
  const characters = useCharacters(studioId, worldId, [worldId]),
    events = useEvents(studioId, worldId, [worldId]),
    objects = useObjects(studioId, worldId, [worldId]),
    scenes = useScenes(studioId, worldId, [worldId]),
    world = useWorld(studioId, worldId, [worldId])

  const [files, setFiles] = useState<AssetFile[] | undefined>(undefined),
    [filter, setFilter] = useState<ASSET_FILTER>(ASSET_FILTER.ALL),
    [working, setWorking] = useState(false),
    // the kind chosen from the import menu, which decides the accept filter, the
    // crop pipeline and the extension the file is written with
    [importKind, setImportKind] = useState<ASSET_KIND | null>(null),
    [cropping, setCropping] = useState(false)

  const importImageRef = useRef<{ import: () => void }>(null),
    importAudioInputRef = useRef<HTMLInputElement>(null)

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
      files
        ? collateAssets(files, {
            characters,
            events,
            objects,
            scenes,
            world
          })
        : undefined,
    [files, characters, events, objects, scenes, world]
  )

  const unusedAssets = useMemo(
    () => assets?.filter(isAssetUnused) || [],
    [assets]
  )

  const selectExtension = selectKind ? ASSET_KINDS[selectKind].ext : undefined

  const visibleAssets = useMemo(
    () =>
      assets
        ?.filter((asset) => matchesFilter(asset, filter))
        // a missing asset has no file to assign
        .filter(
          (asset) =>
            !selectExtension ||
            (asset.ext === selectExtension && !asset.missing)
        ),
    [assets, filter, selectExtension]
  )

  /**
   * Writes a new asset and shows it in the grid.
   *
   * The id is a fresh uuid and the extension comes from the kind, so an asset
   * imported here is written exactly as one imported from the slot it is destined
   * for — that interchangeability is the whole point of importing ahead of
   * assigning. Nothing references it yet, so it lists as unused until it is
   * assigned, which is correct rather than a warning.
   */
  const writeAsset = async (kind: ASSET_KIND, data: ArrayBuffer) => {
    setWorking(true)

    try {
      await ipcRenderer.invoke(WINDOW_EVENT_TYPE.SAVE_ASSET, {
        studioId,
        worldId,
        id: uuid(),
        data,
        ext: ASSET_KINDS[kind].ext
      })
    } finally {
      setFiles(await readAssetFiles())

      setWorking(false)
    }
  }

  const startImport = (kind: ASSET_KIND) => {
    setImportKind(kind)

    // an image kind goes through the cropper, which owns its own file input and
    // reports back through onImportImageData; audio is stored as imported and so
    // needs no stage between the file dialogue and the write
    if (ASSET_KINDS[kind].pipeline) {
      importImageRef.current?.import()
    } else {
      importAudioInputRef.current?.click()
    }
  }

  const onAudioFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]

    // cleared before the await, so choosing the same file twice in a row still
    // fires a change event
    event.target.value = ''

    if (!file || !importKind) return

    await writeAsset(importKind, await file.arrayBuffer())

    setImportKind(null)
  }

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
        // An object's two image slots are separate reference types precisely so
        // this can clear the right field — one type would not say which.
        case ASSET_REFERENCE_TYPE.OBJECT_IMAGE:
        case ASSET_REFERENCE_TYPE.OBJECT_STACKED_IMAGE: {
          const object = await api().objects.getObject(
            studioId,
            reference.elementId
          )

          if (!object) break

          const stacked =
            reference.type === ASSET_REFERENCE_TYPE.OBJECT_STACKED_IMAGE

          if ((stacked ? object.stackedAssetId : object.assetId) !== asset.id)
            break

          await api().objects.saveObject(studioId, {
            ...object,
            ...(stacked
              ? { stackedAssetId: undefined }
              : { assetId: undefined })
          })

          break
        }
        case ASSET_REFERENCE_TYPE.WORLD_COVER: {
          const referencedWorld = await api().worlds.getWorld(
            studioId,
            reference.elementId
          )

          if (referencedWorld?.coverAssetId !== asset.id) break

          await api().worlds.saveWorld(studioId, {
            ...referencedWorld,
            coverAssetId: undefined
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

  const importPipeline = importKind
    ? ASSET_KINDS[importKind].pipeline
    : undefined

  return (
    <div className={styles.AssetManager}>
      <input
        ref={importAudioInputRef}
        type="file"
        accept={ASSET_KINDS[ASSET_KIND.AUDIO].accept}
        style={{ display: 'none' }}
        onChange={onAudioFileSelect}
      />

      <div className={styles.toolbar}>
        <Radio.Group
          value={filter}
          size="small"
          buttonStyle="solid"
          onChange={(event) => setFilter(event.target.value)}
        >
          <Radio.Button value={ASSET_FILTER.ALL}>All</Radio.Button>
          {/* the kind already restricts the list to one extension, so a media
              filter over it would only ever be a no-op or empty */}
          {!selectKind && (
            <>
              <Radio.Button value={ASSET_FILTER.IMAGES}>
                <PictureOutlined /> Images
              </Radio.Button>
              <Radio.Button value={ASSET_FILTER.AUDIO}>
                <SoundOutlined /> Audio
              </Radio.Button>
            </>
          )}
          <Radio.Button value={ASSET_FILTER.UNUSED}>Unused</Radio.Button>
        </Radio.Group>

        <div className={styles.toolbarActions}>
          {/*
            The kind is asked for rather than guessed, because it decides how the
            file is processed and what extension it is stored with, and there is
            no way to infer from a JPEG on disk whether the author meant it as a
            character mask or an event image.
          */}
          {/* in select mode the kind is already known, so there is nothing to
              ask and the menu collapses to the one button */}
          {selectKind ? (
            <Button
              size="small"
              disabled={working || cropping}
              onClick={() => startImport(selectKind)}
            >
              <ImportOutlined /> Import {ASSET_KINDS[selectKind].label}
            </Button>
          ) : (
            <Dropdown
              disabled={working || cropping}
              overlay={
                <Menu
                  onClick={({ key }) => startImport(key as ASSET_KIND)}
                  selectedKeys={[]}
                >
                  {Object.entries(ASSET_KINDS).map(([kind, { label }]) => (
                    <Menu.Item key={kind}>{label}</Menu.Item>
                  ))}
                </Menu>
              }
            >
              <Button size="small" disabled={working || cropping}>
                <ImportOutlined /> Import Asset
              </Button>
            </Dropdown>
          )}

          {!selectKind && (
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
          )}
        </div>
      </div>

      <div className={styles.body}>
        {/*
          Always mounted, because the file dialogue is opened through its ref and
          it is what reports back that a file was chosen. It is absolutely
          positioned with pointer-events off until `cropping`, so it costs the
          grid nothing while idle.
        */}
        <ImportAndCropImage
          ref={importImageRef}
          cropping={cropping}
          aspectRatio={importPipeline?.aspectRatio}
          format={importPipeline?.format}
          quality={importPipeline?.quality}
          size={importPipeline?.size || { width: 0, height: 0 }}
          containerStyle={{ background: 'transparent' }}
          // the stage fills the body above the controls instead of taking the
          // stylesheet's 16:9, which only suits the event image slot
          cropContainerStyle={{
            aspectRatio: 'auto',
            height: 'calc(100% - 96px)',
            marginBottom: 0
          }}
          controlStyle={{ bottom: 0 }}
          onImportImageData={() => setCropping(true)}
          onImportImageCropComplete={async (image) => {
            if (image?.data && importKind) {
              await writeAsset(importKind, await image.data.arrayBuffer())
            }

            setCropping(false)
            setImportKind(null)
          }}
          onSelectNewImage={() => importImageRef.current?.import()}
        />

        <div className={`${styles.grid} ${cropping ? styles.hidden : ''}`}>
          {visibleAssets?.map((asset) => (
            <AssetTile
              key={`${asset.id}.${asset.ext}`}
              studioId={studioId}
              worldId={worldId}
              asset={asset}
              working={working}
              onRemove={() => removeAsset(asset)}
              onSelect={onSelect ? () => onSelect(asset.id) : undefined}
              selected={asset.id === selectedAssetId}
            />
          ))}

          {visibleAssets?.length === 0 && (
            <div className={styles.empty}>
              {selectKind
                ? `This storyworld has no ${ASSET_KINDS[
                    selectKind
                  ].label.toLowerCase()} assets yet. Import one to assign it.`
                : assets?.length === 0
                  ? 'This storyworld has no assets. Import one here, or import an image or a track in the composer.'
                  : 'No assets match this filter.'}
            </div>
          )}
        </div>
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
