import { cloneDeep } from 'lodash'

import {
  COMPARE_OPERATOR_TYPE,
  EngineLiveEventStateCollection,
  EngineVariableData,
  SET_OPERATOR_TYPE,
  VARIABLE_SCOPE,
  VARIABLE_TYPE,
  VariableCompare,
  VariableSet
} from '../types'

import { formatNumberFromString } from '.'
import {
  gameMethods,
  getProcessedTemplate,
  getTemplateExpressions,
  parseTemplateExpressions
} from './templates'

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

/**
 * Resets the variables scoped to a scene back to their initial values.
 *
 * `VARIABLE_SCOPE.SCENE` means exactly one thing, per `DESIGN.md` §11: the variable
 * returns to its initial value when the player **enters** `scopeId`. It is per-scene
 * scratch state — a counter for how many things have been tried in this room, a flag
 * for something noticed here — and the whole value of it is that an author does not
 * have to remember to reset it on every way in.
 *
 * Entering a scene is a `JUMP` and nothing else: a `Path` joins two events inside
 * one scene, so a jump is the only thing that crosses a boundary. That is why this
 * is called from one place rather than defensively from several.
 *
 * **Absent scope means WORLD**, so a variable written before this existed is
 * untouched, and a world that never scopes anything gets the same object back.
 *
 * Scope changes lifetime, not namespace. Titles stay globally unique whatever the
 * scope, because template expressions resolve a variable **by title** — two
 * scene-scoped variables sharing one would be ambiguous, with whichever the map saw
 * last winning.
 */
export const resetSceneScopedVariables = (
  state: EngineLiveEventStateCollection,
  variables: EngineVariableData[],
  sceneId?: string
): EngineLiveEventStateCollection => {
  if (!sceneId) return state

  const scoped = variables.filter(
    (variable) =>
      variable.scope === VARIABLE_SCOPE.SCENE &&
      variable.scopeId === sceneId &&
      // a variable the save has never seen is not reset into existence; the state
      // is reconciled against the world elsewhere and this must not fight it
      state[variable.id] !== undefined
  )

  if (scoped.length === 0) return state

  const next = cloneDeep(state)

  scoped.forEach((variable) => {
    next[variable.id] = { ...next[variable.id], value: variable.initialValue }
  })

  return next
}

/**
 * A template resolved against a live event's variable state.
 *
 * Returns the processed string and the expressions that were found in it, because
 * `EventContent` needs the second to decorate each substitution and a path
 * notification needs only the first.
 *
 * **The map is keyed on the variable's title, not its id**, which is what the
 * expression language resolves by and therefore not a detail to tidy: renaming a
 * variable breaks every expression naming the old title, and two variables sharing
 * a title are ambiguous with whichever the map saw last winning.
 *
 * It lives here rather than in `templates.ts` because it is about *this engine's*
 * live event state, and `templates.ts` exists twice — once here and once in the
 * editor — so anything added to it has to be added to both or the two disagree.
 * It was `EventContent`'s own local function until a second caller needed it.
 */
export const processTemplateBlock = (
  template: string,
  state: EngineLiveEventStateCollection
): [string, string[]] => {
  const expressions = getTemplateExpressions(template),
    variables: {
      [variableTitle: string]: { value: string; type: VARIABLE_TYPE }
    } = {}

  Object.values(state).forEach((variable) => {
    variables[variable.title] = {
      value: variable.value,
      type: variable.type
    }
  })

  const parsedExpressions = parseTemplateExpressions(
    expressions,
    variables,
    gameMethods
  )

  return [
    getProcessedTemplate(
      template,
      expressions,
      parsedExpressions,
      variables,
      gameMethods
    ),
    expressions
  ]
}

/**
 * A template resolved to plain text, for the one consumer that has no DOM to put
 * spans into: a path notification, which is stored as the string it resolved to.
 *
 * `getProcessedTemplate` re-wraps every substitution in braces — `{ health }` over
 * a value of 40 comes back as `{40}` — so that `decorate` can find them with a
 * regular expression and wrap each in its own span. This does what `decorate` does
 * and stops before the markup, which is why it renders an unresolvable expression
 * as the same **ERROR** the prose shows rather than leaking the internal
 * `esg-error` token. The alternative — special-casing plain text — would let one
 * expression mean two different things depending on where it was written.
 */
export const processTemplateToText = (
  template: string,
  state: EngineLiveEventStateCollection
): string => {
  const [processed] = processTemplateBlock(template, state)

  return processed.replace(/{([^}]+)}/g, (_, value: string) =>
    value === 'esg-error' ? 'ERROR' : value
  )
}
