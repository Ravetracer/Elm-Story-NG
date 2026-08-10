import React from 'react'

import { ENGINE_THEME } from '../../data/types'

import { Select } from 'antd'

import styles from './styles.module.less'

/**
 * The storyworld's base palette. Set once for the whole world, and when set it
 * *locks* — the player's own theme toggle is hidden in the exported story.
 *
 * "Let the player choose" is the unset default: the storyworld behaves exactly as
 * it did before the field existed, with the player picking dark or light. It is a
 * sentinel in the closed select because antd cannot carry `undefined` as an
 * option value; `onChange` maps it back to `undefined`.
 */
const PLAYER_CHOICE = 'PLAYER_CHOICE'

const THEMES: {
  value: string
  label: string
  description: string
}[] = [
  {
    value: PLAYER_CHOICE,
    label: 'Let the player choose',
    description: 'The player picks dark or light in the story’s settings. The default.'
  },
  {
    value: ENGINE_THEME.CONSOLE,
    label: 'Dark',
    description: 'Locks the story to the dark theme. The player cannot change it.'
  },
  {
    value: ENGINE_THEME.BOOK,
    label: 'Light',
    description: 'Locks the story to the light theme. The player cannot change it.'
  }
]

const ThemeSelect: React.FC<{
  value?: ENGINE_THEME
  onChange: (theme?: ENGINE_THEME) => void
}> = ({ value, onChange }) => (
  <Select
    className={styles.ThemeSelect}
    size="small"
    value={value ?? PLAYER_CHOICE}
    onChange={(selected: string) =>
      onChange(selected === PLAYER_CHOICE ? undefined : (selected as ENGINE_THEME))
    }
    optionLabelProp="label"
  >
    {THEMES.map(({ value: theme, label, description }) => (
      <Select.Option value={theme} key={theme} label={label}>
        <div className={styles.optionLabel}>{label}</div>
        <div className={styles.optionDescription}>{description}</div>
      </Select.Option>
    ))}
  </Select>
)

ThemeSelect.displayName = 'ThemeSelect'

export default ThemeSelect
