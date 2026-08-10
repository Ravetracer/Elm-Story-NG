import React from 'react'

import { ENGINE_SKIN } from '../../data/types'

import { Select } from 'antd'

import styles from './styles.module.less'

/**
 * The storyworld's game-UI skin — bundled 9-slice art that dresses the inventory,
 * the character paperdoll, the choice modal and the panels.
 *
 * "None" is the unset default: the flat themed chrome the storyworld had before the
 * field existed. It is a sentinel in the closed select because antd cannot carry
 * `undefined` as an option value; `onChange` maps it back to `undefined`.
 *
 * The skin shows in the **exported** story, not the composer preview — like the
 * locked theme and the stream alignment — because the skin art is bundled into the
 * export and referenced by the engine's own stylesheet. Only the chosen skin's art
 * is packed into a given export.
 */
const NONE = 'NONE'

const SKINS: {
  value: string
  label: string
  description: string
}[] = [
  {
    value: NONE,
    label: 'None',
    description: 'The flat themed chrome. The default.'
  },
  {
    value: ENGINE_SKIN.MEDIEVAL,
    label: 'Medieval',
    description:
      'A warm RPG frame — carved panels and an equipment figure. Suits fantasy and adventure.'
  },
  {
    value: ENGINE_SKIN.SCIFI,
    label: 'Sci-fi',
    description:
      'A cool minimal space frame — thin glowing panels. Suits science fiction and near-future.'
  }
]

const SkinSelect: React.FC<{
  value?: ENGINE_SKIN
  onChange: (skin?: ENGINE_SKIN) => void
}> = ({ value, onChange }) => (
  <Select
    className={styles.SkinSelect}
    size="small"
    value={value ?? NONE}
    onChange={(selected: string) =>
      onChange(selected === NONE ? undefined : (selected as ENGINE_SKIN))
    }
    optionLabelProp="label"
  >
    {SKINS.map(({ value: skin, label, description }) => (
      <Select.Option value={skin} key={skin} label={label}>
        <div className={styles.optionLabel}>{label}</div>
        <div className={styles.optionDescription}>{description}</div>
      </Select.Option>
    ))}
  </Select>
)

SkinSelect.displayName = 'SkinSelect'

export default SkinSelect
