import { describe, expect, it } from 'vitest'

import { createEditor, Editor, Transforms, Range } from 'slate'

import { showVariableMenu } from '../lib/contentEditor'
import { EditorType, ELEMENT_FORMATS } from '../data/eventContentTypes'

/**
 * `showVariableMenu` is the `{ }` analog of `showCommandMenu`: it decides whether
 * the variable picker is open, with what filter, and over which range of text the
 * chosen title replaces. The thing worth pinning down is *when* it fires — the
 * closing brace is auto-paired ahead of the caret, so a picker that keyed on a
 * complete `{ … }` would never open while the author is mid-expression, and one
 * that keyed on a bare `{` would go on offering variables in ordinary prose after
 * the expression is closed.
 *
 * The target range matters just as much: it must span *only* the partial
 * identifier at the caret, never the brace or a preceding operator, because the
 * caller deletes it before inserting the variable's title.
 */

// A collapsed selection at the end of the single text leaf, i.e. the caret sits
// right after `text` — which is where it is while the author is typing.
const editorWithCaretAfter = (text: string): EditorType => {
  const editor = createEditor() as EditorType

  editor.children = [
    { type: ELEMENT_FORMATS.P, children: [{ text }] }
  ] as EditorType['children']

  Transforms.select(editor, Editor.end(editor, []))

  return editor
}

describe('the variable picker trigger', () => {
  it('does not fire in ordinary prose', () => {
    const [show] = showVariableMenu(editorWithCaretAfter('You open the door'))

    expect(show).toBe(false)
  })

  it('fires inside an open expression, capturing the partial name as the filter', () => {
    const [show, filter] = showVariableMenu(editorWithCaretAfter('Health: { heal'))

    expect(show).toBe(true)
    expect(filter).toBe('heal')
  })

  it('fires with an empty filter in a freshly opened `{ ` expression', () => {
    const [show, filter] = showVariableMenu(editorWithCaretAfter('Health: { '))

    expect(show).toBe(true)
    expect(filter).toBe('')
  })

  it('offers a variable for the second operand of an expression', () => {
    const [show, filter] = showVariableMenu(
      editorWithCaretAfter('{ health > ar')
    )

    expect(show).toBe(true)
    expect(filter).toBe('ar')
  })

  it('does not fire once the expression is closed', () => {
    const [show] = showVariableMenu(editorWithCaretAfter('{ health } and now'))

    expect(show).toBe(false)
  })

  it('targets only the partial identifier, not the brace before it', () => {
    const editor = editorWithCaretAfter('{ heal')
    const [, filter, target] = showVariableMenu(editor)

    expect(filter).toBe('heal')
    // The range spans exactly the four characters of "heal".
    const targeted = target && Editor.string(editor, target)

    expect(targeted).toBe('heal')
  })

  it('targets an empty range at the caret when nothing has been typed', () => {
    const editor = editorWithCaretAfter('{ ')
    const [, , target] = showVariableMenu(editor)

    expect(target && Range.isCollapsed(target)).toBe(true)
  })
})
