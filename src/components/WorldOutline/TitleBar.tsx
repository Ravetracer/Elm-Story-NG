import React, { useContext, useState } from 'react'
import { useHistory } from 'react-router'

import { ElementId, ELEMENT_TYPE, World, WorldId, StudioId } from '../../data/types'
import { OnAddElement } from '.'

import { APP_LOCATION } from '../../contexts/AppContext'
import {
  ComposerContext,
  COMPOSER_ACTION_TYPE
} from '../../contexts/ComposerContext'

import { Button, Tooltip } from 'antd'
import {
  AppstoreOutlined,
  ExportOutlined,
  LeftOutlined,
  NodeIndexOutlined,
  PictureOutlined,
  PlusOutlined
} from '@ant-design/icons'

import { AssetsModal, ObjectsModal, StoryworldMapModal } from '../Modal'

import api from '../../api'
import ExportWorldMenu from './ExportWorldMenu'
import AddElementMenu from './AddElementMenu'

import styles from './styles.module.less'

const TitleBar: React.FC<{
  studioId: StudioId
  world: World
  onAdd: OnAddElement
  onWorldSelect: () => void
}> = ({ studioId, world, onAdd, onWorldSelect }) => {
  const history = useHistory()

  const { composer, composerDispatch } = useContext(ComposerContext)

  const [assetsModalVisible, setAssetsModalVisible] = useState(false),
    [mapModalVisible, setMapModalVisible] = useState(false),
    [objectsModalVisible, setObjectsModalVisible] = useState(false)

  /**
   * Opening a scene from the map is the same selection the outline makes when a
   * scene row is clicked: the element editor opens or focuses the scene's tab
   * from `selectedWorldOutlineElement`, and the outline highlights the row from
   * the same value. The title is read back because the dispatch carries it and
   * the map only knows the id.
   */
  const openScene = async (sceneId: ElementId) => {
    const scene = await api().scenes.getScene(studioId, sceneId)

    if (!scene?.id) return

    setMapModalVisible(false)

    composerDispatch({
      type: COMPOSER_ACTION_TYPE.WORLD_OUTLINE_SELECT,
      selectedWorldOutlineElement: {
        id: scene.id,
        title: scene.title,
        type: ELEMENT_TYPE.SCENE,
        expanded: true
      }
    })
  }

  return (
    <>
      <AssetsModal
        studioId={studioId}
        worldId={world.id as WorldId}
        subject={world.title}
        visible={assetsModalVisible}
        onCancel={() => setAssetsModalVisible(false)}
      />

      <StoryworldMapModal
        studioId={studioId}
        worldId={world.id as WorldId}
        subject={world.title}
        visible={mapModalVisible}
        onSelectScene={openScene}
        onCancel={() => setMapModalVisible(false)}
      />

      <ObjectsModal
        studioId={studioId}
        worldId={world.id as WorldId}
        subject={world.title}
        visible={objectsModalVisible}
        onCancel={() => setObjectsModalVisible(false)}
      />

      <div className={styles.TitleBar}>
        <Tooltip
          title="Back to Dashboard"
          placement="right"
          align={{ offset: [-10, 0] }}
          mouseEnterDelay={1}
        >
          <Button
            onClick={() => history.push(APP_LOCATION.DASHBOARD)}
            type="link"
            className={styles.dashboardButton}
          >
            <LeftOutlined />
          </Button>
        </Tooltip>

        <span
          className={`${styles.worldTitle} ${
            composer.selectedWorldOutlineElement.id === world.id
              ? styles.selected
              : ''
          }`}
          onClick={onWorldSelect}
        >
          {world.title}
        </span>

        <div className={styles.worldButtons}>
          <Tooltip
            title="Storyworld Map..."
            placement="right"
            align={{ offset: [-6, 0] }}
            mouseEnterDelay={1}
          >
            <Button type="link" onClick={() => setMapModalVisible(true)}>
              <NodeIndexOutlined />
            </Button>
          </Tooltip>

          <Tooltip
            title="Manage Objects..."
            placement="right"
            align={{ offset: [-6, 0] }}
            mouseEnterDelay={1}
          >
            <Button type="link" onClick={() => setObjectsModalVisible(true)}>
              <AppstoreOutlined />
            </Button>
          </Tooltip>

          <Tooltip
            title="Manage Assets..."
            placement="right"
            align={{ offset: [-6, 0] }}
            mouseEnterDelay={1}
          >
            <Button type="link" onClick={() => setAssetsModalVisible(true)}>
              <PictureOutlined />
            </Button>
          </Tooltip>

          <ExportWorldMenu studioId={studioId} world={world}>
            <Tooltip
              title="Export World..."
              placement="right"
              align={{ offset: [-6, 0] }}
              mouseEnterDelay={1}
            >
              <Button type="link">
                <ExportOutlined />
              </Button>
            </Tooltip>
          </ExportWorldMenu>

          <AddElementMenu
            worldId={world.id as WorldId}
            onAdd={(worldId: WorldId, type: ELEMENT_TYPE) =>
              onAdd(worldId, type)
            }
          >
            <Tooltip
              title="Add Element..."
              placement="right"
              align={{ offset: [-6, 0] }}
              mouseEnterDelay={1}
            >
              <Button type="link">
                <PlusOutlined />
              </Button>
            </Tooltip>
          </AddElementMenu>
        </div>
      </div>
    </>
  )
}

export default TitleBar
