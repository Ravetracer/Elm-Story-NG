import { ipcRenderer } from 'electron'

import React, { useContext, useState, useEffect } from 'react'

import getWorldDataJSON from '../../lib/getWorldDataJSON'

import { World, WORLD_EXPORT_TYPE } from '../../data/types'
import { StudioId } from '../../lib/transport/types/0.5.1'
import { WINDOW_EVENT_TYPE } from '../../lib/events'
import { IS_WEB_BUILD, recordWorldExport } from '../../lib/storageDurability'

import { AppContext } from '../../contexts/AppContext'

import api from '../../api'
import {
  collateAssets,
  isAssetUnused,
  totalAssetBytes,
  formatAssetBytes
} from '../../lib/assets'

import { Dropdown, Menu, Modal } from 'antd'
import { QuestionCircleFilled } from '@ant-design/icons'
import { ExportWorldModal } from '../Modal'
import { HelpModal } from '../ElementHelp'
import { HelpTopic } from '../ElementHelp/content'

import styles from './styles.module.less'

// The export help used to open docs.elmstory.com, which no longer resolves; it
// now opens the in-app help modal, keeping the menu's own icon styling. The modal
// is rendered outside the Dropdown so closing the menu does not unmount it.
const EXPORT_HELP_TOPIC: Record<WORLD_EXPORT_TYPE, HelpTopic> = {
  [WORLD_EXPORT_TYPE.JSON]: 'EXPORT_JSON',
  [WORLD_EXPORT_TYPE.ZIP]: 'EXPORT_ZIP',
  [WORLD_EXPORT_TYPE.PWA]: 'EXPORT_PWA'
}

const ExportWorldMenu: React.FC<{ studioId: StudioId; world: World }> = ({
  children,
  studioId,
  world
}) => {
  const { app } = useContext(AppContext)

  const [exportWorldModal, setExportWorldModal] = useState({
    title: 'Gathering storyworld data...',
    visible: false
  })

  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null)

  // A PWA export copies the whole asset directory and the service worker
  // precaches every file, so assets no element references bloat the download
  // for every player. Warn before packing one, and leave the files for the
  // author to clear in the asset manager — the one place assets are deleted —
  // rather than dropping them silently here. Resolves true to proceed.
  async function confirmUnusedAssets(): Promise<boolean> {
    if (!world.id) return true

    const worldId = world.id

    const [files, characters, events, objects, scenes] = await Promise.all([
      ipcRenderer.invoke(WINDOW_EVENT_TYPE.LIST_ASSETS, { studioId, worldId }),
      api().characters.getCharactersByWorldRef(studioId, worldId),
      api().events.getEventsByWorldRef(studioId, worldId),
      api().objects.getObjectsByWorldRef(studioId, worldId),
      api().scenes.getScenesByWorldRef(studioId, worldId)
    ])

    const unused = collateAssets(files, {
      characters,
      events,
      objects,
      scenes,
      world
    }).filter(isAssetUnused)

    if (unused.length === 0) return true

    return new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: `${unused.length} unused ${
          unused.length === 1 ? 'asset' : 'assets'
        } in this storyworld`,
        content: `They total ${formatAssetBytes(
          totalAssetBytes(unused)
        )} and would be included in the exported PWA and precached for every player. Clear them from the asset manager — the picture button in the storyworld outline — before exporting, or export anyway.`,
        okText: 'Export anyway',
        cancelText: 'Cancel',
        onOk: () => resolve(true),
        onCancel: () => resolve(false)
      })
    })
  }

  async function exportWorld(type: WORLD_EXPORT_TYPE) {
    if (world.id) {
      // ZIP and PWA both bundle the assets, so both warn about unused ones.
      if (
        (type === WORLD_EXPORT_TYPE.PWA || type === WORLD_EXPORT_TYPE.ZIP) &&
        !(await confirmUnusedAssets())
      )
        return

      setExportWorldModal({ ...exportWorldModal, visible: true })

      const worldDataAsString = await getWorldDataJSON(
        studioId,
        world.id,
        app.version,
        type === WORLD_EXPORT_TYPE.PWA
      )

      setTimeout(() => {
        ipcRenderer.invoke(WINDOW_EVENT_TYPE.EXPORT_WORLD_START, {
          type,
          data: worldDataAsString
        })

        // A JSON or ZIP export is a re-importable backup, so it clears the web
        // build's durability nag for this world. A PWA is a playable app, not
        // re-importable, so it does not count as a backup.
        if (
          IS_WEB_BUILD &&
          world.id &&
          (type === WORLD_EXPORT_TYPE.JSON || type === WORLD_EXPORT_TYPE.ZIP)
        )
          recordWorldExport(world.id, Date.now())

        setExportWorldModal({ ...exportWorldModal, visible: false })
      }, 1000)
    }
  }

  useEffect(() => {
    ipcRenderer.on(WINDOW_EVENT_TYPE.EXPORT_WORLD_PROCESSING, () => {
      setExportWorldModal({
        title: 'Compiling storyworld data...',
        visible: true
      })
    })

    ipcRenderer.on(WINDOW_EVENT_TYPE.EXPORT_WORLD_COMPLETE, () => {
      setExportWorldModal({ ...exportWorldModal, visible: false })
    })
  }, [])

  return (
    <>
      <ExportWorldModal
        title={exportWorldModal.title}
        visible={exportWorldModal.visible}
      />

      {helpTopic && (
        <HelpModal
          topic={helpTopic}
          open={helpTopic !== null}
          onClose={() => setHelpTopic(null)}
        />
      )}

      <Dropdown
        overlay={
          <Menu onClick={(event) => event.domEvent.stopPropagation()}>
            <Menu.Item onClick={() => exportWorld(WORLD_EXPORT_TYPE.JSON)}>
              Export JSON{' '}
              <span
                className={styles.HelpButton}
                onClick={(event) => {
                  event.stopPropagation()

                  setHelpTopic(EXPORT_HELP_TOPIC[WORLD_EXPORT_TYPE.JSON])
                }}
              >
                <QuestionCircleFilled />
              </span>
            </Menu.Item>
            <Menu.Item onClick={() => exportWorld(WORLD_EXPORT_TYPE.ZIP)}>
              Export ZIP{' '}
              <span
                className={styles.HelpButton}
                onClick={(event) => {
                  event.stopPropagation()

                  setHelpTopic(EXPORT_HELP_TOPIC[WORLD_EXPORT_TYPE.ZIP])
                }}
              >
                <QuestionCircleFilled />
              </span>
            </Menu.Item>
            <Menu.Item onClick={() => exportWorld(WORLD_EXPORT_TYPE.PWA)}>
              Export PWA{' '}
              <span
                className={styles.HelpButton}
                onClick={(event) => {
                  event.stopPropagation()

                  setHelpTopic(EXPORT_HELP_TOPIC[WORLD_EXPORT_TYPE.PWA])
                }}
              >
                <QuestionCircleFilled />
              </span>
            </Menu.Item>
          </Menu>
        }
        trigger={['click']}
      >
        {children}
      </Dropdown>
    </>
  )
}

ExportWorldMenu.displayName = 'ExportWorldMenu'

export default ExportWorldMenu
