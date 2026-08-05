import React from 'react'

import { ENGINE_TRANSITION } from '../../data/types'

import { Select } from 'antd'

import styles from './styles.module.less'

/**
 * How a live event enters the story stream, set once for the whole storyworld.
 *
 * FADE is the default an unset world already had, so it is offered as the
 * default rather than as "storyworld default" — unlike a choice presentation,
 * a transition has no per-event override to inherit from. NONE is the author's
 * own opt-out; a reduced-motion player gets no animation regardless of this.
 */
const TRANSITIONS: {
  value: ENGINE_TRANSITION
  label: string
  description: string
}[] = [
  {
    value: ENGINE_TRANSITION.FADE,
    label: 'Fade',
    description: 'Each new event fades in. The default.'
  },
  {
    value: ENGINE_TRANSITION.SLIDE,
    label: 'Slide',
    description: 'Each new event fades in while rising into place.'
  },
  {
    value: ENGINE_TRANSITION.NONE,
    label: 'None',
    description: 'Events appear at once, with no animation.'
  }
]

const TransitionSelect: React.FC<{
  value?: ENGINE_TRANSITION
  onChange: (transition: ENGINE_TRANSITION) => void
}> = ({ value, onChange }) => (
  <Select
    className={styles.TransitionSelect}
    size="small"
    value={value ?? ENGINE_TRANSITION.FADE}
    onChange={(selected: ENGINE_TRANSITION) => onChange(selected)}
    optionLabelProp="label"
  >
    {TRANSITIONS.map(({ value: transition, label, description }) => (
      <Select.Option value={transition} key={transition} label={label}>
        <div className={styles.optionLabel}>{label}</div>
        <div className={styles.optionDescription}>{description}</div>
      </Select.Option>
    ))}
  </Select>
)

TransitionSelect.displayName = 'TransitionSelect'

export default TransitionSelect
