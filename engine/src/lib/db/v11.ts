// ES 0.7.1
import Dexie from 'dexie'

import { LIBRARY_TABLE } from '.'

/**
 * Brings existing world records up to the 0.7.1 schema version. 0.7.1 changed no
 * field, so this only restamps `World.engine`. Declaring no `stores()` inherits
 * v10's schema.
 *
 * Upstream's own v11 says `database.version(10)`, not 11. Dexie 3's `version(n)`
 * returns the *existing* Version instance for a number already declared, and
 * `.upgrade()` assigns `_cfg.contentUpgrade`, so that call silently replaces
 * v10's entire migration. Anyone upgrading from v9 or earlier would have skipped
 * it. Hence 11 here.
 */
export default (database: Dexie) => {
  database.version(11).upgrade(async (tx) => {
    await tx
      .table(LIBRARY_TABLE.WORLDS)
      .toCollection()
      .modify((world) => {
        world.engine = '0.7.1'
      })
  })
}
