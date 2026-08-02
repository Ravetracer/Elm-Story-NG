import { describe, expect, it } from 'vitest'

import {
  interfaceText,
  pruneInterfaceText,
  INTERFACE_TEXT_DEFAULTS,
  INTERFACE_TEXT_GROUPS,
  INTERFACE_TEXT_KEY
} from '../../engine/src/lib/interfaceText'

/**
 * The storyworld's words for the engine's own, imported from `engine/src`
 * directly like the object model is.
 *
 * The two suites here earn their keep differently. The resolution rules are
 * ordinary logic. The table integrity checks are the ones that matter: a key with
 * no default renders a blank button and a key in no group is invisible in the
 * manager, so an author cannot translate it — and neither failure is visible
 * anywhere a typecheck or a glance at the app would catch it, because both look
 * exactly like a word nobody chose to translate.
 */

describe('resolving a word', () => {
  it('uses the English when nothing is translated', () => {
    expect(interfaceText(undefined, INTERFACE_TEXT_KEY.OBJECT_TAKE)).toBe('Take')
    expect(interfaceText({}, INTERFACE_TEXT_KEY.OBJECT_TAKE)).toBe('Take')
  })

  it('uses the translation when there is one', () => {
    expect(
      interfaceText(
        { [INTERFACE_TEXT_KEY.OBJECT_TAKE]: 'nehmen' },
        INTERFACE_TEXT_KEY.OBJECT_TAKE
      )
    ).toBe('nehmen')
  })

  it('falls back for a blank translation rather than rendering nothing', () => {
    expect(
      interfaceText(
        { [INTERFACE_TEXT_KEY.OBJECT_TAKE]: '   ' },
        INTERFACE_TEXT_KEY.OBJECT_TAKE
      )
    ).toBe('Take')
  })

  it('leaves the other keys English when one is translated', () => {
    const overrides = { [INTERFACE_TEXT_KEY.OBJECT_TAKE]: 'nehmen' }

    expect(interfaceText(overrides, INTERFACE_TEXT_KEY.OBJECT_USE)).toBe('Use')
  })
})

describe('pruning what gets stored', () => {
  it('keeps a real translation', () => {
    expect(
      pruneInterfaceText({ [INTERFACE_TEXT_KEY.OBJECT_TAKE]: 'nehmen' })
    ).toEqual({ [INTERFACE_TEXT_KEY.OBJECT_TAKE]: 'nehmen' })
  })

  it('drops a blank one, so clearing a field means "use the English"', () => {
    expect(
      pruneInterfaceText({
        [INTERFACE_TEXT_KEY.OBJECT_TAKE]: '',
        [INTERFACE_TEXT_KEY.OBJECT_USE]: '  '
      })
    ).toBeUndefined()
  })

  it('drops one that only repeats the English', () => {
    expect(
      pruneInterfaceText({ [INTERFACE_TEXT_KEY.OBJECT_TAKE]: 'Take' })
    ).toBeUndefined()
  })

  it('trims, so a stray space is not exported as a translation', () => {
    expect(
      pruneInterfaceText({ [INTERFACE_TEXT_KEY.OBJECT_TAKE]: ' nehmen ' })
    ).toEqual({ [INTERFACE_TEXT_KEY.OBJECT_TAKE]: 'nehmen' })
  })

  it('resolves to nothing at all for an untouched world', () => {
    expect(pruneInterfaceText(undefined)).toBeUndefined()
    expect(pruneInterfaceText({})).toBeUndefined()
  })
})

describe('the table itself', () => {
  const keys = Object.values(INTERFACE_TEXT_KEY)

  it('gives every key an English default', () => {
    keys.forEach((key) =>
      expect(INTERFACE_TEXT_DEFAULTS[key], key).toBeTruthy()
    )
  })

  it('puts every key in exactly one group, so all of them are editable', () => {
    const grouped = INTERFACE_TEXT_GROUPS.flatMap((group) => group.keys)

    expect([...grouped].sort()).toEqual([...keys].sort())
    expect(new Set(grouped).size).toBe(grouped.length)
  })

  it('uses each key as its own value, since the value is what is exported', () => {
    Object.entries(INTERFACE_TEXT_KEY).forEach(([name, value]) =>
      expect(value).toBe(name)
    )
  })
})
