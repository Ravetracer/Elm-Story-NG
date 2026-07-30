import { describe, expect, it } from 'vitest'

import {
  composerReducer,
  defaultComposerState,
  COMPOSER_ACTION_TYPE
} from '../contexts/ComposerContext'

/**
 * Distraction-free mode has two exits that look alike and behave differently:
 * the button and Ctrl+Shift+F are the deliberate switch and set the preference,
 * while escape steps out of the view and leaves it armed. Nothing in either call
 * site says which is which, and getting it backwards makes the mode either
 * inescapable or impossible to stay in.
 *
 * `active` is what the Composer layout reads; `preferred` is what the next
 * content editor consults when it opens.
 */
const reduce = (
  ...actions: COMPOSER_ACTION_TYPE[]
): { active: boolean; preferred: boolean } =>
  actions.reduce(
    (state, type) => composerReducer(state, { type } as never),
    defaultComposerState
  ).distractionFreeMode

const {
  CONTENT_EDITOR_OPENED,
  CONTENT_EDITOR_CLOSED,
  TOGGLE_DISTRACTION_FREE_MODE,
  EXIT_DISTRACTION_FREE_MODE
} = COMPOSER_ACTION_TYPE

describe('distraction-free mode', () => {
  it('starts off', () => {
    expect(defaultComposerState.distractionFreeMode).toEqual({
      active: false,
      preferred: false
    })
  })

  it('opens an editor with the chrome shown until asked otherwise', () => {
    expect(reduce(CONTENT_EDITOR_OPENED)).toEqual({
      active: false,
      preferred: false
    })
  })

  it('is entered by the button or the shortcut, which arms the preference', () => {
    expect(reduce(CONTENT_EDITOR_OPENED, TOGGLE_DISTRACTION_FREE_MODE)).toEqual(
      {
        active: true,
        preferred: true
      }
    )
  })

  it('is left by the same switch, which disarms the preference', () => {
    expect(
      reduce(
        CONTENT_EDITOR_OPENED,
        TOGGLE_DISTRACTION_FREE_MODE,
        TOGGLE_DISTRACTION_FREE_MODE
      )
    ).toEqual({ active: false, preferred: false })
  })

  it('is left by escape without disarming the preference', () => {
    expect(
      reduce(
        CONTENT_EDITOR_OPENED,
        TOGGLE_DISTRACTION_FREE_MODE,
        EXIT_DISTRACTION_FREE_MODE
      )
    ).toEqual({ active: false, preferred: true })
  })

  // the author is never left in a composer with no panels and nothing open
  it('gives the chrome back when the editor closes, still armed', () => {
    expect(
      reduce(
        CONTENT_EDITOR_OPENED,
        TOGGLE_DISTRACTION_FREE_MODE,
        CONTENT_EDITOR_CLOSED
      )
    ).toEqual({ active: false, preferred: true })
  })

  it('re-enters on the next editor while armed', () => {
    expect(
      reduce(
        CONTENT_EDITOR_OPENED,
        TOGGLE_DISTRACTION_FREE_MODE,
        EXIT_DISTRACTION_FREE_MODE,
        CONTENT_EDITOR_CLOSED,
        CONTENT_EDITOR_OPENED
      )
    ).toEqual({ active: true, preferred: true })
  })

  it('does not re-enter on the next editor once switched off', () => {
    expect(
      reduce(
        CONTENT_EDITOR_OPENED,
        TOGGLE_DISTRACTION_FREE_MODE,
        TOGGLE_DISTRACTION_FREE_MODE,
        CONTENT_EDITOR_CLOSED,
        CONTENT_EDITOR_OPENED
      )
    ).toEqual({ active: false, preferred: false })
  })

  // escape steps out of the mode before it closes the editor, so the mode can
  // never be active without an editor to be active in
  it('cannot be active with no editor open', () => {
    expect(
      reduce(CONTENT_EDITOR_OPENED, TOGGLE_DISTRACTION_FREE_MODE)
    ).toHaveProperty('active', true)

    expect(
      reduce(
        CONTENT_EDITOR_OPENED,
        TOGGLE_DISTRACTION_FREE_MODE,
        CONTENT_EDITOR_CLOSED
      )
    ).toHaveProperty('active', false)
  })
})
