import { SUPPORTED_BINARY_OPERATORS, gameMethods } from '../templates'
import { VARIABLE_TYPE } from '../../data/types'

/**
 * The type-aware expression helper — the "recommend how to continue" half of the
 * `{ }` picker. Given the text inside an expression up to the caret, it decides
 * whether the author is about to place an **operand** (so the variable picker
 * belongs) or is sitting just after one and choosing how to **continue** (so a
 * menu of operators, methods and a condition skeleton belongs), and builds that
 * menu from the variable's declared type.
 *
 * It is guidance, not validation — nothing here stops an author writing
 * cross-type nonsense that renders as an ERROR span. But every snippet it *offers*
 * is a form the evaluator in `lib/templates.ts` actually accepts, and
 * `src/__tests__/expressionHelper.test.ts` runs each one through the real pipeline
 * so the catalogue cannot drift into recommending something the parser rejects.
 *
 * Sources of truth are imported rather than copied: methods from `gameMethods`,
 * arithmetic from `SUPPORTED_BINARY_OPERATORS`. Only the comparison and equality
 * operators are named here, because they are meaningful to the evaluator *only*
 * inside a conditional and so have no standalone list to import.
 */

// The evaluator's conditional switch handles these; `>`/`<` require NUMBER
// operands. (`==`/`!=` also cover boolean and string equality.)
export const NUMBER_COMPARE_OPERATORS = ['>', '>=', '<', '<=']
export const EQUALITY_OPERATORS = ['==', '!=']

const OPERATOR_HINTS: { [op: string]: string } = {
  '+': 'add / join',
  '-': 'subtract',
  '*': 'multiply',
  '/': 'divide',
  '%': 'remainder',
  '>': 'greater than',
  '>=': 'at least',
  '<': 'less than',
  '<=': 'at most',
  '==': 'equals',
  '!=': 'not equal'
}

export type ExpressionContext = 'operand' | 'continuation'

export interface ExpressionSuggestion {
  key: string
  label: string
  hint?: string
  // Text inserted at the caret.
  insert: string
  // Where the caret should land after the insert, counted back from the end of
  // `insert` (0 = at the very end). Used to drop the caret inside the first `""`
  // of a condition skeleton.
  caretFromEnd: number
}

const STRING_LIKE = [
  VARIABLE_TYPE.STRING,
  VARIABLE_TYPE.URL,
  VARIABLE_TYPE.IMAGE
]

// The condition skeleton — the standout item. ` ? "" : ""` with the caret dropped
// inside the first pair of quotes.
const CONDITION: ExpressionSuggestion = {
  key: 'condition',
  label: 'Condition (if / else)',
  hint: '? … : …',
  insert: ' ? "" : ""',
  caretFromEnd: 6
}

/**
 * The text inside the innermost unclosed `{ … }`, up to the caret — or `null`
 * when the caret is not inside an expression. The closing brace is auto-paired
 * *ahead* of the caret, so it is never part of `textToCaret`.
 */
export const getExpressionInnerToCaret = (
  textToCaret: string
): string | null => {
  const match = textToCaret.match(/{([^{}]*)$/)

  return match ? match[1] : null
}

/**
 * Whether the caret is expecting an operand (a variable or literal) or sitting
 * just after one. An empty expression, or one ending in an operator / opening
 * paren / comma / a ternary `?` or `:`, expects an operand; anything ending in a
 * complete operand (identifier, number, string, `)`) is a continuation.
 */
export const classifyExpressionContext = (inner: string): ExpressionContext => {
  const trimmed = inner.replace(/\s+$/, '')

  if (trimmed === '' || /[-+*/%<>=!(,?:]$/.test(trimmed)) return 'operand'

  return 'continuation'
}

/**
 * The operand the caret sits just after, or `null`. Used both to infer the type
 * the continuation menu tailors itself to and to know whether that operand is a
 * bare variable (methods apply only to a variable, `name.upper()`, not to a
 * literal or a `)`).
 */
export const getTrailingOperand = (inner: string): string | null => {
  const trimmed = inner.replace(/\s+$/, '')
  const match = trimmed.match(/("[^"]*"|'[^']*'|[A-Za-z_]\w*|[\d.]+|\))$/)

  return match ? match[0] : null
}

/**
 * The type to tailor continuation suggestions to, plus whether the trailing
 * operand is a bare variable identifier. A string/number literal infers its own
 * type; an identifier is looked up via `resolveVariableType` (which returns
 * `null` for an unknown title); anything else (`)`, or an unrecognised token) is
 * an unknown type, for which the menu offers the full set.
 */
export const inferContinuationOperand = (
  inner: string,
  resolveVariableType: (title: string) => VARIABLE_TYPE | null
): { type: VARIABLE_TYPE | null; isVariable: boolean } => {
  const operand = getTrailingOperand(inner)

  if (!operand) return { type: null, isVariable: false }

  if (/^["']/.test(operand)) return { type: VARIABLE_TYPE.STRING, isVariable: false }

  if (/^[\d.]+$/.test(operand))
    return { type: VARIABLE_TYPE.NUMBER, isVariable: false }

  if (/^[A-Za-z_]\w*$/.test(operand)) {
    const type = resolveVariableType(operand)

    return { type, isVariable: type !== null }
  }

  return { type: null, isVariable: false }
}

/**
 * The continuation menu for an operand of the given type. `isVariable` gates the
 * methods, which only apply to a bare variable identifier.
 */
export const getExpressionSuggestions = (
  type: VARIABLE_TYPE | null,
  isVariable: boolean
): ExpressionSuggestion[] => {
  const suggestions: ExpressionSuggestion[] = []

  const isNumber = type === VARIABLE_TYPE.NUMBER,
    isBoolean = type === VARIABLE_TYPE.BOOLEAN,
    isStringLike = type !== null && STRING_LIKE.includes(type),
    isUnknown = type === null

  const operator = (op: string, keyPrefix: string): ExpressionSuggestion => ({
    key: `${keyPrefix}-${op}`,
    label: op,
    hint: OPERATOR_HINTS[op],
    insert: ` ${op} `,
    caretFromEnd: 0
  })

  // A Boolean's primary move is the condition; put it first.
  if (isBoolean) suggestions.push(CONDITION)

  // Methods apply to a bare string-like variable only, and are read straight from
  // `gameMethods` so a new method appears here with no change.
  if ((isStringLike || isUnknown) && isVariable) {
    Object.keys(gameMethods).forEach((method) =>
      suggestions.push({
        key: `method-${method}`,
        label: `.${method}()`,
        hint: method === 'upper' ? 'UPPERCASE' : 'lowercase',
        insert: `.${method}()`,
        caretFromEnd: 0
      })
    )
  }

  // Arithmetic: numbers get all of it; strings get only `+` (concatenation).
  if (isNumber || isUnknown) {
    SUPPORTED_BINARY_OPERATORS.forEach((op) =>
      suggestions.push(operator(op, 'arithmetic'))
    )
  } else if (isStringLike) {
    suggestions.push(operator('+', 'arithmetic'))
  }

  // Ordered comparisons are for numbers.
  if (isNumber || isUnknown) {
    NUMBER_COMPARE_OPERATORS.forEach((op) =>
      suggestions.push(operator(op, 'compare'))
    )
  }

  // Equality is for everything except a lone Boolean, which reads better as a
  // bare condition than as `flag == true`.
  if (!isBoolean) {
    EQUALITY_OPERATORS.forEach((op) => suggestions.push(operator(op, 'equality')))
  }

  // For a non-Boolean, the condition closes the menu — it is what wraps a
  // comparison the author just built into something that renders.
  if (!isBoolean) suggestions.push(CONDITION)

  return suggestions
}
