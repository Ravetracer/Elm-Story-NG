import { describe, expect, it } from 'vitest'

import {
  Choice,
  Condition,
  Effect,
  ELEMENT_TYPE,
  Event,
  EVENT_TYPE,
  Input,
  Jump,
  Path,
  PATH_CONDITIONS_TYPE,
  SET_OPERATOR_TYPE,
  COMPARE_OPERATOR_TYPE,
  VARIABLE_TYPE
} from '../data/types'
import {
  collectSceneMapSelection,
  describeSceneMapClipboard,
  isSceneMapClipboardEmpty,
  remapSceneMapClipboard,
  sceneMapSelectionOrigin,
  SceneMapClipboardElements
} from '../lib/sceneMapClipboard'

const WORLD = 'world-1',
  SCENE = 'scene-1',
  TARGET_SCENE = 'scene-2',
  VARIABLE = 'variable-1',
  CHARACTER = 'character-1',
  IMAGE = 'image-asset-1',
  AUDIO = 'audio-asset-1'

const event = (id: string, extra: Partial<Event> = {}): Event => ({
  id,
  // deliberately not the id: the invariant test scans the serialised paste for
  // copied ids, and a title echoing one would look like a missed reference
  title: `titled ${id}`,
  tags: [],
  worldId: WORLD,
  sceneId: SCENE,
  type: EVENT_TYPE.CHOICE,
  characters: [CHARACTER],
  choices: [],
  content: '[]',
  ending: false,
  images: [IMAGE],
  composer: { sceneMapPosX: 100, sceneMapPosY: 200 },
  ...extra
})

const jump = (id: string, extra: Partial<Jump> = {}): Jump => ({
  id,
  title: `titled ${id}`,
  tags: [],
  worldId: WORLD,
  sceneId: SCENE,
  path: [SCENE],
  composer: { sceneMapPosX: 300, sceneMapPosY: 400 },
  ...extra
})

const path = (
  id: string,
  originId: string,
  destinationId: string,
  extra: Partial<Path> = {}
): Path => ({
  id,
  title: `titled ${id}`,
  tags: [],
  worldId: WORLD,
  sceneId: SCENE,
  originId,
  originType: EVENT_TYPE.CHOICE,
  destinationId,
  destinationType: ELEMENT_TYPE.EVENT,
  conditionsType: PATH_CONDITIONS_TYPE.ALL,
  ...extra
})

/*
 * A → B by a choice, B → C where C is not selected, and A → a selected jump.
 * The jump aims at B, which is in the selection; a second jump aims out of it.
 */
const world = (): SceneMapClipboardElements => ({
  events: [
    event('event-a', { choices: ['choice-1'] }),
    event('event-b', {
      input: 'input-1',
      type: EVENT_TYPE.INPUT,
      audio: [AUDIO, false]
    }),
    event('event-c')
  ],
  jumps: [
    jump('jump-in', { path: [SCENE, 'event-b'] }),
    jump('jump-out', { path: ['scene-elsewhere', 'event-elsewhere'] })
  ],
  paths: [
    path('path-internal', 'event-a', 'event-b', { choiceId: 'choice-1' }),
    path('path-dangling', 'event-b', 'event-c'),
    path('path-to-jump', 'event-a', 'jump-in', {
      destinationType: ELEMENT_TYPE.JUMP
    })
  ],
  choices: [
    {
      id: 'choice-1',
      title: 'titled choice-1',
      tags: [],
      worldId: WORLD,
      eventId: 'event-a'
    } as Choice
  ],
  inputs: [
    {
      id: 'input-1',
      title: 'titled input-1',
      tags: [],
      worldId: WORLD,
      eventId: 'event-b',
      variableId: VARIABLE
    } as Input
  ],
  conditions: [
    {
      id: 'condition-1',
      title: 'titled condition-1',
      tags: [],
      worldId: WORLD,
      pathId: 'path-internal',
      variableId: VARIABLE,
      compare: [VARIABLE, COMPARE_OPERATOR_TYPE.EQ, '1', VARIABLE_TYPE.NUMBER]
    } as Condition,
    {
      id: 'condition-orphan',
      title: 'titled condition-orphan',
      tags: [],
      worldId: WORLD,
      pathId: 'path-dangling',
      variableId: VARIABLE,
      compare: [VARIABLE, COMPARE_OPERATOR_TYPE.EQ, '1', VARIABLE_TYPE.NUMBER]
    } as Condition
  ],
  effects: [
    {
      id: 'effect-1',
      title: 'titled effect-1',
      tags: [],
      worldId: WORLD,
      pathId: 'path-internal',
      variableId: VARIABLE,
      set: [VARIABLE, SET_OPERATOR_TYPE.ASSIGN, '2', VARIABLE_TYPE.NUMBER]
    } as Effect
  ]
})

const SELECTION = ['event-a', 'event-b', 'jump-in', 'jump-out']

const copy = () => collectSceneMapSelection(WORLD, SELECTION, world())

// deterministic ids, so a test asserts on the rewrite rather than on uuids
const mintIds = () => {
  let next = 0

  return () => `new-${++next}`
}

describe('collecting a scene map selection', () => {
  it('takes the selected events and jumps', () => {
    const clipboard = copy()

    expect(clipboard.events.map(({ id }) => id)).toEqual(['event-a', 'event-b'])
    expect(clipboard.jumps.map(({ id }) => id)).toEqual(['jump-in', 'jump-out'])
    expect(clipboard.worldId).toBe(WORLD)
  })

  it('derives paths from the nodes rather than from the selection', () => {
    // path-internal and path-to-jump have both ends inside; path-dangling does
    // not, and is not copied however it was selected
    expect(copy().paths.map(({ id }) => id)).toEqual([
      'path-internal',
      'path-to-jump'
    ])
  })

  it('counts the paths it dropped', () => {
    expect(copy().droppedPaths).toBe(1)
  })

  it('takes the choices, inputs, conditions and effects that hang off them', () => {
    const clipboard = copy()

    expect(clipboard.choices.map(({ id }) => id)).toEqual(['choice-1'])
    expect(clipboard.inputs.map(({ id }) => id)).toEqual(['input-1'])
    // condition-orphan belongs to the dropped path and goes with it
    expect(clipboard.conditions.map(({ id }) => id)).toEqual(['condition-1'])
    expect(clipboard.effects.map(({ id }) => id)).toEqual(['effect-1'])
  })

  it('copies nothing when only a path is selected', () => {
    const clipboard = collectSceneMapSelection(
      WORLD,
      ['path-internal'],
      world()
    )

    expect(isSceneMapClipboardEmpty(clipboard)).toBe(true)
    expect(clipboard.paths).toEqual([])
  })
})

describe('remapping a scene map clipboard', () => {
  const remap = () =>
    remapSceneMapClipboard(copy(), {
      sceneId: TARGET_SCENE,
      offset: { x: 40, y: 40 },
      mintId: mintIds()
    })

  /**
   * The invariant that matters: nothing in the paste may still name an element
   * that was copied. Anything left behind is a copy quietly wired to the
   * original — which draws correctly on the map and is wrong underneath.
   */
  it('leaves no reference to any copied element', () => {
    const copiedIds = [
      'event-a',
      'event-b',
      'jump-in',
      'jump-out',
      'path-internal',
      'path-to-jump',
      'choice-1',
      'input-1',
      'condition-1',
      'effect-1'
    ]

    const serialized = JSON.stringify(remap())

    copiedIds.forEach((id) =>
      expect(serialized, `still references ${id}`).not.toContain(`"${id}"`)
    )
  })

  it('keeps every reference between the copies consistent', () => {
    const { events, paths, choices, inputs, conditions, effects } = remap()

    const [eventA, eventB] = events,
      [internal, toJump] = paths

    expect(choices[0].eventId).toBe(eventA.id)
    expect(eventA.choices).toEqual([choices[0].id])

    expect(inputs[0].eventId).toBe(eventB.id)
    expect(eventB.input).toBe(inputs[0].id)

    expect(internal.originId).toBe(eventA.id)
    expect(internal.destinationId).toBe(eventB.id)
    expect(internal.choiceId).toBe(choices[0].id)

    expect(toJump.originId).toBe(eventA.id)

    expect(conditions[0].pathId).toBe(internal.id)
    expect(effects[0].pathId).toBe(internal.id)
  })

  it('moves everything into the target scene', () => {
    const { events, jumps, paths } = remap()

    expect(events.every(({ sceneId }) => sceneId === TARGET_SCENE)).toBe(true)
    expect(jumps.every(({ sceneId }) => sceneId === TARGET_SCENE)).toBe(true)
    expect(paths.every(({ sceneId }) => sceneId === TARGET_SCENE)).toBe(true)
  })

  it('offsets the nodes and keeps their relative layout', () => {
    const { events, jumps } = remap()

    expect(events[0].composer).toMatchObject({
      sceneMapPosX: 140,
      sceneMapPosY: 240
    })
    expect(jumps[0].composer).toMatchObject({
      sceneMapPosX: 340,
      sceneMapPosY: 440
    })
  })

  it('follows a jump aimed inside the selection to the copy', () => {
    const { events, jumps } = remap(),
      copiedB = events[1],
      [jumpIn] = jumps

    expect(jumpIn.path).toEqual([TARGET_SCENE, copiedB.id])
  })

  it('leaves a jump aimed elsewhere in the world pointing where it did', () => {
    const [, jumpOut] = remap().jumps

    expect(jumpOut.path).toEqual(['scene-elsewhere', 'event-elsewhere'])
  })

  // world-scoped, so a paste inside one world must not touch them
  it('keeps variable, character and asset references as they were', () => {
    const { events, inputs, conditions, effects } = remap()

    expect(events[0].characters).toEqual([CHARACTER])
    expect(events[0].images).toEqual([IMAGE])
    expect(events[1].audio).toEqual([AUDIO, false])
    expect(inputs[0].variableId).toBe(VARIABLE)
    expect(conditions[0].variableId).toBe(VARIABLE)
    expect(conditions[0].compare[0]).toBe(VARIABLE)
    expect(effects[0].set[0]).toBe(VARIABLE)
  })

  it('mints one id per element and no more', () => {
    const clipboard = copy(),
      total =
        clipboard.events.length +
        clipboard.jumps.length +
        clipboard.paths.length +
        clipboard.choices.length +
        clipboard.inputs.length +
        clipboard.conditions.length +
        clipboard.effects.length

    const mint = mintIds()
    let minted = 0

    remapSceneMapClipboard(clipboard, {
      sceneId: TARGET_SCENE,
      offset: { x: 0, y: 0 },
      mintId: () => {
        minted++

        return mint()
      }
    })

    expect(minted).toBe(total)
  })

  it('can be pasted twice without the copies colliding', () => {
    const clipboard = copy(),
      first = remapSceneMapClipboard(clipboard, {
        sceneId: TARGET_SCENE,
        offset: { x: 0, y: 0 }
      }),
      second = remapSceneMapClipboard(clipboard, {
        sceneId: TARGET_SCENE,
        offset: { x: 0, y: 0 }
      })

    expect(first.events[0].id).not.toBe(second.events[0].id)
    // and the source is untouched, so the clipboard survives the paste
    expect(clipboard.events[0].id).toBe('event-a')
  })
})

describe('positioning a paste', () => {
  it('reports the top left of the selection', () => {
    expect(sceneMapSelectionOrigin(copy())).toEqual({ x: 100, y: 200 })
  })

  it('has an origin even for an empty clipboard', () => {
    expect(
      sceneMapSelectionOrigin({
        worldId: WORLD,
        events: [],
        jumps: [],
        paths: [],
        choices: [],
        inputs: [],
        conditions: [],
        effects: [],
        droppedPaths: 0
      })
    ).toEqual({ x: 0, y: 0 })
  })
})

describe('describing what was pasted', () => {
  it('counts and pluralises what it has', () => {
    expect(
      describeSceneMapClipboard(
        remapSceneMapClipboard(copy(), {
          sceneId: TARGET_SCENE,
          offset: { x: 0, y: 0 }
        })
      )
    ).toBe('2 events, 2 jumps, 2 paths')
  })

  it('says so when there is nothing', () => {
    expect(
      describeSceneMapClipboard({
        events: [],
        jumps: [],
        paths: [],
        choices: [],
        inputs: [],
        conditions: [],
        effects: []
      })
    ).toBe('nothing')
  })
})
