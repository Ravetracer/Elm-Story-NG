import { describe, expect, it } from 'vitest'

import {
  collectVariableUsage,
  describeVariableRemoval,
  filterVariables,
  getDuplicateVariableTitles,
  getEventContentText,
  getExpressionVariableNames,
  summarizeVariableUsage,
  VARIABLE_USAGE_TYPE
} from '../lib/variableUsage'

import {
  Condition,
  COMPARE_OPERATOR_TYPE,
  Effect,
  ELEMENT_TYPE,
  Event,
  EVENT_TYPE,
  Input,
  Path,
  PATH_CONDITIONS_TYPE,
  SET_OPERATOR_TYPE,
  Variable,
  VARIABLE_TYPE
} from '../data/types'

/**
 * Usage lookup for the variable manager.
 *
 * Conditions, effects and inputs reference a variable by id. Content template
 * expressions reference it by **title**, which is why they are the interesting
 * case: they break on rename and cannot be repaired on delete.
 */
const variable = (
  id: string,
  title: string,
  type = VARIABLE_TYPE.NUMBER,
  initialValue = '0'
): Variable => ({ id, title, worldId: 'world', type, initialValue, tags: [] })

const condition = (
  id: string,
  variableId: string,
  pathId: string
): Condition => ({
  id,
  title: id,
  worldId: 'world',
  pathId,
  variableId,
  compare: [variableId, COMPARE_OPERATOR_TYPE.EQ, '0', VARIABLE_TYPE.NUMBER],
  tags: []
})

const effect = (id: string, variableId: string, pathId: string): Effect => ({
  id,
  title: id,
  worldId: 'world',
  pathId,
  variableId,
  set: [variableId, SET_OPERATOR_TYPE.ASSIGN, '0', VARIABLE_TYPE.NUMBER],
  tags: []
})

const input = (id: string, variableId: string, eventId: string): Input => ({
  id,
  title: id,
  worldId: 'world',
  eventId,
  variableId,
  tags: []
})

const path = (id: string, title: string): Path => ({
  id,
  title,
  worldId: 'world',
  sceneId: 'scene',
  originId: 'event-a',
  originType: ELEMENT_TYPE.EVENT,
  destinationId: 'event-b',
  destinationType: ELEMENT_TYPE.EVENT,
  conditionsType: PATH_CONDITIONS_TYPE.ALL,
  tags: []
})

// the shape Event.content is stored in: a JSON string of Slate descendants
const content = (...texts: string[]) =>
  JSON.stringify(
    texts.map((text) => ({ type: 'paragraph', children: [{ text }] }))
  )

const event = (
  id: string,
  title: string,
  eventContent = content('')
): Event => ({
  id,
  title,
  worldId: 'world',
  sceneId: 'scene',
  characters: [],
  choices: [],
  content: eventContent,
  ending: false,
  images: [],
  type: EVENT_TYPE.CHOICE,
  tags: []
})

describe('getExpressionVariableNames', () => {
  it('reads an identifier', () => {
    expect(getExpressionVariableNames('health')).toEqual(['health'])
  })

  it('reads the variable but not the method of a call', () => {
    expect(getExpressionVariableNames('name.upper()')).toEqual(['name'])
  })

  it('reads both sides of arithmetic and ignores literals', () => {
    expect(getExpressionVariableNames('health + bonus * 2')).toEqual([
      'health',
      'bonus'
    ])
  })

  it('reads nested arithmetic', () => {
    expect(getExpressionVariableNames('(a + b) * c')).toEqual(['a', 'b', 'c'])
  })

  it('ignores string literals in a conditional', () => {
    // a regex would credit variables titled 'ok' or 'hurt'
    expect(getExpressionVariableNames('health > 50 ? "ok" : "hurt"')).toEqual([
      'health'
    ])
  })

  it('reads identifiers used as conditional branches', () => {
    expect(getExpressionVariableNames('alive ? name : epitaph')).toEqual([
      'alive',
      'name',
      'epitaph'
    ])
  })

  it('reads a negated test', () => {
    expect(getExpressionVariableNames('!alive ? "dead" : "alive"')).toEqual([
      'alive'
    ])
  })

  it('does not repeat a variable named twice', () => {
    expect(getExpressionVariableNames('health + health')).toEqual(['health'])
  })

  it('yields nothing for an unparseable expression', () => {
    // renders as an ERROR span, so it references nothing usable
    expect(getExpressionVariableNames('health =/= 10')).toEqual([])
    expect(getExpressionVariableNames('')).toEqual([])
  })
})

describe('getEventContentText', () => {
  it('reads the text of every leaf', () => {
    expect(getEventContentText(content('first', 'second'))).toEqual([
      'first',
      'second'
    ])
  })

  it('reads nested children', () => {
    const nested = JSON.stringify([
      {
        type: 'bulleted-list',
        children: [{ type: 'list-item', children: [{ text: 'deep' }] }]
      }
    ])

    expect(getEventContentText(nested)).toEqual(['deep'])
  })

  it('skips empty leaves and void elements', () => {
    const withImage = JSON.stringify([
      { type: 'img', asset_id: 'asset', children: [{ text: '' }] },
      { type: 'paragraph', children: [{ text: 'caption' }] }
    ])

    expect(getEventContentText(withImage)).toEqual(['caption'])
  })

  it('returns nothing for unparseable content', () => {
    expect(getEventContentText('not json')).toEqual([])
  })
})

describe('collectVariableUsage', () => {
  const health = variable('variable-health', 'health')

  it('seeds every variable, so unused is distinguishable from unknown', () => {
    const usage = collectVariableUsage([health], {})

    expect(usage.get('variable-health')).toEqual([])
  })

  it('finds a condition and names the path it belongs to', () => {
    const usage = collectVariableUsage([health], {
      conditions: [condition('condition-1', 'variable-health', 'path-1')],
      paths: [path('path-1', 'To the cellar')]
    })

    expect(usage.get('variable-health')).toEqual([
      {
        type: VARIABLE_USAGE_TYPE.CONDITION,
        elementId: 'path-1',
        elementTitle: 'To the cellar'
      }
    ])
  })

  it('finds an effect and an input', () => {
    const usage = collectVariableUsage([health], {
      effects: [effect('effect-1', 'variable-health', 'path-1')],
      inputs: [input('input-1', 'variable-health', 'event-1')],
      paths: [path('path-1', 'To the cellar')],
      events: [event('event-1', 'Ankunft')]
    })

    expect(
      usage
        .get('variable-health')
        ?.map(({ type, elementTitle }) => [type, elementTitle])
    ).toEqual([
      [VARIABLE_USAGE_TYPE.EFFECT, 'To the cellar'],
      [VARIABLE_USAGE_TYPE.INPUT, 'Ankunft']
    ])
  })

  it('finds a content expression by title, with the expression as detail', () => {
    const usage = collectVariableUsage([health], {
      events: [
        event('event-1', 'Ankunft', content('You have { health } hit points.'))
      ]
    })

    expect(usage.get('variable-health')).toEqual([
      {
        type: VARIABLE_USAGE_TYPE.CONTENT,
        elementId: 'event-1',
        elementTitle: 'Ankunft',
        detail: '{ health }'
      }
    ])
  })

  it('does not credit a variable a content expression only resembles', () => {
    // the string literal is not an identifier, and 'health' is not 'healthy'
    const usage = collectVariableUsage(
      [health, variable('variable-ok', 'ok', VARIABLE_TYPE.STRING, '')],
      {
        events: [
          event(
            'event-1',
            'Ankunft',
            content('{ healthy > 50 ? "ok" : "hurt" }')
          )
        ]
      }
    )

    expect(usage.get('variable-health')).toEqual([])
    expect(usage.get('variable-ok')).toEqual([])
  })

  it('credits both variables when two share a title', () => {
    const usage = collectVariableUsage(
      [health, variable('variable-health-2', 'health')],
      { events: [event('event-1', 'Ankunft', content('{ health }'))] }
    )

    expect(usage.get('variable-health')).toHaveLength(1)
    expect(usage.get('variable-health-2')).toHaveLength(1)
  })

  it('counts a variable named in two expressions in one event twice', () => {
    const usage = collectVariableUsage([health], {
      events: [
        event('event-1', 'Ankunft', content('{ health }', '{ health + 1 }'))
      ]
    })

    expect(usage.get('variable-health')).toHaveLength(2)
  })

  it('ignores a stale reference to a variable that no longer exists', () => {
    const usage = collectVariableUsage([health], {
      conditions: [condition('condition-1', 'variable-gone', 'path-1')]
    })

    expect(usage.get('variable-health')).toEqual([])
    expect(usage.has('variable-gone')).toBe(false)
  })
})

describe('summarizeVariableUsage', () => {
  it('counts content events distinctly from content expressions', () => {
    const usage = collectVariableUsage([variable('v', 'health')], {
      events: [
        event('event-1', 'One', content('{ health }', '{ health + 1 }')),
        event('event-2', 'Two', content('{ health }'))
      ]
    })

    expect(summarizeVariableUsage(usage.get('v') || [])).toMatchObject({
      contentExpressions: 3,
      contentEvents: 2,
      total: 3
    })
  })
})

describe('describeVariableRemoval', () => {
  const usageFor = (sources: Parameters<typeof collectVariableUsage>[1]) =>
    collectVariableUsage([variable('v', 'health')], sources).get('v') || []

  it('says nothing when the variable is unused', () => {
    expect(describeVariableRemoval([])).toBeUndefined()
  })

  it('describes what removeVariable will delete', () => {
    expect(
      describeVariableRemoval(
        usageFor({
          conditions: [condition('c1', 'v', 'path-1')],
          effects: [effect('e1', 'v', 'path-1'), effect('e2', 'v', 'path-2')]
        })
      )
    ).toBe('remove 1 path condition, 2 path effects')
  })

  it('describes an input as cleared rather than removed', () => {
    // removeVariable unsets the input's variable ref; the input element survives
    expect(
      describeVariableRemoval(
        usageFor({ inputs: [input('i1', 'v', 'event-1')] })
      )
    ).toBe('clear 1 input')
  })

  it('describes content expressions as breaking', () => {
    expect(
      describeVariableRemoval(
        usageFor({
          events: [event('event-1', 'Ankunft', content('{ health }'))]
        })
      )
    ).toBe('break 1 template expression in 1 event')
  })

  it('combines both halves', () => {
    expect(
      describeVariableRemoval(
        usageFor({
          conditions: [condition('c1', 'v', 'path-1')],
          events: [event('event-1', 'Ankunft', content('{ health }'))]
        })
      )
    ).toBe('remove 1 path condition and break 1 template expression in 1 event')
  })

  it('reads as a list when all three apply', () => {
    expect(
      describeVariableRemoval(
        usageFor({
          conditions: [condition('c1', 'v', 'path-1')],
          effects: [effect('e1', 'v', 'path-1')],
          inputs: [input('i1', 'v', 'event-1')],
          events: [event('event-1', 'Ankunft', content('{ health }'))]
        })
      )
    ).toBe(
      'remove 1 path condition, 1 path effect, clear 1 input and break 1 template expression in 1 event'
    )
  })

  it('reads with a single and when a removal is combined with a break', () => {
    // the real case that exposed the double 'and': two conditions, one effect and
    // one expression
    expect(
      describeVariableRemoval(
        usageFor({
          conditions: [
            condition('c1', 'v', 'path-1'),
            condition('c2', 'v', 'path-2')
          ],
          effects: [effect('e1', 'v', 'path-1')],
          events: [event('event-1', 'Vorlesungssaal', content('{ health }'))]
        })
      )
    ).toBe(
      'remove 2 path conditions, 1 path effect and break 1 template expression in 1 event'
    )
  })
})

describe('filterVariables', () => {
  const variables = [
    variable('v1', 'health'),
    variable('v2', 'playerName', VARIABLE_TYPE.STRING, 'Shalna'),
    variable('v3', 'alive', VARIABLE_TYPE.BOOLEAN, 'true')
  ]

  const usage = collectVariableUsage(variables, {
    conditions: [condition('c1', 'v1', 'path-1')]
  })

  const titles = (filtered: Variable[]) => filtered.map(({ title }) => title)

  it('matches on title, case insensitively', () => {
    expect(
      titles(filterVariables(variables, usage, { search: 'HEAL' }))
    ).toEqual(['health'])
  })

  it('matches on initial value', () => {
    expect(
      titles(filterVariables(variables, usage, { search: 'shalna' }))
    ).toEqual(['playerName'])
  })

  it('filters by type', () => {
    expect(
      titles(
        filterVariables(variables, usage, {
          search: '',
          type: VARIABLE_TYPE.BOOLEAN
        })
      )
    ).toEqual(['alive'])
  })

  it('filters to the unused', () => {
    expect(
      titles(
        filterVariables(variables, usage, { search: '', unusedOnly: true })
      )
    ).toEqual(['playerName', 'alive'])
  })

  it('combines search with a filter', () => {
    expect(
      titles(
        filterVariables(variables, usage, {
          search: 'a',
          unusedOnly: true
        })
      )
    ).toEqual(['playerName', 'alive'])
  })
})

describe('getDuplicateVariableTitles', () => {
  it('reports a title used twice', () => {
    expect(
      getDuplicateVariableTitles([
        variable('v1', 'health'),
        variable('v2', 'health'),
        variable('v3', 'alive')
      ])
    ).toEqual(new Set(['health']))
  })

  it('reports nothing when every title is distinct', () => {
    expect(
      getDuplicateVariableTitles([variable('v1', 'a'), variable('v2', 'b')])
        .size
    ).toBe(0)
  })
})
