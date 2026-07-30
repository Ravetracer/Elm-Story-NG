import React from 'react'

import { StudioId, World, WorldId } from '../../data/types'

import { Modal, ModalProps } from 'antd'
import { PictureOutlined } from '@ant-design/icons'

import AssetManager from '../AssetManager'

import styles from './styles.module.less'

interface AssetsModalProps extends ModalProps {
  studioId: StudioId
  world: World
  visible?: boolean
}

const AssetsModal: React.FC<AssetsModalProps> = ({
  studioId,
  world,
  visible,
  onCancel
}) => (
  <Modal
    title={
      <>
        <PictureOutlined className={styles.icon} /> Assets — {world.title}
      </>
    }
    visible={visible}
    destroyOnClose
    onCancel={(event) => onCancel && onCancel(event)}
    centered
    footer={null}
    width={860}
    className={styles.AssetsModal}
  >
    {world.id && (
      <AssetManager studioId={studioId} worldId={world.id as WorldId} />
    )}
  </Modal>
)

AssetsModal.displayName = 'AssetsModal'

export default AssetsModal
