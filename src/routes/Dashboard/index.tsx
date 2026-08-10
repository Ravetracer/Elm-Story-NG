import { ipcRenderer } from 'electron'

import React, { useContext, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'

import { WorldDataJSON } from '../../lib/transport/types/0.7.1'
import { World } from '../../data/types'
import { WINDOW_EVENT_TYPE } from '../../lib/events'

import { AppContext, APP_ACTION_TYPE } from '../../contexts/AppContext'

import { useStudios } from '../../hooks'
import { getLibraryDatabase } from '../../db'
import api from '../../api'
import saveDemoContent from '../../lib/demo/saveDemoContent'

import { Button, message, Modal } from 'antd'
import {
  ExperimentOutlined,
  ImportOutlined,
  ReloadOutlined
} from '@ant-design/icons'

import { ImportJSONModal } from '../../components/Modal'
import StudioSelect from '../../components/StudioSelect'
import WorldLibrary from '../../components/WorldLibrary'

import styles from './styles.module.less'

// The demo storyworld is grouped under its own studio so it never mingles with an
// author's own libraries and stays trivial to delete.
const DEMO_STUDIO_TITLE = 'Elm Story - NG Demos'

const Dashboard = () => {
  const { app, appDispatch } = useContext(AppContext)

  const studios = useStudios()

  const [seedingDemo, setSeedingDemo] = useState(false)

  const demoStudioId = studios?.find(
    (studio) => studio.title === DEMO_STUDIO_TITLE
  )?.id

  // The worlds already in the demo studio, so the button can offer to *update* an
  // installed demo rather than silently adding a second copy. A live query keyed on
  // the studio id, which is undefined until the demo exists — then it reads empty.
  const demoWorlds = useLiveQuery(
    async () =>
      demoStudioId
        ? await getLibraryDatabase(demoStudioId).worlds.toArray()
        : [],
    [demoStudioId],
    []
  )

  const demoInstalled = (demoWorlds?.length ?? 0) > 0

  const [importJSONModal, setImportJSONModal] = useState<{
    visible: boolean
    worldData?: WorldDataJSON
    jsonPath?: string
    error?: boolean
  }>({
    visible: false,
    worldData: undefined,
    jsonPath: undefined,
    error: false
  })

  async function importWorld() {
    try {
      const { worldData, jsonPath } = await ipcRenderer.invoke(
        WINDOW_EVENT_TYPE.IMPORT_WORLD_GET_JSON
      )

      worldData &&
        setImportJSONModal({
          visible: true,
          worldData,
          jsonPath
        })
    } catch (error) {
      setImportJSONModal({
        visible: true,
        worldData: undefined,
        jsonPath: undefined,
        error: true
      })
    }
  }

  // Builds the bundled demo storyworld on demand — nothing is created until the
  // author asks for it. The demo lives in its own studio, reused across clicks so
  // repeated presses do not litter the dashboard with empty libraries.
  async function seedDemo(existingWorldsToReplace: World[]) {
    if (seedingDemo) return

    setSeedingDemo(true)

    try {
      let studioId = demoStudioId

      if (!studioId) {
        studioId = await api().studios.saveStudio({
          title: DEMO_STUDIO_TITLE,
          worlds: [],
          tags: ['demo']
        })
      }

      // On update, drop the installed demo world(s) first so the studio holds one
      // fresh copy rather than a pile. Sequential, not Promise.all: each removal
      // rewrites the studio's shared `worlds` array, so parallel removes would race.
      for (const world of existingWorldsToReplace) {
        if (world.id) await api().worlds.removeWorld(studioId, world.id)
      }

      await saveDemoContent(studioId, app.version)

      appDispatch({
        type: APP_ACTION_TYPE.STUDIO_SELECT,
        selectedStudioId: studioId
      })

      message.success(
        existingWorldsToReplace.length > 0
          ? 'Demo updated — open “The Jade Idol of K’aal”.'
          : 'Demo added — open “The Jade Idol of K’aal” to explore it.'
      )
    } catch (error) {
      message.error(
        existingWorldsToReplace.length > 0
          ? 'Could not update the demo storyworld.'
          : 'Could not create the demo storyworld.'
      )

      throw error
    } finally {
      setSeedingDemo(false)
    }
  }

  function loadDemo() {
    // Installed already: updating overwrites it, so confirm first — an author may
    // have poked at the demo and a silent replace would discard their changes.
    if (demoInstalled) {
      Modal.confirm({
        title: 'Update the demo storyworld?',
        content:
          'This replaces the demo with the latest bundled version. Any changes ' +
          'you made to the demo storyworld will be overwritten. Your own ' +
          'storyworlds are not touched.',
        okText: 'Update',
        cancelText: 'Cancel',
        onOk: () => seedDemo(demoWorlds ?? [])
      })

      return
    }

    seedDemo([])
  }

  return (
    <>
      <ImportJSONModal
        visible={importJSONModal.visible}
        afterClose={() =>
          setImportJSONModal({
            visible: false,
            worldData: undefined,
            jsonPath: undefined,
            error: false
          })
        }
        studioId={app.selectedStudioId}
        incomingWorldData={importJSONModal.worldData}
        incomingJSONPath={importJSONModal.jsonPath}
        incomingError={importJSONModal.error}
      />

      <div className={styles.Dashboard}>
        <div className={styles.studioSelectWrapper}>
          <StudioSelect />
          <Button style={{ borderRadius: 2 }} onClick={importWorld}>
            <ImportOutlined />
          </Button>
        </div>

        <div className={styles.demoBar}>
          <Button
            type="link"
            size="small"
            icon={demoInstalled ? <ReloadOutlined /> : <ExperimentOutlined />}
            loading={seedingDemo}
            onClick={loadDemo}
          >
            {seedingDemo
              ? 'Building the demo…'
              : demoInstalled
              ? 'Update the demo storyworld'
              : 'New here? Load the demo storyworld'}
          </Button>
        </div>

        {app.selectedStudioId && (
          <WorldLibrary studioId={app.selectedStudioId} />
        )}
      </div>
    </>
  )
}

export default Dashboard
