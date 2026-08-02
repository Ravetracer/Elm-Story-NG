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
  PlusOutlined,
  ShareAltOutlined,
  TranslationOutlined
} from '@ant-design/icons'

import {
  AssetsModal,
  InterfaceTextModal,
  ObjectsModal,
  RelationshipsModal,
  StoryworldMapModal
} from '../Modal'

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
    [objectsModalVisible, setObjectsModalVisible] = useState(false),
    [interfaceTextModalVisible, setInterfaceTextModalVisible] = useState(false),
    [relationshipsModalVisible, setRelationshipsModalVisible] = useState(false)

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

      <InterfaceTextModal
        studioId={studioId}
        worldId={world.id as WorldId}
        subject={world.title}
        visible={interfaceTextModalVisible}
        onCancel={() => setInterfaceTextModalVisible(false)}
      />

      <RelationshipsModal
        studioId={studioId}
        worldId={world.id as WorldId}
        subject={world.title}
        visible={relationshipsModalVisible}
        onCancel={() => setRelationshipsModalVisible(false)}
      />

      <div className={styles.TitleBar}>
        <div className={styles.titleRow}>
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

          {/*
            `title` rather than a Tooltip: the name is truncated with an ellipsis
            when the panel is narrow, and the full text has to be recoverable
            without adding a hover surface to something that is already clickable.
          */}
          <span
            className={`${styles.worldTitle} ${
              composer.selectedWorldOutlineElement.id === world.id
                ? styles.selected
                : ''
            }`}
            title={world.title}
            onClick={onWorldSelect}
          >
            {world.title}
          </span>
        </div>

        <div className={styles.worldButtons}>
          <Tooltip
            title="Storyworld Map..."
            placement="bottom"
            mouseEnterDelay={1}
          >
            <Button type="link" onClick={() => setMapModalVisible(true)}>
              <NodeIndexOutlined />
            </Button>
          </Tooltip>

          <Tooltip
            title="Manage Objects..."
            placement="bottom"
            mouseEnterDelay={1}
          >
            <Button type="link" onClick={() => setObjectsModalVisible(true)}>
              <AppstoreOutlined />
            </Button>
          </Tooltip>

          <Tooltip
            title="Manage Assets..."
            placement="bottom"
            mouseEnterDelay={1}
          >
            <Button type="link" onClick={() => setAssetsModalVisible(true)}>
              <PictureOutlined />
            </Button>
          </Tooltip>

          {/*
            Extra tools cost nothing here: the action row was given a line of its
            own precisely so buttons could be added without the arithmetic that
            used to reserve room for exactly four.

            Relationships are world-scoped, so they belong beside the other
            managers rather than in the Characters panel — a relationship relates
            two characters and belongs to neither, which is the same reason it is
            a table rather than a field.
          */}
          <Tooltip
            title="Character Relationships..."
            placement="bottom"
            mouseEnterDelay={1}
          >
            <Button
              type="link"
              onClick={() => setRelationshipsModalVisible(true)}
            >
              <ShareAltOutlined />
            </Button>
          </Tooltip>

          <Tooltip
            title="Interface Text..."
            placement="bottom"
            mouseEnterDelay={1}
          >
            <Button
              type="link"
              onClick={() => setInterfaceTextModalVisible(true)}
            >
              <TranslationOutlined />
            </Button>
          </Tooltip>

          <ExportWorldMenu studioId={studioId} world={world}>
            <Tooltip
              title="Export World..."
              placement="bottom"
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
              placement="bottom"
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
