import React, { useCallback, useState } from 'react'

import { StudioId, World, WorldId } from '../../../data/types'
import { ASSET_KIND } from '../../../lib/assets'

import { Button } from 'antd'

import { AssetsModal } from '../../Modal'
import AssetThumbnail from '../../AssetThumbnail'

import api from '../../../api'

import styles from './styles.module.less'

/**
 * The storyworld's cover, shown on the dashboard card and behind the engine's
 * title card.
 *
 * Writes immediately rather than through the metadata form beside it. The form
 * batches text fields behind a Save, which is right for text and wrong for a
 * picker: the choice is already made in a modal that has its own confirmation, and
 * a second Save to commit it reads as the pick not having worked.
 *
 * **Neither clearing nor choosing removes the file.** Both write only the
 * reference; the cover image stays on disk and shows as unused in the asset
 * manager, which is the one place assets are trashed — the rule `CLAUDE.md`
 * states for every slot. A cleared cover simply becomes an unused asset.
 */
const WorldCover: React.FC<{ studioId: StudioId; world: World }> = ({
  studioId,
  world
}) => {
  const [pickerVisible, setPickerVisible] = useState(false)

  const setCover = useCallback(
    async (coverAssetId?: string) => {
      // Clearing removes only the reference; the file is left on disk for the
      // asset manager to trash, which is the one place assets are deleted.
      await api().worlds.saveWorld(studioId, { ...world, coverAssetId })
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
          selectKind={ASSET_KIND.WORLD_COVER}
          selectedAssetId={world.coverAssetId}
          onSelect={async (assetId) => {
            await setCover(assetId)

            setPickerVisible(false)
          }}
          onCancel={() => setPickerVisible(false)}
        />
      )}

      <div className={styles.cover}>
        <AssetThumbnail
          studioId={studioId}
          worldId={world.id as WorldId}
          kind={ASSET_KIND.WORLD_COVER}
          assetId={world.coverAssetId}
          className={styles.coverThumbnail}
        />

        <div className={styles.coverActions}>
          <Button type="link" onClick={() => setPickerVisible(true)}>
            {world.coverAssetId ? 'Change...' : 'Choose...'}
          </Button>

          {world.coverAssetId && (
            <Button type="link" danger onClick={() => setCover(undefined)}>
              Clear
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

WorldCover.displayName = 'WorldCover'

export default WorldCover
