import { describe, expect, it } from 'vitest'

import {
  gameMethods,
  getProcessedTemplate,
  getTemplateExpressions,
  parseTemplateExpressions
} from '../lib/templates'

import {
  ExpressionSuggestion,
  classifyExpressionContext,
  getExpressionInnerToCaret,
  getExpressionSuggestions,
  inferContinuationOperand
} from '../lib/contentEditor/expressionHelper'

import { VARIABLE_TYPE } from '../data/types'

/**
 * The expression helper recommends how to continue a `{ }` expression from the
 * type of the operand the caret sits after. It is guidance, not validation — but
 * a helper that suggests forms the parser rejects would create errors rather than
 * prevent them, so the load-bearing test is the last block: every snippet the
 * catalogue offers, composed into a complete expression, is run through the real
 * `lib/templates.ts` pipeline and must not render the `esg-error` sentinel.
 *
 * If one fails, either the evaluator changed or the catalogue drifted. Fix
 * whichever is wrong.
 */

const variables = {
  num: { value: '100', type: VARIABLE_TYPE.NUMBER },
  str: { value: 'Shalna', type: VARIABLE_TYPE.STRING },
  flag: { value: 'true', type: VARIABLE_TYPE.BOOLEAN }
}

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

const keys = (suggestions: ExpressionSuggestion[]) => suggestions.map((s) => s.key)

describe('reading the expression up to the caret', () => {
  it('returns null in ordinary prose', () => {
    expect(getExpressionInnerToCaret('You open the door')).toBeNull()
  })

  it('returns the text inside an open expression', () => {
    expect(getExpressionInnerToCaret('You have { gol')).toBe(' gol')
  })

  it('reads the innermost unclosed expression, not a closed one before it', () => {
    expect(getExpressionInnerToCaret('{ a } and { b')).toBe(' b')
  })
})

describe('classifying where the caret sits', () => {
  it('an empty expression expects an operand', () => {
    expect(classifyExpressionContext(' ')).toBe('operand')
  })

  it('just after a variable is a continuation', () => {
    expect(classifyExpressionContext(' health')).toBe('continuation')
  })

  it.each(['+', '-', '*', '>', '==', '(', '?', ':', ','])(
    'after "%s" it expects an operand',
    (op) => {
      expect(classifyExpressionContext(` health ${op} `)).toBe('operand')
    }
  )

  it('after a method call it is a continuation', () => {
    expect(classifyExpressionContext(' name.upper()')).toBe('continuation')
  })
})

describe('inferring the operand the caret sits after', () => {
  const resolve = (title: string) =>
    ({ num: VARIABLE_TYPE.NUMBER, str: VARIABLE_TYPE.STRING }[title] ?? null)

  it('reads a known variable as its declared type', () => {
    expect(inferContinuationOperand(' num', resolve)).toEqual({
      type: VARIABLE_TYPE.NUMBER,
      isVariable: true
    })
  })

  it('reads a number literal as a number, but not a variable', () => {
    expect(inferContinuationOperand(' num > 50', resolve)).toEqual({
      type: VARIABLE_TYPE.NUMBER,
      isVariable: false
    })
  })

  it('reads a string literal as a string', () => {
    expect(inferContinuationOperand(' "hi"', resolve)).toEqual({
      type: VARIABLE_TYPE.STRING,
      isVariable: false
    })
  })

  it('treats an unknown title as an unknown type', () => {
    expect(inferContinuationOperand(' mystery', resolve)).toEqual({
      type: null,
      isVariable: false
    })
  })
})

describe('the suggestion catalogue per type', () => {
  it('offers a Boolean only the condition', () => {
    expect(keys(getExpressionSuggestions(VARIABLE_TYPE.BOOLEAN, true))).toEqual([
      'condition'
    ])
  })

  it('offers a number arithmetic, comparisons, equality and a condition', () => {
    const k = keys(getExpressionSuggestions(VARIABLE_TYPE.NUMBER, true))

    expect(k).toContain('arithmetic-+')
    expect(k).toContain('compare->')
    expect(k).toContain('equality-==')
    expect(k).toContain('condition')
    expect(k).not.toContain('method-upper')
  })

  it('offers a string its methods, join, equality and a condition — but no ordered compare', () => {
    const k = keys(getExpressionSuggestions(VARIABLE_TYPE.STRING, true))

    expect(k).toContain('method-upper')
    expect(k).toContain('method-lower')
    expect(k).toContain('arithmetic-+')
    expect(k).toContain('equality-!=')
    expect(k).toContain('condition')
    expect(k).not.toContain('compare->')
    expect(k).not.toContain('arithmetic-*')
  })

  it('does not offer methods on a literal, only on a variable', () => {
    expect(keys(getExpressionSuggestions(VARIABLE_TYPE.STRING, false))).not.toContain(
      'method-upper'
    )
  })
})

// Compose a complete expression from a suggestion so it can be run through the
// evaluator. `left` is a variable of the suggestion's type.
const complete = (suggestion: ExpressionSuggestion, left: string): string => {
  if (suggestion.key === 'condition') {
    const filled = suggestion.insert
      .replace('""', '"yes"')
      .replace('""', '"no"')

    return `{ ${left}${filled} }`
  }

  if (suggestion.key.startsWith('method-'))
    return `{ ${left}${suggestion.insert} }`

  if (suggestion.key.startsWith('arithmetic-'))
    return `{ ${left}${suggestion.insert}1 }`

  // comparisons and equality are only meaningful inside a conditional
  return `{ ${left}${suggestion.insert}1 ? "yes" : "no" }`
}

describe('every offered snippet actually resolves', () => {
  const cases: { type: VARIABLE_TYPE; left: string }[] = [
    { type: VARIABLE_TYPE.NUMBER, left: 'num' },
    { type: VARIABLE_TYPE.STRING, left: 'str' },
    { type: VARIABLE_TYPE.BOOLEAN, left: 'flag' }
  ]

  cases.forEach(({ type, left }) => {
    getExpressionSuggestions(type, true).forEach((suggestion) => {
      it(`${type} → ${suggestion.key} renders without esg-error`, () => {
        expect(render(complete(suggestion, left))).not.toContain('esg-error')
      })
    })
  })
})
