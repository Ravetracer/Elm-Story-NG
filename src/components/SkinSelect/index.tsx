import React from 'react'

import { ENGINE_SKIN } from '../../data/types'

import { Switch } from 'antd'

import styles from './styles.module.less'

/**
 * The storyworld's game-UI skin — a bundled 9-slice medieval frame that dresses
 * the inventory, the character paperdoll, the choice modal and the panels.
 *
 * There is one skin, so this is an on/off toggle: on wears MEDIEVAL, off is the
 * flat themed chrome (the default the storyworld had before the field existed). A
 * stale value from a world that once used the removed Sci-fi skin reads as off,
 * and toggling clears it to `undefined`.
 *
 * The skin shows in the **exported** story, not the composer preview — like the
 * locked theme and the stream alignment — because the skin art is bundled into the
 * export and referenced by the engine's own stylesheet.
 */
const SkinSelect: React.FC<{
  value?: ENGINE_SKIN
  onChange: (skin?: ENGINE_SKIN) => void
}> = ({ value, onChange }) => (
  <div className={styles.SkinSelect}>
    <div className={styles.toggleRow}>
      <Switch
        size="small"
        checked={value === ENGINE_SKIN.MEDIEVAL}
        onChange={(on) => onChange(on ? ENGINE_SKIN.MEDIEVAL : undefined)}
      />

      <span className={styles.toggleLabel}>Medieval skin</span>
    </div>

    <div className={styles.description}>
      A warm RPG frame — carved panels and an equipment paperdoll — over the flat
      themed chrome. Shows in the exported story, not the preview.
    </div>
  </div>
)

SkinSelect.displayName = 'SkinSelect'

export default SkinSelect
