import React, { useState } from 'react'

import { Modal } from 'antd'
import { QuestionCircleFilled } from '@ant-design/icons'

import { HELP_CONTENT, HelpTopic } from './content'

import styles from './styles.module.less'

/**
 * The in-app help modal, replacing the links to docs.elmstory.com that no longer
 * resolve. Content is written against the code in `content.tsx`; see the note
 * there and `VariableManager/VariableHelp.tsx`, which is the pattern this follows
 * for the variables and expressions topic.
 */
export const HelpModal: React.FC<{
  topic: HelpTopic
  open: boolean
  onClose: () => void
}> = ({ topic, open, onClose }) => {
  const entry = HELP_CONTENT[topic]

  if (!entry) return null

  return (
    <Modal
      title={entry.title}
      open={open}
      footer={null}
      onCancel={(event) => {
        event.stopPropagation()

        onClose()
      }}
      destroyOnClose
      width={440}
    >
      <div className={styles.helpBody}>{entry.body}</div>
    </Modal>
  )
}

HelpModal.displayName = 'HelpModal'

/**
 * The `?` button that opens the help modal. Callers with an existing help-icon
 * style pass it through `className` so their placement and hover are unchanged.
 * A topic with no help entry renders nothing.
 */
export const HelpButton: React.FC<{
  topic: HelpTopic
  className?: string
}> = ({ topic, className }) => {
  const [open, setOpen] = useState(false)

  const entry = HELP_CONTENT[topic]

  if (!entry) return null

  return (
    <>
      <div
        className={className ?? styles.HelpButton}
        title={`About: ${entry.title}`}
        onClick={(event) => {
          event.stopPropagation()

          setOpen(true)
        }}
      >
        <QuestionCircleFilled />
      </div>

      <HelpModal topic={topic} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

HelpButton.displayName = 'HelpButton'
