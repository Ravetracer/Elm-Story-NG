import React, { useCallback, useState } from 'react'

import { StudioId, World, WorldId } from '../../../data/types'
import { ASSET_KIND } from '../../../lib/assets'

import { Button } from 'antd'

import { AssetsModal } from '../../Modal'
import AssetThumbnail from '../../AssetThumbnail'

import api from '../../../api'

import styles from './styles.module.less'

/**
 * The storyworld's background, filled behind the engine's reading column. The
 * same shape as `WorldCover` — writes immediately, clearing removes the file and
 * choosing does not, because two elements may share an id and the picker makes
 * sharing ordinary. See that component for the full reasoning.
 */
const WorldBackground: React.FC<{ studioId: StudioId; world: World }> = ({
  studioId,
  world
}) => {
  const [pickerVisible, setPickerVisible] = useState(false)

  const setBackground = useCallback(
    async (backgroundAssetId?: string) => {
      // Clearing removes only the reference; the file is left on disk for the
      // asset manager to trash, which is the one place assets are deleted.
      await api().worlds.saveWorld(studioId, { ...world, backgroundAssetId })
    },
    [studioId, world]
  )

  return (
    <>
      {pickerVisible && (
        <AssetsModal
          studioId={studioId}
          worldId={world.id as WorldId}
          subject={world.title}
          visible
          selectKind={ASSET_KIND.WORLD_BACKGROUND}
          selectedAssetId={world.backgroundAssetId}
          onSelect={async (assetId) => {
            await setBackground(assetId)

            setPickerVisible(false)
          }}
          onCancel={() => setPickerVisible(false)}
        />
      )}

      <div className={styles.cover}>
        <AssetThumbnail
          studioId={studioId}
          worldId={world.id as WorldId}
          kind={ASSET_KIND.WORLD_BACKGROUND}
          assetId={world.backgroundAssetId}
          className={styles.coverThumbnail}
        />

        <div className={styles.coverActions}>
          <Button type="link" onClick={() => setPickerVisible(true)}>
            {world.backgroundAssetId ? 'Change...' : 'Choose...'}
          </Button>

          {world.backgroundAssetId && (
            <Button type="link" danger onClick={() => setBackground(undefined)}>
              Clear
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

WorldBackground.displayName = 'WorldBackground'

export default WorldBackground
