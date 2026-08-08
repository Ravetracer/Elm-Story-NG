import { describe, expect, it } from 'vitest'

import {
  collectTriggerSounds,
  triggerConditionHolds,
  triggerFires
} from '../../engine/src/lib/state'

import {
  COMPARE_OPERATOR_TYPE,
  PATH_CONDITIONS_TYPE,
  VARIABLE_TYPE
} from '../../engine/src/types'

import type {
  EngineLiveEventStateCollection,
  EngineTriggerData,
  VariableCompare
} from '../../engine/src/types'

/**
 * Covers the pure trigger evaluator in `engine/src/lib/state.ts`
 * (`dev-doc/scene-triggers.md`). A trigger fires on the rising edge of its
 * folded condition, re-arms on the falling edge, and — with `fireOnEntry` — also
 * fires on scene entry when the condition already holds.
 */

const WORLD = 'world-1'

// Build a state collection from `{ id: [type, value] }`.
const state = (entries: {
  [id: string]: [VARIABLE_TYPE, string]
}): EngineLiveEventStateCollection =>
  Object.fromEntries(
    Object.entries(entries).map(([id, [type, value]]) => [
      id,
      { title: id, type, value, worldId: WORLD }
    ])
  )

const trigger = (
  compare: VariableCompare[],
  extra: Partial<EngineTriggerData> = {}
): EngineTriggerData => ({ id: 'trigger-1', compare, sound: 'bell', ...extra })

// `moves >= threshold` (NUMBER).
const movesGte = (threshold: string): VariableCompare => [
  'moves',
  COMPARE_OPERATOR_TYPE.GTE,
  threshold,
  VARIABLE_TYPE.NUMBER
]

describe('triggerFires — rising edge', () => {
  const t = trigger([movesGte('6')])

  it('fires when the condition crosses false -> true', () => {
    const prev = state({ moves: [VARIABLE_TYPE.NUMBER, '5'] })
    const next = state({ moves: [VARIABLE_TYPE.NUMBER, '6'] })

    expect(triggerFires(t, prev, next, false)).toBe(true)
  })

  it('does not re-fire while the condition stays true', () => {
    const prev = state({ moves: [VARIABLE_TYPE.NUMBER, '6'] })
    const next = state({ moves: [VARIABLE_TYPE.NUMBER, '7'] })

    expect(triggerFires(t, prev, next, false)).toBe(false)
  })

  it('stays silent while the condition stays false', () => {
    const prev = state({ moves: [VARIABLE_TYPE.NUMBER, '3'] })
    const next = state({ moves: [VARIABLE_TYPE.NUMBER, '4'] })

    expect(triggerFires(t, prev, next, false)).toBe(false)
  })

  it('re-arms on the falling edge, then fires again on the next rise', () => {
    const high = state({ moves: [VARIABLE_TYPE.NUMBER, '6'] })
    const low = state({ moves: [VARIABLE_TYPE.NUMBER, '2'] })

    // true -> false: the fall itself does not fire, but it re-arms the trigger.
    expect(triggerFires(t, high, low, false)).toBe(false)
    // false -> true again (a second phone call): fires. This is the resettable
    // behaviour, with no stored "played" flag.
    expect(triggerFires(t, low, high, false)).toBe(true)
  })
})

describe('triggerFires — the falsy-value trap', () => {
  it('fires when a NUMBER reaches 0 (0 is a value, not "unset")', () => {
    const t = trigger([
      ['count', COMPARE_OPERATOR_TYPE.EQ, '0', VARIABLE_TYPE.NUMBER]
    ])
    const prev = state({ count: [VARIABLE_TYPE.NUMBER, '1'] })
    const next = state({ count: [VARIABLE_TYPE.NUMBER, '0'] })

    expect(triggerFires(t, prev, next, false)).toBe(true)
  })
})

describe('triggerConditionHolds — unevaluable and empty fail closed', () => {
  it('is false when no condition can be evaluated (ordering op on a STRING)', () => {
    const t = trigger([
      ['name', COMPARE_OPERATOR_TYPE.GT, 'x', VARIABLE_TYPE.STRING]
    ])
    const s = state({ name: [VARIABLE_TYPE.STRING, 'alice'] })

    // undefined "no opinion" is dropped, leaving an empty aggregate -> false
    // (the opposite of isPathOpen's fail-open).
    expect(triggerConditionHolds(t, s)).toBe(false)
  })

  it('is false for a trigger with no conditions', () => {
    expect(triggerConditionHolds(trigger([]), state({}))).toBe(false)
  })

  it('never fires an unevaluable trigger, even on entry', () => {
    const t = trigger([], { fireOnEntry: true })

    expect(triggerFires(t, state({}), state({}), true)).toBe(false)
  })

  it('drops an unresolvable variable rather than failing the fold', () => {
    // 'ghost' is not in state; under ALL the fold is over the one real condition.
    const t = trigger([
      ['ghost', COMPARE_OPERATOR_TYPE.EQ, '1', VARIABLE_TYPE.NUMBER],
      movesGte('5')
    ])
    const prev = state({ moves: [VARIABLE_TYPE.NUMBER, '4'] })
    const next = state({ moves: [VARIABLE_TYPE.NUMBER, '5'] })

    expect(triggerFires(t, prev, next, false)).toBe(true)
  })
})

describe('triggerFires — AND fold (conditionsType ALL, the default)', () => {
  const t = trigger([
    movesGte('5'),
    ['alarm', COMPARE_OPERATOR_TYPE.EQ, 'true', VARIABLE_TYPE.BOOLEAN]
  ])

  it('fires only when both conditions hold', () => {
    const prev = state({
      moves: [VARIABLE_TYPE.NUMBER, '5'],
      alarm: [VARIABLE_TYPE.BOOLEAN, 'false']
    })
    const next = state({
      moves: [VARIABLE_TYPE.NUMBER, '5'],
      alarm: [VARIABLE_TYPE.BOOLEAN, 'true']
    })

    expect(triggerFires(t, prev, next, false)).toBe(true)
  })

  it('does not fire when only one condition holds', () => {
    const prev = state({
      moves: [VARIABLE_TYPE.NUMBER, '4'],
      alarm: [VARIABLE_TYPE.BOOLEAN, 'false']
    })
    const next = state({
      moves: [VARIABLE_TYPE.NUMBER, '5'],
      alarm: [VARIABLE_TYPE.BOOLEAN, 'false']
    })

    expect(triggerFires(t, prev, next, false)).toBe(false)
  })

  it('edges on the folded value, not on either condition alone', () => {
    // Both already hold last event; one climbing further is still true -> true.
    const prev = state({
      moves: [VARIABLE_TYPE.NUMBER, '5'],
      alarm: [VARIABLE_TYPE.BOOLEAN, 'true']
    })
    const next = state({
      moves: [VARIABLE_TYPE.NUMBER, '9'],
      alarm: [VARIABLE_TYPE.BOOLEAN, 'true']
    })

    expect(triggerFires(t, prev, next, false)).toBe(false)
  })
})

describe('triggerFires — OR fold (conditionsType ANY)', () => {
  it('fires when either condition crosses into true', () => {
    const t = trigger(
      [
        movesGte('5'),
        ['alarm', COMPARE_OPERATOR_TYPE.EQ, 'true', VARIABLE_TYPE.BOOLEAN]
      ],
      { conditionsType: PATH_CONDITIONS_TYPE.ANY }
    )
    const prev = state({
      moves: [VARIABLE_TYPE.NUMBER, '2'],
      alarm: [VARIABLE_TYPE.BOOLEAN, 'false']
    })
    const next = state({
      moves: [VARIABLE_TYPE.NUMBER, '2'],
      alarm: [VARIABLE_TYPE.BOOLEAN, 'true']
    })

    expect(triggerFires(t, prev, next, false)).toBe(true)
  })
})

describe('triggerFires — fireOnEntry', () => {
  const already = state({ moves: [VARIABLE_TYPE.NUMBER, '6'] })

  it('does not fire on entry when the condition already held (default off)', () => {
    const t = trigger([movesGte('6')])

    expect(triggerFires(t, already, already, true)).toBe(false)
  })

  it('fires on entry when opted in and the condition already holds', () => {
    const t = trigger([movesGte('6')], { fireOnEntry: true })

    expect(triggerFires(t, already, already, true)).toBe(true)
  })

  it('does not fire on a non-entry transition without a rising edge', () => {
    const t = trigger([movesGte('6')], { fireOnEntry: true })

    expect(triggerFires(t, already, already, false)).toBe(false)
  })

  it('does not fire on entry when the condition does not hold now', () => {
    const t = trigger([movesGte('6')], { fireOnEntry: true })
    const low = state({ moves: [VARIABLE_TYPE.NUMBER, '2'] })

    expect(triggerFires(t, low, low, true)).toBe(false)
  })

  it('fires exactly once when entry and rising edge coincide', () => {
    const t = trigger([movesGte('6')], { fireOnEntry: true })
    const low = state({ moves: [VARIABLE_TYPE.NUMBER, '2'] })

    // A single boolean, so the OR of "rising edge" and "entry" cannot double-fire.
    expect(triggerFires(t, low, already, true)).toBe(true)
  })
})

describe('collectTriggerSounds', () => {
  const ringing = trigger([movesGte('6')], { id: 'ring', sound: 'bell' })
  const alarm = trigger(
    [['alarm', COMPARE_OPERATOR_TYPE.EQ, 'true', VARIABLE_TYPE.BOOLEAN]],
    { id: 'alarm', sound: 'siren' }
  )

  it('returns the sounds of every firing trigger, in scene order', () => {
    const prev = state({
      moves: [VARIABLE_TYPE.NUMBER, '5'],
      alarm: [VARIABLE_TYPE.BOOLEAN, 'false']
    })
    const next = state({
      moves: [VARIABLE_TYPE.NUMBER, '6'],
      alarm: [VARIABLE_TYPE.BOOLEAN, 'true']
    })

    // Both cross into true on the same transition — both play, no cap.
    expect(collectTriggerSounds([ringing, alarm], prev, next, false)).toEqual([
      'bell',
      'siren'
    ])
  })

  it('omits triggers that do not fire', () => {
    const prev = state({
      moves: [VARIABLE_TYPE.NUMBER, '5'],
      alarm: [VARIABLE_TYPE.BOOLEAN, 'false']
    })
    const next = state({
      moves: [VARIABLE_TYPE.NUMBER, '6'],
      alarm: [VARIABLE_TYPE.BOOLEAN, 'false']
    })

    expect(collectTriggerSounds([ringing, alarm], prev, next, false)).toEqual([
      'bell'
    ])
  })

  it('is empty when nothing fires', () => {
    const held = state({
      moves: [VARIABLE_TYPE.NUMBER, '6'],
      alarm: [VARIABLE_TYPE.BOOLEAN, 'true']
    })

    // true -> true for both: no rising edge, nothing plays.
    expect(collectTriggerSounds([ringing, alarm], held, held, false)).toEqual(
      []
    )
  })
})
