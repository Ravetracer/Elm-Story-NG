import type { InterfaceTextOverrides } from '../lib/interfaceText'

export enum ELEMENT_TYPE {
  CHARACTER = 'CHARACTER',
  CHOICE = 'CHOICE',
  CONDITION = 'CONDITION',
  EFFECT = 'EFFECT',
  EVENT = 'EVENT',
  FOLDER = 'FOLDER',
  INPUT = 'INPUT',
  JUMP = 'JUMP',
  OBJECT = 'OBJECT',
  PATH = 'PATH',
  RECIPE = 'RECIPE',
  SCENE = 'SCENE',
  STUDIO = 'STUDIO',
  VARIABLE = 'VARIABLE',
  WORLD = 'WORLD'
}

export enum CHOICE_PRESENTATION {
  INLINE = 'INLINE',
  LIST = 'LIST',
  MODAL = 'MODAL'
}

/**
 * How a live event enters the story stream. Absent means FADE, the behaviour
 * every pre-0.8.0 storyworld already had. NONE is an explicit author opt-out,
 * distinct from the player's ENGINE_MOTION.REDUCED, which suppresses animation
 * whatever the author chose.
 */
export enum ENGINE_TRANSITION {
  NONE = 'NONE',
  FADE = 'FADE',
  SLIDE = 'SLIDE'
}

/**
 * Where the reading column sits in the window on a wide screen. CENTER is the
 * unset default — how every pre-feature storyworld already laid out.
 */
export enum STREAM_ALIGNMENT {
  LEFT = 'LEFT',
  CENTER = 'CENTER',
  RIGHT = 'RIGHT'
}

/**
 * An author's overrides of the base theme's colours, each a CSS colour string.
 * Every field is optional and layers on top of the player's chosen theme; the
 * engine applies them as inline custom properties on `#runtime` at runtime.
 */
export interface WorldThemeColors {
  background?: string
  text?: string
  accent?: string
}

export enum VARIABLE_SCOPE {
  WORLD = 'WORLD',
  SCENE = 'SCENE'
}

/** Where an object condition looks for its object. */
export enum OBJECT_LOCATION_TYPE {
  INVENTORY = 'INVENTORY',
  CURRENT_SCENE = 'CURRENT_SCENE',
  SCENE = 'SCENE'
}

export enum RECIPE_OUTPUT_DESTINATION {
  INVENTORY = 'INVENTORY',
  CURRENT_SCENE = 'CURRENT_SCENE'
}

/**
 * Where a wearable object sits on the body — the paperdoll's anchor points and the
 * key the engine's `wear` enforces one-item-per-slot against. Mirrors the editor's
 * `EQUIP_SLOT`; optional on an object, so a wearable with no slot is still wearable
 * but claims no anchor and does not displace anything.
 */
export enum EQUIP_SLOT {
  HEAD = 'HEAD',
  FACE = 'FACE',
  NECK = 'NECK',
  BODY = 'BODY',
  HANDS = 'HANDS',
  FEET = 'FEET',
  HELD = 'HELD'
}

/**
 * The inventory's key in the one location space shared with scene ids. Scene ids
 * are uuids, so it cannot collide; it follows the same convention as
 * `INITIAL_LIVE_ENGINE_EVENT_ORIGIN_KEY` and `AUTO_ENGINE_BOOKMARK_KEY`.
 */
export const INVENTORY_LOCATION_KEY = '___inventory___'

export enum COMPARE_OPERATOR_TYPE {
  EQ = '=',
  NE = '!=',
  GTE = '>=',
  GT = '>',
  LT = '<',
  LTE = '<='
}

export enum SET_OPERATOR_TYPE {
  ASSIGN = '=',
  ADD = '+',
  SUBTRACT = '-',
  MULTIPLY = '*',
  DIVIDE = '/'
}

export enum EVENT_TYPE {
  CHOICE = 'CHOICE',
  INPUT = 'INPUT',
  JUMP = 'JUMP'
}

export enum VARIABLE_TYPE {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  IMAGE = 'IMAGE',
  URL = 'URL'
}

export type StudioId = string
export type WorldId = string
export type ElementId = string

export type WorldChildRefs = Array<
  [ELEMENT_TYPE.FOLDER | ELEMENT_TYPE.SCENE, ElementId]
>

export type FolderParentRef = [
  ELEMENT_TYPE.WORLD | ELEMENT_TYPE.FOLDER,
  ElementId | null
]

export type FolderChildRefs = Array<
  [ELEMENT_TYPE.FOLDER | ELEMENT_TYPE.SCENE, ElementId]
>

export type SceneParentRef = [
  ELEMENT_TYPE.WORLD | ELEMENT_TYPE.FOLDER,
  ElementId | null
]

export type SceneChildRefs = Array<
  [ELEMENT_TYPE.EVENT | ELEMENT_TYPE.JUMP, ElementId]
>

export interface RootData {
  children: WorldChildRefs
  copyright?: string
  description?: string
  designer: string
  engine: string
  id: string
  jump: string | null
  schema: string
  studioId: StudioId
  studioTitle: string
  tags: string[]
  title: string
  updated: number
  version: string
  website?: string
}

export enum CHARACTER_MASK_TYPE {
  // max(d,e)
  EXCITED = 'EXCITED', // [+1.00, +1.00]
  TENSE = 'TENSE', // [-1.00, +1.00]
  LIVELY = 'LIVELY', // [+0.75, +0.75]
  NERVOUS = 'NERVOUS', // [-0.75, +0.75]
  CHEERFUL = 'CHEERFUL', // [+0.50, +0.50]
  IRRITATED = 'IRRITATED', // [-0.50, +0.50]
  HAPPY = 'HAPPY', // [+0.25, +0.25]
  ANNOYED = 'ANNOYED', // [-0.25, +0.25]

  NEUTRAL = 'NEUTRAL', // [ 0.00,  0.00]

  RELAXED = 'RELAXED', // [+0.25, -0.25]
  BORED = 'BORED', // [-0.25, -0.25]
  CAREFREE = 'CAREFREE', // [+0.50, -0.50]
  WEARY = 'WEARY', // [-0.50, -0.50]
  CALM = 'CALM', // [+0.75, -0.75]
  GLOOMY = 'GLOOMY', // [-0.75, -0.75]
  SERENE = 'SERENE', // [+1.00, -1.00]
  SAD = 'SAD' // [-1.00, -1.00]
  // min(d,e)
}

export enum CHARACTER_PRONOUN_TYPES {
  SHE = 'SHE',
  HER = 'HER',
  HERS = 'HERS',
  HERSELF = 'HERSELF',
  HE = 'HE',
  HIM = 'HIM',
  HIS = 'HIS',
  HIMSELF = 'HIMSELF',
  THEY = 'THEY',
  THEM = 'THEM',
  THEIRS = 'THEIRS',
  THEMSELF = 'THEMSELF',
  ZE = 'ZE',
  HIR = 'HIR',
  ZIR = 'ZIR',
  HIRS = 'HIRS',
  ZIRS = 'ZIRS',
  HIRSELF = 'HIRSELF',
  ZIRSELF = 'ZIRSELF'
}

export interface CharacterMask {
  active: boolean
  assetId?: string // the location will change, but keep asset ID consistent
  type: CHARACTER_MASK_TYPE
}

// tuple: [uuid, ...]
export type CharacterRef = [string, string | CHARACTER_PRONOUN_TYPES]

export type CharacterRefs = Array<CharacterRef>

export interface CharacterData {
  description?: string
  id: ElementId
  masks: CharacterMask[]
  refs: CharacterRefs
  tags: string[]
  title: string
  updated: number
}

export interface CharacterCollection {
  [characterId: string]: CharacterData
}

export interface ChoiceData {
  id: ElementId
  eventId: ElementId
  tags: string[]
  title: string
  updated: number
}

export interface ChoiceCollection {
  [choiceId: string]: ChoiceData
}

export interface ConditionData {
  compare: [ElementId, COMPARE_OPERATOR_TYPE, string, VARIABLE_TYPE]
  id: ElementId
  pathId: ElementId
  tags: string[]
  title: string
  updated: number
  variableId: ElementId
}

export interface ConditionCollection {
  [conditionId: string]: ConditionData
}

export interface EffectData {
  id: ElementId
  pathId: ElementId
  set: [ElementId, SET_OPERATOR_TYPE, string, VARIABLE_TYPE]
  tags: string[]
  title: string
  updated: number
  variableId: string
}

export interface EffectCollection {
  [effectId: string]: EffectData
}

export type EventCharacterPersona = [
  ElementId,
  CHARACTER_MASK_TYPE,
  string | undefined
] // [characterId, mask, reference ID]

export interface EventData {
  audio?: AudioProfile
  characters: ElementId[]
  choices: ElementId[]
  content: string
  composer?: {
    sceneMapPosX?: number
    sceneMapPosY?: number
  }
  ending: boolean
  images: string[]
  id: ElementId
  input?: ElementId // variable ID
  persona?: EventCharacterPersona
  sceneId: ElementId
  tags: string[]
  title: string
  type: EVENT_TYPE
  updated: number
}

export interface EventCollection {
  [eventId: string]: EventData
}

export interface FolderData {
  children: FolderChildRefs
  id: ElementId
  parent: FolderParentRef
  tags: string[]
  title: string
  updated: number
}

export interface FolderCollection {
  [folderId: string]: FolderData
}

export interface InputData {
  eventId: ElementId
  id: ElementId
  tags: string[]
  title: string
  updated: number
  variableId?: ElementId
}

export interface InputCollection {
  [choiceId: string]: InputData
}

export interface JumpData {
  composer?: {
    sceneMapPosX?: number
    sceneMapPosY?: number
  }
  id: ElementId
  path: [ElementId?, ElementId?]
  sceneId?: ElementId
  tags: string[]
  title: string
  updated: number
}

export interface JumpCollection {
  [jumpId: string]: JumpData
}

export enum PATH_CONDITIONS_TYPE {
  ALL = 'ALL',
  ANY = 'ANY'
}

export interface PathData {
  choiceId?: ElementId
  conditionsType: PATH_CONDITIONS_TYPE
  destinationId: ElementId
  destinationType: ELEMENT_TYPE
  id: ElementId
  inputId?: ElementId
  originId: ElementId
  originType: ELEMENT_TYPE | EVENT_TYPE
  sceneId: ElementId
  tags: string[]
  title: string
  updated: number
}

export interface PathCollection {
  [pathId: string]: PathData
}

export type AudioProfile = [string, boolean] // asset_id, looping

export interface SceneData {
  audio?: AudioProfile
  children: SceneChildRefs
  composer?: {
    sceneMapTransformX?: number
    sceneMapTransformY?: number
    sceneMapTransformZoom?: number
  }
  id: ElementId
  parent: SceneParentRef
  tags: string[]
  title: string
  triggers?: EngineTriggerData[]
  updated: number
}

export interface SceneCollection {
  [sceneId: string]: SceneData
}

export interface VariableData {
  id: ElementId
  initialValue: string
  tags: string[]
  title: string
  type: VARIABLE_TYPE
  updated: number
}

export interface VariableCollection {
  [variableId: string]: VariableData
}

export interface WorldDataJSON {
  _: RootData
  characters: CharacterCollection
  choices: ChoiceCollection
  conditions: ConditionCollection
  effects: EffectCollection
  events: EventCollection
  folders: FolderCollection
  inputs: InputCollection
  jumps: JumpCollection
  paths: PathCollection
  scenes: SceneCollection
  variables: VariableCollection
}

export enum ENGINE_THEME {
  BOOK = 'BOOK',
  CONSOLE = 'CONSOLE'
}

/** A bundled 9-slice game-UI skin; mirrors the editor's `ENGINE_SKIN`. */
export enum ENGINE_SKIN {
  MEDIEVAL = 'MEDIEVAL',
  SCIFI = 'SCIFI'
}

export enum ENGINE_FONT {
  SANS = 'SANS',
  SERIF = 'SERIF'
}

export enum ENGINE_MOTION {
  FULL = 'FULL',
  REDUCED = 'REDUCED'
}

export enum ENGINE_SIZE {
  DEFAULT = 'DEFAULT',
  LARGE = 'LARGE'
}

export enum ENGINE_DEVTOOLS_LIVE_EVENT_TYPE {
  OPEN_EVENT = 'OPEN_EVENT',
  OPEN_SCENE = 'OPEN_SCENE',
  RESET = 'RESET',
  TOGGLE_CHARACTERS = 'TOGGLE_CHARACTERS',
  TOGGLE_EXPRESSIONS = 'TOGGLE_EXPRESSIONS',
  TOGGLE_BLOCKED_CHOICES = 'TOGGLE_BLOCKED_CHOICES',
  TOGGLE_XRAY = 'TOGGLE_XRAY',
  TOGGLE_MUTED = 'TOGGLE_MUTED',
  MUTE = 'MUTE',
  GET_ASSET_URL = 'GET_ASSET_URL',
  RETURN_ASSET_URL = 'RETURN_ASSET_URL',
  GET_EVENT_DATA = 'GET_EVENT_DATA',
  RETURN_EVENT_DATA = 'RETURN_EVENT_DATA'
}

export enum ENGINE_DEVTOOLS_LIVE_EVENTS {
  COMPOSER_TO_ENGINE = 'composer:engine:devtools:event',
  ENGINE_TO_COMPOSER = 'engine:composer:devtools:event'
}

export interface EngineDevToolsLiveEvent {
  eventType: ENGINE_DEVTOOLS_LIVE_EVENT_TYPE
  eventId?: ElementId
  scene?: {
    id?: ElementId
    title?: string
  }
  event?: {
    title?: string
    sceneId?: ElementId
    sceneTitle?: string
  }
  muteFrom?: 'DEVTOOLS' | 'AUDIO_PROFILE'
  asset?: {
    id?: string
    for?: 'SCENE' | 'EVENT' | 'TRIGGER'
    url?: string
    exists?: boolean
    ext?: 'jpeg' | 'webp' | 'mp3'
  }
}

export interface EngineBookmarkData {
  id: string // or AUTO_ENGINE_BOOKMARK_KEY
  title: string
  liveEventId: ElementId | undefined
  updated: number
  version: string
  worldId: WorldId
}

export interface EngineBookmarkCollection {
  [bookmarkId: ElementId | '___auto___']: EngineBookmarkData
}

export interface EngineCharacterData {
  id: ElementId
  masks: CharacterMask[]
  refs: CharacterRefs
  title: string
  worldId: WorldId
}

export interface EngineCharacterCollection {
  [characterId: ElementId]: EngineCharacterData
}

export interface EngineChoiceData {
  id: ElementId
  eventId: ElementId
  title: string
  worldId: WorldId
}

export interface EngineChoiceCollection {
  [choiceId: ElementId]: EngineChoiceData
}

export interface EngineConditionData {
  compare: [ElementId, COMPARE_OPERATOR_TYPE, string, VARIABLE_TYPE]
  id: ElementId
  pathId: ElementId
  variableId: ElementId
  worldId: WorldId
}

export interface EngineConditionCollection {
  [conditionId: ElementId]: EngineConditionData
}

export interface EngineEffectData {
  id: ElementId
  pathId: ElementId
  set: [ElementId, SET_OPERATOR_TYPE, string, VARIABLE_TYPE]
  variableId: ElementId
  worldId: WorldId
}

export interface EngineEffectCollection {
  [effectId: ElementId]: EngineEffectData
}

export interface EngineEventData {
  audio?: AudioProfile
  characters: ElementId[]
  choicePresentation?: CHOICE_PRESENTATION
  choices: ElementId[]
  content: string
  ending: boolean
  id: ElementId
  images: string[]
  input?: ElementId
  persona?: EventCharacterPersona
  sceneId: ElementId
  type: EVENT_TYPE
  worldId: WorldId
}

export interface EngineEventCollection {
  [eventId: ElementId]: EngineEventData
}

export type VariableCompare = [
  ElementId,
  COMPARE_OPERATOR_TYPE,
  string,
  VARIABLE_TYPE
]

export type VariableSet = [ElementId, SET_OPERATOR_TYPE, string, VARIABLE_TYPE]

/** The evaluable core of an object condition, shared by path and placement gates. */
export type ObjectCompare = {
  objectId: ElementId
  location: OBJECT_LOCATION_TYPE
  sceneId?: ElementId
  compare: [COMPARE_OPERATOR_TYPE, number]
}

export interface ObjectPlacement {
  /** a scene id, or INVENTORY_LOCATION_KEY */
  location: ElementId
  quantity: number
  conditionsType?: PATH_CONDITIONS_TYPE
  variableConditions?: VariableCompare[]
  objectConditions?: ObjectCompare[]
}

export interface RecipeInput {
  objectId: ElementId
  quantity: number
  consumed: boolean
}

export interface RecipeOutput {
  objectId: ElementId
  quantity: number
  destination: RECIPE_OUTPUT_DESTINATION
}

export interface EngineObjectData {
  assetId?: string
  combineable: boolean
  description: string
  id: ElementId
  noRecipeMessage?: string
  placements: ObjectPlacement[]
  stackedAssetId?: string
  stackedTitle?: string
  takeable: boolean
  /** applied when the player picks this up; see WorldObject.takeEffects */
  takeEffects?: VariableSet[]
  takeMessage?: string
  /** whether the object can be worn/equipped; see WorldObject.wearable */
  wearable?: boolean
  /** where this sits on the body when worn; see WorldObject.slot and EQUIP_SLOT */
  slot?: EQUIP_SLOT
  /** applied when the player wears this */
  wearEffects?: VariableSet[]
  /** applied when the player removes this */
  removeEffects?: VariableSet[]
  wearMessage?: string
  removeMessage?: string
  title: string
  worldId: WorldId
}

export interface EngineObjectCollection {
  [objectId: ElementId]: EngineObjectData
}

export interface EngineRecipeData {
  effects?: VariableSet[]
  id: ElementId
  inputs: RecipeInput[]
  message?: string
  outputs: RecipeOutput[]
  worldId: WorldId
}

export interface EngineRecipeCollection {
  [recipeId: ElementId]: EngineRecipeData
}

export interface EngineObjectConditionData {
  compare: [COMPARE_OPERATOR_TYPE, number]
  id: ElementId
  location: OBJECT_LOCATION_TYPE
  objectId: ElementId
  pathId: ElementId
  sceneId?: ElementId
  worldId: WorldId
}

export interface EngineObjectConditionCollection {
  [conditionId: ElementId]: EngineObjectConditionData
}

/**
 * Signed changes to what is where, keyed location then object.
 *
 * A **delta**, not a census: what a location holds is derived on read from the
 * object's authored placement, whose gate is re-evaluated each time, plus this
 * number, clamped at zero. That is what lets a gate turning true mid-play reveal an
 * object with no write at all, and it keeps a pristine world storing nothing.
 */
export interface EngineObjectDeltaCollection {
  [location: string]: { [objectId: string]: number }
}

export interface EngineLiveEventStateData {
  title: string
  type: VARIABLE_TYPE
  value: string
  worldId: WorldId
}

export interface EngineLiveEventStateCollection {
  [variableId: ElementId]: EngineLiveEventStateData
}

export type EngineLiveEventLocationData = [ElementId?, ElementId?] // scene, passage

export enum ENGINE_LIVE_EVENT_TYPE {
  GAME_OVER = 'GAME_OVER',
  CHOICE = 'CHOICE',
  CHOICE_LOOPBACK = 'CHOICE_LOOPBACK',
  INITIAL = 'INITIAL',
  INPUT = 'INPUT',
  INPUT_LOOPBACK = 'INPUT_LOOPBACK',
  JUMP = 'JUMP',
  /**
   * **Reserved, and deliberately not written.** `DESIGN.md` §5 had taking and
   * combining append a live event of their own; they update the one the player is
   * on instead and narrate through `messages`, because an appended event carrying
   * the same `destination` drew the whole event a second time and left a stale
   * twin whose choices could still be clicked — throwing the take away. See
   * `useObjectActions`.
   *
   * The members stay because they are named in `transport/types/0.8.0.ts`, which
   * describes JSON already on disk, and because a save written by an earlier
   * 0.8.0 build can still contain them. Nothing produces them now.
   */
  OBJECT_COMBINE = 'OBJECT_COMBINE',
  OBJECT_TAKE = 'OBJECT_TAKE',
  RESTART = 'RESTART'
}

export type EngineLiveEventResult = {
  id?: ElementId
  value: string
}

/**
 * Why a line of object text is in the stream, which is the only thing that
 * distinguishes them once they are sitting in the same column as the prose.
 *
 * `NARRATION` is what an action *did* — a take message, a recipe's message, the
 * refusal when nothing combines, or the notification on a path that was crossed.
 * `INSPECTION` is what an object *is*, printed when the player selects it in the
 * rail. They are styled apart because they are read differently: narration is a
 * beat of the story, an inspection is the player turning something over in their
 * hands.
 *
 * A path notification is deliberately **not** a third member. The distinction this
 * enum draws is how a line is *read*, not where it came from, and a notification is
 * read as exactly what NARRATION describes. A member per source would multiply the
 * styling without telling the reader anything.
 */
export enum ENGINE_LIVE_EVENT_MESSAGE_TYPE {
  NARRATION = 'NARRATION',
  INSPECTION = 'INSPECTION',
  /**
   * A path's notification — the one line the author gave a transition.
   *
   * A member of its own not because of where it came from but because of where it
   * is *read*: above the arriving event's prose rather than below it, which is
   * the whole distinction this enum draws. A transition happened on the way in,
   * so a reader meets it before the place it brought them to; the two members
   * above are things that happen once the player is already there.
   */
  TRANSITION = 'TRANSITION'
}

export interface EngineLiveEventMessageData {
  text: string
  type: ENGINE_LIVE_EVENT_MESSAGE_TYPE
}

export interface EngineLiveEventData {
  // TODO: may need to change to tuple with id and type
  id: ElementId // or INITIAL_ENGINE_EVENT_ORIGIN_KEY
  destination: ElementId // passage ID
  /**
   * What the objects said, in the order they said it, on the event where it
   * happened. Rendered by `Event` beneath the prose, which is what puts an object
   * beat in the reading flow rather than in the panel.
   *
   * Absent on every live event written before this shipped, and absent means
   * "nothing was said" — so an old save needs no migration, like `objects`.
   */
  messages?: EngineLiveEventMessageData[]
  next?: ElementId // event ID
  /**
   * Absent on every live event written before 0.8.0, and absent means "no
   * deltas" — so an old save reads as a pristine world and needs no migration.
   * `engine/src/lib/db/v12.ts` exists for the new definition tables, not for this.
   */
  objects?: EngineObjectDeltaCollection
  /**
   * Ids of the objects the player is currently wearing. Absent on every live event
   * written before wearables shipped, and absent means "nothing worn" — so an old
   * save needs no migration, like `objects` and `messages`.
   */
  worn?: ElementId[]
  origin?: ElementId // passage ID or INITIAL_ENGINE_EVENT_ORIGIN_KEY
  prev?: ElementId // event ID
  result?: EngineLiveEventResult
  state: EngineLiveEventStateCollection
  type: ENGINE_LIVE_EVENT_TYPE
  updated: number
  version: string
  worldId: WorldId
}

export interface EngineLiveEventCollection {
  [liveEventId: ElementId | '___initial___']: EngineLiveEventData
}

export interface EngineInputData {
  id: ElementId
  eventId: ElementId
  variableId?: ElementId
  worldId: WorldId
}

export interface EngineInputCollection {
  [inputId: ElementId]: EngineInputData
}

export interface EngineJumpData {
  id: ElementId
  path: [ElementId?, ElementId?]
  sceneId?: ElementId
  worldId: WorldId
}

export interface EngineJumpCollection {
  [jumpId: ElementId]: EngineJumpData
}

export interface EnginePathData {
  choiceId?: ElementId
  conditionsType: PATH_CONDITIONS_TYPE
  destinationId: ElementId
  destinationType: ELEMENT_TYPE
  id: ElementId
  inputId?: ElementId
  notification?: string
  originId: ElementId
  originType: ELEMENT_TYPE | EVENT_TYPE
  sceneId: ElementId
  worldId: WorldId
}

export interface EnginePathCollection {
  [pathId: string]: EnginePathData
}

/**
 * A scene trigger: fire an action on the rising edge of a variable condition,
 * without the player taking a path. v1's only action is a one-shot `sound`.
 *
 * `compare` is one or more of the same tuple a path condition uses, folded by
 * `conditionsType` (ALL default). `fireOnEntry` also fires the trigger on scene
 * entry when the condition already holds. Evaluated by `triggerFires` in
 * `lib/state.ts`; see `dev-doc/scene-triggers.md`.
 */
export interface EngineTriggerData {
  id: ElementId
  compare: VariableCompare[]
  conditionsType?: PATH_CONDITIONS_TYPE
  fireOnEntry?: boolean
  sound: ElementId
}

export interface EngineSceneData {
  audio?: AudioProfile
  children: SceneChildRefs
  id: ElementId
  triggers?: EngineTriggerData[]
  worldId: WorldId
}

export interface EngineSceneCollection {
  [sceneId: ElementId]: EngineSceneData
}

export interface EngineSettingsData {
  id: string // or DEFAULT_ENGINE_SETTINGS_KEY
  theme: ENGINE_THEME
  font: ENGINE_FONT
  size: ENGINE_SIZE
  motion: ENGINE_MOTION
  muted: boolean
  worldId: WorldId
}

export interface EngineSettingsCollection {
  [settingsId: ElementId]: EngineSettingsData
}

export interface EngineVariableData {
  id: ElementId
  initialValue: string
  /** absent means WORLD; SCENE resets to initialValue on entry to scopeId */
  scope?: VARIABLE_SCOPE
  scopeId?: ElementId
  title: string
  type: VARIABLE_TYPE
  worldId: WorldId
}

export interface EngineVariableCollection {
  [variableId: ElementId]: EngineVariableData
}

export interface EngineWorldMeta {
  studioId: StudioId
  worldId: WorldId
}

export interface EngineWorldData {
  children: WorldChildRefs
  choicePresentation?: CHOICE_PRESENTATION
  /** How a live event enters the stream. Absent means FADE. */
  transition?: ENGINE_TRANSITION
  /** Where the reading column sits on a wide screen. Absent means CENTER. */
  streamAlignment?: STREAM_ALIGNMENT
  /**
   * The author's locked base palette. Absent means the player chooses; set means
   * the storyworld locks to it and the player's theme toggle is hidden.
   */
  theme?: ENGINE_THEME
  /** Author overrides of the base theme's colours, applied on top of it. */
  themeColors?: WorldThemeColors
  /** A bundled 9-slice game-UI skin; absent means the flat themed chrome. */
  skin?: ENGINE_SKIN
  copyright?: string
  coverAssetId?: string
  /** ASSET_KIND.WORLD_BACKGROUND. Filled behind the reading column. */
  backgroundAssetId?: string
  description?: string
  designer: string
  engine: string
  id: WorldId
  /**
   * The author's words for the engine's own, sparse and keyed by
   * `INTERFACE_TEXT_KEY`. Absent means the storyteller speaks English. See
   * `lib/interfaceText.ts` for why this is per storyworld rather than a language
   * the player picks.
   */
  interfaceText?: InterfaceTextOverrides
  jump: ElementId
  /** the storyteller's fallback when two objects have no matching recipe */
  objectNoRecipeMessage?: string
  schema: string
  studioId: StudioId
  studioTitle: string
  tags?: []
  title: string
  updated: number
  version: string
  website?: string
}

export interface EngineWorldCollection {
  [worldId: WorldId]: EngineWorldData
}

export interface ESGEngineCollectionData {
  _: EngineWorldData
  characters: EngineCharacterCollection
  choices: EngineChoiceCollection
  conditions: EngineConditionCollection
  effects: EngineEffectCollection
  events: EngineEventCollection
  inputs: EngineInputCollection
  jumps: EngineJumpCollection
  // characterRelationships is deliberately absent — authoring metadata, never
  // compiled into what the storyteller loads
  objectConditions: EngineObjectConditionCollection
  objects: EngineObjectCollection
  paths: EnginePathCollection
  recipes: EngineRecipeCollection
  scenes: EngineSceneCollection
  variables: EngineVariableCollection
  worlds: EngineWorldCollection
}
