import React, { useEffect, useRef, useState } from 'react'

import { BaseRange } from 'slate'
import { ReactEditor, useSlate } from 'slate-react'

import { Variable } from '../../../../data/types'

import Portal from '../../../Portal'

import styles from './styles.module.less'

const getFilteredVariables = (
  variables: Variable[],
  filter: string | undefined
) => {
  if (!filter) return variables

  const filterLowercased = filter.toLowerCase()

  return variables.filter((variable) =>
    variable.title.toLowerCase().includes(filterLowercased)
  )
}

/**
 * The variable picker behind the `{` expression trigger and the `Alt+Space`
 * shortcut — the inline-choice analog of `CommandMenu`, listing the world's
 * variables so an expression names one by picking rather than by typing its
 * title exactly (which template expressions resolve by, so a typo renders an
 * ERROR span rather than failing anywhere a build would notice).
 *
 * On select it emits the variable's **title**, which is what the expression
 * language keys on; the parent replaces the partial identifier at the caret
 * with it.
 */
const VariableMenu: React.FC<{
  show: boolean
  filter: string | undefined
  target: BaseRange | undefined
  index: number
  variables: Variable[]
  onItemTotal: (total: number) => void
  onItemSelect: (title: string) => void
  onItemClick: (title: string) => void
}> = ({
  show,
  filter,
  target,
  index,
  variables,
  onItemTotal,
  onItemSelect,
  onItemClick
}) => {
  const variableMenuRef = useRef<HTMLDivElement | null>(null)

  const editor = useSlate()

  const [items, setItems] = useState<Variable[]>([])

  useEffect(() => {
    setItems(getFilteredVariables(variables, filter))
  }, [variables, filter])

  useEffect(() => onItemTotal(items.length), [items])

  useEffect(() => {
    const item = items[index]

    if (item) {
      const elements = document.getElementsByClassName('variable-menu-item')

      elements[index] && elements[index].scrollIntoView({ block: 'end' })

      onItemSelect(item.title)
    }
  })

  useEffect(() => {
    const { selection } = editor

    if (!selection || !target) return

    const domRange = ReactEditor.toDOMRange(editor, target),
      rect = domRange?.getBoundingClientRect()

    if (variableMenuRef.current) {
      if (rect) {
        variableMenuRef.current.style.top = `${Math.round(rect.bottom + 6)}px`
        variableMenuRef.current.style.left = `${Math.round(rect.x)}px`
        variableMenuRef.current.style.opacity = '1'

        return
      }

      variableMenuRef.current.style.opacity = '0'
    }
  })

  return (
    <>
      {show && (
        <Portal>
          <div ref={variableMenuRef} className="event-content-variable-menu">
            <div className={styles.container}>
              <section>
                <h1>Variables</h1>

                {items.map((variable, _index) => {
                  const selected = _index === index

                  return (
                    <div
                      key={variable.id}
                      className={`${styles.item} ${
                        selected ? styles.selected : ''
                      } variable-menu-item`}
                      onClick={() => onItemClick(variable.title)}
                    >
                      <span className={styles.variableTitle}>
                        {variable.title}
                      </span>
                      <span className={styles.variableType}>
                        {variable.type}
                      </span>
                    </div>
                  )
                })}

                {items.length === 0 && (
                  <div className={`${styles.item} ${styles.noMatch}`}>
                    {variables.length === 0
                      ? 'No variables yet…'
                      : 'No matches…'}
                  </div>
                )}
              </section>
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}

VariableMenu.displayName = 'VariableMenu'

export default VariableMenu
