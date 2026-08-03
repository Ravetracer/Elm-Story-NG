import React, { useEffect, useRef, useState } from 'react'

import { Input, Modal } from 'antd'
import type { InputRef } from 'antd'
import { WarningOutlined } from '@ant-design/icons'

import { generateVariableTitle, sanitizeVariableTitle } from './addVariable'

import styles from './styles.module.less'

/**
 * Names a variable before it exists.
 *
 * A generated name is only useful to an author who has none of their own, and
 * it is the hardest thing to find again in a list of them — so the generated
 * name is the starting point of a field rather than the result of the click.
 */
const AddVariableModal: React.FC<{
  visible: boolean
  existingTitles: Set<string>
  onAdd: (title: string) => void
  onCancel: () => void
}> = ({ visible, existingTitles, onAdd, onCancel }) => {
  const titleInputRef = useRef<InputRef | null>(null)

  // Generated once per mount rather than in an effect on `visible`: the
  // manager keys this component on the open, so a mount is an open.
  const [title, setTitle] = useState(generateVariableTitle)

  useEffect(() => {
    if (!visible) return

    // The body mounts with the dialog's transition, so there is nothing to
    // select on the render that opens it. The second attempt is for the +
    // on the Variables panel, which opens the Variables modal and this one
    // together: rc-dialog focuses a dialog when its transition ends, so the
    // outer one takes the focus back at ~300ms. Measured in the running app.
    const timeouts = [120, 450].map((delay) =>
      setTimeout(() => titleInputRef.current?.select(), delay)
    )

    return () => timeouts.forEach(clearTimeout)
  }, [visible])

  const sanitizedTitle = sanitizeVariableTitle(title)

  const submit = () => sanitizedTitle && onAdd(sanitizedTitle)

  return (
    <Modal
      title="Add Variable"
      visible={visible}
      centered
      destroyOnClose
      // above the Variables modal this is opened from: antd gives both the
      // same z-index and relies on DOM order, which a portal does not promise
      zIndex={1010}
      // the point of the prompt is that the new row is nameable straight
      // away, and rc-dialog hands the focus back to the trigger after its
      // close transition — which is later than the row's own focus() call
      focusTriggerAfterClose={false}
      okText="Add"
      okButtonProps={{ disabled: !sanitizedTitle }}
      onOk={submit}
      onCancel={onCancel}
      width={420}
      className={styles.AddVariableModal}
    >
      <Input
        ref={titleInputRef}
        value={title}
        spellCheck={false}
        placeholder="Variable title"
        onChange={(event) => setTitle(event.target.value)}
        onPressEnter={submit}
      />

      {sanitizedTitle !== title && (
        <div className={styles.addHint}>
          Digits, spaces and punctuation are not part of a title. Stored as{' '}
          <code>{sanitizedTitle || '—'}</code>.
        </div>
      )}

      {sanitizedTitle && existingTitles.has(sanitizedTitle) && (
        <div className={`${styles.addHint} ${styles.duplicate}`}>
          <WarningOutlined /> Another variable has this title. Template
          expressions resolve by title, so any expression naming it would be
          ambiguous.
        </div>
      )}
    </Modal>
  )
}

AddVariableModal.displayName = 'AddVariableModal'

export default AddVariableModal
