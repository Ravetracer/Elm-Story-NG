import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator
} from 'unique-names-generator'

import { ElementId, StudioId, VARIABLE_TYPE, WorldId } from '../../data/types'

import api from '../../api'

/**
 * A new variable with a generated name, as the Variables tab's + button has
 * always made: three words camel cased, BOOLEAN, initial value 'false'.
 *
 * Shared so the tab button and the manager's Add Variable button cannot drift
 * apart on the type or the initial value — a variable whose declared type and
 * stored value disagree is exactly what the type-change path in `db/index.ts`
 * exists to avoid.
 */
const addVariable = async (
  studioId: StudioId,
  worldId: WorldId
): Promise<ElementId> => {
  const generatedName = uniqueNamesGenerator({
    dictionaries: [adjectives, colors, animals],
    length: 3
  })

  return await api().variables.saveVariable(studioId, {
    worldId,
    title: generatedName
      .split('_')
      .map((word, index) =>
        index === 0
          ? word
          : `${word.charAt(0).toUpperCase()}${word.substring(1)}`
      )
      .join(''),
    type: VARIABLE_TYPE.BOOLEAN,
    initialValue: 'false',
    tags: []
  })
}

export default addVariable
