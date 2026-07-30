// upgrades 0.7.0 data to 0.7.1
import { WorldDataJSON as WorldDataJSON_070 } from '../types/0.7.0'
import { WorldDataJSON as WorldDataJSON_071 } from '../types/0.7.1'

/**
 * A deliberate no-op, kept as a step so the chain in `importWorldData` has one
 * entry per version rather than a gap the next upgrade has to reason around.
 *
 * 0.7.1 changed no field of the exported shape. `_.engine` is stamped by the
 * caller after the chain runs, not here, which is why this does not touch `_`.
 */
export default (worldData: WorldDataJSON_070): WorldDataJSON_071 => worldData
