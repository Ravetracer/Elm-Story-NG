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
 * For each `{ … }` in `text`, in document order, whether it fails to resolve —
 * aligned one-to-one with `getTemplateExpressionRanges(text)`.
 */
export const getExpressionErrorFlags = (
  text: string,
  variables: { [title: string]: TemplateVariable }
): boolean[] => {
  const expressions = getTemplateExpressions(text)

  if (expressions.length === 0) return []

  const parsed = parseTemplateExpressions(expressions, variables, gameMethods)

  // Evaluated one expression at a time: a whole-string pass drops any expression
  // that resolves to a falsy value from its output (`getProcessedTemplate` splits
  // it out), which would shift the alignment with the ranges.
  return expressions.map((expression, index) =>
    getProcessedTemplate(
      `{${expression}}`,
      [expression],
      [parsed[index]],
      variables,
      gameMethods
    ).includes('esg-error')
  )
}
