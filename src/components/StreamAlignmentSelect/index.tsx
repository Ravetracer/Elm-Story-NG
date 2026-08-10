import React from 'react'

import { STREAM_ALIGNMENT } from '../../data/types'

import { Select } from 'antd'

import styles from './styles.module.less'

/**
 * Where the reading column sits in the window, set once for the whole storyworld.
 *
 * CENTER is the layout every unset world already had, so it is offered as the
 * default rather than as "storyworld default" — like a transition, alignment has
 * no per-event override to inherit from. It is only visible on a screen wider
 * than the reading column; on a narrow window the column fills the width.
 */
const ALIGNMENTS: {
  value: STREAM_ALIGNMENT
  label: string
  description: string
}[] = [
  {
    value: STREAM_ALIGNMENT.CENTER,
    label: 'Center',
    description: 'The story sits in the middle of the window. The default.'
  },
  {
    value: STREAM_ALIGNMENT.LEFT,
    label: 'Left',
    description: 'The story hugs the left edge, leaving room on the right.'
  },
  {
    value: STREAM_ALIGNMENT.RIGHT,
    label: 'Right',
    description: 'The story hugs the right edge, leaving room on the left.'
  }
]

const StreamAlignmentSelect: React.FC<{
  value?: STREAM_ALIGNMENT
  onChange: (alignment: STREAM_ALIGNMENT) => void
}> = ({ value, onChange }) => (
  <Select
    className={styles.StreamAlignmentSelect}
    size="small"
    value={value ?? STREAM_ALIGNMENT.CENTER}
    onChange={(selected: STREAM_ALIGNMENT) => onChange(selected)}
    optionLabelProp="label"
  >
    {ALIGNMENTS.map(({ value: alignment, label, description }) => (
      <Select.Option value={alignment} key={alignment} label={label}>
        <div className={styles.optionLabel}>{label}</div>
        <div className={styles.optionDescription}>{description}</div>
      </Select.Option>
    ))}
  </Select>
)

StreamAlignmentSelect.displayName = 'StreamAlignmentSelect'

export default StreamAlignmentSelect
