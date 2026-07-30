import { ElementId, StudioId } from '../../data/types'

import { describeVariableRemoval, VariableUsage } from '../../lib/variableUsage'

import { Modal } from 'antd'

import api from '../../api'

/**
 * Asks before deleting a variable, saying what else the deletion takes with it.
 *
 * `LibraryDatabase.removeVariable` cascades: it deletes every condition and
 * effect naming the variable — which changes whether the paths carrying them are
 * taken — and clears the variable from any input. Template expressions it cannot
 * repair, because they name the variable by title and live inside a Slate
 * document. None of that was visible before: both delete affordances removed the
 * variable on a single click.
 *
 * `usage` is undefined while the queries behind it are still resolving, which is
 * reported as unknown rather than as nothing — the difference matters when the
 * answer is what makes the deletion safe.
 */
const confirmRemoveVariable = (
  studioId: StudioId,
  variableId: ElementId,
  variableTitle: string,
  usage: VariableUsage[] | undefined
) => {
  const consequence = usage ? describeVariableRemoval(usage) : undefined

  let content: string

  if (!usage) {
    content =
      'Any path conditions and effects using it will be removed as well.'
  } else if (consequence) {
    content = `This will also ${consequence}.`
  } else {
    content = 'Nothing references this variable.'
  }

  Modal.confirm({
    title: `Delete '${variableTitle}'?`,
    content,
    okText: 'Delete Variable',
    okButtonProps: { danger: true },
    cancelText: 'Cancel',
    centered: true,
    onOk: async () => {
      await api().variables.removeVariable(studioId, variableId)
    }
  })
}

export default confirmRemoveVariable
