import React from 'react'

import { StudioId, WorldId } from '../../data/types'

import { Modal, ModalProps } from 'antd'
import { TranslationOutlined } from '@ant-design/icons'

import InterfaceTextManager from '../InterfaceTextManager'

import { HelpButton } from '../ElementHelp'

import styles from './styles.module.less'

interface InterfaceTextModalProps extends ModalProps {
  studioId: StudioId
  /** The world id rather than the World, matching `ObjectsModal`. */
  worldId: WorldId
  subject?: string
  visible?: boolean
}

const InterfaceTextModal: React.FC<InterfaceTextModalProps> = ({
  studioId,
  worldId,
  subject,
  visible,
  onCancel
}) => (
  <Modal
    title={
      <span className={styles.modalTitleWithHelp}>
        <span>
          <TranslationOutlined className={styles.icon} /> Interface Text
          {subject ? ` — ${subject}` : ''}
        </span>
        <HelpButton topic="INTERFACE_TEXT" />
      </span>
    }
    visible={visible}
    // The draft is per opening. Closing without saving discards it, which is what
    // Cancel means everywhere else in this app; keeping it alive would make the
    // modal quietly hold unsaved edits with nothing on screen saying so.
    destroyOnClose
    onCancel={(event) => onCancel && onCancel(event)}
    centered
    footer={null}
    width={800}
  >
    <InterfaceTextManager studioId={studioId} worldId={worldId} />
  </Modal>
)

InterfaceTextModal.displayName = 'InterfaceTextModal'

export default InterfaceTextModal
