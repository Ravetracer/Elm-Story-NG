import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator
} from 'unique-names-generator'

import { ElementId, StudioId, VARIABLE_TYPE, WorldId } from '../../data/types'

import api from '../../api'

/**
 * The title a rename would have stored. `VariableRow` strips digits and
 * non-word characters on save, so the add prompt applies the same rule rather
 * than accepting a title the next keystroke in the row would silently change.
 */
export const sanitizeVariableTitle = (title: string): string =>
  title.replace(/\d+/g, '').replace(/[\W_]/g, '')

/**
 * Three words camel cased, as the Variables tab's + button has always made.
 * Offered as the prompt's starting point so an author who has no name in mind
 * is no worse off than before.
 */
export const generateVariableTitle = (): string =>
  uniqueNamesGenerator({
    dictionaries: [adjectives, colors, animals],
    length: 3
  })
    .split('_')
    .map((word, index) =>
      index === 0 ? word : `${word.charAt(0).toUpperCase()}${word.substring(1)}`
    )
    .join('')

/**
 * A new variable: BOOLEAN, initial value 'false', and the title the author
 * gave — or a generated one when there is no prompt to give it.
 *
 * Shared so the tab button and the manager's Add Variable button cannot drift
 * apart on the type or the initial value — a variable whose declared type and
 * stored value disagree is exactly what the type-change path in `db/index.ts`
 * exists to avoid.
 */
const addVariable = async (
  studioId: StudioId,
  worldId: WorldId,
  title?: string
): Promise<ElementId> => {
  const sanitized = title ? sanitizeVariableTitle(title) : ''

  return await api().variables.saveVariable(studioId, {
    worldId,
    title: sanitized || generateVariableTitle(),
    type: VARIABLE_TYPE.BOOLEAN,
    initialValue: 'false',
    tags: []
  })
}

export default addVariable
