import { ipcRenderer } from 'electron'
import { v4 as uuid } from 'uuid'

import {
  StudioId,
  World,
  ElementId,
  ELEMENT_TYPE,
  EVENT_TYPE,
  PATH_CONDITIONS_TYPE,
  COMPARE_OPERATOR_TYPE,
  SET_OPERATOR_TYPE,
  VARIABLE_TYPE,
  CHARACTER_MASK_TYPE,
  ENGINE_SKIN,
  EQUIP_SLOT,
  OBJECT_LOCATION_TYPE,
  RECIPE_OUTPUT_DESTINATION,
  WORLD_TEMPLATE,
  DEFAULT_WORLD_VERSION,
  INVENTORY_LOCATION_KEY,
  ENGINE_THEME
} from '../../data/types'

import { WINDOW_EVENT_TYPE } from '../events'
import { ASSET_KINDS, ASSET_KIND } from '../assets'
import { DEMO_MEDIA } from './media'

import api from '../../api'

/**
 * Builds the built-in demo storyworld — "The Jade Idol of K'aal" — directly through
 * the api layer, the same way `saveStarterContent` builds a new author's blank
 * world. It is a tight, playable archaeology adventure written to exercise every
 * core mechanic exactly once, so it doubles as the worked example the documentation
 * site's illustrated walkthrough is built around:
 *
 *   branching · character masks & dialog · variables · path effects · conditions
 *   gating choices · object-presence path gates · inventory + a combine recipe ·
 *   take-effects · gated object placements · a wearable object gating the finale ·
 *   inline choices · generic choices · template expressions in prose · path
 *   notifications · an author-locked theme · a win and a lose ending.
 *
 * Everything is deterministic: every element id is generated up front so choices,
 * paths, conditions, effects and object conditions can all reference one another.
 * The three character portraits and eight object icons are bundled as base64 in
 * `media.ts` and written to disk through the normal SAVE_ASSET path, so the demo
 * ships its own art with no filesystem or network access at seed time.
 *
 * **No dead end is ever silent.** Every gated choice has a second path underneath it
 * carrying the inverse conditions, leading somewhere that explains what is missing
 * and offers the way back. An author reading this world should see that pattern
 * repeated: a closed choice with nothing behind it produces the engine's bare
 * "Unable to return. Missing path." and reads as a bug to a player.
 */

// --- Slate content helpers -------------------------------------------------

type Node = Record<string, unknown>

const t = (text: string): Node => ({ text })
const p = (...children: Node[]): Node => ({ type: 'p', children })
const h2 = (text: string): Node => ({ type: 'h2', children: [t(text)] })
const charRef = (character_id: ElementId): Node => ({
  type: 'character',
  character_id,
  children: [t('')]
})
const inlineChoice = (choice_id: ElementId): Node => ({
  type: 'choice',
  choice_id,
  children: [t('')]
})
const content = (nodes: Node[]): string => JSON.stringify(nodes)

// --- Asset seeding ---------------------------------------------------------

const dataUrlToArrayBuffer = (dataUrl: string): ArrayBuffer => {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1),
    binary = atob(base64),
    bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  return bytes.buffer
}

/**
 * Writes a bundled base64 image to `userData/assets/<studio>/<world>/<id>.<ext>`
 * under the kind's extension and returns the asset id. The bytes are stored as
 * imported (a JPEG under a `.webp` name, say); every read site loads assets through
 * an `<img>`/`background-image`, which sniffs the content, so the picture renders
 * while the extension stays the one the read site asks for.
 */
const seedAsset = async (
  studioId: StudioId,
  worldId: ElementId,
  dataUrl: string,
  kind: ASSET_KIND
): Promise<string> => {
  const id = uuid()

  await ipcRenderer.invoke(WINDOW_EVENT_TYPE.SAVE_ASSET, {
    studioId,
    worldId,
    id,
    data: dataUrlToArrayBuffer(dataUrl),
    ext: ASSET_KINDS[kind].ext
  })

  return id
}

// --- The seeder ------------------------------------------------------------

export default async function saveDemoContent(
  studioId: StudioId,
  appVersion: string
): Promise<World> {
  const worldId = uuid()

  // Scenes
  const sClass = uuid(),
    sStudy = uuid(),
    sMarket = uuid(),
    sEntrance = uuid(),
    sLaby = uuid(),
    sChamber = uuid(),
    sMuseum = uuid()

  // Events
  const e1 = uuid(), // A Quiet Afternoon
    e2 = uuid(), // The Call
    e2b = uuid(), // The Grant
    e2a = uuid(), // Sealed with a Word
    e2c = uuid(), // Mérida
    e3 = uuid(), // The Professor
    e3a = uuid(), // What Finch Knows
    e4 = uuid(), // Mercado de Mérida
    e4b = uuid(), // Not Yet Ready
    e5 = uuid(), // A Door of Darkness
    e5a = uuid(), // Not Without Light
    e6 = uuid(), // A Fork in the Dark
    e7 = uuid(), // Carved Doorways
    e8 = uuid(), // Lost in the Dark (lose)
    e9 = uuid(), // The Pedestal
    e10 = uuid() // Home at the Museum (win)

  // Jumps (scene -> scene)
  const jStudy = uuid(),
    jMarket = uuid(),
    jEntrance = uuid(),
    jLaby = uuid(),
    jChamber = uuid(),
    jMuseum = uuid(),
    jBackToStudy = uuid(), // market -> Finch, for anything left behind
    jBackToMarket = uuid() // temple -> market, same reason

  // Characters
  const cVargas = uuid(),
    cFinch = uuid(),
    cItzel = uuid()

  // Variables
  const vFunds = uuid(),
    vClues = uuid(),
    vMetGuide = uuid(),
    vFinchTold = uuid(),
    vTorchLit = uuid(),
    vTorchFuel = uuid(),
    vIdolTaken = uuid(),
    vHasMap = uuid(),
    vHasTorch = uuid(),
    vHasFlint = uuid(),
    vBoughtSupplies = uuid(),
    vWearingMask = uuid()

  // Objects & recipe
  const oTorch = uuid(),
    oFlint = uuid(),
    oLitTorch = uuid(),
    oCodex = uuid(),
    oIdol = uuid(),
    oMap = uuid(),
    oRope = uuid(),
    oWater = uuid(),
    oMask = uuid(),
    rLight = uuid()

  // Choices
  const chAnswer = uuid(),
    chAccept = uuid(), // inline, in the prose of The Call
    chAskGrant = uuid(),
    chAcceptAfterGrant = uuid(),
    chFly = uuid(),
    chKnock = uuid(),
    chAskFinch = uuid(),
    chToMarket = uuid(), // from The Professor
    chToMarket2 = uuid(), // from What Finch Knows
    chTalkItzel = uuid(),
    chBuy = uuid(),
    chToTemple = uuid(),
    chBackToStudy = uuid(),
    chBackToStalls = uuid(),
    chEnterLaby = uuid(),
    chBackToEntrance = uuid(),
    // A Choice belongs to exactly one event — `EventChoices` looks them up with
    // `.where({ eventId })` — so an option offered from two events needs one row
    // per event rather than one row reused.
    chBackToMarket = uuid(),
    chBackToMarket2 = uuid(),
    chLeft = uuid(), // inline
    chRight = uuid(), // inline
    chJaguar = uuid(), // inline
    chSerpent = uuid(), // inline
    chLeave = uuid()

  // Paths
  const pAnswer = uuid(),
    pAccept = uuid(),
    pAskGrant = uuid(),
    pAcceptAfterGrant = uuid(),
    pFly = uuid(),
    pKnock = uuid(),
    pAskFinch = uuid(),
    pToMarket = uuid(),
    pToMarket2 = uuid(),
    pTalkItzel = uuid(),
    pBuy = uuid(),
    pToTemple = uuid(),
    pNotReady = uuid(),
    pBackToStudy = uuid(),
    pBackToStalls = uuid(),
    pEnterLaby = uuid(),
    pNoLight = uuid(),
    pBackToEntrance = uuid(),
    pBackToMarket = uuid(),
    pBackToMarket2 = uuid(),
    pLeftLoop = uuid(),
    pLeftLose = uuid(),
    pRight = uuid(),
    pJaguar = uuid(),
    pSerpentLoop = uuid(),
    pSerpentLose = uuid(),
    pLeave = uuid(),
    pLeaveTry = uuid(), // idol taken but mask not worn — loops back with a hint
    pLeaveNoIdol = uuid() // idol not taken yet — loops back so Leave is never a dead end

  const NUM = VARIABLE_TYPE.NUMBER,
    BOOL = VARIABLE_TYPE.BOOLEAN,
    ALL = PATH_CONDITIONS_TYPE.ALL,
    ANY = PATH_CONDITIONS_TYPE.ANY

  // -- World --------------------------------------------------------------
  const world = await api().worlds.saveWorld(studioId, {
    id: worldId,
    children: [
      [ELEMENT_TYPE.SCENE, sClass],
      [ELEMENT_TYPE.SCENE, sStudy],
      [ELEMENT_TYPE.SCENE, sMarket],
      [ELEMENT_TYPE.SCENE, sEntrance],
      [ELEMENT_TYPE.SCENE, sLaby],
      [ELEMENT_TYPE.SCENE, sChamber],
      [ELEMENT_TYPE.SCENE, sMuseum]
    ],
    designer: 'Elm Story - NG',
    description:
      'A short archaeology adventure that shows off every core mechanic of the ' +
      'editor. Recover the lost Jade Idol of K’aal from a Maya temple — and ' +
      'open it up in the composer to see exactly how it was built.',
    engine: appVersion,
    jump: null,
    // Shows `funds` as money below the inventory, with a coin — the grant adds to
    // it and buying supplies spends it, so the readout is live. Money is just this
    // NUMBER variable; the world only designates which one and what to call it.
    currencyVariableId: vFunds,
    currencyLabel: 'Dollars',
    objectNoRecipeMessage: 'Those two do nothing together.',
    // Locks the story to the dark theme, which suits a torch-lit temple and
    // shows off the author-locked Theme setting (the player's own theme toggle is
    // hidden while this is set). Wearables below demonstrate the equip mechanic.
    theme: ENGINE_THEME.CONSOLE,
    // The medieval skin dresses the inventory, the choice modal and the character
    // paperdoll with carved-panel art — a fit for a temple adventure, and the way
    // to see the skin (which shows in an export, not this preview). The wearable
    // mask fills the paperdoll's HEAD slot. Only this skin's art is packed on export.
    skin: ENGINE_SKIN.MEDIEVAL,
    tags: ['demo'],
    template: WORLD_TEMPLATE.ADVENTURE,
    title: 'The Jade Idol of K’aal',
    version: DEFAULT_WORLD_VERSION
  })

  // -- Assets (need the worldId) -----------------------------------------
  const mask = (m: string) => seedAsset(studioId, worldId, m, ASSET_KIND.CHARACTER_MASK)
  const icon = (m: string) => seedAsset(studioId, worldId, m, ASSET_KIND.OBJECT_IMAGE)

  const aVargas = await mask(DEMO_MEDIA.vargas),
    aFinch = await mask(DEMO_MEDIA.finch),
    aItzel = await mask(DEMO_MEDIA.itzel),
    aTorch = await icon(DEMO_MEDIA.torch),
    aFlint = await icon(DEMO_MEDIA.flint),
    aLitTorch = await icon(DEMO_MEDIA.litTorch),
    aCodex = await icon(DEMO_MEDIA.codex),
    aIdol = await icon(DEMO_MEDIA.idol),
    aMap = await icon(DEMO_MEDIA.map),
    aRope = await icon(DEMO_MEDIA.rope),
    aWater = await icon(DEMO_MEDIA.water),
    aMask = await icon(DEMO_MEDIA.mask)

  // -- Characters ---------------------------------------------------------
  await Promise.all([
    api().characters.saveCharacter(studioId, {
      id: cVargas,
      worldId,
      title: 'Dr. Elena Vargas',
      description: 'Director of the Museo del Jade. She made the call.',
      masks: [
        { type: CHARACTER_MASK_TYPE.NEUTRAL, active: true },
        { type: CHARACTER_MASK_TYPE.EXCITED, active: true, assetId: aVargas }
      ],
      refs: [],
      tags: []
    }),
    api().characters.saveCharacter(studioId, {
      id: cFinch,
      worldId,
      title: 'Prof. Aldous Finch',
      description: 'A field archaeologist in Mérida and an old colleague.',
      masks: [
        { type: CHARACTER_MASK_TYPE.NEUTRAL, active: true },
        { type: CHARACTER_MASK_TYPE.CHEERFUL, active: true, assetId: aFinch }
      ],
      refs: [],
      tags: []
    }),
    api().characters.saveCharacter(studioId, {
      id: cItzel,
      worldId,
      title: 'Itzel',
      description: 'A guide who knows the jungle and the temple road.',
      masks: [
        { type: CHARACTER_MASK_TYPE.NEUTRAL, active: true },
        { type: CHARACTER_MASK_TYPE.HAPPY, active: true, assetId: aItzel }
      ],
      refs: [],
      tags: []
    })
  ])

  // -- Variables ----------------------------------------------------------
  const variable = (
    id: ElementId,
    title: string,
    type: VARIABLE_TYPE,
    initialValue: string,
    description: string
  ) =>
    api().variables.saveVariable(studioId, {
      id,
      worldId,
      title,
      type,
      initialValue,
      description,
      tags: []
    })

  await Promise.all([
    variable(
      vFunds,
      'funds',
      NUM,
      '500',
      'Grant dollars on hand. Shown at the end of the story.'
    ),
    variable(
      vClues,
      'clues',
      NUM,
      '0',
      "Leads to the temple's location. Two are needed to set out."
    ),
    variable(
      vMetGuide,
      'metGuide',
      BOOL,
      'false',
      'Set when Itzel is spoken to; reveals the map and the flint in the market.'
    ),
    variable(
      vFinchTold,
      'finchTold',
      BOOL,
      'false',
      'Set once Finch has shared what he knows, so he is not asked twice.'
    ),
    variable(vTorchLit, 'torchLit', BOOL, 'false', 'Set by the torch + flint recipe.'),
    variable(
      vTorchFuel,
      'torchFuel',
      NUM,
      '3',
      'Burns down on every wrong turn in the labyrinth.'
    ),
    variable(
      vIdolTaken,
      'idolTaken',
      BOOL,
      'false',
      'Set by taking the idol; gates the way home.'
    ),
    variable(
      vWearingMask,
      'wearingMask',
      BOOL,
      'false',
      'Set while the ceremonial jade mask is worn; the idol only lifts for a masked face.'
    ),
    variable(
      vHasMap,
      'hasMap',
      BOOL,
      'false',
      'Set by taking the trail map. Read by the departure checklist.'
    ),
    variable(
      vHasTorch,
      'hasTorch',
      BOOL,
      'false',
      'Set by taking the torch. Read by the departure checklist.'
    ),
    variable(
      vHasFlint,
      'hasFlint',
      BOOL,
      'false',
      'Set by taking the flint striker. Read by the departure checklist.'
    ),
    variable(
      vBoughtSupplies,
      'boughtSupplies',
      BOOL,
      'false',
      'Set when water and rope are bought; puts both into the inventory.'
    )
  ])

  // -- Objects & recipe ---------------------------------------------------
  await Promise.all([
    api().objects.saveObject(studioId, {
      id: oTorch,
      worldId,
      title: 'Torch',
      description:
        'A length of pitch-pine wrapped in resin-soaked cloth. Unlit, it is just a stick.',
      assetId: aTorch,
      takeable: true,
      combineable: true,
      placements: [{ location: sMarket, quantity: 1 }],
      takeEffects: [[vHasTorch, SET_OPERATOR_TYPE.ASSIGN, 'true', BOOL]],
      takeMessage: 'You take the resin torch. Unlit, it is only a stick.',
      tags: []
    }),
    api().objects.saveObject(studioId, {
      id: oFlint,
      worldId,
      title: 'Flint & Steel',
      description:
        'A striker of flint and steel. Useless alone; against a torch, it makes fire.',
      assetId: aFlint,
      takeable: true,
      combineable: true,
      // Hidden until Itzel points it out — a placement gated on a variable.
      placements: [
        {
          location: sMarket,
          quantity: 1,
          conditionsType: ALL,
          variableConditions: [[vMetGuide, COMPARE_OPERATOR_TYPE.EQ, 'true', BOOL]]
        }
      ],
      takeEffects: [[vHasFlint, SET_OPERATOR_TYPE.ASSIGN, 'true', BOOL]],
      takeMessage: 'The striker goes into your pack.',
      tags: []
    }),
    api().objects.saveObject(studioId, {
      id: oLitTorch,
      worldId,
      title: 'Lit Torch',
      description: 'Burning steady and bright. It will not last forever.',
      assetId: aLitTorch,
      takeable: true,
      combineable: false,
      // Never placed in the world; it only exists once the recipe fires.
      placements: [],
      tags: []
    }),
    api().objects.saveObject(studioId, {
      id: oMap,
      worldId,
      title: 'Trail Map',
      description:
        'A creased sheet with the trailhead inked in by Itzel, and a cross where the pyramid should stand.',
      assetId: aMap,
      takeable: true,
      combineable: false,
      // Itzel draws it for you, so it only exists once you have spoken to her.
      placements: [
        {
          location: sMarket,
          quantity: 1,
          conditionsType: ALL,
          variableConditions: [[vMetGuide, COMPARE_OPERATOR_TYPE.EQ, 'true', BOOL]]
        }
      ],
      takeEffects: [[vHasMap, SET_OPERATOR_TYPE.ASSIGN, 'true', BOOL]],
      takeMessage: 'You fold Itzel’s map into your jacket.',
      tags: []
    }),
    api().objects.saveObject(studioId, {
      id: oRope,
      worldId,
      title: 'Coil of Rope',
      description: 'Forty feet of hemp rope. Heavier than it looks, and worth it.',
      assetId: aRope,
      takeable: false,
      combineable: false,
      // Bought rather than found: a placement straight into the inventory, gated on
      // the purchase. This is what gives spending money a visible result.
      placements: [
        {
          location: INVENTORY_LOCATION_KEY,
          quantity: 1,
          conditionsType: ALL,
          variableConditions: [
            [vBoughtSupplies, COMPARE_OPERATOR_TYPE.EQ, 'true', BOOL]
          ]
        }
      ],
      tags: []
    }),
    api().objects.saveObject(studioId, {
      id: oWater,
      worldId,
      title: 'Canteen of Water',
      description: 'Full, cold, and the difference between a hike and a disaster.',
      assetId: aWater,
      takeable: false,
      combineable: false,
      placements: [
        {
          location: INVENTORY_LOCATION_KEY,
          quantity: 1,
          conditionsType: ALL,
          variableConditions: [
            [vBoughtSupplies, COMPARE_OPERATOR_TYPE.EQ, 'true', BOOL]
          ]
        }
      ],
      tags: []
    }),
    api().objects.saveObject(studioId, {
      id: oMask,
      worldId,
      title: 'Ceremonial Jade Mask',
      description:
        'A mask of polished jade, its eyes carved wide. The idol’s guardians knew this face.',
      assetId: aMask,
      takeable: true,
      combineable: false,
      wearable: true,
      // A HEAD item, so wearing it fills the paperdoll's head slot. The demo has
      // only this one slotted wearable, so the character figure shows a single
      // anchor — enough to see the panel appear and clear when the mask is worn.
      slot: EQUIP_SLOT.HEAD,
      // Rests beside the idol. Take it, then wear it.
      placements: [{ location: sChamber, quantity: 1 }],
      wearEffects: [[vWearingMask, SET_OPERATOR_TYPE.ASSIGN, 'true', BOOL]],
      removeEffects: [[vWearingMask, SET_OPERATOR_TYPE.ASSIGN, 'false', BOOL]],
      wearMessage:
        'You lift the mask to your face. The carved eyes settle over yours, and the chamber seems to hold its breath.',
      removeMessage: 'You lower the mask.',
      tags: []
    }),
    api().objects.saveObject(studioId, {
      id: oCodex,
      worldId,
      title: 'Ancient Codex',
      description:
        'A crumbling codex of bark paper. Its glyphs name the mountain where K’aal sleeps.',
      assetId: aCodex,
      takeable: true,
      combineable: false,
      placements: [{ location: sStudy, quantity: 1 }],
      takeEffects: [[vClues, SET_OPERATOR_TYPE.ADD, '1', NUM]],
      takeMessage:
        'You pocket the crumbling codex. Its glyphs name a mountain. (+1 clue)',
      tags: []
    }),
    api().objects.saveObject(studioId, {
      id: oIdol,
      worldId,
      title: 'Jade Idol',
      description:
        'A hand-sized idol of carved jade, cold as river water, with a single watching eye.',
      assetId: aIdol,
      takeable: true,
      combineable: false,
      placements: [{ location: sChamber, quantity: 1 }],
      takeEffects: [[vIdolTaken, SET_OPERATOR_TYPE.ASSIGN, 'true', BOOL]],
      takeMessage:
        'You lift the Jade Idol from its pedestal. It is heavier than it looks.',
      tags: []
    }),
    api().recipes.saveRecipe(studioId, {
      id: rLight,
      worldId,
      title: 'Light the torch',
      inputs: [
        { objectId: oTorch, quantity: 1, consumed: true },
        { objectId: oFlint, quantity: 1, consumed: true }
      ],
      outputs: [
        {
          objectId: oLitTorch,
          quantity: 1,
          destination: RECIPE_OUTPUT_DESTINATION.INVENTORY
        }
      ],
      effects: [[vTorchLit, SET_OPERATOR_TYPE.ASSIGN, 'true', BOOL]],
      message: 'You strike the flint and the torch flares to life.',
      tags: []
    })
  ])

  // -- Scenes -------------------------------------------------------------
  const scene = (
    id: ElementId,
    title: string,
    children: [ELEMENT_TYPE.EVENT | ELEMENT_TYPE.JUMP, ElementId][]
  ) =>
    api().scenes.saveScene(studioId, {
      id,
      worldId,
      title,
      children,
      parent: [ELEMENT_TYPE.WORLD, null],
      tags: []
    })

  await Promise.all([
    scene(sClass, 'The Classroom', [
      [ELEMENT_TYPE.EVENT, e1],
      [ELEMENT_TYPE.EVENT, e2],
      [ELEMENT_TYPE.EVENT, e2b],
      [ELEMENT_TYPE.EVENT, e2a],
      [ELEMENT_TYPE.EVENT, e2c],
      [ELEMENT_TYPE.JUMP, jStudy]
    ]),
    scene(sStudy, "Finch's Study", [
      [ELEMENT_TYPE.EVENT, e3],
      [ELEMENT_TYPE.EVENT, e3a],
      [ELEMENT_TYPE.JUMP, jMarket]
    ]),
    scene(sMarket, 'The Market', [
      [ELEMENT_TYPE.EVENT, e4],
      [ELEMENT_TYPE.EVENT, e4b],
      [ELEMENT_TYPE.JUMP, jEntrance],
      [ELEMENT_TYPE.JUMP, jBackToStudy]
    ]),
    scene(sEntrance, 'The Temple Entrance', [
      [ELEMENT_TYPE.EVENT, e5],
      [ELEMENT_TYPE.EVENT, e5a],
      [ELEMENT_TYPE.JUMP, jLaby],
      [ELEMENT_TYPE.JUMP, jBackToMarket]
    ]),
    scene(sLaby, 'The Labyrinth', [
      [ELEMENT_TYPE.EVENT, e6],
      [ELEMENT_TYPE.EVENT, e7],
      [ELEMENT_TYPE.EVENT, e8],
      [ELEMENT_TYPE.JUMP, jChamber]
    ]),
    scene(sChamber, 'The Idol Chamber', [
      [ELEMENT_TYPE.EVENT, e9],
      [ELEMENT_TYPE.JUMP, jMuseum]
    ]),
    scene(sMuseum, 'The Museum', [[ELEMENT_TYPE.EVENT, e10]])
  ])

  // -- Jumps --------------------------------------------------------------
  const jump = (
    id: ElementId,
    sceneId: ElementId,
    to: ElementId,
    toEvent: ElementId,
    title: string,
    pos: [number, number]
  ) =>
    api().jumps.saveJump(studioId, {
      id,
      worldId,
      sceneId,
      path: [to, toEvent],
      title,
      tags: [],
      composer: { sceneMapPosX: pos[0], sceneMapPosY: pos[1] }
    })

  await Promise.all([
    jump(jStudy, sClass, sStudy, e3, "To Finch's Study", [1400, 120]),
    jump(jMarket, sStudy, sMarket, e4, 'To the Market', [880, 140]),
    jump(jEntrance, sMarket, sEntrance, e5, 'To the Temple', [600, 160]),
    jump(jBackToStudy, sMarket, sStudy, e3, "Back to Finch's Study", [600, 460]),
    jump(jLaby, sEntrance, sLaby, e6, 'Into the Labyrinth', [560, 140]),
    jump(jBackToMarket, sEntrance, sMarket, e4, 'Back to the Market', [560, 440]),
    jump(jChamber, sLaby, sChamber, e9, 'To the Idol Chamber', [800, 120]),
    jump(jMuseum, sChamber, sMuseum, e10, 'Home to the Museum', [520, 140])
  ])

  // -- Events -------------------------------------------------------------
  const event = (
    id: ElementId,
    sceneId: ElementId,
    title: string,
    nodes: Node[],
    choices: ElementId[],
    pos: [number, number],
    extra: Partial<{
      ending: boolean
      persona: [ElementId, CHARACTER_MASK_TYPE, string | undefined]
      characters: ElementId[]
    }> = {}
  ) =>
    api().events.saveEvent(studioId, {
      id,
      worldId,
      sceneId,
      title,
      type: EVENT_TYPE.CHOICE,
      content: content(nodes),
      choices,
      characters: extra.characters || [],
      images: [],
      ending: extra.ending || false,
      persona: extra.persona,
      composer: { sceneMapPosX: pos[0], sceneMapPosY: pos[1] },
      tags: []
    })

  const vargas = {
    persona: [cVargas, CHARACTER_MASK_TYPE.EXCITED, undefined] as [
      ElementId,
      CHARACTER_MASK_TYPE,
      string | undefined
    ],
    characters: [cVargas]
  }
  const finch = {
    persona: [cFinch, CHARACTER_MASK_TYPE.CHEERFUL, undefined] as [
      ElementId,
      CHARACTER_MASK_TYPE,
      string | undefined
    ],
    characters: [cFinch]
  }
  const itzel = {
    persona: [cItzel, CHARACTER_MASK_TYPE.HAPPY, undefined] as [
      ElementId,
      CHARACTER_MASK_TYPE,
      string | undefined
    ],
    characters: [cItzel]
  }

  await Promise.all([
    event(
      e1,
      sClass,
      'A Quiet Afternoon',
      [
        h2('A Quiet Afternoon'),
        p(
          t(
            'Chalk dust hangs in the afternoon light of your classroom. The last student has gone; you are packing the plaster casts back into their crate when the telephone on your desk begins to ring.'
          )
        )
      ],
      [chAnswer],
      [120, 120]
    ),
    event(
      e2,
      sClass,
      'The Call',
      [
        p(
          t(
            '“Professor — thank goodness. This is Dr. Elena Vargas, of the Museo del Jade. We believe the lost Jade Idol of K’aal is real, and hidden in a temple in the Yucatán. I can fund an expedition. Will you go?”'
          )
        ),
        p(
          t('You could '),
          inlineChoice(chAccept),
          t(' on the spot — or press her for details first. She mentions that your old colleague, '),
          charRef(cFinch),
          t(', could help you find the exact location.')
        )
      ],
      [chAccept, chAskGrant],
      [440, 120],
      { ...vargas, characters: [cVargas, cFinch] }
    ),
    event(
      e2b,
      sClass,
      'The Grant',
      [
        p(
          t(
            '“Money — of course. Forgive me, I should have led with that.” Papers rustle on her end of the line. “The board released a research grant this morning. Three hundred dollars, wired to you tonight, on top of your travel. Spend it on whatever the jungle demands.”'
          )
        ),
        p(
          t(
            'A pause. “That is everything I have, Professor. The rest is your answer.”'
          )
        )
      ],
      [chAcceptAfterGrant],
      [440, 440],
      vargas
    ),
    event(
      e2a,
      sClass,
      'Sealed with a Word',
      [
        p(
          t(
            '“Thank you.” The relief in her voice is unmistakable. “I will have a ticket waiting at the airport. Go to Mérida first — Professor Finch keeps a study off the Plaza Grande, and he has been chasing this same rumour for a decade. He is expecting you.”'
          )
        ),
        p(t('The line clicks. Outside, the school bell rings for the last time this term.'))
      ],
      [chFly],
      [800, 120],
      vargas
    ),
    event(
      e2c,
      sClass,
      'Mérida',
      [
        p(
          t(
            'Nine hours and two aircraft later, the heat of the Yucatán closes over you like a hand. A taxi carries you past limestone facades to a narrow door off the Plaza Grande, its brass plate green with age: '
          ),
          charRef(cFinch),
          t('.')
        ),
        p(t('You knock.'))
      ],
      [chKnock],
      [1120, 120],
      { characters: [cFinch] }
    ),
    event(
      e3,
      sStudy,
      'The Professor',
      [
        p(
          t(
            '“So Vargas roped you in too!” Professor Finch clears a space on a desk buried in rubbings and potsherds. “The temple is out there, all right. But its location is scattered across old sources. Gather enough, and you’ll know where to dig.”'
          )
        ),
        p(
          t(
            'A brittle codex sits on the corner of the desk — take it from the object rail on the right. And Finch himself has been at this for ten years; ask him what he has.'
          )
        )
      ],
      [chAskFinch, chToMarket],
      [200, 140],
      finch
    ),
    event(
      e3a,
      sStudy,
      'What Finch Knows',
      [
        p(
          t(
            '“Ten years of it.” He unrolls a survey map, pinning the corners with a coffee cup and a trilobite. “Three things. One: the Idol is not in a tomb, it is in a temple — a stepped pyramid, four faces, and only the north face has a door.'
          )
        ),
        p(
          t(
            'Two: the inside is a labyrinth, and the builders marked the true way with the jaguar, not the serpent. Serpents in K’aal are guardians. They do not show you the road, they eat people who take it.'
          )
        ),
        p(
          t(
            'Three —” he taps the map, “— it is a day west of the old chicle road, and no gringo finds that trailhead alone. Get a guide in the market. Ask for Itzel; she has forgotten more jungle than I ever learned.”'
          )
        )
      ],
      [chToMarket2],
      [560, 140],
      finch
    ),
    event(
      e4,
      sMarket,
      'Mercado de Mérida',
      [
        p(
          t(
            '“You’re the one chasing the Idol?” The guide grins over a stall of woven cloth. “I’m Itzel. Nobody crosses that jungle without me — or without a torch that stays lit.”'
          )
        ),
        p(
          t(
            'A resin torch lies among the market goods. Talk to Itzel and she will draw you the way; the stalls will sell you the rest.'
          )
        )
      ],
      [chTalkItzel, chBuy, chToTemple, chBackToStudy],
      [200, 160],
      itzel
    ),
    event(
      e4b,
      sMarket,
      'Not Yet Ready',
      [
        p(
          t(
            'You get as far as the edge of the market before stopping. Going into that jungle short of anything is how people are never heard from again. You take stock:'
          )
        ),
        p(
          t(
            'The location — { clues >= 2 ? "pinned down between the codex and Finch." : "still guesswork. Ask around; the codex and Finch each hold a piece." }'
          )
        ),
        p(
          t(
            'A map of the trailhead — { hasMap ? "folded in your jacket." : "you have none. Itzel will draw one if you ask her." }'
          )
        ),
        p(
          t(
            'A torch — { hasTorch ? "in your pack." : "not bought. There is one among the market goods." }'
          )
        ),
        p(
          t(
            'A striker — { hasFlint ? "in your pack." : "not bought. Itzel knows which stall sells them." }'
          )
        )
      ],
      [chBackToStalls],
      [200, 520]
    ),
    event(
      e5,
      sEntrance,
      'A Door of Darkness',
      [
        p(
          t(
            'The temple mouth breathes cold air. Beyond the threshold there is only darkness — the kind that swallows an unlit torch whole. Combine the torch and the flint from your inventory before you step inside.'
          )
        )
      ],
      [chEnterLaby, chBackToMarket],
      [200, 140]
    ),
    event(
      e5a,
      sEntrance,
      'Not Without Light',
      [
        p(
          t(
            'You take three steps in and the dark takes the fourth. It is not gloom, it is absence — the air itself feels like a held breath. Somewhere ahead, a long way down, water drips onto stone.'
          )
        ),
        p(
          t(
            'You back out into the sun. Nothing goes into that pyramid without fire: strike the flint against the torch first. If either is still sitting on a market stall, the market is half a day back down the trail.'
          )
        )
      ],
      [chBackToEntrance, chBackToMarket2],
      [200, 440]
    ),
    event(
      e6,
      sLaby,
      'A Fork in the Dark',
      [
        p(
          t('The passage forks. Your torch has { torchFuel } breaths of flame left, and the dark drinks the rest.')
        ),
        p(
          t('You take the '),
          inlineChoice(chLeft),
          t(', or follow the draught down the '),
          inlineChoice(chRight),
          t('.')
        )
      ],
      [chLeft, chRight],
      [140, 120]
    ),
    event(
      e7,
      sLaby,
      'Carved Doorways',
      [
        p(
          t('Two doorways, each carved with a god. The '),
          inlineChoice(chJaguar),
          t(' smells of open air; the '),
          inlineChoice(chSerpent),
          t(' of wet stone.')
        )
      ],
      [chJaguar, chSerpent],
      [460, 120]
    ),
    event(
      e8,
      sLaby,
      'Lost in the Dark',
      [
        p(
          t(
            'Your torch gutters, flares, and dies. The dark closes over you like water. Somewhere ahead, the Idol keeps its secret a while longer.'
          )
        )
      ],
      [],
      [460, 380],
      { ending: true }
    ),
    event(
      e9,
      sChamber,
      'The Pedestal',
      [
        p(
          t(
            'At the heart of the pyramid, on a pedestal of black stone, the Jade Idol of K’aal watches with a single carved eye. Beside it rests a ceremonial jade mask. Take both from the object rail, wear the mask, then leave the way you came.'
          )
        )
      ],
      [chLeave],
      [200, 140]
    ),
    event(
      e10,
      sMuseum,
      'Home at the Museum',
      [
        p(
          t(
            '“You actually did it.” Dr. Vargas turns the idol in the gallery light. “K’aal comes home.”'
          )
        ),
        p(
          t(
            'You came back with { funds } grant dollars to spare, and a story your students will never believe.'
          )
        )
      ],
      [],
      [240, 160],
      { ending: true, ...vargas }
    )
  ])

  // -- Choices ------------------------------------------------------------
  const choice = (id: ElementId, eventId: ElementId, title: string) =>
    api().choices.saveChoice(studioId, { id, worldId, eventId, title, tags: [] })

  await Promise.all([
    choice(chAnswer, e1, 'Answer the phone'),
    choice(chAccept, e2, 'accept the expedition'),
    choice(chAskGrant, e2, 'Ask about the grant'),
    choice(chAcceptAfterGrant, e2b, 'Accept the expedition'),
    choice(chFly, e2a, 'Fly to Mérida'),
    choice(chKnock, e2c, 'Step into the study'),
    choice(chAskFinch, e3, 'Ask Finch what he knows'),
    choice(chToMarket, e3, 'Head to the market'),
    choice(chToMarket2, e3a, 'Head to the market'),
    choice(chTalkItzel, e4, 'Talk to Itzel about the temple'),
    choice(chBuy, e4, 'Buy water and rope ($100)'),
    choice(chToTemple, e4, 'Set out for the temple'),
    choice(chBackToStudy, e4, "Go back to Finch's study"),
    choice(chBackToStalls, e4b, 'Back to the stalls'),
    choice(chEnterLaby, e5, 'Step into the labyrinth'),
    choice(chBackToEntrance, e5a, 'Back to the entrance'),
    choice(chBackToMarket, e5, 'Return to the market'),
    choice(chBackToMarket2, e5a, 'Return to the market'),
    choice(chLeft, e6, 'left passage'),
    choice(chRight, e6, 'right passage'),
    choice(chJaguar, e7, 'jaguar door'),
    choice(chSerpent, e7, 'serpent door'),
    choice(chLeave, e9, 'Leave with the idol')
  ])

  // -- Paths --------------------------------------------------------------
  const path = (
    id: ElementId,
    sceneId: ElementId,
    originId: ElementId,
    choiceId: ElementId,
    destinationId: ElementId,
    destinationType: ELEMENT_TYPE,
    title: string,
    notification?: string,
    conditionsType: PATH_CONDITIONS_TYPE = ALL
  ) =>
    api().paths.savePath(studioId, {
      id,
      worldId,
      sceneId,
      conditionsType,
      originId,
      originType: EVENT_TYPE.CHOICE,
      choiceId,
      destinationId,
      destinationType,
      title,
      notification,
      tags: []
    })

  const EVENT = ELEMENT_TYPE.EVENT,
    JUMP = ELEMENT_TYPE.JUMP

  await Promise.all([
    path(pAnswer, sClass, e1, chAnswer, e2, EVENT, 'Answer'),
    path(pAccept, sClass, e2, chAccept, e2a, EVENT, 'Accept'),
    path(
      pAskGrant,
      sClass,
      e2,
      chAskGrant,
      e2b,
      EVENT,
      'Ask about the grant',
      'Dr. Vargas wires an extra $300 to your account.'
    ),
    path(pAcceptAfterGrant, sClass, e2b, chAcceptAfterGrant, e2a, EVENT, 'Accept'),
    path(pFly, sClass, e2a, chFly, e2c, EVENT, 'Fly to Mérida'),
    path(pKnock, sClass, e2c, chKnock, jStudy, JUMP, 'Into the study'),

    path(
      pAskFinch,
      sStudy,
      e3,
      chAskFinch,
      e3a,
      EVENT,
      'Ask Finch',
      'Finch talks for twenty minutes without pausing. (+1 clue)'
    ),
    path(pToMarket, sStudy, e3, chToMarket, jMarket, JUMP, 'To market'),
    path(pToMarket2, sStudy, e3a, chToMarket2, jMarket, JUMP, 'To market'),

    path(
      pTalkItzel,
      sMarket,
      e4,
      chTalkItzel,
      e4,
      EVENT,
      'Talk to Itzel',
      'Itzel sketches the trailhead onto a map and presses it into your hand — then points out the stall that sells flint strikers.'
    ),
    path(
      pBuy,
      sMarket,
      e4,
      chBuy,
      e4,
      EVENT,
      'Buy supplies',
      'You buy a canteen of water and a coil of rope. (−$100)'
    ),
    path(pToTemple, sMarket, e4, chToTemple, jEntrance, JUMP, 'Set out'),
    path(pNotReady, sMarket, e4, chToTemple, e4b, EVENT, 'Set out (not ready)', undefined, ANY),
    path(pBackToStudy, sMarket, e4, chBackToStudy, jBackToStudy, JUMP, 'Back to Finch'),
    path(pBackToStalls, sMarket, e4b, chBackToStalls, e4, EVENT, 'Back to the stalls'),

    path(pEnterLaby, sEntrance, e5, chEnterLaby, jLaby, JUMP, 'Enter'),
    path(pNoLight, sEntrance, e5, chEnterLaby, e5a, EVENT, 'Enter (no light)'),
    path(pBackToEntrance, sEntrance, e5a, chBackToEntrance, e5, EVENT, 'Back outside'),
    path(
      pBackToMarket,
      sEntrance,
      e5,
      chBackToMarket,
      jBackToMarket,
      JUMP,
      'Back to the market'
    ),
    path(
      pBackToMarket2,
      sEntrance,
      e5a,
      chBackToMarket2,
      jBackToMarket,
      JUMP,
      'Back to the market (unlit)'
    ),

    path(
      pLeftLoop,
      sLaby,
      e6,
      chLeft,
      e6,
      EVENT,
      'Left (dead end)',
      'A dead end. You double back, and the torch burns lower.'
    ),
    path(pLeftLose, sLaby, e6, chLeft, e8, EVENT, 'Left (last breath)'),
    path(pRight, sLaby, e6, chRight, e7, EVENT, 'Right (onward)'),
    path(pJaguar, sLaby, e7, chJaguar, jChamber, JUMP, 'Jaguar door'),
    path(
      pSerpentLoop,
      sLaby,
      e7,
      chSerpent,
      e7,
      EVENT,
      'Serpent (dead end)',
      'The serpent door loops back on itself. The torch burns lower.'
    ),
    path(pSerpentLose, sLaby, e7, chSerpent, e8, EVENT, 'Serpent (last breath)'),

    // Three paths on the one Leave choice, so it is *always* open and never leaves
    // the chamber a dead end (the same one-choice-many-paths shape as the labyrinth
    // doors). The three conditions below are mutually exclusive and cover every
    // state: idol not taken, idol taken but bare-faced, idol taken and masked.
    path(pLeave, sChamber, e9, chLeave, jMuseum, JUMP, 'Leave (masked)'),
    path(
      pLeaveTry,
      sChamber,
      e9,
      chLeave,
      e9,
      EVENT,
      'Leave (unmasked)',
      'The idol will not lift. Its carved eye demands a face it knows — wear the mask.'
    ),
    path(
      pLeaveNoIdol,
      sChamber,
      e9,
      chLeave,
      e9,
      EVENT,
      'Leave (empty-handed)',
      'You have come too far to leave it. The idol still watches from its pedestal — take it first.'
    )
  ])

  // -- Effects (change state as a path is taken) --------------------------
  const effect = (
    pathId: ElementId,
    variableId: ElementId,
    op: SET_OPERATOR_TYPE,
    value: string,
    type: VARIABLE_TYPE
  ) =>
    api().effects.saveEffect(studioId, {
      id: uuid(),
      worldId,
      pathId,
      variableId,
      set: [variableId, op, value, type],
      title: '',
      tags: []
    })

  // -- Conditions (open a path only when state allows) --------------------
  const condition = (
    pathId: ElementId,
    variableId: ElementId,
    op: COMPARE_OPERATOR_TYPE,
    value: string,
    type: VARIABLE_TYPE
  ) =>
    api().conditions.saveCondition(studioId, {
      id: uuid(),
      worldId,
      pathId,
      variableId,
      compare: [variableId, op, value, type],
      title: '',
      tags: []
    })

  const IS = COMPARE_OPERATOR_TYPE.EQ,
    GTE = COMPARE_OPERATOR_TYPE.GTE,
    LT = COMPARE_OPERATOR_TYPE.LT,
    GT = COMPARE_OPERATOR_TYPE.GT,
    LTE = COMPARE_OPERATOR_TYPE.LTE,
    SET = SET_OPERATOR_TYPE.ASSIGN

  await Promise.all([
    // effects
    effect(pAskGrant, vFunds, SET_OPERATOR_TYPE.ADD, '300', NUM),
    effect(pAskFinch, vClues, SET_OPERATOR_TYPE.ADD, '1', NUM),
    effect(pAskFinch, vFinchTold, SET, 'true', BOOL),
    effect(pTalkItzel, vMetGuide, SET, 'true', BOOL),
    effect(pBuy, vFunds, SET_OPERATOR_TYPE.SUBTRACT, '100', NUM),
    effect(pBuy, vBoughtSupplies, SET, 'true', BOOL),
    effect(pLeftLoop, vTorchFuel, SET_OPERATOR_TYPE.SUBTRACT, '1', NUM),
    effect(pLeftLose, vTorchFuel, SET_OPERATOR_TYPE.SUBTRACT, '1', NUM),
    effect(pSerpentLoop, vTorchFuel, SET_OPERATOR_TYPE.SUBTRACT, '1', NUM),
    effect(pSerpentLose, vTorchFuel, SET_OPERATOR_TYPE.SUBTRACT, '1', NUM),

    // Ask-once conversations: the choice closes as soon as it has been used.
    condition(pAskFinch, vFinchTold, IS, 'false', BOOL),
    condition(pTalkItzel, vMetGuide, IS, 'false', BOOL),
    condition(pBuy, vBoughtSupplies, IS, 'false', BOOL),

    // Setting out needs the location *and* the kit. The inverse path below is
    // what stops a closed choice from reading as a broken one.
    condition(pToTemple, vClues, GTE, '2', NUM),
    condition(pToTemple, vHasMap, IS, 'true', BOOL),
    condition(pToTemple, vHasTorch, IS, 'true', BOOL),
    condition(pToTemple, vHasFlint, IS, 'true', BOOL),
    // pNotReady is ANY: open the moment a single requirement is unmet.
    condition(pNotReady, vClues, LT, '2', NUM),
    condition(pNotReady, vHasMap, IS, 'false', BOOL),
    condition(pNotReady, vHasTorch, IS, 'false', BOOL),
    condition(pNotReady, vHasFlint, IS, 'false', BOOL),

    // The labyrinth: an object gate, with a lit explanation behind it.
    condition(pNoLight, vTorchLit, IS, 'false', BOOL),

    condition(pLeftLoop, vTorchFuel, GT, '1', NUM),
    condition(pLeftLose, vTorchFuel, LTE, '1', NUM),
    condition(pSerpentLoop, vTorchFuel, GT, '1', NUM),
    condition(pSerpentLose, vTorchFuel, LTE, '1', NUM),
    // The way home opens only with the idol taken *and* the mask worn.
    condition(pLeave, vIdolTaken, IS, 'true', BOOL),
    condition(pLeave, vWearingMask, IS, 'true', BOOL),
    // Idol in hand but bare-faced — loops back with the wear-the-mask hint.
    condition(pLeaveTry, vIdolTaken, IS, 'true', BOOL),
    condition(pLeaveTry, vWearingMask, IS, 'false', BOOL),
    // Idol not taken yet — loops back so Leave is open from the moment you arrive,
    // rather than a closed choice with no path (which reads as the engine's bare
    // "Unable to return. Missing path.").
    condition(pLeaveNoIdol, vIdolTaken, IS, 'false', BOOL),

    // Object-presence gate: the labyrinth opens only once a Lit Torch is carried.
    api().objectConditions.saveObjectCondition(studioId, {
      id: uuid(),
      worldId,
      pathId: pEnterLaby,
      objectId: oLitTorch,
      location: OBJECT_LOCATION_TYPE.INVENTORY,
      compare: [COMPARE_OPERATOR_TYPE.GTE, 1],
      title: 'Carries a lit torch',
      tags: []
    })
  ])

  return world
}
