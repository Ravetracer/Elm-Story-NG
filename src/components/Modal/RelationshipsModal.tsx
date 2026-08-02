import React from 'react'

import { StudioId, WorldId } from '../../data/types'

import { Modal, ModalProps } from 'antd'
import { ShareAltOutlined } from '@ant-design/icons'

import RelationshipManager from '../RelationshipManager'

import styles from './styles.module.less'

interface RelationshipsModalProps extends ModalProps {
  studioId: StudioId
  /** The world id rather than the World, matching `ObjectsModal`. */
  worldId: WorldId
  subject?: string
  visible?: boolean
}

const RelationshipsModal: React.FC<RelationshipsModalProps> = ({
  studioId,
  worldId,
  subject,
  visible,
  onCancel
}) => (
  <Modal
    title={
      <>
        <ShareAltOutlined className={styles.icon} /> Character Relationships
        {subject ? ` — ${subject}` : ''}
      </>
    }
    visible={visible}
    // Selection is per opening; everything is read from live queries and every
    // edit is written on change, so there is nothing to keep alive between them.
    destroyOnClose
    onCancel={(event) => onCancel && onCancel(event)}
    centered
    footer={null}
    width={900}
  >
    <RelationshipManager studioId={studioId} worldId={worldId} />
  </Modal>
)

RelationshipsModal.displayName = 'RelationshipsModal'

export default RelationshipsModal
