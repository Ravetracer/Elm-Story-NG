import React from 'react'

import { ElementId, StudioId, WorldId } from '../../data/types'

import { Modal, ModalProps } from 'antd'
import { NodeIndexOutlined } from '@ant-design/icons'

import StoryworldMap from '../StoryworldMap'

import styles from './styles.module.less'

interface StoryworldMapModalProps extends ModalProps {
  studioId: StudioId
  worldId: WorldId
  subject?: string
  visible?: boolean
  onSelectScene: (sceneId: ElementId) => void
}

const StoryworldMapModal: React.FC<StoryworldMapModalProps> = ({
  studioId,
  worldId,
  subject,
  visible,
  onSelectScene,
  onCancel
}) => (
  <Modal
    title={
      <>
        <NodeIndexOutlined className={styles.icon} /> Storyworld Map
        {subject ? ` — ${subject}` : ''}
      </>
    }
    visible={visible}
    // the map lays itself out on mount rather than remembering positions, so
    // there is nothing to keep alive between openings
    destroyOnClose
    onCancel={(event) => onCancel && onCancel(event)}
    centered
    footer={null}
    width={1100}
    className={styles.StoryworldMapModal}
  >
    <StoryworldMap
      studioId={studioId}
      worldId={worldId}
      onSelectScene={onSelectScene}
    />
  </Modal>
)

StoryworldMapModal.displayName = 'StoryworldMapModal'

export default StoryworldMapModal
