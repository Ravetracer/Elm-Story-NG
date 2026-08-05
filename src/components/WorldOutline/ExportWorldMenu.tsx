import { ipcRenderer } from 'electron'

import React, { useContext, useState, useEffect } from 'react'

import getWorldDataJSON from '../../lib/getWorldDataJSON'

import { World, WORLD_EXPORT_TYPE } from '../../data/types'
import { StudioId } from '../../lib/transport/types/0.5.1'
import { WINDOW_EVENT_TYPE } from '../../lib/events'

import { AppContext } from '../../contexts/AppContext'

import { Dropdown, Menu } from 'antd'
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

  async function exportWorld(type: WORLD_EXPORT_TYPE) {
    if (world.id) {
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
