import { cloneDeep } from 'lodash'

import {
  ElementId,
  EngineLiveEventMessageData,
  EngineLiveEventStateCollection,
  EngineObjectData,
  EngineObjectDeltaCollection,
  EngineRecipeData,
  INVENTORY_LOCATION_KEY,
  OBJECT_LOCATION_TYPE,
  ObjectCompare,
  ObjectPlacement,
  PATH_CONDITIONS_TYPE,
  RECIPE_OUTPUT_DESTINATION
} from '../types'

import { compareNumbers, applyVariableSets, variableCompareHolds } from './state'

/**
 * The world object model: what is where, what a combination produces, and what the
 * storyteller says about it.
 *
 * **Pure**, like `sceneMapClipboard` and `sceneMapLayout` in the editor, and for
 * the same reason: a model that is subtly wrong here renders plausibly and is
 * wrong underneath. `src/__tests__/objectModel.test.ts` covers it.
 *
 * The central decision, settled in `DESIGN.md`, is that **contents are derived
 * rather than stored**. A location's count is its authored placement — with that
 * placement's gate re-evaluated *now* — plus a signed delta, clamped at zero. Two
 * consequences follow, and both are the point rather than side effects:
 *
 * - A placement gate that becomes true mid-play reveals its object with **no write
 *   of any kind**, which is what replaces recursive containers. The battery in the
 *   locked drawer is a placement gated on the current scene containing an unlocked
 *   drawer.
 * - A pristine world stores nothing at all, so an old save with no delta map reads
 *   as untouched.
 *
 * The cost is that placement gates want to be **monotonic**. Nothing enforces it,
 * and the clamp keeps a non-monotonic gate from going negative, but a gate that
 * turns true, then false, then true again hands the player a second copy of
 * something they already took.
 */

/** The engine's own fallback when an author has set no message anywhere. */
export const DEFAULT_NO_RECIPE_MESSAGE = 'Nothing happens.'

/**
 * How many objects one recipe may take: **one or two, never more**.
 *
 * One input is Use, two is Combine, and a chain of three is authored as two
 * recipes through an intermediate object — a broken radio and an antenna give a
 * repaired radio, which then combines with a battery. That is the adventure-game
 * idiom, and it is also the honest shape: a storyteller that let a player heap up
 * an arbitrary pile before asking what it makes has to explain the pile.
 *
 * The rule is declared here, in the model, because it binds two places that
 * otherwise cannot see each other — the rail's verb menu, which can only ever
 * offer a pair, and the recipe editor, which must not let an author write a
 * recipe no player could trigger. `matchRecipe` does not filter on it: a longer
 * recipe simply never matches, because no selection that size can be built.
 */
export const MAX_RECIPE_INPUTS = 2

/** A scene id, or `INVENTORY_LOCATION_KEY`. */
export type ObjectLocation = string

/**
 * Everything the model needs to answer a question, gathered by the caller.
 *
 * Taken as one snapshot rather than fetched per call so the whole model stays pure
 * and synchronous — the engine reads these out of Dexie once and then asks as many
 * questions as it likes without another await.
 */
export interface ObjectWorldSnapshot {
  objects: EngineObjectData[]
  /** signed, sparse; absent at any level means zero */
  deltas: EngineObjectDeltaCollection
  /** for variable gates, and for a recipe's effects */
  state: EngineLiveEventStateCollection
  /** resolves OBJECT_LOCATION_TYPE.CURRENT_SCENE */
  currentSceneId?: ElementId
  /** World.objectNoRecipeMessage */
  noRecipeMessage?: string
}

const deltaFor = (
  deltas: EngineObjectDeltaCollection,
  location: ObjectLocation,
  objectId: ElementId
): number => deltas[location]?.[objectId] ?? 0

/**
 * Resolves a condition's location to a concrete key, or `undefined` when it cannot
 * be resolved — a `CURRENT_SCENE` test with no current scene, or a `SCENE` test
 * with no scene named. Callers treat `undefined` as "does not hold" rather than
 * guessing a location.
 */
const resolveLocation = (
  compare: ObjectCompare,
  currentSceneId?: ElementId
): ObjectLocation | undefined => {
  switch (compare.location) {
    case OBJECT_LOCATION_TYPE.INVENTORY:
      return INVENTORY_LOCATION_KEY
    case OBJECT_LOCATION_TYPE.CURRENT_SCENE:
      return currentSceneId
    case OBJECT_LOCATION_TYPE.SCENE:
      return compare.sceneId
    default:
      return undefined
  }
}

/**
 * Whether a placement's gate passes.
 *
 * `resolving` breaks reference cycles. A gate may ask about another object's
 * presence, and that object's own placement may have a gate asking back — two
 * objects each gated on the other's presence is authorable and would otherwise
 * recurse until the stack gave out. A cycle resolves to **not present**, which is
 * both deterministic and the safe direction.
 */
const gatePasses = (
  snapshot: ObjectWorldSnapshot,
  placement: ObjectPlacement,
  resolving: Set<string>
): boolean => {
  const variableConditions = placement.variableConditions ?? [],
    objectConditions = placement.objectConditions ?? []

  const total = variableConditions.length + objectConditions.length

  // An ungated placement is simply present. Checked before the ALL/ANY split
  // because `[].some()` is false, which would hide every object whose gate is
  // empty and typed ANY.
  if (total === 0) return true

  const results: boolean[] = []

  variableConditions.forEach((compare) => {
    const entry = snapshot.state[compare[0]]

    // A gate naming a variable that is not in the state — deleted, or never
    // reached this save — fails closed rather than being dropped.
    if (!entry) {
      results.push(false)
      return
    }

    results.push(variableCompareHolds(compare, entry.type, entry.value) ?? false)
  })

  objectConditions.forEach((compare) =>
    results.push(objectCompareHolds(snapshot, compare, resolving))
  )

  return (placement.conditionsType ?? PATH_CONDITIONS_TYPE.ALL) ===
    PATH_CONDITIONS_TYPE.ANY
    ? results.some(Boolean)
    : results.every(Boolean)
}

const placedQuantity = (
  snapshot: ObjectWorldSnapshot,
  object: EngineObjectData,
  location: ObjectLocation,
  resolving: Set<string>
): number => {
  // At most one placement per location, enforced by the editor. If a hand-edited
  // file carries two, the first wins deterministically rather than being summed.
  const placement = object.placements?.find(
    (candidate) => candidate.location === location
  )

  if (!placement) return 0

  return gatePasses(snapshot, placement, resolving) ? placement.quantity : 0
}

const countAt = (
  snapshot: ObjectWorldSnapshot,
  objectId: ElementId,
  location: ObjectLocation,
  resolving: Set<string>
): number => {
  const key = `${location}:${objectId}`

  // cycle guard; see gatePasses
  if (resolving.has(key)) return 0

  const object = snapshot.objects.find(
    (candidate) => candidate.id === objectId
  )

  if (!object) return 0

  const next = new Set(resolving)
  next.add(key)

  const placed = placedQuantity(snapshot, object, location, next),
    delta = deltaFor(snapshot.deltas, location, objectId)

  return Math.max(0, placed + delta)
}

/** How many of an object are in a location right now. */
export const objectCountAt = (
  snapshot: ObjectWorldSnapshot,
  objectId: ElementId,
  location: ObjectLocation
): number => countAt(snapshot, objectId, location, new Set())

/** How many of an object the player is carrying. */
export const inventoryCount = (
  snapshot: ObjectWorldSnapshot,
  objectId: ElementId
): number => objectCountAt(snapshot, objectId, INVENTORY_LOCATION_KEY)

/**
 * Everything in a location, as `[object, count]`, ordered by title so the
 * inventory panel does not reshuffle itself between renders.
 *
 * Only objects with a non-zero count appear, which is what makes "the scene
 * contains nothing" a fact rather than a list of zeroes.
 */
export const locationContents = (
  snapshot: ObjectWorldSnapshot,
  location: ObjectLocation
): Array<[EngineObjectData, number]> =>
  snapshot.objects
    .map((object): [EngineObjectData, number] => [
      object,
      objectCountAt(snapshot, object.id, location)
    ])
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => (a.title > b.title ? 1 : a.title < b.title ? -1 : 0))

/** The player's inventory, ordered by title. */
export const inventoryContents = (
  snapshot: ObjectWorldSnapshot
): Array<[EngineObjectData, number]> =>
  locationContents(snapshot, INVENTORY_LOCATION_KEY)

/** Whether an object condition holds. Used by placement gates and path gates. */
export const objectCompareHolds = (
  snapshot: ObjectWorldSnapshot,
  compare: ObjectCompare,
  resolving: Set<string> = new Set()
): boolean => {
  const location = resolveLocation(compare, snapshot.currentSceneId)

  if (location === undefined) return false

  const count = countAt(snapshot, compare.objectId, location, resolving)

  return compareNumbers(compare.compare[0], count, compare.compare[1]) ?? false
}

/**
 * How an object reads when the player is holding more than one.
 *
 * `stackedTitle` is what makes five coins read as "a pile of coins" rather than
 * "Coin ×5". Falls back to the plain title, so an author who sets nothing gets the
 * count beside the name instead of nothing at all.
 */
export const displayTitle = (
  object: EngineObjectData,
  count: number
): string =>
  count > 1 && object.stackedTitle ? object.stackedTitle : object.title

export const displayAssetId = (
  object: EngineObjectData,
  count: number
): string | undefined =>
  count > 1 && object.stackedAssetId ? object.stackedAssetId : object.assetId

const sortedIds = (ids: ElementId[]): string =>
  [...ids].sort().join(' ')

/**
 * The recipe whose inputs are **exactly** the selection, or undefined.
 *
 * Exact rather than subset: a subset match would fire a single-input recipe the
 * moment the player selected two objects, which makes "these two do not combine"
 * unauthorable. Two recipes sharing an input set are an authoring error the editor
 * warns about; here the lowest id wins, so the same world behaves the same way
 * twice — the determinism rule `sceneMapLayout` already follows for dagre.
 */
export const matchRecipe = (
  recipes: EngineRecipeData[],
  selection: ElementId[]
): EngineRecipeData | undefined => {
  const wanted = sortedIds(selection)

  return recipes
    .filter(
      (recipe) => sortedIds(recipe.inputs.map(({ objectId }) => objectId)) === wanted
    )
    .sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0))[0]
}

/**
 * Where each of a recipe's inputs would come from, or undefined if one cannot be
 * satisfied.
 *
 * **Inventory first, then the current scene.** A static object can only ever be
 * satisfied from the scene, since `takeable: false` keeps it out of the inventory —
 * which is what "objects combine with static objects in the current scene" means
 * concretely. An input may be drawn from both at once when neither alone holds
 * enough.
 */
const resolveInputs = (
  snapshot: ObjectWorldSnapshot,
  recipe: EngineRecipeData
): Array<{ objectId: ElementId; from: Array<[ObjectLocation, number]> }> | undefined => {
  const plan: Array<{
    objectId: ElementId
    from: Array<[ObjectLocation, number]>
  }> = []

  for (const input of recipe.inputs) {
    let outstanding = input.quantity
    const from: Array<[ObjectLocation, number]> = []

    const sources: ObjectLocation[] = [INVENTORY_LOCATION_KEY]

    if (snapshot.currentSceneId) sources.push(snapshot.currentSceneId)

    for (const source of sources) {
      if (outstanding <= 0) break

      const available = objectCountAt(snapshot, input.objectId, source)

      if (available <= 0) continue

      const taken = Math.min(available, outstanding)

      from.push([source, taken])
      outstanding -= taken
    }

    if (outstanding > 0) return undefined

    plan.push({ objectId: input.objectId, from })
  }

  return plan
}

/** Whether every input of a recipe is available in sufficient quantity. */
export const canApplyRecipe = (
  snapshot: ObjectWorldSnapshot,
  recipe: EngineRecipeData
): boolean => resolveInputs(snapshot, recipe) !== undefined

const addDelta = (
  deltas: EngineObjectDeltaCollection,
  location: ObjectLocation,
  objectId: ElementId,
  amount: number
) => {
  if (amount === 0) return

  if (!deltas[location]) deltas[location] = {}

  deltas[location][objectId] = (deltas[location][objectId] ?? 0) + amount
}

export enum COMBINE_OUTCOME {
  APPLIED = 'APPLIED',
  NO_RECIPE = 'NO_RECIPE',
  INSUFFICIENT = 'INSUFFICIENT'
}

export type CombineResult =
  | {
      outcome: COMBINE_OUTCOME.APPLIED
      recipe: EngineRecipeData
      deltas: EngineObjectDeltaCollection
      state: EngineLiveEventStateCollection
      message?: string
    }
  | { outcome: COMBINE_OUTCOME.NO_RECIPE; message: string }
  | {
      outcome: COMBINE_OUTCOME.INSUFFICIENT
      recipe: EngineRecipeData
      message: string
    }

/**
 * What an author's message chain says when nothing combines.
 *
 * Most specific first: the object the player combined **from** — the first
 * selected, so "use the key on the drawer" lets the key speak — then the world's
 * default, then the engine's own. Silence is never an option, because silence reads
 * as a broken game rather than a refusal.
 */
export const noRecipeMessageFor = (
  snapshot: ObjectWorldSnapshot,
  selection: ElementId[]
): string => {
  const first = snapshot.objects.find(
    (object) => object.id === selection[0]
  )

  return (
    first?.noRecipeMessage ||
    snapshot.noRecipeMessage ||
    DEFAULT_NO_RECIPE_MESSAGE
  )
}

/**
 * Combines a selection of objects, returning new deltas and state rather than
 * mutating anything.
 *
 * The caller writes the result as a **new live event**, which is what keeps the
 * combination visible in the event stream and keeps a bookmark's live event id
 * meaning one thing. Nothing here knows about live events, which is what makes it
 * testable.
 *
 * A single-object selection is the "use" affordance and a multi-object one is
 * "combine"; both are this one path, differing only in `inputs.length`.
 */
export const combine = (
  snapshot: ObjectWorldSnapshot,
  recipes: EngineRecipeData[],
  selection: ElementId[]
): CombineResult => {
  const recipe = matchRecipe(recipes, selection)

  if (!recipe)
    return {
      outcome: COMBINE_OUTCOME.NO_RECIPE,
      message: noRecipeMessageFor(snapshot, selection)
    }

  const plan = resolveInputs(snapshot, recipe)

  if (!plan)
    return {
      outcome: COMBINE_OUTCOME.INSUFFICIENT,
      recipe,
      message: noRecipeMessageFor(snapshot, selection)
    }

  const deltas = cloneDeep(snapshot.deltas)

  recipe.inputs.forEach((input) => {
    // A retained input is not removed, which is what lets one key open several
    // drawers. Retention is per input, so a recipe may consume one thing and keep
    // another.
    if (!input.consumed) return

    const resolved = plan.find(({ objectId }) => objectId === input.objectId)

    resolved?.from.forEach(([location, amount]) =>
      addDelta(deltas, location, input.objectId, -amount)
    )
  })

  recipe.outputs.forEach((output) => {
    const location =
      output.destination === RECIPE_OUTPUT_DESTINATION.INVENTORY
        ? INVENTORY_LOCATION_KEY
        : snapshot.currentSceneId

    // An output destined for the current scene with no current scene would
    // otherwise vanish silently. Dropped deliberately and reported by the caller
    // rather than written to a location that does not exist.
    if (!location) return

    addDelta(deltas, location, output.objectId, output.quantity)
  })

  return {
    outcome: COMBINE_OUTCOME.APPLIED,
    recipe,
    deltas,
    state: applyVariableSets(snapshot.state, recipe.effects ?? []),
    message: recipe.message
  }
}

export type TakeResult = {
  deltas: EngineObjectDeltaCollection
  state: EngineLiveEventStateCollection
  message?: string
}

/**
 * Moves one of an object from the current scene into the inventory.
 *
 * Takes the **whole stack** in that location. Quantity per location is authored
 * rather than emergent, so "some of a pile" is not state the model carries, and a
 * per-take quantity control would be inventing a decision the author already made.
 *
 * Applies the object's `takeEffects`, which is what lets "the player has the book"
 * become a variable. Nothing else did: a recipe's effects fire when a recipe fires,
 * on Use or Combine, and a take is neither — so a prose template like
 * `{ bookTaken ? ... }` had no way to become true, even though a path condition
 * could already ask about the inventory directly.
 *
 * Returns undefined when there is nothing to take or the object is static, so the
 * caller writes no live event at all rather than one that changes nothing.
 */
export const take = (
  snapshot: ObjectWorldSnapshot,
  objectId: ElementId
): TakeResult | undefined => {
  const object = snapshot.objects.find(
    (candidate) => candidate.id === objectId
  )

  if (!object || !object.takeable || !snapshot.currentSceneId) return undefined

  const available = objectCountAt(snapshot, objectId, snapshot.currentSceneId)

  if (available <= 0) return undefined

  const deltas = cloneDeep(snapshot.deltas)

  addDelta(deltas, snapshot.currentSceneId, objectId, -available)
  addDelta(deltas, INVENTORY_LOCATION_KEY, objectId, available)

  return {
    deltas,
    state: applyVariableSets(snapshot.state, object.takeEffects ?? []),
    message: object.takeMessage
  }
}

/**
 * Adds what the storyteller just said to what it has already said on this event.
 *
 * The messages live on the live event rather than in the object panel, so a take
 * or a combination reads as a beat in the prose. `DESIGN.md` §5 reasoned that a
 * beat has to *be* a live event to appear in the stream at all; it does not — the
 * beat is a line on the event where it happened, which reads better and avoids
 * writing a second live event with the same `destination` as the one it follows.
 * That second event rendered the whole event again, and its stale twin kept
 * clickable choices whose `objects` predated the take, so taking something and then
 * clicking the *upper* copy of a choice silently dropped it. See `TODO.md` §4.5.
 *
 * `collapseRepeat` is for refusals and inspections. "Nothing happens." said four
 * times because the player pressed Use four times is noise, and so is the same
 * description printed twice because a tile was deselected and selected again. Two
 * identical *take* messages are two things genuinely picked up, and both belong in
 * the log, which is why this is per call rather than always on.
 *
 * A repeat is only a repeat against the line directly above it, and only when both
 * the text and the reason for it match — an inspection that happens to read the
 * same as a take message is still a different beat.
 *
 * Returns `undefined` when there is nothing to add, so the caller can skip the
 * write rather than touching the record to store what it already holds.
 */
export const appendMessage = (
  messages: EngineLiveEventMessageData[] | undefined,
  message: EngineLiveEventMessageData | undefined,
  collapseRepeat = false
): EngineLiveEventMessageData[] | undefined => {
  if (!message?.text) return undefined

  const current = messages ?? [],
    last = current[current.length - 1]

  if (collapseRepeat && last?.text === message.text && last.type === message.type)
    return undefined

  return [...current, message]
}

/**
 * Drops deltas naming an object the world no longer has.
 *
 * Called when a save is reconciled against a newer world. Without it a save keeps
 * counts for deleted objects forever, and "the player has X" answers about a ghost.
 * Empty locations are dropped too, so the map does not accumulate husks.
 */
export const pruneDeltas = (
  deltas: EngineObjectDeltaCollection,
  objectIds: ElementId[]
): EngineObjectDeltaCollection => {
  const live = new Set(objectIds),
    pruned: EngineObjectDeltaCollection = {}

  Object.keys(deltas).forEach((location) => {
    const entries = Object.entries(deltas[location]).filter(
      ([objectId, amount]) => live.has(objectId) && amount !== 0
    )

    if (entries.length > 0)
      pruned[location] = Object.fromEntries(entries) as {
        [objectId: string]: number
      }
  })

  return pruned
}
