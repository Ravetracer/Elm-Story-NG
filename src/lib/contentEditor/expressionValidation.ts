import {
  gameMethods,
  getProcessedTemplate,
  getTemplateExpressions,
  parseTemplateExpressions
} from '../templates'
import { VARIABLE_TYPE } from '../../data/types'

/**
 * Live validation for `{ }` expressions in the content editor. A template
 * expression resolves a variable by its **title**, so a typo or a renamed
 * variable renders as an ERROR span at play time and nowhere a build would notice
 * — the silent-error trap the whole picker/helper exists to reduce. This is the
 * other half of that: while writing, an expression that will not resolve is
 * flagged in place, so the author sees it before it ships.
 *
 * The check is the same one `EventSnippet` and the engine's `decorate` use — run
 * the expression through the real pipeline and see whether it comes back as the
 * `esg-error` sentinel — evaluated per expression so the flags line up exactly
 * with `getTemplateExpressionRanges` (both read the same `/{([^}]+)}/g`).
 */

export interface TemplateVariable {
  value: string
  type: VARIABLE_TYPE
}

/**
 * A title-keyed variable map for the evaluator, built from the world's variables.
 * The initial value stands in for the runtime value — validation asks whether an
 * expression *resolves*, not what it currently prints.
 */
export const buildTemplateVariables = (
  variables: { title: string; initialValue: string; type: VARIABLE_TYPE }[]
): { [title: string]: TemplateVariable } => {
  const map: { [title: string]: TemplateVariable } = {}

  variables.forEach((variable) => {
    map[variable.title] = { value: variable.initialValue, type: variable.type }
  })

  return map
}

/**
 * For each `{ … }` in `text`, in document order, an author-facing reason it will
 * not resolve, or `null` when it is fine — aligned one-to-one with
 * `getTemplateExpressionRanges(text)`.
 *
 * A parse-level failure (an unknown variable or method, the common typo/rename
 * case) already carries a specific message; an evaluation-level failure (a
 * comparison with no conditional, a bad type, divide-by-zero) is only known to be
 * broken, so it gets a generic line. Evaluated one expression at a time: a
 * whole-string pass drops any expression that resolves to a falsy value from its
 * output (`getProcessedTemplate` splits it out), which would shift the alignment
 * with the ranges.
 */
export const getExpressionErrors = (
  text: string,
  variables: { [title: string]: TemplateVariable }
): (string | null)[] => {
  const expressions = getTemplateExpressions(text)

  if (expressions.length === 0) return []

  const parsed = parseTemplateExpressions(expressions, variables, gameMethods)

  return expressions.map((expression, index) => {
    const node = parsed[index]

    // Only an ExpressionError node carries a `message`; use it when present.
    const parseMessage =
      node && 'message' in node ? (node.message as string) : null

    if (parseMessage) return parseMessage

    const errored = getProcessedTemplate(
      `{${expression}}`,
      [expression],
      [node],
      variables,
      gameMethods
    ).includes('esg-error')

    return errored ? 'This expression will not resolve.' : null
  })
}

/**
 * The boolean form of {@link getExpressionErrors}: whether each expression fails.
 */
export const getExpressionErrorFlags = (
  text: string,
  variables: { [title: string]: TemplateVariable }
): boolean[] =>
  getExpressionErrors(text, variables).map((message) => message !== null)
