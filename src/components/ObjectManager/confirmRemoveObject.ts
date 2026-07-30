import { ElementId, StudioId, WorldId } from '../../data/types'

import { Modal } from 'antd'

import api from '../../api'

/**
 * Asks before deleting an object, saying what else the deletion takes with it.
 *
 * `LibraryDatabase.removeObject` cascades wider than it looks. It deletes every
 * recipe naming the object on either side, deletes every object condition naming
 * it — which changes whether the paths carrying them are taken — and strips the
 * object out of placement gates on *other* objects, which can make something else
 * in the world stop appearing.
 *
 * That last one is the reason this dialogue exists rather than a bare confirm: a
 * placement gate is an inline array on another object, so nothing in the editor
 * would have reported it as broken. Same reasoning as `confirmRemoveVariable`.
 *
 * The counts are read before the dialogue opens; `undefined` means the queries had
 * not resolved, which is reported as unknown rather than as nothing — the
 * difference matters when the answer is what makes the deletion safe.
 */
const confirmRemoveObject = async (
  studioId: StudioId,
  worldId: WorldId,
  objectId: ElementId,
  objectTitle: string,
  onRemoved?: () => void
) => {
  let content =
    'Any recipes and path conditions using it will be removed as well.'

  try {
    const [recipes, conditions, objects] = await Promise.all([
      api().recipes.getRecipesByObjectRef(studioId, worldId, objectId),
      api().objectConditions.getObjectConditionsByWorldRef(studioId, worldId),
      api().objects.getObjectsByWorldRef(studioId, worldId)
    ])

    const conditionCount = conditions.filter(
      (condition) => condition.objectId === objectId
    ).length

    const gatedObjects = objects.filter(
      (other) =>
        other.id !== objectId &&
        other.placements.some((placement) =>
          placement.objectConditions?.some(
            (condition) => condition.objectId === objectId
          )
        )
    )

    const consequences: string[] = []

    if (recipes.length > 0)
      consequences.push(
        `remove ${recipes.length} recipe${recipes.length === 1 ? '' : 's'}`
      )

    if (conditionCount > 0)
      consequences.push(
        `remove ${conditionCount} path condition${
          conditionCount === 1 ? '' : 's'
        }`
      )

    if (gatedObjects.length > 0)
      consequences.push(
        `change where ${gatedObjects
          .map(({ title }) => `'${title}'`)
          .join(', ')} appear${gatedObjects.length === 1 ? 's' : ''}`
      )

    content =
      consequences.length > 0
        ? `This will also ${consequences.join(', and ')}.`
        : 'Nothing references this object.'
  } catch (error) {
    // the fallback above is deliberately the pessimistic wording
  }

  Modal.confirm({
    title: `Delete '${objectTitle}'?`,
    content,
    okText: 'Delete Object',
    okType: 'danger',
    cancelText: 'Cancel',
    onOk: async () => {
      await api().objects.removeObject(studioId, objectId)

      onRemoved?.()
    }
  })
}

export default confirmRemoveObject
