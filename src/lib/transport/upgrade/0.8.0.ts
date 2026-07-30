// upgrades 0.7.1 data to 0.8.0
import { WorldDataJSON as WorldDataJSON_071 } from '../types/0.7.1'
import {
  CharacterRelationshipCollection,
  ObjectCollection,
  ObjectConditionCollection,
  RecipeCollection,
  WorldDataJSON as WorldDataJSON_080
} from '../types/0.8.0'

/**
 * Adds the four collections 0.8.0 introduces, empty.
 *
 * Nothing existing is touched, and that is the point: 0.8.0 adds fields to the
 * root, to events, to paths and to variables, but every one of them is **optional**
 * in both the type and the schema, so a file that has none of them is already
 * valid. Only the four collections are required, because the top-level object is
 * `additionalProperties: false` with a `required` list — which is the entire reason
 * this version exists rather than the fields riding along on 0.7.1.
 *
 * **This step is idempotent**, unlike `upgrade/0.7.0.ts`, which resets event
 * `characters` and `images`, appends a variable type onto every condition and
 * effect, and pushes jump child refs into scenes — running it twice corrupts a
 * world. That is why the 0.6.0-to-0.7.0 branch in `importWorldData` is gated on
 * `< 0.7.0` and not widened. This one is safe either way, but it is gated on
 * `< 0.8.0` and applied after the chain for the same reason of habit: the gates
 * stay one-per-version so the next upgrade has no special case to reason about.
 *
 * The `_` cast is the cost of era isolation. Each transport type file declares its
 * own enums, and two separately declared string enums are not assignable in
 * TypeScript even with identical members, so `RootData` from 0.7.1 is not
 * `RootData` from 0.8.0 despite describing the same bytes plus three optional
 * fields. `upgrade/0.7.0.ts` carries the same cast for the same reason.
 */
export default (worldData: WorldDataJSON_071): WorldDataJSON_080 => {
  const objects: ObjectCollection = {},
    recipes: RecipeCollection = {},
    objectConditions: ObjectConditionCollection = {},
    characterRelationships: CharacterRelationshipCollection = {}

  return {
    // @ts-ignore era-isolated enum declarations; see the note above
    _: worldData._,
    characterRelationships,
    characters: worldData.characters,
    choices: worldData.choices,
    // @ts-ignore
    conditions: worldData.conditions,
    // @ts-ignore
    effects: worldData.effects,
    // @ts-ignore
    events: worldData.events,
    // @ts-ignore
    folders: worldData.folders,
    inputs: worldData.inputs,
    jumps: worldData.jumps,
    objectConditions,
    objects,
    // @ts-ignore
    paths: worldData.paths,
    recipes,
    // @ts-ignore
    scenes: worldData.scenes,
    // @ts-ignore
    variables: worldData.variables
  }
}
