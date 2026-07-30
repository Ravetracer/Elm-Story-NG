import React from 'react'

import { StudioId, World, WorldId } from '../../data/types'

import { Modal, ModalProps } from 'antd'
import { NumberOutlined } from '@ant-design/icons'

import VariableManager from '../VariableManager'

import styles from './styles.module.less'

interface VariablesModalProps extends ModalProps {
  studioId: StudioId
  world: World
  visible?: boolean
  // open onto the reference rather than the list; destroyOnClose means the
  // manager remounts on every open, so this is read fresh each time
  helpOpen?: boolean
}

const VariablesModal: React.FC<VariablesModalProps> = ({
  studioId,
  world,
  visible,
  helpOpen,
  onCancel
}) => (
  <Modal
    title={
      <>
        <NumberOutlined className={styles.icon} /> Variables — {world.title}
      </>
    }
    visible={visible}
    destroyOnClose
    onCancel={(event) => onCancel && onCancel(event)}
    centered
    footer={null}
    width={860}
    className={styles.VariablesModal}
  >
    {world.id && (
      <VariableManager
        studioId={studioId}
        worldId={world.id as WorldId}
        helpOpen={helpOpen}
      />
    )}
  </Modal>
)

VariablesModal.displayName = 'VariablesModal'

export default VariablesModal
