import { cloneDeep } from 'lodash'

import {
  COMPARE_OPERATOR_TYPE,
  EngineLiveEventStateCollection,
  SET_OPERATOR_TYPE,
  VARIABLE_TYPE,
  VariableCompare,
  VariableSet
} from '../types'

import { formatNumberFromString } from '.'

/**
 * Pure transformations over a live event's variable state.
 *
 * Extracted so there is **one** implementation of "does this comparison hold" and
 * "apply this assignment", rather than one per caller. As of 0.8.0 there are three
 * callers each: a path condition (`isPathOpen`), an object placement gate, and a
 * recipe's effects. A second copy of the comparison rules is the same hazard
 * `templates.ts` already demonstrates by existing twice — a fix applied to one and
 * not the other makes two parts of the app disagree about the same authored data.
 *
 * Nothing here touches the database or the DOM, which is what makes it testable;
 * `src/__tests__/objectModel.test.ts` covers it.
 */

/**
 * Whether a comparison holds, or `undefined` for "no opinion".
 *
 * The three-valued return is not fussiness — it preserves `isPathOpen`'s existing
 * behaviour exactly. That function pushes nothing into its aggregate for a
 * comparison it cannot evaluate, and callers differ on what to do about it:
 *
 * - **`isPathOpen` drops it**, so an unevaluable condition leaves the path open
 *   (`[].every()` is `true` under ALL). That is pre-existing behaviour, load-bearing
 *   for worlds already authored against it, and deliberately not changed here.
 * - **Placement gates treat it as false**, so an unevaluable gate hides the object.
 *   New code fails closed, because the alternative is revealing content on the
 *   strength of a comparison nobody could evaluate.
 *
 * The rules themselves are the ones the engine has always applied: a NUMBER
 * compares numerically across all six operators, and anything else compares as a
 * lower-cased string and understands only equality. A `>` on a STRING is therefore
 * "no opinion" rather than false.
 */
export const variableCompareHolds = (
  compare: VariableCompare,
  type: VARIABLE_TYPE,
  currentValue: string
): boolean | undefined => {
  const [, operator, expected] = compare

  if (type === VARIABLE_TYPE.NUMBER) {
    const left = Number(currentValue),
      right = Number(expected)

    return compareNumbers(operator, left, right)
  }

  const left = currentValue.toLowerCase(),
    right = expected.toLowerCase()

  switch (operator) {
    case COMPARE_OPERATOR_TYPE.EQ:
      return left === right
    case COMPARE_OPERATOR_TYPE.NE:
      return left !== right
    default:
      return undefined
  }
}

/** All six operators, over numbers. Used for variable values and object counts. */
export const compareNumbers = (
  operator: COMPARE_OPERATOR_TYPE,
  left: number,
  right: number
): boolean | undefined => {
  switch (operator) {
    case COMPARE_OPERATOR_TYPE.EQ:
      return left === right
    case COMPARE_OPERATOR_TYPE.NE:
      return left !== right
    case COMPARE_OPERATOR_TYPE.GT:
      return left > right
    case COMPARE_OPERATOR_TYPE.GTE:
      return left >= right
    case COMPARE_OPERATOR_TYPE.LT:
      return left < right
    case COMPARE_OPERATOR_TYPE.LTE:
      return left <= right
    default:
      return undefined
  }
}

/**
 * Applies variable assignments to a copy of the state.
 *
 * Mirrors what `processEffectsByRoute` has always done, including the `toFixed(2)`
 * on arithmetic and the `formatNumberFromString` pass on a NUMBER result — that
 * pass is why `10 / 3` reads as `3.33` rather than `3.3333333333333335`, and
 * dropping it would change every existing world's arithmetic.
 *
 * An assignment naming a variable absent from the state is skipped rather than
 * creating one, which is what keeps a deleted variable from reappearing as a
 * zombie entry in a save.
 */
export const applyVariableSets = (
  state: EngineLiveEventStateCollection,
  sets: VariableSet[]
): EngineLiveEventStateCollection => {
  if (sets.length === 0) return state

  const newState = cloneDeep(state)

  sets.forEach((set) => {
    const [variableId, operator, operand, type] = set

    if (!newState[variableId]) return

    const current = newState[variableId].value

    switch (operator) {
      case SET_OPERATOR_TYPE.ASSIGN:
        newState[variableId].value = operand
        break
      case SET_OPERATOR_TYPE.ADD:
        newState[variableId].value = `${(
          Number(current) + Number(operand)
        ).toFixed(2)}`
        break
      case SET_OPERATOR_TYPE.SUBTRACT:
        newState[variableId].value = `${(
          Number(current) - Number(operand)
        ).toFixed(2)}`
        break
      case SET_OPERATOR_TYPE.MULTIPLY:
        newState[variableId].value = `${(
          Number(current) * Number(operand)
        ).toFixed(2)}`
        break
      case SET_OPERATOR_TYPE.DIVIDE:
        newState[variableId].value = `${(
          Number(current) / Number(operand)
        ).toFixed(2)}`
        break
      default:
        break
    }

    if (type === VARIABLE_TYPE.NUMBER)
      newState[variableId].value = formatNumberFromString(
        newState[variableId].value
      )
  })

  return newState
}
