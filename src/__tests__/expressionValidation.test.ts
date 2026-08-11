import { describe, expect, it } from 'vitest'

import {
  buildTemplateVariables,
  getExpressionErrorFlags
} from '../lib/contentEditor/expressionValidation'

import { VARIABLE_TYPE } from '../data/types'

/**
 * Live validation of `{ }` expressions in the content editor. The point is to
 * surface the silent-error case — an expression that references an unknown
 * variable (a typo or a rename) or is otherwise malformed renders as an ERROR
 * span at play time and nowhere a build would notice. These assert that the
 * flags line up with the expressions in document order and match what the real
 * evaluator would do.
 */

const variables = buildTemplateVariables([
  { title: 'health', initialValue: '100', type: VARIABLE_TYPE.NUMBER },
  { title: 'name', initialValue: 'Shalna', type: VARIABLE_TYPE.STRING },
  { title: 'alive', initialValue: 'true', type: VARIABLE_TYPE.BOOLEAN }
])

describe('flagging expressions that will not resolve', () => {
  it('finds nothing to flag in prose with no expressions', () => {
    expect(getExpressionErrorFlags('Just some words.', variables)).toEqual([])
  })

  it('passes a resolvable identifier, method, condition and arithmetic', () => {
    expect(getExpressionErrorFlags('{ health }', variables)).toEqual([false])
    expect(getExpressionErrorFlags('{ name.upper() }', variables)).toEqual([
      false
    ])
    expect(
      getExpressionErrorFlags('{ health > 50 ? "hi" : "lo" }', variables)
    ).toEqual([false])
    expect(getExpressionErrorFlags('{ health + 5 }', variables)).toEqual([false])
    expect(getExpressionErrorFlags('{ alive ? "y" : "n" }', variables)).toEqual([
      false
    ])
  })

  it('flags an unknown variable — the typo / rename case', () => {
    expect(getExpressionErrorFlags('{ helth }', variables)).toEqual([true])
  })

  it('flags a comparison with no conditional to consume it', () => {
    expect(getExpressionErrorFlags('{ health > 50 }', variables)).toEqual([true])
  })

  it('flags an unknown method and division by zero', () => {
    expect(getExpressionErrorFlags('{ name.reverse() }', variables)).toEqual([
      true
    ])
    expect(getExpressionErrorFlags('{ health / 0 }', variables)).toEqual([true])
  })

  it('reports each expression independently and in document order', () => {
    expect(
      getExpressionErrorFlags(
        'Good { health }, bad { helth }, good { name }.',
        variables
      )
    ).toEqual([false, true, false])
  })

  it('does not let a falsy-resolving expression shift the alignment', () => {
    // An empty-STRING identifier resolves to a falsy value, which the whole-string
    // pass would drop from its output; evaluated per expression it still occupies
    // its slot, so the trailing typo is still flagged.
    const withEmpty = buildTemplateVariables([
      { title: 'empty', initialValue: '', type: VARIABLE_TYPE.STRING },
      { title: 'name', initialValue: 'Shalna', type: VARIABLE_TYPE.STRING }
    ])

    expect(
      getExpressionErrorFlags('{ empty } and { nope }', withEmpty)
    ).toEqual([false, true])
  })
})
