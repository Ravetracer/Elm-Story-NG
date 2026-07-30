import React from 'react'

import { StudioId, WorldId } from '../../data/types'

import { Modal, ModalProps } from 'antd'
import { PictureOutlined } from '@ant-design/icons'

import AssetManager from '../AssetManager'
import { ASSET_KIND, ASSET_KINDS } from '../../lib/assets'

import styles from './styles.module.less'

interface AssetsModalProps extends ModalProps {
  studioId: StudioId
  /**
   * The world id rather than the World, because the picker is opened from places
   * that hold an element and not the storyworld it belongs to — a character
   * mask, an image inside an event's content, a scene's audio profile.
   */
  worldId: WorldId
  /** shown after the dash in the title; the storyworld's title where there is one */
  subject?: string
  visible?: boolean
  /** set to open the manager as a picker for one kind of asset */
  selectKind?: ASSET_KIND
  onSelect?: (assetId: string) => void
  selectedAssetId?: string
}

const AssetsModal: React.FC<AssetsModalProps> = ({
  studioId,
  worldId,
  subject,
  visible,
  selectKind,
  onSelect,
  selectedAssetId,
  onCancel
}) => (
  <Modal
    title={
      <>
        <PictureOutlined className={styles.icon} />{' '}
        {selectKind ? `Choose ${ASSET_KINDS[selectKind].label}` : 'Assets'}
        {subject ? ` — ${subject}` : ''}
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
    <AssetManager
      studioId={studioId}
      worldId={worldId}
      selectKind={selectKind}
      onSelect={onSelect}
      selectedAssetId={selectedAssetId}
    />
  </Modal>
)

AssetsModal.displayName = 'AssetsModal'

export default AssetsModal
