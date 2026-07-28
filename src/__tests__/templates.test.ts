import { describe, expect, it } from 'vitest'

import {
  gameMethods,
  getProcessedTemplate,
  getTemplateExpressions,
  parseTemplateExpressions
} from '../lib/templates'

import { VARIABLE_TYPE } from '../data/types'

/**
 * Arithmetic in template expressions.
 *
 * `{ health - 10 }` used to report "not supported, but is planned for a future
 * release" from the BinaryExpression branch of parseTemplateExpressions. These
 * cover the evaluator that replaced it.
 *
 * Two behaviours are load-bearing and easy to regress:
 *
 * - getProcessedTemplate drops any falsy substitution, so a result of 0 has to
 *   reach it as the string "0" or it vanishes from the rendered text.
 * - Anything unusable becomes the 'esg-error' sentinel, which EventSnippet and
 *   the engine's decorate() render as an ERROR span rather than as text.
 */
const variables = {
  health: { value: '100', type: VARIABLE_TYPE.NUMBER },
  bonus: { value: '10', type: VARIABLE_TYPE.NUMBER },
  zero: { value: '0', type: VARIABLE_TYPE.NUMBER },
  name: { value: 'Shalna', type: VARIABLE_TYPE.STRING },
  blank: { value: '', type: VARIABLE_TYPE.NUMBER },
  empty: { value: '', type: VARIABLE_TYPE.STRING },
  alive: { value: 'true', type: VARIABLE_TYPE.BOOLEAN }
}

// Mirrors how EventSnippet and the engine's decorate() drive the pipeline.
const render = (template: string) => {
  const expressions = getTemplateExpressions(template)

  return getProcessedTemplate(
    template,
    expressions,
    parseTemplateExpressions(expressions, variables, gameMethods),
    variables,
    gameMethods
  )
}

describe('arithmetic template expressions', () => {
  it('applies each supported operator', () => {
    expect(render('{ health + bonus }')).toBe('{110}')
    expect(render('{ health - bonus }')).toBe('{90}')
    expect(render('{ health * 2 }')).toBe('{200}')
    expect(render('{ health / bonus }')).toBe('{10}')
    expect(render('{ health % bonus }')).toBe('{0}')
  })

  it('renders a zero result rather than dropping it', () => {
    // The substitution in getProcessedTemplate discards falsy values, so this is
    // the case that regresses if the result stops being stringified.
    expect(render('{ bonus - bonus }')).toBe('{0}')
    expect(render('{ health * zero }')).toBe('{0}')
  })

  it('honours operator precedence and parentheses', () => {
    expect(render('{ health + bonus * 2 }')).toBe('{120}')
    expect(render('{ (health + bonus) * 2 }')).toBe('{220}')
  })

  it('evaluates chained operands', () => {
    expect(render('{ health + bonus + 5 }')).toBe('{115}')
  })

  it('folds unary minus on a literal', () => {
    expect(render('{ health + -10 }')).toBe('{90}')
    expect(render('{ -1 * bonus }')).toBe('{-10}')
  })

  it('concatenates when either side of + is a string', () => {
    expect(render('{ name + bonus }')).toBe('{Shalna10}')
    expect(render('{ "Level " + bonus }')).toBe('{Level 10}')
  })

  it('rejects a string with a non-additive operator', () => {
    expect(render('{ name * 2 }')).toBe('{esg-error}')
  })

  it('rejects division and modulo by zero', () => {
    expect(render('{ health / zero }')).toBe('{esg-error}')
    expect(render('{ health % zero }')).toBe('{esg-error}')
  })

  it('rejects an unknown variable', () => {
    expect(render('{ health + missing }')).toBe('{esg-error}')
  })

  it('rejects a blank number rather than treating it as zero', () => {
    expect(render('{ health + blank }')).toBe('{esg-error}')
  })

  it('accepts an empty string as a real value when concatenating', () => {
    // Changing a variable's type resets a STRING's initial value to '', so an
    // empty string is ordinary data. Only a blank NUMBER is suspect.
    expect(render('{ name + empty }')).toBe('{Shalna}')
    expect(render('{ empty + bonus }')).toBe('{10}')
  })

  it('rejects a boolean operand', () => {
    expect(render('{ health + alive }')).toBe('{esg-error}')
  })

  it('rejects an unsupported operator', () => {
    // Parses as a BinaryExpression, but shifting is not arithmetic an author of
    // prose has any use for.
    expect(render('{ health << bonus }')).toBe('{esg-error}')
  })

  it('reports which side of the expression failed', () => {
    const [parsed] = parseTemplateExpressions(
      getTemplateExpressions('{ health + missing }'),
      variables,
      gameMethods
    )

    expect(parsed.type).toBe('ExpressionError')
    expect('message' in parsed && parsed.message).toContain('missing')
  })

  it('leaves the surrounding prose intact', () => {
    expect(render('You have { health - bonus } left.')).toBe(
      'You have {90} left.'
    )
  })

  it('still resolves the expression types that already worked', () => {
    expect(render('{ name }')).toBe('{Shalna}')
    expect(render('{ name.upper() }')).toBe('{SHALNA}')
    expect(render('{ health > 50 ? "ok" : "hurt" }')).toBe('{ok}')
  })
})
