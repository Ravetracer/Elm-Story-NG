// ES 0.8.0
// - world objects, recipes and object conditions
import Dexie from 'dexie'

import { LIBRARY_TABLE } from '.'

/**
 * Declares the three tables the storyteller needs for 0.8.0, and restamps
 * `World.engine`.
 *
 * **This version exists for the tables, and specifically not for the inventory
 * state.** `EngineLiveEventData.objects` — the signed delta map that records what
 * the player has taken and combined — is an optional, unindexed property on the
 * existing `live_events` table, and Dexie declares indexes rather than shapes, so
 * it needs no version bump at all. A live event saved before 0.8.0 simply has no
 * such property, and absent means "no deltas", so an old save reads as a pristine
 * world. the original roadmap originally assumed the opposite; the design pass in `DESIGN.md`
 * disproved it.
 *
 * `characterRelationships` has no table here. It is authoring metadata and is
 * never compiled into `ESGEngineCollectionData`, which is what makes it the
 * cheapest kind of new field — no engine table, no engine migration, no entry in
 * the editor's `compiler/format.ts`.
 *
 * `version(12)`, not `version(11)`: Dexie 3's `version(n)` returns the existing
 * Version instance for a number already declared and `.upgrade()` overwrites its
 * `contentUpgrade`, so reusing 11 would silently discard the 0.7.1 restamp — the
 * same bug upstream's v11 shipped against v10.
 */
export default (database: Dexie) => {
  database
    .version(12)
    .stores({
      // Placements are an inline array on the object, so there is nothing to
      // index for them. `title` is here because the storyteller shows it.
      objects: '&id,worldId,title',
      // Found by world and filtered in memory: a recipe's inputs and outputs are
      // arrays of objects, which a Dexie multi-entry index cannot reach into.
      recipes: '&id,worldId',
      // `pathId` mirrors conditions and effects, since this is read when deciding
      // whether a path is open.
      objectConditions: '&id,worldId,pathId,objectId'
    })
    .upgrade(async (tx) => {
      await tx
        .table(LIBRARY_TABLE.WORLDS)
        .toCollection()
        .modify((world) => {
          world.engine = '0.8.0'
        })
    })
}
