import React, { useEffect, useRef } from 'react'

import { BaseRange } from 'slate'
import { ReactEditor, useSlate } from 'slate-react'

import { ExpressionSuggestion } from '../../../../lib/contentEditor/expressionHelper'

import Portal from '../../../Portal'

import styles from './styles.module.less'

/**
 * The type-aware "how do I continue this expression" menu — the second half of the
 * `{ }` picker, opened by `Ctrl+Space` when the caret sits just after a complete
 * operand. Its items come from `getExpressionSuggestions`, tailored to the
 * operand's declared type (see `lib/contentEditor/expressionHelper.ts`); it emits
 * the chosen `ExpressionSuggestion`, and the parent inserts its snippet.
 *
 * Unlike the variable picker it has no text filter — the author is not typing a
 * name here, they are choosing an operator, a method or a condition from a short
 * fixed set — so it is a straight keyboard-navigable list.
 */
const ExpressionHelperMenu: React.FC<{
  show: boolean
  target: BaseRange | undefined
  index: number
  suggestions: ExpressionSuggestion[]
  onItemTotal: (total: number) => void
  onItemSelect: (suggestion: ExpressionSuggestion) => void
  onItemClick: (suggestion: ExpressionSuggestion) => void
}> = ({
  show,
  target,
  index,
  suggestions,
  onItemTotal,
  onItemSelect,
  onItemClick
}) => {
  const helperMenuRef = useRef<HTMLDivElement | null>(null)

  const editor = useSlate()

  useEffect(() => onItemTotal(suggestions.length), [suggestions])

  useEffect(() => {
    const item = suggestions[index]

    if (item) {
      const elements = document.getElementsByClassName('expression-helper-item')

      elements[index] && elements[index].scrollIntoView({ block: 'end' })

      onItemSelect(item)
    }
  })

  useEffect(() => {
    const { selection } = editor

    if (!selection || !target) return

    const domRange = ReactEditor.toDOMRange(editor, target),
      rect = domRange?.getBoundingClientRect()

    if (helperMenuRef.current) {
      if (rect) {
        helperMenuRef.current.style.top = `${Math.round(rect.bottom + 6)}px`
        helperMenuRef.current.style.left = `${Math.round(rect.x)}px`
        helperMenuRef.current.style.opacity = '1'

        return
      }

      helperMenuRef.current.style.opacity = '0'
    }
  })

  return (
    <>
      {show && (
        <Portal>
          <div ref={helperMenuRef} className="event-content-expression-helper">
            <div className={styles.container}>
              <section>
                <h1>Continue…</h1>

                {suggestions.map((suggestion, _index) => {
                  const selected = _index === index

                  return (
                    <div
                      key={suggestion.key}
                      className={`${styles.item} ${
                        selected ? styles.selected : ''
                      } expression-helper-item`}
                      onClick={() => onItemClick(suggestion)}
                    >
                      <span className={styles.variableTitle}>
                        {suggestion.label}
                      </span>
                      {suggestion.hint && (
                        <span className={styles.variableType}>
                          {suggestion.hint}
                        </span>
                      )}
                    </div>
                  )
                })}

                {suggestions.length === 0 && (
                  <div className={`${styles.item} ${styles.noMatch}`}>
                    Nothing to suggest here…
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

ExpressionHelperMenu.displayName = 'ExpressionHelperMenu'

export default ExpressionHelperMenu
