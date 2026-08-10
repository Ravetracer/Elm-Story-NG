import { describe, expect, it } from 'vitest'

import {
  appendMessage,
  canApplyRecipe,
  combine,
  MAX_RECIPE_INPUTS,
  COMBINE_OUTCOME,
  DEFAULT_NO_RECIPE_MESSAGE,
  displayAssetId,
  displayTitle,
  inventoryCount,
  locationContents,
  matchRecipe,
  objectCompareHolds,
  objectCountAt,
  pruneDeltas,
  take,
  wear,
  unwear,
  type ObjectWorldSnapshot
} from '../../engine/src/lib/objects'

import {
  applyVariableSets,
  resetSceneScopedVariables,
  variableCompareHolds
} from '../../engine/src/lib/state'

import {
  COMPARE_OPERATOR_TYPE,
  ENGINE_LIVE_EVENT_MESSAGE_TYPE,
  EngineVariableData,
  VARIABLE_SCOPE,
  EngineObjectData,
  EngineRecipeData,
  INVENTORY_LOCATION_KEY,
  OBJECT_LOCATION_TYPE,
  PATH_CONDITIONS_TYPE,
  RECIPE_OUTPUT_DESTINATION,
  SET_OPERATOR_TYPE,
  VARIABLE_TYPE,
  type ObjectPlacement
} from '../../engine/src/types'

/**
 * The world object model, imported from `engine/src` directly.
 *
 * There is one copy of this module and it lives in the engine, because the engine
 * is what runs a storyworld. The editor reaches into `engine/src` the way
 * `ElementEditor/SceneMap/EventSnippet.tsx` and `lib/serialization.ts` already do,
 * rather than the module being duplicated per project — `templates.ts` exists
 * twice and `CLAUDE.md` records that as a hazard, not a pattern to copy.
 */

const KITCHEN = 'scene-kitchen',
  STUDY = 'scene-study'

const object = (
  id: string,
  overrides: Partial<EngineObjectData> = {}
): EngineObjectData => ({
  combineable: true,
  description: '',
  id,
  placements: [],
  takeable: true,
  title: id,
  worldId: 'world-1',
  ...overrides
})

const placement = (
  location: string,
  quantity: number,
  overrides: Partial<ObjectPlacement> = {}
): ObjectPlacement => ({ location, quantity, ...overrides })

const snapshot = (
  overrides: Partial<ObjectWorldSnapshot> = {}
): ObjectWorldSnapshot => ({
  objects: [],
  deltas: {},
  state: {},
  currentSceneId: KITCHEN,
  ...overrides
})

const numberState = (id: string, value: string) => ({
  [id]: {
    title: id,
    type: VARIABLE_TYPE.NUMBER,
    value,
    worldId: 'world-1'
  }
})

describe('variable comparison rules', () => {
  it('compares a NUMBER across all six operators', () => {
    const cases: Array<[COMPARE_OPERATOR_TYPE, boolean]> = [
      [COMPARE_OPERATOR_TYPE.EQ, false],
      [COMPARE_OPERATOR_TYPE.NE, true],
      [COMPARE_OPERATOR_TYPE.GT, true],
      [COMPARE_OPERATOR_TYPE.GTE, true],
      [COMPARE_OPERATOR_TYPE.LT, false],
      [COMPARE_OPERATOR_TYPE.LTE, false]
    ]

    cases.forEach(([operator, expected]) =>
      expect(
        variableCompareHolds(
          ['health', operator, '50', VARIABLE_TYPE.NUMBER],
          VARIABLE_TYPE.NUMBER,
          '75'
        ),
        operator
      ).toBe(expected)
    )
  })

  it('compares anything else as a lower-cased string', () => {
    expect(
      variableCompareHolds(
        ['name', COMPARE_OPERATOR_TYPE.EQ, 'Jules', VARIABLE_TYPE.STRING],
        VARIABLE_TYPE.STRING,
        'jules'
      )
    ).toBe(true)
  })

  it('has no opinion on an ordering operator applied to a string', () => {
    // the engine has always behaved this way; isPathOpen drops such a condition,
    // while a placement gate treats the absence of an opinion as false
    expect(
      variableCompareHolds(
        ['name', COMPARE_OPERATOR_TYPE.GT, 'a', VARIABLE_TYPE.STRING],
        VARIABLE_TYPE.STRING,
        'b'
      )
    ).toBeUndefined()
  })
})

describe('variable assignment', () => {
  it('formats a NUMBER result rather than leaving float noise', () => {
    // 10 / 3 must read as 3.33, which is what formatNumberFromString is for.
    // Dropping that pass would change arithmetic in every existing world.
    const next = applyVariableSets(numberState('n', '10'), [
      ['n', SET_OPERATOR_TYPE.DIVIDE, '3', VARIABLE_TYPE.NUMBER]
    ])

    expect(next.n.value).toBe('3.33')
  })

  it('leaves a safe integer unpadded', () => {
    const next = applyVariableSets(numberState('n', '2'), [
      ['n', SET_OPERATOR_TYPE.ADD, '3', VARIABLE_TYPE.NUMBER]
    ])

    expect(next.n.value).toBe('5')
  })

  it('skips an assignment naming a variable that is not in the state', () => {
    // a deleted variable must not reappear as a zombie entry in a save
    const state = numberState('n', '1'),
      next = applyVariableSets(state, [
        ['gone', SET_OPERATOR_TYPE.ASSIGN, '9', VARIABLE_TYPE.NUMBER]
      ])

    expect(next.gone).toBeUndefined()
    expect(Object.keys(next)).toEqual(['n'])
  })

  it('does not mutate the state it is given', () => {
    const state = numberState('n', '1')

    applyVariableSets(state, [
      ['n', SET_OPERATOR_TYPE.ASSIGN, '9', VARIABLE_TYPE.NUMBER]
    ])

    expect(state.n.value).toBe('1')
  })
})

describe('deriving what is where', () => {
  it('reads an ungated placement as present', () => {
    const world = snapshot({
      objects: [object('coin', { placements: [placement(KITCHEN, 3)] })]
    })

    expect(objectCountAt(world, 'coin', KITCHEN)).toBe(3)
  })

  it('stores nothing for a pristine world', () => {
    // the whole point of deriving: an untouched world has an empty delta map, so an
    // old save that has no map at all reads identically
    const world = snapshot({
      objects: [object('coin', { placements: [placement(KITCHEN, 1)] })],
      deltas: {}
    })

    expect(objectCountAt(world, 'coin', KITCHEN)).toBe(1)
  })

  it('applies a signed delta over the placement', () => {
    const world = snapshot({
      objects: [object('coin', { placements: [placement(KITCHEN, 3)] })],
      deltas: { [KITCHEN]: { coin: -1 } }
    })

    expect(objectCountAt(world, 'coin', KITCHEN)).toBe(2)
  })

  it('clamps at zero rather than reporting a negative count', () => {
    const world = snapshot({
      objects: [object('coin', { placements: [placement(KITCHEN, 1)] })],
      deltas: { [KITCHEN]: { coin: -5 } }
    })

    expect(objectCountAt(world, 'coin', KITCHEN)).toBe(0)
  })

  it('keeps each location independent', () => {
    const world = snapshot({
      objects: [
        object('coin', {
          placements: [placement(KITCHEN, 1), placement(STUDY, 5)]
        })
      ],
      deltas: { [KITCHEN]: { coin: -1 } }
    })

    expect(objectCountAt(world, 'coin', KITCHEN)).toBe(0)
    expect(objectCountAt(world, 'coin', STUDY)).toBe(5)
  })

  it('reports zero for an object the world no longer has', () => {
    const world = snapshot({
      objects: [],
      deltas: { [INVENTORY_LOCATION_KEY]: { ghost: 4 } }
    })

    expect(inventoryCount(world, 'ghost')).toBe(0)
  })

  it('lists only non-zero contents, ordered by title', () => {
    const world = snapshot({
      objects: [
        object('b', { title: 'Battery', placements: [placement(KITCHEN, 1)] }),
        object('a', { title: 'Apple', placements: [placement(KITCHEN, 2)] }),
        object('c', { title: 'Coin', placements: [placement(STUDY, 1)] })
      ]
    })

    expect(
      locationContents(world, KITCHEN).map(([o, count]) => [o.title, count])
    ).toEqual([
      ['Apple', 2],
      ['Battery', 1]
    ])
  })
})

describe('placement gates', () => {
  const gatedBattery = (conditionsType?: PATH_CONDITIONS_TYPE) =>
    object('battery', {
      placements: [
        placement(STUDY, 1, {
          conditionsType,
          objectConditions: [
            {
              objectId: 'unlocked-drawer',
              location: OBJECT_LOCATION_TYPE.CURRENT_SCENE,
              compare: [COMPARE_OPERATOR_TYPE.GTE, 1]
            }
          ]
        })
      ]
    })

  it('hides an object whose gate does not pass', () => {
    const world = snapshot({
      currentSceneId: STUDY,
      objects: [gatedBattery(), object('unlocked-drawer', { takeable: false })]
    })

    expect(objectCountAt(world, 'battery', STUDY)).toBe(0)
  })

  it('reveals it the moment the gate passes, with no write at all', () => {
    // this is what replaces recursive containers: the drawer becoming unlocked is a
    // delta on the drawer, and the battery appears without anything writing to it
    const world = snapshot({
      currentSceneId: STUDY,
      objects: [gatedBattery(), object('unlocked-drawer', { takeable: false })],
      deltas: { [STUDY]: { 'unlocked-drawer': 1 } }
    })

    expect(objectCountAt(world, 'battery', STUDY)).toBe(1)
    expect(world.deltas[STUDY].battery).toBeUndefined()
  })

  it('resolves CURRENT_SCENE per scene, so revelation is local', () => {
    // the drawer was unlocked in the study; the battery must not appear in a
    // kitchen that also has a placement for it
    const world = snapshot({
      currentSceneId: KITCHEN,
      objects: [gatedBattery(), object('unlocked-drawer', { takeable: false })],
      deltas: { [STUDY]: { 'unlocked-drawer': 1 } }
    })

    expect(objectCountAt(world, 'battery', STUDY)).toBe(0)
  })

  it('treats an empty gate as present even when typed ANY', () => {
    // [].some() is false, which would hide every ungated ANY placement
    const world = snapshot({
      objects: [
        object('coin', {
          placements: [
            placement(KITCHEN, 1, { conditionsType: PATH_CONDITIONS_TYPE.ANY })
          ]
        })
      ]
    })

    expect(objectCountAt(world, 'coin', KITCHEN)).toBe(1)
  })

  it('requires every condition under ALL and one under ANY', () => {
    const conditions = {
      variableConditions: [
        [
          'flag',
          COMPARE_OPERATOR_TYPE.EQ,
          'true',
          VARIABLE_TYPE.BOOLEAN
        ] as const
      ],
      objectConditions: [
        {
          objectId: 'missing',
          location: OBJECT_LOCATION_TYPE.CURRENT_SCENE,
          compare: [COMPARE_OPERATOR_TYPE.GTE, 1] as [
            COMPARE_OPERATOR_TYPE,
            number
          ]
        }
      ]
    }

    const world = (conditionsType: PATH_CONDITIONS_TYPE) =>
      snapshot({
        state: {
          flag: {
            title: 'flag',
            type: VARIABLE_TYPE.BOOLEAN,
            value: 'true',
            worldId: 'world-1'
          }
        },
        objects: [
          object('coin', {
            placements: [
              placement(KITCHEN, 1, {
                conditionsType,
                ...conditions
              } as Partial<ObjectPlacement>)
            ]
          })
        ]
      })

    // one passes, one fails
    expect(
      objectCountAt(world(PATH_CONDITIONS_TYPE.ALL), 'coin', KITCHEN)
    ).toBe(0)
    expect(
      objectCountAt(world(PATH_CONDITIONS_TYPE.ANY), 'coin', KITCHEN)
    ).toBe(1)
  })

  it('fails closed on a gate naming a variable that is not in the state', () => {
    const world = snapshot({
      objects: [
        object('coin', {
          placements: [
            placement(KITCHEN, 1, {
              variableConditions: [
                ['gone', COMPARE_OPERATOR_TYPE.EQ, 'true', VARIABLE_TYPE.BOOLEAN]
              ]
            })
          ]
        })
      ]
    })

    expect(objectCountAt(world, 'coin', KITCHEN)).toBe(0)
  })

  it('survives two objects gated on each other rather than recursing forever', () => {
    // authorable, and it used to be a stack overflow. A cycle resolves to absent.
    const mutual = (id: string, other: string) =>
      object(id, {
        placements: [
          placement(KITCHEN, 1, {
            objectConditions: [
              {
                objectId: other,
                location: OBJECT_LOCATION_TYPE.CURRENT_SCENE,
                compare: [COMPARE_OPERATOR_TYPE.GTE, 1]
              }
            ]
          })
        ]
      })

    const world = snapshot({
      objects: [mutual('a', 'b'), mutual('b', 'a')]
    })

    expect(objectCountAt(world, 'a', KITCHEN)).toBe(0)
    expect(objectCountAt(world, 'b', KITCHEN)).toBe(0)
  })

  it('fails closed when CURRENT_SCENE cannot be resolved', () => {
    const world = snapshot({
      currentSceneId: undefined,
      objects: [object('coin', { placements: [placement(KITCHEN, 1)] })]
    })

    expect(
      objectCompareHolds(world, {
        objectId: 'coin',
        location: OBJECT_LOCATION_TYPE.CURRENT_SCENE,
        compare: [COMPARE_OPERATOR_TYPE.GTE, 1]
      })
    ).toBe(false)
  })

  it('reads a named scene regardless of where the player is', () => {
    const world = snapshot({
      currentSceneId: KITCHEN,
      objects: [object('lamp', { placements: [placement(STUDY, 1)] })]
    })

    expect(
      objectCompareHolds(world, {
        objectId: 'lamp',
        location: OBJECT_LOCATION_TYPE.SCENE,
        sceneId: STUDY,
        compare: [COMPARE_OPERATOR_TYPE.GTE, 1]
      })
    ).toBe(true)
  })
})

describe('recipe matching', () => {
  const recipe = (
    id: string,
    inputIds: string[],
    overrides: Partial<EngineRecipeData> = {}
  ): EngineRecipeData => ({
    id,
    inputs: inputIds.map((objectId) => ({
      objectId,
      quantity: 1,
      consumed: true
    })),
    outputs: [],
    worldId: 'world-1',
    ...overrides
  })

  it('matches on the exact input set, in any order', () => {
    const recipes = [recipe('r1', ['battery', 'flashlight'])]

    expect(matchRecipe(recipes, ['flashlight', 'battery'])?.id).toBe('r1')
  })

  it('refuses a subset match', () => {
    // a subset match would fire the one-input recipe as soon as two objects were
    // selected, which makes "these two do not combine" unauthorable
    const recipes = [recipe('r1', ['flashlight'])]

    expect(matchRecipe(recipes, ['flashlight', 'battery'])).toBeUndefined()
  })

  it('refuses a superset match', () => {
    const recipes = [recipe('r1', ['flashlight', 'battery', 'tape'])]

    expect(matchRecipe(recipes, ['flashlight', 'battery'])).toBeUndefined()
  })

  it('matches a single input, which is how decomposition is triggered', () => {
    const recipes = [recipe('r2', ['charged-flashlight'])]

    expect(matchRecipe(recipes, ['charged-flashlight'])?.id).toBe('r2')
  })

  it('resolves a duplicate input set deterministically', () => {
    const recipes = [
      recipe('r-b', ['a', 'b']),
      recipe('r-a', ['b', 'a'])
    ]

    expect(matchRecipe(recipes, ['a', 'b'])?.id).toBe('r-a')
    expect(matchRecipe([...recipes].reverse(), ['a', 'b'])?.id).toBe('r-a')
  })
})

describe('combining', () => {
  const flashlight = object('flashlight', {
      placements: [placement(INVENTORY_LOCATION_KEY, 1)]
    }),
    battery = object('battery', {
      placements: [placement(INVENTORY_LOCATION_KEY, 1)]
    }),
    charged = object('charged')

  const chargeRecipe: EngineRecipeData = {
    id: 'charge',
    inputs: [
      { objectId: 'battery', quantity: 1, consumed: true },
      { objectId: 'flashlight', quantity: 1, consumed: true }
    ],
    outputs: [
      {
        objectId: 'charged',
        quantity: 1,
        destination: RECIPE_OUTPUT_DESTINATION.INVENTORY
      }
    ],
    message: 'You snap the battery into the flashlight.',
    worldId: 'world-1'
  }

  it('consumes both inputs and yields the output', () => {
    const world = snapshot({ objects: [flashlight, battery, charged] }),
      result = combine(world, [chargeRecipe], ['battery', 'flashlight'])

    expect(result.outcome).toBe(COMBINE_OUTCOME.APPLIED)

    if (result.outcome !== COMBINE_OUTCOME.APPLIED) return

    const after = snapshot({
      objects: [flashlight, battery, charged],
      deltas: result.deltas
    })

    expect(inventoryCount(after, 'battery')).toBe(0)
    expect(inventoryCount(after, 'flashlight')).toBe(0)
    expect(inventoryCount(after, 'charged')).toBe(1)
    expect(result.message).toBe('You snap the battery into the flashlight.')
  })

  it('does not mutate the snapshot it was given', () => {
    const world = snapshot({ objects: [flashlight, battery, charged] })

    combine(world, [chargeRecipe], ['battery', 'flashlight'])

    expect(world.deltas).toEqual({})
  })

  it('keeps a retained input, so one key opens two drawers', () => {
    const key = object('key', {
        placements: [placement(INVENTORY_LOCATION_KEY, 1)]
      }),
      drawer = object('drawer', {
        takeable: false,
        placements: [placement(STUDY, 1)]
      }),
      unlocked = object('unlocked-drawer', { takeable: false })

    const unlockRecipe: EngineRecipeData = {
      id: 'unlock',
      inputs: [
        { objectId: 'key', quantity: 1, consumed: false },
        { objectId: 'drawer', quantity: 1, consumed: true }
      ],
      outputs: [
        {
          objectId: 'unlocked-drawer',
          quantity: 1,
          destination: RECIPE_OUTPUT_DESTINATION.CURRENT_SCENE
        }
      ],
      worldId: 'world-1'
    }

    const world = snapshot({
        currentSceneId: STUDY,
        objects: [key, drawer, unlocked]
      }),
      result = combine(world, [unlockRecipe], ['key', 'drawer'])

    expect(result.outcome).toBe(COMBINE_OUTCOME.APPLIED)

    if (result.outcome !== COMBINE_OUTCOME.APPLIED) return

    const after = snapshot({
      currentSceneId: STUDY,
      objects: [key, drawer, unlocked],
      deltas: result.deltas
    })

    expect(inventoryCount(after, 'key')).toBe(1)
    expect(objectCountAt(after, 'drawer', STUDY)).toBe(0)
    expect(objectCountAt(after, 'unlocked-drawer', STUDY)).toBe(1)
  })

  it('draws a static input from the current scene, never the inventory', () => {
    const drawer = object('drawer', {
      takeable: false,
      placements: [placement(STUDY, 1)]
    })

    const world = snapshot({ currentSceneId: STUDY, objects: [drawer] })

    expect(
      canApplyRecipe(world, {
        id: 'r',
        inputs: [{ objectId: 'drawer', quantity: 1, consumed: true }],
        outputs: [],
        worldId: 'world-1'
      })
    ).toBe(true)
  })

  it('spends a quantity from a stack', () => {
    const coin = object('coin', {
        placements: [placement(INVENTORY_LOCATION_KEY, 9)]
      }),
      ticket = object('ticket')

    const buy: EngineRecipeData = {
      id: 'buy',
      inputs: [{ objectId: 'coin', quantity: 5, consumed: true }],
      outputs: [
        {
          objectId: 'ticket',
          quantity: 1,
          destination: RECIPE_OUTPUT_DESTINATION.INVENTORY
        }
      ],
      worldId: 'world-1'
    }

    const world = snapshot({ objects: [coin, ticket] }),
      result = combine(world, [buy], ['coin'])

    expect(result.outcome).toBe(COMBINE_OUTCOME.APPLIED)

    if (result.outcome !== COMBINE_OUTCOME.APPLIED) return

    const after = snapshot({ objects: [coin, ticket], deltas: result.deltas })

    expect(inventoryCount(after, 'coin')).toBe(4)
    expect(inventoryCount(after, 'ticket')).toBe(1)
  })

  it('reports INSUFFICIENT rather than firing a recipe it cannot pay for', () => {
    const coin = object('coin', {
      placements: [placement(INVENTORY_LOCATION_KEY, 2)]
    })

    const buy: EngineRecipeData = {
      id: 'buy',
      inputs: [{ objectId: 'coin', quantity: 5, consumed: true }],
      outputs: [],
      worldId: 'world-1'
    }

    const result = combine(snapshot({ objects: [coin] }), [buy], ['coin'])

    expect(result.outcome).toBe(COMBINE_OUTCOME.INSUFFICIENT)
  })

  it('applies a recipe effect to the variable state', () => {
    const world = snapshot({
      objects: [flashlight, battery, charged],
      state: numberState('quest', '1')
    })

    const result = combine(
      world,
      [
        {
          ...chargeRecipe,
          effects: [['quest', SET_OPERATOR_TYPE.ADD, '1', VARIABLE_TYPE.NUMBER]]
        }
      ],
      ['battery', 'flashlight']
    )

    expect(result.outcome).toBe(COMBINE_OUTCOME.APPLIED)

    if (result.outcome !== COMBINE_OUTCOME.APPLIED) return

    expect(result.state.quest.value).toBe('2')
    // the snapshot's own state is untouched
    expect(world.state.quest.value).toBe('1')
  })

  it('decomposes, which is one input and two outputs', () => {
    const world = snapshot({
      objects: [
        object('charged', { placements: [placement(INVENTORY_LOCATION_KEY, 1)] }),
        object('empty'),
        object('battery')
      ]
    })

    const openIt: EngineRecipeData = {
      id: 'open',
      inputs: [{ objectId: 'charged', quantity: 1, consumed: true }],
      outputs: [
        {
          objectId: 'empty',
          quantity: 1,
          destination: RECIPE_OUTPUT_DESTINATION.INVENTORY
        },
        {
          objectId: 'battery',
          quantity: 1,
          destination: RECIPE_OUTPUT_DESTINATION.INVENTORY
        }
      ],
      worldId: 'world-1'
    }

    const result = combine(world, [openIt], ['charged'])

    expect(result.outcome).toBe(COMBINE_OUTCOME.APPLIED)

    if (result.outcome !== COMBINE_OUTCOME.APPLIED) return

    const after = snapshot({ objects: world.objects, deltas: result.deltas })

    expect(inventoryCount(after, 'charged')).toBe(0)
    expect(inventoryCount(after, 'empty')).toBe(1)
    expect(inventoryCount(after, 'battery')).toBe(1)
  })
})

describe('what the storyteller says when nothing matches', () => {
  it('prefers the message of the object combined from', () => {
    const world = snapshot({
      objects: [
        object('key', { noRecipeMessage: 'The key does not fit.' }),
        object('rock', { noRecipeMessage: 'The rock is just a rock.' })
      ],
      noRecipeMessage: 'That does not work.'
    })

    const result = combine(world, [], ['key', 'rock'])

    expect(result.outcome).toBe(COMBINE_OUTCOME.NO_RECIPE)
    expect(result.message).toBe('The key does not fit.')
  })

  it('falls back to the world default', () => {
    const world = snapshot({
      objects: [object('key')],
      noRecipeMessage: 'That does not work.'
    })

    expect(combine(world, [], ['key']).message).toBe('That does not work.')
  })

  it('falls back to the engine default rather than saying nothing', () => {
    // silence reads as a broken game rather than a refusal
    const world = snapshot({ objects: [object('key')] })

    expect(combine(world, [], ['key']).message).toBe(DEFAULT_NO_RECIPE_MESSAGE)
  })
})

describe('taking', () => {
  it('moves the whole stack from the scene into the inventory', () => {
    const coin = object('coin', { placements: [placement(KITCHEN, 5)] }),
      world = snapshot({ objects: [coin] })

    const result = take(world, 'coin')

    expect(result).toBeDefined()

    const after = snapshot({ objects: [coin], deltas: result?.deltas })

    expect(objectCountAt(after, 'coin', KITCHEN)).toBe(0)
    expect(inventoryCount(after, 'coin')).toBe(5)
  })

  it('refuses a static object', () => {
    const drawer = object('drawer', {
      takeable: false,
      placements: [placement(KITCHEN, 1)]
    })

    expect(take(snapshot({ objects: [drawer] }), 'drawer')).toBeUndefined()
  })

  it('refuses when there is nothing there', () => {
    const coin = object('coin', { placements: [placement(STUDY, 1)] })

    expect(take(snapshot({ objects: [coin] }), 'coin')).toBeUndefined()
  })

  it('applies the take effects, which is the only way a take sets a variable', () => {
    /*
     * A recipe's effects fire on Use or Combine, and a take is neither — so before
     * takeEffects existed there was no way to make `{ bookTaken ? ... }` true.
     * A path condition can ask about the inventory directly, but a template
     * expression can only read variables.
     */
    const book = object('book', { placements: [placement(KITCHEN, 1)] })

    const world = snapshot({
      objects: [
        {
          ...book,
          takeEffects: [
            ['bookTaken', SET_OPERATOR_TYPE.ASSIGN, 'true', VARIABLE_TYPE.BOOLEAN]
          ],
          takeMessage: 'You slip the book into your bag.'
        }
      ],
      state: {
        bookTaken: {
          title: 'bookTaken',
          type: VARIABLE_TYPE.BOOLEAN,
          value: 'false',
          worldId: 'world-1'
        }
      }
    })

    const result = take(world, 'book')

    expect(result?.state.bookTaken.value).toBe('true')
    expect(result?.message).toBe('You slip the book into your bag.')
    // the snapshot it was given is untouched
    expect(world.state.bookTaken.value).toBe('false')
  })

  it('leaves the state alone when there are no take effects', () => {
    const coin = object('coin', { placements: [placement(KITCHEN, 1)] }),
      world = snapshot({ objects: [coin], state: numberState('n', '1') })

    expect(take(world, 'coin')?.state).toBe(world.state)
  })

  it('accumulates across two scenes into one inventory stack', () => {
    const coin = object('coin', {
      placements: [placement(KITCHEN, 1), placement(STUDY, 3)]
    })

    const first = take(snapshot({ objects: [coin] }), 'coin')

    const second = take(
      snapshot({
        objects: [coin],
        deltas: first?.deltas,
        currentSceneId: STUDY
      }),
      'coin'
    )

    const after = snapshot({ objects: [coin], deltas: second?.deltas })

    expect(inventoryCount(after, 'coin')).toBe(4)
  })
})

describe('stacked presentation', () => {
  const coin = object('coin', {
    title: 'Coin',
    stackedTitle: 'a pile of coins',
    assetId: 'one-coin',
    stackedAssetId: 'many-coins'
  })

  it('uses the plain title for a single item', () => {
    expect(displayTitle(coin, 1)).toBe('Coin')
    expect(displayAssetId(coin, 1)).toBe('one-coin')
  })

  it('uses the stacked title and image beyond one', () => {
    expect(displayTitle(coin, 9)).toBe('a pile of coins')
    expect(displayAssetId(coin, 9)).toBe('many-coins')
  })

  it('falls back to the plain title when no stacked one is set', () => {
    const plain = object('rock', { title: 'Rock' })

    expect(displayTitle(plain, 4)).toBe('Rock')
    expect(displayAssetId(plain, 4)).toBeUndefined()
  })
})

describe('scene-scoped variables', () => {
  const variable = (
    id: string,
    overrides: Partial<EngineVariableData> = {}
  ): EngineVariableData => ({
    id,
    initialValue: '0',
    title: id,
    type: VARIABLE_TYPE.NUMBER,
    worldId: 'world-1',
    ...overrides
  })

  const state = (id: string, value: string) => ({
    [id]: {
      title: id,
      type: VARIABLE_TYPE.NUMBER,
      value,
      worldId: 'world-1'
    }
  })

  it('resets a variable scoped to the scene being entered', () => {
    const next = resetSceneScopedVariables(
      state('tries', '3'),
      [variable('tries', { scope: VARIABLE_SCOPE.SCENE, scopeId: KITCHEN })],
      KITCHEN
    )

    expect(next.tries.value).toBe('0')
  })

  it('leaves a variable scoped to a different scene alone', () => {
    const next = resetSceneScopedVariables(
      state('tries', '3'),
      [variable('tries', { scope: VARIABLE_SCOPE.SCENE, scopeId: STUDY })],
      KITCHEN
    )

    expect(next.tries.value).toBe('3')
  })

  it('leaves world-scoped variables alone, scoped or absent', () => {
    const explicit = resetSceneScopedVariables(
      state('gold', '9'),
      [variable('gold', { scope: VARIABLE_SCOPE.WORLD, scopeId: KITCHEN })],
      KITCHEN
    )

    // absent scope means WORLD, which is what every variable written before this
    // existed has
    const absent = resetSceneScopedVariables(
      state('gold', '9'),
      [variable('gold')],
      KITCHEN
    )

    expect(explicit.gold.value).toBe('9')
    expect(absent.gold.value).toBe('9')
  })

  it('hands back the same object when nothing is scoped here', () => {
    // identity, not just equality: the caller writes this straight onto a live
    // event, and a fresh object every jump would be a needless write
    const given = state('gold', '9')

    expect(resetSceneScopedVariables(given, [variable('gold')], KITCHEN)).toBe(
      given
    )
  })

  it('does nothing without a scene, which is every non-jump', () => {
    const given = state('tries', '3')

    expect(
      resetSceneScopedVariables(
        given,
        [variable('tries', { scope: VARIABLE_SCOPE.SCENE, scopeId: KITCHEN })],
        undefined
      )
    ).toBe(given)
  })

  it('does not resurrect a variable the save has never seen', () => {
    // the state is reconciled against the world elsewhere; this must not fight it
    const next = resetSceneScopedVariables(
      {},
      [variable('tries', { scope: VARIABLE_SCOPE.SCENE, scopeId: KITCHEN })],
      KITCHEN
    )

    expect(next.tries).toBeUndefined()
  })

  it('does not mutate the state it is given', () => {
    const given = state('tries', '3')

    resetSceneScopedVariables(
      given,
      [variable('tries', { scope: VARIABLE_SCOPE.SCENE, scopeId: KITCHEN })],
      KITCHEN
    )

    expect(given.tries.value).toBe('3')
  })
})

describe('how many objects one recipe may take', () => {
  it('is a pair, which is what the rail can offer and the editor may author', () => {
    expect(MAX_RECIPE_INPUTS).toBe(2)
  })

  it('still fires a one-input recipe, which is Use', () => {
    const battery = object('battery', { combineable: true }),
      charged = object('charged', {})

    const recipe: EngineRecipeData = {
      id: 'r',
      inputs: [{ objectId: 'battery', quantity: 1, consumed: true }],
      outputs: [
        {
          objectId: 'charged',
          quantity: 1,
          destination: RECIPE_OUTPUT_DESTINATION.INVENTORY
        }
      ],
      worldId: 'world-1'
    }

    const world = snapshot({
      objects: [battery, charged],
      deltas: { [INVENTORY_LOCATION_KEY]: { battery: 1 } }
    })

    expect(combine(world, [recipe], ['battery']).outcome).toBe(
      COMBINE_OUTCOME.APPLIED
    )
  })

  it('leaves a longer recipe unreachable rather than matching a subset', () => {
    /*
     * A world written before the cap, or edited by hand, can still hold a
     * three-input recipe. The model does not filter those out — no selection that
     * size can be built any more — but it must not fire one on a pair either, or
     * capping the UI would silently change what an existing world does.
     */
    const three: EngineRecipeData = {
      id: 'r3',
      inputs: [
        { objectId: 'radio', quantity: 1, consumed: true },
        { objectId: 'antenna', quantity: 1, consumed: true },
        { objectId: 'battery', quantity: 1, consumed: true }
      ],
      outputs: [],
      worldId: 'world-1'
    }

    expect(matchRecipe([three], ['radio', 'antenna'])).toBeUndefined()
    expect(matchRecipe([three], ['radio', 'antenna', 'battery'])).toBe(three)
  })
})

describe('what the storyteller has already said on this event', () => {
  const narration = (text: string) => ({
      text,
      type: ENGINE_LIVE_EVENT_MESSAGE_TYPE.NARRATION
    }),
    inspection = (text: string) => ({
      text,
      type: ENGINE_LIVE_EVENT_MESSAGE_TYPE.INSPECTION
    })

  const refusal = narration(DEFAULT_NO_RECIPE_MESSAGE)

  it('starts the list when the event has said nothing', () => {
    expect(appendMessage(undefined, narration('You take the book.'))).toEqual([
      narration('You take the book.')
    ])
  })

  it('keeps what was said before, in order', () => {
    expect(
      appendMessage([narration('First.')], narration('Second.'))
    ).toEqual([narration('First.'), narration('Second.')])
  })

  it('says nothing about an action with no message', () => {
    expect(appendMessage([narration('First.')], undefined)).toBeUndefined()
    expect(appendMessage([narration('First.')], narration(''))).toBeUndefined()
  })

  it('repeats an identical take message, because that is two things taken', () => {
    expect(
      appendMessage([narration('You pocket a coin.')], narration('You pocket a coin.'))
    ).toEqual([narration('You pocket a coin.'), narration('You pocket a coin.')])
  })

  it('collapses a refusal against the same refusal directly above it', () => {
    expect(appendMessage([refusal], refusal, true)).toBeUndefined()
  })

  it('collapses only against the last thing said, not anything earlier', () => {
    expect(
      appendMessage([refusal, narration('You take the book.')], refusal, true)
    ).toEqual([refusal, narration('You take the book.'), refusal])
  })

  it('does not collapse an inspection against a narration that reads the same', () => {
    expect(
      appendMessage([narration('An old brass key.')], inspection('An old brass key.'), true)
    ).toEqual([narration('An old brass key.'), inspection('An old brass key.')])
  })

  it('collapses an inspection against the same inspection, for a tile clicked twice', () => {
    expect(
      appendMessage([inspection('An old brass key.')], inspection('An old brass key.'), true)
    ).toBeUndefined()
  })

  it('does not mutate the list it was given', () => {
    const said = [narration('First.')]

    appendMessage(said, narration('Second.'))

    expect(said).toEqual([narration('First.')])
  })
})

describe('reconciling a save against a newer world', () => {
  it('drops deltas naming an object that no longer exists', () => {
    const pruned = pruneDeltas(
      {
        [INVENTORY_LOCATION_KEY]: { coin: 3, ghost: 2 },
        [KITCHEN]: { ghost: 1 }
      },
      ['coin']
    )

    expect(pruned).toEqual({ [INVENTORY_LOCATION_KEY]: { coin: 3 } })
  })

  it('drops a zero entry, so the map does not accumulate husks', () => {
    expect(
      pruneDeltas({ [INVENTORY_LOCATION_KEY]: { coin: 0 } }, ['coin'])
    ).toEqual({})
  })

  it('leaves a fully live map alone', () => {
    const deltas = { [INVENTORY_LOCATION_KEY]: { coin: 2 } }

    expect(pruneDeltas(deltas, ['coin'])).toEqual(deltas)
  })
})

describe('wearing and removing objects', () => {
  const hat = (overrides = {}) =>
    object('hat', {
      wearable: true,
      wearEffects: [
        ['worn', SET_OPERATOR_TYPE.ASSIGN, 'true', VARIABLE_TYPE.BOOLEAN]
      ],
      removeEffects: [
        ['worn', SET_OPERATOR_TYPE.ASSIGN, 'false', VARIABLE_TYPE.BOOLEAN]
      ],
      wearMessage: 'You put the hat on.',
      ...overrides
    })

  const carried = () =>
    snapshot({
      objects: [hat()],
      deltas: { [INVENTORY_LOCATION_KEY]: { hat: 1 } },
      state: {
        worn: {
          title: 'worn',
          type: VARIABLE_TYPE.BOOLEAN,
          value: 'false',
          worldId: 'world-1'
        }
      }
    })

  it('wears a carried wearable, adding it to worn and applying wear effects', () => {
    const result = wear(carried(), [], 'hat')

    expect(result?.worn).toEqual(['hat'])
    expect(result?.state.worn.value).toBe('true')
    expect(result?.message).toBe('You put the hat on.')
  })

  it('refuses to wear what is not carried, not wearable, or already worn', () => {
    // not carried
    expect(wear(snapshot({ objects: [hat()] }), [], 'hat')).toBeUndefined()
    // not wearable
    expect(
      wear(
        snapshot({
          objects: [object('rock', { wearable: false })],
          deltas: { [INVENTORY_LOCATION_KEY]: { rock: 1 } }
        }),
        [],
        'rock'
      )
    ).toBeUndefined()
    // already worn
    expect(wear(carried(), ['hat'], 'hat')).toBeUndefined()
  })

  it('removes a worn object, dropping it from worn and applying remove effects', () => {
    const result = unwear(carried(), ['hat'], 'hat')

    expect(result?.worn).toEqual([])
    expect(result?.state.worn.value).toBe('false')
  })

  it('refuses to remove what is not worn', () => {
    expect(unwear(carried(), [], 'hat')).toBeUndefined()
  })
})
