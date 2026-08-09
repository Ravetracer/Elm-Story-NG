import { ipcRenderer } from 'electron'

import React, { useContext, useState } from 'react'

import { WorldDataJSON } from '../../lib/transport/types/0.7.1'
import { WINDOW_EVENT_TYPE } from '../../lib/events'

import { AppContext, APP_ACTION_TYPE } from '../../contexts/AppContext'

import { useStudios } from '../../hooks'
import api from '../../api'
import saveDemoContent from '../../lib/demo/saveDemoContent'

import { Button, message } from 'antd'
import { ExperimentOutlined, ImportOutlined } from '@ant-design/icons'

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
  async function loadDemo() {
    if (seedingDemo) return

    setSeedingDemo(true)

    try {
      let demoStudioId = studios?.find(
        (studio) => studio.title === DEMO_STUDIO_TITLE
      )?.id

      if (!demoStudioId) {
        demoStudioId = await api().studios.saveStudio({
          title: DEMO_STUDIO_TITLE,
          worlds: [],
          tags: ['demo']
        })
      }

      await saveDemoContent(demoStudioId, app.version)

      appDispatch({
        type: APP_ACTION_TYPE.STUDIO_SELECT,
        selectedStudioId: demoStudioId
      })

      message.success('Demo added — open “The Jade Idol of K’aal” to explore it.')
    } catch (error) {
      message.error('Could not create the demo storyworld.')

      throw error
    } finally {
      setSeedingDemo(false)
    }
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
            icon={<ExperimentOutlined />}
            loading={seedingDemo}
            onClick={loadDemo}
          >
            {seedingDemo
              ? 'Building the demo…'
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
