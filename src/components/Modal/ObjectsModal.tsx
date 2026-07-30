import React from 'react'

import { StudioId, WorldId } from '../../data/types'

import { Modal, ModalProps } from 'antd'
import { AppstoreOutlined } from '@ant-design/icons'

import ObjectManager from '../ObjectManager'

import styles from './styles.module.less'

interface ObjectsModalProps extends ModalProps {
  studioId: StudioId
  /**
   * The world id rather than the World, matching `AssetsModal`: objects are
   * world-scoped and the manager only needs to know which world.
   */
  worldId: WorldId
  subject?: string
  visible?: boolean
}

const ObjectsModal: React.FC<ObjectsModalProps> = ({
  studioId,
  worldId,
  subject,
  visible,
  onCancel
}) => (
  <Modal
    title={
      <>
        <AppstoreOutlined className={styles.icon} /> Objects
        {subject ? ` — ${subject}` : ''}
      </>
    }
    visible={visible}
    // Selection state is per opening; the manager reads everything from live
    // queries, so there is nothing worth keeping alive between openings.
    destroyOnClose
    onCancel={(event) => onCancel && onCancel(event)}
    centered
    footer={null}
    width={1000}
  >
    <ObjectManager studioId={studioId} worldId={worldId} />
  </Modal>
)

ObjectsModal.displayName = 'ObjectsModal'

export default ObjectsModal
