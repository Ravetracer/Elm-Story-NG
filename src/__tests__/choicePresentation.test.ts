import { describe, expect, it } from 'vitest'

import { resolveChoicePresentation } from '../../engine/src/lib'

import { CHOICE_PRESENTATION } from '../../engine/src/types'

import {
  INTERFACE_TEXT_DEFAULTS,
  INTERFACE_TEXT_KEY
} from '../../engine/src/lib/interfaceText'

const { LIST, INLINE, MODAL } = CHOICE_PRESENTATION

/**
 * How a set of choices is offered: `Event.choicePresentation` if the author set one,
 * else `World.choicePresentation`, else a list.
 *
 * Both fields shipped unused in section 3, so the case that matters most is the one
 * with neither set — every storyworld written before them, which has to keep
 * presenting exactly as it always did.
 */
describe('resolving how an event offers its choices', () => {
  it('falls back to a list when neither the event nor the world says', () => {
    // every storyworld written before either field existed
    expect(resolveChoicePresentation(undefined, undefined)).toBe(LIST)
    expect(resolveChoicePresentation()).toBe(LIST)
  })

  it('takes the storyworld default when the event has no override', () => {
    expect(resolveChoicePresentation(undefined, MODAL)).toBe(MODAL)
    expect(resolveChoicePresentation(undefined, INLINE)).toBe(INLINE)
  })

  it('lets the event override the storyworld', () => {
    expect(resolveChoicePresentation(INLINE, MODAL)).toBe(INLINE)
    expect(resolveChoicePresentation(MODAL, INLINE)).toBe(MODAL)
  })

  it('lets an event insist on a list against a storyworld that does not', () => {
    // the reason LIST is a real member and not just the absence of a value: an
    // author with a MODAL storyworld needs a way to say "not this event"
    expect(resolveChoicePresentation(LIST, MODAL)).toBe(LIST)
  })

  it('is unaffected by the world when the event has decided', () => {
    const eventSays = MODAL

    expect(resolveChoicePresentation(eventSays, undefined)).toBe(MODAL)
    expect(resolveChoicePresentation(eventSays, LIST)).toBe(MODAL)
    expect(resolveChoicePresentation(eventSays, INLINE)).toBe(MODAL)
  })
})

/**
 * The modal is the one presentation that needs words of its own — it can be
 * dismissed, so something has to say how to bring it back. Both are translatable per
 * storyworld like every other word the storyteller says; `interfaceText.test.ts`
 * holds the grouping and the English defaults for the whole table, and this only
 * pins the two this feature added.
 */
describe('the words the modal needs', () => {
  it('has an English default for opening and closing', () => {
    expect(INTERFACE_TEXT_DEFAULTS[INTERFACE_TEXT_KEY.STREAM_CHOICES_OPEN]).toBe(
      'Choose'
    )
    expect(
      INTERFACE_TEXT_DEFAULTS[INTERFACE_TEXT_KEY.STREAM_CHOICES_CLOSE]
    ).toBe('Close')
  })
})
