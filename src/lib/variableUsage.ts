import * as acorn from 'acorn'

import {
  Condition,
  Effect,
  ElementId,
  Event,
  Input,
  Path,
  Variable,
  VARIABLE_TYPE
} from '../data/types'

import { getTemplateExpressions } from './templates'

/**
 * Where a storyworld uses a variable.
 *
 * Three of these are references by id and survive a rename. The fourth does not:
 * a template expression in event content names a variable by its **title**
 * (`EventSnippet` and the engine both build their variable map keyed on
 * `variable.title`), so renaming a variable silently breaks every expression that
 * used the old name — it renders as the `esg-error` sentinel rather than failing
 * loudly. That is the usage worth surfacing before an author renames or deletes.
 */
export enum VARIABLE_USAGE_TYPE {
  CONDITION = 'CONDITION',
  EFFECT = 'EFFECT',
  INPUT = 'INPUT',
  CONTENT = 'CONTENT'
}

export interface VariableUsage {
  type: VARIABLE_USAGE_TYPE
  // the element the author would go looking for: the path for a condition or
  // effect, the event for an input or a content expression
  elementId: ElementId
  elementTitle: string
  // the expression itself, for a content usage
  detail?: string
}

export interface VariableUsageSources {
  conditions?: Condition[]
  effects?: Effect[]
  inputs?: Input[]
  events?: Event[]
  // only to name the path a condition or effect belongs to
  paths?: Path[]
}

const UNTITLED = 'Untitled'

/**
 * Every identifier an expression names, ignoring string literals and method
 * names.
 *
 * A regex over the expression text would be wrong in both directions:
 * `{ health > 50 ? "ok" : "hurt" }` would credit variables titled `ok` or `hurt`,
 * and `{ name.upper() }` would credit one titled `upper`. acorn is already a
 * dependency for exactly this grammar, so the identifiers are read off the AST —
 * skipping the property side of a member expression, which is the method name.
 *
 * Anything unparseable yields nothing: it renders as an ERROR span in the editor
 * and the storyteller, so it references no variable in any usable sense.
 */
export const getExpressionVariableNames = (expression: string): string[] => {
  const names: string[] = []

  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit)

      return
    }

    if (!node || typeof node !== 'object') return

    const candidate = node as Record<string, unknown>

    if (candidate.type === 'Identifier' && typeof candidate.name === 'string') {
      if (!names.includes(candidate.name)) names.push(candidate.name)

      return
    }

    if (candidate.type === 'MemberExpression') {
      // the object is a variable, the property is a game method
      visit(candidate.object)

      return
    }

    Object.entries(candidate).forEach(([key, value]) => {
      // acorn nodes carry positions and a source range alongside the tree
      if (key === 'type' || key === 'start' || key === 'end' || key === 'range')
        return

      visit(value)
    })
  }

  try {
    visit(acorn.parse(expression, { ecmaVersion: 2020 }))
  } catch (error) {
    return []
  }

  return names
}

/**
 * The plain text of an event's stored Slate document, one string per leaf.
 *
 * Per leaf rather than concatenated, because that is the unit the engine
 * processes: `eventContentToPreview` renders element by element and `decorate`
 * runs over each block's text. An expression an author has split across two
 * leaves by styling half of it is already broken there, and joining the leaves
 * here would report a usage the storyteller cannot honour.
 *
 * Walks for a `text` property rather than going through slate's helpers so this
 * stays a pure function over parsed JSON.
 */
export const getEventContentText = (content: string): string[] => {
  const texts: string[] = []

  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit)

      return
    }

    if (!node || typeof node !== 'object') return

    const candidate = node as { text?: unknown; children?: unknown }

    if (typeof candidate.text === 'string' && candidate.text.length > 0)
      texts.push(candidate.text)

    if (candidate.children) visit(candidate.children)
  }

  try {
    visit(JSON.parse(content))
  } catch (error) {
    // an event with unparseable content has no readable text, which is the same
    // answer as an empty document
    return []
  }

  return texts
}

/**
 * Every use of every variable, keyed by variable id. Variables with no uses are
 * present with an empty array, so a caller never has to distinguish "unused" from
 * "not looked up".
 */
export const collectVariableUsage = (
  variables: Variable[],
  { conditions, effects, inputs, events, paths }: VariableUsageSources
): Map<ElementId, VariableUsage[]> => {
  const usage = new Map<ElementId, VariableUsage[]>()

  variables.forEach((variable) => variable.id && usage.set(variable.id, []))

  const add = (variableId: ElementId | undefined, entry: VariableUsage) => {
    if (!variableId) return

    // a reference to a variable that no longer exists is not this function's
    // problem; removeVariable already cascades, so it would mean stale data
    usage.get(variableId)?.push(entry)
  }

  const pathTitles = new Map<ElementId, string>(),
    eventTitles = new Map<ElementId, string>()

  paths?.forEach((path) => path.id && pathTitles.set(path.id, path.title))
  events?.forEach((event) => event.id && eventTitles.set(event.id, event.title))

  conditions?.forEach((condition) =>
    add(condition.variableId, {
      type: VARIABLE_USAGE_TYPE.CONDITION,
      elementId: condition.pathId,
      elementTitle: pathTitles.get(condition.pathId) || UNTITLED
    })
  )

  effects?.forEach((effect) =>
    add(effect.variableId, {
      type: VARIABLE_USAGE_TYPE.EFFECT,
      elementId: effect.pathId,
      elementTitle: pathTitles.get(effect.pathId) || UNTITLED
    })
  )

  inputs?.forEach((input) =>
    add(input.variableId, {
      type: VARIABLE_USAGE_TYPE.INPUT,
      elementId: input.eventId,
      elementTitle: eventTitles.get(input.eventId) || UNTITLED
    })
  )

  // content expressions name variables by title, so this is the one lookup that
  // goes the other way
  const idsByTitle = new Map<string, ElementId[]>()

  variables.forEach((variable) => {
    if (!variable.id) return

    const existing = idsByTitle.get(variable.title)

    existing
      ? existing.push(variable.id)
      : idsByTitle.set(variable.title, [variable.id])
  })

  events?.forEach((event) => {
    if (!event.id) return

    getEventContentText(event.content).forEach((text) =>
      getTemplateExpressions(text).forEach((expression) =>
        getExpressionVariableNames(expression).forEach((name) =>
          // a title shared by two variables credits both: the engine's variable
          // map is keyed on title, so the expression is genuinely ambiguous
          idsByTitle.get(name)?.forEach((variableId) =>
            add(variableId, {
              type: VARIABLE_USAGE_TYPE.CONTENT,
              elementId: event.id as ElementId,
              elementTitle: event.title,
              detail: `{${expression}}`
            })
          )
        )
      )
    )
  })

  return usage
}

export interface VariableUsageSummary {
  conditions: number
  effects: number
  inputs: number
  contentExpressions: number
  contentEvents: number
  total: number
}

export const summarizeVariableUsage = (
  usage: VariableUsage[]
): VariableUsageSummary => {
  const contentEvents = new Set(
    usage
      .filter(({ type }) => type === VARIABLE_USAGE_TYPE.CONTENT)
      .map(({ elementId }) => elementId)
  )

  const count = (type: VARIABLE_USAGE_TYPE) =>
    usage.filter((entry) => entry.type === type).length

  return {
    conditions: count(VARIABLE_USAGE_TYPE.CONDITION),
    effects: count(VARIABLE_USAGE_TYPE.EFFECT),
    inputs: count(VARIABLE_USAGE_TYPE.INPUT),
    contentExpressions: count(VARIABLE_USAGE_TYPE.CONTENT),
    contentEvents: contentEvents.size,
    total: usage.length
  }
}

const plural = (count: number, singular: string) =>
  `${count} ${count === 1 ? singular : `${singular}s`}`

const joinList = (parts: string[]): string =>
  parts.length <= 1
    ? parts[0] || ''
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`

/**
 * What deleting a variable will actually do, as a sentence.
 *
 * `LibraryDatabase.removeVariable` removes every condition and effect that names
 * the variable — which changes whether the paths carrying them are taken — and
 * clears the variable from any input. It cannot repair content expressions, so
 * those are described as breaking rather than as being removed.
 */
export const describeVariableRemoval = (
  usage: VariableUsage[]
): string | undefined => {
  const { conditions, effects, inputs, contentExpressions, contentEvents } =
    summarizeVariableUsage(usage)

  const removed: string[] = []

  if (conditions) removed.push(plural(conditions, 'path condition'))
  if (effects) removed.push(plural(effects, 'path effect'))

  const clauses: string[] = []

  // the removed items are comma-separated rather than joined with 'and', so that
  // the only 'and' in the sentence is the one between clauses
  if (removed.length) clauses.push(`remove ${removed.join(', ')}`)
  if (inputs) clauses.push(`clear ${plural(inputs, 'input')}`)
  if (contentExpressions)
    clauses.push(
      `break ${plural(contentExpressions, 'template expression')} in ${plural(
        contentEvents,
        'event'
      )}`
    )

  return clauses.length ? joinList(clauses) : undefined
}

export interface VariableFilter {
  search: string
  type?: VARIABLE_TYPE
  // only variables nothing references
  unusedOnly?: boolean
}

export const filterVariables = (
  variables: Variable[],
  usage: Map<ElementId, VariableUsage[]>,
  { search, type, unusedOnly }: VariableFilter
): Variable[] => {
  const query = search.trim().toLowerCase()

  return variables.filter((variable) => {
    if (type && variable.type !== type) return false

    if (unusedOnly && (usage.get(variable.id || '')?.length ?? 0) > 0)
      return false

    if (!query) return true

    // the initial value is searchable too: finding which variable starts as a
    // given string is otherwise a scroll-and-squint exercise
    return (
      variable.title.toLowerCase().includes(query) ||
      (variable.initialValue || '').toLowerCase().includes(query)
    )
  })
}

/**
 * Titles used by more than one variable. Template expressions resolve by title,
 * so a duplicate makes every expression naming it ambiguous — the engine's
 * variable map keeps whichever it saw last.
 */
export const getDuplicateVariableTitles = (
  variables: Variable[]
): Set<string> => {
  const seen = new Set<string>(),
    duplicates = new Set<string>()

  variables.forEach(({ title }) =>
    seen.has(title) ? duplicates.add(title) : seen.add(title)
  )

  return duplicates
}
