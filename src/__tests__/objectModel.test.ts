import { describe, expect, it } from 'vitest'

import {
  canApplyRecipe,
  combine,
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
  type ObjectWorldSnapshot
} from '../../engine/src/lib/objects'

import {
  applyVariableSets,
  variableCompareHolds
} from '../../engine/src/lib/state'

import {
  COMPARE_OPERATOR_TYPE,
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

    const deltas = take(world, 'coin')

    expect(deltas).toBeDefined()

    const after = snapshot({ objects: [coin], deltas })

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

  it('accumulates across two scenes into one inventory stack', () => {
    const coin = object('coin', {
      placements: [placement(KITCHEN, 1), placement(STUDY, 3)]
    })

    const first = take(snapshot({ objects: [coin] }), 'coin')

    const second = take(
      snapshot({ objects: [coin], deltas: first, currentSceneId: STUDY }),
      'coin'
    )

    const after = snapshot({ objects: [coin], deltas: second })

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
