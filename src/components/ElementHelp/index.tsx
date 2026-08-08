import React, { useEffect, useState } from 'react'

import { Modal } from 'antd'
import { QuestionCircleFilled } from '@ant-design/icons'

import { HELP_CONTENT, HELP_GROUPS, HelpTopic, helpTopicTitle } from './content'

import { VariableHelpContent } from '../VariableManager/VariableHelp'

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

/** The body of a hub topic: the shared expression reference, or a content entry. */
const HubTopicBody: React.FC<{ topic: HelpTopic }> = ({ topic }) => {
  if (topic === 'EXPRESSIONS') return <VariableHelpContent />

  const entry = HELP_CONTENT[topic]

  if (!entry) return null

  return <div className={styles.helpBody}>{entry.body}</div>
}

/**
 * The browsable Help hub, opened from the title bar's Help button and the native
 * Help menu. A grouped list of every topic on the left, the selected one on the
 * right. Single-topic `?` buttons still open `HelpModal` directly; this is the
 * "all the help in one place" entry, and the intended source for a docs site.
 */
export const HelpHub: React.FC<{
  open: boolean
  initialTopic: HelpTopic
  onClose: () => void
}> = ({ open, initialTopic, onClose }) => {
  const [topic, setTopic] = useState<HelpTopic>(initialTopic)

  // Reopening from a different location (dashboard vs composer) starts on that
  // location's overview rather than wherever the hub was last left.
  useEffect(() => {
    if (open) setTopic(initialTopic)
  }, [open, initialTopic])

  return (
    <Modal
      title="Help"
      open={open}
      footer={null}
      onCancel={(event) => {
        event.stopPropagation()

        onClose()
      }}
      destroyOnClose
      width={780}
      className={styles.helpHub}
    >
      <div className={styles.hubLayout}>
        <nav className={styles.hubNav}>
          {HELP_GROUPS.map((group) => (
            <div key={group.label} className={styles.hubGroup}>
              <div className={styles.hubGroupLabel}>{group.label}</div>

              {group.topics.map((groupTopic) => (
                <button
                  key={groupTopic}
                  type="button"
                  className={
                    groupTopic === topic ? styles.hubTopicActive : styles.hubTopic
                  }
                  onClick={() => setTopic(groupTopic)}
                >
                  {helpTopicTitle(groupTopic)}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.hubContent}>
          <h3 className={styles.hubTitle}>{helpTopicTitle(topic)}</h3>

          <HubTopicBody topic={topic} />
        </div>
      </div>
    </Modal>
  )
}

HelpHub.displayName = 'HelpHub'
