import React, { useMemo, useState } from 'react'

import { useSlateStatic } from 'slate-react'

import { ElementId, StudioId } from '../../../../data/types'
import { ChoiceElement } from '../../../../data/eventContentTypes'

import { getInlinedChoiceIdsFromEventContent } from '../../../../lib/contentEditor'

import { useChoicesByEventRef } from '../../../../hooks'

import { Dropdown, Menu } from 'antd'
import { BranchesOutlined, PlusOutlined } from '@ant-design/icons'

import styles from '../styles.module.less'

export type OnChoiceSelect = (
  selection:
    | { type: 'EXISTING'; choiceId: ElementId }
    | { type: 'NEW' }
    | { type: 'REMOVE' }
) => void

/**
 * The picker behind an inline choice.
 *
 * It exists because an inline choice is most often **not** a new one: an author with
 * a storyworld already written wants to move a choice out of the list beneath the
 * prose and into the sentence, for the reading flow, without losing the paths drawn
 * from it. So the menu offers this event's choices first and "New choice" last,
 * rather than the other way round.
 *
 * **It only offers choices that are not already in the prose.** A choice mentioned
 * twice would give the player two ways to take one path and the author no way to
 * tell the mentions apart, so `getInlinedChoiceIdsFromEventContent` reads the live
 * document — not the saved `Event.content`, which is up to a debounce behind — and
 * this subtracts it. The choice this node currently holds is excluded from that
 * subtraction, since it is the one being replaced.
 *
 * The overlay is a `Menu` on purpose: an antd `Dropdown` whose overlay is not one
 * does not dismiss when an entry is clicked, and a dropdown sits at z-index 1050
 * against a modal's 1000. See CLAUDE.md, bug class 3.
 */
const ChoiceElementSelect: React.FC<{
  studioId: StudioId
  eventId: ElementId
  element: ChoiceElement
  onChoiceSelect: OnChoiceSelect
}> = ({ studioId, eventId, element, onChoiceSelect, children }) => {
  // static: this must not re-render on every selection change, and it reads the
  // document only when the menu is built
  const editor = useSlateStatic()

  const choices = useChoicesByEventRef(studioId, eventId, [studioId, eventId])

  const [visible, setVisible] = useState(false)

  const available = useMemo(() => {
    if (!choices) return []

    const inlined = getInlinedChoiceIdsFromEventContent(editor).filter(
      (id) => id !== element.choice_id
    )

    return choices.filter(
      (choice) => choice.id && !inlined.includes(choice.id)
    )
  }, [choices, element.choice_id, visible])

  const overlay = (
    <Menu className={styles.choiceSelectMenu}>
      {available.length > 0 && (
        <Menu.ItemGroup title="Choices in this event">
          {available.map(({ id: choiceId, title }) =>
            choiceId === undefined ? null : (
                <Menu.Item
                  key={choiceId}
                  icon={<BranchesOutlined />}
                  onClick={() => {
                    setVisible(false)

                    if (choiceId === element.choice_id) return

                    onChoiceSelect({
                      type: 'EXISTING',
                      choiceId
                    })
                  }}
                >
                  {title}
                  {choiceId === element.choice_id ? ' (in the text)' : ''}
                </Menu.Item>
              )
          )}
        </Menu.ItemGroup>
      )}

      {available.length > 0 && <Menu.Divider />}

      <Menu.Item
        key="new"
        icon={<PlusOutlined />}
        onClick={() => {
          setVisible(false)

          onChoiceSelect({ type: 'NEW' })
        }}
      >
        New choice
      </Menu.Item>

      {element.choice_id !== undefined && (
        <>
          <Menu.Divider />

          <Menu.Item
            key="remove"
            danger
            onClick={() => {
              setVisible(false)

              onChoiceSelect({ type: 'REMOVE' })
            }}
          >
            Remove from the text
          </Menu.Item>
        </>
      )}
    </Menu>
  )

  return (
    <Dropdown
      overlay={overlay}
      trigger={['click']}
      visible={visible}
      onVisibleChange={setVisible}
    >
      {/* the chip, whatever state it is in — see EventContentElement */}
      <span className={styles.choiceSelectTrigger}>{children}</span>
    </Dropdown>
  )
}

ChoiceElementSelect.displayName = 'ChoiceElementSelect'

export default ChoiceElementSelect
