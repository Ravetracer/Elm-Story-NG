import type { InterfaceTextOverrides } from '../../engine/src/lib/interfaceText'

export enum PLATFORM_TYPE {
  WINDOWS = 'win32',
  MACOS = 'darwin',
  LINUX = 'linux'
}

export enum WORLD_EXPORT_TYPE {
  JSON = 'JSON',
  PWA = 'PWA',
  // A single .zip carrying the world JSON plus its assets — the portable bundle
  // that round-trips between the desktop and web builds. See lib/worldZip.ts.
  ZIP = 'ZIP'
}

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

export enum WORLD_TEMPLATE {
  ADVENTURE = 'ADVENTURE',
  OPEN_WORLD = 'OPEN_WORLD'
}

// The version a newly created storyworld starts at — its own authored version
// (World.version), not the app release or the transport schema. Every new world
// is created through saveStarterContent, so this is its single source.
export const DEFAULT_WORLD_VERSION = '0.0.1'

export enum VARIABLE_TYPE {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  IMAGE = 'IMAGE',
  URL = 'URL'
}

export enum COMPARE_OPERATOR_TYPE {
  EQ = '=', // equal to
  NE = '!=', // not equal to
  GTE = '>=', // greater than or equal to
  GT = '>', // greater than
  LT = '<', // less than
  LTE = '<=' // less than or equal to
}

export enum SET_OPERATOR_TYPE {
  ASSIGN = '=',
  ADD = '+',
  SUBTRACT = '-',
  MULTIPLY = '*',
  DIVIDE = '/'
}

export type StudioId = string
export type WorldId = string
export type ElementId = string

export interface WorldState {
  [variableId: string]: {
    title: string
    type: VARIABLE_TYPE
    initialValue: string
    currentValue: string
  }
}

export interface Element {
  id?: ElementId
  title: string
  tags: string[] | []
  updated?: number // UTC timestamp
  composer?: {
    // SceneMap transform
    sceneMapTransformX?: number
    sceneMapTransformY?: number
    sceneMapTransformZoom?: number
    // SceneMap->Event,Jump position
    sceneMapPosX?: number
    sceneMapPosY?: number
  }
}

export interface Studio extends Element {
  id?: StudioId
  worlds: WorldId[] // references by ID
}

export interface Editor extends Element {}

// prettier-ignore
// [drive (x), agency (y)]
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
              SAD = 'SAD'  // [-1.00, -1.00]
                           // min(d,e)
}

// prettier-ignore
export const CHARACTER_MASK_VALUES: {
  [maskType: string]: [number, number, number] // drive, agency, influence
} = {
    EXCITED: [1, 1, 4],
      TENSE: [-1, 1, 4],
     LIVELY: [.75, .75, 3],
    NERVOUS: [-.75, .75, 3],
   CHEERFUL: [.5, .5, 2],
  IRRITATED: [-.5, .5, 2],
      HAPPY: [0.25, .25, 1],
    ANNOYED: [-0.25, .25, 1],
    NEUTRAL: [0, 0, 0],
    RELAXED: [.25, -.25, 1],
      BORED: [-.25, -.25, 1],
   CAREFREE: [.5, -.5, 2],
      WEARY: [-.5, -.5, 2],
       CALM: [.75, -.75, 3],
     GLOOMY: [-.75, -.75, 3],
     SERENE: [1, -1, 4],
        SAD: [-1, -1, 4]
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

export interface CharacterMakeup {
  aggregate: {
    drive: number
    agency: number
  }
  dominate: {
    drive: CHARACTER_MASK_TYPE
    agency: CHARACTER_MASK_TYPE
  }
}

export interface CharacterMask {
  active: boolean
  assetId?: string // the location will change, but keep asset ID consistent
  type: CHARACTER_MASK_TYPE
}

// tuple: [uuid, ...]
export type CharacterRef = [string, string | CHARACTER_PRONOUN_TYPES]

export type CharacterRefs = Array<CharacterRef>

export interface Character extends Element {
  description?: string
  worldId: WorldId
  masks: CharacterMask[]
  refs: CharacterRefs // all strings must be unique
  // TODO: add variable ID
}

export type WorldChildRefs = Array<
  [ELEMENT_TYPE.FOLDER | ELEMENT_TYPE.SCENE, ElementId]
>

export interface World extends Element {
  children: WorldChildRefs
  copyright?: string
  /** ASSET_KIND.WORLD_COVER. Shown on the dashboard card and the engine title card. */
  coverAssetId?: string
  /** ASSET_KIND.WORLD_BACKGROUND. Filled behind the engine's reading column. */
  backgroundAssetId?: string
  /**
   * The NUMBER variable shown as the world's currency in the engine's object
   * rail. Money is a plain variable — effects spend and earn it, conditions gate
   * on it, expressions print it — so this is only a *designation*, not a second
   * kind of state. Absent means no currency readout.
   */
  currencyVariableId?: ElementId
  /** The word beside the currency value ("Credits", "Gold"). Absent shows just the value. */
  currencyLabel?: string
  description?: string
  designer: string
  engine: string
  id?: WorldId
  /**
   * The author's words for the engine's own — "nehmen" for "Take" — sparse and
   * keyed by `INTERFACE_TEXT_KEY`. Absent means the storyteller speaks English.
   *
   * Per storyworld rather than a language the player picks, because the prose
   * cannot be switched at runtime: a picker would put German chrome around
   * English prose. `engine/src/lib/interfaceText.ts` is the table of keys and
   * defaults, and the only place either is declared.
   */
  interfaceText?: InterfaceTextOverrides
  jump: ElementId | null // Jump
  /**
   * What the storyteller says when two objects have no matching recipe. Silence
   * reads as broken. An object's own `noRecipeMessage` overrides this, and the
   * engine falls back to its own constant when neither is set.
   */
  objectNoRecipeMessage?: string
  /** Default for the world; an event may override it. */
  choicePresentation?: CHOICE_PRESENTATION
  /** How a live event enters the stream. Absent means FADE. */
  transition?: ENGINE_TRANSITION
  /** Where the reading column sits on a wide screen. Absent means CENTER. */
  streamAlignment?: STREAM_ALIGNMENT
  /**
   * The author's locked base palette. Absent means the player chooses their own
   * theme, as before; set means the storyworld locks to it and the player's theme
   * toggle is hidden.
   */
  theme?: ENGINE_THEME
  /** Author overrides of the base theme's colours, applied on top of it. */
  themeColors?: WorldThemeColors
  /**
   * A bundled game-UI skin dressing the inventory, paperdoll, choice modal and
   * panels with 9-slice art. Absent means the flat themed chrome, as before — the
   * skin is opt-in. Only the selected skin's art is bundled into an export.
   */
  skin?: ENGINE_SKIN
  template: WORLD_TEMPLATE
  version: string
  website?: string
}

// To reduce dupe, set null when parent is of type GAME
export type FolderParentRef = [
  ELEMENT_TYPE.WORLD | ELEMENT_TYPE.FOLDER,
  ElementId | null
]
export type FolderChildRefs = Array<
  [ELEMENT_TYPE.FOLDER | ELEMENT_TYPE.SCENE, ElementId]
>

export interface Folder extends Element {
  children: FolderChildRefs
  worldId: WorldId
  parent: FolderParentRef
}

export type JumpPath = [ElementId?, ElementId?] // [sceneId, eventId]

export interface Jump extends Element {
  worldId: WorldId
  sceneId?: ElementId
  path: JumpPath
}

// To reduce dupe, set null when parent is of type GAME
export type SceneParentRef = [
  ELEMENT_TYPE.WORLD | ELEMENT_TYPE.FOLDER,
  ElementId | null
]
export type SceneChildRef = [ELEMENT_TYPE.EVENT | ELEMENT_TYPE.JUMP, ElementId]
export type SceneChildRefs = Array<SceneChildRef>

export type AudioProfile = [string, boolean] // asset_id, looping

export interface Scene extends Element {
  audio?: AudioProfile
  children: SceneChildRefs
  worldId: WorldId
  parent: SceneParentRef
  triggers?: TriggerData[]
}

export enum PATH_CONDITIONS_TYPE {
  ALL = 'ALL',
  ANY = 'ANY'
}

export interface Path extends Element {
  choiceId?: ElementId
  conditionsType: PATH_CONDITIONS_TYPE
  destinationId: ElementId
  destinationType: ELEMENT_TYPE
  inputId?: ElementId
  /**
   * A transient line shown when this path is taken. Template expressions work,
   * since `getProcessedTemplate` takes a string.
   */
  notification?: string
  originId: ElementId
  originType: ELEMENT_TYPE | EVENT_TYPE
  sceneId: ElementId
  worldId: WorldId
}

/**
 * A test against a variable's current value, and the assignment counterpart.
 *
 * Extracted so the one declaration can be reused wherever a variable is tested or
 * set — a path condition, an object placement gate, a recipe's effects. Two
 * separately declared tuples of identical shape are assignable in TypeScript,
 * unlike two enums, so this is about having a single place to change rather than
 * about the compiler catching a mismatch.
 */
export type VariableCompare = [
  ElementId,
  COMPARE_OPERATOR_TYPE,
  string,
  VARIABLE_TYPE
]

export type VariableSet = [ElementId, SET_OPERATOR_TYPE, string, VARIABLE_TYPE]

/**
 * A scene trigger: fire an action on the rising edge of a variable condition,
 * without the player taking a path. v1's only action is a one-shot `sound` (an
 * mp3 asset id). `compare` is one or more path-style condition tuples folded by
 * `conditionsType` (ALL default); `fireOnEntry` also fires on scene entry when the
 * condition already holds. Stored inline on `Scene.triggers` — an unindexed Dexie
 * property, so no migration. See `dev-doc/scene-triggers.md`.
 */
export interface TriggerData {
  id: ElementId
  compare: VariableCompare[]
  conditionsType?: PATH_CONDITIONS_TYPE
  fireOnEntry?: boolean
  sound: ElementId
}

// Path Condition
export interface Condition extends Element {
  compare: VariableCompare // variable ref
  pathId: ElementId
  variableId: ElementId
  worldId: WorldId
}

// Path Condition
export interface Effect extends Element {
  worldId: WorldId
  pathId: ElementId
  variableId: ElementId
  set: VariableSet // variable ref
}

export enum EVENT_TYPE {
  CHOICE = 'CHOICE',
  INPUT = 'INPUT',
  JUMP = 'JUMP'
}

export type EventPersona = [ElementId, CHARACTER_MASK_TYPE, string | undefined] // [characterId, mask, reference ID]

export interface Event extends Element {
  audio?: AudioProfile
  characters: ElementId[]
  choices: ElementId[]
  /** Overrides `World.choicePresentation` for this event's choices. */
  choicePresentation?: CHOICE_PRESENTATION
  content: string
  ending: boolean // world end
  images: string[] // asset id
  input?: ElementId // input ref
  persona?: EventPersona
  sceneId: ElementId
  type: EVENT_TYPE
  worldId: WorldId
}

export interface Choice extends Element {
  worldId: WorldId
  eventId: ElementId
}

export interface Input extends Element {
  worldId: WorldId
  eventId: ElementId
  variableId?: ElementId
}

export enum VARIABLE_SCOPE {
  WORLD = 'WORLD',
  SCENE = 'SCENE'
}

export interface Variable extends Element {
  worldId: WorldId
  type: VARIABLE_TYPE
  initialValue: string
  // Author-facing note on what the variable is for. Not indexed, so it needs no
  // Dexie migration; it is carried through the transport schema as an optional
  // property, which leaves files written before it existed valid.
  description?: string
  /**
   * How long the value lives. Absent means WORLD, which is what every variable
   * written before 0.8.0 is.
   *
   * SCENE means exactly one thing: the value resets to `initialValue` when the
   * player enters `scopeId`. Scope changes lifetime, **not** namespace — titles
   * stay unique across the whole world, because template expressions resolve a
   * variable by title rather than by id, so two scene-scoped variables sharing a
   * title would be ambiguous with whichever the map saw last winning.
   */
  scope?: VARIABLE_SCOPE
  scopeId?: ElementId // the scene, when scope is SCENE
}

/** How a set of choices is offered to the player. */
export enum CHOICE_PRESENTATION {
  INLINE = 'INLINE',
  LIST = 'LIST',
  MODAL = 'MODAL'
}

/**
 * How a live event enters the story stream. Absent means FADE, which is the
 * behaviour every pre-0.8.0 storyworld already had, so a world that never sets
 * this reads exactly as it did. NONE is an explicit opt-out, distinct from the
 * player's ENGINE_MOTION.REDUCED — a reduced-motion player gets no animation
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
 * The engine's base palette. Also a *player* setting, but when an author sets
 * `World.theme` the storyworld locks to it and the player's own toggle is hidden.
 * BOOK is the light theme, CONSOLE the dark one.
 */
export enum ENGINE_THEME {
  BOOK = 'BOOK',
  CONSOLE = 'CONSOLE'
}

/**
 * A bundled game-UI skin — 9-slice frame art that dresses the inventory, the
 * character paperdoll, the choice modal and the panels. A closed curated set, one
 * folder of art per member; absent on a world means no skin (the flat themed
 * chrome). MEDIEVAL is the Wenrexa RPG kit (#6), SCIFI the minimalist space kit
 * (#16); both are CC BY-SA 4.0, credited in CREDITS and the export.
 */
export enum ENGINE_SKIN {
  MEDIEVAL = 'MEDIEVAL',
  SCIFI = 'SCIFI'
}

/**
 * An author's overrides of the engine's base theme, each a CSS colour string
 * (e.g. `#1a1a1a` or `hsl(...)`). Every field is optional; an absent one keeps
 * the player's chosen theme (BOOK or CONSOLE) for that token, so these layer on
 * top of a theme rather than replacing it. The engine applies them as inline
 * custom properties at runtime — never a generated stylesheet — because the
 * engine's Less is regenerated on every build. `accent` drives the primary
 * colour and its hover shades, derived with `color-mix`.
 */
export interface WorldThemeColors {
  background?: string
  text?: string
  accent?: string
}

/**
 * A location an object can occupy: a scene id, or `INVENTORY_LOCATION_KEY`.
 *
 * One location space rather than two is what lets a starting inventory be
 * authored as an ordinary placement and lets one derivation serve both "the
 * player has" and "the scene contains". Scene ids are uuids, so the sentinel
 * cannot collide; it follows the engine's existing `'___initial___'` and
 * `'___auto___'` convention.
 */
export type ObjectLocation = ElementId | string

export const INVENTORY_LOCATION_KEY = '___inventory___'

/** Where an object condition looks for its object. */
export enum OBJECT_LOCATION_TYPE {
  INVENTORY = 'INVENTORY',
  CURRENT_SCENE = 'CURRENT_SCENE',
  SCENE = 'SCENE'
}

/**
 * A test on how many of an object are in a place — the evaluable core of an
 * object condition, reused by a path gate (`ObjectCondition`, a table row keyed
 * on `pathId`) and by a placement gate (inline on the object). One evaluator
 * serves both.
 *
 * The comparison is a count rather than a boolean because the coin scenario needs
 * "has at least five". `[COMPARE_OPERATOR_TYPE.GTE, 1]` is "has one" and
 * `[COMPARE_OPERATOR_TYPE.EQ, 0]` is absence.
 */
export type ObjectCompare = {
  objectId: ElementId
  location: OBJECT_LOCATION_TYPE
  sceneId?: ElementId // required when location is SCENE; CURRENT_SCENE ignores it
  compare: [COMPARE_OPERATOR_TYPE, number]
}

/**
 * Where an object starts, and what has to be true for it to be there at all.
 *
 * Inline on the object rather than a table: a placement is owned by exactly one
 * object, has no independent identity and is referenced by nothing, which is the
 * same reasoning that keeps `Event.images` an array.
 *
 * A gate that turns true mid-play reveals the object, which is what replaces
 * recursive containers — the battery in the locked drawer is a placement gated on
 * the current scene containing an unlocked drawer. Gates should be **monotonic**:
 * nothing enforces it, but one that turns true, then false, then true again hands
 * the player a second copy of something they already took.
 */
export interface ObjectPlacement {
  location: ObjectLocation
  quantity: number // >= 1
  conditionsType?: PATH_CONDITIONS_TYPE // default ALL
  variableConditions?: VariableCompare[]
  objectConditions?: ObjectCompare[]
}

/**
 * Where a wearable object sits on the body, so the paperdoll panel has a fixed
 * anchor to draw it on and so one slot holds one thing at a time. A curated list
 * rather than a free string: the panel positions each member, and one-item-per-slot
 * replacement (see the engine's `wear`) can only mean anything against a closed set.
 *
 * `slot` is optional. A wearable with no slot can still be worn — it just does not
 * participate in slot exclusivity or appear on the paperdoll, which is the right
 * behaviour for "wear the gloves" when the author does not care about a hands slot.
 */
export enum EQUIP_SLOT {
  HEAD = 'HEAD',
  NECK = 'NECK',
  BODY = 'BODY',
  HANDS = 'HANDS',
  FEET = 'FEET',
  HELD = 'HELD'
}

/**
 * A thing in the world that can be looked at, carried and combined.
 *
 * There are no object *instances*. A definition plus a count per location is
 * enough, because two batteries are interchangeable and divergent state is
 * modelled by swapping definitions — a charged flashlight is a different object
 * from an empty one, not the same object in a different mood.
 *
 * `title` is the object's name and is a **display name, not an identifier**:
 * recipes, placements and conditions all reference an object by id, so renaming
 * one cascades nowhere. This is deliberately unlike `Variable.title`.
 */
export interface WorldObject extends Element {
  worldId: WorldId
  /**
   * Shown when the object is inspected. Plain text rather than a serialized Slate
   * document, and it still gets template expressions, because
   * `getProcessedTemplate` takes a string. Required, but may be empty.
   */
  description: string
  assetId?: string // ASSET_KIND.OBJECT_IMAGE
  takeable: boolean
  combineable: boolean
  stackedTitle?: string // "a pile of coins", used when the count exceeds one
  stackedAssetId?: string
  /** Overrides `World.objectNoRecipeMessage` when this object is combined from. */
  noRecipeMessage?: string
  /**
   * Variable assignments applied when the player picks this up.
   *
   * A recipe's `effects` fire when a recipe fires — that is, on Use or Combine —
   * and taking an object is neither, so without these there was no way to record
   * "the player has the book" as a variable. It matters because a template
   * expression in prose can only read variables: `{ bookTaken ? ... }` has no way
   * to ask about the inventory, even though a path condition does.
   *
   * Applied once, on the take that moves the object. Taking a second stack of the
   * same object applies them again, which is why an assignment is usually the
   * right operator rather than an increment.
   */
  takeEffects?: VariableSet[]
  /** What the storyteller says when the player picks this up. */
  takeMessage?: string
  /**
   * Whether the object can be worn/equipped. When true the object gains Wear and
   * Remove verbs; wearing applies `wearEffects` and removing applies
   * `removeEffects`, so "the player is wearing the hat" becomes a variable a path
   * condition can gate on — the disguise/hat-in-the-cave pattern. This is not an
   * RPG stat system: it sets variables, and the existing condition system does the
   * rest.
   */
  wearable?: boolean
  /**
   * Where this sits on the body when worn. Optional even for a wearable: an object
   * with a slot occupies it exclusively (wearing a second head item removes the
   * first, applying its `removeEffects`) and shows on the paperdoll; one without a
   * slot is simply wearable. See `EQUIP_SLOT`.
   */
  slot?: EQUIP_SLOT
  /** Variable assignments applied when the player wears this. See `takeEffects`. */
  wearEffects?: VariableSet[]
  /** Variable assignments applied when the player removes this. */
  removeEffects?: VariableSet[]
  /** What the storyteller says when the player wears this. */
  wearMessage?: string
  /** What the storyteller says when the player removes this. */
  removeMessage?: string
  placements: ObjectPlacement[]
}

/** A path gate on object presence. Its own table, because it is queried by path. */
export interface ObjectCondition extends Element, ObjectCompare {
  worldId: WorldId
  pathId: ElementId
}

export enum RECIPE_OUTPUT_DESTINATION {
  INVENTORY = 'INVENTORY',
  CURRENT_SCENE = 'CURRENT_SCENE'
}

export interface RecipeInput {
  objectId: ElementId
  quantity: number // >= 1
  consumed: boolean
}

export interface RecipeOutput {
  objectId: ElementId
  quantity: number
  destination: RECIPE_OUTPUT_DESTINATION
}

/**
 * What combining objects produces.
 *
 * A table rather than an array on an object, because a recipe relates two or more
 * objects and belongs to none of them — and the editor has to show it from either
 * side of the relationship. Inputs and outputs stay inline for the opposite
 * reason: they are owned and referenced by nothing.
 *
 * `inputs.length >= 1`, which makes decomposition the same code path with a
 * different affordance — one input is "use", several is "combine". Matching is on
 * the **exact** input set with quantities at least the recipe's; subset matching
 * would fire a one-input recipe when two objects are combined.
 */
export interface Recipe extends Element {
  worldId: WorldId
  inputs: RecipeInput[]
  outputs: RecipeOutput[]
  /**
   * Optional variable assignments applied when the recipe fires, so "combining
   * these advances the quest counter" does not need a path invented to carry it.
   * Inline rather than rows in the `effects` table, which is keyed on `pathId`.
   */
  effects?: VariableSet[]
  message?: string // what the storyteller says on success
}

/**
 * A labelled edge between two characters. `title` is the label — "sister of",
 * "distrusts".
 *
 * **Editor-only.** It is authoring metadata, so it gets no engine table and is not
 * compiled into the engine collection. Anything that has to be visible at runtime
 * goes through the optional `variableId`: the relationship is metadata, the number
 * is a variable the engine already reads.
 */
export interface CharacterRelationship extends Element {
  worldId: WorldId
  from: ElementId // characterId
  to: ElementId // characterId
  directed: boolean // false means mutual
  description?: string
  variableId?: ElementId
}
