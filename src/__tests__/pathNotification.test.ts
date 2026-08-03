import { describe, expect, it } from 'vitest'

import {
  partitionLiveEventMessages,
  processTemplateToText
} from '../../engine/src/lib/state'

import {
  EngineLiveEventMessageData,
  EngineLiveEventStateCollection,
  ENGINE_LIVE_EVENT_MESSAGE_TYPE,
  VARIABLE_TYPE
} from '../../engine/src/types'

const { TRANSITION, NARRATION, INSPECTION } = ENGINE_LIVE_EVENT_MESSAGE_TYPE

/**
 * A path notification is one authored string resolved against the state the
 * crossing arrived with, and stored as the text it resolved to. What it can and
 * cannot say is therefore entirely `processTemplateToText`, which shares its
 * substitution with the prose and differs only in having no DOM to put spans into.
 *
 * The cases worth holding are the ones where a mistake would be silent: a
 * legitimate `0` disappearing, an unresolvable expression leaking the internal
 * `esg-error` token into the story, and the variable map being keyed on the title
 * rather than on the id.
 */

const state = (
  entries: [id: string, title: string, type: VARIABLE_TYPE, value: string][]
): EngineLiveEventStateCollection =>
  entries.reduce(
    (collection, [id, title, type, value]) => ({
      ...collection,
      [id]: { title, type, value, worldId: 'world-1' }
    }),
    {}
  )

const resolve = (template: string, s: EngineLiveEventStateCollection) =>
  processTemplateToText(template, s)

describe('a path notification resolves against the state it was crossed with', () => {
  it('says a plain line back unchanged', () => {
    expect(resolve('You hear a door slam behind you.', {})).toBe(
      'You hear a door slam behind you.'
    )
  })

  it('substitutes a variable by its title, not its id', () => {
    const s = state([['var-1', 'name', VARIABLE_TYPE.STRING, 'Wittgenstein']])

    expect(resolve('{ name } turns away.', s)).toBe('Wittgenstein turns away.')

    // the id is not a name the expression language knows
    expect(resolve('{ var-1 } turns away.', s)).toBe('ERROR turns away.')
  })

  it('keeps a zero, which is the substitution most easily lost', () => {
    const s = state([['var-1', 'health', VARIABLE_TYPE.NUMBER, '0']])

    // `getProcessedTemplate` drops a falsy substitution, so an arithmetic result
    // of 0 has to arrive already stringified or the number vanishes from the line
    // rather than reading as "0"
    expect(resolve('Health: { health - 0 }', s)).toBe('Health: 0')
    expect(resolve('Health: { health }', s)).toBe('Health: 0')
  })

  it('resolves arithmetic and conditionals, as the prose does', () => {
    const s = state([
      ['var-1', 'health', VARIABLE_TYPE.NUMBER, '30'],
      ['var-2', 'bonus', VARIABLE_TYPE.NUMBER, '5']
    ])

    expect(resolve('{ health + bonus * 2 } left.', s)).toBe('40 left.')
    expect(resolve('You feel { health > 50 ? "ok" : "hurt" }.', s)).toBe(
      'You feel hurt.'
    )
  })

  it('resolves a method call', () => {
    const s = state([['var-1', 'name', VARIABLE_TYPE.STRING, 'wittgenstein']])

    expect(resolve('{ name.upper() }', s)).toBe('WITTGENSTEIN')
  })

  it('renders a renamed or unknown variable as ERROR rather than as nothing', () => {
    // the breakage a rename causes is silent everywhere else: no build fails and
    // no cascade can repair it, because an expression names a variable by title.
    // ERROR is the same word the prose shows for the same expression — the
    // internal `esg-error` token must not reach the reader either way
    expect(resolve('{ health } left.', {})).toBe('ERROR left.')
    expect(resolve('{ health } left.', {})).not.toContain('esg-error')
  })

  it('resolves an empty STRING to the word undefined, as the prose already does', () => {
    const s = state([['var-1', 'note', VARIABLE_TYPE.STRING, '']])

    // Not the behaviour anyone would choose, and **not introduced here**:
    // `getProcessedTemplate`'s identifier branch is `value || 'undefined'`, so an
    // empty STRING has read as the literal word in event prose since 0.7.0. It is
    // asserted rather than fixed because the fix belongs in `templates.ts` — which
    // exists twice, once per project — and changing it silently changes every
    // storyworld's prose, not just its notifications.
    expect(resolve('{ note }', s)).toBe('undefined')
  })

  it('says nothing at all for an empty template', () => {
    // `getPathNotification` drops a blank result rather than writing an empty
    // paragraph into the reading column
    expect(resolve('   ', {}).trim()).toBe('')
  })
})

/**
 * Where the line is *read*, which is the half of this feature that was decided
 * twice. A notification is stored on the destination live event, so rendered below
 * that event's prose it reported the transition from the far end of it — and an
 * author who wanted a line after "Follow me!" had to hang it on the path arriving
 * at that event rather than the one leaving it, one step earlier than the
 * transition it describes.
 *
 * `partitionLiveEventMessages` is that decision, and it is a function so it can be
 * held to it: the same array also carries object beats, which are read below the
 * prose as they always were.
 */
describe('a transition is read before the prose and an object beat after it', () => {
  const message = (
    text: string,
    type: ENGINE_LIVE_EVENT_MESSAGE_TYPE
  ): EngineLiveEventMessageData => ({ text, type })

  it('reads a path notification above the prose it arrives at', () => {
    const { beforeProse, afterProse } = partitionLiveEventMessages([
      message('The door closes behind you.', TRANSITION)
    ])

    expect(beforeProse.map(({ message }) => message.text)).toEqual([
      'The door closes behind you.'
    ])
    expect(afterProse).toEqual([])
  })

  it('leaves object beats below the prose, where they already were', () => {
    const { beforeProse, afterProse } = partitionLiveEventMessages([
      message('Taken.', NARRATION),
      message('A brass key, worn smooth.', INSPECTION)
    ])

    expect(beforeProse).toEqual([])
    expect(afterProse.map(({ message }) => message.text)).toEqual([
      'Taken.',
      'A brass key, worn smooth.'
    ])
  })

  it('splits a mixed event without reordering either side', () => {
    const { beforeProse, afterProse } = partitionLiveEventMessages([
      message('The door closes behind you.', TRANSITION),
      message('Taken.', NARRATION),
      message('A brass key, worn smooth.', INSPECTION)
    ])

    expect(beforeProse.map(({ message }) => message.text)).toEqual([
      'The door closes behind you.'
    ])
    expect(afterProse.map(({ message }) => message.text)).toEqual([
      'Taken.',
      'A brass key, worn smooth.'
    ])
  })

  it('keeps each message its index in the original array', () => {
    // the two groups are rendered as separate lists, so a key built from a
    // group-local index would collide across them
    const { beforeProse, afterProse } = partitionLiveEventMessages([
      message('Taken.', NARRATION),
      message('The door closes behind you.', TRANSITION),
      message('A brass key, worn smooth.', INSPECTION)
    ])

    expect(beforeProse.map(({ index }) => index)).toEqual([1])
    expect(afterProse.map(({ index }) => index)).toEqual([0, 2])
  })

  it('treats an absent message list as an event with nothing to say', () => {
    // `messages` is optional and absent on every live event saved before it
    // existed
    expect(partitionLiveEventMessages()).toEqual({
      beforeProse: [],
      afterProse: []
    })
  })

  it('reads a notification stored before TRANSITION existed below the prose', () => {
    // an in-progress playthrough holds its past notifications as NARRATION; they
    // keep the placement they were read with rather than being migrated, since
    // this is runtime state and not authored data
    const { beforeProse, afterProse } = partitionLiveEventMessages([
      message('The door closes behind you.', NARRATION)
    ])

    expect(beforeProse).toEqual([])
    expect(afterProse).toHaveLength(1)
  })
})
