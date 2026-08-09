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
  OBJECT_LOCATION_TYPE,
  RECIPE_OUTPUT_DESTINATION,
  WORLD_TEMPLATE,
  DEFAULT_WORLD_VERSION
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
 *   take-effects · gated object placements · inline choices · generic choices ·
 *   template expressions in prose · path notifications · a win and a lose ending.
 *
 * Everything is deterministic: every element id is generated up front so choices,
 * paths, conditions, effects and object conditions can all reference one another.
 * The three character portraits and five object icons are bundled as base64 in
 * `media.ts` and written to disk through the normal SAVE_ASSET path, so the demo
 * ships its own art with no filesystem or network access at seed time.
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
 * imported (a PNG under a `.jpeg`/`.webp` name); every read site loads assets
 * through an `<img>`/`background-image`, which sniffs the content, so the picture
 * renders while the extension stays the one the read site asks for.
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
  const e1 = uuid(),
    e2 = uuid(),
    e3 = uuid(),
    e4 = uuid(),
    e5 = uuid(),
    e6 = uuid(),
    e7 = uuid(),
    e8 = uuid(),
    e9 = uuid(),
    e10 = uuid()

  // Jumps (scene -> scene)
  const jStudy = uuid(),
    jMarket = uuid(),
    jEntrance = uuid(),
    jLaby = uuid(),
    jChamber = uuid(),
    jMuseum = uuid()

  // Characters
  const cVargas = uuid(),
    cFinch = uuid(),
    cItzel = uuid()

  // Variables
  const vFunds = uuid(),
    vClues = uuid(),
    vMetGuide = uuid(),
    vTorchLit = uuid(),
    vTorchFuel = uuid(),
    vIdolTaken = uuid()

  // Objects & recipe
  const oTorch = uuid(),
    oFlint = uuid(),
    oLitTorch = uuid(),
    oCodex = uuid(),
    oIdol = uuid(),
    rLight = uuid()

  // Choices
  const chAnswer = uuid(),
    chAccept = uuid(),
    chAskGrant = uuid(),
    chAskFinch = uuid(),
    chToMarket = uuid(),
    chTalkItzel = uuid(),
    chBuy = uuid(),
    chToTemple = uuid(),
    chEnterLaby = uuid(),
    chLeft = uuid(),
    chRight = uuid(),
    chJaguar = uuid(),
    chSerpent = uuid(),
    chLeave = uuid()

  // Paths
  const pAnswer = uuid(),
    pAccept = uuid(),
    pAskGrant = uuid(),
    pAskFinch = uuid(),
    pToMarket = uuid(),
    pTalkItzel = uuid(),
    pBuy = uuid(),
    pToTemple = uuid(),
    pEnterLaby = uuid(),
    pLeftLoop = uuid(),
    pLeftLose = uuid(),
    pRight = uuid(),
    pJaguar = uuid(),
    pSerpentLoop = uuid(),
    pSerpentLose = uuid(),
    pLeave = uuid()

  const NUM = VARIABLE_TYPE.NUMBER,
    BOOL = VARIABLE_TYPE.BOOLEAN,
    ALL = PATH_CONDITIONS_TYPE.ALL

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
    objectNoRecipeMessage: 'Those two do nothing together.',
    tags: ['demo'],
    template: WORLD_TEMPLATE.ADVENTURE,
    title: 'The Jade Idol of K’aal',
    version: DEFAULT_WORLD_VERSION
  })

  // -- Assets (need the worldId) -----------------------------------------
  const aVargas = await seedAsset(
      studioId,
      worldId,
      DEMO_MEDIA.vargas,
      ASSET_KIND.CHARACTER_MASK
    ),
    aFinch = await seedAsset(
      studioId,
      worldId,
      DEMO_MEDIA.finch,
      ASSET_KIND.CHARACTER_MASK
    ),
    aItzel = await seedAsset(
      studioId,
      worldId,
      DEMO_MEDIA.itzel,
      ASSET_KIND.CHARACTER_MASK
    ),
    aTorch = await seedAsset(
      studioId,
      worldId,
      DEMO_MEDIA.torch,
      ASSET_KIND.OBJECT_IMAGE
    ),
    aFlint = await seedAsset(
      studioId,
      worldId,
      DEMO_MEDIA.flint,
      ASSET_KIND.OBJECT_IMAGE
    ),
    aLitTorch = await seedAsset(
      studioId,
      worldId,
      DEMO_MEDIA.litTorch,
      ASSET_KIND.OBJECT_IMAGE
    ),
    aCodex = await seedAsset(
      studioId,
      worldId,
      DEMO_MEDIA.codex,
      ASSET_KIND.OBJECT_IMAGE
    ),
    aIdol = await seedAsset(
      studioId,
      worldId,
      DEMO_MEDIA.idol,
      ASSET_KIND.OBJECT_IMAGE
    )

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
  await Promise.all([
    api().variables.saveVariable(studioId, {
      id: vFunds,
      worldId,
      title: 'funds',
      type: NUM,
      initialValue: '500',
      description: 'Grant dollars on hand. Shown at the end of the story.',
      tags: []
    }),
    api().variables.saveVariable(studioId, {
      id: vClues,
      worldId,
      title: 'clues',
      type: NUM,
      initialValue: '0',
      description: "Leads to the temple's location. Two are needed to set out.",
      tags: []
    }),
    api().variables.saveVariable(studioId, {
      id: vMetGuide,
      worldId,
      title: 'metGuide',
      type: BOOL,
      initialValue: 'false',
      description: 'Set when Itzel is spoken to; reveals the flint in the market.',
      tags: []
    }),
    api().variables.saveVariable(studioId, {
      id: vTorchLit,
      worldId,
      title: 'torchLit',
      type: BOOL,
      initialValue: 'false',
      description: 'Set by the torch + flint recipe.',
      tags: []
    }),
    api().variables.saveVariable(studioId, {
      id: vTorchFuel,
      worldId,
      title: 'torchFuel',
      type: NUM,
      initialValue: '3',
      description: 'Burns down on every wrong turn in the labyrinth.',
      tags: []
    }),
    api().variables.saveVariable(studioId, {
      id: vIdolTaken,
      worldId,
      title: 'idolTaken',
      type: BOOL,
      initialValue: 'false',
      description: 'Set by taking the idol; gates the way home.',
      tags: []
    })
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
      [ELEMENT_TYPE.JUMP, jStudy]
    ]),
    scene(sStudy, "Finch's Study", [
      [ELEMENT_TYPE.EVENT, e3],
      [ELEMENT_TYPE.JUMP, jMarket]
    ]),
    scene(sMarket, 'The Market', [
      [ELEMENT_TYPE.EVENT, e4],
      [ELEMENT_TYPE.JUMP, jEntrance]
    ]),
    scene(sEntrance, 'The Temple Entrance', [
      [ELEMENT_TYPE.EVENT, e5],
      [ELEMENT_TYPE.JUMP, jLaby]
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
    jump(jStudy, sClass, sStudy, e3, "To Finch's Study", [760, 120]),
    jump(jMarket, sStudy, sMarket, e4, 'To the Market', [520, 140]),
    jump(jEntrance, sMarket, sEntrance, e5, 'To the Temple', [560, 160]),
    jump(jLaby, sEntrance, sLaby, e6, 'Into the Labyrinth', [520, 140]),
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
      {
        persona: [cVargas, CHARACTER_MASK_TYPE.EXCITED, undefined],
        characters: [cVargas, cFinch]
      }
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
            'A brittle codex sits on the corner of the desk — take it from the object rail on the right. Or ask Finch what he already knows.'
          )
        )
      ],
      [chAskFinch, chToMarket],
      [200, 140],
      { persona: [cFinch, CHARACTER_MASK_TYPE.CHEERFUL, undefined], characters: [cFinch] }
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
            'A resin torch lies among the market goods. Talk to Itzel and she’ll show you where to find a flint striker.'
          )
        )
      ],
      [chTalkItzel, chBuy, chToTemple],
      [200, 160],
      { persona: [cItzel, CHARACTER_MASK_TYPE.HAPPY, undefined], characters: [cItzel] }
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
      [chEnterLaby],
      [200, 140]
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
            'At the heart of the pyramid, on a pedestal of black stone, the Jade Idol of K’aal watches with a single carved eye. Take it from the object rail, then leave the way you came.'
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
      { ending: true, persona: [cVargas, CHARACTER_MASK_TYPE.EXCITED, undefined], characters: [cVargas] }
    )
  ])

  // -- Choices ------------------------------------------------------------
  const choice = (id: ElementId, eventId: ElementId, title: string) =>
    api().choices.saveChoice(studioId, { id, worldId, eventId, title, tags: [] })

  await Promise.all([
    choice(chAnswer, e1, 'Answer the phone'),
    choice(chAccept, e2, 'accept the expedition'),
    choice(chAskGrant, e2, 'Ask about the grant'),
    choice(chAskFinch, e3, 'Ask Finch what he knows'),
    choice(chToMarket, e3, 'Head to the market'),
    choice(chTalkItzel, e4, 'Talk to Itzel about the temple'),
    choice(chBuy, e4, 'Buy water and rope'),
    choice(chToTemple, e4, 'Set out for the temple'),
    choice(chEnterLaby, e5, 'Step into the labyrinth'),
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
    notification?: string
  ) =>
    api().paths.savePath(studioId, {
      id,
      worldId,
      sceneId,
      conditionsType: ALL,
      originId,
      originType: EVENT_TYPE.CHOICE,
      choiceId,
      destinationId,
      destinationType,
      title,
      notification,
      tags: []
    })

  await Promise.all([
    path(pAnswer, sClass, e1, chAnswer, e2, ELEMENT_TYPE.EVENT, 'Answer'),
    path(pAccept, sClass, e2, chAccept, jStudy, ELEMENT_TYPE.JUMP, 'Accept'),
    path(
      pAskGrant,
      sClass,
      e2,
      chAskGrant,
      jStudy,
      ELEMENT_TYPE.JUMP,
      'Ask about the grant',
      'Dr. Vargas wires an extra $300 to your account.'
    ),
    path(
      pAskFinch,
      sStudy,
      e3,
      chAskFinch,
      e3,
      ELEMENT_TYPE.EVENT,
      'Ask Finch',
      'Finch sketches a map fragment from memory. (+1 clue)'
    ),
    path(pToMarket, sStudy, e3, chToMarket, jMarket, ELEMENT_TYPE.JUMP, 'To market'),
    path(
      pTalkItzel,
      sMarket,
      e4,
      chTalkItzel,
      e4,
      ELEMENT_TYPE.EVENT,
      'Talk to Itzel',
      'Itzel marks the trailhead — and points out a flint striker in the next stall.'
    ),
    path(
      pBuy,
      sMarket,
      e4,
      chBuy,
      e4,
      ELEMENT_TYPE.EVENT,
      'Buy supplies',
      'You stock up on water and rope. (−$100)'
    ),
    path(
      pToTemple,
      sMarket,
      e4,
      chToTemple,
      jEntrance,
      ELEMENT_TYPE.JUMP,
      'Set out'
    ),
    path(
      pEnterLaby,
      sEntrance,
      e5,
      chEnterLaby,
      jLaby,
      ELEMENT_TYPE.JUMP,
      'Enter'
    ),
    path(
      pLeftLoop,
      sLaby,
      e6,
      chLeft,
      e6,
      ELEMENT_TYPE.EVENT,
      'Left (dead end)',
      'A dead end. You double back, and the torch burns lower.'
    ),
    path(pLeftLose, sLaby, e6, chLeft, e8, ELEMENT_TYPE.EVENT, 'Left (last breath)'),
    path(pRight, sLaby, e6, chRight, e7, ELEMENT_TYPE.EVENT, 'Right (onward)'),
    path(pJaguar, sLaby, e7, chJaguar, jChamber, ELEMENT_TYPE.JUMP, 'Jaguar door'),
    path(
      pSerpentLoop,
      sLaby,
      e7,
      chSerpent,
      e7,
      ELEMENT_TYPE.EVENT,
      'Serpent (dead end)',
      'The serpent door loops back on itself. The torch burns lower.'
    ),
    path(
      pSerpentLose,
      sLaby,
      e7,
      chSerpent,
      e8,
      ELEMENT_TYPE.EVENT,
      'Serpent (last breath)'
    ),
    path(pLeave, sChamber, e9, chLeave, jMuseum, ELEMENT_TYPE.JUMP, 'Leave')
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

  await Promise.all([
    effect(pAskGrant, vFunds, SET_OPERATOR_TYPE.ADD, '300', NUM),
    effect(pAskFinch, vClues, SET_OPERATOR_TYPE.ADD, '1', NUM),
    effect(pTalkItzel, vMetGuide, SET_OPERATOR_TYPE.ASSIGN, 'true', BOOL),
    effect(pBuy, vFunds, SET_OPERATOR_TYPE.SUBTRACT, '100', NUM),
    effect(pLeftLoop, vTorchFuel, SET_OPERATOR_TYPE.SUBTRACT, '1', NUM),
    effect(pLeftLose, vTorchFuel, SET_OPERATOR_TYPE.SUBTRACT, '1', NUM),
    effect(pSerpentLoop, vTorchFuel, SET_OPERATOR_TYPE.SUBTRACT, '1', NUM),
    effect(pSerpentLose, vTorchFuel, SET_OPERATOR_TYPE.SUBTRACT, '1', NUM),

    condition(pToTemple, vClues, COMPARE_OPERATOR_TYPE.GTE, '2', NUM),
    condition(pLeftLoop, vTorchFuel, COMPARE_OPERATOR_TYPE.GT, '1', NUM),
    condition(pLeftLose, vTorchFuel, COMPARE_OPERATOR_TYPE.LTE, '1', NUM),
    condition(pSerpentLoop, vTorchFuel, COMPARE_OPERATOR_TYPE.GT, '1', NUM),
    condition(pSerpentLose, vTorchFuel, COMPARE_OPERATOR_TYPE.LTE, '1', NUM),
    condition(pLeave, vIdolTaken, COMPARE_OPERATOR_TYPE.EQ, 'true', BOOL),

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
