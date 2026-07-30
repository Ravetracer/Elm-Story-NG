// ES 0.8.0
// - world objects, recipes, object conditions and character relationships
import Dexie from 'dexie'

import { LIBRARY_TABLE } from '.'

/**
 * Declares the four tables the 0.8.0 shape adds, and restamps `World.engine`.
 *
 * **This version exists for the tables, not for any field.** Every new *field*
 * that 0.8.0 adds to an existing element — `World.coverAssetId`,
 * `Variable.scope`, `Path.notification`, `Event.choicePresentation` and the rest
 * — is optional and unindexed, and Dexie declares indexes rather than shapes, so
 * none of them needs a migration at all. A new table does, because it has to
 * appear in a `stores()` declaration.
 *
 * Nothing is backfilled. The tables start empty, and every added field is
 * optional, so an existing storyworld is already 0.8.0-shaped the moment this
 * version is declared. The restamp is bookkeeping only: nothing reads
 * `World.engine` at runtime, and an export takes its version from
 * `AppContext`'s schema version rather than from the record.
 *
 * `version(12)` and not `version(11)`. Dexie 3's `version(n)` returns the
 * *existing* Version instance for a number already declared and `.upgrade()`
 * assigns `_cfg.contentUpgrade`, so reusing 11 would silently replace the 0.7.1
 * restamp — which is exactly the bug upstream's own v11 shipped against v10.
 */
export default (database: Dexie) => {
  database
    .version(12)
    .stores({
      // Placements, and the gates on them, are inline arrays on the object
      // rather than tables: a placement is owned by one object and referenced by
      // nothing, so there is no query to index.
      objects: '&id,worldId,title,*tags,updated',
      // Inputs and outputs are inline for the same reason. Recipes are found by
      // world and filtered in memory — a derived `*inputObjectIds` index would be
      // a duplicate of authored data, and recipe counts are in the tens. It is an
      // index rather than a shape, so it can be added later for one Dexie version
      // and nothing else.
      recipes: '&id,worldId,title,*tags,updated',
      // `pathId` mirrors `conditions` and `effects`, which are both read by path
      // when the engine decides whether a path is open.
      objectConditions: '&id,worldId,pathId,objectId,title,*tags,updated',
      // `from` and `to` are indexed beyond what the design pass called for,
      // because the one query section 6 is certain to make is "this character's
      // relationships" and an index costs a Dexie version if it is wanted later.
      characterRelationships: '&id,worldId,from,to,title,*tags,updated'
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
