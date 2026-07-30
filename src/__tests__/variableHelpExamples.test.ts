import { describe, expect, it } from 'vitest'

import {
  gameMethods,
  getProcessedTemplate,
  getTemplateExpressions,
  parseTemplateExpressions
} from '../lib/templates'

import { VARIABLE_TYPE } from '../data/types'

/**
 * Every expression the variable manager's help sheet shows an author, run through
 * the real pipeline.
 *
 * The help sheet exists because docs.elmstory.com is gone and the archived copy
 * is wrong — it documents a `=/=` operator that has never parsed and omits the
 * methods and arithmetic that work. Replacing one inaccurate reference with
 * another would be no better, so each documented example is asserted here to
 * render rather than to become the 'esg-error' sentinel.
 *
 * If one of these fails, either the parser changed or the help sheet is lying.
 * Fix whichever is wrong — do not delete the case.
 */
const variables = {
  playerName: { value: 'Shalna', type: VARIABLE_TYPE.STRING },
  health: { value: '100', type: VARIABLE_TYPE.NUMBER },
  threshold: { value: '50', type: VARIABLE_TYPE.NUMBER },
  base: { value: '10', type: VARIABLE_TYPE.NUMBER },
  bonus: { value: '5', type: VARIABLE_TYPE.NUMBER },
  level: { value: '3', type: VARIABLE_TYPE.NUMBER },
  alive: { value: 'true', type: VARIABLE_TYPE.BOOLEAN },
  name: { value: 'Shalna', type: VARIABLE_TYPE.STRING },
  epitaph: { value: 'Here lies Shalna', type: VARIABLE_TYPE.STRING }
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

describe('the help sheet examples', () => {
  it('1. prints a value', () => {
    expect(render('{ playerName }')).toBe('{Shalna}')
  })

  it('2. calls upper() and lower()', () => {
    expect(render('{ playerName.upper() }')).toBe('{SHALNA}')
    expect(render('{ playerName.lower() }')).toBe('{shalna}')
  })

  it('3. compares a number against a literal', () => {
    expect(render('{ health > 50 ? "Steady." : "Hurt." }')).toBe('{Steady.}')
  })

  it('3. tests a Boolean on its own', () => {
    expect(render('{ alive ? "Breathing." : "Not any more." }')).toBe(
      '{Breathing.}'
    )
  })

  it('3. negates a Boolean', () => {
    expect(render('{ !alive ? "Not any more." : "Breathing." }')).toBe(
      '{Breathing.}'
    )
  })

  it('3. takes variables on both sides and in both outcomes', () => {
    expect(render('{ health > threshold ? name : epitaph }')).toBe('{Shalna}')
  })

  it('4. subtracts', () => {
    expect(render('{ health - 10 }')).toBe('{90}')
  })

  it('4. respects parentheses', () => {
    expect(render('{ (base + bonus) * 2 }')).toBe('{30}')
  })

  it('4. joins when a + has text on one side', () => {
    expect(render('{ "Level " + level }')).toBe('{Level 3}')
  })

  it('claims correctly that a non-Boolean tests for having a value', () => {
    expect(render('{ playerName ? "Named." : "Nameless." }')).toBe('{Named.}')
  })

  it('claims correctly that negation on a non-Boolean always takes the second branch', () => {
    expect(render('{ !playerName ? "Nameless." : "Named." }')).toBe('{Named.}')
  })
})

describe('what the help sheet warns against', () => {
  it('=/= is not an operator, whatever the archived docs said', () => {
    expect(render('{ health =/= 10 }')).toBe('{esg-error}')
  })

  it('!= is the one that works', () => {
    expect(render('{ health != 10 ? "Not ten." : "Ten." }')).toBe('{Not ten.}')
  })

  it('a method that does not exist is an error', () => {
    expect(render('{ playerName.reverse() }')).toBe('{esg-error}')
  })

  it('division by zero is refused rather than printed', () => {
    expect(render('{ health / 0 }')).toBe('{esg-error}')
  })
})
