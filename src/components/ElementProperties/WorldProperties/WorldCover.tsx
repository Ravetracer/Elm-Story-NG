import React, { useCallback, useState } from 'react'

import { StudioId, World, WorldId } from '../../../data/types'
import { ASSET_KIND, ASSET_KINDS } from '../../../lib/assets'

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
 * **Clearing removes the file, choosing does not.** Replacing leaves the old asset
 * on disk for the asset manager to judge, because two elements may share an id and
 * the picker makes sharing ordinary — the rule `CLAUDE.md` states for every other
 * slot. Clearing is deliberate, so it goes through
 * `removeAssetIfUnreferenced`, **after** the reference is cleared: the count is read
 * back out of the database, so a world still holding the id counts as a reference
 * and nothing would ever be removed.
 */
const WorldCover: React.FC<{ studioId: StudioId; world: World }> = ({
  studioId,
  world
}) => {
  const [pickerVisible, setPickerVisible] = useState(false)

  const setCover = useCallback(
    async (coverAssetId?: string) => {
      const previous = world.coverAssetId

      await api().worlds.saveWorld(studioId, { ...world, coverAssetId })

      // only on a clear; see the note above
      if (!coverAssetId && previous) {
        await api().assets.removeAssetIfUnreferenced(
          studioId,
          world.id as WorldId,
          previous,
          ASSET_KINDS[ASSET_KIND.WORLD_COVER].ext
        )
      }
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
