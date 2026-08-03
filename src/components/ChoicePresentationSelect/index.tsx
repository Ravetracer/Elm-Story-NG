import React from 'react'

import { CHOICE_PRESENTATION } from '../../data/types'

import { Select } from 'antd'

import styles from './styles.module.less'

/**
 * The one description of what each `CHOICE_PRESENTATION` means to an author.
 *
 * Shared by the storyworld's default and the per-event override so the two cannot
 * describe the same setting differently — the same argument as `ASSET_KINDS` in
 * `lib/assets.ts` being the one description of an asset kind.
 *
 * **"Inline" here is the layout of the whole set, not the inline choices feature.**
 * That one is per choice and lives in a sentence, placed by the author as a node in
 * the prose; this says how the choices *beneath* the prose are arranged. The
 * descriptions below have to keep saying so, because the two share a word.
 */
const PRESENTATIONS: {
  value: CHOICE_PRESENTATION
  label: string
  description: string
}[] = [
  {
    value: CHOICE_PRESENTATION.LIST,
    label: 'List',
    description: 'One under another, beneath the prose.'
  },
  {
    value: CHOICE_PRESENTATION.INLINE,
    label: 'Row',
    description: 'Side by side on one line, wrapping as needed.'
  },
  {
    value: CHOICE_PRESENTATION.MODAL,
    label: 'Modal',
    description: 'Over the story, dismissable to read it again.'
  }
]

// only ever the value of the event's select, where it means "whatever the storyworld
// says"; the storyworld's own select has nothing to fall back to
const INHERIT = '___inherit___'

const ChoicePresentationSelect: React.FC<{
  value?: CHOICE_PRESENTATION
  /** The event's select offers this, and shows what it currently resolves to. */
  inheritedFrom?: CHOICE_PRESENTATION
  allowInherit?: boolean
  onChange: (presentation?: CHOICE_PRESENTATION) => void
}> = ({ value, inheritedFrom, allowInherit, onChange }) => (
  <Select
    className={styles.ChoicePresentationSelect}
    size="small"
    value={value ?? (allowInherit ? INHERIT : CHOICE_PRESENTATION.LIST)}
    onChange={(selected: string) =>
      onChange(
        selected === INHERIT ? undefined : (selected as CHOICE_PRESENTATION)
      )
    }
    optionLabelProp="label"
  >
    {allowInherit && (
      <Select.Option value={INHERIT} label="Storyworld default">
        <div className={styles.optionLabel}>Storyworld default</div>
        <div className={styles.optionDescription}>
          {
            PRESENTATIONS.find(
              ({ value: presentation }) =>
                presentation ===
                (inheritedFrom ?? CHOICE_PRESENTATION.LIST)
            )?.label
          }
          , as the storyworld is set.
        </div>
      </Select.Option>
    )}

    {PRESENTATIONS.map(({ value: presentation, label, description }) => (
      <Select.Option value={presentation} key={presentation} label={label}>
        <div className={styles.optionLabel}>{label}</div>
        <div className={styles.optionDescription}>{description}</div>
      </Select.Option>
    ))}
  </Select>
)

ChoicePresentationSelect.displayName = 'ChoicePresentationSelect'

export default ChoicePresentationSelect
